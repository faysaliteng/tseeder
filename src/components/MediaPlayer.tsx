import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { files as filesApi, type ApiFile } from "@/lib/api";
import {
  X, Loader2, AlertCircle, Play, Pause,
  Volume2, VolumeX, Volume1, Maximize2, Minimize2,
  Subtitles, Search, Upload, Monitor,
  PlayCircle, Image as ImageIcon, Zap,
  SkipBack, SkipForward, Settings, Copy, Check,
  PictureInPicture2, Download, RotateCcw,
  Camera, Repeat, Scissors, ChevronDown,
  Rewind, FastForward, Layers,
} from "lucide-react";

// ── Format detection ──────────────────────────────────────────────────────
const VIDEO_EXTS = new Set(["mp4","webm","mov","m4v","ogv"]);
const VIDEO_MAYBE = new Set(["mkv","avi","flv","wmv","ts","mpg","mpeg","3gp"]);
const IMAGE_EXTS = new Set(["jpg","jpeg","png","gif","webp","bmp","svg","ico","tiff","avif"]);
const AUDIO_EXTS = new Set(["mp3","flac","aac","ogg","wav","wma","m4a","opus"]);
const SUBTITLE_EXTS = new Set(["srt","vtt","ass","ssa","sub"]);

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

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3];

// Detect resolution from filename
function detectResolution(name: string): string | null {
  const m = name.match(/(2160p|4k|uhd|1080p|720p|480p|360p)/i);
  return m ? m[1].toUpperCase().replace("4K","2160P").replace("UHD","2160P") : null;
}

const QUALITY_OPTIONS = ["2160P","1080P","720P","480P","360P","AUTO"];

// ── Floating Panel ────────────────────────────────────────────────────────
function FloatingPanel({ children, onClose, title, width = "w-64" }: { children: React.ReactNode; onClose: () => void; title: string; width?: string }) {
  return (
    <>
      <div className="fixed inset-0 z-[82]" onClick={onClose} />
      <div className={cn("absolute right-0 bottom-14 z-[83] rounded-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden", width)}
        style={{ background: "rgba(12,12,18,0.97)", backdropFilter: "blur(24px)", animation: "scale-in 0.15s ease-out" }}>
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-white/80 uppercase tracking-[0.15em]">{title}</span>
        </div>
        {children}
      </div>
    </>
  );
}

