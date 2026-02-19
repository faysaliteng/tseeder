/**
 * Typed API client — all data comes from the real Workers API.
 *
 * VITE_API_BASE_URL must be set in .env.local (development) or Cloudflare Pages
 * environment variables (production). When unset in production the build will
 * log a fatal warning and all API calls will fail.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

if (!BASE && import.meta.env.PROD) {
  console.error(
    "[tseeder] FATAL: VITE_API_BASE_URL is not set. " +
    "All API calls will fail. Set this in Cloudflare Pages environment variables.",
  );
}

// Store CSRF token after login
let csrfToken = "";
export function setCsrfToken(t: string) { csrfToken = t; }
export function getCsrfToken() { return csrfToken; }

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  // Inject active org context (set by OrgSwitcher)
  const activeOrgSlug = typeof window !== "undefined" ? localStorage.getItem("activeOrgSlug") : null;
  if (activeOrgSlug) headers.set("X-Org-Slug", activeOrgSlug);

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: "Unknown error", code: "NETWORK_ERROR" } }));
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "Request failed");
  }

  // Capture refreshed CSRF token if present
  const newCsrf = res.headers.get("X-CSRF-Token");
  if (newCsrf) setCsrfToken(newCsrf);

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string, turnstileToken: string) =>
    request<{ user: { id: string; email: string; role: string }; csrfToken: string }>(
      "/auth/login", { method: "POST", body: JSON.stringify({ email, password, turnstileToken }) },
    ).then(data => { setCsrfToken(data.csrfToken); return data; }),

  register: (email: string, password: string, turnstileToken: string) =>
    request<{ message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, turnstileToken, acceptedAup: true }),
    }),

  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),

  resetRequest: (email: string) =>
    request<{ message: string }>("/auth/reset", { method: "POST", body: JSON.stringify({ email }) }),

  resetConfirm: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
};

// ── Jobs ─────────────────────────────────────────────────────────────────────

export interface ApiJob {
  id: string; name: string; status: string;
  progressPct: number; downloadSpeed: number; uploadSpeed: number;
  eta: number; peers: number; seeds: number;
  bytesDownloaded: number; bytesTotal: number;
  infohash: string | null; error: string | null;
  createdAt: string; updatedAt: string; completedAt: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const jobs = {
  list: (params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString();
    return request<PaginatedResponse<ApiJob>>(`/jobs${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => request<ApiJob>(`/jobs/${id}`),

  createMagnet: (magnetUri: string, name?: string) =>
    request<ApiJob>("/jobs", { method: "POST", body: JSON.stringify({ type: "magnet", magnetUri, name }) }),

  createTorrent: (file: File) => {
    const form = new FormData();
    form.append("torrent", file);
    return request<ApiJob>("/jobs", {
      method: "POST",
      headers: {}, // let browser set multipart boundary
      body: form,
    });
  },

  pause: (id: string) => request<{ id: string; status: string }>(`/jobs/${id}/pause`, { method: "POST" }),
  resume: (id: string) => request<{ id: string; status: string }>(`/jobs/${id}/resume`, { method: "POST" }),
  cancel: (id: string) => request<{ id: string; status: string }>(`/jobs/${id}/cancel`, { method: "POST" }),

  getFiles: (id: string) => request<{ jobId: string; files: ApiFile[]; tree: unknown[] }>(`/jobs/${id}/files`),
};

// ── Files ─────────────────────────────────────────────────────────────────────

export interface ApiFile {
  id: string; path: string; sizeBytes: number;
  mimeType: string | null; isComplete: boolean;
}

export const files = {
  getSignedUrl: (fileId: string, expiresIn = 3600) =>
    request<{ url: string; expiresAt: string; filename: string }>(
      `/files/${fileId}/signed-url`,
      { method: "POST", body: JSON.stringify({ expiresIn }) },
    ),

  delete: (fileId: string) =>
    request<{ message: string; fileId: string }>(`/files/${fileId}`, { method: "DELETE" }),
};

// ── Usage ─────────────────────────────────────────────────────────────────────

export interface ApiUsage {
  plan: { name: string; maxJobs: number; maxStorageGb: number; bandwidthGb: number; retentionDays: number };
  storageUsedBytes: number; bandwidthUsedBytes: number;
  activeJobs: number; totalJobs: number;
}

export const usage = {
  get: () => request<ApiUsage>("/usage"),
  getPlans: () => request<{ plans: unknown[] }>("/plans"),
};

// ── Public system status (no auth — for /status page) ────────────────────────

export const systemStatus = {
  get: () => request<{
    status: string;
    failedLast24h: number;
    queueDepth: number;
    dlqDepth: number;
    agent: { status: string } | null;
    ts: string;
  }>("/system-status"),
};

// ── Auth (me) ─────────────────────────────────────────────────────────────────

export const authMe = {
  me: () => request<{ user: { id: string; role: string } }>("/auth/me"),
};

// ── API Keys ──────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;          // first 8 chars visible, rest masked
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export const apiKeys = {
  list: () => request<{ keys: ApiKey[] }>("/auth/api-keys"),
  create: (name: string, expiresIn?: number) =>
    request<{ key: ApiKey; secret: string }>("/auth/api-keys", {
      method: "POST",
      body: JSON.stringify({ name, expiresIn }),
    }),
  revoke: (id: string) =>
    request<{ message: string }>(`/auth/api-keys/${id}`, { method: "DELETE" }),
};



// ── Billing (Stripe) ───────────────────────────────────────────────────────────

export const billing = {
  config: () => request<{ publishableKey: string | null }>("/billing/config"),

  checkout: (planName: string) =>
    request<{ checkoutUrl: string; sessionId: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ planName }),
    }),

  portal: () =>
    request<{ portalUrl: string }>("/billing/portal", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};

// ── Admin — DLQ / Search / Config History ─────────────────────────────────────

export const adminDlq = {
  list: (page = 1) =>
    request<PaginatedResponse<unknown>>(`/admin/dlq?page=${page}`),
  replay: (jobId: string, reason: string, ticketId: string) =>
    request<{ id: string; status: string; message: string }>(`/admin/dlq/${jobId}/replay`, {
      method: "POST",
      body: JSON.stringify({ reason, ticketId }),
    }),
};

export const adminSearch = {
  search: (q: string) =>
    request<{
      query: string;
      results: { users: unknown[]; jobs: unknown[]; auditLogs: unknown[] };
      totals: { users: number; jobs: number; auditLogs: number };
    }>(`/admin/search?q=${encodeURIComponent(q)}`),
};

export const adminConfig = {
  history: (page = 1, key?: string) => {
    const qs = new URLSearchParams({ page: String(page), ...(key ? { key } : {}) }).toString();
    return request<PaginatedResponse<unknown>>(`/admin/config-history?${qs}`);
  },
};



export const admin = {
  listUsers: (params?: { page?: number; q?: string; role?: string; suspended?: string }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)])).toString();
    return request<PaginatedResponse<unknown>>(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  getUser: (id: string) => request<{
    user: unknown; plan: unknown; usage: unknown;
    sessions: unknown[]; recentJobs: unknown[]; auditTimeline: unknown[];
  }>(`/admin/users/${id}`),
  updateUser: (id: string, body: { role?: string; suspended?: boolean; planId?: string }) =>
    request<unknown>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  forceLogout: (id: string) =>
    request<{ message: string }>(`/admin/users/${id}/force-logout`, { method: "POST" }),

  listJobs: (params?: { status?: string; page?: number; userId?: string; q?: string }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)])).toString();
    return request<PaginatedResponse<unknown>>(`/admin/jobs${qs ? `?${qs}` : ""}`);
  },
  terminateJob: (id: string, reason?: string) =>
    request<unknown>(`/admin/jobs/${id}/terminate`, { method: "POST", body: JSON.stringify({ reason }) }),

  systemHealth: () => request<{
    jobs: Record<string, number>;
    failedLast24h: number;
    queueDepth: number;
    dlqDepth: number;
    agent: unknown;
    status: string;
    ts: string;
  }>("/admin/system-health"),

  audit: (page = 1, params?: { action?: string; actorId?: string }) => {
    const qs = new URLSearchParams({ page: String(page), ...(params ?? {}) }).toString();
    return request<PaginatedResponse<unknown>>(`/admin/audit?${qs}`);
  },

  listBlocklist: (page = 1) =>
    request<PaginatedResponse<unknown>>(`/admin/blocklist?page=${page}`),
  addBlocklist: (infohash: string, reason?: string) =>
    request<{ message: string; jobsTerminated: number }>("/admin/blocklist", { method: "POST", body: JSON.stringify({ infohash, reason }) }),

  securityEvents: (page = 1, severity?: string) => {
    const qs = new URLSearchParams({ page: String(page), ...(severity ? { severity } : {}) }).toString();
    return request<PaginatedResponse<unknown>>(`/admin/security-events?${qs}`);
  },

  listFlags: () => request<{ flags: unknown[] }>("/admin/feature-flags"),
  updateFlag: (key: string, value: number, reason?: string) =>
    request<{ key: string; value: number }>(`/admin/feature-flags/${key}`, {
      method: "PATCH", body: JSON.stringify({ value, reason }),
    }),
};

// ── Admin — Workers ────────────────────────────────────────────────────────────

export interface ApiWorker {
  id: string;
  version: string | null;
  status: "healthy" | "draining" | "cordoned" | "offline";
  region: string | null;
  active_jobs: number;
  max_jobs: number;
  disk_free_gb: number | null;
  disk_total_gb: number | null;
  bandwidth_mbps: number | null;
  last_heartbeat: string;
  registered_at: string;
  heartbeat_count_1h: number;
  avg_cpu_1h: number | null;
  is_stale: boolean;
}

export const adminWorkers = {
  list: () => request<{ workers: ApiWorker[]; total: number }>("/admin/workers"),
  cordon: (id: string) =>
    request<{ id: string; status: string; message: string }>(`/admin/workers/${encodeURIComponent(id)}/cordon`, { method: "POST" }),
  drain: (id: string) =>
    request<{ id: string; status: string; message: string }>(`/admin/workers/${encodeURIComponent(id)}/drain`, { method: "POST" }),
};

// ── Admin — Storage ────────────────────────────────────────────────────────────

export interface ApiStorageStats {
  files: { total_files: number; total_bytes: number; complete_files: number; complete_bytes: number };
  orphans: { orphan_count: number; orphan_bytes: number };
  jobs: { total_jobs: number; completed_jobs: number; terminal_jobs: number };
  disk: { disk_free_gb: number | null; disk_total_gb: number | null; created_at: string } | null;
  latestSnapshot: unknown;
  ts: string;
}

export const adminStorage = {
  get: () => request<ApiStorageStats>("/admin/storage"),
  cleanup: (opts?: { reason?: string; dryRun?: boolean }) =>
    request<{
      dryRun?: boolean;
      deletedFromR2?: number;
      deletedFromD1?: number;
      bytesReclaimed?: number;
      orphanFilesFound?: number;
      orphanBytesFound?: number;
      message: string;
    }>("/admin/storage/cleanup", {
      method: "POST",
      body: JSON.stringify(opts ?? {}),
    }),
};

// ── Admin — Providers ──────────────────────────────────────────────────────────

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

export const providers = {
  list: () => request<{
    activeProvider: "cloudflare" | "seedr";
    configs: ProviderConfig[];
    health: ProviderHealth[];
  }>("/admin/providers"),

  getActive: () => request<{
    provider: "cloudflare" | "seedr";
    config: Record<string, unknown>;
    configId: string | null;
  }>("/admin/providers/active"),

  health: () => request<{ health: ProviderHealth[] }>("/admin/providers/health"),

  history: (page = 1) => request<PaginatedResponse<ProviderConfig>>(
    `/admin/providers/history?page=${page}`,
  ),

  switch: (provider: "cloudflare" | "seedr", config?: Record<string, unknown>, note?: string) =>
    request<{ ok: boolean; configId: string; provider: string; activeJobsAtSwitch: number; message: string }>(
      "/admin/providers/switch",
      { method: "POST", body: JSON.stringify({ provider, config, note }) },
    ),

  verify: (provider: "cloudflare" | "seedr", config?: Record<string, unknown>) =>
    request<ProviderHealth>("/admin/providers/verify", {
      method: "POST",
      body: JSON.stringify({ provider, config }),
    }),
};

// ── Blog / Articles ───────────────────────────────────────────────────────────

export interface ApiArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  category: string;
  tags: string[];
  status: "draft" | "published" | "archived";
  readTime: string | null;
  authorId: string | null;
  authorName: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleCreatePayload {
  title: string;
  slug?: string;
  excerpt?: string;
  body?: string;
  category?: string;
  coverImage?: string;
  readTime?: string;
  status?: "draft" | "published";
  tags?: string[];
}

export const blog = {
  list: (params?: { category?: string; limit?: number; page?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString();
    return request<{ articles: ApiArticle[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      `/blog/articles${qs ? `?${qs}` : ""}`
    );
  },
  get: (slug: string) =>
    request<{ article: ApiArticle }>(`/blog/articles/${encodeURIComponent(slug)}`),
};

export const adminArticles = {
  list: (params?: { status?: string; category?: string; q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString();
    return request<{ articles: ApiArticle[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      `/admin/articles${qs ? `?${qs}` : ""}`
    );
  },
  get: (id: string) =>
    request<{ article: ApiArticle }>(`/admin/articles/${id}`),
  create: (data: ArticleCreatePayload) =>
    request<{ article: ApiArticle }>("/admin/articles", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ArticleCreatePayload> & { status?: "draft" | "published" | "archived" }) =>
    request<{ article: ApiArticle }>(`/admin/articles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ message: string; id: string }>(`/admin/articles/${id}`, { method: "DELETE" }),
  togglePublish: (id: string) =>
    request<{ id: string; status: string; publishedAt: string | null }>(`/admin/articles/${id}/publish`, { method: "POST" }),
};

// ── Uptime History (public) ───────────────────────────────────────────────────

export interface UptimeSnapshot {
  date: string;
  operational: boolean;
  note: string | null;
}

export const statusHistory = {
  get: (days = 90) =>
    request<{
      components: Record<string, UptimeSnapshot[]>;
      uptimePct: Record<string, Record<string, number>>;
      days: number;
      generatedAt: string;
    }>(`/status/history?days=${days}`),
};

// ── Admin — Observability ─────────────────────────────────────────────────────

export interface ObservabilityData {
  apiLatency: { p50: number; p95: number; trend: { bucket: string; p50: number; p95: number; requests: number }[] };
  errorRates: { trend: { hour_bucket: string; status_class: string; count: number }[] };
  queueDepth: { current: number; trend: { captured_at: string; queue_depth: number; dlq_depth: number }[] };
  workerFleet: { total: number; healthy: number; stale: number; totalCapacity: number; usedCapacity: number; workers: any[] };
  dlqGrowth: { current: number; change24h: number };
}

export const adminObservability = {
  get: () => request<ObservabilityData>("/admin/observability"),
};

// ── Organizations ─────────────────────────────────────────────────────────────

export interface ApiOrg {
  id: string; name: string; slug: string;
  plan_id: string | null; plan_name: string | null;
  created_at: string; role?: string; member_count?: number;
}

export const orgs = {
  list: () => request<{ orgs: ApiOrg[] }>("/orgs"),
  create: (name: string) =>
    request<{ org: ApiOrg }>("/orgs", { method: "POST", body: JSON.stringify({ name }) }),
  get: (slug: string) =>
    request<{ org: ApiOrg; members: any[]; myRole: string; usage: { storageBytes: number } }>(`/orgs/${slug}`),
  update: (slug: string, name: string) =>
    request<{ message: string; slug: string }>(`/orgs/${slug}`, {
      method: "PATCH", body: JSON.stringify({ name }),
    }),
  invite: (slug: string, email: string, role = "member") =>
    request<{ message: string; token: string; email: string; role: string; expiresIn: string }>(
      `/orgs/${slug}/invites`, { method: "POST", body: JSON.stringify({ email, role }) }
    ),
  removeMember: (slug: string, userId: string) =>
    request<{ message: string }>(`/orgs/${slug}/members/${userId}`, { method: "DELETE" }),
  delete: (slug: string) =>
    request<{ message: string }>(`/orgs/${slug}`, { method: "DELETE" }),
  acceptInvite: (token: string) =>
    request<{ message: string; slug: string; role: string }>(`/orgs/accept-invite/${token}`, {
      method: "POST", body: JSON.stringify({}),
    }),
};

export const adminOrgs = {
  list: (page = 1) => request<PaginatedResponse<ApiOrg>>(`/admin/orgs?page=${page}`),
};


