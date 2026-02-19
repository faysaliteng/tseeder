import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { admin as adminApi } from "@/lib/api";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Clock } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/PublicNav";

type HealthStatus = "operational" | "degraded" | "outage" | "loading";
interface ComponentStatus { name: string; description: string; status: HealthStatus; }

function StatusDot({ status }: { status: HealthStatus }) {
  if (status === "loading")     return <div className="w-2.5 h-2.5 rounded-full bg-gray-300 animate-pulse" />;
  if (status === "operational") return <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 6px #10b981" }} />;
  if (status === "degraded")    return <div className="w-2.5 h-2.5 rounded-full bg-amber-400" style={{ boxShadow: "0 0 6px #f59e0b" }} />;
  return <div className="w-2.5 h-2.5 rounded-full bg-red-500" style={{ boxShadow: "0 0 6px #ef4444" }} />;
}

function StatusBadge({ status }: { status: HealthStatus }) {
  if (status === "loading") return <span className="text-xs text-gray-400">Checking…</span>;
  const map = {
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

export default function StatusPage() {
  const { data: health, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["status-health"],
    queryFn: () => adminApi.systemHealth() as Promise<any>,
    refetchInterval: 60_000,
    retry: 1,
  });

  const overall: HealthStatus = isLoading ? "loading" : !health ? "outage" : health.status !== "healthy" ? "degraded" : (health.failedLast24h ?? 0) > 10 ? "degraded" : "operational";
  const agentStatus: HealthStatus = isLoading ? "loading" : !health ? "outage" : health.status === "healthy" ? "operational" : "degraded";
  const apiStatus: HealthStatus   = isLoading ? "loading" : health ? "operational" : "outage";

  const components: ComponentStatus[] = [
    { name: "API Gateway",            description: "Cloudflare Workers API — authentication, job submission, file management",            status: apiStatus },
    { name: "Download Queue",         description: "Cloudflare Queues — job dispatch, retry orchestration, DLQ",                         status: isLoading ? "loading" : health ? "operational" : "degraded" },
    { name: "Compute Agents",         description: "External torrent processing cluster — download, seed, upload pipeline",               status: agentStatus },
    { name: "File Storage (R2)",      description: "Cloudflare R2 — encrypted file storage and signed URL delivery",                     status: isLoading ? "loading" : health ? "operational" : "degraded" },
    { name: "Realtime Progress (DO)", description: "Durable Objects — SSE job progress, live dashboard updates",                         status: isLoading ? "loading" : health ? "operational" : "degraded" },
    { name: "Web Dashboard",          description: "Cloudflare Pages — frontend UI, static assets, edge delivery",                       status: "operational" },
  ];

  const bannerCfg = {
    loading:     { bg: "bg-gray-50",    border: "border-gray-200",   label: "Checking system health…" },
    operational: { bg: "bg-emerald-50", border: "border-emerald-200", label: "All Systems Operational" },
    degraded:    { bg: "bg-amber-50",   border: "border-amber-200",   label: "Partial System Degradation" },
    outage:      { bg: "bg-red-50",     border: "border-red-200",     label: "Major Service Outage" },
  }[overall];

  return (
    <div className="min-h-screen bg-[#f4f6fb] font-sans flex flex-col">
      <PublicNav active="status" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Platform</p>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">System Status</h1>
          <p className="text-sm text-gray-500">Real-time health of the tseeder platform, updated every 60 seconds.</p>
        </div>

        {/* Banner */}
        <div className={`flex items-center gap-4 p-5 rounded-2xl border mb-8 ${bannerCfg.bg} ${bannerCfg.border}`}>
          <StatusDot status={overall} />
          <div className="flex-1">
            <p className="text-base font-bold text-gray-900">{bannerCfg.label}</p>
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

        {/* Components */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Components</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {components.map(c => (
              <div key={c.name} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <StatusDot status={c.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusIcon status={c.status} />
                  <StatusBadge status={c.status} />
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
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-100">
              {[
                { label: "Active Jobs",     value: (Object.values(health.jobs ?? {}) as number[]).filter((_, k) => ["downloading","uploading","metadata_fetch","queued"].includes(Object.keys(health.jobs ?? {})[k])).reduce((a: number, b: number) => a + b, 0) ?? "—" },
                { label: "Failed (24h)",    value: health.failedLast24h ?? 0 },
                { label: "Agent Capacity",  value: health.agent ? `${health.agent.activeJobs ?? 0}/${health.agent.maxJobs ?? 0}` : "N/A" },
                { label: "Agent Version",   value: health.agent?.version ?? "N/A" },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">{label}</p>
                  <p className="text-xl font-bold text-gray-900 tabular-nums">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SLA */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">SLA Commitment</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            {[
              { label: "API Uptime SLA",    value: "99.9%",  sub: "Monthly" },
              { label: "File Delivery SLA", value: "99.95%", sub: "Monthly" },
              { label: "Support Response",  value: "< 24h",  sub: "Business hours" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600 tabular-nums">{value}</span>
              </div>
            ))}
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
