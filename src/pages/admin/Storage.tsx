import { useQuery } from "@tanstack/react-query";
import { admin as adminApi } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, StatCard } from "@/components/admin/AdminUI";
import { HardDrive, Database, Trash2, AlertTriangle } from "lucide-react";
import { formatBytes } from "@/lib/mock-data";

interface Health {
  agent?: {
    diskFreeGb?: number;
    diskTotalGb?: number;
  } | null;
  jobs?: Record<string, number>;
}

export default function AdminStorage() {
  const { data: health, isLoading } = useQuery<Health>({
    queryKey: ["admin-health"],
    queryFn: () => adminApi.systemHealth() as Promise<Health>,
    refetchInterval: 30_000,
  });

  const { data: jobsData } = useQuery({
    queryKey: ["admin-jobs", 1, "completed"],
    queryFn: () => adminApi.listJobs({ page: 1, status: "completed" }),
  });

  const agent = health?.agent;
  const diskUsedGb = agent?.diskTotalGb && agent?.diskFreeGb
    ? agent.diskTotalGb - agent.diskFreeGb
    : null;
  const diskPct = diskUsedGb && agent?.diskTotalGb
    ? (diskUsedGb / agent.diskTotalGb) * 100
    : 0;

  const completedJobs = (jobsData?.data ?? []) as any[];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        <AdminPageHeader
          title="Storage & Content"
          description="R2 bucket usage, orphan cleanup, and retention enforcement."
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Disk Used"
            value={isLoading ? "…" : diskUsedGb !== null ? `${diskUsedGb.toFixed(1)} GB` : "—"}
            sub={agent?.diskTotalGb ? `of ${agent.diskTotalGb.toFixed(1)} GB total` : undefined}
            icon={HardDrive}
            variant={diskPct > 85 ? "danger" : diskPct > 70 ? "warn" : "default"}
          />
          <StatCard
            label="Completed Jobs"
            value={isLoading ? "…" : jobsData?.meta?.total ?? "—"}
            sub="Files stored in R2"
            icon={Database}
          />
          <StatCard
            label="Agent Disk Free"
            value={isLoading ? "…" : agent?.diskFreeGb !== undefined ? `${agent.diskFreeGb.toFixed(1)} GB` : "—"}
            icon={HardDrive}
            variant={agent?.diskFreeGb !== undefined && agent.diskFreeGb < 10 ? "danger" : "default"}
          />
        </div>

        {/* Disk usage bar */}
        {agent?.diskTotalGb && (
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
              {diskUsedGb?.toFixed(1)} GB used of {agent.diskTotalGb.toFixed(1)} GB &bull; {agent.diskFreeGb?.toFixed(1)} GB free
            </p>
          </div>
        )}

        {/* Completed jobs list (R2 artifacts) */}
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Stored Artifacts (Completed Jobs)</h2>
          </div>
          <div className="divide-y divide-border">
            {completedJobs.slice(0, 10).map((job: any) => (
              <div key={job.id} className="flex items-center gap-3 px-4 py-3">
                <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{job.name || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">{job.user_email} &bull; {new Date(job.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatBytes(job.bytes_total ?? 0)}</span>
              </div>
            ))}
            {completedJobs.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No completed jobs with stored artifacts</div>
            )}
          </div>
        </div>

        {/* Retention info */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" /> Retention Policy
          </h2>
          <p className="text-sm text-muted-foreground">
            Files are automatically purged from R2 after the retention period defined by the user's plan.
            The compute agent enforces deletion during its cleanup sweep. Manual orphan cleanup tools
            are available via the worker cluster API.
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
