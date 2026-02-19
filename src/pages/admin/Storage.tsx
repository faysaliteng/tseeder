import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminStorage, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, StatCard } from "@/components/admin/AdminUI";
import { HardDrive, Database, Trash2, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AdminStorage() {
  const { toast } = useToast();
  const [cleanupDryRun, setCleanupDryRun] = useState(true);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-storage"],
    queryFn: () => adminStorage.get(),
    refetchInterval: 60_000,
  });

  const cleanupMutation = useMutation({
    mutationFn: () => adminStorage.cleanup({ dryRun: cleanupDryRun, reason: "Admin manual cleanup" }),
    onSuccess: (result) => {
      setCleanupResult(result.message);
      toast({ title: cleanupDryRun ? "Dry run complete" : "Cleanup complete", description: result.message });
      if (!cleanupDryRun) refetch();
    },
    onError: (err) => {
      toast({ title: "Cleanup failed", description: err instanceof ApiError ? err.message : "Unknown error", variant: "destructive" });
    },
  });

  const files = data?.files;
  const orphans = data?.orphans;
  const disk = data?.disk;

  const diskUsedGb = disk?.disk_total_gb != null && disk?.disk_free_gb != null
    ? disk.disk_total_gb - disk.disk_free_gb
    : null;
  const diskPct = diskUsedGb != null && disk?.disk_total_gb
    ? (diskUsedGb / disk.disk_total_gb) * 100
    : 0;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        <AdminPageHeader
          title="Storage & Content"
          description="R2 bucket usage, orphan cleanup, and retention enforcement."
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
          <StatCard
            label="Total Files"
            value={isLoading ? "…" : files?.total_files ?? "—"}
            sub={files ? formatBytes(files.total_bytes) : undefined}
            icon={Database}
          />
          <StatCard
            label="Complete Files"
            value={isLoading ? "…" : files?.complete_files ?? "—"}
            sub={files ? formatBytes(files.complete_bytes) : undefined}
            icon={Database}
            variant="success"
          />
          <StatCard
            label="Orphaned Files"
            value={isLoading ? "…" : orphans?.orphan_count ?? "—"}
            sub={orphans ? formatBytes(orphans.orphan_bytes) : undefined}
            icon={Trash2}
            variant={(orphans?.orphan_count ?? 0) > 0 ? "warn" : "default"}
          />
          <StatCard
            label="Disk Free"
            value={isLoading ? "…" : disk?.disk_free_gb != null ? `${disk.disk_free_gb.toFixed(1)} GB` : "—"}
            sub={disk?.disk_total_gb ? `of ${disk.disk_total_gb.toFixed(1)} GB` : undefined}
            icon={HardDrive}
            variant={diskPct > 85 ? "danger" : diskPct > 70 ? "warn" : "default"}
          />
        </div>

        {/* Disk bar */}
        {disk?.disk_total_gb && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" /> Agent Disk Usage
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${diskPct}%`,
                    background: diskPct > 85 ? "hsl(var(--destructive))" : diskPct > 70 ? "hsl(var(--warning))" : "hsl(var(--primary))",
                  }}
                />
              </div>
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">{diskPct.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {diskUsedGb?.toFixed(1)} GB used of {disk.disk_total_gb.toFixed(1)} GB &bull; {disk.disk_free_gb?.toFixed(1)} GB free
            </p>
          </div>
        )}

        {/* Orphan cleanup */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[hsl(var(--warning))]" /> Orphan Cleanup
          </h2>
          <p className="text-xs text-muted-foreground">
            Orphaned files are D1 records for jobs in failed/cancelled state older than 24 hours.
            Running cleanup deletes their D1 records and R2 objects.
          </p>

          {cleanupResult && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary">
              {cleanupResult}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={cleanupDryRun}
                onChange={e => setCleanupDryRun(e.target.checked)}
                className="w-3.5 h-3.5 rounded"
              />
              Dry run (preview only)
            </label>
            <button
              onClick={() => { setCleanupResult(null); cleanupMutation.mutate(); }}
              disabled={cleanupMutation.isPending}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium",
                cleanupDryRun
                  ? "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  : "border-destructive/50 text-destructive hover:bg-destructive/10",
              )}
            >
              {cleanupMutation.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Running…</>
                : <><Trash2 className="w-3.5 h-3.5" />{cleanupDryRun ? "Preview cleanup" : "Run cleanup"}</>}
            </button>
          </div>
        </div>

        {/* Retention policy */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" /> Retention Policy
          </h2>
          <p className="text-sm text-muted-foreground">
            Files are automatically purged from R2 after the retention period defined by the user's plan.
            The compute agent enforces deletion during its cleanup sweep.
          </p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { plan: "Free", days: 7 },
              { plan: "Pro", days: 30 },
              { plan: "Business", days: 90 },
              { plan: "Enterprise", days: 365 },
            ].map(({ plan, days }) => (
              <div key={plan} className="bg-muted/30 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">{plan}</p>
                <p className="text-sm font-semibold text-foreground">{days} days</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
