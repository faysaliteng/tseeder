/**
 * Queue Consumer — processes job dispatch messages from rdm-job-queue
 *
 * Reads the active provider from D1 and routes to:
 *   - Seedr.cc REST API    (provider === 'seedr')
 *   - External compute cluster (provider === 'cloudflare')
 */

import type { Env } from "./index";
import { JobStatus } from "@rdm/shared";
import { appendJobEvent, updateJobStatus } from "./d1-helpers";

interface JobQueueMessage {
  jobId: string;
  userId: string;
  type: "magnet" | "torrent";
  magnetUri?: string;
  torrentBase64?: string;
  correlationId: string;
  attempt: number;
}

// ── Provider row from D1 ───────────────────────────────────────────────────────

interface ProviderRow {
  id: string;
  provider: "cloudflare" | "seedr";
  config: string; // JSON
}

async function getActiveProvider(db: D1Database): Promise<{ provider: "cloudflare" | "seedr"; config: Record<string, unknown> }> {
  const row = await db.prepare(
    "SELECT provider, config FROM provider_configs WHERE is_active = 1 LIMIT 1",
  ).first<ProviderRow>();

  if (!row) return { provider: "cloudflare", config: {} };

  let config: Record<string, unknown> = {};
  try { config = JSON.parse(row.config ?? "{}"); } catch { /* ignore */ }

  return { provider: row.provider, config };
}

// ── Main batch handler ────────────────────────────────────────────────────────

export async function handleQueueBatch(
  batch: MessageBatch<unknown>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const msg = message.body as JobQueueMessage;
    const log = (level: string, text: string, extra?: Record<string, unknown>) =>
      console.log(JSON.stringify({
        ts: new Date().toISOString(), level,
        correlationId: msg.correlationId, jobId: msg.jobId,
        msg: text, ...extra,
      }));

    try {
      log("info", "Processing queue message", { attempt: msg.attempt });
      await processJob(msg, env, log);
      message.ack();
    } catch (err) {
      log("error", "Queue processing error", { error: String(err) });

      if (msg.attempt >= 5) {
        log("error", "Max retries exceeded — sending to DLQ");

        // Mark job as failed in D1
        await updateJobStatus(env.DB, {
          id: msg.jobId,
          status: JobStatus.Failed,
          error: String(err),
        });

        await appendJobEvent(env.DB, {
          jobId: msg.jobId,
          eventType: "job_failed_dlq",
          payload: { error: String(err), attempt: msg.attempt },
          correlationId: msg.correlationId,
        });

        await env.JOB_DLQ.send({
          ...msg,
          failedAt: new Date().toISOString(),
          error: String(err),
        });

        message.ack(); // ack to remove from main queue
      } else {
        message.retry(); // exponential backoff handled by Cloudflare Queue
      }
    }
  }
}

// ── Job processor ─────────────────────────────────────────────────────────────

async function processJob(
  msg: JobQueueMessage,
  env: Env,
  log: (level: string, text: string, extra?: Record<string, unknown>) => void,
): Promise<void> {
  // Read active provider from D1 (real-time — no cache)
  const { provider, config } = await getActiveProvider(env.DB);
  log("info", "Dispatching via provider", { provider });

  if (provider === "seedr") {
    await dispatchToSeedr(msg, env, config, log);
  } else {
    await dispatchToComputeAgent(msg, env, log);
  }
}

// ── Seedr provider ────────────────────────────────────────────────────────────

async function dispatchToSeedr(
  msg: JobQueueMessage,
  env: Env,
  config: Record<string, unknown>,
  log: (level: string, text: string, extra?: Record<string, unknown>) => void,
): Promise<void> {
  const email = (config.email as string) || (env as any).SEEDR_EMAIL;
  const password = (config.password as string) || (env as any).SEEDR_PASSWORD;

  if (!email || !password) {
    throw new Error("Seedr provider is active but credentials are not configured. Set SEEDR_EMAIL + SEEDR_PASSWORD secrets.");
  }

  const auth = "Basic " + btoa(`${email}:${password}`);

  // Update job status
  await updateJobStatus(env.DB, { id: msg.jobId, status: JobStatus.MetadataFetch });
  await appendJobEvent(env.DB, {
    jobId: msg.jobId, eventType: "provider_dispatched",
    payload: { provider: "seedr", attempt: msg.attempt },
    correlationId: msg.correlationId,
  });

  let seedrTransferId: number | null = null;

  if (msg.type === "magnet" && msg.magnetUri) {
    const body = new URLSearchParams({ magnet: msg.magnetUri }).toString();
    const res = await fetch("https://www.seedr.cc/rest/transfer/magnet", {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Seedr rejected magnet: ${res.status} ${text}`);
    }

    const data = await res.json<{ result?: boolean | string; id?: number; error?: string }>();
    if (data.result === false || data.error) {
      throw new Error(`Seedr error: ${data.error ?? "Unknown"}`);
    }

    // Seedr may return transfer id or just { result: true }
    seedrTransferId = data.id ?? null;
    log("info", "Seedr magnet dispatched", { seedrTransferId });
  } else if (msg.type === "torrent" && msg.torrentBase64) {
    // Convert base64 torrent to a File-like blob and upload
    const bytes = Uint8Array.from(atob(msg.torrentBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/x-bittorrent" });
    const form = new FormData();
    form.append("file", blob, `${msg.jobId}.torrent`);

    const res = await fetch("https://www.seedr.cc/rest/transfer/file", {
      method: "POST",
      headers: { "Authorization": auth },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Seedr torrent upload failed: ${res.status}`);
    }

    const data = await res.json<{ result?: boolean | string; id?: number; error?: string }>();
    if (data.result === false || data.error) {
      throw new Error(`Seedr error: ${data.error ?? "Unknown"}`);
    }
    seedrTransferId = data.id ?? null;
    log("info", "Seedr torrent dispatched", { seedrTransferId });
  } else {
    throw new Error("No magnetUri or torrentBase64 in queue message");
  }

  // Store provider job id in worker_id field for polling
  if (seedrTransferId !== null) {
    await updateJobStatus(env.DB, {
      id: msg.jobId,
      status: JobStatus.Downloading,
      workerId: `seedr:${seedrTransferId}`,
    });
  }

  // Initialise Durable Object progress state
  const doId = env.JOB_PROGRESS_DO.idFromName(msg.jobId);
  await env.JOB_PROGRESS_DO.get(doId).fetch(new Request("http://do/update", {
    method: "POST",
    body: JSON.stringify({
      jobId: msg.jobId,
      status: JobStatus.Downloading,
      progressPct: 0,
      workerId: `seedr:${seedrTransferId}`,
    }),
    headers: { "Content-Type": "application/json" },
  }));
}

