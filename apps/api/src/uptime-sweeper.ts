/**
 * Uptime Sweeper — runs hourly via cron trigger
 *
 * Records one row per component per day into uptime_snapshots.
 * Uses UNIQUE(date, component) with INSERT OR REPLACE so the cron
 * can be called multiple times per day and the latest observation wins.
 * Also snapshots queue depth into queue_depth_snapshots for observability.
 */

import type { Env } from "./index";

export async function runUptimeSweeper(env: Env): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // "2026-02-19"

  // ── Check component health ──────────────────────────────────────────────────

  // API: if this code is running, the API is operational
  const apiOperational = 1;

  // Queue: jobs stuck in 'submitted' for > 10 minutes = incident
  const queueStuck = await env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM jobs
    WHERE status = 'submitted' AND created_at < datetime('now', '-10 minutes')
  `).first<{ cnt: number }>().catch(() => ({ cnt: 0 }));

  const queueOk = (queueStuck?.cnt ?? 0) <= 10;
  const queueNote = queueOk ? null : `${queueStuck?.cnt} jobs stuck >10 minutes`;

  // Agent: ping the compute cluster health endpoint
  let agentOk = false;
  let agentNote: string | null = "Agent health unknown";
  try {
    const agentRes = await fetch(`${env.WORKER_CLUSTER_URL}/agent/health`, {
      headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
      signal: AbortSignal.timeout(8_000),
    });
    agentOk = agentRes.ok;
    agentNote = agentOk ? null : `Agent HTTP ${agentRes.status}`;
  } catch (err) {
    agentOk = false;
    agentNote = `Agent unreachable: ${String(err).slice(0, 80)}`;
  }

  // ── Upsert daily snapshots ──────────────────────────────────────────────────

  await Promise.all([
    env.DB.prepare(`
      INSERT INTO uptime_snapshots (date, component, is_operational, incident_note)
      VALUES (?, 'api', ?, NULL)
      ON CONFLICT(date, component) DO UPDATE SET
        is_operational = excluded.is_operational,
        incident_note  = excluded.incident_note,
        captured_at    = datetime('now')
    `).bind(today, apiOperational).run(),

    env.DB.prepare(`
      INSERT INTO uptime_snapshots (date, component, is_operational, incident_note)
      VALUES (?, 'queue', ?, ?)
      ON CONFLICT(date, component) DO UPDATE SET
        is_operational = excluded.is_operational,
        incident_note  = excluded.incident_note,
        captured_at    = datetime('now')
    `).bind(today, queueOk ? 1 : 0, queueNote).run(),

    env.DB.prepare(`
      INSERT INTO uptime_snapshots (date, component, is_operational, incident_note)
      VALUES (?, 'agents', ?, ?)
      ON CONFLICT(date, component) DO UPDATE SET
        is_operational = excluded.is_operational,
        incident_note  = excluded.incident_note,
        captured_at    = datetime('now')
    `).bind(today, agentOk ? 1 : 0, agentNote).run(),
  ]);

  // ── Snapshot queue depth for observability ──────────────────────────────────

  const queueDepthRow = await env.DB.prepare(`
    SELECT
      COUNT(CASE WHEN status IN ('submitted', 'queued') THEN 1 END) as queue_depth,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as dlq_depth
    FROM jobs
  `).first<{ queue_depth: number; dlq_depth: number }>().catch(() => null);

  if (queueDepthRow) {
    await env.DB.prepare(`
      INSERT INTO queue_depth_snapshots (queue_depth, dlq_depth, captured_at)
      VALUES (?, ?, datetime('now'))
    `).bind(queueDepthRow.queue_depth ?? 0, queueDepthRow.dlq_depth ?? 0).run();
  }

  // ── Prune snapshots older than 91 days ─────────────────────────────────────
  await env.DB.prepare(
    "DELETE FROM uptime_snapshots WHERE date < date('now', '-91 days')"
  ).run().catch(() => {});

  // Prune queue depth snapshots older than 7 days
  await env.DB.prepare(
    "DELETE FROM queue_depth_snapshots WHERE captured_at < datetime('now', '-7 days')"
  ).run().catch(() => {});

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "info",
    service: "workers-api", event: "uptime_sweep",
    api: apiOperational, queue: queueOk, agent: agentOk,
    queueStuck: queueStuck?.cnt ?? 0,
  }));
}
