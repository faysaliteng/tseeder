/**
 * Cloudflare Workers API Gateway
 * Enterprise Remote Download Manager
 */

import { Router } from "./router";
import { authMiddleware, rbacMiddleware, csrfMiddleware, rateLimitMiddleware } from "./middleware";
import {
  handleRegister, handleLogin, handleLogout, handleReset, handleResetConfirm,
  handleVerifyEmail, handleListApiKeys, handleCreateApiKey, handleRevokeApiKey,
} from "./handlers/auth";
import { handleCreateJob, handleListJobs, handleGetJob, handleJobAction, handleJobCallback } from "./handlers/jobs";
import { handleGetFiles, handleSignedUrl, handleDeleteFile } from "./handlers/files";
import { handleGetUsage, handleGetPlans } from "./handlers/admin";
import {
  handleAdminListUsers, handleAdminGetUser, handleAdminUpdateUser, handleAdminForceLogout,
  handleAdminListJobs, handleAdminTerminateJob,
  handleAdminSystemHealth,
  handleAdminAudit,
  handleAdminBlocklist, handleAdminListBlocklist,
  handleAdminSecurityEvents,
  handleAdminListFlags, handleAdminUpdateFlag,
  handleAdminListWorkers, handleAdminCordonWorker, handleAdminDrainWorker, handleWorkerHeartbeat,
  handleAdminStorage, handleAdminStorageCleanup,
} from "./handlers/admin";
import {
  handleListProviders, handleGetActiveProvider, handleSwitchProvider,
  handleVerifyProvider, handleProviderHealth, handleProviderHistory,
} from "./handlers/providers";
import {
  handleListArticles, handleGetArticle,
  handleAdminListArticles, handleAdminGetArticle, handleAdminCreateArticle, handleAdminUpdateArticle,
  handleAdminDeleteArticle, handleAdminTogglePublish,
} from "./handlers/articles";
import { JobProgressDO, UserSessionDO } from "./durable-objects";

export { JobProgressDO, UserSessionDO };

export interface Env {
  DB: D1Database;
  FILES_BUCKET: R2Bucket;
  JOB_PROGRESS_DO: DurableObjectNamespace;
  USER_SESSION_DO: DurableObjectNamespace;
  JOB_QUEUE: Queue;
  JOB_DLQ: Queue;
  RATE_LIMIT_KV: KVNamespace;
  CSRF_KV: KVNamespace;
  SESSION_SECRET: string;
  CSRF_SECRET: string;
  CALLBACK_SIGNING_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  WORKER_CLUSTER_URL: string;
  WORKER_CLUSTER_TOKEN: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  ENVIRONMENT: string;
  APP_DOMAIN: string;
  R2_BUCKET_NAME: string;
  MAX_UPLOAD_BYTES: string;
}

const router = new Router<Env>();

// ── Health ─────────────────────────────────────────────────────────────────────
router.get("/health", [], async () =>
  Response.json({ status: "ok", ts: new Date().toISOString() }),
);

// ── Auth (public, rate-limited) ────────────────────────────────────────────────
router.post("/auth/register",       [rateLimitMiddleware("register", 5, 60)],    handleRegister);
router.post("/auth/login",          [rateLimitMiddleware("login", 10, 60)],      handleLogin);
router.post("/auth/logout",         [authMiddleware],                            handleLogout);
router.post("/auth/reset",          [rateLimitMiddleware("reset", 3, 3600)],     handleReset);
router.post("/auth/reset/confirm",  [rateLimitMiddleware("reset-c", 5, 3600)],   handleResetConfirm);
router.post("/auth/verify-email",   [],                                          handleVerifyEmail);

// ── API Keys (authenticated) ───────────────────────────────────────────────────
router.get("/auth/api-keys",           [authMiddleware],                           handleListApiKeys);
router.post("/auth/api-keys",          [authMiddleware, csrfMiddleware],           handleCreateApiKey);
router.delete("/auth/api-keys/:id",    [authMiddleware, csrfMiddleware],           handleRevokeApiKey);

