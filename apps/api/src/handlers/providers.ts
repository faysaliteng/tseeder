/**
 * Provider system — admin-controlled download engine selection
 * Stored in D1, RBAC-protected, audit-logged, versioned.
 *
 * Provider interface every driver must satisfy:
 *   createJob(input)    → providerJobId
 *   getJobStatus(id)    → ProviderJobStatus
 *   listFiles(id)       → ProviderFile[]
 *   getDownloadLink(id) → string
 *   cancelJob(id)       → void
 *   healthCheck()       → ProviderHealth
 */

import type { Env } from "../index";
import { apiError } from "./auth";
import { writeAuditLog } from "../d1-helpers";

type Ctx = { params: Record<string, string>; user?: { id: string; role: string } };

export interface ProviderConfig {
  id: string;
  provider: "cloudflare" | "seedr";
  isActive: boolean;
  config: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  note: string | null;
}

export interface ProviderHealth {
  provider: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

// ── GET /admin/providers ───────────────────────────────────────────────────────

export async function handleListProviders(_req: Request, env: Env, _ctx: Ctx): Promise<Response> {
  const [configs, health] = await Promise.all([
    env.DB.prepare(`
      SELECT pc.*, u.email as created_by_email
      FROM provider_configs pc
      LEFT JOIN users u ON u.id = pc.created_by
      ORDER BY pc.created_at DESC LIMIT 50
    `).all<any>(),

    env.DB.prepare(`
      SELECT ph.*
      FROM provider_health ph
      INNER JOIN (
        SELECT provider, MAX(checked_at) as max_checked
        FROM provider_health
        GROUP BY provider
      ) latest ON latest.provider = ph.provider AND latest.max_checked = ph.checked_at
    `).all<any>(),
  ]);

  const activeConfig = configs.results.find(c => c.is_active === 1);

  return Response.json({
    activeProvider: activeConfig?.provider ?? "cloudflare",
    configs: configs.results.map(rowToConfig),
    health: health.results.map(rowToHealth),
  });
}

// ── GET /admin/providers/active ────────────────────────────────────────────────

export async function handleGetActiveProvider(_req: Request, env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    "SELECT * FROM provider_configs WHERE is_active = 1 LIMIT 1",
  ).first<any>();

  return Response.json({
    provider: row?.provider ?? "cloudflare",
    config: row ? JSON.parse(row.config ?? "{}") : {},
    configId: row?.id ?? null,
  });
}

// ── POST /admin/providers/switch ───────────────────────────────────────────────

export async function handleSwitchProvider(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const body = await req.json().catch(() => null) as {
    provider?: "cloudflare" | "seedr";
    config?: Record<string, unknown>;
    note?: string;
  } | null;

  if (!body?.provider || !["cloudflare", "seedr"].includes(body.provider)) {
    return apiError("VALIDATION_ERROR", "provider must be 'cloudflare' or 'seedr'", 400, correlationId);
  }

  // Check for in-flight jobs before switching
  const activeJobs = await env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM jobs
    WHERE status IN ('metadata_fetch', 'downloading', 'uploading')
  `).first<{ cnt: number }>();

  const newConfigId = crypto.randomUUID();
  const configJson = JSON.stringify(body.config ?? {});

  // Deactivate all → activate new
  await env.DB.batch([
    env.DB.prepare("UPDATE provider_configs SET is_active = 0"),
    env.DB.prepare(`
      INSERT INTO provider_configs (id, provider, is_active, config, created_by, note)
      VALUES (?, ?, 1, ?, ?, ?)
    `).bind(newConfigId, body.provider, configJson, ctx.user!.id, body.note ?? null),
  ]);

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id,
    action: "provider.switched",
    targetType: "provider_config",
    targetId: newConfigId,
    metadata: {
      newProvider: body.provider,
      note: body.note,
      activeJobsAtSwitch: activeJobs?.cnt ?? 0,
    },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "info", correlationId,
    service: "workers-api", handler: "POST /admin/providers/switch",
    actorId: ctx.user!.id, provider: body.provider,
    activeJobsAtSwitch: activeJobs?.cnt ?? 0,
    msg: "Provider switched",
  }));

  return Response.json({
    ok: true,
    configId: newConfigId,
    provider: body.provider,
    activeJobsAtSwitch: activeJobs?.cnt ?? 0,
    message: activeJobs?.cnt
      ? `Provider switched. Note: ${activeJobs.cnt} jobs were in-flight and may need to be retried.`
      : "Provider switched successfully.",
  });
}

// ── POST /admin/providers/verify ───────────────────────────────────────────────

export async function handleVerifyProvider(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const body = await req.json().catch(() => null) as {
    provider?: "cloudflare" | "seedr";
    config?: Record<string, unknown>;
  } | null;

  if (!body?.provider) {
    return apiError("VALIDATION_ERROR", "provider is required", 400, correlationId);
  }

  const start = Date.now();
  let health: ProviderHealth;

  try {
    if (body.provider === "cloudflare") {
      health = await verifyCloudflareProvider(env);
    } else {
      health = await verifySeedrProvider(body.config ?? {});
    }
  } catch (err) {
    health = {
      provider: body.provider,
      status: "down",
      latencyMs: Date.now() - start,
      error: String(err),
      checkedAt: new Date().toISOString(),
    };
  }

  // Persist health check result
  await env.DB.prepare(`
    INSERT INTO provider_health (provider, status, latency_ms, error, checked_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).bind(
    health.provider, health.status,
    health.latencyMs ?? null, health.error ?? null,
  ).run();

  return Response.json(health);
}

