import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobs as jobsApi, usage as usageApi, files as filesApi, type ApiJob, ApiError } from "@/lib/api";
import { formatBytes, formatSpeed, formatEta, type JobStatus } from "@/lib/mock-data";
import { TopHeader } from "@/components/TopHeader";
import { AddDownloadModal } from "@/components/AddDownloadModal";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useJobSSE, mergeSSEIntoJob } from "@/hooks/useSSE";
import type { UsageMetrics } from "@/lib/mock-data";
import {
  Folder, FileVideo, FileText, FileImage, File, Download,
  Pause, Play, X, Search, FolderPlus, ChevronUp, ChevronDown,
  CheckSquare, Square, ArrowUp, Loader2, AlertCircle,
  CheckCircle2, Clock, Minus, Plus, RefreshCw,
} from "lucide-react";

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-4 h-4 bg-muted rounded" />
      <div className="w-9 h-9 bg-muted rounded" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-1/3" />
        <div className="h-1.5 bg-muted rounded w-1/2" />
      </div>
      <div className="h-3 w-16 bg-muted rounded" />
      <div className="h-3 w-20 bg-muted rounded" />
    </div>
  );
}

// ── File-type icon ────────────────────────────────────────────────────────────
function FileIcon({ mimeType, isFolder }: { mimeType?: string | null; isFolder?: boolean }) {
  const cls = "w-9 h-9 shrink-0 flex items-center justify-center";
  if (isFolder) return <div className={cls}><Folder className="w-7 h-7 text-warning fill-warning/70" /></div>;
  return (
    <div className={cls}>
      {!mimeType && <File className="w-6 h-6 text-muted-foreground" />}
      {mimeType?.startsWith("video/") && <FileVideo className="w-6 h-6 text-info" />}
      {mimeType?.startsWith("image/") && <FileImage className="w-6 h-6 text-success" />}
      {(mimeType?.startsWith("text/") || mimeType?.includes("pdf")) && <FileText className="w-6 h-6 text-muted-foreground" />}
      {mimeType && !["video/","image/","text/"].some(p => mimeType.startsWith(p)) && !mimeType.includes("pdf") && (
        <File className="w-6 h-6 text-muted-foreground" />
      )}
    </div>
  );
}

function JobStatusIcon({ status }: { status: string }) {
  if (["downloading","uploading","metadata_fetch","submitted"].includes(status))
    return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
  if (status === "completed") return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
  if (status === "failed") return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
  if (status === "paused") return <Pause className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "queued") return <Clock className="w-3.5 h-3.5 text-warning" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

type SortCol = "name" | "size" | "date";

