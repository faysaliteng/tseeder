import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobs as jobsApi, usage as usageApi, type ApiJob, ApiError } from "@/lib/api";
import { useSessionRestore } from "@/hooks/useSessionRestore";
import { formatBytes, formatSpeed, formatEta } from "@/lib/utils";
import { TopHeader } from "@/components/TopHeader";
import { AddDownloadModal } from "@/components/AddDownloadModal";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useJobSSE, mergeSSEIntoJob } from "@/hooks/useSSE";
import {
  Folder, FileVideo, FileText, FileImage, File, Download,
  Pause, Play, X, Search, ChevronUp, ChevronDown,
  CheckSquare, Square, Loader2, AlertCircle,
  CheckCircle2, Clock, Minus, Plus, RefreshCw, Zap, Trash2,
} from "lucide-react";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { strip: string; dot: string; pulse: boolean }> = {
  downloading: { strip: "hsl(239 84% 67%)", dot: "hsl(239 84% 67%)", pulse: true },
  uploading:   { strip: "hsl(199 89% 48%)", dot: "hsl(199 89% 48%)", pulse: true },
  completed:   { strip: "hsl(142 71% 45%)", dot: "hsl(142 71% 45%)", pulse: false },
  failed:      { strip: "hsl(0 72% 51%)",   dot: "hsl(0 72% 51%)",   pulse: false },
  queued:      { strip: "hsl(38 92% 50%)",  dot: "hsl(38 92% 50%)",  pulse: true },
  paused:      { strip: "hsl(215 20% 45%)", dot: "hsl(215 20% 45%)", pulse: false },
  metadata_fetch: { strip: "hsl(265 89% 70%)", dot: "hsl(265 89% 70%)", pulse: true },
  submitted:   { strip: "hsl(265 89% 70%)", dot: "hsl(265 89% 70%)", pulse: true },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/30">
      <div className="w-1 h-12 rounded-full shimmer shrink-0" />
      <div className="w-4 h-4 shimmer rounded" />
      <div className="w-10 h-10 shimmer rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="h-3 shimmer rounded w-2/5" />
        <div className="h-1.5 shimmer rounded w-1/3" />
      </div>
      <div className="h-3 w-16 shimmer rounded" />
      <div className="h-3 w-20 shimmer rounded hidden md:block" />
    </div>
  );
}

// ── File-type icon ────────────────────────────────────────────────────────────
function FileIcon({ mimeType, isFolder }: { mimeType?: string | null; isFolder?: boolean }) {
  if (isFolder) return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-warning/10 border border-warning/20">
      <Folder className="w-5 h-5 text-warning" />
    </div>
  );
  if (mimeType?.startsWith("video/")) return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-info/10 border border-info/20">
      <FileVideo className="w-5 h-5 text-info" />
    </div>
  );
  if (mimeType?.startsWith("image/")) return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-success/10 border border-success/20">
      <FileImage className="w-5 h-5 text-success" />
    </div>
  );
  if (mimeType?.startsWith("text/") || mimeType?.includes("pdf")) return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-muted border border-border">
      <FileText className="w-5 h-5 text-muted-foreground" />
    </div>
  );
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-muted border border-border">
      <File className="w-5 h-5 text-muted-foreground" />
    </div>
  );
}

