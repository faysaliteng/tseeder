import { cn } from "@/lib/utils";
import { statusLabel, statusColor, type JobStatus } from "@/lib/mock-data";

const dotColor: Record<string, string> = {
  submitted: "bg-muted-foreground",
  metadata_fetch: "bg-info",
  queued: "bg-warning",
  downloading: "bg-primary",
  uploading: "bg-primary",
  completed: "bg-success",
  paused: "bg-muted-foreground",
  failed: "bg-destructive",
  cancelled: "bg-muted-foreground",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const isPulse = status === "downloading" || status === "metadata_fetch" || status === "uploading";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", statusColor(status))}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor[status], isPulse && "animate-pulse")} />
      {statusLabel(status)}
    </span>
  );
}
