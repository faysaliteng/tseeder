/**
 * Organizations Handler
 *
 * Endpoints:
 *   GET    /orgs                         — list orgs current user belongs to
 *   POST   /orgs                         — create org
 *   GET    /orgs/:slug                   — org detail (plan, usage, members)
 *   PATCH  /orgs/:slug                   — update org name (owner/admin)
 *   GET    /orgs/:slug/members           — list members
 *   POST   /orgs/:slug/invites           — invite user by email
 *   DELETE /orgs/:slug/members/:userId   — remove member
 *   POST   /orgs/accept-invite/:token    — accept invite
 *
 * Admin:
 *   GET    /admin/orgs                   — list all orgs with stats
 */

import type { Env } from "../index";
import { apiError } from "./auth";

type Ctx = { params: Record<string, string>; user?: { id: string; role: string } };

// ── GET /orgs ─────────────────────────────────────────────────────────────────

export async function handleListOrgs(_req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const userId = ctx.user!.id;

  const rows = await env.DB.prepare(`
    SELECT o.id, o.name, o.slug, o.created_at, om.role,
           (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) as member_count
    FROM organizations o
    JOIN org_members om ON om.org_id = o.id AND om.user_id = ?
    ORDER BY o.created_at ASC
  `).bind(userId).all<any>();

  return Response.json({ orgs: rows.results });
}

// ── POST /orgs ────────────────────────────────────────────────────────────────

