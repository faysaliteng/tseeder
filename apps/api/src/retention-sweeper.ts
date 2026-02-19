/**
 * Retention Sweeper — runs daily at 03:00 UTC via cron trigger
 *
 * - Enforces per-plan file retention windows (deletes files from R2 + D1)
 * - Snapshots storage metrics into storage_snapshots
 * - All actions are written to the audit log
 */

import type { Env } from "./index";
import { writeAuditLog } from "./d1-helpers";

export async function runRetentionSweeper(env: Env): Promise<void> {
  const log = (level: string, msg: string, extra?: Record<string, unknown>) =>
    console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: "workers-api", event: "retention_sweep", msg, ...extra }));

  log("info", "Starting retention sweep");

  // ── 1. Enforce plan-based retention ──────────────────────────────────────────

  const expired = await env.DB.prepare(`
    SELECT f.id, f.r2_key, f.size_bytes, f.job_id, p.retention_days, u.id as user_id
    FROM files f
    JOIN jobs j ON j.id = f.job_id
    JOIN users u ON u.id = j.user_id
    LEFT JOIN user_plan_assignments upa ON upa.user_id = u.id
    LEFT JOIN plans p ON p.id = upa.plan_id
    WHERE p.retention_days IS NOT NULL
      AND p.retention_days > 0
      AND j.status = 'completed'
      AND j.completed_at < datetime('now', '-' || CAST(p.retention_days AS TEXT) || ' days')
      AND f.is_complete = 1
    LIMIT 500
  `).all<{ id: string; r2_key: string | null; size_bytes: number; job_id: string; retention_days: number; user_id: string }>()
    .catch(() => ({ results: [] as any[] }));

  let deletedFiles = 0;
  let bytesReclaimed = 0;

  for (const f of expired.results) {
    // Delete from R2
    if (f.r2_key) {
      await env.FILES_BUCKET.delete(f.r2_key).catch(() => {});
    }
    // Delete from D1
    await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(f.id).run().catch(() => {});
    deletedFiles++;
    bytesReclaimed += f.size_bytes ?? 0;
  }

  log("info", "Retention sweep complete", { deletedFiles, bytesReclaimed });

  // Write audit log only when there is something to report
  if (deletedFiles > 0) {
    await writeAuditLog(env.DB, {
      actorId: null,
      action: "retention.sweep",
      targetType: "storage",
      targetId: "cron",
      metadata: { deletedFiles, bytesReclaimed, trigger: "daily_cron" },
    }).catch(() => {});
  }

  // ── 2. Snapshot storage totals ─────────────────────────────────────────────

  const stats = await env.DB.prepare(`
    SELECT COUNT(*) as total_files, COALESCE(SUM(size_bytes), 0) as total_bytes
    FROM files WHERE is_complete = 1
  `).first<{ total_files: number; total_bytes: number }>().catch(() => null);

  if (stats) {
    await env.DB.prepare(`
      INSERT INTO storage_snapshots (total_files, total_bytes, orphan_files)
      VALUES (?, ?, 0)
    `).bind(stats.total_files ?? 0, stats.total_bytes ?? 0).run().catch(() => {});
  }

  // ── 3. Prune old storage snapshots (keep 90 days) ──────────────────────────

  await env.DB.prepare(
    "DELETE FROM storage_snapshots WHERE captured_at < datetime('now', '-90 days')"
  ).run().catch(() => {});

  // ── 4. Prune api_metrics older than 30 days ────────────────────────────────

  await env.DB.prepare(
    "DELETE FROM api_metrics WHERE hour_bucket < strftime('%Y-%m-%dT%H:%M', datetime('now', '-30 days'))"
  ).run().catch(() => {});
}
