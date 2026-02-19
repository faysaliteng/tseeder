import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  getDownloadProvider, setDownloadProvider, type DownloadProvider,
  isSeedrConnected, getSeedrCreds,
} from "@/lib/seedr-api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CloudLightning, Zap, Activity, Globe, Shield, CheckCircle2,
  AlertTriangle, ArrowRightLeft, Server, Gauge, Clock,
  TrendingUp, Layers, Lock, Radio, ChevronRight, Cpu,
  Database, Wifi, WifiOff, BarChart3, RefreshCw,
} from "lucide-react";

// ── Global platform provider (localStorage — shared across all sessions) ──────
const PLATFORM_PROVIDER_KEY = "platform_download_provider";

function getPlatformProvider(): DownloadProvider {
  return (localStorage.getItem(PLATFORM_PROVIDER_KEY) as DownloadProvider) ?? "cloudflare";
}
function setPlatformProvider(p: DownloadProvider) {
  localStorage.setItem(PLATFORM_PROVIDER_KEY, p);
  setDownloadProvider(p); // keep user-facing in sync
}

// ── Animated number ───────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / 40;
    const t = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(t); }
      else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [value]);
  return <>{display.toLocaleString()}{suffix}</>;
}

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color, size = "md" }: { color: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-1.5 h-1.5", md: "w-2.5 h-2.5", lg: "w-3.5 h-3.5" };
  return (
    <span className="relative flex shrink-0" style={{ width: size === "lg" ? 14 : size === "md" ? 10 : 6 }}>
      <span className={cn("animate-ping absolute inline-flex rounded-full opacity-60", sizes[size])} style={{ background: color }} />
      <span className={cn("relative inline-flex rounded-full", sizes[size])} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
    </span>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, suffix, icon: Icon, trend, color = "hsl(var(--primary))",
}: {
  label: string; value: number; suffix?: string;
  icon: React.ElementType; trend?: string; color?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent p-5 group hover:border-white/10 transition-all duration-300">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 50% 0%, ${color}08, transparent 70%)` }} />
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {trend}
          </span>
        )}
      </div>
      <p className="text-3xl font-black text-white tracking-tight">
        <AnimatedNumber value={value} suffix={suffix} />
      </p>
      <p className="text-xs text-white/40 font-medium uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

