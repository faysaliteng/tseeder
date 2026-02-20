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
  const body = await req.json().catch(() => ({})) as { reason?: string; ticketId?: string };

  // Mandatory reason + ticket for destructive action
  if (!body.reason || body.reason.trim().length < 10) {
    return apiError("VALIDATION_ERROR", "reason is required (min 10 characters)", 400, correlationId);
  }
  if (!body.ticketId || body.ticketId.trim().length < 1) {
    return apiError("VALIDATION_ERROR", "ticketId is required", 400, correlationId);
  }

  const user = await env.DB.prepare("SELECT id FROM users WHERE id = ? LIMIT 1").bind(id).first<{ id: string }>();
  if (!user) return apiError("NOT_FOUND", "User not found", 404, correlationId);

  await deleteUserSessions(env.DB, id);

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "user.force_logout",
    targetType: "user", targetId: id,
    metadata: { reason: body.reason, ticketId: body.ticketId },
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
  const body = await req.json().catch(() => ({})) as { reason?: string; ticketId?: string };

  // Mandatory reason + ticket for all destructive actions
  if (!body.reason || body.reason.trim().length < 10) {
    return apiError("VALIDATION_ERROR", "reason is required (min 10 characters)", 400, correlationId);
  }
  if (!body.ticketId || body.ticketId.trim().length < 1) {
    return apiError("VALIDATION_ERROR", "ticketId is required", 400, correlationId);
  }

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
    metadata: { previousStatus: job.status, reason: body.reason, ticketId: body.ticketId },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ id, status: "cancelled", message: "Job terminated by admin" });
}

// ── GET /admin/system-health ──────────────────────────────────────────────────