// ── Session info ──────────────────────────────────────────────────────────────
router.get("/auth/me", [authMiddleware], async (_req, _env, ctx) =>
  Response.json({ user: ctx.user }),
);

// ── Jobs (authenticated) ───────────────────────────────────────────────────────
router.post("/jobs",              [authMiddleware, csrfMiddleware],             handleCreateJob);
router.get("/jobs",               [authMiddleware],                             handleListJobs);
router.get("/jobs/:id",           [authMiddleware],                             handleGetJob);
router.post("/jobs/:id/pause",    [authMiddleware, csrfMiddleware],             handleJobAction("pause"));
router.post("/jobs/:id/resume",   [authMiddleware, csrfMiddleware],             handleJobAction("resume"));
router.post("/jobs/:id/cancel",   [authMiddleware, csrfMiddleware],             handleJobAction("cancel"));

// Internal callback (signed, no user auth)
router.post("/jobs/callback",     [rateLimitMiddleware("callback", 200, 1)],   handleJobCallback);

// ── Files ──────────────────────────────────────────────────────────────────────
router.get("/jobs/:id/files",              [authMiddleware],                   handleGetFiles);
router.post("/files/:fileId/signed-url",   [authMiddleware, csrfMiddleware],   handleSignedUrl);
router.delete("/files/:fileId",            [authMiddleware, csrfMiddleware],   handleDeleteFile);

// ── Usage ──────────────────────────────────────────────────────────────────────
router.get("/usage",  [authMiddleware], handleGetUsage);
router.get("/plans",  [],               handleGetPlans);