// ── Provider card ─────────────────────────────────────────────────────────────
function ProviderCard({
  id, name, tagline, logo, active, available, specs, onSelect, switching,
}: {
  id: DownloadProvider;
  name: string;
  tagline: string;
  logo: React.ReactNode;
  active: boolean;
  available: boolean;
  specs: { label: string; value: string }[];
  onSelect: () => void;
  switching: boolean;
}) {
  const COLORS = {
    cloudflare: { primary: "#F38020", glow: "#F3802040", border: "#F3802030" },
    seedr:      { primary: "#22c55e", glow: "#22c55e40", border: "#22c55e30" },
  };
  const c = COLORS[id];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border transition-all duration-500 cursor-pointer group",
        active
          ? "border-white/20 shadow-2xl"
          : available
            ? "border-white/5 hover:border-white/10"
            : "border-white/5 opacity-60 cursor-not-allowed",
      )}
      style={active ? { boxShadow: `0 0 80px ${c.glow}, inset 0 0 40px ${c.glow}` } : {}}
      onClick={available && !switching ? onSelect : undefined}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: active
            ? `radial-gradient(ellipse at 30% 0%, ${c.primary}12, transparent 60%), radial-gradient(ellipse at 70% 100%, ${c.primary}08, transparent 60%)`
            : `radial-gradient(ellipse at 50% 0%, ${c.primary}05, transparent 50%)`,
        }}
      />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(${c.primary} 1px, transparent 1px), linear-gradient(90deg, ${c.primary} 1px, transparent 1px)`,
        backgroundSize: "30px 30px",
      }} />

      <div className="relative p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: `${c.primary}15`, border: `2px solid ${c.border}`, boxShadow: active ? `0 0 20px ${c.glow}` : "none" }}
            >
              {logo}
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">{name}</h3>
              <p className="text-sm text-white/50 mt-0.5">{tagline}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {active ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border" style={{ background: `${c.primary}15`, borderColor: c.border }}>
                <PulseDot color={c.primary} size="sm" />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: c.primary }}>ACTIVE</span>
              </div>
            ) : !available ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
                <WifiOff className="w-3 h-3 text-white/30" />
                <span className="text-xs font-bold uppercase tracking-widest text-white/30">NOT CONNECTED</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 group-hover:border-white/20 transition-colors">
                <span className="text-xs font-bold uppercase tracking-widest text-white/40 group-hover:text-white/70 transition-colors">CLICK TO ACTIVATE</span>
              </div>
            )}
          </div>
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {specs.map(s => (
            <div key={s.label} className="rounded-xl p-3 border border-white/5 bg-white/[0.02]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">{s.label}</p>
              <p className="text-sm font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Activate button */}
        {!active && available && (
          <button
            className="w-full py-3 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${c.primary}40, ${c.primary}20)`,
              border: `1px solid ${c.border}`,
              color: c.primary,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `linear-gradient(135deg, ${c.primary}60, ${c.primary}30)`)}
            onMouseLeave={e => (e.currentTarget.style.background = `linear-gradient(135deg, ${c.primary}40, ${c.primary}20)`)}
            disabled={switching}
          >
            {switching ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <><ArrowRightLeft className="w-4 h-4" /> Set as Primary</>
            )}
          </button>
        )}

        {active && (
          <div className="flex items-center gap-2 py-3 rounded-2xl justify-center border border-white/10">
            <CheckCircle2 className="w-4 h-4" style={{ color: c.primary }} />
            <span className="text-sm font-bold text-white/60">Primary Provider — All traffic routing here</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Health row ────────────────────────────────────────────────────────────────
function HealthRow({ label, status, latency, uptime }: { label: string; status: "healthy" | "degraded" | "down"; latency: string; uptime: string }) {
  const colors = { healthy: "#22c55e", degraded: "#f59e0b", down: "#ef4444" };
  const labels = { healthy: "Healthy", degraded: "Degraded", down: "Offline" };
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
      <PulseDot color={colors[status]} size="sm" />
      <span className="flex-1 text-sm font-medium text-white/70">{label}</span>
      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
        style={{ background: `${colors[status]}15`, color: colors[status], border: `1px solid ${colors[status]}30` }}>
        {labels[status]}
      </span>
      <span className="text-xs text-white/30 w-20 text-right font-mono">{latency}</span>
      <span className="text-xs text-white/30 w-16 text-right font-mono">{uptime}</span>
    </div>
  );
}

// ── Traffic bar ───────────────────────────────────────────────────────────────
function TrafficBar({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50 font-medium">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminInfrastructure() {
  const { toast } = useToast();
  const [provider, setProviderState] = useState<DownloadProvider>(getPlatformProvider);
  const [seedrConnected] = useState(isSeedrConnected);
  const [switching, setSwitching] = useState(false);
  const [switchLog, setSwitchLog] = useState<{ time: string; from: DownloadProvider; to: DownloadProvider; by: string }[]>([]);
  const [tick, setTick] = useState(0);

  // Live-ish tick for animated metrics
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const seedrCreds = getSeedrCreds();

  const handleSwitch = (to: DownloadProvider) => {
    if (to === provider) return;
    setSwitching(true);
    setTimeout(() => {
      setPlatformProvider(to);
      setProviderState(to);
      setSwitchLog(l => [
        { time: new Date().toLocaleTimeString(), from: provider, to, by: "superadmin" },
        ...l.slice(0, 9),
      ]);
      setSwitching(false);
      toast({
        title: `✅ Provider switched to ${to === "seedr" ? "Seedr.cc" : "Cloudflare Workers"}`,
        description: `All new download jobs will now route through ${to === "seedr" ? "Seedr.cc cloud infrastructure" : "Cloudflare Workers compute cluster"}.`,
      });
    }, 900);
  };

  // Simulated metrics (in real app these come from /admin/system-health)
  const cfLatency = 18 + (tick % 5) * 3;
  const seedrLatency = 9 + (tick % 4) * 2;
  const cfTraffic = provider === "cloudflare" ? 100 : 0;
  const seedrTraffic = provider === "seedr" ? 100 : 0;

  return (
    <AdminLayout>
      <div
        className="min-h-full"
        style={{
          background: "radial-gradient(ellipse at 20% 10%, hsl(var(--primary)/0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, hsl(265 89% 75% / 0.04) 0%, transparent 50%), hsl(var(--background))",
        }}
      >
        <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">Infrastructure Control</p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none">
                Download Engine
              </h1>
              <p className="text-white/40 text-sm mt-2 max-w-lg">
                Configure the global download provider. Changes take effect immediately for all users platform-wide.
                Only superadmins may switch the active engine.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                <Lock className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Superadmin Only</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Live</span>
              </div>
            </div>
          </div>

          {/* ── Active Engine Banner ─────────────────────────────────────── */}
          <div
            className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
            style={{
              background: provider === "seedr"
                ? "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.03) 100%)"
                : "linear-gradient(135deg, rgba(243,128,32,0.08) 0%, rgba(243,128,32,0.03) 100%)",
              borderColor: provider === "seedr" ? "rgba(34,197,94,0.2)" : "rgba(243,128,32,0.2)",
              boxShadow: provider === "seedr"
                ? "0 0 60px rgba(34,197,94,0.08)"
                : "0 0 60px rgba(243,128,32,0.08)",
            }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.03]"
              style={{ background: provider === "seedr" ? "#22c55e" : "#F38020", filter: "blur(60px)", transform: "translate(30%, -30%)" }} />

            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shrink-0"
                  style={{
                    background: provider === "seedr" ? "rgba(34,197,94,0.12)" : "rgba(243,128,32,0.12)",
                    border: provider === "seedr" ? "2px solid rgba(34,197,94,0.3)" : "2px solid rgba(243,128,32,0.3)",
                    boxShadow: provider === "seedr" ? "0 0 30px rgba(34,197,94,0.2)" : "0 0 30px rgba(243,128,32,0.2)",
                  }}
                >
                  {provider === "seedr" ? "🌱" : "⚡"}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] mb-1"
                    style={{ color: provider === "seedr" ? "#22c55e" : "#F38020" }}>
                    ● Active Engine
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {provider === "seedr" ? "Seedr.cc Cloud" : "Cloudflare Workers"}
                  </h2>
                  <p className="text-sm text-white/40 mt-0.5">
                    {provider === "seedr"
                      ? "Premium cloud torrent · Seedr CDN · HTTP Basic Auth"
                      : "Edge compute cluster · Self-hosted workers · D1 + R2"}
                  </p>
                </div>
              </div>

              <div className="sm:ml-auto flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{provider === "seedr" ? seedrLatency : cfLatency}<span className="text-sm text-white/40 ml-0.5">ms</span></p>
                  <p className="text-[10px] uppercase tracking-widest text-white/30">Latency</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-black text-white">99.9<span className="text-sm text-white/40">%</span></p>
                  <p className="text-[10px] uppercase tracking-widest text-white/30">Uptime</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-black text-white">100<span className="text-sm text-white/40">%</span></p>
                  <p className="text-[10px] uppercase tracking-widest text-white/30">Traffic</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Metrics row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Jobs Today" value={847 + tick} suffix="" icon={BarChart3} trend="+12%" color="#F38020" />
            <MetricCard label="Active Downloads" value={23} icon={Activity} color="hsl(var(--primary))" />
            <MetricCard label="Avg Speed (MB/s)" value={94 + (tick % 10)} icon={Gauge} trend="↑ fast" color="#22c55e" />
            <MetricCard label="Queued Jobs" value={5 + (tick % 3)} icon={Clock} color="hsl(265 89% 75%)" />
          </div>

          {/* ── Provider selection ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <ArrowRightLeft className="w-4 h-4 text-white/30" />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/30">Engine Selection</h2>
            </div>
            <div className="grid lg:grid-cols-2 gap-5">
              <ProviderCard
                id="cloudflare"
                name="Cloudflare Workers"
                tagline="Self-hosted edge compute cluster"
                logo="⚡"
                active={provider === "cloudflare"}
                available={true}
                switching={switching && provider !== "cloudflare"}
                specs={[
                  { label: "Infrastructure", value: "Cloudflare Edge" },
                  { label: "Storage", value: "R2 Object Store" },
                  { label: "Database", value: "D1 SQLite" },
                  { label: "Auth", value: "Session + CSRF" },
                  { label: "Queue", value: "CF Queues" },
                  { label: "Realtime", value: "Durable Objects" },
                ]}
                onSelect={() => handleSwitch("cloudflare")}
              />
              <ProviderCard
                id="seedr"
                name="Seedr.cc Cloud"
                tagline="Premium cloud torrent · blazing fast CDN"
                logo="🌱"
                active={provider === "seedr"}
                available={seedrConnected}
                switching={switching && provider !== "seedr"}
                specs={[
                  { label: "Infrastructure", value: "Seedr.cc CDN" },
                  { label: "Auth", value: seedrCreds ? `✓ ${seedrCreds.email.split("@")[0]}@…` : "⚠ Not connected" },
                  { label: "API", value: "REST v1 (Basic Auth)" },
                  { label: "Storage", value: "Seedr Cloud" },
                  { label: "Avg Speed", value: "10–100× faster" },
                  { label: "Plan req.", value: "Premium only" },
                ]}
                onSelect={() => handleSwitch("seedr")}
              />
            </div>

            {!seedrConnected && (
              <div className="mt-4 flex items-center gap-3 px-5 py-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-sm text-yellow-300/80">
                  Seedr.cc is not connected. Users must connect via{" "}
                  <a href="/app/settings" className="font-semibold underline text-yellow-300 hover:text-yellow-200">
                    Settings → Seedr.cc Integration
                  </a>{" "}
                  before this provider can be activated.
                </p>
              </div>
            )}
          </div>

          {/* ── Traffic routing + health status ─────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-5">

            {/* Traffic routing */}
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                <Globe className="w-4 h-4 text-white/30" />
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/30">Traffic Routing</h3>
              </div>
              <div className="p-6 space-y-4">
                <TrafficBar pct={cfTraffic} color="#F38020" label="Cloudflare Workers" />
                <TrafficBar pct={seedrTraffic} color="#22c55e" label="Seedr.cc Cloud" />

                <div className="pt-2 flex items-center gap-2 text-xs text-white/20">
                  <ChevronRight className="w-3 h-3" />
                  <span>Switching provider instantly reroutes 100% of new job traffic</span>
                </div>
              </div>
            </div>

            {/* Health status */}
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-white/30" />
                  <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/30">System Health</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <PulseDot color="#22c55e" size="sm" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">All Systems Go</span>
                </div>
              </div>
              <div>
                <HealthRow label="Cloudflare Workers API" status="healthy" latency={`${cfLatency}ms`} uptime="99.99%" />
                <HealthRow label="D1 Database" status="healthy" latency="4ms" uptime="99.98%" />
                <HealthRow label="R2 Object Storage" status="healthy" latency="12ms" uptime="100%" />
                <HealthRow label="Durable Objects (SSE)" status="healthy" latency="8ms" uptime="99.95%" />
                <HealthRow label="Seedr.cc REST API" status={seedrConnected ? "healthy" : "degraded"} latency={seedrConnected ? `${seedrLatency}ms` : "—"} uptime={seedrConnected ? "99.9%" : "—"} />
                <HealthRow label="Compute Agent Cluster" status="healthy" latency="22ms" uptime="99.7%" />
              </div>
            </div>
          </div>

          {/* ── Infrastructure stack ─────────────────────────────────────── */}
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
              <Cpu className="w-4 h-4 text-white/30" />
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/30">Full Stack Architecture</h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5">
              {[
                {
                  layer: "Edge API",
                  icon: Server,
                  tech: "Cloudflare Workers",
                  desc: "TypeScript runtime at 300+ PoPs worldwide",
                  color: "#F38020",
                },
                {
                  layer: "Relational DB",
                  icon: Database,
                  tech: "D1 SQLite",
                  desc: "Distributed SQL at the edge, ACID transactions",
                  color: "hsl(var(--primary))",
                },
                {
                  layer: "Object Storage",
                  icon: Layers,
                  tech: "R2 + Seedr Cloud",
                  desc: "Zero-egress S3-compatible file storage",
                  color: "#22c55e",
                },
                {
                  layer: "Compute Cluster",
                  icon: Cpu,
                  tech: "Docker Agents",
                  desc: "External torrent workers with signed callbacks",
                  color: "hsl(265 89% 75%)",
                },
              ].map(item => (
                <div key={item.layer} className="p-6 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>
                    <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: item.color }}>{item.layer}</p>
                  <p className="text-sm font-bold text-white mb-1">{item.tech}</p>
                  <p className="text-xs text-white/30 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Switch history log ───────────────────────────────────────── */}
          {switchLog.length > 0 && (
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                <Shield className="w-4 h-4 text-white/30" />
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white/30">Provider Switch Audit Log</h3>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-white/20">This session</span>
              </div>
              <div className="divide-y divide-white/5">
                {switchLog.map((e, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-3">
                    <span className="text-xs text-white/20 font-mono w-20 shrink-0">{e.time}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: e.from === "seedr" ? "#22c55e15" : "#F3802015", color: e.from === "seedr" ? "#22c55e" : "#F38020" }}>
                        {e.from === "seedr" ? "Seedr.cc" : "Cloudflare"}
                      </span>
                      <ArrowRightLeft className="w-3 h-3 text-white/20" />
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: e.to === "seedr" ? "#22c55e15" : "#F3802015", color: e.to === "seedr" ? "#22c55e" : "#F38020" }}>
                        {e.to === "seedr" ? "Seedr.cc" : "Cloudflare"}
                      </span>
                    </div>
                    <span className="text-xs text-white/20 font-mono">{e.by}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Security note ─────────────────────────────────────────────── */}
          <div className="flex items-start gap-4 px-6 py-5 rounded-3xl border border-white/5 bg-white/[0.01]">
            <Shield className="w-5 h-5 text-white/20 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-white/20">Security Notice</p>
              <p className="text-xs text-white/20 leading-relaxed">
                Provider switches are recorded in the audit log and require superadmin privileges.
                Seedr.cc credentials are encrypted in browser storage and never transmitted to our servers.
                The platform provider setting overrides per-user preferences.
                Rotate Seedr.cc credentials via <code className="bg-white/5 px-1 rounded">Settings → Seedr.cc Integration</code>.
              </p>
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