// ── Single job row with its own SSE subscription ─────────────────────────────
function JobRow({
  job, selected, onToggle, onAction, onClick,
}: {
  job: ApiJob;
  selected: boolean;
  onToggle: () => void;
  onAction: (action: "pause" | "resume" | "cancel") => void;
  onClick: () => void;
}) {
  const { progress } = useJobSSE(
    ["downloading","uploading","metadata_fetch","submitted","queued"].includes(job.status) ? job.id : null,
  );
  const liveJob = mergeSSEIntoJob(job, progress);

  const isActive = ["downloading","uploading","metadata_fetch","submitted","queued"].includes(liveJob.status);
  const isFolder = liveJob.status === "completed";
  const isFailed = liveJob.status === "failed";

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group cursor-pointer border-b border-dashed border-border/50 last:border-0",
        selected && "bg-accent/20 hover:bg-accent/25",
      )}
      onClick={onClick}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 w-5"
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
            "text-sm font-medium truncate",
            isFolder ? "text-primary hover:underline" : "text-foreground",
          )}>
            {liveJob.name}
          </span>
          <JobStatusIcon status={liveJob.status} />
          {liveJob.status === "downloading" && (
            <span className="hidden sm:block text-xs text-muted-foreground shrink-0">
              {formatSpeed(liveJob.downloadSpeed)} · {liveJob.peers}p
            </span>
          )}
        </div>

        {isActive && !["queued","submitted"].includes(liveJob.status) && liveJob.bytesTotal > 0 && (
          <div className="mt-1.5 space-y-0.5">
            <Progress value={liveJob.progressPct} className="h-1 [&>div]:progress-bar-glow" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatBytes(liveJob.bytesDownloaded)} of {formatBytes(liveJob.bytesTotal)}</span>
              <span>{liveJob.progressPct}% · ETA {formatEta(liveJob.eta)}</span>
            </div>
          </div>
        )}

        {isFailed && liveJob.error && (
          <p className="text-xs text-destructive mt-0.5 truncate">{liveJob.error}</p>
        )}
      </div>

      <span className="hidden sm:block text-sm text-muted-foreground w-24 text-right shrink-0">
        {liveJob.bytesTotal > 0 ? formatBytes(liveJob.bytesTotal) : "—"}
      </span>
      <span className="hidden md:block text-sm text-muted-foreground w-28 text-right shrink-0">
        {formatDate(liveJob.updatedAt)}
      </span>

      <div
        className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-10 justify-end"
        onClick={e => e.stopPropagation()}
      >
        {isFolder && (
          <ActionBtn icon={Download} label="Open folder" className="text-primary hover:bg-primary/10" onClick={onClick} />
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
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: jobsData, isLoading: jobsLoading, isError: jobsError, refetch } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list({ limit: 100 }),
    refetchInterval: 15_000, // poll every 15s as fallback to SSE
    retry: 2,
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
    retry: 2,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────
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

  // ── Derived ─────────────────────────────────────────────────────────────────
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

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map(j => j.id)));
  };
  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Build usage shape for TopHeader
  const headerUsage = {
    plan: {
      name: usageData?.plan.name ?? "free",
      maxStorageGb: usageData?.plan.maxStorageGb ?? 5,
      bandwidthGb: usageData?.plan.bandwidthGb ?? 20,
    },
    storageUsedBytes: usageData?.storageUsedBytes ?? 0,
    bandwidthUsedBytes: usageData?.bandwidthUsedBytes ?? 0,
  };

  const handleMagnetAdd = (uri: string) => {
    // optimistic: AddDownloadModal handles the API call
    // just close the paste bar — modal handles real submission
  };

  const handleJobAdded = () => {
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["usage"] });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopHeader
        usage={usageLoading
          ? { plan: { name: "free", maxStorageGb: 5, bandwidthGb: 20 }, storageUsedBytes: 0, bandwidthUsedBytes: 0 }
          : headerUsage
        }
        onAddMagnet={handleMagnetAdd}
        onUploadTorrent={() => setAddOpen(true)}
      />

      <main className="flex-1">
        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div className="bg-card/40 px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 flex-wrap dashed-separator">
          <button onClick={toggleAll} className="flex items-center justify-center w-5 h-5 shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {allSelected ? <CheckSquare className="w-4 h-4 text-primary" />
              : someSelected ? <CheckSquare className="w-4 h-4 text-muted-foreground opacity-60" />
              : <Square className="w-4 h-4" />}
          </button>

          <button
            onClick={() => toggleSort("name")}
            className={cn("hidden sm:flex text-xs font-semibold uppercase tracking-widest transition-colors items-center gap-0.5",
              sortCol === "name" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            NAME
            {sortCol === "name" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>

          {/* Search — full width on mobile */}
          <div className="flex items-center gap-1.5 border border-border rounded px-2.5 py-1 bg-input flex-1 sm:flex-none sm:w-48">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
            />
          </div>

          <button className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline transition-colors uppercase tracking-wide whitespace-nowrap">
            <Plus className="w-3.5 h-3.5" /> Create Folder
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-foreground transition-colors ml-auto sm:ml-0"
            title="Refresh"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", jobsLoading && "animate-spin")} />
          </button>

          <div className="hidden sm:flex items-center gap-5">
            <SortBtn col="size" label="SIZE" active={sortCol === "size"} dir={sortDir} onClick={() => toggleSort("size")} />
            <SortBtn col="date" label="LAST CHANGED" active={sortCol === "date"} dir={sortDir} onClick={() => toggleSort("date")} />
          </div>
        </div>

        {/* ── File list ──────────────────────────────────────────── */}
        <div>
          {jobsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
          ) : jobsError ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <AlertCircle className="w-10 h-10 text-destructive mb-3" />
              <h2 className="text-base font-semibold text-foreground mb-1">Could not load downloads</h2>
              <p className="text-sm text-muted-foreground mb-4">Check that the API is running and you are logged in.</p>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center px-6">
              <div className="w-20 h-20 rounded-2xl bg-accent/20 border border-border flex items-center justify-center mb-5">
                <Folder className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                {search ? "No results found" : "No downloads yet"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                {search ? `No files match "${search}"` : "Paste a magnet link or upload a .torrent file to get started."}
              </p>
              {!search && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="mt-4 flex items-center gap-2 gradient-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" /> Add Download
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
                onClick={() => navigate(`/app/dashboard/${job.id}`)}
              />
            ))
          )}
        </div>
      </main>

      {/* ── Bulk action floating bar ─────────────────────────────── */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 px-4 py-3 bg-card border border-border rounded-2xl shadow-[0_8px_32px_-4px_hsl(220_26%_0%/0.8)] backdrop-blur-md">
            <span className="text-xs font-semibold text-foreground mr-1">
              {selected.size} selected
            </span>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => {
                selected.forEach(id => actionMutation.mutate({ id, action: "cancel" }));
                setSelected(new Set());
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors font-medium"
            >
              <X className="w-3.5 h-3.5" /> Cancel All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      <AddDownloadModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onJobAdded={handleJobAdded}
      />
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
        "flex items-center gap-0.5 text-xs font-semibold uppercase tracking-widest transition-colors",
        active ? "text-primary border-b border-primary pb-0.5" : "text-muted-foreground hover:text-foreground",
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
        "flex items-center justify-center w-7 h-7 rounded-md transition-colors text-muted-foreground hover:bg-muted",
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