export async function handleCreateOrg(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const body = await req.json().catch(() => null) as { name?: string } | null;

  if (!body?.name || body.name.trim().length < 2) {
    return apiError("VALIDATION_ERROR", "name must be at least 2 characters", 400, correlationId);
  }

  const name = body.name.trim();
  // Generate a URL-safe slug from name + short random suffix
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

  const orgId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO organizations (id, name, slug, created_by) VALUES (?, ?, ?, ?)
    `).bind(orgId, name, slug, userId),
    env.DB.prepare(`
      INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, 'owner')
    `).bind(orgId, userId),
  ]);

  return Response.json({ org: { id: orgId, name, slug, role: "owner", member_count: 1 } }, { status: 201 });
}

// ── GET /orgs/:slug ───────────────────────────────────────────────────────────

export async function handleGetOrg(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const { slug } = ctx.params;

  const [org, membership] = await Promise.all([
    env.DB.prepare(`
      SELECT o.*, p.name as plan_name
      FROM organizations o
      LEFT JOIN plans p ON p.id = o.plan_id
      WHERE o.slug = ? LIMIT 1
    `).bind(slug).first<any>(),
    env.DB.prepare(`
      SELECT role FROM org_members WHERE org_id = (SELECT id FROM organizations WHERE slug = ?) AND user_id = ?
    `).bind(slug, userId).first<{ role: string }>(),
  ]);

  if (!org) return apiError("NOT_FOUND", "Organization not found", 404, correlationId);
  if (!membership) return apiError("FORBIDDEN", "You are not a member of this organization", 403, correlationId);

  const [members, usage] = await Promise.all([
    env.DB.prepare(`
      SELECT om.user_id, om.role, om.joined_at, u.email
      FROM org_members om JOIN users u ON u.id = om.user_id
      WHERE om.org_id = ?
      ORDER BY om.joined_at ASC
    `).bind(org.id).all<any>(),
    env.DB.prepare(`
      SELECT COALESCE(SUM(f.size_bytes), 0) as storage_bytes
      FROM files f
      JOIN jobs j ON j.id = f.job_id
      JOIN org_members om ON om.user_id = j.user_id AND om.org_id = ?
      WHERE f.is_complete = 1
    `).bind(org.id).first<{ storage_bytes: number }>(),
  ]);

  return Response.json({
    org: { ...org, role: membership.role },
    members: members.results,
    usage: { storageBytes: usage?.storage_bytes ?? 0 },
  });
}

// ── PATCH /orgs/:slug ─────────────────────────────────────────────────────────

export async function handleUpdateOrg(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const { slug } = ctx.params;

  const org = await env.DB.prepare("SELECT id FROM organizations WHERE slug = ? LIMIT 1").bind(slug).first<{ id: string }>();
  if (!org) return apiError("NOT_FOUND", "Organization not found", 404, correlationId);

  const membership = await env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?"
  ).bind(org.id, userId).first<{ role: string }>();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return apiError("FORBIDDEN", "Only org owners and admins can update organization details", 403, correlationId);
  }

  const body = await req.json().catch(() => null) as { name?: string } | null;
  if (!body?.name || body.name.trim().length < 2) {
    return apiError("VALIDATION_ERROR", "name must be at least 2 characters", 400, correlationId);
  }

  await env.DB.prepare(
    "UPDATE organizations SET name = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(body.name.trim(), org.id).run();

  return Response.json({ message: "Organization updated", slug });
}

// ── GET /orgs/:slug/members ───────────────────────────────────────────────────

export async function handleListOrgMembers(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const { slug } = ctx.params;

  const org = await env.DB.prepare("SELECT id FROM organizations WHERE slug = ? LIMIT 1").bind(slug).first<{ id: string }>();
  if (!org) return apiError("NOT_FOUND", "Organization not found", 404, correlationId);

  // Must be a member to list members
  const membership = await env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?"
  ).bind(org.id, userId).first<{ role: string }>();
  if (!membership) return apiError("FORBIDDEN", "Not a member of this organization", 403, correlationId);

  const members = await env.DB.prepare(`
    SELECT om.user_id, om.role, om.joined_at, u.email
    FROM org_members om JOIN users u ON u.id = om.user_id
    WHERE om.org_id = ?
    ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, om.joined_at ASC
  `).bind(org.id).all<any>();

  return Response.json({ members: members.results });
}

// ── POST /orgs/:slug/invites ──────────────────────────────────────────────────

export async function handleInviteOrgMember(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const { slug } = ctx.params;

  const org = await env.DB.prepare("SELECT id FROM organizations WHERE slug = ? LIMIT 1").bind(slug).first<{ id: string }>();
  if (!org) return apiError("NOT_FOUND", "Organization not found", 404, correlationId);

  const membership = await env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?"
  ).bind(org.id, userId).first<{ role: string }>();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return apiError("FORBIDDEN", "Only org owners and admins can invite members", 403, correlationId);
  }

  const body = await req.json().catch(() => null) as { email?: string; role?: string } | null;
  if (!body?.email || !body.email.includes("@")) {
    return apiError("VALIDATION_ERROR", "A valid email address is required", 400, correlationId);
  }

  const role = ["admin", "member"].includes(body.role ?? "") ? body.role! : "member";

  // Prevent duplicate active invites
  const existing = await env.DB.prepare(`
    SELECT id FROM org_invites
    WHERE org_id = ? AND email = ? AND accepted_at IS NULL AND expires_at > datetime('now')
  `).bind(org.id, body.email.trim()).first();
  if (existing) {
    return apiError("CONFLICT", "An active invite already exists for this email", 409, correlationId);
  }

  const token = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO org_invites (org_id, email, role, token, invited_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(org.id, body.email.trim().toLowerCase(), role, token, userId).run();

  // In production, you would send an invite email here.
  // The invite link would be: /app/org/accept-invite?token=<token>
  return Response.json({
    message: "Invite created",
    token, // returned so admin can manually share if email isn't configured
    email: body.email.trim().toLowerCase(),
    role,
    expiresIn: "7 days",
  }, { status: 201 });
}

// ── DELETE /orgs/:slug/members/:userId ────────────────────────────────────────

export async function handleRemoveOrgMember(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const actorId = ctx.user!.id;
  const { slug, userId: targetId } = ctx.params;

  const org = await env.DB.prepare("SELECT id FROM organizations WHERE slug = ? LIMIT 1").bind(slug).first<{ id: string }>();
  if (!org) return apiError("NOT_FOUND", "Organization not found", 404, correlationId);

  const [actorMembership, targetMembership] = await Promise.all([
    env.DB.prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?").bind(org.id, actorId).first<{ role: string }>(),
    env.DB.prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?").bind(org.id, targetId).first<{ role: string }>(),
  ]);

  if (!actorMembership || !["owner", "admin"].includes(actorMembership.role)) {
    return apiError("FORBIDDEN", "Only org owners and admins can remove members", 403, correlationId);
  }
  if (!targetMembership) return apiError("NOT_FOUND", "Member not found in this organization", 404, correlationId);
  if (targetMembership.role === "owner" && actorId !== targetId) {
    return apiError("FORBIDDEN", "Cannot remove the org owner", 403, correlationId);
  }

  await env.DB.prepare("DELETE FROM org_members WHERE org_id = ? AND user_id = ?").bind(org.id, targetId).run();

  return Response.json({ message: "Member removed", userId: targetId });
}

// ── POST /orgs/accept-invite/:token ──────────────────────────────────────────

export async function handleAcceptOrgInvite(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const { token } = ctx.params;

  const invite = await env.DB.prepare(`
    SELECT i.*, o.slug as org_slug
    FROM org_invites i
    JOIN organizations o ON o.id = i.org_id
    WHERE i.token = ?
      AND i.accepted_at IS NULL
      AND i.expires_at > datetime('now')
    LIMIT 1
  `).bind(token).first<any>();

  if (!invite) {
    return apiError("NOT_FOUND", "Invite not found, already accepted, or expired", 404, correlationId);
  }

  // Verify email matches logged-in user (basic check; skip if email unverified)
  const user = await env.DB.prepare("SELECT email FROM users WHERE id = ? LIMIT 1").bind(userId).first<{ email: string }>();
  if (user && user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return apiError("FORBIDDEN", "This invite was sent to a different email address", 403, correlationId);
  }

  await env.DB.batch([
    env.DB.prepare(`
      INSERT OR IGNORE INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)
    `).bind(invite.org_id, userId, invite.role),
    env.DB.prepare(`
      UPDATE org_invites SET accepted_at = datetime('now') WHERE token = ?
    `).bind(token),
  ]);

  return Response.json({ message: "Joined organization", slug: invite.org_slug, role: invite.role });
}

// ── DELETE /orgs/:slug ────────────────────────────────────────────────────────

export async function handleDeleteOrg(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const { slug } = ctx.params;

  const org = await env.DB.prepare("SELECT id FROM organizations WHERE slug = ? LIMIT 1").bind(slug).first<{ id: string }>();
  if (!org) return apiError("NOT_FOUND", "Organization not found", 404, correlationId);

  const membership = await env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?"
  ).bind(org.id, userId).first<{ role: string }>();

  if (!membership || membership.role !== "owner") {
    return apiError("FORBIDDEN", "Only the org owner can delete an organization", 403, correlationId);
  }

  // Cascade delete: org_members + org_invites handled by FK ON DELETE CASCADE
  await env.DB.prepare("DELETE FROM organizations WHERE id = ?").bind(org.id).run();

  return Response.json({ message: "Organization deleted", slug });
}

// ── GET /admin/orgs ───────────────────────────────────────────────────────────

export async function handleAdminListOrgs(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = 50;
  const offset = (page - 1) * limit;

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT o.*,
             (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) as member_count,
             (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f JOIN jobs j ON j.id = f.job_id
              JOIN org_members om ON om.user_id = j.user_id AND om.org_id = o.id
              WHERE f.is_complete = 1) as storage_bytes,
             p.name as plan_name
      FROM organizations o
      LEFT JOIN plans p ON p.id = o.plan_id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all<any>(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM organizations").first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── GET /admin/observability ──────────────────────────────────────────────────

export async function handleAdminObservability(_req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const [
    latencyRows,
    errorRateRows,
    queueTrend,
    workerFleet,
    dlqCurrent,
    dlq24hAgo,
  ] = await Promise.all([
    // API latency: last 24 hours, hourly buckets
    env.DB.prepare(`
      SELECT hour_bucket,
             SUM(count) as total_requests,
             SUM(total_ms) as total_ms,
             MAX(p95_ms) as p95_ms
      FROM api_metrics
      WHERE hour_bucket >= strftime('%Y-%m-%dT%H:00', datetime('now', '-24 hours'))
      GROUP BY hour_bucket
      ORDER BY hour_bucket ASC
    `).all<any>(),

    // Error rates: 4xx and 5xx last 24 hours
    env.DB.prepare(`
      SELECT hour_bucket, status_class,
             SUM(count) as count
      FROM api_metrics
      WHERE hour_bucket >= strftime('%Y-%m-%dT%H:00', datetime('now', '-24 hours'))
        AND status_class IN ('4xx', '5xx')
      GROUP BY hour_bucket, status_class
      ORDER BY hour_bucket ASC
    `).all<any>(),

    // Queue depth trend (last 24h snapshots)
    env.DB.prepare(`
      SELECT captured_at, queue_depth, dlq_depth
      FROM queue_depth_snapshots
      WHERE captured_at >= datetime('now', '-24 hours')
      ORDER BY captured_at ASC
    `).all<any>(),

    // Worker fleet
    env.DB.prepare(`
      SELECT id, status, region, active_jobs, max_jobs, last_heartbeat,
             (last_heartbeat < datetime('now', '-5 minutes')) as is_stale
      FROM worker_registry
      ORDER BY last_heartbeat DESC
    `).all<any>(),

    // DLQ current depth
    env.DB.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'failed'").first<{ cnt: number }>(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'failed' AND updated_at < datetime('now', '-24 hours')").first<{ cnt: number }>(),
  ]);

  // Compute aggregate latency
  const latencyBuckets = latencyRows.results.map((r: any) => ({
    bucket: r.hour_bucket,
    p50: r.total_requests > 0 ? Math.round(r.total_ms / r.total_requests) : 0,
    p95: r.p95_ms ?? 0,
    requests: r.total_requests,
  }));

  const allRequests = latencyRows.results.reduce((a: number, r: any) => a + (r.total_requests || 0), 0);
  const allMs = latencyRows.results.reduce((a: number, r: any) => a + (r.total_ms || 0), 0);
  const globalP50 = allRequests > 0 ? Math.round(allMs / allRequests) : 0;
  const globalP95 = latencyRows.results.reduce((a: number, r: any) => Math.max(a, r.p95_ms ?? 0), 0);

  // Worker fleet summary
  const fleet = workerFleet.results as any[];
  const healthyWorkers = fleet.filter(w => w.status === "healthy" && !w.is_stale).length;
  const staleWorkers = fleet.filter(w => w.is_stale).length;
  const totalCapacity = fleet.reduce((s, w) => s + (w.max_jobs ?? 0), 0);
  const usedCapacity = fleet.reduce((s, w) => s + (w.active_jobs ?? 0), 0);

  const dlqChange = (dlqCurrent?.cnt ?? 0) - (dlq24hAgo?.cnt ?? 0);

  return Response.json({
    apiLatency: {
      p50: globalP50,
      p95: globalP95,
      trend: latencyBuckets,
    },
    errorRates: {
      trend: errorRateRows.results,
    },
    queueDepth: {
      current: queueTrend.results.length > 0
        ? (queueTrend.results[queueTrend.results.length - 1] as any).queue_depth
        : 0,
      trend: queueTrend.results,
    },
    workerFleet: {
      total: fleet.length,
      healthy: healthyWorkers,
      stale: staleWorkers,
      totalCapacity,
      usedCapacity,
      workers: fleet,
    },
    dlqGrowth: {
      current: dlqCurrent?.cnt ?? 0,
      change24h: dlqChange,
    },
  });
}

// ── GET /status/history (public) ──────────────────────────────────────────────

export async function handleUptimeHistory(req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") ?? "90")));

  const rows = await env.DB.prepare(`
    SELECT date, component, is_operational, incident_note
    FROM uptime_snapshots
    WHERE date >= date('now', '-' || ? || ' days')
    ORDER BY date ASC
  `).bind(days).all<any>();

  // Group by component
  const components: Record<string, any[]> = {};
  for (const row of rows.results) {
    if (!components[row.component]) components[row.component] = [];
    components[row.component].push({
      date: row.date,
      operational: row.is_operational === 1,
      note: row.incident_note ?? null,
    });
  }

  // Compute uptime percentages
  const uptimePct: Record<string, Record<string, number>> = {};
  const windows = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };

  for (const [comp, snaps] of Object.entries(components)) {
    uptimePct[comp] = {};
    for (const [label, windowDays] of Object.entries(windows)) {
      const cutoff = new Date(Date.now() - windowDays * 86400_000).toISOString().slice(0, 10);
      const inWindow = snaps.filter(s => s.date >= cutoff);
      if (inWindow.length === 0) {
        uptimePct[comp][label] = 100; // no data = assume up
      } else {
        const upCount = inWindow.filter(s => s.operational).length;
        uptimePct[comp][label] = parseFloat(((upCount / inWindow.length) * 100).toFixed(2));
      }
    }
  }

  return Response.json({
    components,
    uptimePct,
    days,
    generatedAt: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "public, max-age=300", // 5 min cache — public endpoint
    },
  });
}
