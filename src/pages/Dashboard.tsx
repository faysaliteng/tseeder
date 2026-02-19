import { useState, useMemo } from "react";
import {
  formatBytes, formatSpeed, formatEta, MOCK_JOBS, MOCK_USAGE, MOCK_FILES, type Job,
} from "@/lib/mock-data";
import { TopHeader } from "@/components/TopHeader";
import { AddDownloadModal } from "@/components/AddDownloadModal";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Folder, FileVideo, FileText, FileImage, File, Download,
  Pause, Play, X, Search, FolderPlus, ChevronUp, ChevronDown,
  CheckSquare, Square, ArrowUp, Loader2, AlertCircle,
  CheckCircle2, Clock, Minus, Plus,
} from "lucide-react";

// ── File-type icon ────────────────────────────────────────────────────────────
function FileIcon({ mimeType, isFolder }: { mimeType?: string | null; isFolder?: boolean }) {
  const cls = "w-9 h-9 shrink-0";
  if (isFolder) return (
    <div className={cn(cls, "flex items-center justify-center")}>
      <Folder className="w-7 h-7 text-warning fill-warning/70" />
    </div>
  );
  return (
    <div className={cn(cls, "flex items-center justify-center")}>
      {!mimeType && <File className="w-6 h-6 text-muted-foreground" />}
      {mimeType?.startsWith("video/") && <FileVideo className="w-6 h-6 text-info" />}
      {mimeType?.startsWith("image/") && <FileImage className="w-6 h-6 text-success" />}
      {(mimeType?.startsWith("text/") || mimeType?.includes("pdf")) && <FileText className="w-6 h-6 text-muted-foreground" />}
      {mimeType && !mimeType.startsWith("video/") && !mimeType.startsWith("image/") && !mimeType.startsWith("text/") && !mimeType.includes("pdf") && (
        <File className="w-6 h-6 text-muted-foreground" />
      )}
    </div>
  );
}

function JobStatusIcon({ status }: { status: Job["status"] }) {
  if (["downloading", "uploading", "metadata_fetch", "submitted"].includes(status))
    return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
  if (status === "completed") return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
  if (status === "failed") return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
  if (status === "paused") return <Pause className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "queued") return <Clock className="w-3.5 h-3.5 text-warning" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
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
  const someSelected = !allSelected && sorted.some(j => selected.has(j.id));

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

  // Are we viewing inside a folder?
  const folderJob = openFolder ? jobs.find(j => j.id === openFolder) : null;
  const filesForFolder = MOCK_FILES;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopHeader usage={usage} onAddMagnet={handleMagnetAdd} onUploadTorrent={() => setAddOpen(true)} />

      <main className="flex-1">
        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="bg-card/40 px-4 py-2 flex items-center gap-3 flex-wrap dashed-separator">
          {/* Select-all checkbox */}
          <button
            onClick={toggleAll}
            className="flex items-center justify-center w-5 h-5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={allSelected ? "Deselect all" : "Select all"}
          >
            {allSelected
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : someSelected
                ? <CheckSquare className="w-4 h-4 text-muted-foreground opacity-60" />
                : <Square className="w-4 h-4" />
            }
          </button>

          {/* Column label */}
          <button
            onClick={() => toggleSort("name")}
            className={cn(
              "text-xs font-semibold uppercase tracking-widest transition-colors flex items-center gap-0.5",
              sortCol === "name" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            NAME
            {sortCol === "name" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>

          {/* Search */}
          <div className="flex items-center gap-1.5 border border-border rounded px-2.5 py-1 bg-input ml-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search Your Files"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-36"
            />
          </div>

          {/* Create Folder */}
          <button className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline transition-colors uppercase tracking-wide">
            <Plus className="w-3.5 h-3.5" />
            Create Folder
          </button>

          <div className="flex-1" />

          {/* Sort: SIZE / LAST CHANGED */}
          <div className="hidden sm:flex items-center gap-5">
            <SortBtn col="size" label="SIZE" active={sortCol === "size"} dir={sortDir} onClick={() => toggleSort("size")} />
            <SortBtn col="date" label="LAST CHANGED" active={sortCol === "date"} dir={sortDir} onClick={() => toggleSort("date")} />
          </div>
        </div>

        {/* ── File list ──────────────────────────────────────────────────── */}
        <div className="divide-y divide-dashed divide-border/60">

          {/* Folder-Up row when inside a folder */}
          {folderJob && (
            <div
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer"
              onClick={() => setOpenFolder(null)}
            >
              <div className="w-5" />
              <div className="w-9 h-9 rounded-full border border-border flex items-center justify-center shrink-0">
                <ArrowUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold text-primary">Folder Up</span>
            </div>
          )}

          {/* Files inside folder */}
          {folderJob
            ? filesForFolder.map(file => {
                const filename = file.path.split("/").pop() ?? file.path;
                return (
                  <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 group cursor-pointer">
                    <div className="w-5 shrink-0">
                      <Square className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                    <FileIcon mimeType={file.mimeType} />
                    <span className="flex-1 min-w-0 text-sm text-foreground truncate">{filename}</span>
                    <span className="hidden sm:block text-sm text-muted-foreground w-24 text-right shrink-0">
                      {formatBytes(file.sizeBytes)}
                    </span>
                    <span className="hidden md:block text-sm text-muted-foreground w-28 text-right shrink-0" />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-10 justify-end">
                      <ActionBtn icon={Download} label="Download" className="text-primary hover:bg-primary/10" />
                    </div>
                  </div>
                );
              })
            : sorted.length === 0
              ? (
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
              )
              : sorted.map(job => {
                  const isSel = selected.has(job.id);
                  const isActive = ["downloading", "uploading", "metadata_fetch", "submitted", "queued"].includes(job.status);
                  const isFolder = job.status === "completed";

                  return (
                    <div key={job.id}>
                      <div
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group cursor-pointer",
                          isSel && "bg-accent/20 hover:bg-accent/25",
                        )}
                        onClick={() => isFolder && setOpenFolder(job.id)}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleOne(job.id); }}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 w-5"
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

                          {isActive && !["queued", "submitted"].includes(job.status) && (
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
                        <span className="hidden sm:block text-sm text-muted-foreground w-24 text-right shrink-0">
                          {job.bytesTotal > 0 ? formatBytes(job.bytesTotal) : "—"}
                        </span>

                        {/* Date */}
                        <span className="hidden md:block text-sm text-muted-foreground w-28 text-right shrink-0">
                          {formatDate(job.updatedAt)}
                        </span>

                        {/* Actions */}
                        <div
                          className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-10 justify-end"
                          onClick={e => e.stopPropagation()}
                        >
                          {job.status === "completed" && (
                            <ActionBtn icon={Download} label="Download files" className="text-primary hover:bg-primary/10" />
                          )}
                          {job.status === "downloading" && (
                            <ActionBtn icon={Pause} label="Pause" onClick={() => handleAction(job.id, "pause")} />
                          )}
                          {job.status === "paused" && (
                            <ActionBtn icon={Play} label="Resume" onClick={() => handleAction(job.id, "resume")} />
                          )}
                          {!["completed", "failed", "cancelled"].includes(job.status) && (
                            <ActionBtn
                              icon={X} label="Cancel"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleAction(job.id, "cancel")}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
          }
        </div>
      </main>

      <AddDownloadModal open={addOpen} onOpenChange={setAddOpen} onJobAdded={handleJobAdded} />
    </div>
  );
}

function SortBtn({
  label, active, dir, onClick,
}: { col: string; label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
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

function ActionBtn({
  icon: Icon, label, onClick, className,
}: {
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