// ── Status dot badge ──────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.paused;
  return (
    <span className="relative flex items-center justify-center w-4 h-4 shrink-0">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}` }}
      />
      {cfg.pulse && (
        <span
          className="absolute w-4 h-4 rounded-full animate-ping opacity-40"
          style={{ background: cfg.dot }}
        />
      )}
    </span>
  );
}

type SortCol = "name" | "size" | "date";

// ── Single job row ────────────────────────────────────────────────────────────
function JobRow({
  job, selected, onToggle, onAction, onDelete, onClick,
}: {
  job: ApiJob;
  selected: boolean;
  onToggle: () => void;
  onAction: (action: "pause" | "resume" | "cancel") => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const { progress } = useJobSSE(
    ["downloading","uploading","metadata_fetch","submitted","queued"].includes(job.status) ? job.id : null,
  );
  const liveJob = mergeSSEIntoJob(job, progress);

  const isActive = ["downloading","uploading","metadata_fetch","submitted","queued"].includes(liveJob.status);
  const isFolder = liveJob.status === "completed";
  const isFailed = liveJob.status === "failed";
  const cfg = STATUS_CONFIG[liveJob.status] ?? STATUS_CONFIG.paused;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-4 py-3.5 transition-all duration-200 group cursor-pointer border-b border-border/30 last:border-0",
        "hover:-translate-y-px hover:shadow-[0_4px_20px_hsl(220_26%_0%/0.4)] hover:bg-muted/10 hover:z-10",
        selected && "bg-accent/10 hover:bg-accent/15",
      )}
      onClick={onClick}
    >
      {/* Status accent strip */}
      <div
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full transition-all duration-300 opacity-80 group-hover:opacity-100"
        style={{ background: cfg.strip, boxShadow: `0 0 8px ${cfg.strip}` }}
      />

      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 w-5 ml-1.5"
      >
        {selected
          ? <CheckSquare className="w-4 h-4 text-primary" />
          : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        }
      </button>

      <FileIcon mimeType={null} isFolder={isFolder} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-semibold truncate transition-colors",
            isFolder ? "text-primary group-hover:text-primary/80" : "text-foreground",
          )}>
            {liveJob.name}
          </span>
          <StatusDot status={liveJob.status} />
          {liveJob.status === "downloading" && (
            <span className="hidden sm:block text-xs text-muted-foreground shrink-0 tabular-nums">
              {formatSpeed(liveJob.downloadSpeed)} · {liveJob.peers}p
            </span>
          )}
        </div>

        {isActive && !["queued","submitted"].includes(liveJob.status) && liveJob.bytesTotal > 0 && (
          <div className="mt-1.5 space-y-1">
            {/* Glowing progress bar */}
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${liveJob.progressPct}%`,
                  background: cfg.strip,
                  boxShadow: `0 0 8px ${cfg.dot}`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{formatBytes(liveJob.bytesDownloaded)} of {formatBytes(liveJob.bytesTotal)}</span>
              <span className="font-semibold" style={{ color: cfg.dot }}>{liveJob.progressPct}% · ETA {formatEta(liveJob.eta)}</span>
            </div>
          </div>
        )}

        {isFailed && liveJob.error && (
          <p className="text-xs text-destructive mt-0.5 truncate">{liveJob.error}</p>
        )}
      </div>

      <span className="hidden sm:block text-sm text-muted-foreground w-24 text-right shrink-0 tabular-nums">
        {liveJob.bytesTotal > 0 ? formatBytes(liveJob.bytesTotal) : "—"}
      </span>
      <span className="hidden md:block text-xs text-muted-foreground w-28 text-right shrink-0">
        {formatDate(liveJob.updatedAt)}
      </span>

      {/* Action buttons — slide in on hover */}
      <div
        className="flex items-center gap-0.5 shrink-0 translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 w-10 justify-end"
        onClick={e => e.stopPropagation()}
      >
        {isFolder && (
          <ActionBtn icon={Download} label="Open" className="text-primary hover:bg-primary/10" onClick={onClick} />
        )}
        {liveJob.status === "downloading" && (
          <ActionBtn icon={Pause} label="Pause" onClick={() => onAction("pause")} />
        )}
        {liveJob.status === "paused" && (
          <ActionBtn icon={Play} label="Resume" onClick={() => onAction("resume")} />
        )}
        {!["completed","failed","cancelled"].includes(liveJob.status) && (
          <ActionBtn icon={X} label="Cancel"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onAction("cancel")} />
        )}
        {["completed","failed","cancelled"].includes(liveJob.status) && (
          <ActionBtn icon={Trash2} label="Delete"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete} />
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useSessionRestore();

  const [addOpen, setAddOpen] = useState(false);
  const [initialMagnet, setInitialMagnet] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  const { data: jobsData, isLoading: jobsLoading, isError: jobsError, refetch } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list({ limit: 100 }),
    refetchInterval: 15_000,
    retry: 2,
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
    retry: 2,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause"|"resume"|"cancel" }) => {
      if (action === "pause") return jobsApi.pause(id);
      if (action === "resume") return jobsApi.resume(id);
      return jobsApi.cancel(id);
    },
    onSuccess: (_, { action }) => {
      toast({ title: `Job ${action}d` });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Action failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jobsApi.delete(id),
    onSuccess: () => {
      toast({ title: "Job deleted" });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const allJobs: ApiJob[] = jobsData?.data ?? [];

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q ? allJobs.filter(j => j.name.toLowerCase().includes(q)) : allJobs;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "name") cmp = a.name.localeCompare(b.name);
      else if (sortCol === "size") cmp = a.bytesTotal - b.bytesTotal;
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allJobs, search, sortCol, sortDir]);

  const toggleSort = (col: SortCol) => {
    if (col === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const allSelected = sorted.length > 0 && sorted.every(j => selected.has(j.id));
  const someSelected = !allSelected && sorted.some(j => selected.has(j.id));
  const toggleAll = () => { if (allSelected) setSelected(new Set()); else setSelected(new Set(sorted.map(j => j.id))); };
  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const headerUsage = {
    plan: { name: usageData?.plan.name ?? "free", maxStorageGb: usageData?.plan.maxStorageGb ?? 5, bandwidthGb: usageData?.plan.bandwidthGb ?? 20 },
    storageUsedBytes: usageData?.storageUsedBytes ?? 0,
    bandwidthUsedBytes: usageData?.bandwidthUsedBytes ?? 0,
  };

  const handleMagnetAdd = (uri: string) => { setInitialMagnet(uri); setAddOpen(true); };
  const handleJobAdded = () => {
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["usage"] });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Ambient background effect */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 70% 50% at 15% 0%, hsl(239 84% 67% / 0.06) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 100%, hsl(265 89% 70% / 0.04) 0%, transparent 50%)"
      }} />

      <div className="relative z-10 flex flex-col flex-1">
        <TopHeader
          usage={usageLoading
            ? { plan: { name: "free", maxStorageGb: 5, bandwidthGb: 20 }, storageUsedBytes: 0, bandwidthUsedBytes: 0 }
            : headerUsage
          }
          onAddMagnet={handleMagnetAdd}
          onUploadTorrent={() => setAddOpen(true)}
        />

        <main className="flex-1">
          {/* ── Toolbar ───────────────────────────────────────────────── */}
          <div className="px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 flex-wrap border-b border-border/40"
            style={{ background: "hsl(220 24% 10% / 0.4)", backdropFilter: "blur(8px)" }}>
            <button onClick={toggleAll} className="flex items-center justify-center w-5 h-5 shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              {allSelected ? <CheckSquare className="w-4 h-4 text-primary" />
                : someSelected ? <CheckSquare className="w-4 h-4 text-muted-foreground opacity-60" />
                : <Square className="w-4 h-4" />}
            </button>

            <button
              onClick={() => toggleSort("name")}
              className={cn("hidden sm:flex text-xs font-bold uppercase tracking-widest transition-colors items-center gap-0.5",
                sortCol === "name" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              NAME
              {sortCol === "name" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>

            {/* Search */}
            <div className="flex items-center gap-1.5 border border-border/60 rounded-xl px-2.5 py-1.5 bg-input/40 backdrop-blur-sm flex-1 sm:flex-none sm:w-52 focus-within:border-primary/50 focus-within:shadow-[0_0_0_2px_hsl(239_84%_67%/0.08)] transition-all">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search files…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
              />
            </div>

            <button className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-wide whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Create Folder
            </button>

            <button
              onClick={() => refetch()}
              className="text-muted-foreground hover:text-primary transition-colors ml-auto sm:ml-0"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", jobsLoading && "animate-spin")} />
            </button>

            <div className="hidden sm:flex items-center gap-5">
              <SortBtn col="size" label="SIZE" active={sortCol === "size"} dir={sortDir} onClick={() => toggleSort("size")} />
              <SortBtn col="date" label="LAST CHANGED" active={sortCol === "date"} dir={sortDir} onClick={() => toggleSort("date")} />
            </div>
          </div>

          {/* ── File list ─────────────────────────────────────────────── */}
          <div>
            {jobsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : jobsError ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-6 animate-slide-up-fade">
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4 shadow-glow-danger">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-base font-bold text-foreground mb-1">Could not load downloads</h2>
                <p className="text-sm text-muted-foreground mb-4">Check that the API is running and you are logged in.</p>
                <button onClick={() => refetch()} className="flex items-center gap-2 text-sm text-primary hover:underline font-medium">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center px-6 animate-slide-up-fade">
                {/* Animated folder with orbiting dots */}
                <div className="relative w-24 h-24 mb-6">
                  <div className="w-24 h-24 rounded-2xl bg-accent/15 border border-border/60 flex items-center justify-center animate-float shadow-[0_8px_32px_hsl(239_84%_67%/0.1)]">
                    <Folder className="w-12 h-12 text-muted-foreground/60" />
                  </div>
                  {[0, 120, 240].map((deg, i) => (
                    <div
                      key={i}
                      className="absolute w-2.5 h-2.5 rounded-full bg-primary/50"
                      style={{
                        top: "50%", left: "50%",
                        transform: `rotate(${deg}deg) translateX(44px) translateY(-50%)`,
                        animation: `glow-pulse ${2 + i * 0.5}s ease-in-out infinite`,
                        animationDelay: `${i * 0.4}s`,
                        boxShadow: "0 0 6px hsl(239 84% 67% / 0.6)",
                      }}
                    />
                  ))}
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  {search ? "No results found" : "No downloads yet"}
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  {search ? `No files match "${search}"` : "Paste a magnet link or upload a .torrent file to get started."}
                </p>
                {!search && (
                  <button
                    onClick={() => setAddOpen(true)}
                    className="flex items-center gap-2 gradient-primary text-white text-sm font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-all shadow-glow-primary relative overflow-hidden group"
                  >
                    <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                    <Zap className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Add Download</span>
                  </button>
                )}
              </div>
            ) : (
              sorted.map(job => (
                <JobRow
                  key={job.id}
                  job={job}
                  selected={selected.has(job.id)}
                  onToggle={() => toggleOne(job.id)}
                  onAction={(action) => actionMutation.mutate({ id: job.id, action })}
                  onDelete={() => deleteMutation.mutate(job.id)}
                  onClick={() => navigate(`/app/dashboard/${job.id}`)}
                />
              ))
            )}
          </div>
        </main>

        {/* ── Bulk action floating bar ───────────────────────────────── */}
        {selected.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up-fade">
            <div className="flex items-center gap-2 px-5 py-3.5 glass-premium rounded-2xl shadow-[0_8px_40px_hsl(220_26%_0%/0.8)] border border-primary/10">
              <span className="flex items-center gap-2 text-sm font-bold text-foreground mr-1">
                <span className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center text-[10px] text-white font-bold shadow-glow-primary">
                  {selected.size}
                </span>
                selected
              </span>
              <div className="w-px h-4 bg-border mx-1" />
              <button
                onClick={() => {
                  selected.forEach(id => actionMutation.mutate({ id, action: "cancel" }));
                  setSelected(new Set());
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/15 transition-all font-semibold hover:shadow-[0_0_12px_hsl(0_72%_51%/0.3)]"
              >
                <X className="w-3.5 h-3.5" /> Cancel All
              </button>
              <button
                onClick={() => {
                  selected.forEach(id => {
                    const job = allJobs.find(j => j.id === id);
                    if (job && ["completed","failed","cancelled"].includes(job.status)) {
                      deleteMutation.mutate(id);
                    }
                  });
                  setSelected(new Set());
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/15 transition-all font-semibold hover:shadow-[0_0_12px_hsl(0_72%_51%/0.3)]"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors font-medium"
              >
                Deselect
              </button>
            </div>
          </div>
        )}

        <AddDownloadModal
          open={addOpen}
          onOpenChange={(v) => { setAddOpen(v); if (!v) setInitialMagnet(""); }}
          onJobAdded={handleJobAdded}
          initialMagnetUri={initialMagnet}
        />
      </div>
    </div>
  );
}

function SortBtn({ col, label, active, dir, onClick }: {
  col: string; label: string; active: boolean; dir: "asc"|"desc"; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-0.5 text-xs font-bold uppercase tracking-widest transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {active && (dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );
}

function ActionBtn({ icon: Icon, label, onClick, className }: {
  icon: React.ElementType; label: string; onClick?: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center justify-center w-7 h-7 rounded-lg transition-all text-muted-foreground hover:bg-muted",
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
