import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobs as jobsApi, files as filesApi, usage as usageApi, type ApiJob, type ApiFile, ApiError } from "@/lib/api";
import { formatBytes, formatSpeed, formatEta } from "@/lib/utils";
import { useJobSSE, mergeSSEIntoJob } from "@/hooks/useSSE";
import { StatusBadge } from "@/components/StatusBadge";
import { TopHeader } from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Pause, Play, X, Download, Folder, File,
  FileVideo, FileText, FileImage, Loader2, AlertCircle,
  ChevronRight, ChevronDown, RefreshCw,
  Wifi, WifiOff, Users, Gauge, CheckCircle2, Zap, Copy, Check,
} from "lucide-react";
import type { JobStatus } from "@/lib/utils";

// ── File-type icon ─────────────────────────────────────────────────────────
function FileTypeIcon({ mimeType, isFolder }: { mimeType?: string | null; isFolder?: boolean }) {
  const cls = "w-4 h-4 shrink-0";
  if (isFolder) return <Folder className={cn(cls, "text-warning")} />;
  if (mimeType?.startsWith("video/")) return <FileVideo className={cn(cls, "text-info")} />;
  if (mimeType?.startsWith("image/")) return <FileImage className={cn(cls, "text-success")} />;
  if (mimeType?.startsWith("text/") || mimeType?.includes("pdf")) return <FileText className={cn(cls, "text-muted-foreground")} />;
  return <File className={cn(cls, "text-muted-foreground")} />;
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded", className)} />;
}

// ── Premium MetricCard ─────────────────────────────────────────────────────
function MetricCard({
  label, value, icon: Icon, color = "primary",
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color?: "primary" | "success" | "info" | "warning";
}) {
  const colorMap = {
    primary: { bg: "bg-primary/10 border-primary/20", icon: "text-primary", glow: "shadow-[0_0_12px_hsl(239_84%_67%/0.2)]" },
    success: { bg: "bg-success/10 border-success/20", icon: "text-success", glow: "shadow-[0_0_12px_hsl(142_71%_45%/0.2)]" },
    info:    { bg: "bg-info/10 border-info/20",       icon: "text-info",    glow: "shadow-[0_0_12px_hsl(199_89%_48%/0.2)]" },
    warning: { bg: "bg-warning/10 border-warning/20", icon: "text-warning", glow: "shadow-[0_0_12px_hsl(38_92%_50%/0.2)]" },
  };
  const s = colorMap[color];
  return (
    <div className="glass-card rounded-xl p-4 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${s.bg} ${s.glow}`}>
          <Icon className={`w-4 h-4 ${s.icon}`} />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

// ── File row ────────────────────────────────────────────────────────────────
function FileRow({ file }: { file: ApiFile }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamCopied, setStreamCopied] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const mimeColor = file.mimeType?.startsWith("video/") ? "border-l-info"
    : file.mimeType?.startsWith("image/") ? "border-l-success"
    : "border-l-border";

  const isStreamable = file.isComplete && (
    file.mimeType?.startsWith("video/") ||
    file.mimeType?.startsWith("audio/") ||
    file.mimeType?.startsWith("image/")
  );

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

  const handleStream = async () => {
    setStreaming(true);
    try {
      const { url } = await filesApi.getSignedUrl(file.id, 3600);
      setStreamUrl(url);
      await navigator.clipboard.writeText(url);
      setStreamCopied(true);
      toast({
        title: "Stream URL copied! ⚡",
        description: "Paste into VLC (Media → Open Network Stream) or Kodi (Videos → Enter Location)",
      });
      setTimeout(() => setStreamCopied(false), 3000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to get stream link";
      toast({ title: "Stream error", description: msg, variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  };

  const filename = file.path.split("/").pop() ?? file.path;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5 hover:-translate-y-px hover:bg-muted/10 group transition-all duration-150 border-b border-border/30 last:border-0 border-l-2",
      mimeColor,
    )}>
      <div className="w-4 shrink-0" />
      <FileTypeIcon mimeType={file.mimeType} />
      <span className="flex-1 min-w-0 text-sm text-foreground truncate" title={file.path}>
        {filename}
      </span>
      {!file.isComplete && (
        <span className="text-xs text-warning font-semibold shrink-0">Incomplete</span>
      )}
      <span className="text-xs text-muted-foreground w-20 text-right shrink-0 tabular-nums">
        {formatBytes(file.sizeBytes)}
      </span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1.5">
        {/* Stream button — video/audio/image only */}
        {isStreamable && (
          <button
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border transition-all font-medium disabled:opacity-40",
              streamCopied
                ? "border-success/50 text-success bg-success/10"
                : "border-primary-glow/40 text-primary-glow hover:bg-primary/10 hover:border-primary-glow/60",
            )}
            onClick={handleStream}
            disabled={streaming}
            title="Copy streaming URL for VLC / Kodi / Infuse"
          >
            {streaming
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : streamCopied
              ? <Check className="w-3 h-3" />
              : <Zap className="w-3 h-3" />}
            {streamCopied ? "Copied!" : "Stream"}
          </button>
        )}
        {/* Download button */}
        <button
          className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all font-medium disabled:opacity-40"
          onClick={handleDownload}
          disabled={downloading || !file.isComplete}
        >
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Download
        </button>
      </div>
    </div>
  );
}

