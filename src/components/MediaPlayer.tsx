import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { files as filesApi, type ApiFile } from "@/lib/api";
import {
  X, Loader2, AlertCircle, Play, Pause,
  Volume2, VolumeX, Maximize2, Minimize2,
  Subtitles, Search, Upload, Monitor,
  PlayCircle, Image as ImageIcon, Zap,
} from "lucide-react";

// ── Format detection ──────────────────────────────────────────────────────
const VIDEO_EXTS = new Set(["mp4","webm","mov","m4v","ogv"]);
const VIDEO_MAYBE = new Set(["mkv","avi","flv","wmv","ts","mpg","mpeg","3gp"]);
const IMAGE_EXTS = new Set(["jpg","jpeg","png","gif","webp","bmp","svg","ico","tiff","avif"]);
const AUDIO_EXTS = new Set(["mp3","flac","aac","ogg","wav","wma","m4a","opus"]);

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

type MediaKind = "video" | "image" | "audio" | "unknown";

function detectKind(file: ApiFile): MediaKind {
  const ext = getExt(file.path);
  if (file.mimeType?.startsWith("video/") || VIDEO_EXTS.has(ext) || VIDEO_MAYBE.has(ext)) return "video";
  if (file.mimeType?.startsWith("image/") || IMAGE_EXTS.has(ext)) return "image";
  if (file.mimeType?.startsWith("audio/") || AUDIO_EXTS.has(ext)) return "audio";
  return "unknown";
}

// ── Time formatting ───────────────────────────────────────────────────────
function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

// ── Subtitle Panel ────────────────────────────────────────────────────────
function SubtitlePanel({
  subtitleUrl,
  subtitleLabel,
  showSubText,
  subSyncSec,
  onToggleSubs,
  onSyncChange,
  onFileUpload,
  onSearchSubs,
  onClose,
}: {
  subtitleUrl: string | null;
  subtitleLabel: string;
  showSubText: boolean;
  subSyncSec: number;
  onToggleSubs: () => void;
  onSyncChange: (v: number) => void;
  onFileUpload: () => void;
  onSearchSubs: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[82]" onClick={onClose} />
      <div
        className="absolute right-0 top-9 z-[83] w-72 rounded-xl border border-border/60 shadow-[0_12px_40px_hsl(220_26%_0%/0.7)] animate-scale-in overflow-hidden"
        style={{ background: "hsl(220 24% 12%)" }}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30">
          <span className="text-xs text-muted-foreground font-semibold">sync (sec)</span>
          <div className="flex items-center gap-1">
            <button onClick={() => onSyncChange(subSyncSec - 0.5)} className="w-6 h-6 flex items-center justify-center rounded border border-border text-xs text-muted-foreground hover:text-foreground">−</button>
            <input
              type="number"
              value={subSyncSec}
              onChange={e => onSyncChange(Number(e.target.value))}
              className="w-14 bg-input/60 border border-border/60 rounded px-2 py-1 text-xs text-center text-foreground"
              step="0.5"
            />
            <button onClick={() => onSyncChange(subSyncSec + 0.5)} className="w-6 h-6 flex items-center justify-center rounded border border-border text-xs text-muted-foreground hover:text-foreground">+</button>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
          <button onClick={onFileUpload} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-info text-white hover:bg-info/90 transition-colors">
            <Upload className="w-3 h-3" /> Add
          </button>
          <div className="w-px h-5 bg-border/40" />
          <button onClick={onSearchSubs} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-info text-white hover:bg-info/90 transition-colors">
            <Search className="w-3 h-3" /> Search
          </button>
        </div>
        <div className="px-4 py-2.5">
          {subtitleUrl ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground truncate flex-1">{subtitleLabel}</span>
              <button onClick={onToggleSubs} className="text-xs text-muted-foreground hover:text-foreground ml-2">
                {showSubText ? "Hide Subs ✕" : "Show Subs"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No subtitles loaded. Add a .srt or .vtt file.</p>
          )}
        </div>
      </div>
    </>
  );
}

