/**
 * Typed API client — all data comes from the real Workers API
 * Set VITE_API_BASE_URL in .env.local (development) or Pages env (production)
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

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



// ── Admin ─────────────────────────────────────────────────────────────────────

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

  systemHealth: () => request<unknown>("/admin/system-health"),

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

