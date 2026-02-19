import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin as adminApi, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, AdminTable, Paginator, DangerModal } from "@/components/admin/AdminUI";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/utils";
import { Search, Filter, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUSES = ["submitted", "metadata_fetch", "queued", "downloading", "uploading", "completed", "paused", "failed", "cancelled"];

interface AdminJob {
  id: string; name: string; status: string;
  bytes_total: number; bytes_downloaded: number;
  user_email?: string; created_at: string; worker_id?: string;
  infohash?: string; error?: string;
}

export default function AdminJobs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null);
  const [terminating, setTerminating] = useState<AdminJob | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-jobs", page, statusFilter],
    queryFn: () => adminApi.listJobs({ page, status: statusFilter || undefined }),
  });

  const terminateMutation = useMutation({
    mutationFn: (id: string) => adminApi.terminateJob(id),
    onSuccess: () => {
      toast({ title: "Job terminated" });
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      setTerminating(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed", variant: "destructive" });
    },
  });

  const jobs = (data?.data ?? []) as AdminJob[];
  const filtered = search
    ? jobs.filter(j => j.name.toLowerCase().includes(search.toLowerCase()) || j.user_email?.toLowerCase().includes(search.toLowerCase()) || j.infohash?.includes(search.toLowerCase()))
    : jobs;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        <AdminPageHeader title="Job Operations" description="Global job search, inspect states, terminate, and manage the compute queue." />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, email, infohash…"
              className="bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors w-60"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          {data?.meta && <span className="text-xs text-muted-foreground ml-auto">{data.meta.total} jobs total</span>}
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <AdminTable
            headers={["Name", "User", "Status", "Progress", "Size", "Worker", "Created", "Actions"]}
            loading={isLoading}
          >
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No jobs found</td></tr>
            ) : filtered.map(job => {
              const pct = job.bytes_total > 0 ? Math.round((job.bytes_downloaded / job.bytes_total) * 100) : 0;
              const canTerminate = !["completed", "failed", "cancelled"].includes(job.status);
              return (
                <tr key={job.id} className="hover:bg-muted/20 transition-colors group cursor-pointer" onClick={() => setSelectedJob(job)}>
                  <td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate">{job.name || <span className="text-muted-foreground italic">Untitled</span>}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">{job.user_email ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={job.status as any} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatBytes(job.bytes_total)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{job.worker_id ? job.worker_id.slice(0, 12) + "…" : "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(job.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button
                      disabled={!canTerminate || terminateMutation.isPending}
                      onClick={() => setTerminating(job)}
                      className="text-xs px-2 py-1 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Terminate
                    </button>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
          <Paginator page={page} totalPages={data?.meta?.totalPages ?? 1} onPage={setPage} />
        </div>
      </div>

      {/* Job detail drawer */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedJob(null)} />
          <div className="relative ml-auto w-full max-w-lg bg-card border-l border-border shadow-card h-full overflow-y-auto p-6 space-y-5 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-foreground text-base">Job Details</h2>
              <button onClick={() => setSelectedJob(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "ID", value: selectedJob.id },
                { label: "Name", value: selectedJob.name || "—" },
                { label: "Status", value: <StatusBadge status={selectedJob.status as any} /> },
                { label: "User", value: selectedJob.user_email ?? "—" },
                { label: "Infohash", value: selectedJob.infohash ?? "—" },
                { label: "Worker ID", value: selectedJob.worker_id ?? "—" },
                { label: "Downloaded", value: `${formatBytes(selectedJob.bytes_downloaded)} / ${formatBytes(selectedJob.bytes_total)}` },
                { label: "Created", value: new Date(selectedJob.created_at).toLocaleString() },
                { label: "Error", value: selectedJob.error ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">{label}</span>
                  <span className="text-sm text-foreground font-mono break-all">{value}</span>
                </div>
              ))}
            </div>
            {!["completed", "failed", "cancelled"].includes(selectedJob.status) && (
              <button
                onClick={() => { setTerminating(selectedJob); setSelectedJob(null); }}
                className="w-full py-2 rounded-lg border border-destructive text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors"
              >
                Terminate Job
              </button>
            )}
          </div>
        </div>
      )}

      <DangerModal
        open={!!terminating}
        title="Terminate Job"
        description={`Force-cancel "${terminating?.name}". The job will be marked cancelled and the worker will be instructed to stop.`}
        confirmPhrase="terminate"
        reasonRequired
        onClose={() => setTerminating(null)}
        onConfirm={(_p) => { if (terminating) terminateMutation.mutate(terminating.id); }}
        isPending={terminateMutation.isPending}
      />
    </AdminLayout>
  );
}
