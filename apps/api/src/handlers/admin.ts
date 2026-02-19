import type { Env } from "../index";
import { getUserPlan, getUserUsage, writeAuditLog, deleteUserSessions } from "../d1-helpers";
import { apiError, formatZodError } from "./auth";
import { UpdateUserSchema, BlocklistAddSchema } from "@rdm/shared";

type Ctx = { params: Record<string, string>; user?: { id: string; role: string } };

// ── GET /usage ────────────────────────────────────────────────────────────────

export async function handleGetUsage(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;

  const [plan, usage] = await Promise.all([
    getUserPlan(env.DB, userId),
    getUserUsage(env.DB, userId),
  ]);

  if (!plan) return apiError("NOT_FOUND", "No plan assigned to account", 404, correlationId);

  const totalJobs = await env.DB.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE user_id = ?")
    .bind(userId).first<{ cnt: number }>();

  return Response.json({
    plan: {
      id: plan.id, name: plan.name, maxJobs: plan.max_jobs,
      maxStorageGb: plan.max_storage_gb, maxFileSizeMb: plan.max_file_size_mb,
      bandwidthGb: plan.bandwidth_gb, retentionDays: plan.retention_days,
    },
    storageUsedBytes: usage.storageUsedBytes,
    bandwidthUsedBytes: usage.bandwidthUsedBytes,
    activeJobs: usage.activeJobs,
    totalJobs: totalJobs?.cnt ?? 0,
  });
}

// ── GET /plans ────────────────────────────────────────────────────────────────

export async function handleGetPlans(_req: Request, env: Env): Promise<Response> {
  const result = await env.DB.prepare("SELECT * FROM plans ORDER BY price_cents ASC").all();
  return Response.json({ plans: result.results });
}

// ── GET /admin/users ──────────────────────────────────────────────────────────

export async function handleAdminListUsers(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;
  const search = url.searchParams.get("q") ?? "";
  const role = url.searchParams.get("role") ?? "";
  const suspended = url.searchParams.get("suspended");

  let where = "WHERE 1=1";
  const bindings: (string | number)[] = [];
  if (search) { where += " AND u.email LIKE ?"; bindings.push(`%${search}%`); }
  if (role) { where += " AND u.role = ?"; bindings.push(role); }
  if (suspended === "1") { where += " AND u.suspended = 1"; }
  if (suspended === "0") { where += " AND u.suspended = 0"; }

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT u.id, u.email, u.role, u.email_verified, u.suspended, u.created_at, u.updated_at,
             p.name as plan_name
      FROM users u
      LEFT JOIN user_plan_assignments upa ON upa.user_id = u.id
      LEFT JOIN plans p ON p.id = upa.plan_id
      ${where}
      ORDER BY u.created_at DESC LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM users u ${where}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── GET /admin/users/:id ──────────────────────────────────────────────────────

export async function handleAdminGetUser(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { id } = ctx.params;

  const [user, plan, usage, sessions, recentJobs, auditEvents] = await Promise.all([
    env.DB.prepare(`
      SELECT u.*, p.name as plan_name
      FROM users u
      LEFT JOIN user_plan_assignments upa ON upa.user_id = u.id
      LEFT JOIN plans p ON p.id = upa.plan_id
      WHERE u.id = ? LIMIT 1
    `).bind(id).first<any>(),

    env.DB.prepare(`
      SELECT p.* FROM plans p
      JOIN user_plan_assignments upa ON upa.plan_id = p.id
      WHERE upa.user_id = ? ORDER BY upa.started_at DESC LIMIT 1
    `).bind(id).first<any>(),

    (async () => {
      const s = await env.DB.prepare(`
        SELECT COALESCE(SUM(f.size_bytes), 0) as storage_bytes
        FROM files f JOIN jobs j ON j.id = f.job_id
        WHERE j.user_id = ? AND f.is_complete = 1
      `).bind(id).first<{ storage_bytes: number }>();
      const jc = await env.DB.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE user_id = ?")
        .bind(id).first<{ cnt: number }>();
      return { storageBytes: s?.storage_bytes ?? 0, totalJobs: jc?.cnt ?? 0 };
    })(),

    env.DB.prepare(`
      SELECT id, device_info, ip_address, created_at, last_seen_at, expires_at
      FROM sessions WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY last_seen_at DESC LIMIT 10
    `).bind(id).all<any>(),

    env.DB.prepare(`
      SELECT id, name, status, created_at, completed_at FROM jobs
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
    `).bind(id).all<any>(),

    env.DB.prepare(`
      SELECT action, target_type, target_id, created_at, ip_address FROM audit_logs
      WHERE actor_id = ? OR target_id = ?
      ORDER BY created_at DESC LIMIT 20
    `).bind(id, id).all<any>(),
  ]);

  if (!user) return apiError("NOT_FOUND", "User not found", 404, correlationId);

  return Response.json({
    user,
    plan,
    usage,
    sessions: sessions.results,
    recentJobs: recentJobs.results,
    auditTimeline: auditEvents.results,
  });
}

// ── PATCH /admin/users/:id ────────────────────────────────────────────────────

export async function handleAdminUpdateUser(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const body = await req.json().catch(() => null);
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);

  const { id } = ctx.params;
  const { role, suspended, planId } = parsed.data;

  if (role !== undefined) {
    await env.DB.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(role, id).run();
  }
  if (suspended !== undefined) {
    await env.DB.prepare("UPDATE users SET suspended = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(suspended ? 1 : 0, id).run();
    // Force logout suspended users
    if (suspended) await deleteUserSessions(env.DB, id);
  }
  if (planId !== undefined) {
    const plan = await env.DB.prepare("SELECT id FROM plans WHERE id = ? LIMIT 1").bind(planId).first<{ id: string }>();
    if (!plan) return apiError("NOT_FOUND", "Plan not found", 404, correlationId);
    await env.DB.prepare(`
      INSERT INTO user_plan_assignments (user_id, plan_id) VALUES (?, ?)
      ON CONFLICT DO NOTHING
    `).bind(id, planId).run();
  }

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id,
    action: suspended ? "user.suspended" : planId ? "user.plan_changed" : "user.updated",
    targetType: "user", targetId: id,
    metadata: parsed.data, ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ id, ...parsed.data, message: "User updated" });
}

