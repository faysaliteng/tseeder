import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { files as filesApi, type ApiFile } from "@/lib/api";
import {
  X, Loader2, AlertCircle, Play, Pause,
  Volume2, VolumeX, Volume1, Maximize2, Minimize2,
  Subtitles, Search, Upload, Monitor,
  PlayCircle, Image as ImageIcon, Zap,
  SkipBack, SkipForward, Settings, Copy, Check,
  PictureInPicture2, Download, Gauge, RotateCcw,
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

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

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
    <>
      <div className="fixed inset-0 z-[82]" onClick={onClose} />
      <div className="absolute right-0 bottom-12 z-[83] w-72 rounded-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.8)] animate-scale-in overflow-hidden" style={{ background: "rgba(15,15,20,0.95)", backdropFilter: "blur(20px)" }}>
        <div className="px-4 py-2.5 border-b border-white/5">
          <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Subtitles</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <span className="text-xs text-white/50 font-semibold">Sync (sec)</span>
          <div className="flex items-center gap-1">
            <button onClick={() => onSyncChange(subSyncSec - 0.5)} className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-xs text-white/60 hover:text-white hover:bg-white/10">−</button>
            <input type="number" value={subSyncSec} onChange={e => onSyncChange(Number(e.target.value))} className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-center text-white" step="0.5" />
            <button onClick={() => onSyncChange(subSyncSec + 0.5)} className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-xs text-white/60 hover:text-white hover:bg-white/10">+</button>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <button onClick={onFileUpload} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
            <Upload className="w-3 h-3" /> Upload
          </button>
          <button onClick={onSearchSubs} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
            <Search className="w-3 h-3" /> Search
          </button>
        </div>
        <div className="px-4 py-2.5">
          {subtitleUrl ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-white truncate flex-1">{subtitleLabel}</span>
              <button onClick={onToggleSubs} className="text-xs text-white/50 hover:text-white ml-2">
                {showSubText ? "Hide" : "Show"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/40">No subtitles loaded</p>
          )}
        </div>
      </div>
    </>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────
function SettingsPanel({ speed, onSpeedChange, onClose }: {
  speed: number; onSpeedChange: (s: number) => void; onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[82]" onClick={onClose} />
      <div className="absolute right-0 bottom-12 z-[83] w-56 rounded-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.8)] animate-scale-in overflow-hidden" style={{ background: "rgba(15,15,20,0.95)", backdropFilter: "blur(20px)" }}>
        <div className="px-4 py-2.5 border-b border-white/5">
          <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Playback Speed</span>
        </div>
        <div className="py-1">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => { onSpeedChange(s); onClose(); }}
              className={cn(
                "w-full text-left px-4 py-2 text-sm transition-colors",
                s === speed ? "text-blue-400 bg-blue-500/10 font-bold" : "text-white/70 hover:text-white hover:bg-white/5"
              )}
            >
              {s === 1 ? "Normal" : `${s}x`}
              {s === speed && <span className="float-right text-blue-400">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Video Player ──────────────────────────────────────────────────────────
function VideoPlayer({ url, filename, fileId }: { url: string; filename: string; fileId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
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
  const [showSettings, setShowSettings] = useState(false);
  const [showCcPanel, setShowCcPanel] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [urlCopied, setUrlCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
    controlsTimer.current = setTimeout(() => { if (playing && !isDragging) setShowControls(false); }, 3000);
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
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await v.requestPictureInPicture();
        setIsPiP(true);
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

  // Buffered progress
  const updateBuffered = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.buffered.length || !duration) return;
    setBuffered(v.buffered.end(v.buffered.length - 1) / duration);
  }, [duration]);

  // Progress bar drag
  const handleProgressDrag = useCallback((e: React.MouseEvent | MouseEvent) => {
    const bar = progressRef.current;
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

  // Hover time preview
  const handleProgressHover = useCallback((e: React.MouseEvent) => {
    const bar = progressRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pct * duration);
    setHoverX(e.clientX - rect.left);
  }, [duration]);

  // Copy stream URL
  const handleCopyUrl = useCallback(async () => {
    try {
      const { url: streamUrl } = await filesApi.getSignedUrl(fileId, 21600);
      await navigator.clipboard.writeText(streamUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 3000);
    } catch {
      // Fallback to download URL
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 3000);
    }
  }, [fileId, url]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); skip(e.shiftKey ? -30 : -10); break;
        case "ArrowRight": e.preventDefault(); skip(e.shiftKey ? 30 : 10); break;
        case "ArrowUp": e.preventDefault(); changeVolume(Math.min(1, volume + 0.05)); break;
        case "ArrowDown": e.preventDefault(); changeVolume(Math.max(0, volume - 0.05)); break;
        case "f": e.preventDefault(); toggleFullscreen(); break;
        case "m": e.preventDefault(); toggleMute(); break;
        case "p": e.preventDefault(); togglePiP(); break;
        case "j": e.preventDefault(); skip(-10); break;
        case "l": e.preventDefault(); skip(10); break;
        case ",": e.preventDefault(); if (e.shiftKey) changeSpeed(Math.max(0.25, speed - 0.25)); break;
        case ".": e.preventDefault(); if (e.shiftKey) changeSpeed(Math.min(2, speed + 0.25)); break;
        case "0": case "1": case "2": case "3": case "4":
        case "5": case "6": case "7": case "8": case "9":
          e.preventDefault();
          if (duration) { const v = videoRef.current; if (v) v.currentTime = (parseInt(e.key) / 10) * duration; }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, skip, toggleFullscreen, toggleMute, togglePiP, changeVolume, changeSpeed, volume, speed, duration]);

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

  // Double-click side skip
  const lastClick = useRef<{ time: number; x: number } | null>(null);
  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;

    if (lastClick.current && now - lastClick.current.time < 300) {
      // Double-click — skip based on side
      if (pct < 0.3) skip(-10);
      else if (pct > 0.7) skip(10);
      else toggleFullscreen();
      lastClick.current = null;
    } else {
      lastClick.current = { time: now, x };
      setTimeout(() => {
        if (lastClick.current?.time === now) {
          togglePlay();
          lastClick.current = null;
        }
      }, 300);
    }
  }, [skip, togglePlay, toggleFullscreen]);

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

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
    <div ref={containerRef} className="relative flex-1 flex items-center justify-center bg-black group/player" onMouseMove={resetControlsTimer} onMouseLeave={() => { if (playing) setShowControls(false); }}>
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        className="w-full max-h-[75vh] cursor-pointer select-none"
        src={url}
        onClick={handleVideoClick}
        onTimeUpdate={() => { setCurrentTime(videoRef.current?.currentTime ?? 0); updateBuffered(); }}
        onLoadedMetadata={() => { setDuration(videoRef.current?.duration ?? 0); setIsBuffering(false); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onProgress={updateBuffered}
        onError={() => setLoadError("Could not play video. Try opening in a new tab.")}
      />

      {/* Buffering spinner */}
      {isBuffering && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
      )}

      {/* Large center play button when paused */}
      {!playing && !isBuffering && duration > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            <Play className="w-8 h-8 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Hidden subtitle file input */}
      <input ref={subFileRef} type="file" accept=".srt,.vtt,.ass,.ssa,.sub" className="hidden" onChange={handleSubFile} />

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 transition-all duration-300",
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        )}
        style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.4) 20%, rgba(0,0,0,0.9))" }}
      >
        {/* Progress bar */}
        <div className="px-3 pt-6 pb-1">
          <div
            ref={progressRef}
            className="relative h-1 bg-white/15 rounded-full cursor-pointer group/bar hover:h-2 transition-all"
            onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); seek((e.clientX - rect.left) / rect.width); }}
            onMouseDown={(e) => { setIsDragging(true); handleProgressDrag(e as any); }}
            onMouseMove={handleProgressHover}
            onMouseLeave={() => setHoverTime(null)}
          >
            {/* Buffered */}
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/20" style={{ width: `${buffered * 100}%` }} />
            {/* Played */}
            <div className="absolute inset-y-0 left-0 rounded-full bg-red-500" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
            {/* Scrubber */}
            <div
              className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, transform: "translate(-50%, -50%)" }}
            />
            {/* Hover time tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute -top-9 px-2 py-1 rounded bg-black/90 text-xs text-white font-mono pointer-events-none"
                style={{ left: `${hoverX}px`, transform: "translateX(-50%)" }}
              >
                {fmtTime(hoverTime)}
              </div>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-white/80 transition-colors p-1.5">
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          {/* Skip back/forward */}
          <button onClick={() => skip(-10)} className="text-white/70 hover:text-white transition-colors p-1 hidden sm:block" title="Skip -10s (J)">
            <SkipBack className="w-4 h-4" />
          </button>
          <button onClick={() => skip(10)} className="text-white/70 hover:text-white transition-colors p-1 hidden sm:block" title="Skip +10s (L)">
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Volume */}
          <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors p-1">
            <VolumeIcon className="w-4 h-4" />
          </button>
          <input
            type="range" min="0" max="1" step="0.02" value={muted ? 0 : volume}
            onChange={e => changeVolume(Number(e.target.value))}
            className="w-14 sm:w-20 h-1 accent-white cursor-pointer"
          />

          {/* Time */}
          <span className="text-xs text-white/70 tabular-nums ml-1 hidden sm:block">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>
          <span className="text-xs text-white/70 tabular-nums ml-1 sm:hidden">
            {fmtTime(currentTime)}
          </span>

          <div className="flex-1" />

          {/* Speed badge */}
          {speed !== 1 && (
            <span className="text-xs font-bold text-yellow-400/90 bg-yellow-400/10 rounded px-1.5 py-0.5 hidden sm:block">{speed}x</span>
          )}

          {/* HD badge */}
          {isHD && (
            <span className="text-xs font-bold text-white/90 border border-white/30 rounded px-1.5 py-0.5 hidden sm:block">HD</span>
          )}

          {/* Copy stream URL */}
          <button
            onClick={handleCopyUrl}
            className={cn("transition-colors p-1.5 rounded-lg", urlCopied ? "text-green-400" : "text-white/60 hover:text-white hover:bg-white/5")}
            title="Copy stream URL (for VLC/Kodi)"
          >
            {urlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Subtitles */}
          <div className="relative">
            <button
              onClick={() => { setShowCcPanel(o => !o); setShowSettings(false); }}
              className={cn("text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5", subtitleUrl && showSubText && "text-white")}
              title="Subtitles (C)"
            >
              <Subtitles className="w-4.5 h-4.5" />
              {subtitleUrl && showSubText && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3.5 h-0.5 bg-red-500 rounded-full" />
              )}
            </button>
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

          {/* Settings (speed) */}
          <div className="relative">
            <button
              onClick={() => { setShowSettings(o => !o); setShowCcPanel(false); }}
              className="text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
              title="Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
            {showSettings && (
              <SettingsPanel speed={speed} onSpeedChange={changeSpeed} onClose={() => setShowSettings(false)} />
            )}
          </div>

          {/* PiP */}
          {'pictureInPictureEnabled' in document && (
            <button
              onClick={togglePiP}
              className={cn("text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5", isPiP && "text-blue-400")}
              title="Picture in Picture (P)"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          {/* Cast / Open external */}
          <button onClick={() => window.open(url, "_blank")} className="text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 hidden sm:block" title="Open in external player">
            <Monitor className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
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
  useEffect(() => {
    setMediaUrl(filesApi.downloadUrl(file.id));
  }, [file.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const kindIcon = kind === "video" ? <PlayCircle className="w-4 h-4 text-blue-400 shrink-0" />
    : kind === "image" ? <ImageIcon className="w-4 h-4 text-green-400 shrink-0" />
    : kind === "audio" ? <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
    : null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md" onClick={onClose} />
      <div className="fixed inset-0 z-[81] flex items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div className="relative pointer-events-auto w-full max-w-6xl rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.9)] border border-white/5 animate-scale-in overflow-hidden flex flex-col" style={{ background: "rgba(10,10,15,0.98)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5">
            {kindIcon}
            <span className="text-sm font-bold text-white/90 truncate flex-1">
              {filename}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="bg-black min-h-[200px] flex items-center justify-center relative flex-1">
            {!mediaUrl ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <span className="text-sm text-white/50">Loading media…</span>
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
                    <AlertCircle className="w-6 h-6 text-white/40" />
                    <span className="text-sm text-white/50">Unsupported format</span>
                    <a href={mediaUrl} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:underline">Download file</a>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer — keyboard shortcuts hint */}
          {kind === "video" && mediaUrl && (
            <div className="flex items-center gap-4 px-4 py-1.5 border-t border-white/5 overflow-x-auto">
              <span className="text-[10px] text-white/25 whitespace-nowrap">
                Space: Play/Pause · ←→: Skip 10s · ↑↓: Volume · F: Fullscreen · M: Mute · P: PiP · 0-9: Seek
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