// ── Admin — User Management ────────────────────────────────────────────────────
router.get("/admin/users",                  [authMiddleware, rbacMiddleware("admin")], handleAdminListUsers);
router.get("/admin/users/:id",              [authMiddleware, rbacMiddleware("admin")], handleAdminGetUser);
router.patch("/admin/users/:id",            [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminUpdateUser);
router.post("/admin/users/:id/force-logout",[authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminForceLogout);

// ── Admin — Jobs ───────────────────────────────────────────────────────────────
router.get("/admin/jobs",                   [authMiddleware, rbacMiddleware("admin")], handleAdminListJobs);
router.post("/admin/jobs/:id/terminate",    [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminTerminateJob);

// ── Admin — System ─────────────────────────────────────────────────────────────
router.get("/admin/system-health",          [authMiddleware, rbacMiddleware("admin")], handleAdminSystemHealth);

// ── Admin — Audit ──────────────────────────────────────────────────────────────
router.get("/admin/audit",                  [authMiddleware, rbacMiddleware("support")], handleAdminAudit);

// ── Admin — Security ───────────────────────────────────────────────────────────
router.get("/admin/blocklist",              [authMiddleware, rbacMiddleware("admin")], handleAdminListBlocklist);
router.post("/admin/blocklist",             [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminBlocklist);
router.get("/admin/security-events",        [authMiddleware, rbacMiddleware("admin")], handleAdminSecurityEvents);

// ── Admin — Feature Flags ──────────────────────────────────────────────────────
router.get("/admin/feature-flags",          [authMiddleware, rbacMiddleware("admin")], handleAdminListFlags);
router.patch("/admin/feature-flags/:key",   [authMiddleware, rbacMiddleware("superadmin"), csrfMiddleware], handleAdminUpdateFlag);

// ── Admin — Workers / Fleet ────────────────────────────────────────────────────
// NOTE: heartbeat must be registered BEFORE the :id wildcard routes
router.post("/admin/workers/heartbeat",     [], handleWorkerHeartbeat);
router.get("/admin/workers",                [authMiddleware, rbacMiddleware("admin")], handleAdminListWorkers);
router.post("/admin/workers/:id/cordon",    [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminCordonWorker);
router.post("/admin/workers/:id/drain",     [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminDrainWorker);

// ── Admin — Storage ────────────────────────────────────────────────────────────
router.get("/admin/storage",                [authMiddleware, rbacMiddleware("admin")], handleAdminStorage);
router.post("/admin/storage/cleanup",       [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminStorageCleanup);

// ── Admin — Providers ──────────────────────────────────────────────────────────
router.get("/admin/providers",                [authMiddleware, rbacMiddleware("admin")], handleListProviders);
router.get("/admin/providers/active",         [authMiddleware, rbacMiddleware("admin")], handleGetActiveProvider);
router.get("/admin/providers/health",         [authMiddleware, rbacMiddleware("admin")], handleProviderHealth);
router.get("/admin/providers/history",        [authMiddleware, rbacMiddleware("admin")], handleProviderHistory);
router.post("/admin/providers/switch",        [authMiddleware, rbacMiddleware("superadmin"), csrfMiddleware], handleSwitchProvider);
router.post("/admin/providers/verify",        [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleVerifyProvider);

// ── Public Blog ────────────────────────────────────────────────────────────────
router.get("/blog/articles",                [],                                           handleListArticles);
router.get("/blog/articles/:slug",          [],                                           handleGetArticle);

// ── Admin — Blog / CMS ─────────────────────────────────────────────────────────
router.get("/admin/articles",               [authMiddleware, rbacMiddleware("admin")],                       handleAdminListArticles);
router.get("/admin/articles/:id",           [authMiddleware, rbacMiddleware("admin")],                       handleAdminGetArticle);
router.post("/admin/articles",              [authMiddleware, rbacMiddleware("admin"), csrfMiddleware],        handleAdminCreateArticle);
router.patch("/admin/articles/:id",         [authMiddleware, rbacMiddleware("admin"), csrfMiddleware],        handleAdminUpdateArticle);
router.delete("/admin/articles/:id",        [authMiddleware, rbacMiddleware("superadmin"), csrfMiddleware],   handleAdminDeleteArticle);
router.post("/admin/articles/:id/publish",  [authMiddleware, rbacMiddleware("admin"), csrfMiddleware],        handleAdminTogglePublish);

// ── Durable Object SSE proxy ───────────────────────────────────────────────────
router.get("/do/job/:id/sse", [authMiddleware], async (req, env, ctx) => {
  const id = env.JOB_PROGRESS_DO.idFromName(ctx.params.id);
  return env.JOB_PROGRESS_DO.get(id).fetch(req);
});

// ── Fallback ───────────────────────────────────────────────────────────────────
router.all("*", [], async () =>
  Response.json({ error: "Not Found", code: "NOT_FOUND" }, { status: 404 }),
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const correlationId = crypto.randomUUID();
    const enriched = new Request(request, {
      headers: { ...Object.fromEntries(request.headers), "X-Correlation-ID": correlationId },
    });

    try {
      const response = await router.handle(enriched, env, ctx);
      const headers = new Headers(response.headers);
      headers.set("X-Correlation-ID", correlationId);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "DENY");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

      return new Response(response.body, { status: response.status, headers });
    } catch (err) {
      console.error(JSON.stringify({ correlationId, error: String(err), stack: (err as Error).stack }));
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

  // ── Cron Triggers ────────────────────────────────────────────────────────────
  // Polls Seedr.cc every 2 minutes for active Seedr-provider job progress
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      console.log(JSON.stringify({
        ts: new Date().toISOString(), level: "info",
        service: "workers-api", event: "cron",
        cron: event.cron,
        scheduledTime: new Date(event.scheduledTime).toISOString(),
      }));

      const { runSeedrPoller } = await import("./seedr-poller");
      try {
        await runSeedrPoller(env);
      } catch (err) {
        console.error(JSON.stringify({
          ts: new Date().toISOString(), level: "error",
          service: "workers-api", event: "cron_error",
          error: String(err), stack: (err as Error).stack,
        }));
      }
    })());
  },
};