export async function handleAdminSystemHealth(_req: Request, env: Env): Promise<Response> {
  const [statusCounts, recentErrors, agentHealth, queueDepth] = await Promise.all([
    env.DB.prepare("SELECT status, COUNT(*) as cnt FROM jobs GROUP BY status").all<{ status: string; cnt: number }>(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'failed' AND updated_at >= datetime('now', '-24 hours')").first<{ cnt: number }>(),
    fetch(`${env.WORKER_CLUSTER_URL}/health`, {
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

// ── GET /admin/workers ────────────────────────────────────────────────────────

export async function handleAdminListWorkers(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const [workers, recentHeartbeats] = await Promise.all([
    env.DB.prepare(`
      SELECT * FROM worker_registry ORDER BY last_heartbeat DESC
    `).all<any>(),
    env.DB.prepare(`
      SELECT worker_id, COUNT(*) as heartbeat_count,
             AVG(cpu_pct) as avg_cpu,
             AVG(active_jobs) as avg_active_jobs
      FROM worker_heartbeats
      WHERE created_at >= datetime('now', '-1 hour')
      GROUP BY worker_id
    `).all<any>(),
  ]);

  const heartbeatMap = Object.fromEntries(
    recentHeartbeats.results.map(r => [r.worker_id, r]),
  );

  const enriched = workers.results.map(w => ({
    ...w,
    heartbeat_count_1h: heartbeatMap[w.id]?.heartbeat_count ?? 0,
    avg_cpu_1h: heartbeatMap[w.id]?.avg_cpu ?? null,
    avg_active_jobs_1h: heartbeatMap[w.id]?.avg_active_jobs ?? null,
    is_stale: !w.last_heartbeat || new Date(w.last_heartbeat) < new Date(Date.now() - 5 * 60 * 1000),
  }));

  return Response.json({ workers: enriched, total: workers.results.length });
}

// ── POST /admin/workers/:id/cordon ────────────────────────────────────────────

export async function handleAdminCordonWorker(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { id } = ctx.params;

  const worker = await env.DB.prepare("SELECT id FROM worker_registry WHERE id = ? LIMIT 1")
    .bind(id).first<{ id: string }>();
  if (!worker) return apiError("NOT_FOUND", "Worker not found", 404, correlationId);

  await env.DB.prepare(
    "UPDATE worker_registry SET status = 'cordoned', last_heartbeat = datetime('now') WHERE id = ?"
  ).bind(id).run();

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "worker.cordoned",
    targetType: "worker", targetId: id,
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ id, status: "cordoned", message: "Worker cordoned — no new jobs will be dispatched to it" });
}

// ── POST /admin/workers/:id/drain ─────────────────────────────────────────────

export async function handleAdminDrainWorker(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { id } = ctx.params;

  const worker = await env.DB.prepare("SELECT id FROM worker_registry WHERE id = ? LIMIT 1")
    .bind(id).first<{ id: string }>();
  if (!worker) return apiError("NOT_FOUND", "Worker not found", 404, correlationId);

  await env.DB.prepare(
    "UPDATE worker_registry SET status = 'draining', last_heartbeat = datetime('now') WHERE id = ?"
  ).bind(id).run();

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "worker.draining",
    targetType: "worker", targetId: id,
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ id, status: "draining", message: "Worker set to draining — existing jobs will finish before it goes offline" });
}

// ── POST /admin/workers/heartbeat (called by compute agents) ──────────────────

export async function handleWorkerHeartbeat(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();

  // Verify bearer token
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ") || authHeader.slice(7) !== env.WORKER_CLUSTER_TOKEN) {
    return apiError("AUTH_REQUIRED", "Invalid cluster token", 401, correlationId);
  }

  const body = await req.json().catch(() => null) as {
    workerId?: string; version?: string; region?: string;
    activeJobs?: number; maxJobs?: number;
    diskFreeGb?: number; diskTotalGb?: number;
    cpuPct?: number; memUsedMb?: number; bandwidthMbps?: number;
  } | null;

  if (!body?.workerId) return apiError("VALIDATION_ERROR", "workerId required", 400, correlationId);

  const {
    workerId, version, region,
    activeJobs = 0, maxJobs = 0,
    diskFreeGb, diskTotalGb, cpuPct, memUsedMb, bandwidthMbps,
  } = body;

  // Upsert into registry
  await env.DB.prepare(`
    INSERT INTO worker_registry (id, version, region, active_jobs, max_jobs, disk_free_gb, disk_total_gb, bandwidth_mbps, last_heartbeat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      version = excluded.version,
      region = excluded.region,
      active_jobs = excluded.active_jobs,
      max_jobs = excluded.max_jobs,
      disk_free_gb = excluded.disk_free_gb,
      disk_total_gb = excluded.disk_total_gb,
      bandwidth_mbps = excluded.bandwidth_mbps,
      last_heartbeat = excluded.last_heartbeat,
      status = CASE WHEN status = 'offline' THEN 'healthy' ELSE status END
  `).bind(workerId, version ?? null, region ?? null, activeJobs, maxJobs, diskFreeGb ?? null, diskTotalGb ?? null, bandwidthMbps ?? null).run();

  // Append to time-series heartbeats
  await env.DB.prepare(`
    INSERT INTO worker_heartbeats (worker_id, status, active_jobs, max_jobs, disk_free_gb, cpu_pct, mem_used_mb, bandwidth_mbps, version, region)
    VALUES (?, 'healthy', ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(workerId, activeJobs, maxJobs, diskFreeGb ?? null, cpuPct ?? null, memUsedMb ?? null, bandwidthMbps ?? null, version ?? null, region ?? null).run();

  return Response.json({ ok: true, workerId, ts: new Date().toISOString() });
}

// ── GET /admin/storage ────────────────────────────────────────────────────────

export async function handleAdminStorage(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  // R2 stats: total objects and bytes from D1 (files table is the source of truth)
  const [fileStats, orphanStats, jobStats, diskStats] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COUNT(*) as total_files,
        COALESCE(SUM(size_bytes), 0) as total_bytes,
        COUNT(CASE WHEN is_complete = 1 THEN 1 END) as complete_files,
        COALESCE(SUM(CASE WHEN is_complete = 1 THEN size_bytes ELSE 0 END), 0) as complete_bytes
      FROM files
    `).first<{ total_files: number; total_bytes: number; complete_files: number; complete_bytes: number }>(),

    // Orphaned files: job is completed/failed/cancelled but file is still listed
    env.DB.prepare(`
      SELECT COUNT(*) as orphan_count, COALESCE(SUM(f.size_bytes), 0) as orphan_bytes
      FROM files f
      JOIN jobs j ON j.id = f.job_id
      WHERE j.status IN ('failed', 'cancelled')
      AND f.created_at < datetime('now', '-24 hours')
    `).first<{ orphan_count: number; orphan_bytes: number }>(),

    env.DB.prepare(`
      SELECT
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status IN ('failed','cancelled') THEN 1 END) as terminal_jobs
      FROM jobs
    `).first<{ total_jobs: number; completed_jobs: number; terminal_jobs: number }>(),

    // Disk stats from latest worker heartbeat
    env.DB.prepare(`
      SELECT disk_free_gb, disk_total_gb, created_at
      FROM worker_heartbeats
      ORDER BY created_at DESC LIMIT 1
    `).first<{ disk_free_gb: number | null; disk_total_gb: number | null; created_at: string } | null>(),
  ]);

  // Latest storage snapshot
  const latestSnapshot = await env.DB.prepare(
    "SELECT * FROM storage_snapshots ORDER BY captured_at DESC LIMIT 1"
  ).first<any>().catch(() => null);

  return Response.json({
    files: fileStats ?? { total_files: 0, total_bytes: 0, complete_files: 0, complete_bytes: 0 },
    orphans: orphanStats ?? { orphan_count: 0, orphan_bytes: 0 },
    jobs: jobStats ?? { total_jobs: 0, completed_jobs: 0, terminal_jobs: 0 },
    disk: diskStats ?? null,
    latestSnapshot: latestSnapshot ?? null,
    ts: new Date().toISOString(),
  });
}

