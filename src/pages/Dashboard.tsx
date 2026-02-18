import { useState, useMemo } from "react";
import {
  formatBytes, formatSpeed, formatEta, MOCK_JOBS, MOCK_USAGE, MOCK_FILES, type Job,
} from "@/lib/mock-data";
import { TopHeader } from "@/components/TopHeader";
import { AddDownloadModal } from "@/components/AddDownloadModal";
import { StatusBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Folder, FileVideo, FileText, FileImage, File, Download,
  Pause, Play, X, Search, FolderPlus, ChevronUp, ChevronDown,
  CheckSquare, Square, ArrowUp, Loader2, AlertCircle,
  CheckCircle2, Clock, Minus,
} from "lucide-react";

// ── File-type icon ────────────────────────────────────────────────────────────
function FileIcon({ mimeType, isFolder }: { mimeType?: string | null; isFolder?: boolean }) {
  const cls = "w-5 h-5 shrink-0";
  if (isFolder) return <Folder className={cn(cls, "text-warning fill-warning/60")} />;
  if (!mimeType) return <File className={cn(cls, "text-muted-foreground")} />;
  if (mimeType.startsWith("video/")) return <FileVideo className={cn(cls, "text-info")} />;
  if (mimeType.startsWith("image/")) return <FileImage className={cn(cls, "text-success")} />;
  if (mimeType.startsWith("text/") || mimeType.includes("pdf")) return <FileText className={cn(cls, "text-muted-foreground")} />;
  return <File className={cn(cls, "text-muted-foreground")} />;
}

// ── Status icon (compact) ─────────────────────────────────────────────────────
function JobStatusIcon({ status }: { status: Job["status"] }) {
  if (status === "downloading" || status === "uploading" || status === "metadata_fetch" || status === "submitted")
    return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
  if (status === "completed")
    return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
  if (status === "failed")
    return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
  if (status === "paused")
    return <Pause className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "queued")
    return <Clock className="w-3.5 h-3.5 text-warning" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