// ── Subtitle Panel ────────────────────────────────────────────────────────
function SubtitlePanel({
  subtitleUrl, subtitleLabel, showSubText, subSyncSec,
  onToggleSubs, onSyncChange, onFileUpload, onSearchSubs, onClose,
}: {
  subtitleUrl: string | null; subtitleLabel: string; showSubText: boolean; subSyncSec: number;
  onToggleSubs: () => void; onSyncChange: (v: number) => void;
  onFileUpload: () => void; onSearchSubs: () => void; onClose: () => void;
}) {
  return (
    <FloatingPanel onClose={onClose} title="Subtitles / Captions" width="w-72">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <span className="text-[11px] text-white/40 font-semibold">Sync offset</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onSyncChange(subSyncSec - 0.5)} className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors">−</button>
          <span className="w-12 text-center text-xs text-white font-mono">{subSyncSec > 0 ? "+" : ""}{subSyncSec}s</span>
          <button onClick={() => onSyncChange(subSyncSec + 0.5)} className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors">+</button>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <button onClick={onFileUpload} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all">
          <Upload className="w-3 h-3" /> Upload .srt / .vtt
        </button>
        <button onClick={onSearchSubs} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all">
          <Search className="w-3 h-3" /> OpenSubtitles
        </button>
      </div>
      <div className="px-4 py-2.5">
        {subtitleUrl ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-white truncate flex-1">{subtitleLabel}</span>
            <button onClick={onToggleSubs} className={cn("text-[11px] px-2 py-0.5 rounded-md transition-all", showSubText ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400")}>
              {showSubText ? "Hide" : "Show"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/30 italic">No subtitles loaded — upload or search above</p>
        )}
      </div>
    </FloatingPanel>
  );
}

// ── Settings Panel (speed + quality + loop) ───────────────────────────────
function SettingsPanel({ speed, onSpeedChange, quality, onQualityChange, loop, onLoopToggle, onClose }: {
  speed: number; onSpeedChange: (s: number) => void;
  quality: string; onQualityChange: (q: string) => void;
  loop: boolean; onLoopToggle: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"speed" | "quality">("speed");
  return (
    <FloatingPanel onClose={onClose} title="Settings" width="w-60">
      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <button onClick={() => setTab("speed")} className={cn("flex-1 py-2 text-[11px] font-bold transition-colors", tab === "speed" ? "text-white border-b-2 border-red-500" : "text-white/40 hover:text-white/70")}>Speed</button>
        <button onClick={() => setTab("quality")} className={cn("flex-1 py-2 text-[11px] font-bold transition-colors", tab === "quality" ? "text-white border-b-2 border-red-500" : "text-white/40 hover:text-white/70")}>Quality</button>
      </div>

      {tab === "speed" && (
        <div className="py-1 max-h-64 overflow-y-auto">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => { onSpeedChange(s); }}
              className={cn(
                "w-full text-left px-4 py-2 text-[13px] transition-all",
                s === speed ? "text-red-400 bg-red-500/10 font-bold" : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              {s === 1 ? "Normal" : `${s}×`}
              {s === speed && <span className="float-right">✓</span>}
            </button>
          ))}
        </div>
      )}

      {tab === "quality" && (
        <div className="py-1">
          {QUALITY_OPTIONS.map(q => (
            <button
              key={q}
              onClick={() => { onQualityChange(q); }}
              className={cn(
                "w-full text-left px-4 py-2 text-[13px] transition-all",
                q === quality ? "text-red-400 bg-red-500/10 font-bold" : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              {q === "AUTO" ? "Auto" : q}
              {q === quality && <span className="float-right">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Loop toggle */}
      <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
        <span className="text-[11px] text-white/50 font-semibold">Loop</span>
        <button onClick={onLoopToggle}
          className={cn("w-9 h-5 rounded-full relative transition-all", loop ? "bg-red-500" : "bg-white/10")}
        >
          <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", loop ? "left-[18px]" : "left-0.5")} />
        </button>
      </div>
    </FloatingPanel>
  );
}

// ── Custom Progress Bar ───────────────────────────────────────────────────
function ProgressBar({
  currentTime, duration, buffered, abLoop,
  onSeek, onDragStart,
}: {
  currentTime: number; duration: number; buffered: number;
  abLoop: { a: number | null; b: number | null };
  onSeek: (pct: number) => void;
  onDragStart: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const pctPlayed = duration ? (currentTime / duration) * 100 : 0;
  const pctBuffered = buffered * 100;

  const handleClick = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  return (
    <div className="px-3 pt-5 pb-1 group/progress">
      <div
        ref={ref}
        className="relative h-[5px] bg-white/10 rounded-full cursor-pointer group-hover/progress:h-[7px] transition-all duration-200"
        onClick={handleClick}
        onMouseDown={(e) => { onDragStart(); handleClick(e); }}
        onMouseMove={(e) => {
          if (!ref.current || !duration) return;
          const rect = ref.current.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          setHoverTime(pct * duration);
          setHoverX(e.clientX - rect.left);
        }}
        onMouseLeave={() => setHoverTime(null)}
      >
        {/* A-B loop markers */}
        {abLoop.a !== null && duration > 0 && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10" style={{ left: `${(abLoop.a / duration) * 100}%` }} />
        )}
        {abLoop.b !== null && duration > 0 && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10" style={{ left: `${(abLoop.b / duration) * 100}%` }} />
        )}
        {abLoop.a !== null && abLoop.b !== null && duration > 0 && (
          <div className="absolute top-0 bottom-0 bg-yellow-400/15 z-[5]"
            style={{ left: `${(abLoop.a / duration) * 100}%`, width: `${((abLoop.b - abLoop.a) / duration) * 100}%` }} />
        )}

        {/* Buffered */}
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/15 transition-all" style={{ width: `${pctBuffered}%` }} />
        {/* Played */}
        <div className="absolute inset-y-0 left-0 rounded-full bg-red-500 transition-[width] duration-75" style={{ width: `${pctPlayed}%` }}>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] scale-0 group-hover/progress:scale-100 transition-transform duration-150" style={{ transform: `translate(50%, -50%) scale(${hoverTime !== null ? 1 : 0})` }} />
        </div>
        {/* Scrubber thumb — always visible on hover */}
        <div
          className="absolute top-1/2 w-[14px] h-[14px] rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] opacity-0 group-hover/progress:opacity-100 transition-opacity duration-150 z-20"
          style={{ left: `${pctPlayed}%`, transform: "translate(-50%, -50%)" }}
        />

        {/* Hover tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-10 px-2 py-1 rounded-md text-[11px] text-white font-mono pointer-events-none z-30 shadow-lg"
            style={{ left: `${hoverX}px`, transform: "translateX(-50%)", background: "rgba(0,0,0,0.9)" }}
          >
            {fmtTime(hoverTime)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Volume Slider (custom) ────────────────────────────────────────────────
function VolumeSlider({ volume, muted, onVolumeChange, onToggleMute }: {
  volume: number; muted: boolean; onVolumeChange: (v: number) => void; onToggleMute: () => void;
}) {
  const Icon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const displayVol = muted ? 0 : volume;

  return (
    <div className="flex items-center gap-1 group/vol">
      <button onClick={onToggleMute} className="text-white/70 hover:text-white transition-colors p-1">
        <Icon className="w-[18px] h-[18px]" />
      </button>
      <div className="w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-300">
        <div className="relative w-20 h-5 flex items-center">
          <input
            type="range" min="0" max="1" step="0.01" value={displayVol}
            onChange={e => onVolumeChange(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
          />
          <div className="w-full h-1 rounded-full bg-white/15 relative">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/80 transition-all" style={{ width: `${displayVol * 100}%` }} />
            <div className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow-sm transition-all" style={{ left: `${displayVol * 100}%`, transform: "translate(-50%, -50%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Control Button ────────────────────────────────────────────────────────
function CtrlBtn({ onClick, title, active, children, className: cx, hide }: {
  onClick: () => void; title: string; active?: boolean; children: React.ReactNode; className?: string; hide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "transition-all p-1.5 rounded-lg",
        active ? "text-red-400" : "text-white/50 hover:text-white hover:bg-white/5",
        hide && "hidden sm:flex",
        cx,
      )}
    >
      {children}
    </button>
  );
}

// ── Video Player ──────────────────────────────────────────────────────────
function VideoPlayer({ url, filename, fileId }: { url: string; filename: string; fileId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState(() => detectResolution(filename) ?? "AUTO");
  const [loop, setLoop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCcPanel, setShowCcPanel] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [screenshotMsg, setScreenshotMsg] = useState<string | null>(null);

  // A-B Loop
  const [abLoop, setAbLoop] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });

  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Subtitle state
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [subtitleLabel, setSubtitleLabel] = useState("Off");
  const [subSyncSec, setSubSyncSec] = useState(0);
  const [showSubText, setShowSubText] = useState(true);
  const subFileRef = useRef<HTMLInputElement>(null);

  const isHD = /720p|1080p|2160p|4k|uhd/i.test(filename);

  // Controls auto-hide
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => { if (playing && !isDragging) setShowControls(false); }, 3500);
  }, [playing, isDragging]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, [playing, resetControlsTimer]);

  // Auto-play on load
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => { v.play().catch(() => {}); };
    v.addEventListener("canplay", tryPlay, { once: true });
    return () => v.removeEventListener("canplay", tryPlay);
  }, [url]);

  // Loop attribute
  useEffect(() => {
    if (videoRef.current) videoRef.current.loop = loop;
  }, [loop]);

  // A-B Loop enforcement
  useEffect(() => {
    if (abLoop.a === null || abLoop.b === null) return;
    const v = videoRef.current;
    if (!v) return;
    const check = () => {
      if (v.currentTime >= abLoop.b!) {
        v.currentTime = abLoop.a!;
      }
    };
    v.addEventListener("timeupdate", check);
    return () => v.removeEventListener("timeupdate", check);
  }, [abLoop]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  const seek = useCallback((pct: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.max(0, Math.min(duration, pct * duration));
  }, [duration]);

  const skip = useCallback((sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
  }, [duration]);

  const changeSpeed = useCallback((s: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = s;
    setSpeed(s);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) await el.requestFullscreen().catch(() => {});
    else await document.exitFullscreen().catch(() => {});
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture(); setIsPiP(false);
      } else {
        await v.requestPictureInPicture(); setIsPiP(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLeave = () => setIsPiP(false);
    v.addEventListener("leavepictureinpicture", onLeave);
    return () => v.removeEventListener("leavepictureinpicture", onLeave);
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

  const updateBuffered = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.buffered.length || !duration) return;
    setBuffered(v.buffered.end(v.buffered.length - 1) / duration);
  }, [duration]);

  // Drag seeking
  const handleProgressDrag = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    const bar = container?.querySelector("[data-progress]") as HTMLElement | null;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct);
  }, [seek]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleProgressDrag(e);
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDragging, handleProgressDrag]);

  // Copy stream URL
  const handleCopyUrl = useCallback(async () => {
    try {
      const { url: streamUrl } = await filesApi.getSignedUrl(fileId, 21600);
      await navigator.clipboard.writeText(streamUrl);
    } catch {
      await navigator.clipboard.writeText(url);
    }
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 3000);
  }, [fileId, url]);

  // Screenshot
  const handleScreenshot = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const link = document.createElement("a");
    link.download = `${filename.replace(/\.[^.]+$/, "")}_${fmtTime(currentTime).replace(/:/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setScreenshotMsg("Screenshot saved!");
    setTimeout(() => setScreenshotMsg(null), 2000);
  }, [filename, currentTime]);

  // A-B Loop toggle
  const handleABLoop = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (abLoop.a === null) {
      setAbLoop({ a: v.currentTime, b: null });
    } else if (abLoop.b === null) {
      setAbLoop(prev => ({ ...prev, b: v.currentTime }));
    } else {
      setAbLoop({ a: null, b: null });
    }
  }, [abLoop]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); skip(e.shiftKey ? -30 : e.ctrlKey ? -5 : -10); break;
        case "ArrowRight": e.preventDefault(); skip(e.shiftKey ? 30 : e.ctrlKey ? 5 : 10); break;
        case "ArrowUp": e.preventDefault(); changeVolume(Math.min(1, volume + 0.05)); break;
        case "ArrowDown": e.preventDefault(); changeVolume(Math.max(0, volume - 0.05)); break;
        case "f": e.preventDefault(); toggleFullscreen(); break;
        case "m": e.preventDefault(); toggleMute(); break;
        case "p": if (!e.ctrlKey) { e.preventDefault(); togglePiP(); } break;
        case "j": e.preventDefault(); skip(-10); break;
        case "l": e.preventDefault(); skip(10); break;
        case "<": e.preventDefault(); skip(-5); break;
        case ">": e.preventDefault(); skip(5); break;
        case "s": if (!e.ctrlKey) { e.preventDefault(); handleScreenshot(); } break;
        case "b": e.preventDefault(); handleABLoop(); break;
        case "0": case "1": case "2": case "3": case "4":
        case "5": case "6": case "7": case "8": case "9":
          e.preventDefault();
          if (duration) { const v = videoRef.current; if (v) v.currentTime = (parseInt(e.key) / 10) * duration; }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, skip, toggleFullscreen, toggleMute, togglePiP, changeVolume, changeSpeed, handleScreenshot, handleABLoop, volume, speed, duration]);

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
      track.kind = "subtitles"; track.label = subtitleLabel; track.srclang = "en";
      track.src = subtitleUrl; track.default = true;
      v.appendChild(track);
      setTimeout(() => { if (v.textTracks[0]) v.textTracks[0].mode = "showing"; }, 100);
    }
  }, [subtitleUrl, showSubText, subtitleLabel, url]);

  // Double-click skip / fullscreen
  const lastClick = useRef<{ time: number; x: number } | null>(null);
  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;

    if (lastClick.current && now - lastClick.current.time < 300) {
      if (pct < 0.3) skip(-10);
      else if (pct > 0.7) skip(10);
      else toggleFullscreen();
      lastClick.current = null;
    } else {
      lastClick.current = { time: now, x: e.clientX };
      setTimeout(() => {
        if (lastClick.current?.time === now) {
          togglePlay();
          lastClick.current = null;
        }
      }, 300);
    }
  }, [skip, togglePlay, toggleFullscreen]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <span className="text-sm text-red-400">{loadError}</span>
        <a href={url} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:underline">Open in new tab</a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 flex items-center justify-center bg-black group/player select-none" onMouseMove={resetControlsTimer} onMouseLeave={() => { if (playing) setShowControls(false); }}>
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        className="w-full max-h-[80vh] cursor-pointer"
        src={url}
        onClick={handleVideoClick}
        onTimeUpdate={() => { setCurrentTime(videoRef.current?.currentTime ?? 0); updateBuffered(); }}
        onLoadedMetadata={() => { setDuration(videoRef.current?.duration ?? 0); setIsBuffering(false); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onProgress={updateBuffered}
        onError={() => setLoadError("Could not play video. Try opening in a new tab or use VLC.")}
      />

      {/* Buffering spinner */}
      {isBuffering && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
            <Loader2 className="w-9 h-9 text-white animate-spin" />
          </div>
        </div>
      )}

      {/* Large center play button */}
      {!playing && !isBuffering && duration > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.08)]"
            style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}>
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Screenshot toast */}
      {screenshotMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg text-sm text-white font-bold shadow-lg"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", animation: "slide-up-fade 0.3s ease-out" }}>
          <Camera className="w-4 h-4 inline mr-2" />{screenshotMsg}
        </div>
      )}

      {/* A-B Loop indicator */}
      {(abLoop.a !== null) && (
        <div className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-lg text-xs font-bold text-yellow-400 shadow-lg flex items-center gap-1.5"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <Scissors className="w-3.5 h-3.5" />
          A: {fmtTime(abLoop.a)}
          {abLoop.b !== null && <> → B: {fmtTime(abLoop.b)}</>}
        </div>
      )}

      {/* Speed overlay flash */}
      {speed !== 1 && (
        <div className="absolute top-4 left-4 z-30 px-2.5 py-1 rounded-md text-xs font-bold text-yellow-400/80"
          style={{ background: "rgba(0,0,0,0.5)" }}>
          {speed}×
        </div>
      )}

      {/* Hidden subtitle file input */}
      <input ref={subFileRef} type="file" accept=".srt,.vtt,.ass,.ssa,.sub" className="hidden" onChange={handleSubFile} />

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 transition-all duration-300 z-20",
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        )}
        style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.3) 15%, rgba(0,0,0,0.92))" }}
      >
        {/* Progress bar */}
        <div data-progress>
          <ProgressBar
            currentTime={currentTime} duration={duration} buffered={buffered} abLoop={abLoop}
            onSeek={seek} onDragStart={() => setIsDragging(true)}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-white/80 transition-colors p-1.5 hover:scale-110 active:scale-95 transition-transform">
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          {/* Skip */}
          <CtrlBtn onClick={() => skip(-10)} title="Skip -10s (J)" hide><SkipBack className="w-4 h-4" /></CtrlBtn>
          <CtrlBtn onClick={() => skip(10)} title="Skip +10s (L)" hide><SkipForward className="w-4 h-4" /></CtrlBtn>

          {/* Volume */}
          <VolumeSlider volume={volume} muted={muted} onVolumeChange={changeVolume} onToggleMute={toggleMute} />

          {/* Time */}
          <span className="text-[11px] text-white/60 tabular-nums ml-1.5 hidden sm:block font-mono">
            {fmtTime(currentTime)} <span className="text-white/30">/</span> {fmtTime(duration)}
          </span>
          <span className="text-[11px] text-white/60 tabular-nums ml-1 sm:hidden font-mono">{fmtTime(currentTime)}</span>

          <div className="flex-1" />

          {/* Badges */}
          {speed !== 1 && (
            <span className="text-[10px] font-bold text-yellow-400/90 bg-yellow-400/10 rounded px-1.5 py-0.5 hidden sm:block">{speed}×</span>
          )}
          {isHD && (
            <span className="text-[10px] font-bold text-white/80 border border-white/25 rounded px-1.5 py-0.5 hidden sm:block">{detectResolution(filename) || "HD"}</span>
          )}
          {quality !== "AUTO" && (
            <span className="text-[10px] font-bold text-blue-400/90 bg-blue-400/10 rounded px-1.5 py-0.5 hidden sm:block">{quality}</span>
          )}

          {/* Screenshot */}
          <CtrlBtn onClick={handleScreenshot} title="Screenshot (S)" hide><Camera className="w-4 h-4" /></CtrlBtn>

          {/* A-B Loop */}
          <CtrlBtn onClick={handleABLoop} title="A-B Loop (B)" active={abLoop.a !== null} hide>
            <Scissors className="w-4 h-4" />
          </CtrlBtn>

          {/* Copy stream URL */}
          <CtrlBtn onClick={handleCopyUrl} title="Copy stream URL (VLC/Kodi)" active={urlCopied}>
            {urlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </CtrlBtn>

          {/* Subtitles */}
          <div className="relative">
            <CtrlBtn
              onClick={() => { setShowCcPanel(o => !o); setShowSettings(false); }}
              title="Subtitles (C)"
              active={!!(subtitleUrl && showSubText)}
            >
              <Subtitles className="w-[18px] h-[18px]" />
            </CtrlBtn>
            {showCcPanel && (
              <SubtitlePanel
                subtitleUrl={subtitleUrl} subtitleLabel={subtitleLabel} showSubText={showSubText} subSyncSec={subSyncSec}
                onToggleSubs={() => setShowSubText(s => !s)} onSyncChange={setSubSyncSec}
                onFileUpload={() => subFileRef.current?.click()}
                onSearchSubs={() => {
                  const q = encodeURIComponent(filename.replace(/\.[^.]+$/, "").replace(/\./g, " "));
                  window.open(`https://www.opensubtitles.org/en/search/sublanguageid-eng/moviename-${q}`, "_blank");
                }}
                onClose={() => setShowCcPanel(false)}
              />
            )}
          </div>

          {/* Settings */}
          <div className="relative">
            <CtrlBtn onClick={() => { setShowSettings(o => !o); setShowCcPanel(false); }} title="Settings">
              <Settings className="w-[18px] h-[18px]" />
            </CtrlBtn>
            {showSettings && (
              <SettingsPanel
                speed={speed} onSpeedChange={changeSpeed}
                quality={quality} onQualityChange={setQuality}
                loop={loop} onLoopToggle={() => setLoop(l => !l)}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>

          {/* PiP */}
          {'pictureInPictureEnabled' in document && (
            <CtrlBtn onClick={togglePiP} title="Picture in Picture (P)" active={isPiP}>
              <PictureInPicture2 className="w-4 h-4" />
            </CtrlBtn>
          )}

          {/* Open external */}
          <CtrlBtn onClick={() => window.open(url, "_blank")} title="Open in external player" hide>
            <Monitor className="w-4 h-4" />
          </CtrlBtn>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white/50 hover:text-white transition-all p-1.5 rounded-lg hover:bg-white/5 hover:scale-110 active:scale-95">
            {isFullscreen ? <Minimize2 className="w-[18px] h-[18px]" /> : <Maximize2 className="w-[18px] h-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Audio Player (premium) ────────────────────────────────────────────────
function AudioPlayer({ url, filename }: { url: string; filename: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.play().catch(() => {});
  }, [url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
  }, [loop]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  };

  const changeSpeed = (s: number) => {
    if (audioRef.current) audioRef.current.playbackRate = s;
    setSpeed(s);
  };

  const changeVolume = (v: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = v; setVolume(v);
    if (v > 0 && a.muted) { a.muted = false; setMuted(false); }
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted; setMuted(a.muted);
  };

  const seek = (pct: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = pct * duration;
  };

  const VIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="w-full max-w-xl mx-auto p-8">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Waveform-style visualization placeholder */}
      <div className="flex items-center justify-center mb-6">
        <div className="w-24 h-24 rounded-full flex items-center justify-center border border-white/10"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))", boxShadow: playing ? "0 0 40px rgba(99,102,241,0.3)" : "none", transition: "box-shadow 0.5s" }}>
          <Zap className="w-10 h-10 text-white/70" />
        </div>
      </div>

      <p className="text-sm text-white/80 font-semibold text-center truncate mb-4">{filename}</p>

      {/* Progress */}
      <div className="mb-4">
        <div className="relative h-1.5 bg-white/10 rounded-full cursor-pointer group hover:h-2 transition-all"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seek((e.clientX - rect.left) / rect.width);
          }}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-all" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
          <div className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, transform: "translate(-50%, -50%)" }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-white/40 font-mono">{fmtTime(currentTime)}</span>
          <span className="text-[10px] text-white/40 font-mono">{fmtTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <button onClick={() => { const a = audioRef.current; if (a) a.currentTime = Math.max(0, a.currentTime - 10); }}
          className="text-white/40 hover:text-white p-2 transition-colors"><Rewind className="w-5 h-5" /></button>

        <button onClick={togglePlay}
          className="w-14 h-14 rounded-full flex items-center justify-center border border-white/10 hover:border-white/20 transition-all hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3))" }}>
          {playing ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-0.5" />}
        </button>

        <button onClick={() => { const a = audioRef.current; if (a) a.currentTime = Math.min(duration, a.currentTime + 10); }}
          className="text-white/40 hover:text-white p-2 transition-colors"><FastForward className="w-5 h-5" /></button>
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1">
          <button onClick={toggleMute} className="text-white/40 hover:text-white p-1 transition-colors">
            <VIcon className="w-4 h-4" />
          </button>
          <input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume}
            onChange={e => changeVolume(Number(e.target.value))}
            className="w-16 h-1 accent-white cursor-pointer" />
        </div>

        <button onClick={() => changeSpeed(speed >= 2 ? 0.5 : speed + 0.25)}
          className="text-[11px] font-bold text-white/50 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors">
          {speed}×
        </button>

        <button onClick={() => setLoop(l => !l)}
          className={cn("p-1 transition-colors", loop ? "text-indigo-400" : "text-white/40 hover:text-white")}>
          <Repeat className="w-4 h-4" />
        </button>
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

  useEffect(() => {
    setMediaUrl(filesApi.downloadUrl(file.id));
  }, [file.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const kindIcon = kind === "video" ? <PlayCircle className="w-4 h-4 text-red-400 shrink-0" />
    : kind === "image" ? <ImageIcon className="w-4 h-4 text-green-400 shrink-0" />
    : kind === "audio" ? <Zap className="w-4 h-4 text-indigo-400 shrink-0" />
    : null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md" onClick={onClose} />
      <div className="fixed inset-0 z-[81] flex items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div className="relative pointer-events-auto w-full max-w-6xl rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.9)] border border-white/5 overflow-hidden flex flex-col"
          style={{ background: "rgba(8,8,14,0.98)", animation: "scale-in 0.2s ease-out" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5">
            {kindIcon}
            <span className="text-sm font-bold text-white/90 truncate flex-1">{filename}</span>

            {/* Download */}
            {mediaUrl && (
              <a href={mediaUrl} download={filename} className="text-white/30 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5" title="Download">
                <Download className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="bg-black min-h-[200px] flex items-center justify-center relative flex-1">
            {!mediaUrl ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span className="text-sm text-white/40">Loading media…</span>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <span className="text-sm text-red-400">{loadError}</span>
                <a href={mediaUrl} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:underline">Open in new tab</a>
              </div>
            ) : (
              <>
                {kind === "video" && <VideoPlayer url={mediaUrl} filename={filename} fileId={file.id} />}
                {kind === "image" && (
                  <img src={mediaUrl} alt={filename} className="w-full max-h-[75vh] object-contain" onError={() => setLoadError("Could not load image.")} />
                )}
                {kind === "audio" && <AudioPlayer url={mediaUrl} filename={filename} />}
                {kind === "unknown" && (
                  <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
                    <AlertCircle className="w-6 h-6 text-white/40" />
                    <span className="text-sm text-white/50">Unsupported format</span>
                    <a href={mediaUrl} download className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                      <Download className="w-3 h-3" /> Download file
                    </a>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer — keyboard shortcuts */}
          {(kind === "video") && mediaUrl && (
            <div className="flex items-center gap-4 px-4 py-1.5 border-t border-white/5 overflow-x-auto">
              <span className="text-[10px] text-white/20 whitespace-nowrap">
                Space: Play · ←→: Skip · ↑↓: Vol · F: Fullscreen · M: Mute · P: PiP · S: Screenshot · B: A-B Loop · &lt;&gt;: Speed
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
