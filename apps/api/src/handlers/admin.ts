import type { Env } from "../index";
import { getUserPlan, getUserUsage, writeAuditLog } from "../d1-helpers";
import { apiError } from "./auth";
import { UpdateUserSchema, BlocklistAddSchema } from "@rdm/shared";
import { formatZodError } from "./auth";

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

export async function handleGetPlans(req: Request, env: Env): Promise<Response> {
  const result = await env.DB.prepare("SELECT * FROM plans ORDER BY price_cents ASC").all();
  return Response.json({ plans: result.results });
}

// ── GET /admin/users ──────────────────────────────────────────────────────────

export async function handleAdminListUsers(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;
  const search = url.searchParams.get("q") ?? "";

  const whereClause = search ? "WHERE email LIKE ?" : "";
  const bindings = search ? [`%${search}%`, limit, offset] : [limit, offset];

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT u.id, u.email, u.role, u.email_verified, u.suspended, u.created_at,
             p.name as plan_name
      FROM users u
      LEFT JOIN user_plan_assignments upa ON upa.user_id = u.id
      LEFT JOIN plans p ON p.id = upa.plan_id
      ${whereClause}
      ORDER BY u.created_at DESC LIMIT ? OFFSET ?
    `).bind(...bindings).all(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM users ${whereClause}`)
      .bind(...(search ? [`%${search}%`] : [])).first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── PATCH /admin/users/:userId ────────────────────────────────────────────────

export async function handleAdminUpdateUser(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const body = await req.json().catch(() => null);
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);

  const { id } = ctx.params;
  const { role, suspended } = parsed.data;

  if (role !== undefined) {
    await env.DB.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(role, id).run();
  }
  if (suspended !== undefined) {
    await env.DB.prepare("UPDATE users SET suspended = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(suspended ? 1 : 0, id).run();
  }

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: suspended ? "user.suspended" : "user.updated",
    targetType: "user", targetId: id,
    metadata: parsed.data, ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ id, ...parsed.data, message: "User updated" });
}

// ── GET /admin/jobs ───────────────────────────────────────────────────────────

export async function handleAdminListJobs(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const offset = (page - 1) * limit;
  const status = url.searchParams.get("status");

  const whereClause = status ? "WHERE j.status = ?" : "";
  const bindings = status ? [status, limit, offset] : [limit, offset];

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT j.*, u.email as user_email FROM jobs j
      JOIN users u ON u.id = j.user_id
      ${whereClause}
      ORDER BY j.created_at DESC LIMIT ? OFFSET ?
    `).bind(...bindings).all(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM jobs j ${whereClause}`)
      .bind(...(status ? [status] : [])).first<{ cnt: number }>(),
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

  const job = await env.DB.prepare("SELECT * FROM jobs WHERE id = ?")
    .bind(id).first<import("../d1-helpers").JobRow>();
  if (!job) return apiError("NOT_FOUND", "Job not found", 404, correlationId);

  await env.DB.prepare("UPDATE jobs SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?")
    .bind(id).run();

  // Notify agent
  if (job.worker_id) {
    try {
      await fetch(`${env.WORKER_CLUSTER_URL}/agent/jobs/${id}/stop`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
        signal: AbortSignal.timeout(5000),
      });
    } catch { /* non-fatal */ }
  }

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "job.terminated",
    targetType: "job", targetId: id,
    metadata: { previousStatus: job.status },
  });

  return Response.json({ id, status: "cancelled", message: "Job terminated by admin" });
}

// ── GET /admin/system-health ──────────────────────────────────────────────────

export async function handleAdminSystemHealth(req: Request, env: Env): Promise<Response> {
  const [statusCounts, recentErrors, agentHealth] = await Promise.all([
    env.DB.prepare("SELECT status, COUNT(*) as cnt FROM jobs GROUP BY status").all<{ status: string; cnt: number }>(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'failed' AND updated_at >= datetime('now', '-24 hours')").first<{ cnt: number }>(),
    fetch(`${env.WORKER_CLUSTER_URL}/agent/health`, {
      headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    }).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const byStatus = Object.fromEntries(statusCounts.results.map(r => [r.status, r.cnt]));

  return Response.json({
    jobs: byStatus,
    failedLast24h: recentErrors?.cnt ?? 0,
    agent: agentHealth,
    status: agentHealth ? "healthy" : "agent_unreachable",
    ts: new Date().toISOString(),
  });
}

// ── GET /admin/audit ──────────────────────────────────────────────────────────

export async function handleAdminAudit(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const offset = (page - 1) * limit;

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT a.*, u.email as actor_email FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM audit_logs").first<{ cnt: number }>(),
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

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "blocklist.added",
    targetType: "infohash", targetId: infohash,
    metadata: { reason },
  });

  return Response.json({ message: "Infohash added to blocklist", infohash });
}
