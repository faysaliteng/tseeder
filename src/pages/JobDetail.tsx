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
import {
  ArrowLeft, Pause, Play, X, Download, FolderArchive, Folder, File,
  FileVideo, FileText, FileImage, Loader2, AlertCircle,
  ChevronRight, ChevronDown, RefreshCw,
  Wifi, WifiOff, Users, Gauge, CheckCircle2, Zap, Copy, Check,
  ShieldCheck, ShieldAlert, ShieldQuestion, ScanSearch,
  Link2, Trash2, PlayCircle, Image as ImageIcon,
  Maximize2, Minimize2, Volume2, VolumeX, Subtitles, Search, Upload,
  Monitor, SkipBack, SkipForward,
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

// ── Media Preview Modal ────────────────────────────────────────────────────
function MediaPreviewModal({
  file, onClose,
}: { file: ApiFile; onClose: () => void }) {
  const isVideo = file.mimeType?.startsWith("video/");
  const isImage = file.mimeType?.startsWith("image/");
  const isAudio = file.mimeType?.startsWith("audio/");
  const filename = file.path.split("/").pop() ?? file.path;

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();

  // Subtitle state
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [subtitleLabel, setSubtitleLabel] = useState<string>("Off");
  const [showCcPanel, setShowCcPanel] = useState(false);
  const [subSyncSec, setSubSyncSec] = useState(0);
  const [showSubText, setShowSubText] = useState(true);
  const subFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { url } = await filesApi.getSignedUrl(file.id, 7200);
        if (!cancelled) setMediaUrl(url);
      } catch {
        if (!cancelled) setMediaUrl(filesApi.downloadUrl(file.id));
      }
    })();
    return () => { cancelled = true; };
  }, [file.id]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => { if (playing) setShowControls(false); }, 3000);
  }, [playing]);

  useEffect(() => { resetControlsTimer(); return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); }; }, [playing, resetControlsTimer]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  const seek = (pct: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = pct * duration;
  };

  const skip = (sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    setVolume(val);
    if (val > 0 && v.muted) { v.muted = false; setMuted(false); }
  };

  // Handle subtitle file upload
  const handleSubFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setSubtitleUrl(url);
    setSubtitleLabel(f.name.replace(/\.(srt|vtt|ass|ssa|sub)$/i, ""));
    setShowSubText(true);

    // If SRT, convert to VTT on the fly
    if (f.name.endsWith(".srt")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const srt = ev.target?.result as string;
        const vtt = "WEBVTT\n\n" + srt
          .replace(/\r\n/g, "\n")
          .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
        const blob = new Blob([vtt], { type: "text/vtt" });
        const vttUrl = URL.createObjectURL(blob);
        setSubtitleUrl(vttUrl);
      };
      reader.readAsText(f);
    }
  };

  // Apply subtitle track
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Remove old tracks
    while (v.textTracks.length > 0) {
      const track = v.querySelector("track");
      if (track) track.remove(); else break;
    }
    if (subtitleUrl && showSubText) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = subtitleLabel;
      track.srclang = "en";
      track.src = subtitleUrl;
      track.default = true;
      v.appendChild(track);
      // Force show
      setTimeout(() => {
        if (v.textTracks[0]) v.textTracks[0].mode = "showing";
      }, 100);
    }
  }, [subtitleUrl, showSubText, subtitleLabel, mediaUrl]);

  const fmtTime = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  };

  // Detect HD from filename
  const isHD = /720p|1080p|2160p|4k|uhd/i.test(filename);

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[81] flex items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div
          ref={containerRef}
          className="relative pointer-events-auto w-full max-w-5xl glass-premium rounded-2xl shadow-[0_20px_60px_hsl(220_26%_0%/0.8)] border border-primary/10 animate-scale-in overflow-hidden flex flex-col"
          onMouseMove={resetControlsTimer}
        >
          {/* Header */}
          <div className={cn(
            "flex items-center gap-3 px-4 py-2.5 border-b border-border/40 transition-opacity duration-300",
            isVideo && !showControls && "opacity-0"
          )}>
            {isVideo && <PlayCircle className="w-4 h-4 text-info shrink-0" />}
            {isImage && <ImageIcon className="w-4 h-4 text-success shrink-0" />}
            {isAudio && <Zap className="w-4 h-4 text-warning shrink-0" />}
            <span className="text-sm font-bold text-foreground truncate flex-1">
              Now Playing : {filename}
            </span>

            {/* CC panel toggle for video */}
            {isVideo && mediaUrl && (
              <div className="relative">
                <button
                  onClick={() => setShowCcPanel(o => !o)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all font-bold",
                    subtitleUrl
                      ? "border-info/50 text-info bg-info/10"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
                  )}
                >
                  <Subtitles className="w-3.5 h-3.5" />
                  CC
                </button>

                {showCcPanel && (
                  <>
                    <div className="fixed inset-0 z-[82]" onClick={() => setShowCcPanel(false)} />
                    <div className="absolute right-0 top-9 z-[83] w-72 rounded-xl border border-border/60 shadow-[0_12px_40px_hsl(220_26%_0%/0.7)] animate-scale-in overflow-hidden"
                      style={{ background: "hsl(220 24% 12%)" }}>
                      {/* Sync control */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30">
                        <span className="text-xs text-muted-foreground font-semibold">sync (sec)</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSubSyncSec(s => s - 0.5)} className="w-6 h-6 flex items-center justify-center rounded border border-border text-xs text-muted-foreground hover:text-foreground">−</button>
                          <input
                            type="number"
                            value={subSyncSec}
                            onChange={e => setSubSyncSec(Number(e.target.value))}
                            className="w-14 bg-input/60 border border-border/60 rounded px-2 py-1 text-xs text-center text-foreground"
                            step="0.5"
                          />
                          <button onClick={() => setSubSyncSec(s => s + 0.5)} className="w-6 h-6 flex items-center justify-center rounded border border-border text-xs text-muted-foreground hover:text-foreground">+</button>
                        </div>
                      </div>

                      {/* Add / Search buttons */}
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
                        <button
                          onClick={() => subFileRef.current?.click()}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-info text-white hover:bg-info/90 transition-colors"
                        >
                          <Upload className="w-3 h-3" /> Add
                        </button>
                        <div className="w-px h-5 bg-border/40" />
                        <button
                          onClick={() => {
                            // Open OpenSubtitles search with the filename
                            const q = encodeURIComponent(filename.replace(/\.[^.]+$/, "").replace(/\./g, " "));
                            window.open(`https://www.opensubtitles.org/en/search/sublanguageid-eng/moviename-${q}`, "_blank");
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-info text-white hover:bg-info/90 transition-colors"
                        >
                          <Search className="w-3 h-3" /> Search
                        </button>
                      </div>

                      {/* Current subtitle / hide */}
                      <div className="px-4 py-2.5">
                        {subtitleUrl ? (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground truncate flex-1">{subtitleLabel}</span>
                            <button
                              onClick={() => { setShowSubText(s => !s); }}
                              className="text-xs text-muted-foreground hover:text-foreground ml-2"
                            >
                              {showSubText ? "Hide Subs ✕" : "Show Subs"}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No subtitles loaded. Add a .srt or .vtt file.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Hidden file input for subtitle upload */}
          <input ref={subFileRef} type="file" accept=".srt,.vtt,.ass,.ssa,.sub" className="hidden" onChange={handleSubFile} />

          {/* Content */}
          <div className="bg-black min-h-[200px] flex items-center justify-center relative flex-1">
            {!mediaUrl ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">Loading media…</span>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <span className="text-sm text-destructive">{loadError}</span>
                <a href={mediaUrl} target="_blank" rel="noopener" className="text-xs text-primary hover:underline">Open in new tab</a>
              </div>
            ) : (
              <>
                {isVideo && (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full max-h-[75vh] cursor-pointer"
                      src={mediaUrl}
                      onClick={togglePlay}
                      onDoubleClick={toggleFullscreen}
                      onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                      onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onError={() => setLoadError("Could not play video. Try opening in a new tab.")}
                      crossOrigin="anonymous"
                    />

                    {/* Custom controls overlay */}
                    <div className={cn(
                      "absolute bottom-0 left-0 right-0 transition-opacity duration-300",
                      showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                      style={{ background: "linear-gradient(transparent, hsl(0 0% 0% / 0.85))" }}
                    >
                      {/* Progress bar */}
                      <div className="px-3 pt-4">
                        <div
                          className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group hover:h-2.5 transition-all"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            seek((e.clientX - rect.left) / rect.width);
                          }}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-destructive"
                            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                          />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-destructive shadow-[0_0_4px_hsl(0_72%_51%)] opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, transform: "translate(-50%, -50%)" }}
                          />
                        </div>
                      </div>

                      {/* Controls row */}
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button onClick={togglePlay} className="text-white hover:text-white/80 transition-colors">
                          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>
                        <button onClick={toggleMute} className="text-white hover:text-white/80 transition-colors">
                          {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input
                          type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                          onChange={e => changeVolume(Number(e.target.value))}
                          className="w-16 h-1 accent-white cursor-pointer"
                        />
                        <span className="text-xs text-white/80 tabular-nums ml-1">
                          {fmtTime(currentTime)} / {fmtTime(duration)}
                        </span>

                        <div className="flex-1" />

                        {/* HD badge */}
                        {isHD && (
                          <span className="text-xs font-bold text-white/90 border border-white/40 rounded px-1.5 py-0.5">
                            HD
                          </span>
                        )}

                        {/* CC button */}
                        <button
                          onClick={() => setShowCcPanel(o => !o)}
                          className={cn(
                            "text-white/80 hover:text-white transition-colors relative",
                            subtitleUrl && showSubText && "text-white"
                          )}
                          title="Subtitles / CC"
                        >
                          <Subtitles className="w-5 h-5" />
                          {subtitleUrl && showSubText && (
                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-destructive rounded-full" />
                          )}
                        </button>

                        {/* Cast button */}
                        <button
                          onClick={() => {
                            if (mediaUrl) {
                              window.open(mediaUrl, "_blank");
                            }
                          }}
                          className="text-white/80 hover:text-white transition-colors"
                          title="Cast / Open in external player"
                        >
                          <Monitor className="w-4.5 h-4.5" />
                        </button>

                        {/* Fullscreen */}
                        <button onClick={toggleFullscreen} className="text-white/80 hover:text-white transition-colors">
                          {isFullscreen ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {isImage && (
                  <img
                    src={mediaUrl}
                    alt={filename}
                    className="w-full max-h-[70vh] object-contain"
                    onError={() => setLoadError("Could not load image.")}
                  />
                )}
                {isAudio && (
                  <div className="p-8 flex items-center justify-center w-full">
                    <audio controls autoPlay src={mediaUrl} className="w-full max-w-lg"
                      onError={() => setLoadError("Could not play audio.")}>
                      Your browser does not support the audio tag.
                    </audio>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── File Context Menu ─────────────────────────────────────────────────────
function FileContextMenu({
  x, y, file, onClose, onPreview,
}: {
  x: number; y: number; file: ApiFile;
  onClose: () => void;
  onPreview: () => void;
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

  const isMedia = file.mimeType?.startsWith("video/") || file.mimeType?.startsWith("image/") || file.mimeType?.startsWith("audio/");

  const handleDownload = () => {
    const url = filesApi.downloadUrl(file.id);
    window.open(url, "_blank", "noopener");
    onClose();
  };

  const handleCopyLink = async () => {
    setCopying(true);
    try {
      // Get a 6-hour signed URL for public sharing
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

  const items = [
    ...(file.isComplete ? [
      { icon: Download, label: "Download", onClick: handleDownload },
      { icon: copying ? Loader2 : Link2, label: "Copy Download Link", onClick: handleCopyLink },
    ] : []),
    ...(isMedia && file.isComplete ? [
      { icon: PlayCircle, label: file.mimeType?.startsWith("video/") ? "Play Video" : file.mimeType?.startsWith("image/") ? "View Image" : "Play Audio", onClick: () => { onPreview(); onClose(); } },
    ] : []),
    ...(file.isComplete ? [
      { icon: Trash2, label: "Delete", onClick: () => { onClose(); }, danger: true },
    ] : []),
  ];

  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      <div
        ref={menuRef}
        className="fixed z-[71] min-w-[220px] py-1.5 rounded-xl border border-border/60 shadow-[0_12px_40px_hsl(220_26%_0%/0.7)] animate-scale-in overflow-hidden"
        style={{ top: y, left: x, background: "hsl(220 24% 12%)" }}
      >
        {items.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
              (item as any).danger
                ? "text-destructive hover:bg-destructive/10"
                : "text-foreground hover:bg-muted/30"
            )}
          >
            <item.icon className={cn("w-4 h-4 shrink-0", (item as any).danger ? "" : copying && item.label === "Copy Download Link" ? "animate-spin" : "")} />
            {item.label}
          </button>
        ))}
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

  const isStreamable = file.isComplete && (
    file.mimeType?.startsWith("video/") ||
    file.mimeType?.startsWith("audio/") ||
    file.mimeType?.startsWith("image/")
  );

  const handleDownload = () => {
    const url = filesApi.downloadUrl(file.id);
    window.open(url, "_blank", "noopener");
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
          />
        )}

        {/* Media preview modal */}
        {previewFile && (
          <MediaPreviewModal
            file={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </div>
    </div>
  );
}
