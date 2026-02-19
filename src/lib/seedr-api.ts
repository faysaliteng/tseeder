/**
 * Seedr.cc API Client
 * Uses the unofficial API (same endpoints as the Chrome extension).
 * Credentials are stored in localStorage — no server required.
 *
 * Docs / reverse-engineered: https://github.com/hemantapkh/seedrcc
 * OAuth endpoint: https://www.seedr.cc/oauth_test/token.php
 */

const SEEDR_BASE = "https://www.seedr.cc/api";
const SEEDR_OAUTH = "https://www.seedr.cc/oauth_test/token.php";
const STORAGE_KEY = "seedr_token";

// ── Token storage ─────────────────────────────────────────────────────────────

export interface SeedrToken {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
}

export function getSeedrToken(): SeedrToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SeedrToken) : null;
  } catch {
    return null;
  }
}

export function setSeedrToken(t: SeedrToken) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export function clearSeedrToken() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isSeedrConnected(): boolean {
  return !!getSeedrToken();
}

// ── Provider setting ──────────────────────────────────────────────────────────

export type DownloadProvider = "cloudflare" | "seedr";

const PROVIDER_KEY = "download_provider";

export function getDownloadProvider(): DownloadProvider {
  return (localStorage.getItem(PROVIDER_KEY) as DownloadProvider) ?? "cloudflare";
}

export function setDownloadProvider(p: DownloadProvider) {
  localStorage.setItem(PROVIDER_KEY, p);
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

async function oauthRequest(body: Record<string, string>): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const form = new URLSearchParams({ ...body, client_id: "seedr_chrome_addon" });
  const res = await fetch(SEEDR_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new SeedrError(res.status, "AUTH_FAILED", text || "OAuth failed");
  }
  return res.json();
}

async function ensureToken(): Promise<string> {
  let token = getSeedrToken();
  if (!token) throw new SeedrError(401, "NO_TOKEN", "Seedr not connected. Please sign in.");

  // Refresh if expired (with 30 s buffer)
  if (Date.now() > token.expires_at - 30_000) {
    const data = await oauthRequest({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    });
    token = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };
    setSeedrToken(token);
  }

  return token.access_token;
}

// ── Core request ──────────────────────────────────────────────────────────────

async function seedrRequest<T>(
  path: string,
  params: Record<string, string> = {},
  method: "GET" | "POST" = "GET",
  body?: Record<string, string>,
): Promise<T> {
  const token = await ensureToken();
  const qs = new URLSearchParams({ access_token: token, ...params }).toString();
  const url = `${SEEDR_BASE}${path}?${qs}`;

  const opts: RequestInit = { method };
  if (body && method === "POST") {
    opts.headers = { "Content-Type": "application/x-www-form-urlencoded" };
    opts.body = new URLSearchParams(body).toString();
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new SeedrError(res.status, "REQUEST_FAILED", text || "Seedr request failed");
  }
  return res.json() as Promise<T>;
}

// ── Error class ───────────────────────────────────────────────────────────────

export class SeedrError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "SeedrError";
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const seedrAuth = {
  /** Sign in with username + password */
  loginPassword: async (username: string, password: string): Promise<void> => {
    const data = await oauthRequest({
      grant_type: "password",
      username,
      password,
    });
    setSeedrToken({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
  },

  logout: () => clearSeedrToken(),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SeedrFolder {
  id: number;
  name: string;
  size: number;
  play_video_url: string | null;
  folders: SeedrFolder[];
  files: SeedrFile[];
}

export interface SeedrFile {
  id: number;
  name: string;
  size: number;
  play_video_url: string | null;
  stream_video_url: string | null;
  download_url: string | null;
}

export interface SeedrSettings {
  username: string;
  email: string;
  space_max: number;    // bytes
  space_used: number;   // bytes
}

export interface SeedrTorrent {
  id: number;
  name: string;
  size: number;
  progress: number; // 0-100
  status: string;
  added: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const seedr = {
  /** Get account info + root folder contents */
  getRoot: () =>
    seedrRequest<{
      result: boolean;
      folders: SeedrFolder[];
      files: SeedrFile[];
      space_max: number;
      space_used: number;
      email: string;
      username: string;
    }>("/folder"),

  /** Add a torrent via magnet URI */
  addMagnet: (magnetUri: string) =>
    seedrRequest<{ result: boolean; code?: string; error?: string }>(
      "/transfer/add",
      {},
      "POST",
      { torrent_magnet: magnetUri },
    ),

  /** Add a torrent by infohash or plain magnet */
  addTorrentUrl: (url: string) =>
    seedrRequest<{ result: boolean; code?: string }>(
      "/transfer/add",
      {},
      "POST",
      { torrent_magnet: url },
    ),

  /** List active transfers (downloads) */
  listTransfers: () =>
    seedrRequest<{
      result: boolean;
      transfers: SeedrTorrent[];
    }>("/transfer/list"),

  /** Delete a transfer */
  deleteTransfer: (id: number) =>
    seedrRequest<{ result: boolean }>(
      "/transfer/delete",
      {},
      "POST",
      { transfer_id: String(id) },
    ),

  /** Get signed download URL for a file */
  getDownloadUrl: (fileId: number) =>
    seedrRequest<{ url: string }>(
      "/file/download",
      { file_id: String(fileId) },
    ),

  /** Delete a file */
  deleteFile: (fileId: number) =>
    seedrRequest<{ result: boolean }>(
      "/file/delete",
      {},
      "POST",
      { file_id: String(fileId) },
    ),

  /** Delete a folder */
  deleteFolder: (folderId: number) =>
    seedrRequest<{ result: boolean }>(
      "/folder/delete",
      {},
      "POST",
      { folder_id: String(folderId) },
    ),
};