// ── Video Player ──────────────────────────────────────────────────────────
function VideoPlayer({ url, filename }: { url: string; filename: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Subtitle state
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [subtitleLabel, setSubtitleLabel] = useState("Off");
  const [showCcPanel, setShowCcPanel] = useState(false);
  const [subSyncSec, setSubSyncSec] = useState(0);
  const [showSubText, setShowSubText] = useState(true);
  const subFileRef = useRef<HTMLInputElement>(null);

  const isHD = /720p|1080p|2160p|4k|uhd/i.test(filename);

  // Controls auto-hide
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => { if (playing) setShowControls(false); }, 3000);
  }, [playing]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, [playing, resetControlsTimer]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
  }, []);

  const seek = useCallback((pct: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = pct * duration;
  }, [duration]);

  const skip = useCallback((sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
  }, [duration]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const changeVolume = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    setVolume(val);
    if (val > 0 && v.muted) { v.muted = false; setMuted(false); }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); skip(-10); break;
        case "ArrowRight": e.preventDefault(); skip(10); break;
        case "ArrowUp": e.preventDefault(); changeVolume(Math.min(1, volume + 0.1)); break;
        case "ArrowDown": e.preventDefault(); changeVolume(Math.max(0, volume - 0.1)); break;
        case "f": e.preventDefault(); toggleFullscreen(); break;
        case "m": e.preventDefault(); toggleMute(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, skip, toggleFullscreen, toggleMute, changeVolume, volume]);

  // Subtitle file upload
  const handleSubFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSubtitleLabel(f.name.replace(/\.(srt|vtt|ass|ssa|sub)$/i, ""));
    setShowSubText(true);

    if (f.name.endsWith(".srt")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const srt = ev.target?.result as string;
        const vtt = "WEBVTT\n\n" + srt.replace(/\r\n/g, "\n").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
        setSubtitleUrl(URL.createObjectURL(new Blob([vtt], { type: "text/vtt" })));
      };
      reader.readAsText(f);
    } else {
      setSubtitleUrl(URL.createObjectURL(f));
    }
  };

  // Apply subtitle track
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    while (v.querySelector("track")) v.querySelector("track")!.remove();
    if (subtitleUrl && showSubText) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = subtitleLabel;
      track.srclang = "en";
      track.src = subtitleUrl;
      track.default = true;
      v.appendChild(track);
      setTimeout(() => { if (v.textTracks[0]) v.textTracks[0].mode = "showing"; }, 100);
    }
  }, [subtitleUrl, showSubText, subtitleLabel, url]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <span className="text-sm text-destructive">{loadError}</span>
        <a href={url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline">Open in new tab</a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 flex items-center justify-center bg-black" onMouseMove={resetControlsTimer}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full max-h-[75vh] cursor-pointer"
        src={url}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setLoadError("Could not play video. Try opening in a new tab.")}
      />

      {/* Hidden subtitle file input */}
      <input ref={subFileRef} type="file" accept=".srt,.vtt,.ass,.ssa,.sub" className="hidden" onChange={handleSubFile} />

      {/* Controls overlay */}
      <div
        className={cn(
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
            <div className="absolute inset-y-0 left-0 rounded-full bg-destructive" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
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

          {isHD && (
            <span className="text-xs font-bold text-white/90 border border-white/40 rounded px-1.5 py-0.5">HD</span>
          )}

          {/* CC */}
          <div className="relative">
            <button
              onClick={() => setShowCcPanel(o => !o)}
              className={cn("text-white/80 hover:text-white transition-colors relative", subtitleUrl && showSubText && "text-white")}
              title="Subtitles / CC"
            >
              <Subtitles className="w-5 h-5" />
              {subtitleUrl && showSubText && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-destructive rounded-full" />
              )}
            </button>
            {showCcPanel && (
              <SubtitlePanel
                subtitleUrl={subtitleUrl}
                subtitleLabel={subtitleLabel}
                showSubText={showSubText}
                subSyncSec={subSyncSec}
                onToggleSubs={() => setShowSubText(s => !s)}
                onSyncChange={setSubSyncSec}
                onFileUpload={() => subFileRef.current?.click()}
                onSearchSubs={() => {
                  const q = encodeURIComponent(filename.replace(/\.[^.]+$/, "").replace(/\./g, " "));
                  window.open(`https://www.opensubtitles.org/en/search/sublanguageid-eng/moviename-${q}`, "_blank");
                }}
                onClose={() => setShowCcPanel(false)}
              />
            )}
          </div>

          {/* Cast */}
          <button onClick={() => window.open(url, "_blank")} className="text-white/80 hover:text-white transition-colors" title="Open in external player">
            <Monitor className="w-4.5 h-4.5" />
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white/80 hover:text-white transition-colors">
            {isFullscreen ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main MediaPlayer Component ────────────────────────────────────────────
export function MediaPlayer({ file, onClose }: { file: ApiFile; onClose: () => void }) {
  const filename = file.path.split("/").pop() ?? file.path;
  const kind = detectKind(file);

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Use the cookie-authenticated download URL for in-browser playback.
  // The stream endpoint (token-based, for VLC/Kodi) is handled separately.
  useEffect(() => {
    setMediaUrl(filesApi.downloadUrl(file.id));
  }, [file.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const kindIcon = kind === "video" ? <PlayCircle className="w-4 h-4 text-info shrink-0" />
    : kind === "image" ? <ImageIcon className="w-4 h-4 text-success shrink-0" />
    : kind === "audio" ? <Zap className="w-4 h-4 text-warning shrink-0" />
    : null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[81] flex items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div className="relative pointer-events-auto w-full max-w-5xl glass-premium rounded-2xl shadow-[0_20px_60px_hsl(220_26%_0%/0.8)] border border-primary/10 animate-scale-in overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40">
            {kindIcon}
            <span className="text-sm font-bold text-foreground truncate flex-1">
              Now Playing : {filename}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
                {kind === "video" && <VideoPlayer url={mediaUrl} filename={filename} />}
                {kind === "image" && (
                  <img src={mediaUrl} alt={filename} className="w-full max-h-[70vh] object-contain" onError={() => setLoadError("Could not load image.")} />
                )}
                {kind === "audio" && (
                  <div className="p-8 flex items-center justify-center w-full">
                    <audio controls autoPlay src={mediaUrl} className="w-full max-w-lg" onError={() => setLoadError("Could not play audio.")}>
                      Your browser does not support the audio tag.
                    </audio>
                  </div>
                )}
                {kind === "unknown" && (
                  <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
                    <AlertCircle className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Unsupported format</span>
                    <a href={mediaUrl} target="_blank" rel="noopener" className="text-xs text-primary hover:underline">Download file</a>
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
