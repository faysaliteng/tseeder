import type { Env } from "../index";
import { UpdateUserSchema, BlocklistAddSchema } from "@rdm/shared";

// GET /admin/users
export async function handleAdminListUsers(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = (page - 1) * limit;

  // TODO: Query D1
  // const result = await env.DB.prepare("SELECT id, email, role, email_verified, suspended, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();

  return Response.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 } });
}

// PATCH /admin/users/:id
export async function handleAdminUpdateUser(
  req: Request, env: Env, ctx: { params: Record<string, string>; user?: { id: string; role: string } },
): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const { id } = ctx.params;
  // TODO: Update user in D1
  // TODO: Write audit log

  return Response.json({ id, ...parsed.data, message: "User updated" });
}

// GET /admin/jobs
export async function handleAdminListJobs(req: Request, env: Env): Promise<Response> {
  // TODO: Query all jobs from D1 (no user_id filter)
  return Response.json({ data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } });
}

// POST /admin/jobs/:id/terminate
export async function handleAdminTerminateJob(
  req: Request, env: Env, ctx: { params: Record<string, string>; user?: { id: string; role: string } },
): Promise<Response> {
  const { id } = ctx.params;
  // TODO: Set job status to cancelled in D1
  // TODO: Call compute agent /stop
  // TODO: Write audit log
  return Response.json({ id, status: "cancelled", message: "Job terminated by admin" });
}

// GET /admin/system-health
export async function handleAdminSystemHealth(req: Request, env: Env): Promise<Response> {
  // TODO: Aggregate real metrics
  return Response.json({
    queueDepth: 0,
    dlqDepth: 0,
    activeWorkers: 0,
    workerCapacityPct: 0,
    jobsLast24h: { total: 0, completed: 0, failed: 0 },
    apiErrorRate5xx: 0,
    r2UploadErrorRate: 0,
    status: "healthy",
  });
}

// POST /admin/blocklist
export async function handleAdminBlocklist(
  req: Request, env: Env, ctx: { params: Record<string, string>; user?: { id: string; role: string } },
): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = BlocklistAddSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  // TODO: Insert into blocklist table in D1
  // TODO: Write audit log

  return Response.json({ message: "Infohash added to blocklist", infohash: parsed.data.infohash });
}
