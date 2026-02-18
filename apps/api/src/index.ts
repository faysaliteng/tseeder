/**
 * Cloudflare Workers API Gateway
 * Enterprise Remote Download Manager
 *
 * All endpoints are type-safe stubs. Replace TODO sections with real D1/R2/DO calls.
 */

import { Router } from "./router";
import { authMiddleware, rbacMiddleware, csrfMiddleware, rateLimitMiddleware } from "./middleware";
import { handleRegister, handleLogin, handleLogout, handleReset, handleVerifyEmail } from "./handlers/auth";
import { handleCreateJob, handleListJobs, handleGetJob, handleJobAction, handleJobCallback } from "./handlers/jobs";
import { handleGetFiles, handleSignedUrl, handleDeleteFile } from "./handlers/files";
import { handleGetUsage } from "./handlers/usage";
import {
  handleAdminListUsers, handleAdminUpdateUser,
  handleAdminListJobs, handleAdminTerminateJob,
  handleAdminSystemHealth, handleAdminBlocklist,
} from "./handlers/admin";
import { JobProgressDO, UserSessionDO } from "./durable-objects";

export { JobProgressDO, UserSessionDO };

export interface Env {
  // D1
  DB: D1Database;
  // R2
  FILES_BUCKET: R2Bucket;
  // Durable Objects
  JOB_PROGRESS_DO: DurableObjectNamespace;
  USER_SESSION_DO: DurableObjectNamespace;
  // Queues
  JOB_QUEUE: Queue;
  JOB_DLQ: Queue;
  // KV
  RATE_LIMIT_KV: KVNamespace;
  CSRF_KV: KVNamespace;
  // Secrets (injected at runtime)
  SESSION_SECRET: string;
  CSRF_SECRET: string;
  CALLBACK_SIGNING_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  WORKER_CLUSTER_URL: string;
  WORKER_CLUSTER_TOKEN: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  // Vars
  ENVIRONMENT: string;
  APP_DOMAIN: string;
  R2_BUCKET_NAME: string;
  MAX_UPLOAD_BYTES: string;
}

const router = new Router<Env>();

// ── Health ────────────────────────────────────────────────────────────────────
router.get("/health", async (_req, _env) => {
  return Response.json({ status: "ok", ts: new Date().toISOString() });
});

// ── Auth (public, rate-limited) ───────────────────────────────────────────────
router.post("/auth/register",     [rateLimitMiddleware("register", 5, 60)],  handleRegister);
router.post("/auth/login",        [rateLimitMiddleware("login", 10, 60)],    handleLogin);
router.post("/auth/logout",       [authMiddleware],                          handleLogout);
router.post("/auth/reset",        [rateLimitMiddleware("reset", 3, 3600)],   handleReset);
router.post("/auth/verify-email", [],                                        handleVerifyEmail);

// ── Jobs (authenticated) ──────────────────────────────────────────────────────
router.post("/jobs",              [authMiddleware, csrfMiddleware],              handleCreateJob);
router.get("/jobs",               [authMiddleware],                              handleListJobs);
router.get("/jobs/:id",           [authMiddleware],                              handleGetJob);
router.post("/jobs/:id/pause",    [authMiddleware, csrfMiddleware],              handleJobAction("pause"));
router.post("/jobs/:id/resume",   [authMiddleware, csrfMiddleware],              handleJobAction("resume"));
router.post("/jobs/:id/cancel",   [authMiddleware, csrfMiddleware],              handleJobAction("cancel"));

// Internal callback from compute agents (signed token, no user auth)
router.post("/jobs/callback",     [rateLimitMiddleware("callback", 200, 1)],    handleJobCallback);

// ── Files ─────────────────────────────────────────────────────────────────────
router.get("/jobs/:id/files",         [authMiddleware], handleGetFiles);
router.post("/files/:fileId/signed-url", [authMiddleware, csrfMiddleware], handleSignedUrl);
router.delete("/files/:fileId",       [authMiddleware, csrfMiddleware], handleDeleteFile);

// ── Usage ─────────────────────────────────────────────────────────────────────
router.get("/usage", [authMiddleware], handleGetUsage);

// ── Admin (RBAC: admin+) ──────────────────────────────────────────────────────
router.get("/admin/users",                [authMiddleware, rbacMiddleware("admin")], handleAdminListUsers);
router.patch("/admin/users/:id",          [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminUpdateUser);
router.get("/admin/jobs",                 [authMiddleware, rbacMiddleware("admin")], handleAdminListJobs);
router.post("/admin/jobs/:id/terminate",  [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminTerminateJob);
router.get("/admin/system-health",        [authMiddleware, rbacMiddleware("admin")], handleAdminSystemHealth);
router.post("/admin/blocklist",           [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminBlocklist);

// ── Durable Object SSE proxy ──────────────────────────────────────────────────
router.get("/do/job/:id/sse", [authMiddleware], async (req, env, ctx) => {
  const jobId = ctx.params.id;
  const id = env.JOB_PROGRESS_DO.idFromName(jobId);
  const stub = env.JOB_PROGRESS_DO.get(id);
  return stub.fetch(req);
});

// ── Fallback ──────────────────────────────────────────────────────────────────
router.all("*", async () => Response.json({ error: "Not Found", code: "NOT_FOUND" }, { status: 404 }));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const correlationId = crypto.randomUUID();
    const requestWithId = new Request(request, {
      headers: { ...Object.fromEntries(request.headers), "X-Correlation-ID": correlationId },
    });

    try {
      const response = await router.handle(requestWithId, env, ctx);
      response.headers.set("X-Correlation-ID", correlationId);
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("X-Frame-Options", "DENY");
      response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      return response;
    } catch (err) {
      console.error(JSON.stringify({ correlationId, error: String(err) }));
      return Response.json(
        { error: "Internal Server Error", code: "INTERNAL_ERROR", requestId: correlationId },
        { status: 500 },
      );
    }
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const { handleQueueBatch } = await import("./queue-consumer");
    await handleQueueBatch(batch, env);
  },
};
