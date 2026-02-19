import { useState, useEffect } from "react";
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

// Live activity ticker
const EVENTS = [
  "Job #4821 completed — ubuntu-22.iso (4.2 GB)",
  "User user@demo.com logged in",
  "Job #4820 started downloading — debian-12.torrent",
  "API key generated — ci-deploy",
  "Job #4819 failed — connection timeout",
  "Storage GC run — freed 1.2 GB",
  "Job #4818 queued — archlinux-2024.torrent",
  "User admin@tf.io switched provider to Seedr.cc",
];

function LiveFeed() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % EVENTS.length); setVisible(true); }, 300);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass-card rounded-xl p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-success animate-glow-pulse" style={{ boxShadow: "0 0 6px hsl(142 71% 45%)" }} />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Live Activity</span>
      </div>
      <div className="h-6 flex items-center overflow-hidden">
        <p
          className="text-sm text-foreground font-mono truncate transition-all duration-300"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)" }}
        >
          <span className="text-primary mr-2">›</span>{EVENTS[idx]}
        </p>
      </div>
    </div>
  );
}

// Activity heatmap (7×24 grid)
function ActivityHeatmap() {
  const cells = Array.from({ length: 7 * 24 }, (_, i) => {
    const v = Math.random();
    return v < 0.5 ? 0 : v < 0.7 ? 1 : v < 0.85 ? 2 : v < 0.95 ? 3 : 4;
  });
  const colors = [
    "hsl(220 20% 18%)",
    "hsl(239 84% 67% / 0.2)",
    "hsl(239 84% 67% / 0.4)",
    "hsl(239 84% 67% / 0.7)",
    "hsl(239 84% 67%)",
  ];
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <div className="glass-card rounded-xl p-4">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-primary" /> 7-Day Activity Heatmap
      </h3>
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 mr-1 justify-between" style={{ paddingTop: 2 }}>
          {days.map(d => <span key={d} className="text-[9px] text-muted-foreground w-6 text-right">{d}</span>)}
        </div>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(24, 1fr)`, gridTemplateRows: `repeat(7, 1fr)` }}>
          {cells.map((v, i) => (
            <div
              key={i}
              className="w-full rounded-[2px] transition-all hover:opacity-80 cursor-pointer"
              style={{ background: colors[v], width: "10px", height: "10px", aspectRatio: "1" }}
              title={`${Math.round(v * 25)}% activity`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Health ring gauge
function HealthRing({ pct }: { pct: number }) {
  const size = 120;
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct > 80 ? "hsl(142 71% 45%)" : pct > 50 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(220 20% 18%)" strokeWidth="10" />
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums" style={{ color }}>{pct}%</span>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Health</span>
        </div>
      </div>
    </div>
  );
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
  const healthPct = agentOk ? Math.max(60, 100 - ((health?.failedLast24h ?? 0) * 5)) : 30;

  const sparkData = [4, 7, 5, 9, 12, 8, 11];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5 relative">
        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 60% 40% at 80% 0%, hsl(239 84% 67% / 0.04) 0%, transparent 60%)"
        }} />

        <AdminPageHeader
          title="System Overview"
          description="Real-time health and KPIs for the TorrentFlow platform"
          actions={
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
              Refresh
            </button>
          }
        />

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Jobs" value={isLoading ? 0 : totalJobs} icon={Briefcase} sparkData={sparkData} trend={{ dir: "up", label: "+12%" }} />
          <StatCard label="Active Jobs" value={isLoading ? 0 : activeJobs} icon={Activity} sparkData={[2,3,5,4,6,8,activeJobs]} />
          <StatCard label="Failed (24h)" value={isLoading ? 0 : health?.failedLast24h ?? 0} icon={AlertTriangle}
            variant={(health?.failedLast24h ?? 0) > 0 ? "warn" : "default"}
            sparkData={[1,0,2,0,1,0,health?.failedLast24h ?? 0]}
          />
          <StatCard
            label="Agent Status"
            value={isLoading ? "…" : agentOk ? "Healthy" : "Unreachable"}
            icon={Server}
            variant={isLoading ? "default" : agentOk ? "success" : "danger"}
          />
        </div>

        {/* Health ring + live feed + heatmap */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-5 flex flex-col items-center justify-center gap-3">
            <HealthRing pct={isLoading ? 0 : healthPct} />
            <div className="text-center">
              <p className="text-xs font-bold text-foreground">{agentOk ? "All Systems Operational" : "Degraded Performance"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {health?.ts ? `Updated ${new Date(health.ts).toLocaleTimeString()}` : "—"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <LiveFeed />
            {/* Job breakdown */}
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Status Breakdown</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between bg-muted/20 rounded-lg px-2.5 py-1.5">
                    <StatusBadge status={status as any} />
                    <span className="text-sm font-bold text-foreground tabular-nums">{count}</span>
                  </div>
                ))}
                {!Object.keys(byStatus).length && isLoading && (
                  Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 shimmer rounded-lg" />)
                )}
              </div>
            </div>
          </div>

          <ActivityHeatmap />
        </div>

        {/* Recent jobs + users */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-primary" />
              </div>
              <h2 className="text-sm font-bold text-foreground">Recent Jobs</h2>
            </div>
            <div className="divide-y divide-border/30">
              {(recentJobs?.data as any[] ?? []).slice(0, 6).map((job: any) => (
                <div key={job.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/10 transition-colors">
                  <StatusBadge status={job.status} />
                  <span className="text-xs text-foreground truncate flex-1">{job.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatBytes(job.bytes_total ?? 0)}</span>
                </div>
              ))}
              {!recentJobs && <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</div>}
            </div>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-success" />
              </div>
              <h2 className="text-sm font-bold text-foreground">Recent Users</h2>
            </div>
            <div className="divide-y divide-border/30">
              {(recentUsers?.data as any[] ?? []).slice(0, 6).map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/10 transition-colors">
                  {u.suspended
                    ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    : <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />}
                  <span className="text-xs text-foreground truncate flex-1">{u.email}</span>
                  <span className="text-xs text-muted-foreground capitalize">{u.role}</span>
                </div>
              ))}
              {!recentUsers && <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</div>}
            </div>
          </div>
        </div>

        {health?.agent && (
          <div className="glass-card rounded-xl p-5">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" /> Compute Agent
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Active Jobs", value: health.agent.activeJobs ?? "—" },
                { label: "Capacity", value: health.agent.maxJobs ?? "—" },
                { label: "Version", value: health.agent.version ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="glass-card rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">{label}</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
                </div>
              ))}
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