// ── GET /admin/providers/health ────────────────────────────────────────────────

export async function handleProviderHealth(_req: Request, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT ph.*
    FROM provider_health ph
    INNER JOIN (
      SELECT provider, MAX(checked_at) as max_checked
      FROM provider_health
      GROUP BY provider
    ) latest ON latest.provider = ph.provider AND latest.max_checked = ph.checked_at
  `).all<any>();

  return Response.json({ health: rows.results.map(rowToHealth) });
}

// ── GET /admin/providers/history ───────────────────────────────────────────────

export async function handleProviderHistory(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`
      SELECT pc.*, u.email as created_by_email FROM provider_configs pc
      LEFT JOIN users u ON u.id = pc.created_by
      ORDER BY pc.created_at DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all<any>(),
    env.DB.prepare("SELECT COUNT(*) as cnt FROM provider_configs").first<{ cnt: number }>(),
  ]);

  return Response.json({
    data: rows.results.map(rowToConfig),
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── Health verification helpers ────────────────────────────────────────────────

async function verifyCloudflareProvider(env: Env): Promise<ProviderHealth> {
  const start = Date.now();
  try {
    const res = await fetch(`${env.WORKER_CLUSTER_URL}/health`, {
      headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { provider: "cloudflare", status: "degraded", latencyMs, error: `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
    }
    return { provider: "cloudflare", status: "healthy", latencyMs, error: null, checkedAt: new Date().toISOString() };
  } catch (err) {
    return { provider: "cloudflare", status: "down", latencyMs: Date.now() - start, error: String(err), checkedAt: new Date().toISOString() };
  }
}

async function verifySeedrProvider(config: Record<string, unknown>): Promise<ProviderHealth> {
  const start = Date.now();
  const email = config.email as string | undefined;
  const password = config.password as string | undefined;

  if (!email || !password) {
    return { provider: "seedr", status: "down", latencyMs: null, error: "Email and password are required", checkedAt: new Date().toISOString() };
  }

  try {
    const authHeader = "Basic " + btoa(`${email}:${password}`);
    const res = await fetch("https://www.seedr.cc/rest/user", {
      headers: { "Authorization": authHeader },
      signal: AbortSignal.timeout(10000),
    });
    const latencyMs = Date.now() - start;
    if (res.status === 401) {
      return { provider: "seedr", status: "down", latencyMs, error: "Invalid credentials", checkedAt: new Date().toISOString() };
    }
    if (!res.ok) {
      return { provider: "seedr", status: "degraded", latencyMs, error: `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
    }
    return { provider: "seedr", status: "healthy", latencyMs, error: null, checkedAt: new Date().toISOString() };
  } catch (err) {
    return { provider: "seedr", status: "down", latencyMs: Date.now() - start, error: String(err), checkedAt: new Date().toISOString() };
  }
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function rowToConfig(row: any): ProviderConfig {
  return {
    id: row.id,
    provider: row.provider,
    isActive: row.is_active === 1,
    config: (() => {
      try { return JSON.parse(row.config ?? "{}"); } catch { return {}; }
    })(),
    createdBy: row.created_by_email ?? row.created_by ?? null,
    createdAt: row.created_at,
    note: row.note ?? null,
  };
}

function rowToHealth(row: any): ProviderHealth {
  return {
    provider: row.provider,
    status: row.status,
    latencyMs: row.latency_ms ?? null,
    error: row.error ?? null,
    checkedAt: row.checked_at,
  };
}