// ── POST /admin/storage/cleanup ───────────────────────────────────────────────

export async function handleAdminStorageCleanup(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const body = await req.json().catch(() => ({})) as { reason?: string; ticketId?: string; dryRun?: boolean };
  const dryRun = body.dryRun === true;

  // Mandatory reason + ticket for destructive (non-dryRun) cleanup
  if (!dryRun) {
    if (!body.reason || body.reason.trim().length < 10) {
      return apiError("VALIDATION_ERROR", "reason is required (min 10 characters)", 400, correlationId);
    }
    if (!body.ticketId || body.ticketId.trim().length < 1) {
      return apiError("VALIDATION_ERROR", "ticketId is required", 400, correlationId);
    }
  }

  // Find orphaned file records (jobs that are failed/cancelled, files older than 24h)
  const orphans = await env.DB.prepare(`
    SELECT f.id, f.r2_key, f.size_bytes, j.id as job_id
    FROM files f
    JOIN jobs j ON j.id = f.job_id
    WHERE j.status IN ('failed', 'cancelled')
    AND f.created_at < datetime('now', '-24 hours')
    LIMIT 200
  `).all<{ id: string; r2_key: string | null; size_bytes: number; job_id: string }>();

  if (dryRun) {
    return Response.json({
      dryRun: true,
      orphanFilesFound: orphans.results.length,
      orphanBytesFound: orphans.results.reduce((sum, f) => sum + f.size_bytes, 0),
      message: "Dry run — no files were deleted. Set dryRun: false to execute.",
    });
  }

  let deletedFromR2 = 0;
  let deletedFromD1 = 0;
  let bytesReclaimed = 0;

  for (const orphan of orphans.results) {
    // Delete from R2 if we have the key
    if (orphan.r2_key) {
      try {
        await env.FILES_BUCKET.delete(orphan.r2_key);
        deletedFromR2++;
      } catch { /* non-fatal — may already be gone */ }
    }

    // Delete from D1
    await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(orphan.id).run();
    deletedFromD1++;
    bytesReclaimed += orphan.size_bytes;
  }

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "storage.cleanup",
    targetType: "storage", targetId: "orphans",
    metadata: { deletedFromR2, deletedFromD1, bytesReclaimed, reason: body.reason },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({
    deletedFromR2, deletedFromD1, bytesReclaimed,
    message: `Cleaned up ${deletedFromD1} orphaned file records, reclaimed ${(bytesReclaimed / 1e9).toFixed(2)} GB`,
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

// ── GET /admin/dlq ────────────────────────────────────────────────────────────
// Lists failed jobs that are candidates for replay (stuck in failed status).

export async function handleAdminDlqList(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const offset = (page - 1) * limit;

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT j.id, j.name, j.status, j.error, j.user_id, j.infohash, j.magnet_uri,
             j.created_at, j.updated_at, j.completed_at, u.email as user_email,
             (SELECT COUNT(*) FROM job_events WHERE job_id = j.id) as event_count
      FROM jobs j
      LEFT JOIN users u ON u.id = j.user_id
      WHERE j.status = 'failed'
      ORDER BY j.updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'failed'").first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── POST /admin/dlq/:id/replay ────────────────────────────────────────────────
// Re-queues a failed job. Requires reason + ticketId for audit accountability.

export async function handleAdminDlqReplay(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { id } = ctx.params;
  const body = await req.json().catch(() => ({})) as { reason?: string; ticketId?: string };

  if (!body.reason || body.reason.trim().length < 10) {
    return apiError("VALIDATION_ERROR", "reason is required (min 10 characters)", 400, correlationId);
  }
  if (!body.ticketId || body.ticketId.trim().length < 1) {
    return apiError("VALIDATION_ERROR", "ticketId is required", 400, correlationId);
  }

  const job = await env.DB.prepare("SELECT * FROM jobs WHERE id = ? AND status = 'failed'")
    .bind(id).first<any>();
  if (!job) return apiError("NOT_FOUND", "Failed job not found", 404, correlationId);

  // Reset to submitted and re-enqueue
  await env.DB.prepare(
    "UPDATE jobs SET status = 'submitted', error = NULL, updated_at = datetime('now') WHERE id = ?",
  ).bind(id).run();

  await env.JOB_QUEUE.send({
    jobId: id,
    userId: job.user_id,
    type: job.magnet_uri ? "magnet" : "torrent",
    magnetUri: job.magnet_uri ?? undefined,
    correlationId,
    replayedBy: ctx.user!.id,
    replayReason: body.reason,
    replayTicket: body.ticketId,
  });

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "dlq.job_replayed",
    targetType: "job", targetId: id,
    metadata: { reason: body.reason, ticketId: body.ticketId, previousStatus: "failed" },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({
    id, status: "submitted",
    message: "Job re-queued for processing",
    reason: body.reason, ticketId: body.ticketId,
  });
}

// ── GET /admin/search ─────────────────────────────────────────────────────────
// Unified search across users, jobs, and audit_logs.

export async function handleAdminGlobalSearch(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return apiError("VALIDATION_ERROR", "q must be at least 2 characters", 400, correlationId);
  }

  const pattern = `%${q}%`;

  const [users, jobs, auditLogs] = await Promise.all([
    env.DB.prepare(`
      SELECT id, email, role, suspended, created_at FROM users
      WHERE email LIKE ? LIMIT 10
    `).bind(pattern).all<any>(),

    env.DB.prepare(`
      SELECT id, name, status, infohash, user_id, created_at FROM jobs
      WHERE name LIKE ? OR infohash LIKE ?
      ORDER BY created_at DESC LIMIT 10
    `).bind(pattern, pattern).all<any>(),

    env.DB.prepare(`
      SELECT a.id, a.action, a.actor_id, a.target_type, a.target_id, a.created_at,
             u.email as actor_email
      FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.action LIKE ? OR u.email LIKE ?
      ORDER BY a.created_at DESC LIMIT 10
    `).bind(pattern, pattern).all<any>(),
  ]);

  return Response.json({
    query: q,
    results: {
      users: users.results.map(u => ({ type: "user", ...u })),
      jobs: jobs.results.map(j => ({ type: "job", ...j })),
      auditLogs: auditLogs.results.map(a => ({ type: "audit_log", ...a })),
    },
    totals: {
      users: users.results.length,
      jobs: jobs.results.length,
      auditLogs: auditLogs.results.length,
    },
  });
}

// ── GET /admin/config-history ─────────────────────────────────────────────────
// Shows versioned history of all config_changes with diffs.

export async function handleAdminConfigHistory(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const offset = (page - 1) * limit;
  const key = url.searchParams.get("key") ?? "";

  const where = key ? "WHERE c.key = ?" : "";
  const bindings: (string | number)[] = key ? [key] : [];

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT c.id, c.key, c.old_value, c.new_value, c.reason, c.created_at,
             u.email as changed_by_email
      FROM config_changes c
      LEFT JOIN users u ON u.id = c.changed_by
      ${where}
      ORDER BY c.created_at DESC LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM config_changes ${where}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}
