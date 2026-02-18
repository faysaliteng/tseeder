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

// ── Admin ─────────────────────────────────────────────────────────────────────

export const admin = {
  listUsers: (params?: { page?: number; q?: string }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)])).toString();
    return request<PaginatedResponse<unknown>>(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  updateUser: (id: string, body: { role?: string; suspended?: boolean }) =>
    request<unknown>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  listJobs: (params?: { status?: string; page?: number }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)])).toString();
    return request<PaginatedResponse<unknown>>(`/admin/jobs${qs ? `?${qs}` : ""}`);
  },
  terminateJob: (id: string) => request<unknown>(`/admin/jobs/${id}/terminate`, { method: "POST" }),
  systemHealth: () => request<unknown>("/admin/system-health"),
  audit: (page = 1) => request<PaginatedResponse<unknown>>(`/admin/audit?page=${page}`),
  addBlocklist: (infohash: string, reason?: string) =>
    request<{ message: string }>("/admin/blocklist", { method: "POST", body: JSON.stringify({ infohash, reason }) }),
};
