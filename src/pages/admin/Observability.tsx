import { useQuery } from "@tanstack/react-query";
import { adminObservability } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, StatCard } from "@/components/admin/AdminUI";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Activity, AlertOctagon, Database, Server, TrendingUp, TrendingDown, Zap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border/60">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function formatBucket(bucket: string): string {
  if (!bucket) return "";
  // "2026-02-19T14:00" → "14:00"
  return bucket.split("T")[1]?.slice(0, 5) ?? bucket;
}

function formatDatetime(dt: string): string {
  if (!dt) return "";
  return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AdminObservability() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-observability"],
    queryFn: () => adminObservability.get(),
    refetchInterval: 60_000,
  });

  const latency = data?.apiLatency;
  const errorRates = data?.errorRates;
  const queueDepth = data?.queueDepth;
  const fleet = data?.workerFleet;
  const dlq = data?.dlqGrowth;

  // Build error rate chart data by merging 4xx + 5xx per bucket
  const errorChartData: Record<string, any> = {};
  for (const row of errorRates?.trend ?? []) {
    if (!errorChartData[row.hour_bucket]) {
      errorChartData[row.hour_bucket] = { bucket: formatBucket(row.hour_bucket) };
    }
    errorChartData[row.hour_bucket][row.status_class] = row.count;
  }
  const errorData = Object.values(errorChartData);

  const latencyData = (latency?.trend ?? []).map(b => ({
    bucket: formatBucket(b.bucket),
    p50: b.p50,
    p95: b.p95,
    requests: b.requests,
  }));

  const queueData = (queueDepth?.trend ?? []).map(s => ({
    time: formatDatetime(s.captured_at),
    queue: s.queue_depth,
    dlq: s.dlq_depth,
  }));

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5">
        <AdminPageHeader
          title="Observability"
          description="Real-time API latency, error rates, queue depth, and worker fleet health."
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

        {/* Top stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="API p50"
            value={isLoading ? "…" : `${latency?.p50 ?? 0}ms`}
            icon={Activity}
            variant="default"
          />
          <StatCard
            label="API p95"
            value={isLoading ? "…" : `${latency?.p95 ?? 0}ms`}
            icon={Activity}
            variant={(latency?.p95 ?? 0) > 500 ? "warn" : "default"}
          />
          <StatCard
            label="Queue Depth"
            value={isLoading ? "…" : queueDepth?.current ?? 0}
            icon={Database}
            variant={(queueDepth?.current ?? 0) > 20 ? "warn" : "success"}
          />
          <StatCard
            label="DLQ Size"
            value={isLoading ? "…" : dlq?.current ?? 0}
            icon={AlertOctagon}
            variant={(dlq?.current ?? 0) > 0 ? "danger" : "success"}
          />
          <StatCard
            label="Healthy Workers"
            value={isLoading ? "…" : `${fleet?.healthy ?? 0}/${fleet?.total ?? 0}`}
            icon={Server}
            variant={(fleet?.healthy ?? 0) < (fleet?.total ?? 0) ? "warn" : "success"}
          />
        </div>

        {/* API Latency chart */}
        <ChartCard title="API Latency — Last 24h (ms)">
          {latencyData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No latency data yet — metrics accumulate as requests are processed.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={latencyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 20%)" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "hsl(220 14% 50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220 14% 50%)" }} unit="ms" />
                <Tooltip
                  contentStyle={{ background: "hsl(220 24% 12%)", border: "1px solid hsl(220 20% 25%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(220 14% 70%)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="p50" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} name="p50 (avg)" />
                <Line type="monotone" dataKey="p95" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} name="p95" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Error rates */}
        <ChartCard title="Error Rates — 4xx / 5xx (Last 24h)">
          {errorData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No error data — all requests returning 2xx.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={errorData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 20%)" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "hsl(220 14% 50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220 14% 50%)" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(220 24% 12%)", border: "1px solid hsl(220 20% 25%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(220 14% 70%)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="4xx" fill="hsl(38 92% 50%)" name="4xx Client Errors" radius={[2,2,0,0]} />
                <Bar dataKey="5xx" fill="hsl(0 72% 51%)" name="5xx Server Errors" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Queue depth */}
        <ChartCard title="Queue Depth — Last 24h">
          {queueData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No queue snapshots yet — snapshots are taken hourly.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={queueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="queueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(239 84% 67%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(239 84% 67%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dlqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 20%)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(220 14% 50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220 14% 50%)" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(220 24% 12%)", border: "1px solid hsl(220 20% 25%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(220 14% 70%)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="queue" stroke="hsl(239 84% 67%)" fill="url(#queueGrad)" name="Queue Depth" strokeWidth={2} />
                <Area type="monotone" dataKey="dlq" stroke="hsl(0 72% 51%)" fill="url(#dlqGrad)" name="DLQ Depth" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Worker fleet */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Worker Fleet</span>
            {fleet && (
              <span className="ml-auto text-xs text-muted-foreground">
                {fleet.usedCapacity}/{fleet.totalCapacity} jobs
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 shimmer rounded-xl" />
              ))}
            </div>
          ) : (fleet?.workers ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Server className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No workers registered</p>
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(fleet?.workers ?? []).map((w: any) => {
                const loadPct = w.max_jobs > 0 ? (w.active_jobs / w.max_jobs) * 100 : 0;
                const isStale = w.is_stale;
                return (
                  <div
                    key={w.id}
                    className={cn(
                      "rounded-xl border p-4 space-y-2.5",
                      isStale
                        ? "border-destructive/30 bg-destructive/5"
                        : w.status === "healthy"
                        ? "border-success/20 bg-success/5"
                        : "border-warning/20 bg-warning/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-mono text-foreground truncate max-w-[120px]" title={w.id}>{w.id}</p>
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full",
                        isStale ? "bg-destructive/20 text-destructive" : w.status === "healthy" ? "bg-success/20 text-success" : "bg-warning/20 text-warning",
                      )}>
                        {isStale ? "STALE" : w.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {w.region && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-mono">{w.region}</span>}
                      <span>v{w.version ?? "?"}</span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">Jobs</span>
                        <span className="text-[10px] font-semibold text-foreground">{w.active_jobs}/{w.max_jobs}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, loadPct)}%`,
                            background: loadPct > 80 ? "hsl(var(--destructive))" : loadPct > 60 ? "hsl(var(--warning))" : "hsl(var(--success))",
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Last beat: {w.last_heartbeat ? new Date(w.last_heartbeat).toLocaleTimeString() : "never"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DLQ growth indicator */}
        <div className="glass-card rounded-xl p-5 flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-destructive/10 border border-destructive/20 shrink-0">
            <AlertOctagon className="w-6 h-6 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">DLQ Growth Trend</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current: <strong className="text-foreground">{dlq?.current ?? 0}</strong> failed jobs
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold shrink-0">
            {(dlq?.change24h ?? 0) > 0 ? (
              <><TrendingUp className="w-4 h-4 text-destructive" /><span className="text-destructive">+{dlq?.change24h} in 24h</span></>
            ) : (dlq?.change24h ?? 0) < 0 ? (
              <><TrendingDown className="w-4 h-4 text-success" /><span className="text-success">{dlq?.change24h} in 24h</span></>
            ) : (
              <span className="text-muted-foreground">Stable</span>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
