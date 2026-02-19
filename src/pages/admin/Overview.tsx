import { useQuery } from "@tanstack/react-query";
import { admin as adminApi } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatCard, AdminPageHeader } from "@/components/admin/AdminUI";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBytes } from "@/lib/mock-data";
import {
  Activity, AlertTriangle, Server, Users, Briefcase,
  CheckCircle, XCircle, RefreshCw, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Health {
  jobs?: Record<string, number>;
  failedLast24h?: number;
  agent?: { activeJobs?: number; maxJobs?: number; version?: string } | null;
  status?: string;
  ts?: string;
}

export default function AdminOverview() {
  const { data: health, isLoading, refetch, isFetching } = useQuery<Health>({
    queryKey: ["admin-health"],
    queryFn: () => adminApi.systemHealth() as Promise<Health>,
    refetchInterval: 30_000,
  });

  const { data: recentJobs } = useQuery({
    queryKey: ["admin-jobs", 1, ""],
    queryFn: () => adminApi.listJobs({ page: 1 }),
  });

  const { data: recentUsers } = useQuery({
    queryKey: ["admin-users", 1, ""],
    queryFn: () => adminApi.listUsers({ page: 1 }),
  });

  const byStatus = health?.jobs ?? {};
  const totalJobs = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const activeJobs = (byStatus["downloading"] ?? 0) + (byStatus["uploading"] ?? 0) + (byStatus["queued"] ?? 0) + (byStatus["metadata_fetch"] ?? 0);
  const agentOk = health?.status === "healthy";

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <AdminPageHeader
          title="System Overview"
          description="Real-time health and KPIs for the TorrentFlow platform"
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

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Jobs" value={isLoading ? "…" : totalJobs} icon={Briefcase} />
          <StatCard label="Active Jobs" value={isLoading ? "…" : activeJobs} icon={Activity} variant={activeJobs > 0 ? "default" : "default"} />
          <StatCard label="Failed (24h)" value={isLoading ? "…" : health?.failedLast24h ?? 0} icon={AlertTriangle} variant={(health?.failedLast24h ?? 0) > 0 ? "warn" : "default"} />
          <StatCard
            label="Agent Status"
            value={isLoading ? "…" : agentOk ? "Healthy" : "Unreachable"}
            icon={Server}
            variant={isLoading ? "default" : agentOk ? "success" : "danger"}
          />
        </div>

        {/* Job status breakdown */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Job Status Breakdown
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <StatusBadge status={status as any} />
                  <span className="text-sm font-bold text-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Two-column: recent jobs + recent users */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Recent jobs */}
          <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recent Jobs</h2>
            </div>
            <div className="divide-y divide-border">
              {(recentJobs?.data as any[] ?? []).slice(0, 6).map((job: any) => (
                <div key={job.id} className="flex items-center gap-3 px-4 py-2.5">
                  <StatusBadge status={job.status} />
                  <span className="text-xs text-foreground truncate flex-1">{job.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatBytes(job.bytes_total ?? 0)}</span>
                </div>
              ))}
              {!recentJobs && <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</div>}
            </div>
          </div>

          {/* Recent users */}
          <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recent Users</h2>
            </div>
            <div className="divide-y divide-border">
              {(recentUsers?.data as any[] ?? []).slice(0, 6).map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  {u.suspended
                    ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    : <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--success))] shrink-0" />
                  }
                  <span className="text-xs text-foreground truncate flex-1">{u.email}</span>
                  <span className="text-xs text-muted-foreground capitalize">{u.role}</span>
                </div>
              ))}
              {!recentUsers && <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</div>}
            </div>
          </div>
        </div>

        {/* Agent details */}
        {health?.agent && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" /> Compute Agent
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Active Jobs</p>
                <p className="text-lg font-bold text-foreground">{health.agent.activeJobs ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Capacity</p>
                <p className="text-lg font-bold text-foreground">{health.agent.maxJobs ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="text-lg font-bold text-foreground">{health.agent.version ?? "—"}</p>
              </div>
            </div>
          </div>
        )}

        {health?.ts && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Last updated {new Date(health.ts).toLocaleTimeString()}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
