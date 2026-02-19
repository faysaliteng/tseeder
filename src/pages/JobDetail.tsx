import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobs as jobsApi, files as filesApi, type ApiJob, type ApiFile, ApiError } from "@/lib/api";
import { formatBytes, formatSpeed, formatEta } from "@/lib/mock-data";
import { useJobSSE, mergeSSEIntoJob } from "@/hooks/useSSE";
import { StatusBadge } from "@/components/StatusBadge";
import { TopHeader } from "@/components/TopHeader";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MOCK_USAGE } from "@/lib/mock-data";
import { usage as usageApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Pause, Play, X, Download, Folder, File,
  FileVideo, FileText, FileImage, Loader2, AlertCircle,
  ChevronRight, ChevronDown, RefreshCw, ExternalLink,
  Wifi, WifiOff, Users, Gauge,
} from "lucide-react";
import type { JobStatus } from "@/lib/mock-data";

// ── File-type icon ─────────────────────────────────────────────────────────
function FileTypeIcon({ mimeType, isFolder }: { mimeType?: string | null; isFolder?: boolean }) {
  const cls = "w-5 h-5 shrink-0";
  if (isFolder) return <Folder className={cn(cls, "text-warning fill-warning/60")} />;
  if (mimeType?.startsWith("video/")) return <FileVideo className={cn(cls, "text-info")} />;
  if (mimeType?.startsWith("image/")) return <FileImage className={cn(cls, "text-success")} />;
  if (mimeType?.startsWith("text/") || mimeType?.includes("pdf")) return <FileText className={cn(cls, "text-muted-foreground")} />;
  return <File className={cn(cls, "text-muted-foreground")} />;
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted rounded", className)} />;
}

