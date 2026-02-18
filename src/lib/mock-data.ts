// Mock data types mirroring packages/shared types for the frontend
export type JobStatus =
  | "submitted"
  | "metadata_fetch"
  | "queued"
  | "downloading"
  | "uploading"
  | "completed"
  | "paused"
  | "failed"
  | "cancelled";

export interface Job {
  id: string;
  name: string;
  status: JobStatus;
  progressPct: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  peers: number;
  seeds: number;
  bytesDownloaded: number;
  bytesTotal: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  infohash: string | null;
}

export interface JobFile {
  id: string;
  path: string;
  sizeBytes: number;
  mimeType: string | null;
  isComplete: boolean;
}

export interface UsageMetrics {
  plan: { name: string; maxJobs: number; maxStorageGb: number; bandwidthGb: number; retentionDays: number };
  storageUsedBytes: number;
  bandwidthUsedBytes: number;
  activeJobs: number;
  totalJobs: number;
}

// ── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_JOBS: Job[] = [
  {
    id: "job-1",
    name: "Ubuntu 24.04 LTS Desktop",
    status: "downloading",
    progressPct: 63,
    downloadSpeed: 4_200_000,
    uploadSpeed: 420_000,
    eta: 187,
    peers: 42,
    seeds: 118,
    bytesDownloaded: 2_600_000_000,
    bytesTotal: 4_100_000_000,
    error: null,
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    updatedAt: new Date(Date.now() - 5000).toISOString(),
    completedAt: null,
    infohash: "a04e6cdb4d64c7d1df5d13cf2e6e0c27b2aae12f",
  },
  {
    id: "job-2",
    name: "Big Buck Bunny 4K",
    status: "completed",
    progressPct: 100,
    downloadSpeed: 0,
    uploadSpeed: 0,
    eta: 0,
    peers: 0,
    seeds: 0,
    bytesDownloaded: 1_200_000_000,
    bytesTotal: 1_200_000_000,
    error: null,
    createdAt: new Date(Date.now() - 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 80000_000).toISOString(),
    completedAt: new Date(Date.now() - 80000_000).toISOString(),
    infohash: "b04e6cdb4d64c7d1df5d13cf2e6e0c27b2aae12f",
  },
  {
    id: "job-3",
    name: "Arch Linux 2024.01",
    status: "queued",
    progressPct: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    eta: 0,
    peers: 0,
    seeds: 0,
    bytesDownloaded: 0,
    bytesTotal: 800_000_000,
    error: null,
    createdAt: new Date(Date.now() - 120_000).toISOString(),
    updatedAt: new Date(Date.now() - 60_000).toISOString(),
    completedAt: null,
    infohash: "c04e6cdb4d64c7d1df5d13cf2e6e0c27b2aae12f",
  },
  {
    id: "job-4",
    name: "dataset-ml-images-v3.tar",
    status: "metadata_fetch",
    progressPct: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    eta: 0,
    peers: 3,
    seeds: 7,
    bytesDownloaded: 0,
    bytesTotal: 0,
    error: null,
    createdAt: new Date(Date.now() - 30_000).toISOString(),
    updatedAt: new Date(Date.now() - 10_000).toISOString(),
    completedAt: null,
    infohash: null,
  },
  {
    id: "job-5",
    name: "corrupt-torrent-file.zip",
    status: "failed",
    progressPct: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    eta: 0,
    peers: 0,
    seeds: 0,
    bytesDownloaded: 0,
    bytesTotal: 0,
    error: "Infohash not found in DHT after 5 retries",
    createdAt: new Date(Date.now() - 7200_000).toISOString(),
    updatedAt: new Date(Date.now() - 7100_000).toISOString(),
    completedAt: null,
    infohash: null,
  },
];

export const MOCK_FILES: JobFile[] = [
  { id: "f1", path: "Big.Buck.Bunny.4K/Big.Buck.Bunny.4K.mkv", sizeBytes: 1_100_000_000, mimeType: "video/x-matroska", isComplete: true },
  { id: "f2", path: "Big.Buck.Bunny.4K/subtitles/en.srt", sizeBytes: 45_000, mimeType: "text/plain", isComplete: true },
  { id: "f3", path: "Big.Buck.Bunny.4K/poster.jpg", sizeBytes: 280_000, mimeType: "image/jpeg", isComplete: true },
];

export const MOCK_USAGE: UsageMetrics = {
  plan: { name: "pro", maxJobs: 10, maxStorageGb: 50, bandwidthGb: 500, retentionDays: 30 },
  storageUsedBytes: 12_400_000_000,
  bandwidthUsedBytes: 87_000_000_000,
  activeJobs: 2,
  totalJobs: 5,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/s`;
}

export function formatEta(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function statusLabel(status: JobStatus): string {
  const map: Record<JobStatus, string> = {
    submitted: "Submitted",
    metadata_fetch: "Fetching Metadata",
    queued: "Queued",
    downloading: "Downloading",
    uploading: "Uploading",
    completed: "Completed",
    paused: "Paused",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

export function statusColor(status: JobStatus): string {
  const map: Record<JobStatus, string> = {
    submitted: "text-muted-foreground",
    metadata_fetch: "text-info",
    queued: "text-warning",
    downloading: "text-primary",
    uploading: "text-primary",
    completed: "text-success",
    paused: "text-muted-foreground",
    failed: "text-destructive",
    cancelled: "text-muted-foreground",
  };
  return map[status] ?? "text-muted-foreground";
}

export function getMimeIcon(mimeType: string | null): string {
  if (!mimeType) return "📄";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("gzip")) return "📦";
  if (mimeType.includes("pdf")) return "📕";
  if (mimeType.includes("text")) return "📝";
  return "📄";
}