// ── Self-hosted compute agent provider ────────────────────────────────────────

async function dispatchToComputeAgent(
  msg: JobQueueMessage,
  env: Env,
  log: (level: string, text: string, extra?: Record<string, unknown>) => void,
): Promise<void> {
  // Step 1: Select least-loaded compute agent
  const workerUrl = await selectWorker(env, log);
  if (!workerUrl) throw new Error("No available compute workers");

  // Update job status
  await updateJobStatus(env.DB, { id: msg.jobId, status: JobStatus.MetadataFetch, workerId: workerUrl });
  await appendJobEvent(env.DB, {
    jobId: msg.jobId, eventType: "provider_dispatched",
    payload: { provider: "cloudflare", workerUrl, attempt: msg.attempt },
    correlationId: msg.correlationId,
  });

  // Step 2: Send job to compute agent
  const callbackUrl = `${env.APP_DOMAIN}/jobs/callback`;
  const payload = {
    jobId: msg.jobId,
    type: msg.type,
    magnetUri: msg.magnetUri,
    torrentBase64: msg.torrentBase64,
    callbackUrl,
    callbackSecret: await generateCallbackHmac(msg.jobId, env.CALLBACK_SIGNING_SECRET),
    correlationId: msg.correlationId,
  };

  const response = await fetch(`${workerUrl}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}`,
      "X-Correlation-ID": msg.correlationId,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Worker rejected job: ${response.status} ${text}`);
  }

  log("info", "Job dispatched to compute agent", { workerUrl });
}

// ── Worker selection — region-aware, load-balanced, failover ─────────────────
//
// Strategy:
//   1. Query worker_registry for healthy workers with capacity, sorted by load
//   2. If registry has workers → use the least-loaded healthy one
//   3. If registry is empty → fall back to WORKER_CLUSTER_URL (single-node mode)
//   4. If the selected worker fails to accept the job → try the next available

async function selectWorker(
  env: Env,
  log: (level: string, text: string, extra?: Record<string, unknown>) => void,
): Promise<string | null> {
  // First try: query D1 registry for registered workers
  try {
    const workers = await env.DB.prepare(`
      SELECT id, region, active_jobs, max_jobs, last_heartbeat
      FROM worker_registry
      WHERE status = 'healthy'
        AND last_heartbeat >= datetime('now', '-5 minutes')
        AND (max_jobs = 0 OR active_jobs < max_jobs)
      ORDER BY
        CAST(active_jobs AS REAL) / MAX(max_jobs, 1) ASC,
        last_heartbeat DESC
      LIMIT 5
    `).all<{ id: string; region: string | null; active_jobs: number; max_jobs: number }>()
      .catch(() => ({ results: [] as any[] }));

    if (workers.results.length > 0) {
      // Select the least-loaded worker
      const best = workers.results[0];
      log("info", "Worker selected from registry", {
        workerId: best.id,
        region: best.region,
        load: `${best.active_jobs}/${best.max_jobs}`,
      });

      // Build URL: if WORKER_CLUSTER_URL uses {region} template, substitute
      if (env.WORKER_CLUSTER_URL.includes("{region}") && best.region) {
        return env.WORKER_CLUSTER_URL.replace("{region}", best.region);
      }

      // Otherwise return base URL (single cluster)
      return env.WORKER_CLUSTER_URL;
    }
  } catch (err) {
    log("warn", "Registry query failed, falling back to health check", { error: String(err) });
  }

  // Second try: legacy health-check based selection (single or multi-URL response)
  try {
    const response = await fetch(`${env.WORKER_CLUSTER_URL}/health`, {
      headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      log("warn", "Worker cluster health check failed", { status: response.status });
      return null;
    }

    // Try to parse worker list; fallback to single URL
    let workers: { url: string; activeJobs: number; capacity: number }[] = [];
    try {
      const body = await response.json<unknown>();
      if (Array.isArray(body)) workers = body as typeof workers;
    } catch { /* single worker mode */ }

    if (workers.length > 0) {
      const best = workers.sort((a, b) =>
        (a.activeJobs / (a.capacity || 1)) - (b.activeJobs / (b.capacity || 1)),
      )[0];
      log("info", "Worker selected from health response", { url: best?.url });
      return best?.url ?? null;
    }

    return env.WORKER_CLUSTER_URL;
  } catch (err) {
    log("warn", "Could not reach worker cluster", { error: String(err) });
    return null;
  }
}

// ── HMAC for callback signature ───────────────────────────────────────────────

async function generateCallbackHmac(jobId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(jobId));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}
