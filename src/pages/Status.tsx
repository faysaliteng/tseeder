import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { systemStatus, statusHistory, type UptimeSnapshot } from "@/lib/api";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Clock } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/PublicNav";

type HealthStatus = "operational" | "degraded" | "outage" | "loading";

const COMPONENTS: Array<{ key: string; label: string; description: string }> = [
  { key: "api",    label: "API Gateway",     description: "Cloudflare Workers API — authentication, job submission, file management" },
  { key: "queue",  label: "Download Queue",  description: "Cloudflare Queues — job dispatch, retry orchestration, DLQ" },
  { key: "agents", label: "Compute Agents",  description: "External torrent processing cluster — download, seed, upload pipeline" },
];

const EXTRA_COMPONENTS: Array<{ name: string; description: string; statusKey: "storage" | "do" | "static" }> = [
  { name: "File Storage (R2)",      description: "Cloudflare R2 — encrypted file storage and signed URL delivery",     statusKey: "storage" },
  { name: "Realtime Progress (DO)", description: "Durable Objects — SSE job progress, live dashboard updates",          statusKey: "do" },
  { name: "Web Dashboard",          description: "Cloudflare Pages — frontend UI, static assets, edge delivery",        statusKey: "static" },
];

function StatusDot({ status }: { status: HealthStatus }) {
  if (status === "loading")     return <div className="w-2.5 h-2.5 rounded-full bg-gray-300 animate-pulse" />;
  if (status === "operational") return <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 6px #10b981" }} />;
  if (status === "degraded")    return <div className="w-2.5 h-2.5 rounded-full bg-amber-400" style={{ boxShadow: "0 0 6px #f59e0b" }} />;
  return <div className="w-2.5 h-2.5 rounded-full bg-red-500" style={{ boxShadow: "0 0 6px #ef4444" }} />;
}