// ── POST /admin/users/:id/force-logout ───────────────────────────────────────

export async function handleAdminForceLogout(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { id } = ctx.params;

  const user = await env.DB.prepare("SELECT id FROM users WHERE id = ? LIMIT 1").bind(id).first<{ id: string }>();
  if (!user) return apiError("NOT_FOUND", "User not found", 404, correlationId);

  await deleteUserSessions(env.DB, id);

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "user.force_logout",
    targetType: "user", targetId: id,
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ message: "All sessions terminated", userId: id });
}

// ── GET /admin/jobs ───────────────────────────────────────────────────────────

export async function handleAdminListJobs(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const offset = (page - 1) * limit;
  const status = url.searchParams.get("status");
  const userId = url.searchParams.get("userId");
  const q = url.searchParams.get("q") ?? "";

  let where = "WHERE 1=1";
  const bindings: (string | number)[] = [];
  if (status) { where += " AND j.status = ?"; bindings.push(status); }
  if (userId) { where += " AND j.user_id = ?"; bindings.push(userId); }
  if (q) { where += " AND (j.name LIKE ? OR j.infohash LIKE ?)"; bindings.push(`%${q}%`, `%${q}%`); }

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT j.*, u.email as user_email FROM jobs j
      JOIN users u ON u.id = j.user_id
      ${where}
      ORDER BY j.created_at DESC LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM jobs j ${where}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── POST /admin/jobs/:id/terminate ────────────────────────────────────────────

export async function handleAdminTerminateJob(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { id } = ctx.params;
  const body = await req.json().catch(() => ({})) as { reason?: string };

  const job = await env.DB.prepare("SELECT * FROM jobs WHERE id = ?").bind(id).first<any>();
  if (!job) return apiError("NOT_FOUND", "Job not found", 404, correlationId);

  if (["completed", "failed", "cancelled"].includes(job.status)) {
    return apiError("INVALID_STATE", "Job is already in a terminal state", 409, correlationId);
  }

  await env.DB.prepare("UPDATE jobs SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?")
    .bind(id).run();

  if (job.worker_id) {
    try {
      await fetch(`${env.WORKER_CLUSTER_URL}/agent/jobs/${id}/stop`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
        signal: AbortSignal.timeout(5000),
      });
    } catch { /* non-fatal — worker will self-heal */ }
  }

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "job.terminated",
    targetType: "job", targetId: id,
    metadata: { previousStatus: job.status, reason: body.reason },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ id, status: "cancelled", message: "Job terminated by admin" });
}

// ── GET /admin/system-health ──────────────────────────────────────────────────

