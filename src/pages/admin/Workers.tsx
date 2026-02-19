import { useQuery } from "@tanstack/react-query";
import { admin as adminApi } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, StatCard } from "@/components/admin/AdminUI";
import { Server, Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentHealth {
  status?: string;
  activeJobs?: number;
  maxJobs?: number;
  version?: string;
  uptime?: number;
  diskFreeGb?: number;
  diskTotalGb?: number;
  bandwidthMbps?: number;
  workers?: Array<{
    id: string; status: string; activeJobs: number; maxJobs: number;
    version?: string; region?: string; lastHeartbeat?: string;
  }>;
}

interface Health {
  agent?: AgentHealth | null;
  status?: string;
  jobs?: Record<string, number>;
  ts?: string;
}

export default function AdminWorkers() {
  const { data: health, isLoading, refetch, isFetching } = useQuery<Health>({
    queryKey: ["admin-health"],
    queryFn: () => adminApi.systemHealth() as Promise<Health>,
    refetchInterval: 15_000,
  });

  const agent = health?.agent;
  const workers: AgentHealth["workers"] = agent?.workers ?? [];
  const agentOk = health?.status === "healthy";

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <AdminPageHeader
          title="Worker Fleet"
          description="Compute agent health, capacity, and version tracking."
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

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Agent Status"
            value={isLoading ? "…" : agentOk ? "Healthy" : "Unreachable"}
            icon={Server}
            variant={isLoading ? "default" : agentOk ? "success" : "danger"}
          />
          <StatCard
            label="Active Jobs"
            value={isLoading ? "…" : agent?.activeJobs ?? "—"}
            icon={Activity}
          />
          <StatCard
            label="Capacity"
            value={isLoading ? "…" : agent?.maxJobs ?? "—"}
            icon={CheckCircle}
          />
          <StatCard
            label="Agent Version"
            value={isLoading ? "…" : agent?.version ?? "—"}
            icon={Server}
          />
        </div>

        {/* Agent details */}
        {agent && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" /> Compute Agent Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {agent.diskFreeGb !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Disk Free</p>
                  <p className="text-sm font-semibold text-foreground">{agent.diskFreeGb?.toFixed(1)} / {agent.diskTotalGb?.toFixed(1)} GB</p>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${agent.diskTotalGb ? (1 - (agent.diskFreeGb! / agent.diskTotalGb!)) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {agent.bandwidthMbps !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Bandwidth</p>
                  <p className="text-sm font-semibold text-foreground">{agent.bandwidthMbps} Mbps</p>
                </div>
              )}
              {agent.uptime !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                  <p className="text-sm font-semibold text-foreground">{Math.floor(agent.uptime / 3600)}h {Math.floor((agent.uptime % 3600) / 60)}m</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workers table (if multi-worker) */}
        {workers.length > 0 ? (
          <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Workers ({workers.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    {["Worker ID", "Status", "Jobs", "Capacity", "Region", "Version", "Last Heartbeat"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {workers.map(w => (
                    <tr key={w.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{w.id}</td>
                      <td className="px-4 py-3">
                        <span className={cn("flex items-center gap-1.5 text-xs font-medium",
                          w.status === "healthy" ? "text-[hsl(var(--success))]" : "text-destructive")}>
                          {w.status === "healthy" ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {w.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{w.activeJobs}</td>
                      <td className="px-4 py-3 text-muted-foreground">{w.maxJobs}</td>
                      <td className="px-4 py-3 text-muted-foreground">{w.region ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">{w.version ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {w.lastHeartbeat ? new Date(w.lastHeartbeat).toLocaleTimeString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : !isLoading && (
          <div className="bg-card border border-border rounded-xl p-10 text-center shadow-card">
            {agentOk ? (
              <div className="space-y-2">
                <CheckCircle className="w-8 h-8 text-[hsl(var(--success))] mx-auto" />
                <p className="text-sm text-foreground font-medium">Single-node agent connected</p>
                <p className="text-xs text-muted-foreground">Multi-worker fleet details will appear here when the agent reports individual worker metrics.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <XCircle className="w-8 h-8 text-destructive mx-auto" />
                <p className="text-sm text-destructive font-medium">Agent Unreachable</p>
                <p className="text-xs text-muted-foreground">Check WORKER_CLUSTER_URL configuration and agent health endpoint.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
