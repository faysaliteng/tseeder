import type { Env } from "../index";
import { CreateJobMagnetSchema, JobFilterSchema, CallbackProgressSchema } from "@rdm/shared";
import {
  createJob, getJobById, getJobByIdForUser, listJobsForUser,
  updateJobStatus, getExistingCompletedJob, appendJobEvent,
  upsertFiles, checkQuota, isInfohashBlocked, writeAuditLog,
} from "../d1-helpers";
import { apiError, formatZodError } from "./auth";
import { verifyCallbackSignature } from "../crypto";

type Ctx = { params: Record<string, string>; user?: { id: string; role: string } };

// ── Magnet URI helpers ────────────────────────────────────────────────────────

function extractInfohash(magnetUri: string): string | null {
  const match = magnetUri.match(/xt=urn:btih:([a-f0-9]{40})/i);
  return match ? match[1].toLowerCase() : null;
}

function extractMagnetName(magnetUri: string): string {
  const dn = magnetUri.match(/[&?]dn=([^&]+)/);
  return dn ? decodeURIComponent(dn[1].replace(/\+/g, " ")) : "Unnamed torrent";
}

// ── POST /jobs ────────────────────────────────────────────────────────────────

export async function handleCreateJob(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;

  // Quota check
  const quotaResult = await checkQuota(env.DB, userId);
  if (!quotaResult.allowed) {
    return apiError(quotaResult.reason ?? "QUOTA_JOBS", "Plan quota exceeded", 429, correlationId);
  }

  let magnetUri: string | null = null;
  let jobName: string = "New download";
  let infohash: string | null = null;

  const contentType = req.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const parsed = CreateJobMagnetSchema.safeParse(body);
    if (!parsed.success) return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);
    magnetUri = parsed.data.magnetUri;
    jobName = parsed.data.name ?? extractMagnetName(magnetUri);
    infohash = extractInfohash(magnetUri);
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData().catch(() => null);
    if (!formData) return apiError("VALIDATION_ERROR", "Invalid form data", 400, correlationId);
    const file = formData.get("torrent") as File | null;
    if (!file || !file.name.endsWith(".torrent")) {
      return apiError("VALIDATION_ERROR", "A .torrent file is required", 400, correlationId);
    }
    const maxBytes = parseInt(env.MAX_UPLOAD_BYTES ?? "5368709120");
    if (file.size > maxBytes) {
      return apiError("VALIDATION_ERROR", `File exceeds maximum size of ${maxBytes} bytes`, 413, correlationId);
    }
    jobName = file.name.replace(/\.torrent$/, "");
    // torrent file bytes are forwarded to the queue message for the agent
  } else {
    return apiError("VALIDATION_ERROR", "Content-Type must be application/json or multipart/form-data", 415, correlationId);
  }

  // Blocklist check
  if (infohash && await isInfohashBlocked(env.DB, infohash)) {
    return apiError("BLOCKED", "This content has been blocked by the platform abuse policy", 403, correlationId);
  }

  // Deduplication: return existing completed job if infohash matches
  if (infohash) {
    const existing = await getExistingCompletedJob(env.DB, infohash, userId);
    if (existing) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", correlationId, msg: "Dedup hit", jobId: existing.id }));
      return Response.json(jobRowToApi(existing), { status: 200, headers: { "X-Deduplicated": "true" } });
    }
  }

  const jobId = crypto.randomUUID();
  const idempotencyKey = `${userId}:${infohash ?? jobName}`;

  // Insert with idempotency — handle UNIQUE constraint
  try {
    await createJob(env.DB, { id: jobId, userId, name: jobName, magnetUri, infohash, idempotencyKey });
  } catch (e: unknown) {
    const msg = String((e as Error).message ?? "");
    if (msg.includes("UNIQUE")) {
      // Idempotent: return existing job
      const existingRow = await env.DB.prepare("SELECT * FROM jobs WHERE idempotency_key = ?")
        .bind(idempotencyKey).first<import("../d1-helpers").JobRow>();
      if (existingRow) return Response.json(jobRowToApi(existingRow), { status: 200 });
    }
    throw e;
  }

  // Initialise Durable Object for this job
  const doId = env.JOB_PROGRESS_DO.idFromName(jobId);
  const doStub = env.JOB_PROGRESS_DO.get(doId);
  await doStub.fetch(new Request("http://do/init", {
    method: "POST",
    body: JSON.stringify({ jobId }),
    headers: { "Content-Type": "application/json" },
  }));

  // Dispatch to Queue
  await env.JOB_QUEUE.send({
    jobId, userId, type: magnetUri ? "magnet" : "torrent",
    magnetUri: magnetUri ?? undefined,
    correlationId, attempt: 1,
  });

  await appendJobEvent(env.DB, {
    jobId, eventType: "job_created",
    payload: { userId, name: jobName, infohash, type: magnetUri ? "magnet" : "torrent" },
    correlationId,
  });

  await writeAuditLog(env.DB, {
    actorId: userId, action: "job.created", targetType: "job", targetId: jobId,
    metadata: { name: jobName, infohash }, ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "info", correlationId,
    service: "workers-api", handler: "POST /jobs", userId, jobId, msg: "Job created",
  }));

  return Response.json(jobRowToApi({
    id: jobId, user_id: userId, infohash, name: jobName,
    status: "submitted", magnet_uri: magnetUri, worker_id: null,
    idempotency_key: idempotencyKey, error: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null,
  }), { status: 201 });
}