// ── Folder tree ────────────────────────────────────────────────────────────
interface FolderNode { name: string; children: (FolderNode | ApiFile)[]; }

function buildTree(files: ApiFile[]): FolderNode {
  const root: FolderNode = { name: "", children: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children.find((c): c is FolderNode => "children" in c && c.name === parts[i]) as FolderNode | undefined;
      if (!child) { child = { name: parts[i], children: [] }; node.children.push(child); }
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
        className="flex items-center gap-2 px-4 py-2 hover:bg-muted/10 w-full text-left transition-colors group"
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <Folder className="w-4 h-4 text-warning shrink-0" />
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

// ── Live SSE indicator ─────────────────────────────────────────────────────
function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <span className={cn(
      "text-xs flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-semibold",
      connected
        ? "text-success border-success/30 bg-success/10"
        : "text-warning border-warning/30 bg-warning/10"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-success animate-glow-pulse" : "bg-warning")}
        style={{ boxShadow: connected ? "0 0 4px hsl(142 71% 45%)" : undefined }} />
      {connected
        ? <><Wifi className="w-3 h-3" /> Live</>
        : <><WifiOff className="w-3 h-3" /> Reconnecting…</>}
    </span>
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
      return ["downloading","uploading","metadata_fetch","submitted","queued"].includes(d.status) ? 10_000 : false;
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
    plan: { name: usageData?.plan.name ?? "free", maxStorageGb: usageData?.plan.maxStorageGb ?? 5, bandwidthGb: usageData?.plan.bandwidthGb ?? 20 },
    storageUsedBytes: usageData?.storageUsedBytes ?? 0,
    bandwidthUsedBytes: usageData?.bandwidthUsedBytes ?? 0,
  };

  const fileTree = filesData?.files ? buildTree(filesData.files) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 60% 40% at 20% 0%, hsl(239 84% 67% / 0.05) 0%, transparent 60%)"
      }} />
      <div className="relative z-10 flex flex-col flex-1">
        <TopHeader usage={headerUsage} onAddMagnet={() => {}} onUploadTorrent={() => {}} />

        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-5">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground animate-slide-up-fade">
            <Link to="/app/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1 font-medium">
              <ArrowLeft className="w-3.5 h-3.5" /> Files
            </Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            <span className="text-foreground font-semibold truncate max-w-xs">
              {isLoading ? "Loading…" : liveJob?.name ?? "Job"}
            </span>
          </nav>

          {isLoading ? (
            <div className="glass-card rounded-2xl p-6 space-y-3 animate-slide-up-fade">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2 w-full mt-4" />
            </div>
          ) : isError || !liveJob ? (
            <div className="glass-card rounded-2xl p-8 text-center animate-slide-up-fade">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
              <p className="text-foreground font-semibold mb-1">Job not found</p>
              <p className="text-sm text-muted-foreground mb-4">This job may have been deleted or does not exist.</p>
              <Button variant="outline" onClick={() => navigate("/app/dashboard")} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Files
              </Button>
            </div>
          ) : (
            <>
              {/* Job header card */}
              <div className="glass-premium rounded-2xl p-5 animate-slide-up-fade" style={{ animationDelay: "0.05s" }}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-foreground truncate">{liveJob.name}</h1>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <StatusBadge status={liveJob.status as JobStatus} />
                      {liveJob.infohash && (
                        <span className="text-xs text-muted-foreground font-mono truncate hidden sm:block max-w-[200px]">
                          {liveJob.infohash}
                        </span>
                      )}
                      {isActive && <LiveIndicator connected={connected} />}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {liveJob.status === "downloading" && (
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 border-border hover:border-primary/40"
                        onClick={() => actionMutation.mutate({ action: "pause" })}
                        disabled={actionMutation.isPending}>
                        <Pause className="w-3.5 h-3.5" /> Pause
                      </Button>
                    )}
                    {liveJob.status === "paused" && (
                      <Button size="sm" className="gradient-primary text-white border-0 gap-1.5 h-8 shadow-glow-primary"
                        onClick={() => actionMutation.mutate({ action: "resume" })}
                        disabled={actionMutation.isPending}>
                        <Play className="w-3.5 h-3.5" /> Resume
                      </Button>
                    )}
                    {!["completed","failed","cancelled"].includes(liveJob.status) && (
                      <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                        onClick={() => actionMutation.mutate({ action: "cancel" })}
                        disabled={actionMutation.isPending}>
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 hover:text-primary"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["job", jobId] })}>
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Premium progress bar */}
                {isActive && liveJob.bytesTotal > 0 && (
                  <div className="space-y-2">
                    <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                        style={{
                          width: `${liveJob.progressPct}%`,
                          background: "var(--gradient-primary)",
                          boxShadow: "0 0 12px hsl(239 84% 67% / 0.6)",
                        }}
                      />
                      {/* Speed/ETA overlay in bar */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white/80 mix-blend-plus-lighter">
                          {formatSpeed(liveJob.downloadSpeed)} · ETA {formatEta(liveJob.eta)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                      <span>{formatBytes(liveJob.bytesDownloaded)} / {formatBytes(liveJob.bytesTotal)}</span>
                      <span className="font-bold text-primary">{liveJob.progressPct}%</span>
                    </div>
                  </div>
                )}

                {/* Metric cards */}
                {isActive && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <MetricCard label="Download" value={formatSpeed(liveJob.downloadSpeed)} icon={Gauge} color="primary" />
                    <MetricCard label="Upload"   value={formatSpeed(liveJob.uploadSpeed)}   icon={Gauge} color="info" />
                    <MetricCard label="Peers"    value={String(liveJob.peers)}              icon={Users} color="warning" />
                    <MetricCard label="Seeds"    value={String(liveJob.seeds)}              icon={Users} color="success" />
                  </div>
                )}

                {liveJob.status === "failed" && liveJob.error && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl neon-border-danger">
                    <p className="text-sm text-destructive">{liveJob.error}</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-border/30 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <div>
                    <div className="font-semibold text-foreground mb-0.5 uppercase tracking-wider text-[10px]">Total Size</div>
                    {liveJob.bytesTotal > 0 ? formatBytes(liveJob.bytesTotal) : "—"}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground mb-0.5 uppercase tracking-wider text-[10px]">Created</div>
                    {new Date(liveJob.createdAt).toLocaleString()}
                  </div>
                  {liveJob.completedAt && (
                    <div>
                      <div className="font-semibold text-foreground mb-0.5 uppercase tracking-wider text-[10px]">Completed</div>
                      {new Date(liveJob.completedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* File browser */}
              {liveJob.status === "completed" && (
                <div className="glass-card rounded-2xl overflow-hidden animate-slide-up-fade" style={{ animationDelay: "0.1s" }}>
                  {/* Completed banner */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-success/20 bg-success/5">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" style={{ filter: "drop-shadow(0 0 4px hsl(142 71% 45%))" }} />
                    <h2 className="text-sm font-bold text-success">Download complete</h2>
                    {filesData && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {filesData.files.length} file{filesData.files.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 px-4 py-2 border-b border-border/30 bg-muted/10">
                    <div className="w-4" />
                    <div className="w-4" />
                    <span className="flex-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground w-20 text-right">Size</span>
                    <div className="w-24" />
                  </div>

                  {filesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <Skeleton className="w-5 h-5" />
                        <Skeleton className="flex-1 h-3" />
                        <Skeleton className="w-16 h-3" />
                      </div>
                    ))
                  ) : !filesData?.files?.length ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">No files found</div>
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
    </div>
  );
}
