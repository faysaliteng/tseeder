import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { admin as adminApi } from "@/lib/api";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import tseederLogo from "@/assets/tseeder-logo.png";

type HealthStatus = "operational" | "degraded" | "outage" | "loading";

interface ComponentStatus {
  name: string;
  description: string;
  status: HealthStatus;
}

function StatusIndicator({ status }: { status: HealthStatus }) {
  if (status === "loading") return <div className="w-2.5 h-2.5 rounded-full bg-muted animate-pulse" />;
  if (status === "operational") return <div className="w-2.5 h-2.5 rounded-full bg-success animate-glow-pulse" style={{ boxShadow: "0 0 6px hsl(142 71% 45%)" }} />;
  if (status === "degraded") return <div className="w-2.5 h-2.5 rounded-full bg-warning animate-glow-pulse" style={{ boxShadow: "0 0 6px hsl(38 92% 50%)" }} />;
  return <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-glow-pulse" style={{ boxShadow: "0 0 6px hsl(0 72% 51%)" }} />;
}

function StatusBadge({ status }: { status: HealthStatus }) {
  if (status === "loading") return <span className="text-xs text-muted-foreground">Checking…</span>;
  const map = {
    operational: { label: "Operational", color: "text-success" },
    degraded: { label: "Degraded Performance", color: "text-warning" },
    outage: { label: "Major Outage", color: "text-destructive" },
  };
  const cfg = map[status];
  return <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>;
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "loading") return null;
  if (status === "operational") return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (status === "degraded") return <AlertTriangle className="w-4 h-4 text-warning" />;
  return <XCircle className="w-4 h-4 text-destructive" />;
}

export default function StatusPage() {
  const { data: health, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["status-health"],
    queryFn: () => adminApi.systemHealth() as Promise<any>,
    refetchInterval: 60_000,
    retry: 1,
  });

  const getOverallStatus = (): HealthStatus => {
    if (isLoading) return "loading";
    if (!health) return "outage";
    if (health.status !== "healthy") return "degraded";
    if ((health.failedLast24h ?? 0) > 10) return "degraded";
    return "operational";
  };

  const overall = getOverallStatus();

  const agentStatus: HealthStatus = isLoading ? "loading"
    : !health ? "outage"
    : health.status === "healthy" ? "operational"
    : "degraded";

  const apiStatus: HealthStatus = isLoading ? "loading" : health ? "operational" : "outage";

  const components: ComponentStatus[] = [
    {
      name: "API Gateway",
      description: "Cloudflare Workers API — authentication, job submission, file management",
      status: apiStatus,
    },
    {
      name: "Download Queue",
      description: "Cloudflare Queues — job dispatch, retry orchestration, DLQ",
      status: isLoading ? "loading" : health ? "operational" : "degraded",
    },
    {
      name: "Compute Agents",
      description: "External torrent processing cluster — download, seed, upload pipeline",
      status: agentStatus,
    },
    {
      name: "File Storage (R2)",
      description: "Cloudflare R2 — encrypted file storage and signed URL delivery",
      status: isLoading ? "loading" : health ? "operational" : "degraded",
    },
    {
      name: "Realtime Progress (DO)",
      description: "Durable Objects — SSE job progress, live dashboard updates",
      status: isLoading ? "loading" : health ? "operational" : "degraded",
    },
    {
      name: "Web Dashboard",
      description: "Cloudflare Pages — frontend UI, static assets, edge delivery",
      status: "operational",
    },
  ];

  const overallBg = {
    loading: "from-muted/30 to-muted/10",
    operational: "from-success/10 to-success/5",
    degraded: "from-warning/10 to-warning/5",
    outage: "from-destructive/10 to-destructive/5",
  }[overall];

  const overallBorder = {
    loading: "border-border/40",
    operational: "border-success/30",
    degraded: "border-warning/30",
    outage: "border-destructive/30",
  }[overall];

  const overallLabel = {
    loading: "Checking system health…",
    operational: "All Systems Operational",
    degraded: "Partial System Degradation",
    outage: "Major Service Outage",
  }[overall];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-primary/30">
              <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
            </div>
            <span className="text-base font-black tracking-tight text-gradient">tseeder</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Platform</p>
          <h1 className="text-4xl font-black tracking-tight mb-2">System Status</h1>
          <p className="text-sm text-muted-foreground">Real-time health of the tseeder platform, updated every 60 seconds.</p>
        </div>

        {/* Overall status banner */}
        <div className={cn(
          "flex items-center gap-4 p-5 rounded-2xl border bg-gradient-to-r mb-8",
          overallBg, overallBorder
        )}>
          <StatusIndicator status={overall} />
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">{overallLabel}</p>
            {dataUpdatedAt > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Last checked {new Date(dataUpdatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Component list */}
        <div className="glass-card rounded-2xl border border-border/40 overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-border/40 bg-muted/10">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Components</h2>
          </div>
          <div className="divide-y divide-border/30">
            {components.map((c) => (
              <div key={c.name} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/5 transition-colors">
                <StatusIndicator status={c.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusIcon status={c.status} />
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics from health endpoint */}
        {health && (
          <div className="glass-card rounded-2xl border border-border/40 overflow-hidden mb-8">
            <div className="px-5 py-3 border-b border-border/40 bg-muted/10">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Live Metrics</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-border/30">
              {[
                { label: "Active Jobs", value: (Object.values(health.jobs ?? {}) as number[]).filter((_, k) => ["downloading","uploading","metadata_fetch","queued"].includes(Object.keys(health.jobs ?? {})[k])).reduce((a: number, b: number) => a + b, 0) ?? "—" },
                { label: "Failed (24h)", value: health.failedLast24h ?? 0 },
                { label: "Agent Capacity", value: health.agent ? `${health.agent.activeJobs ?? 0}/${health.agent.maxJobs ?? 0}` : "N/A" },
                { label: "Agent Version", value: health.agent?.version ?? "N/A" },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">{label}</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uptime SLA */}
        <div className="glass-card rounded-2xl border border-border/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40 bg-muted/10">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">SLA Commitment</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            {[
              { label: "API Uptime SLA", value: "99.9%", sub: "Monthly" },
              { label: "File Delivery SLA", value: "99.95%", sub: "Monthly" },
              { label: "Support Response", value: "< 24h", sub: "Business hours" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                <span className="text-sm font-bold text-success tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border/40 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA / Abuse</Link>
        </div>
      </main>
    </div>
  );
}
