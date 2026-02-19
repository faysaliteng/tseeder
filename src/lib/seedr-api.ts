/**
 * Seedr.cc REST API v1 Client
 * Official docs: https://www.seedr.cc/docs/api/rest/v1/
 *
 * Auth: HTTP Basic Auth (email:password) — credentials stored in localStorage.
 * Base URL: https://www.seedr.cc/rest/
 *
 * NOTE: REST API v1 is premium-only and uses Basic Auth, so it is only
 * suitable for personal/trusted use. Credentials never leave the browser
 * except to Seedr's servers over HTTPS.
 */

const SEEDR_REST = "https://www.seedr.cc/rest";
const CREDS_KEY  = "seedr_creds";    // { email, password }
const PROVIDER_KEY = "download_provider";

// ── Credential storage ────────────────────────────────────────────────────────

export interface SeedrCreds {
  email: string;
  password: string;
}

export function getSeedrCreds(): SeedrCreds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? (JSON.parse(raw) as SeedrCreds) : null;
  } catch {
    return null;
  }
}

export function setSeedrCreds(creds: SeedrCreds) {
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

export function clearSeedrCreds() {
  localStorage.removeItem(CREDS_KEY);
}

export function isSeedrConnected(): boolean {
  return !!getSeedrCreds();
}

// ── Provider toggle ───────────────────────────────────────────────────────────

export type DownloadProvider = "cloudflare" | "seedr";

export function getDownloadProvider(): DownloadProvider {
  return (localStorage.getItem(PROVIDER_KEY) as DownloadProvider) ?? "cloudflare";
}

export function setDownloadProvider(p: DownloadProvider) {
  localStorage.setItem(PROVIDER_KEY, p);
}

// ── Error class ───────────────────────────────────────────────────────────────

export class SeedrError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "SeedrError";
  }
}

// ── Core request ──────────────────────────────────────────────────────────────

function basicAuth(creds: SeedrCreds) {
  return "Basic " + btoa(`${creds.email}:${creds.password}`);
}

