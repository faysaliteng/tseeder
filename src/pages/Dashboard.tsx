import { useState } from "react";
import { formatBytes, formatSpeed, formatEta, MOCK_JOBS, MOCK_USAGE, type Job } from "@/lib/mock-data";
import { AppSidebar } from "@/components/AppSidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { AddDownloadModal } from "@/components/AddDownloadModal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Pause, Play, X, Download, Users, Zap, HardDrive, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();
  const usage = MOCK_USAGE;

  const handleJobAdded = (job: Job) => setJobs(prev => [job, ...prev]);

  const handleAction = (jobId: string, action: "pause" | "resume" | "cancel") => {
    setJobs(prev => prev.map(j => {
      if (j.id !== jobId) return j;
      const newStatus = action === "pause" ? "paused" : action === "resume" ? "queued" : "cancelled";
      return { ...j, status: newStatus as Job["status"] };
    }));
    toast({ title: `Job ${action}d`, description: `The download has been ${action}d.` });
  };

  const storageUsedPct = Math.round((usage.storageUsedBytes / (usage.plan.maxStorageGb * 1e9)) * 100);
  const bandwidthUsedPct = Math.round((usage.bandwidthUsedBytes / (usage.plan.bandwidthGb * 1e9)) * 100);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Downloads</h1>
              <p className="text-sm text-muted-foreground">{jobs.filter(j => ["downloading","uploading","queued","metadata_fetch","submitted"].includes(j.status)).length} active · {jobs.filter(j => j.status === "completed").length} completed</p>
            </div>
            <Button onClick={() => setAddOpen(true)} className="gradient-primary border-0 text-white gap-2">
              <Plus className="w-4 h-4" /> Add Download
            </Button>
          </div>

          {/* Usage cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: HardDrive, label: "Storage", value: `${formatBytes(usage.storageUsedBytes)} / ${usage.plan.maxStorageGb} GB`, pct: storageUsedPct },
              { icon: Wifi, label: "Bandwidth", value: `${formatBytes(usage.bandwidthUsedBytes)} / ${usage.plan.bandwidthGb} GB`, pct: bandwidthUsedPct },
              { icon: Zap, label: "Active Jobs", value: `${usage.activeJobs} / ${usage.plan.maxJobs}`, pct: null },
              { icon: Users, label: "Plan", value: usage.plan.name.charAt(0).toUpperCase() + usage.plan.name.slice(1), pct: null },
            ].map(({ icon: Icon, label, value, pct }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4 space-y-2 shadow-card">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{value}</p>
                {pct !== null && <Progress value={pct} className="h-1" />}
              </div>
            ))}
          </div>

          {/* Job list */}
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl gradient-primary/20 border border-primary/30 flex items-center justify-center mb-4">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">No downloads yet</h2>
              <p className="text-sm text-muted-foreground mb-4">Paste a magnet link or upload a .torrent file to get started.</p>
              <Button onClick={() => setAddOpen(true)} className="gradient-primary border-0 text-white gap-2">
                <Plus className="w-4 h-4" /> Add your first download
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="bg-card border border-border rounded-xl p-4 shadow-card hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{job.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <StatusBadge status={job.status} />
                        {job.status === "downloading" && (
                          <span className="text-xs text-muted-foreground">{formatSpeed(job.downloadSpeed)} · ETA {formatEta(job.eta)} · {job.peers} peers</span>
                        )}
                        {job.status === "completed" && (
                          <span className="text-xs text-muted-foreground">{formatBytes(job.bytesTotal)}</span>
                        )}
                        {job.status === "failed" && job.error && (
                          <span className="text-xs text-destructive truncate max-w-xs">{job.error}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {job.status === "downloading" && (
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => handleAction(job.id, "pause")} aria-label="Pause">
                          <Pause className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {job.status === "paused" && (
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => handleAction(job.id, "resume")} aria-label="Resume">
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {job.status === "completed" && (
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-primary" aria-label="Download files">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {!["completed", "failed", "cancelled"].includes(job.status) && (
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => handleAction(job.id, "cancel")} aria-label="Cancel">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {["downloading", "uploading", "paused"].includes(job.status) && (
                    <div className="mt-3 space-y-1">
                      <Progress value={job.progressPct} className="h-1.5 [&>div]:progress-bar-glow" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatBytes(job.bytesDownloaded)} of {formatBytes(job.bytesTotal)}</span>
                        <span>{job.progressPct}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AddDownloadModal open={addOpen} onOpenChange={setAddOpen} onJobAdded={handleJobAdded} />
    </div>
  );
}
