import type { Env } from "../index";
import { CreateJobMagnetSchema, JobFilterSchema, CallbackProgressSchema, JobStatus } from "@rdm/shared";

// POST /jobs
export async function handleCreateJob(req: Request, env: Env, ctx: { params: Record<string, string>; user?: { id: string; role: string } }): Promise<Response> {
  const contentType = req.headers.get("Content-Type") ?? "";
  const userId = ctx.user!.id;
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();

  let jobInput: { type: "magnet"; magnetUri: string; name?: string } | { type: "torrent"; filename: string; bytes: ArrayBuffer };

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const parsed = CreateJobMagnetSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    jobInput = parsed.data;
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("torrent") as File | null;
    if (!file || !file.name.endsWith(".torrent")) {
      return Response.json({ error: "A .torrent file is required" }, { status: 400 });
    }
    if (file.size > parseInt(env.MAX_UPLOAD_BYTES)) {
      return Response.json({ error: "File too large" }, { status: 413 });
    }
    jobInput = { type: "torrent", filename: file.name, bytes: await file.arrayBuffer() };
  } else {
    return Response.json({ error: "Unsupported content type" }, { status: 415 });
  }

  // TODO: Check user plan quota (active job count, storage)
  // TODO: Extract infohash from magnet URI or parse .torrent
  // TODO: Check blocklist for infohash
  // TODO: Check deduplication (existing completed job with same infohash)

  const jobId = crypto.randomUUID();
  const idempotencyKey = `${userId}:${jobInput.type === "magnet" ? jobInput.magnetUri : jobInput.filename}`;

  // TODO: Insert job into D1
  // await env.DB.prepare(`INSERT INTO jobs (id, user_id, name, status, magnet_uri, idempotency_key) VALUES (?, ?, ?, ?, ?, ?)`)
  //   .bind(jobId, userId, jobInput.type === "magnet" ? jobInput.magnetUri : jobInput.filename, JobStatus.Submitted, jobInput.type === "magnet" ? jobInput.magnetUri : null, idempotencyKey)
  //   .run();

  // TODO: Initialise Durable Object for this job
  // const doId = env.JOB_PROGRESS_DO.idFromName(jobId);
  // const doStub = env.JOB_PROGRESS_DO.get(doId);
  // await doStub.fetch(new Request("http://do/init", { method: "POST", body: JSON.stringify({ jobId }) }));

  // TODO: Dispatch to Queue
  // await env.JOB_QUEUE.send({ jobId, userId, type: jobInput.type, correlationId });

  // TODO: Write audit log

  const mockJob = {
    id: jobId,
    userId,
    name: jobInput.type === "magnet" ? (jobInput as any).magnetUri?.slice(0, 60) : (jobInput as any).filename,
    status: JobStatus.Submitted,
    progressPct: 0,
    downloadSpeed: 0,
    eta: 0,
    peers: 0,
    seeds: 0,
    bytesDownloaded: 0,
    bytesTotal: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  };

  return Response.json(mockJob, { status: 201 });
}

// GET /jobs
export async function handleListJobs(req: Request, env: Env, ctx: { params: Record<string, string>; user?: { id: string; role: string } }): Promise<Response> {
  const url = new URL(req.url);
  const parsed = JobFilterSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "Invalid query params", issues: parsed.error.issues }, { status: 400 });
  }
  const userId = ctx.user!.id;

  // TODO: Query D1 with filters + pagination
  // const { status, page, limit, sortBy, sortDir } = parsed.data;
  // const offset = (page - 1) * limit;
  // const stmt = status
  //   ? env.DB.prepare(`SELECT * FROM jobs WHERE user_id = ? AND status = ? ORDER BY ${sortBy} ${sortDir} LIMIT ? OFFSET ?`).bind(userId, status, limit, offset)
  //   : env.DB.prepare(`SELECT * FROM jobs WHERE user_id = ? ORDER BY ${sortBy} ${sortDir} LIMIT ? OFFSET ?`).bind(userId, limit, offset);
  // const result = await stmt.all();

  return Response.json({
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
}

// GET /jobs/:id
export async function handleGetJob(req: Request, env: Env, ctx: { params: Record<string, string>; user?: { id: string; role: string } }): Promise<Response> {
  const { id } = ctx.params;
  const userId = ctx.user!.id;

  // TODO: Query D1 for job (ensure user_id matches or is admin)
  // const job = await env.DB.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?").bind(id, userId).first();
  // if (!job) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ id, status: "queued", progressPct: 0 });
}

// POST /jobs/:id/pause|resume|cancel
export function handleJobAction(action: "pause" | "resume" | "cancel") {
  return async (req: Request, env: Env, ctx: { params: Record<string, string>; user?: { id: string; role: string } }): Promise<Response> => {
    const { id } = ctx.params;
    const userId = ctx.user!.id;

    // TODO: Validate job ownership in D1
    // TODO: Update job status in D1
    // TODO: Call compute agent API to pause/resume/stop
    // TODO: Update Durable Object state

    const newStatus = action === "pause" ? JobStatus.Paused : action === "resume" ? JobStatus.Queued : JobStatus.Cancelled;

    return Response.json({ id, status: newStatus, message: `Job ${action}d` });
  };
}

// POST /jobs/callback — internal endpoint for compute agent progress reports
export async function handleJobCallback(req: Request, env: Env): Promise<Response> {
  // Validate signed token from compute agent
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  // TODO: Verify HMAC signature: HMAC-SHA256(body, CALLBACK_SIGNING_SECRET)
  // if (!await verifyCallbackSignature(req, env.CALLBACK_SIGNING_SECRET)) {
  //   return Response.json({ error: "Invalid callback signature" }, { status: 401 });
  // }

  const body = await req.json().catch(() => null);
  const parsed = CallbackProgressSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const update = parsed.data;

  // TODO: Check idempotency key in KV to avoid reprocessing
  // TODO: Update jobs table in D1 (status, progress, etc.)
  // TODO: Upsert files in D1 if files array present
  // TODO: Update Durable Object via internal fetch
  // const doId = env.JOB_PROGRESS_DO.idFromName(update.jobId);
  // const stub = env.JOB_PROGRESS_DO.get(doId);
  // await stub.fetch(new Request("http://do/update", { method: "POST", body: JSON.stringify(update) }));

  return Response.json({ ok: true });
}