// ── GET /jobs ─────────────────────────────────────────────────────────────────

export async function handleListJobs(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const url = new URL(req.url);
  const parsed = JobFilterSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);

  const { status, page, limit, sortBy, sortDir } = parsed.data;
  const userId = ctx.user!.id;

  const { rows, total } = await listJobsForUser(env.DB, {
    userId, status, page, limit,
    sortBy: `j.${sortBy}`, sortDir,
  });

  return Response.json({
    data: rows.map(jobRowToApi),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ── GET /jobs/:id ─────────────────────────────────────────────────────────────

export async function handleGetJob(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { id } = ctx.params;
  const userId = ctx.user!.id;

  const job = await getJobByIdForUser(env.DB, id, userId);
  if (!job) return apiError("NOT_FOUND", "Job not found", 404, correlationId);

  return Response.json(jobRowToApi(job));
}

// ── POST /jobs/:id/pause|resume|cancel ────────────────────────────────────────

export function handleJobAction(action: "pause" | "resume" | "cancel") {
  return async (req: Request, env: Env, ctx: Ctx): Promise<Response> => {
    const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
    const { id } = ctx.params;
    const userId = ctx.user!.id;

    const job = await getJobByIdForUser(env.DB, id, userId);
    if (!job) return apiError("NOT_FOUND", "Job not found", 404, correlationId);

    const terminalStates = ["completed", "failed", "cancelled"];
    if (terminalStates.includes(job.status)) {
      return apiError("VALIDATION_ERROR", `Cannot ${action} a job in state '${job.status}'`, 409, correlationId);
    }

    const newStatus = action === "pause" ? "paused" : action === "resume" ? "queued" : "cancelled";
    await updateJobStatus(env.DB, { id, status: newStatus });

    // Update Durable Object
    const doId = env.JOB_PROGRESS_DO.idFromName(id);
    const doStub = env.JOB_PROGRESS_DO.get(doId);
    await doStub.fetch(new Request("http://do/update", {
      method: "POST",
      body: JSON.stringify({ status: newStatus }),
      headers: { "Content-Type": "application/json" },
    }));

    // Notify compute agent (best-effort)
    if (action === "cancel" && job.worker_id) {
      try {
        await fetch(`${env.WORKER_CLUSTER_URL}/agent/jobs/${id}/stop`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
          signal: AbortSignal.timeout(5000),
        });
      } catch { /* non-fatal */ }
    }

    await appendJobEvent(env.DB, {
      jobId: id, eventType: `job_${action}d`, payload: { previousStatus: job.status }, correlationId,
    });

    return Response.json({ id, status: newStatus, message: `Job ${action}d` });
  };
}

// ── POST /jobs/callback ────────────────────────────────────────────────────────

export async function handleJobCallback(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const bodyText = await req.text();

  // Verify HMAC signature + timestamp
  const sigOk = await verifyCallbackSignature(req, bodyText, env.CALLBACK_SIGNING_SECRET);
  if (!sigOk) {
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", correlationId, msg: "Invalid callback signature" }));
    return apiError("AUTH_INVALID", "Invalid callback signature", 401, correlationId);
  }

  let body: unknown;
  try { body = JSON.parse(bodyText); } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON", 400, correlationId);
  }

  const parsed = CallbackProgressSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);

  const update = parsed.data;
  const job = await getJobById(env.DB, update.jobId);
  if (!job) return apiError("NOT_FOUND", "Job not found", 404, correlationId);

  // Update D1 job row
  await updateJobStatus(env.DB, {
    id: update.jobId, status: update.status,
    workerId: update.workerId,
    error: update.error,
    completedAt: update.status === "completed" ? new Date().toISOString() : undefined,
  });

  // Upsert files if provided
  if (update.files && update.files.length > 0) {
    await upsertFiles(env.DB, update.jobId, update.files.map(f => ({
      path: f.path, sizeBytes: f.sizeBytes, mimeType: f.mimeType,
      r2Key: f.r2Key, isComplete: f.isComplete,
    })));
  }

  // Append job event
  await appendJobEvent(env.DB, {
    jobId: update.jobId, eventType: update.eventType,
    payload: {
      progressPct: update.progressPct, downloadSpeed: update.downloadSpeed,
      eta: update.eta, peers: update.peers, bytesDownloaded: update.bytesDownloaded,
      status: update.status,
    },
    correlationId,
  });

  // Update Durable Object (fanout to SSE clients)
  const doId = env.JOB_PROGRESS_DO.idFromName(update.jobId);
  const doStub = env.JOB_PROGRESS_DO.get(doId);
  await doStub.fetch(new Request("http://do/update", {
    method: "POST",
    body: JSON.stringify(update),
    headers: { "Content-Type": "application/json" },
  }));

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "info", correlationId,
    service: "workers-api", handler: "POST /jobs/callback",
    jobId: update.jobId, status: update.status, progressPct: update.progressPct,
    msg: "Callback processed",
  }));

  return Response.json({ ok: true });
}

// ── Row → API shape ───────────────────────────────────────────────────────────

function jobRowToApi(row: import("../d1-helpers").JobRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status: row.status,
    infohash: row.infohash,
    magnetUri: row.magnet_uri,
    workerId: row.worker_id,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    // Progress fields come from Durable Object, not D1
    progressPct: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    eta: 0,
    peers: 0,
    seeds: 0,
    bytesDownloaded: 0,
    bytesTotal: 0,
  };
}
