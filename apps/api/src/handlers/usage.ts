import type { Env } from "../index";

// GET /usage
export async function handleGetUsage(
  req: Request,
  env: Env,
  ctx: { params: Record<string, string>; user?: { id: string; role: string } },
): Promise<Response> {
  const userId = ctx.user!.id;

  // TODO: Query D1 for current plan assignment + daily usage
  // const plan = await env.DB.prepare(`
  //   SELECT p.* FROM plans p
  //   JOIN user_plan_assignments upa ON upa.plan_id = p.id
  //   WHERE upa.user_id = ? AND (upa.expires_at IS NULL OR upa.expires_at > datetime('now'))
  //   ORDER BY upa.started_at DESC LIMIT 1
  // `).bind(userId).first();
  //
  // const usage = await env.DB.prepare(`
  //   SELECT SUM(bytes_downloaded) as totalBytesDownloaded, SUM(bytes_uploaded) as totalBytesUploaded
  //   FROM usage_metrics_daily
  //   WHERE user_id = ? AND date >= date('now', '-30 days')
  // `).bind(userId).first();
  //
  // const activeJobs = await env.DB.prepare(
  //   "SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status IN ('submitted','metadata_fetch','queued','downloading','uploading')"
  // ).bind(userId).first();
  //
  // const storageUsed = await env.DB.prepare(
  //   "SELECT SUM(f.size_bytes) as total FROM files f JOIN jobs j ON j.id = f.job_id WHERE j.user_id = ? AND f.is_complete = 1"
  // ).bind(userId).first();

  return Response.json({
    plan: { name: "pro", maxJobs: 10, maxStorageGb: 50, bandwidthGb: 500, retentionDays: 30 },
    storageUsedBytes: 0,
    bandwidthUsedBytes: 0,
    activeJobs: 0,
    totalJobs: 0,
  });
}