// ── Individual file row with download ──────────────────────────────────────
function FileRow({ file }: { file: ApiFile }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { url } = await filesApi.getSignedUrl(file.id, 3600);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to get download link";
      toast({ title: "Download error", description: msg, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const filename = file.path.split("/").pop() ?? file.path;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 group transition-colors border-b border-dashed border-border/40 last:border-0">
      <div className="w-4 shrink-0" />
      <FileTypeIcon mimeType={file.mimeType} />
      <span className="flex-1 min-w-0 text-sm text-foreground truncate" title={file.path}>
        {filename}
      </span>
      {!file.isComplete && (
        <span className="text-xs text-warning shrink-0">Incomplete</span>
      )}
      <span className="text-sm text-muted-foreground w-20 text-right shrink-0">
        {formatBytes(file.sizeBytes)}
      </span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1.5 text-primary hover:bg-primary/10"
          onClick={handleDownload}
          disabled={downloading || !file.isComplete}
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Download
        </Button>
      </div>
    </div>
  );
}

// ── Folder tree node ────────────────────────────────────────────────────────
interface FolderNode {
  name: string;
  children: (FolderNode | ApiFile)[];
}

function buildTree(files: ApiFile[]): FolderNode {
  const root: FolderNode = { name: "", children: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children.find((c): c is FolderNode => "children" in c && c.name === parts[i]) as FolderNode | undefined;
      if (!child) {
        child = { name: parts[i], children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.children.push(file);
  }
  return root;
}

function FolderTreeNode({ node, depth = 0 }: { node: FolderNode; depth?: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 hover:bg-muted/20 w-full text-left transition-colors"
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <Folder className="w-4 h-4 text-warning fill-warning/60 shrink-0" />
        <span className="text-sm text-foreground font-medium">{node.name}</span>
      </button>
      {open && node.children.map((child, i) => (
        "children" in child
          ? <FolderTreeNode key={child.name + i} node={child} depth={depth + 1} />
          : <div key={(child as ApiFile).id} style={{ paddingLeft: `${depth * 20}px` }}><FileRow file={child as ApiFile} /></div>
      ))}
    </div>
  );
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      const active = ["downloading","uploading","metadata_fetch","submitted","queued"].includes(d.status);
      return active ? 10_000 : false;
    },
    retry: 2,
  });

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["job-files", jobId],
    queryFn: () => jobsApi.getFiles(jobId!),
    enabled: job?.status === "completed",
    staleTime: 60_000,
  });

  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
  });

  // SSE for live progress
  const isActive = job ? ["downloading","uploading","metadata_fetch","submitted","queued"].includes(job.status) : false;
  const { progress, connected } = useJobSSE(isActive ? jobId ?? null : null);
  const liveJob: ApiJob | null = job ? mergeSSEIntoJob(job, progress) : null;

  const actionMutation = useMutation({
    mutationFn: ({ action }: { action: "pause"|"resume"|"cancel" }) => {
      if (action === "pause") return jobsApi.pause(jobId!);
      if (action === "resume") return jobsApi.resume(jobId!);
      return jobsApi.cancel(jobId!);
    },
    onSuccess: (_, { action }) => {
      toast({ title: `Job ${action}d` });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Action failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const headerUsage = {
    plan: {
      name: usageData?.plan.name ?? "free",
      maxStorageGb: usageData?.plan.maxStorageGb ?? 5,
      bandwidthGb: usageData?.plan.bandwidthGb ?? 20,
    },
    storageUsedBytes: usageData?.storageUsedBytes ?? 0,
    bandwidthUsedBytes: usageData?.bandwidthUsedBytes ?? 0,
  };

  const fileTree = filesData?.files ? buildTree(filesData.files) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopHeader
        usage={headerUsage}
        onAddMagnet={() => {}}
        onUploadTorrent={() => {}}
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/app/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Files
          </Link>
          <ChevronRight className="w-3.5 h-3.5 opacity-40" />
          <span className="text-foreground font-medium truncate max-w-xs">
            {isLoading ? "Loading…" : liveJob?.name ?? "Job"}
          </span>
        </nav>

        {/* ── Main job card ─────────────────────────────────────────── */}
        {isLoading ? (
          <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2 w-full mt-4" />
          </div>
        ) : isError || !liveJob ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center shadow-card">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">Job not found</p>
            <p className="text-sm text-muted-foreground mb-4">This job may have been deleted or does not exist.</p>
            <Button variant="outline" onClick={() => navigate("/app/dashboard")} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Files
            </Button>
          </div>
        ) : (
          <>
            {/* Job header */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-foreground truncate">{liveJob.name}</h1>
                  <div className="flex items-center gap-3 mt-1.5">
                    <StatusBadge status={liveJob.status as JobStatus} />
                    {liveJob.infohash && (
                      <span className="text-xs text-muted-foreground font-mono truncate hidden sm:block">
                        {liveJob.infohash}
                      </span>
                    )}
                    {isActive && (
                      <span className={cn("text-xs flex items-center gap-1", connected ? "text-success" : "text-warning")}>
                        {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {connected ? "Live" : "Reconnecting…"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {liveJob.status === "downloading" && (
                    <Button size="sm" variant="outline" className="gap-1.5 h-8"
                      onClick={() => actionMutation.mutate({ action: "pause" })}
                      disabled={actionMutation.isPending}>
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </Button>
                  )}
                  {liveJob.status === "paused" && (
                    <Button size="sm" className="gradient-primary text-white border-0 gap-1.5 h-8"
                      onClick={() => actionMutation.mutate({ action: "resume" })}
                      disabled={actionMutation.isPending}>
                      <Play className="w-3.5 h-3.5" /> Resume
                    </Button>
                  )}
                  {!["completed","failed","cancelled"].includes(liveJob.status) && (
                    <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/40 hover:bg-destructive hover:text-white gap-1.5"
                      onClick={() => actionMutation.mutate({ action: "cancel" })}
                      disabled={actionMutation.isPending}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["job", jobId] })}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              {isActive && liveJob.bytesTotal > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{liveJob.progressPct}% complete</span>
                    <span>ETA {formatEta(liveJob.eta)}</span>
                  </div>
                  <Progress value={liveJob.progressPct} className="h-2.5 [&>div]:progress-bar-glow" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatBytes(liveJob.bytesDownloaded)} / {formatBytes(liveJob.bytesTotal)}</span>
                    <span>{formatBytes(liveJob.bytesTotal - liveJob.bytesDownloaded)} remaining</span>
                  </div>
                </div>
              )}

              {/* Stats grid */}
              {isActive && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <StatCard label="Download" value={formatSpeed(liveJob.downloadSpeed)} icon={Gauge} />
                  <StatCard label="Upload" value={formatSpeed(liveJob.uploadSpeed)} icon={Gauge} />
                  <StatCard label="Peers" value={String(liveJob.peers)} icon={Users} />
                  <StatCard label="Seeds" value={String(liveJob.seeds)} icon={Users} />
                </div>
              )}

              {/* Error */}
              {liveJob.status === "failed" && liveJob.error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <p className="text-sm text-destructive">{liveJob.error}</p>
                </div>
              )}

              {/* Meta */}
              <div className="mt-4 pt-4 border-t border-dashed border-border/50 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div>
                  <div className="font-medium text-foreground mb-0.5">Total Size</div>
                  {liveJob.bytesTotal > 0 ? formatBytes(liveJob.bytesTotal) : "—"}
                </div>
                <div>
                  <div className="font-medium text-foreground mb-0.5">Created</div>
                  {new Date(liveJob.createdAt).toLocaleString()}
                </div>
                {liveJob.completedAt && (
                  <div>
                    <div className="font-medium text-foreground mb-0.5">Completed</div>
                    {new Date(liveJob.completedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* ── File browser ─────────────────────────────────────────── */}
            {liveJob.status === "completed" && (
              <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-border/60">
                  <h2 className="text-sm font-semibold text-foreground">Files</h2>
                  {filesData && (
                    <span className="text-xs text-muted-foreground">
                      {filesData.files.length} file{filesData.files.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Column headers */}
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/20 border-b border-dashed border-border/40">
                  <div className="w-4" />
                  <div className="w-5" />
                  <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Name</span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground w-20 text-right">Size</span>
                  <div className="w-24" />
                </div>

                {filesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                      <Skeleton className="w-5 h-5" />
                      <Skeleton className="flex-1 h-3" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                  ))
                ) : !filesData?.files?.length ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No files found
                  </div>
                ) : fileTree ? (
                  fileTree.children.map((child, i) => (
                    "children" in child
                      ? <FolderTreeNode key={child.name + i} node={child} />
                      : <FileRow key={(child as ApiFile).id} file={child as ApiFile} />
                  ))
                ) : null}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
