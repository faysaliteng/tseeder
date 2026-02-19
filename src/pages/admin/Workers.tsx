import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminWorkers, type ApiWorker, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, StatCard } from "@/components/admin/AdminUI";
import { Server, Activity, CheckCircle, XCircle, RefreshCw, Shield, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  healthy: "text-[hsl(var(--success))]",
  draining: "text-[hsl(38_92%_50%)]",
  cordoned: "text-[hsl(38_92%_50%)]",
  offline: "text-destructive",
};

export default function AdminWorkers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionPending, setActionPending] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-workers"],
    queryFn: () => adminWorkers.list(),
    refetchInterval: 15_000,
  });

  const cordonMutation = useMutation({
    mutationFn: (id: string) => adminWorkers.cordon(id),
    onSuccess: (result) => {
      toast({ title: "Worker cordoned", description: result.message });
      qc.invalidateQueries({ queryKey: ["admin-workers"] });
      setActionPending(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Action failed", variant: "destructive" });
      setActionPending(null);
    },
  });

  const drainMutation = useMutation({
    mutationFn: (id: string) => adminWorkers.drain(id),
    onSuccess: (result) => {
      toast({ title: "Worker draining", description: result.message });
      qc.invalidateQueries({ queryKey: ["admin-workers"] });
      setActionPending(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Action failed", variant: "destructive" });
      setActionPending(null);
    },
  });

  const workers: ApiWorker[] = data?.workers ?? [];
  const healthyCount = workers.filter(w => w.status === "healthy").length;
  const totalActive = workers.reduce((s, w) => s + w.active_jobs, 0);
  const totalCapacity = workers.reduce((s, w) => s + w.max_jobs, 0);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        <AdminPageHeader
          title="Worker Fleet"
          description="Compute agent registry, capacity, heartbeats, and fleet operations."
          actions={
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
              Refresh
            </button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Workers" value={isLoading ? "…" : data?.total ?? 0} icon={Server} />
          <StatCard
            label="Healthy" value={isLoading ? "…" : healthyCount}
            icon={CheckCircle}
            variant={healthyCount === data?.total && !isLoading ? "success" : "warn"}
          />
          <StatCard label="Active Jobs" value={isLoading ? "…" : totalActive} icon={Activity} />
          <StatCard label="Total Capacity" value={isLoading ? "…" : totalCapacity} icon={Server} />
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Worker Registry</h2>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : workers.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Server className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No workers registered.</p>
              <p className="text-xs mt-1 opacity-60">Compute agents self-register via POST /admin/workers/heartbeat</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    {["Worker ID", "Status", "Jobs", "Disk Free", "Region", "Version", "Last Beat", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {workers.map(w => (
                    <tr key={w.id} className={cn("hover:bg-muted/20 transition-colors", w.is_stale && "opacity-60")}>
                      <td className="px-4 py-3 font-mono text-xs text-foreground max-w-[160px] truncate">{w.id}</td>
                      <td className="px-4 py-3">
                        <span className={cn("flex items-center gap-1.5 text-xs font-medium capitalize", STATUS_COLORS[w.status] ?? "text-muted-foreground")}>
                          {w.status === "healthy" ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {w.status}{w.is_stale ? " (stale)" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground text-xs">
                        {w.active_jobs} / {w.max_jobs}
                        {w.max_jobs > 0 && (
                          <div className="mt-1 h-1 w-16 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (w.active_jobs / w.max_jobs) * 100)}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {w.disk_free_gb != null ? `${w.disk_free_gb.toFixed(1)} GB` : "—"}
                        {w.disk_total_gb != null && (
                          <span className="text-muted-foreground/50"> / {w.disk_total_gb.toFixed(1)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{w.region ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{w.version ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {w.last_heartbeat ? new Date(w.last_heartbeat).toLocaleTimeString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {w.status !== "cordoned" && (
                            <button
                              onClick={() => { setActionPending(w.id + ":cordon"); cordonMutation.mutate(w.id); }}
                              disabled={actionPending === w.id + ":cordon"}
                              className="text-xs px-2 py-1 rounded border border-[hsl(38_92%_50%/0.4)] text-[hsl(38_92%_50%)] hover:bg-[hsl(38_92%_50%/0.1)] transition-colors flex items-center gap-1"
                            >
                              {actionPending === w.id + ":cordon" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                              Cordon
                            </button>
                          )}
                          {w.status === "healthy" && (
                            <button
                              onClick={() => { setActionPending(w.id + ":drain"); drainMutation.mutate(w.id); }}
                              disabled={actionPending === w.id + ":drain"}
                              className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors flex items-center gap-1"
                            >
                              {actionPending === w.id + ":drain" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                              Drain
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