async function restRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  formData?: Record<string, string>,
): Promise<T> {
  const creds = getSeedrCreds();
  if (!creds) throw new SeedrError(401, "NO_CREDS", "Seedr.cc not connected. Please sign in in Settings.");

  const headers: Record<string, string> = {
    Authorization: basicAuth(creds),
  };

  let body: string | FormData | undefined;
  if (formData && method !== "GET") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(formData).toString();
  }

  const res = await fetch(`${SEEDR_REST}/${endpoint}`, { method, headers, body });

  if (res.status === 401) {
    throw new SeedrError(401, "AUTH_FAILED", "Invalid Seedr.cc credentials. Please reconnect.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new SeedrError(res.status, "REQUEST_FAILED", text || `Seedr API error ${res.status}`);
  }

  // Some endpoints (download) return binary — caller handles those separately
  const ct = res.headers.get("Content-Type") ?? "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  // Return empty object for non-JSON success responses
  return {} as T;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export const seedrAuth = {
  /**
   * Verify credentials by hitting GET /rest/user.
   * Saves them to localStorage on success.
   */
  login: async (email: string, password: string): Promise<SeedrUser> => {
    // Temporarily store to use restRequest
    setSeedrCreds({ email, password });
    try {
      const user = await restRequest<SeedrUser>("user");
      return user;
    } catch (err) {
      clearSeedrCreds();
      throw err;
    }
  },

  logout: () => {
    clearSeedrCreds();
    if (getDownloadProvider() === "seedr") setDownloadProvider("cloudflare");
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SeedrUser {
  username: string;
  email: string;
  space_max: number;   // bytes
  space_used: number;  // bytes
}

export interface SeedrFile {
  id: number;
  name: string;
  size: number;        // bytes
  play_video_url: string | null;
  stream_video_url: string | null;
  download_url: string | null;
}

export interface SeedrFolder {
  id: number;
  name: string;
  size: number;
  play_video_url: string | null;
  folders: SeedrFolder[];
  files: SeedrFile[];
}

export interface SeedrRootFolder {
  id: number;
  name: string;
  folders: SeedrFolder[];
  files: SeedrFile[];
  space_max: number;
  space_used: number;
  email: string;
  username: string;
}

export interface SeedrTransfer {
  id: number;
  name: string;
  size: number;
  progress: number;  // 0-100 (101 = moved to folder)
  status: string;
  added: string;
}

export interface SeedrAddResult {
  result: boolean | string;
  error?: string;
  code?: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const seedr = {
  // ── User ───────────────────────────────────────────────────────────────────

  /** GET /rest/user — account info */
  getUser: () => restRequest<SeedrUser>("user"),

  // ── Folders ────────────────────────────────────────────────────────────────

  /** GET /rest/folder — root folder + account storage info */
  getRoot: () => restRequest<SeedrRootFolder>("folder"),

  /** GET /rest/folder/{id} — contents of a specific folder */
  getFolder: (id: number) => restRequest<SeedrFolder>(`folder/${id}`),

  /** GET /rest/folder/{id}/download — returns a redirect to ZIP */
  getFolderDownloadUrl: (id: number) => `${SEEDR_REST}/folder/${id}/download`,

  /** POST /rest/folder — create folder */
  createFolder: (path: string) =>
    restRequest<{ result: boolean }>("folder", "POST", { path }),

  /** POST /rest/folder/{id}/rename */
  renameFolder: (id: number, renameTo: string) =>
    restRequest<{ result: boolean }>(`folder/${id}/rename`, "POST", { rename_to: renameTo }),

  /** DELETE /rest/folder/{id} */
  deleteFolder: (id: number) =>
    restRequest<{ result: boolean }>(`folder/${id}`, "DELETE"),

  // ── Files ──────────────────────────────────────────────────────────────────

  /** GET /rest/file/{id} — direct download URL (follows redirect) */
  getFileDownloadUrl: (id: number) => {
    const creds = getSeedrCreds();
    if (!creds) throw new SeedrError(401, "NO_CREDS", "Seedr not connected");
    // Return a URL with Basic Auth encoded (opens in new tab via anchor)
    return `${SEEDR_REST}/file/${id}`;
  },

  /**
   * Fetch a signed download link by hitting the file endpoint with credentials.
   * Returns the final redirect URL from Seedr.
   */
  getSignedDownloadUrl: async (id: number): Promise<string> => {
    const creds = getSeedrCreds();
    if (!creds) throw new SeedrError(401, "NO_CREDS", "Seedr not connected");
    // Seedr returns a redirect — we follow it and grab the URL
    const res = await fetch(`${SEEDR_REST}/file/${id}`, {
      method: "GET",
      headers: { Authorization: basicAuth(creds) },
      redirect: "manual",
    });
    const location = res.headers.get("Location");
    if (location) return location;
    // If no redirect, the content streams directly from this URL
    return `${SEEDR_REST}/file/${id}`;
  },

  /** GET /rest/file/{id}/hls — HLS stream URL for video */
  getHlsUrl: (id: number) => `${SEEDR_REST}/file/${id}/hls`,

  /** GET /rest/file/{id}/image — preview image */
  getImageUrl: (id: number) => `${SEEDR_REST}/file/${id}/image`,

  /** GET /rest/file/{id}/thumbnail */
  getThumbnailUrl: (id: number) => `${SEEDR_REST}/file/${id}/thumbnail`,

  /** POST /rest/file/{id}/rename */
  renameFile: (id: number, renameTo: string) =>
    restRequest<{ result: boolean }>(`file/${id}/rename`, "POST", { rename_to: renameTo }),

  /** DELETE /rest/file/{id} */
  deleteFile: (id: number) =>
    restRequest<{ result: boolean }>(`file/${id}`, "DELETE"),

  // ── Transfers ──────────────────────────────────────────────────────────────

  /** GET /rest/transfer/{id} */
  getTransfer: (id: number) =>
    restRequest<SeedrTransfer>(`transfer/${id}`),

  /** POST /rest/transfer/magnet */
  addMagnet: (magnet: string) =>
    restRequest<SeedrAddResult>("transfer/magnet", "POST", { magnet }),

  /** POST /rest/transfer/url */
  addUrl: (url: string) =>
    restRequest<SeedrAddResult>("transfer/url", "POST", { url }),

  /**
   * POST /rest/transfer/file — upload a .torrent file.
   * Uses raw fetch (not restRequest) because it needs multipart/form-data.
   */
  addTorrentFile: async (file: File): Promise<SeedrAddResult> => {
    const creds = getSeedrCreds();
    if (!creds) throw new SeedrError(401, "NO_CREDS", "Seedr not connected");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${SEEDR_REST}/transfer/file`, {
      method: "POST",
      headers: { Authorization: basicAuth(creds) },
      body: form,
    });
    if (!res.ok) throw new SeedrError(res.status, "UPLOAD_FAILED", `Upload failed: ${res.status}`);
    return res.json();
  },

  /** DELETE /rest/transfer/{id} */
  deleteTransfer: (id: number) =>
    restRequest<{ result: boolean }>(`transfer/${id}`, "DELETE"),
};
