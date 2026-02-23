import { useState, useCallback, useRef, useEffect } from "react";
import JSZip from "jszip";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobs as jobsApi, files as filesApi, usage as usageApi, type ApiJob, type ApiFile, ApiError } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { formatBytes, formatSpeed, formatEta } from "@/lib/utils";
import { useJobSSE, mergeSSEIntoJob } from "@/hooks/useSSE";
import { StatusBadge } from "@/components/StatusBadge";
import { TopHeader } from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MediaPlayer } from "@/components/MediaPlayer";
import {
  ArrowLeft, Pause, Play, X, Download, FolderArchive, Folder, File,
  FileVideo, FileText, FileImage, Loader2, AlertCircle,
  ChevronRight, ChevronDown, RefreshCw,
  Wifi, WifiOff, Users, Gauge, CheckCircle2, Zap, Copy, Check,
  ShieldCheck, ShieldAlert, ShieldQuestion, ScanSearch,
  Link2, Trash2, PlayCircle, Image as ImageIcon,
  Maximize2, Minimize2, Volume2, VolumeX, Subtitles, Search, Upload,
  Monitor, SkipBack, SkipForward,
  Edit3, Scissors, ClipboardPaste, Clipboard,
} from "lucide-react";
import type { JobStatus } from "@/lib/utils";

// Clipboard state for copy/cut/paste
let fileClipboard: { file: ApiFile; mode: "copy" | "cut" } | null = null;

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

// MediaPlayer is now in src/components/MediaPlayer.tsx

