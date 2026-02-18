/**
 * Typed D1 query helpers — prevent raw string queries and enforce parameterisation
 */

import type { Env } from "./index";

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUserByEmail(db: D1Database, email: string) {
  return db.prepare(`
    SELECT id, email, password_hash, role, email_verified, accepted_aup, suspended, created_at
    FROM users WHERE email = ? COLLATE NOCASE LIMIT 1
  `).bind(email.toLowerCase()).first<{
    id: string; email: string; password_hash: string; role: string;
    email_verified: number; accepted_aup: number; suspended: number; created_at: string;
  }>();
}

export async function getUserById(db: D1Database, id: string) {
  return db.prepare(`
    SELECT id, email, role, email_verified, accepted_aup, suspended, created_at
    FROM users WHERE id = ? LIMIT 1
  `).bind(id).first<{
    id: string; email: string; role: string;
    email_verified: number; accepted_aup: number; suspended: number; created_at: string;
  }>();
}

export async function createUser(db: D1Database, params: {
  id: string; email: string; passwordHash: string;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO users (id, email, password_hash, accepted_aup)
    VALUES (?, ?, ?, 1)
  `).bind(params.id, params.email.toLowerCase(), params.passwordHash).run();

  // Assign free plan
  const freePlan = await db.prepare("SELECT id FROM plans WHERE name = 'free' LIMIT 1").first<{ id: string }>();
  if (freePlan) {
    await db.prepare(`
      INSERT INTO user_plan_assignments (user_id, plan_id) VALUES (?, ?)
    `).bind(params.id, freePlan.id).run();
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function createSession(db: D1Database, params: {
  id: string; userId: string; tokenHash: string;
  expiresAt: string; deviceInfo?: string; ipAddress?: string;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, device_info, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    params.id, params.userId, params.tokenHash,
    params.expiresAt, params.deviceInfo ?? null, params.ipAddress ?? null,
  ).run();
}

export async function getSessionByTokenHash(db: D1Database, tokenHash: string) {
  return db.prepare(`
    SELECT s.id, s.user_id, s.expires_at,
           u.id as uid, u.role, u.suspended, u.email, u.email_verified, u.accepted_aup
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(tokenHash).first<{
    id: string; user_id: string; expires_at: string;
    uid: string; role: string; suspended: number;
    email: string; email_verified: number; accepted_aup: number;
  }>();
}

export async function deleteSession(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function deleteUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export async function getJobById(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM jobs WHERE id = ? LIMIT 1").bind(id)
    .first<JobRow>();
}

export async function getJobByIdForUser(db: D1Database, id: string, userId: string) {
  return db.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ? LIMIT 1")
    .bind(id, userId).first<JobRow>();
}

export async function listJobsForUser(db: D1Database, params: {
  userId: string; status?: string; page: number; limit: number;
  sortBy: string; sortDir: string;
}): Promise<{ rows: JobRow[]; total: number }> {
  const offset = (params.page - 1) * params.limit;
  const whereClause = params.status
    ? "WHERE j.user_id = ? AND j.status = ?"
    : "WHERE j.user_id = ?";
  const bindings = params.status
    ? [params.userId, params.status]
    : [params.userId];

  const [rows, countRow] = await Promise.all([
    db.prepare(`
      SELECT * FROM jobs j ${whereClause}
      ORDER BY ${params.sortBy} ${params.sortDir}
      LIMIT ? OFFSET ?
    `).bind(...bindings, params.limit, offset).all<JobRow>(),
    db.prepare(`SELECT COUNT(*) as cnt FROM jobs j ${whereClause}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ]);

  return { rows: rows.results, total: countRow?.cnt ?? 0 };
}

export async function createJob(db: D1Database, params: {
  id: string; userId: string; name: string;
  magnetUri: string | null; infohash: string | null; idempotencyKey: string;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO jobs (id, user_id, name, status, magnet_uri, infohash, idempotency_key)
    VALUES (?, ?, ?, 'submitted', ?, ?, ?)
  `).bind(
    params.id, params.userId, params.name,
    params.magnetUri, params.infohash, params.idempotencyKey,
  ).run();
}

export async function updateJobStatus(db: D1Database, params: {
  id: string; status: string; workerId?: string; error?: string; completedAt?: string;
}): Promise<void> {
  await db.prepare(`
    UPDATE jobs SET status = ?, worker_id = COALESCE(?, worker_id),
    error = COALESCE(?, error), completed_at = COALESCE(?, completed_at),
    updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    params.status, params.workerId ?? null,
    params.error ?? null, params.completedAt ?? null,
    params.id,
  ).run();
}

export async function getExistingCompletedJob(db: D1Database, infohash: string, userId: string) {
  return db.prepare(`
    SELECT j.* FROM jobs j
    JOIN user_plan_assignments upa ON upa.user_id = j.user_id
    JOIN plans p ON p.id = upa.plan_id
    WHERE j.infohash = ? AND j.user_id = ? AND j.status = 'completed'
    AND j.completed_at >= datetime('now', '-' || p.retention_days || ' days')
    LIMIT 1
  `).bind(infohash, userId).first<JobRow>();
}

// ── Files ─────────────────────────────────────────────────────────────────────

export async function getFileById(db: D1Database, id: string) {
  return db.prepare(`
    SELECT f.*, j.user_id FROM files f
    JOIN jobs j ON j.id = f.job_id
    WHERE f.id = ? LIMIT 1
  `).bind(id).first<FileRow & { user_id: string }>();
}

export async function listFilesForJob(db: D1Database, jobId: string) {
  return db.prepare("SELECT * FROM files WHERE job_id = ? ORDER BY path")
    .bind(jobId).all<FileRow>();
}

export async function upsertFiles(db: D1Database, jobId: string, files: {
  path: string; sizeBytes: number; mimeType?: string; r2Key?: string; isComplete: boolean;
}[]): Promise<void> {
  for (const f of files) {
    await db.prepare(`
      INSERT INTO files (id, job_id, path, size_bytes, mime_type, r2_key, is_complete)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id, path) DO UPDATE SET
        size_bytes = excluded.size_bytes,
        mime_type = COALESCE(excluded.mime_type, mime_type),
        r2_key = COALESCE(excluded.r2_key, r2_key),
        is_complete = excluded.is_complete
    `).bind(
      crypto.randomUUID(), jobId, sanitizePath(f.path),
      f.sizeBytes, f.mimeType ?? null, f.r2Key ?? null,
      f.isComplete ? 1 : 0,
    ).run();
  }
}

// ── Job Events ────────────────────────────────────────────────────────────────

export async function appendJobEvent(db: D1Database, params: {
  jobId: string; eventType: string; payload: unknown; correlationId: string;
}): Promise<void> {
  const lastSeq = await db.prepare(
    "SELECT COALESCE(MAX(sequence), 0) as seq FROM job_events WHERE job_id = ?"
  ).bind(params.jobId).first<{ seq: number }>();

  await db.prepare(`
    INSERT INTO job_events (id, job_id, event_type, payload, sequence)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    params.jobId,
    params.eventType,
    JSON.stringify({ ...params.payload as object, correlationId: params.correlationId }),
    (lastSeq?.seq ?? 0) + 1,
  ).run();
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

export async function writeAuditLog(db: D1Database, params: {
  actorId: string | null; action: string;
  targetType?: string; targetId?: string;
  metadata?: unknown; ipAddress?: string;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    params.actorId,
    params.action,
    params.targetType ?? null,
    params.targetId ?? null,
    JSON.stringify(params.metadata ?? {}),
    params.ipAddress ?? null,
  ).run();
}

// ── Blocklist ─────────────────────────────────────────────────────────────────

export async function isInfohashBlocked(db: D1Database, infohash: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 FROM blocklist WHERE infohash = ? LIMIT 1")
    .bind(infohash.toLowerCase()).first();
  return row !== null;
}

// ── Plans / Usage ─────────────────────────────────────────────────────────────

export async function getUserPlan(db: D1Database, userId: string) {
  return db.prepare(`
    SELECT p.* FROM plans p
    JOIN user_plan_assignments upa ON upa.plan_id = p.id
    WHERE upa.user_id = ? AND (upa.expires_at IS NULL OR upa.expires_at > datetime('now'))
    ORDER BY upa.started_at DESC LIMIT 1
  `).bind(userId).first<PlanRow>();
}

export async function getUserUsage(db: D1Database, userId: string) {
  const [storageRow, bandwidthRow, activeJobsRow] = await Promise.all([
    db.prepare(`
      SELECT COALESCE(SUM(f.size_bytes), 0) as bytes
      FROM files f JOIN jobs j ON j.id = f.job_id
      WHERE j.user_id = ? AND f.is_complete = 1
    `).bind(userId).first<{ bytes: number }>(),
    db.prepare(`
      SELECT COALESCE(SUM(bytes_downloaded), 0) as bytes
      FROM usage_metrics_daily
      WHERE user_id = ? AND date >= date('now', '-30 days')
    `).bind(userId).first<{ bytes: number }>(),
    db.prepare(`
      SELECT COUNT(*) as cnt FROM jobs
      WHERE user_id = ? AND status IN
      ('submitted','metadata_fetch','queued','downloading','uploading','paused')
    `).bind(userId).first<{ cnt: number }>(),
  ]);

  return {
    storageUsedBytes: storageRow?.bytes ?? 0,
    bandwidthUsedBytes: bandwidthRow?.bytes ?? 0,
    activeJobs: activeJobsRow?.cnt ?? 0,
  };
}

// ── Quota Check ───────────────────────────────────────────────────────────────

export async function checkQuota(db: D1Database, userId: string): Promise<{
  allowed: boolean; reason?: "QUOTA_JOBS" | "QUOTA_STORAGE";
}> {
  const [plan, usage] = await Promise.all([
    getUserPlan(db, userId),
    getUserUsage(db, userId),
  ]);

  if (!plan) return { allowed: false, reason: "QUOTA_JOBS" };

  if (plan.max_jobs !== -1 && usage.activeJobs >= plan.max_jobs) {
    return { allowed: false, reason: "QUOTA_JOBS" };
  }

  const maxStorageBytes = plan.max_storage_gb * 1e9;
  if (plan.max_storage_gb !== -1 && usage.storageUsedBytes >= maxStorageBytes) {
    return { allowed: false, reason: "QUOTA_STORAGE" };
  }

  return { allowed: true };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobRow {
  id: string; user_id: string; infohash: string | null;
  name: string; status: string; magnet_uri: string | null;
  worker_id: string | null; idempotency_key: string | null;
  error: string | null; created_at: string; updated_at: string;
  completed_at: string | null;
}

export interface FileRow {
  id: string; job_id: string; path: string;
  size_bytes: number; mime_type: string | null;
  r2_key: string | null; is_complete: number;
  created_at: string;
}

export interface PlanRow {
  id: string; name: string; max_jobs: number;
  max_storage_gb: number; max_file_size_mb: number;
  bandwidth_gb: number; retention_days: number; price_cents: number;
}

// ── Safety helpers ────────────────────────────────────────────────────────────

function sanitizePath(p: string): string {
  // Prevent path traversal; normalise separators
  return p
    .replace(/\\/g, "/")
    .split("/")
    .filter(seg => seg !== "" && seg !== "." && seg !== "..")
    .join("/");
}