export async function handleAdminSystemHealth(_req: Request, env: Env): Promise<Response> {
  const [statusCounts, recentErrors, agentHealth, queueDepth] = await Promise.all([
    env.DB.prepare("SELECT status, COUNT(*) as cnt FROM jobs GROUP BY status").all<{ status: string; cnt: number }>(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'failed' AND updated_at >= datetime('now', '-24 hours')").first<{ cnt: number }>(),
    fetch(`${env.WORKER_CLUSTER_URL}/agent/health`, {
      headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    }).then(r => r.ok ? r.json() : null).catch(() => null),
    // DLQ depth check from D1 (jobs stuck in submitted > 10 min)
    env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM jobs
      WHERE status = 'submitted' AND created_at < datetime('now', '-10 minutes')
    `).first<{ cnt: number }>(),
  ]);

  const byStatus = Object.fromEntries(statusCounts.results.map(r => [r.status, r.cnt]));

  return Response.json({
    jobs: byStatus,
    failedLast24h: recentErrors?.cnt ?? 0,
    queueDepth: (byStatus["submitted"] ?? 0) + (byStatus["queued"] ?? 0),
    dlqDepth: queueDepth?.cnt ?? 0,
    agent: agentHealth,
    status: agentHealth ? "healthy" : "agent_unreachable",
    ts: new Date().toISOString(),
  });
}

// ── GET /admin/audit ──────────────────────────────────────────────────────────

export async function handleAdminAudit(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const offset = (page - 1) * limit;
  const action = url.searchParams.get("action") ?? "";
  const actorId = url.searchParams.get("actorId") ?? "";

  let where = "WHERE 1=1";
  const bindings: (string | number)[] = [];
  if (action) { where += " AND a.action LIKE ?"; bindings.push(`%${action}%`); }
  if (actorId) { where += " AND a.actor_id = ?"; bindings.push(actorId); }

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT a.*, u.email as actor_email FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      ${where}
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM audit_logs a ${where}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── POST /admin/blocklist ─────────────────────────────────────────────────────

export async function handleAdminBlocklist(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const body = await req.json().catch(() => null);
  const parsed = BlocklistAddSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);

  const { infohash, reason } = parsed.data;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO blocklist (infohash, reason, added_by)
    VALUES (?, ?, ?)
  `).bind(infohash.toLowerCase(), reason ?? null, ctx.user!.id).run();

  // Terminate any active jobs with this infohash
  const activeJobs = await env.DB.prepare(`
    SELECT id, worker_id FROM jobs
    WHERE infohash = ? AND status NOT IN ('completed', 'failed', 'cancelled')
  `).bind(infohash.toLowerCase()).all<{ id: string; worker_id: string | null }>();

  for (const job of activeJobs.results) {
    await env.DB.prepare("UPDATE jobs SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?")
      .bind(job.id).run();
    if (job.worker_id) {
      try {
        await fetch(`${env.WORKER_CLUSTER_URL}/agent/jobs/${job.id}/stop`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
          signal: AbortSignal.timeout(3000),
        });
      } catch { /* non-fatal */ }
    }
  }

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "blocklist.added",
    targetType: "infohash", targetId: infohash,
    metadata: { reason, jobsTerminated: activeJobs.results.length },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({
    message: "Infohash added to blocklist",
    infohash,
    jobsTerminated: activeJobs.results.length,
  });
}

// ── GET /admin/blocklist ──────────────────────────────────────────────────────

export async function handleAdminListBlocklist(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = 50;
  const offset = (page - 1) * limit;

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT b.*, u.email as added_by_email FROM blocklist b
      LEFT JOIN users u ON u.id = b.added_by
      ORDER BY b.added_at DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM blocklist").first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── GET /admin/security-events ────────────────────────────────────────────────

export async function handleAdminSecurityEvents(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const severity = url.searchParams.get("severity") ?? "";
  const limit = 50;
  const offset = (page - 1) * limit;

  const where = severity ? "WHERE severity = ?" : "";
  const bindings: string[] = severity ? [severity] : [];

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT s.*, u.email as actor_email FROM security_events s
      LEFT JOIN users u ON u.id = s.actor_id
      ${where}
      ORDER BY s.created_at DESC LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM security_events ${where}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── GET /admin/feature-flags ──────────────────────────────────────────────────

export async function handleAdminListFlags(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const rows = await env.DB.prepare("SELECT * FROM feature_flags ORDER BY key").all();
  return Response.json({ flags: rows.results });
}

// ── PATCH /admin/feature-flags/:key ──────────────────────────────────────────

export async function handleAdminUpdateFlag(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { key } = ctx.params;
  const body = await req.json().catch(() => null) as { value?: number; reason?: string } | null;

  if (!body || body.value === undefined) {
    return apiError("VALIDATION_ERROR", "value (0 or 1) is required", 400, correlationId);
  }

  const existing = await env.DB.prepare("SELECT * FROM feature_flags WHERE key = ? LIMIT 1")
    .bind(key).first<any>();
  if (!existing) return apiError("NOT_FOUND", "Feature flag not found", 404, correlationId);

  await env.DB.prepare(`
    UPDATE feature_flags SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = ?
  `).bind(body.value, ctx.user!.id, key).run();

  await env.DB.prepare(`
    INSERT INTO config_changes (key, old_value, new_value, changed_by, reason)
    VALUES (?, ?, ?, ?, ?)
  `).bind(key, String(existing.value), String(body.value), ctx.user!.id, body.reason ?? null).run();

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "config.flag_changed",
    targetType: "feature_flag", targetId: key,
    metadata: { oldValue: existing.value, newValue: body.value, reason: body.reason },
  });

  return Response.json({ key, value: body.value, message: "Feature flag updated" });
}