// ── Sort direction button ─────────────────────────────────────────────────────
function SortButton({
  col, current, dir, onClick,
}: { col: string; current: string; dir: "asc" | "desc"; onClick: () => void }) {
  const active = col === current;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-0.5 font-semibold text-xs uppercase tracking-wider transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {col}
      {active ? (
        dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
}

type SortCol = "name" | "size" | "date";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const { toast } = useToast();
  const usage = MOCK_USAGE;

  const handleJobAdded = (job: Job) => {
    setJobs(prev => [job, ...prev]);
    toast({ title: "Download queued", description: `"${job.name}" added.` });
  };

  const handleMagnetAdd = (uri: string) => {
    const name = uri.match(/&dn=([^&]+)/)?.[1]?.replace(/\+/g, " ") ?? "New torrent";
    const newJob: Job = {
      id: `job-${Date.now()}`, name, status: "submitted",
      progressPct: 0, downloadSpeed: 0, uploadSpeed: 0,
      eta: 0, peers: 0, seeds: 0, bytesDownloaded: 0, bytesTotal: 0,
      error: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      completedAt: null, infohash: null,
    };
    handleJobAdded(newJob);
  };

  const handleAction = (jobId: string, action: "pause" | "resume" | "cancel") => {
    setJobs(prev => prev.map(j => {
      if (j.id !== jobId) return j;
      const newStatus = action === "pause" ? "paused" : action === "resume" ? "queued" : "cancelled";
      return { ...j, status: newStatus as Job["status"] };
    }));
    toast({ title: `Job ${action}d` });
  };

  // Sort + filter
  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q ? jobs.filter(j => j.name.toLowerCase().includes(q)) : jobs;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "name") cmp = a.name.localeCompare(b.name);
      else if (sortCol === "size") cmp = a.bytesTotal - b.bytesTotal;
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [jobs, search, sortCol, sortDir]);

  const toggleSort = (col: SortCol) => {
    if (col === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const allSelected = sorted.length > 0 && sorted.every(j => selected.has(j.id));
  const someSelected = sorted.some(j => selected.has(j.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map(j => j.id)));
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopHeader
        usage={usage}
        onAddMagnet={handleMagnetAdd}
        onUploadTorrent={() => setAddOpen(true)}
      />

      <main className="flex-1">
        {/* File-manager toolbar */}
        <div className="border-b border-border bg-card/50 px-4 py-2.5 flex items-center gap-3 flex-wrap">
          {/* Checkbox select-all */}
          <button
            onClick={toggleAll}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={allSelected ? "Deselect all" : "Select all"}
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : someSelected ? (
              <CheckSquare className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>

          {/* Search */}
          <div className="flex items-center gap-1.5 bg-input border border-border rounded-lg px-3 py-1.5 flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search your files"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
            />
          </div>

          {/* Create folder */}
          <button className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <FolderPlus className="w-4 h-4" />
            <span>Create Folder</span>
          </button>

          <div className="flex-1" />

          {/* Sort headers */}
          <div className="hidden sm:flex items-center gap-4">
            <SortButton col="size" current={sortCol} dir={sortDir} onClick={() => toggleSort("size")} />
            <SortButton col="date" current={sortCol} dir={sortDir} onClick={() => toggleSort("date")} />
          </div>
        </div>

        {/* File list */}
        <div className="divide-y divide-border">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center px-6">
              <div className="w-20 h-20 rounded-2xl bg-accent/20 border border-border flex items-center justify-center mb-5">
                <Folder className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                {search ? "No results found" : "No downloads yet"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                {search
                  ? `No files match "${search}"`
                  : "Paste a magnet link or upload a .torrent file to get started."}
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
            sorted.map(job => {
              const isSel = selected.has(job.id);
              const isActive = ["downloading", "uploading", "metadata_fetch", "submitted", "queued"].includes(job.status);
              const isFolder = job.status === "completed"; // completed jobs are folders in the file view
              const filesForJob = job.status === "completed" ? MOCK_FILES : [];
              const expanded = openFolder === job.id;

              return (
                <div key={job.id}>
                  {/* Row */}
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group cursor-pointer",
                      isSel && "bg-accent/20 hover:bg-accent/30",
                    )}
                    onClick={() => isFolder && setOpenFolder(expanded ? null : job.id)}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleOne(job.id); }}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      aria-label={isSel ? "Deselect" : "Select"}
                    >
                      {isSel
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      }
                    </button>

                    {/* Icon */}
                    <FileIcon mimeType={null} isFolder={isFolder} />

                    {/* Name + progress */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium truncate",
                          isFolder ? "text-primary hover:underline" : "text-foreground",
                        )}>
                          {job.name}
                        </span>
                        <JobStatusIcon status={job.status} />
                        {job.status === "downloading" && (
                          <span className="hidden sm:block text-xs text-muted-foreground shrink-0">
                            {formatSpeed(job.downloadSpeed)} · {job.peers}p
                          </span>
                        )}
                      </div>

                      {/* Progress bar for active jobs */}
                      {isActive && job.status !== "queued" && job.status !== "submitted" && (
                        <div className="mt-1.5 space-y-0.5">
                          <Progress value={job.progressPct} className="h-1 [&>div]:progress-bar-glow" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatBytes(job.bytesDownloaded)} of {formatBytes(job.bytesTotal) || "?"}</span>
                            <span>{job.progressPct}% · ETA {formatEta(job.eta)}</span>
                          </div>
                        </div>
                      )}

                      {job.status === "failed" && job.error && (
                        <p className="text-xs text-destructive mt-0.5 truncate">{job.error}</p>
                      )}
                    </div>

                    {/* Size */}
                    <span className="hidden sm:block text-xs text-muted-foreground w-20 text-right shrink-0">
                      {job.bytesTotal > 0 ? formatBytes(job.bytesTotal) : "—"}
                    </span>

                    {/* Date */}
                    <span className="hidden md:block text-xs text-muted-foreground w-24 text-right shrink-0">
                      {formatDate(job.updatedAt)}
                    </span>

                    {/* Actions */}
                    <div
                      className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}
                    >
                      {job.status === "completed" && (
                        <ActionBtn
                          icon={Download}
                          label="Download files"
                          className="text-primary hover:bg-primary/10"
                        />
                      )}
                      {job.status === "downloading" && (
                        <ActionBtn
                          icon={Pause}
                          label="Pause"
                          onClick={() => handleAction(job.id, "pause")}
                        />
                      )}
                      {job.status === "paused" && (
                        <ActionBtn
                          icon={Play}
                          label="Resume"
                          onClick={() => handleAction(job.id, "resume")}
                        />
                      )}
                      {!["completed", "failed", "cancelled"].includes(job.status) && (
                        <ActionBtn
                          icon={X}
                          label="Cancel"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleAction(job.id, "cancel")}
                        />
                      )}
                    </div>
                  </div>

                  {/* Expanded file list (folder contents) */}
                  {isFolder && expanded && (
                    <div className="bg-muted/10 border-t border-border">
                      {/* Folder up */}
                      <div
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 cursor-pointer"
                        onClick={() => setOpenFolder(null)}
                      >
                        <div className="w-4" />
                        <div className="w-4 h-4 rounded-full border border-border flex items-center justify-center shrink-0">
                          <ArrowUp className="w-2.5 h-2.5 text-muted-foreground" />
                        </div>
                        <span className="text-sm text-primary font-medium">Folder Up</span>
                      </div>

                      {filesForJob.map(file => {
                        const filename = file.path.split("/").pop() ?? file.path;
                        return (
                          <div key={file.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 group cursor-pointer">
                            <div className="w-4" />
                            <FileIcon mimeType={file.mimeType} />
                            <span className="flex-1 min-w-0 text-sm text-foreground truncate">{filename}</span>
                            <span className="hidden sm:block text-xs text-muted-foreground w-20 text-right shrink-0">
                              {formatBytes(file.sizeBytes)}
                            </span>
                            <div className="w-24 hidden md:block" />
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <ActionBtn
                                icon={Download}
                                label="Download file"
                                className="text-primary hover:bg-primary/10"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      <AddDownloadModal open={addOpen} onOpenChange={setAddOpen} onJobAdded={handleJobAdded} />
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, className,
}: {
  icon: React.ElementType; label: string; onClick?: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
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
