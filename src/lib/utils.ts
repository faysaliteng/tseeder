import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Formatting helpers (moved from mock-data.ts) ────────────────────────────

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