function StatusBadge({ status }: { status: HealthStatus }) {
  if (status === "loading") return <span className="text-xs text-gray-400">Checking…</span>;
  const map: Record<string, { label: string; cls: string }> = {
    operational: { label: "Operational",          cls: "text-emerald-600" },
    degraded:    { label: "Degraded Performance", cls: "text-amber-600"   },
    outage:      { label: "Major Outage",         cls: "text-red-600"     },
  };
  const cfg = map[status];
  return <span className={`text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "loading")     return null;
  if (status === "operational") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "degraded")    return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

/** Render 90 daily bars for one component */
function UptimeBar({ snaps }: { snaps: UptimeSnapshot[] }) {
  const byDate = new Map(snaps.map(s => [s.date, s]));
  const bars: Array<{ date: string; snap?: UptimeSnapshot }> = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    bars.push({ date: d.toISOString().slice(0, 10) });
  }

  return (
    <div className="flex items-end gap-[1px] h-8 mt-2">
      {bars.map(({ date }) => {
        const snap = byDate.get(date);
        const color = !snap ? "#d1d5db" : snap.operational ? "#10b981" : "#ef4444";
        return (
          <div
            key={date}
            title={`${date}${snap?.note ? ` — ${snap.note}` : ""}`}
            className="flex-1 min-w-[2px] rounded-sm cursor-default"
            style={{ height: "100%", background: color }}
          />
        );
      })}
    </div>
  );
}

export default function StatusPage() {
  const { data: health, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["status-health"],
    queryFn: () => systemStatus.get(),
    refetchInterval: 60_000,
    retry: 1,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["status-history"],
    queryFn: () => statusHistory.get(90),
    refetchInterval: 300_000,
    retry: 1,
  });

  // API returns { components: Record<key, UptimeSnapshot[]>, uptimePct: Record<key, Record<window, number>> }
  const componentSnaps = historyData?.components ?? {};
  const uptimePct = historyData?.uptimePct ?? {};

  const overall: HealthStatus = isLoading ? "loading" : !health ? "outage" : health.status !== "healthy" ? "degraded" : (health.failedLast24h ?? 0) > 10 ? "degraded" : "operational";
  const agentStatus: HealthStatus = isLoading ? "loading" : !health ? "outage" : health.status === "healthy" ? "operational" : "degraded";
  const apiStatus: HealthStatus   = isLoading ? "loading" : health ? "operational" : "outage";
  const genericStatus: HealthStatus = isLoading ? "loading" : health ? "operational" : "degraded";

  const bannerCfg: Record<string, { bg: string; border: string; label: string }> = {
    loading:     { bg: "bg-gray-50",    border: "border-gray-200",   label: "Checking system health…" },
    operational: { bg: "bg-emerald-50", border: "border-emerald-200", label: "All Systems Operational" },
    degraded:    { bg: "bg-amber-50",   border: "border-amber-200",   label: "Partial System Degradation" },
    outage:      { bg: "bg-red-50",     border: "border-red-200",     label: "Major Service Outage" },
  };
  const banner = bannerCfg[overall];

  const WINDOWS = ["24h", "7d", "30d", "90d"] as const;

  const componentStatuses: Record<string, HealthStatus> = {
    api: apiStatus, queue: genericStatus, agents: agentStatus,
    storage: genericStatus, do: genericStatus, static: "operational",
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] font-sans flex flex-col">
      <PublicNav active="status" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Platform</p>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">System Status</h1>
          <p className="text-sm text-gray-500">Real-time health and 90-day uptime history for the fseeder platform.</p>
        </div>

        {/* Banner */}
        <div className={`flex items-center gap-4 p-5 rounded-2xl border mb-8 ${banner.bg} ${banner.border}`}>
          <StatusDot status={overall} />
          <div className="flex-1">
            <p className="text-base font-bold text-gray-900">{banner.label}</p>
            {dataUpdatedAt > 0 && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Last checked {new Date(dataUpdatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-indigo-200 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* 90-Day Uptime History */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex-1">90-Day Uptime History</h2>
            {historyLoading && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          </div>

          <div className="divide-y divide-gray-100">
            {COMPONENTS.map(({ key, label }) => {
              const snaps: UptimeSnapshot[] = componentSnaps[key] ?? [];
              const pcts = uptimePct[key] ?? {};
              return (
                <div key={key} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
                      {WINDOWS.map(w => {
                        const pct = historyLoading ? null : (pcts[w] ?? null);
                        const pctNum = pct !== null ? pct * 100 : null;
                        return (
                          <span key={w} className="flex flex-col items-center min-w-[40px]">
                            <span className={
                              pctNum === null ? "text-gray-300"
                              : pctNum === 100 ? "text-emerald-600"
                              : pctNum >= 99 ? "text-amber-500"
                              : "text-red-500"
                            }>
                              {pctNum === null ? "—" : `${pctNum.toFixed(2)}%`}
                            </span>
                            <span className="text-gray-300 text-[9px] uppercase">{w}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {historyLoading ? (
                    <div className="h-8 bg-gray-100 rounded animate-pulse mt-2" />
                  ) : (
                    <UptimeBar snaps={snaps} />
                  )}
                  <div className="flex justify-between mt-1 text-[9px] text-gray-300">
                    <span>90 days ago</span>
                    <span>Today</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Operational</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Incident</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 inline-block" />No data</span>
          </div>
        </div>

        {/* Real-time component status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Real-Time Component Status</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {COMPONENTS.map(({ key, label, description }) => (
              <div key={key} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <StatusDot status={componentStatuses[key] ?? "loading"} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 truncate">{description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusIcon status={componentStatuses[key] ?? "loading"} />
                  <StatusBadge status={componentStatuses[key] ?? "loading"} />
                </div>
              </div>
            ))}
            {EXTRA_COMPONENTS.map(({ name, description, statusKey }) => (
              <div key={name} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <StatusDot status={componentStatuses[statusKey] ?? genericStatus} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-400 truncate">{description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusIcon status={componentStatuses[statusKey] ?? genericStatus} />
                  <StatusBadge status={componentStatuses[statusKey] ?? genericStatus} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live metrics */}
        {health && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Metrics</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-gray-100">
              {[
                { label: "Queue Depth",    value: health.queueDepth ?? 0 },
                { label: "Failed (DLQ)",   value: health.dlqDepth ?? 0 },
                { label: "Agent Status",   value: health.agent ? "Online" : "Offline" },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">{label}</p>
                  <p className="text-xl font-bold text-gray-900 tabular-nums">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SLA — from real 30-day uptime */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current SLA (30-Day Rolling)</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            {COMPONENTS.map(({ key, label }) => {
              const pctRaw = uptimePct[key]?.["30d"] ?? null;
              const pct = pctRaw !== null ? pctRaw * 100 : null;
              return (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">30-day rolling</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${
                    pct === null ? "text-gray-400"
                    : pct === 100 ? "text-emerald-600"
                    : pct >= 99 ? "text-amber-500"
                    : "text-red-500"
                  }`}>
                    {pct === null ? (historyLoading ? "…" : "N/A") : `${pct.toFixed(3)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-xs text-gray-400">
          <Link to="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
          <Link to="/dmca" className="hover:text-gray-900 transition-colors">DMCA / Abuse</Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