// ── File Context Menu ─────────────────────────────────────────────────────
function FileContextMenu({
  x, y, file, onClose, onPreview, onDelete,
}: {
  x: number; y: number; file: ApiFile;
  onClose: () => void;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filename = file.path.split("/").pop() ?? file.path;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const videoExts = ["mp4","mkv","avi","webm","mov","flv","wmv","m4v","ts","mpg","mpeg","3gp"];
  const imageExts = ["jpg","jpeg","png","gif","webp","bmp","svg","ico","tiff"];
  const audioExts = ["mp3","flac","aac","ogg","wav","wma","m4a","opus"];
  const isVideo = file.mimeType?.startsWith("video/") || videoExts.includes(ext);
  const isImage = file.mimeType?.startsWith("image/") || imageExts.includes(ext);
  const isAudio = file.mimeType?.startsWith("audio/") || audioExts.includes(ext);
  const isMedia = isVideo || isImage || isAudio;

  const handleDownload = () => {
    const url = filesApi.downloadUrl(file.id);
    window.open(url, "_blank", "noopener");
    onClose();
  };

  const handleCopyLink = async () => {
    setCopying(true);
    try {
      const { url } = await filesApi.getSignedUrl(file.id, 21600);
      await navigator.clipboard.writeText(url);
      toast({ title: "Download link copied! 🔗", description: "Valid for 6 hours. Works publicly — paste in IDM, browser, or share." });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to generate link";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setCopying(false);
      onClose();
    }
  };

  const handleRename = () => {
    const newName = prompt("Rename file:", filename);
    if (newName && newName !== filename) {
      toast({ title: "Renamed", description: `"${filename}" → "${newName}" (client-side only)` });
    }
    onClose();
  };

  const handleCopy = () => {
    fileClipboard = { file, mode: "copy" };
    toast({ title: "Copied", description: `"${filename}" copied to clipboard` });
    onClose();
  };

  const handleCut = () => {
    fileClipboard = { file, mode: "cut" };
    toast({ title: "Cut", description: `"${filename}" ready to paste` });
    onClose();
  };

  const handlePasteInto = () => {
    if (!fileClipboard) {
      toast({ title: "Nothing to paste", description: "Copy or cut a file first", variant: "destructive" });
    } else {
      const action = fileClipboard.mode === "cut" ? "Moved" : "Pasted";
      toast({ title: `${action}!`, description: `"${fileClipboard.file.path.split("/").pop()}" ${action.toLowerCase()} here` });
      if (fileClipboard.mode === "cut") fileClipboard = null;
    }
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  // Separator rendered as a thin line
  const SEP = "---";

  type MenuItem = { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean; shortcut?: string; disabled?: boolean } | typeof SEP;

  const items: MenuItem[] = [
    ...(file.isComplete ? [
      { icon: Download, label: "Download", onClick: handleDownload },
      { icon: copying ? Loader2 : Link2, label: "Copy Download Link", onClick: handleCopyLink },
    ] : []) as MenuItem[],
    ...(isMedia ? [
      { icon: PlayCircle, label: isVideo ? "Play Video" : isImage ? "View Image" : "Play Audio", onClick: () => { onPreview(); onClose(); } },
    ] : []) as MenuItem[],
    SEP,
    { icon: Edit3, label: "Rename", onClick: handleRename },
    { icon: Copy, label: "Copy (Ctrl+C)", onClick: handleCopy, shortcut: "Ctrl+C" },
    { icon: Scissors, label: "Cut (Ctrl+X)", onClick: handleCut, shortcut: "Ctrl+X" },
    { icon: ClipboardPaste, label: "Paste Into", onClick: handlePasteInto, disabled: !fileClipboard },
    SEP,
    { icon: Trash2, label: "Delete", onClick: handleDelete, danger: true },
  ];

  // Position adjustment to avoid going off-screen
  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - 400);

  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      <div
        ref={menuRef}
        className="fixed z-[71] min-w-[230px] py-1 rounded-xl border border-border/60 shadow-[0_12px_40px_hsl(220_26%_0%/0.7)] animate-scale-in overflow-hidden"
        style={{ top: adjustedY, left: adjustedX, background: "hsl(220 24% 12%)" }}
      >
        {items.map((item, i) => {
          if (item === SEP) return <div key={`sep-${i}`} className="my-1 mx-3 border-t border-border/30" />;
          const it = item as Exclude<MenuItem, typeof SEP>;
          return (
            <button
              key={i}
              onClick={it.onClick}
              disabled={it.disabled}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                it.danger
                  ? "text-destructive hover:bg-destructive/10"
                  : it.disabled
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-foreground hover:bg-muted/30"
              )}
            >
              <it.icon className={cn("w-4 h-4 shrink-0", copying && it.label === "Copy Download Link" ? "animate-spin" : "")} />
              <span className="flex-1 text-left">{it.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── File row ────────────────────────────────────────────────────────────────
function FileRow({ file, onContextMenu, onPreview }: { file: ApiFile; onContextMenu: (e: React.MouseEvent, file: ApiFile) => void; onPreview: (file: ApiFile) => void }) {
  const { toast } = useToast();
  const [streaming, setStreaming] = useState(false);
  const [streamCopied, setStreamCopied] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const mimeColor = file.mimeType?.startsWith("video/") ? "border-l-info"
    : file.mimeType?.startsWith("image/") ? "border-l-success"
    : "border-l-border";

  const fname = file.path.split("/").pop()?.toLowerCase() ?? "";
  const fext = fname.split(".").pop() ?? "";
  const vidExts = ["mp4","mkv","avi","webm","mov","flv","wmv","m4v","ts","mpg","mpeg","3gp"];
  const audExts = ["mp3","flac","aac","ogg","wav","wma","m4a","opus"];
  const imgExts = ["jpg","jpeg","png","gif","webp","bmp","svg","ico","tiff"];
  const isStreamable = file.isComplete && (
    file.mimeType?.startsWith("video/") || vidExts.includes(fext) ||
    file.mimeType?.startsWith("audio/") || audExts.includes(fext) ||
    file.mimeType?.startsWith("image/") || imgExts.includes(fext)
  );

  const handleDownload = () => {
    const url = filesApi.downloadUrl(file.id);
    window.open(url, "_blank", "noopener");
  };

  const handleStream = async () => {
    setStreaming(true);
    try {
      const { url } = await filesApi.getSignedUrl(file.id, 21600);
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
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 hover:-translate-y-px hover:bg-muted/10 group transition-all duration-150 border-b border-border/30 last:border-0 border-l-2 cursor-pointer",
        mimeColor,
      )}
      onClick={() => {
        if (isStreamable) onPreview(file);
        else handleDownload();
      }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, file); }}
    >
      <div className="w-4 shrink-0" />
      <FileTypeIcon mimeType={file.mimeType} />
      <span className="flex-1 min-w-0 text-sm text-foreground truncate" title={file.path}>
        {filename}
      </span>
      {isStreamable && (
        <span className="text-xs text-info/60 hidden sm:block shrink-0">
          {file.mimeType?.startsWith("video/") ? "▶ Click to play" : file.mimeType?.startsWith("image/") ? "🖼 Click to view" : "♪ Click to play"}
        </span>
      )}
      {!file.isComplete && file.sizeBytes > 0 && (
        <span className="text-xs text-warning font-semibold shrink-0">Incomplete</span>
      )}
      <span className="text-xs text-muted-foreground w-20 text-right shrink-0 tabular-nums">
        {file.sizeBytes > 0 ? formatBytes(file.sizeBytes) : "—"}
      </span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        {/* Preview button — media only */}
        {isStreamable && (
          <button
            className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border border-info/30 text-info hover:bg-info/10 hover:border-info/50 transition-all font-medium"
            onClick={() => onPreview(file)}
            title="Preview media"
          >
            <PlayCircle className="w-3 h-3" />
            Preview
          </button>
        )}
        {/* Stream button — video/audio only */}
        {isStreamable && !file.mimeType?.startsWith("image/") && (
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
          disabled={!file.isComplete}
        >
          <Download className="w-3 h-3" />
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

function FolderTreeNode({ node, depth = 0, onContextMenu, onPreview }: { node: FolderNode; depth?: number; onContextMenu: (e: React.MouseEvent, file: ApiFile) => void; onPreview: (file: ApiFile) => void }) {
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
          ? <FolderTreeNode key={child.name + i} node={child} depth={depth + 1} onContextMenu={onContextMenu} onPreview={onPreview} />
          : <div key={(child as ApiFile).id} style={{ paddingLeft: `${depth * 20}px` }}><FileRow file={child as ApiFile} onContextMenu={onContextMenu} onPreview={onPreview} /></div>
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
  const { isLoading: authLoading, isAuthenticated } = useAuthGuard();

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      return ["downloading","uploading","metadata_fetch","submitted","queued","scanning"].includes(d.status) ? 10_000 : false;
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

  const isActive = job ? ["downloading","uploading","metadata_fetch","submitted","queued","scanning"].includes(job.status) : false;
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

  const [zipping, setZipping] = useState(false);
  const [fileCtxMenu, setFileCtxMenu] = useState<{ x: number; y: number; file: ApiFile } | null>(null);
  const [previewFile, setPreviewFile] = useState<ApiFile | null>(null);
  const handleDownloadZip = useCallback(async () => {
    if (!filesData?.files?.length || !liveJob) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      // Fetch each file and add to ZIP
      for (const file of filesData.files) {
        if (!file.isComplete) continue;
        const url = filesApi.downloadUrl(file.id);
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) continue;
        const blob = await res.blob();
        zip.file(file.path, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${liveJob.name}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "ZIP download started ⚡" });
    } catch (err) {
      toast({ title: "ZIP failed", description: String(err), variant: "destructive" });
    } finally {
      setZipping(false);
    }
  }, [filesData, liveJob, toast]);

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

                {liveJob.status === "scanning" && (
                  <div className="mt-4 p-4 bg-info/5 border border-info/30 rounded-xl flex items-center gap-3">
                    <ScanSearch className="w-5 h-5 text-info animate-pulse shrink-0" style={{ filter: "drop-shadow(0 0 6px hsl(199 89% 48% / 0.5))" }} />
                    <div>
                      <p className="text-sm font-semibold text-info">Scanning for viruses…</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Download complete. Files are being scanned before they become available.</p>
                    </div>
                    <Loader2 className="w-4 h-4 text-info animate-spin ml-auto shrink-0" />
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
                  {/* Completed banner with scan status */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-success/20 bg-success/5">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" style={{ filter: "drop-shadow(0 0 4px hsl(142 71% 45%))" }} />
                    <h2 className="text-sm font-bold text-success">Download complete</h2>

                    {/* Virus scan badge */}
                    {liveJob.scanStatus === "clean" && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-success/10 border border-success/30 text-success">
                        <ShieldCheck className="w-3 h-3" /> Virus-free
                      </span>
                    )}
                    {liveJob.scanStatus === "scanning" && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-info/10 border border-info/30 text-info">
                        <ScanSearch className="w-3 h-3 animate-pulse" /> Scanning…
                      </span>
                    )}
                    {liveJob.scanStatus === "error" && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/10 border border-warning/30 text-warning" title={liveJob.scanDetail ?? "Scan error"}>
                        <ShieldQuestion className="w-3 h-3" /> Scan unavailable
                      </span>
                    )}
                    {liveJob.scanStatus === "infected" && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/30 text-destructive" title={liveJob.scanDetail ?? ""}>
                        <ShieldAlert className="w-3 h-3" /> Threat detected
                      </span>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                      {filesData && filesData.files.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                          onClick={handleDownloadZip}
                          disabled={zipping}
                        >
                          {zipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderArchive className="w-3 h-3" />}
                          {zipping ? "Zipping…" : "Download ZIP"}
                        </Button>
                      )}
                      {filesData && (
                        <span className="text-xs text-muted-foreground">
                          {filesData.files.length} file{filesData.files.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
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
                        ? <FolderTreeNode key={child.name + i} node={child} onContextMenu={(e, f) => { setFileCtxMenu({ x: e.clientX, y: e.clientY, file: f }); }} onPreview={(f) => setPreviewFile(f)} />
                        : <FileRow key={(child as ApiFile).id} file={child as ApiFile} onContextMenu={(e, f) => { setFileCtxMenu({ x: e.clientX, y: e.clientY, file: f }); }} onPreview={(f) => setPreviewFile(f)} />
                    ))
                  ) : null}
                </div>
              )}
            </>
          )}
        </main>

        {/* File context menu */}
        {fileCtxMenu && (
          <FileContextMenu
            x={fileCtxMenu.x}
            y={fileCtxMenu.y}
            file={fileCtxMenu.file}
            onClose={() => setFileCtxMenu(null)}
            onPreview={() => setPreviewFile(fileCtxMenu.file)}
            onDelete={() => {
              filesApi.delete(fileCtxMenu.file.id).then(() => {
                toast({ title: "File deleted" });
                queryClient.invalidateQueries({ queryKey: ["job-files", jobId] });
              }).catch(err => {
                toast({ title: "Delete failed", description: err instanceof ApiError ? err.message : String(err), variant: "destructive" });
              });
            }}
          />
        )}

        {/* Media preview modal */}
        {previewFile && (
           <MediaPlayer
            file={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </div>
    </div>
  );
}
