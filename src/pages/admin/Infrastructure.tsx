import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { providers as providersApi, type ProviderConfig, type ProviderHealth, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CloudLightning, Zap, Activity, Shield, CheckCircle2,
  AlertTriangle, ArrowRightLeft, Lock, Radio, Cpu,
  Wifi, WifiOff, RefreshCw, History, ChevronRight, XCircle,
  Clock, AlertCircle, CheckCircle,
} from "lucide-react";

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color, size = "md" }: { color: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-1.5 h-1.5", md: "w-2.5 h-2.5", lg: "w-3.5 h-3.5" };
  const dims = { sm: 6, md: 10, lg: 14 };
  return (
    <span className="relative flex shrink-0" style={{ width: dims[size], height: dims[size] }}>
      <span className={cn("animate-ping absolute inline-flex rounded-full opacity-60", sizes[size])} style={{ background: color }} />
      <span className={cn("relative inline-flex rounded-full", sizes[size])} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
    </span>
  );
}

// ── Status icon ───────────────────────────────────────────────────────────────
function HealthStatusBadge({ status }: { status: ProviderHealth["status"] }) {
  const map = {
    healthy: { color: "#22c55e", label: "Healthy", Icon: CheckCircle },
    degraded: { color: "#f59e0b", label: "Degraded", Icon: AlertTriangle },
    down: { color: "#ef4444", label: "Offline", Icon: XCircle },
    unknown: { color: "#6b7280", label: "Unknown", Icon: AlertCircle },
  };
  const { color, label, Icon } = map[status] ?? map.unknown;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── Provider card ─────────────────────────────────────────────────────────────
function ProviderCard({
  id, name, tagline, active, health, onSelect, switching, onVerify, verifying, seedrConfig, setSeedrConfig,
}: {
  id: "cloudflare" | "seedr";
  name: string;
  tagline: string;
  active: boolean;
  health: ProviderHealth | undefined;
  onSelect: () => void;
  switching: boolean;
  onVerify: (config?: Record<string, unknown>) => void;
  verifying: boolean;
  seedrConfig?: { email: string; password: string };
  setSeedrConfig?: (c: { email: string; password: string }) => void;
}) {
  const COLORS = {
    cloudflare: { primary: "#F38020", glow: "#F3802040", border: "#F3802030" },
    seedr: { primary: "#22c55e", glow: "#22c55e40", border: "#22c55e30" },
  };
  const c = COLORS[id];

  const isAvailable = id === "cloudflare" || (id === "seedr" && !!seedrConfig?.email);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border transition-all duration-500",
        active ? "border-white/20 shadow-2xl" : "border-white/5",
      )}
      style={active ? { boxShadow: `0 0 80px ${c.glow}, inset 0 0 40px ${c.glow}` } : {}}
    >
      <div className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: active
            ? `radial-gradient(ellipse at 30% 0%, ${c.primary}12, transparent 60%)`
            : `radial-gradient(ellipse at 50% 0%, ${c.primary}05, transparent 50%)`,
        }} />

      <div className="relative p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: `${c.primary}15`, border: `2px solid ${c.border}`, boxShadow: active ? `0 0 20px ${c.glow}` : "none" }}>
              {id === "cloudflare" ? "⚡" : "🌱"}
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
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
                <span className="text-xs font-bold uppercase tracking-widest text-white/30">INACTIVE</span>
              </div>
            )}
            {health && <HealthStatusBadge status={health.status} />}
          </div>
        </div>

        {/* Health row */}
        {health && (
          <div className="mb-5 p-3 rounded-xl border border-white/5 bg-white/[0.02] flex items-center gap-3 text-xs text-white/50">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>
              {health.latencyMs != null ? `${health.latencyMs}ms` : "—"}
              {" · "}
              Last checked: {new Date(health.checkedAt).toLocaleTimeString()}
            </span>
            {health.error && (
              <span className="ml-auto text-red-400 truncate max-w-[200px]" title={health.error}>{health.error}</span>
            )}
          </div>
        )}

        {/* Seedr credentials form (only when inactive) */}
        {id === "seedr" && !active && setSeedrConfig && (
          <div className="mb-5 space-y-2">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Seedr.cc Credentials</p>
            <input
              type="email"
              placeholder="Email address"
              value={seedrConfig?.email ?? ""}
              onChange={e => setSeedrConfig({ email: e.target.value, password: seedrConfig?.password ?? "" })}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
            <input
              type="password"
              placeholder="Password"
              value={seedrConfig?.password ?? ""}
              onChange={e => setSeedrConfig({ email: seedrConfig?.email ?? "", password: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onVerify(id === "seedr" ? seedrConfig : undefined)}
            disabled={verifying}
            className="flex-1 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white/60"
          >
            {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
            Verify
          </button>

          {!active && (
            <button
              onClick={onSelect}
              disabled={switching || (!isAvailable)}
              className="flex-1 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${c.primary}40, ${c.primary}20)`,
                border: `1px solid ${c.border}`,
                color: c.primary,
                opacity: !isAvailable ? 0.4 : 1,
              }}
            >
              {switching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
              Activate
            </button>
          )}

          {active && (
            <div className="flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-2 border border-white/10">
              <CheckCircle2 className="w-4 h-4" style={{ color: c.primary }} />
              <span className="text-xs font-bold text-white/50">Primary Provider</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminInfrastructure() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [switchNote, setSwitchNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [seedrConfig, setSeedrConfig] = useState({ email: "", password: "" });

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "providers"],
    queryFn: () => providersApi.list(),
    refetchInterval: 30_000,
  });

  const { data: historyData } = useQuery({
    queryKey: ["admin", "providers", "history"],
    queryFn: () => providersApi.history(1),
    enabled: showHistory,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const switchMutation = useMutation({
    mutationFn: ({ provider, config, note }: { provider: "cloudflare" | "seedr"; config?: Record<string, unknown>; note?: string }) =>
      providersApi.switch(provider, config, note),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast({
        title: `✅ Provider switched to ${result.provider}`,
        description: result.message,
      });
      setSwitchNote("");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Switch failed";
      toast({ title: "Switch failed", description: msg, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ provider, config }: { provider: "cloudflare" | "seedr"; config?: Record<string, unknown> }) =>
      providersApi.verify(provider, config),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast({
        title: result.status === "healthy" ? "✅ Connection healthy" : `⚠️ ${result.status}`,
        description: result.error ?? `${result.provider} responded in ${result.latencyMs ?? "?"}ms`,
        variant: result.status === "healthy" ? "default" : "destructive",
      });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Verification failed";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
    },
  });

  const activeProvider = data?.activeProvider ?? "cloudflare";
  const healthMap = Object.fromEntries(
    (data?.health ?? []).map(h => [h.provider, h]),
  ) as Record<string, ProviderHealth>;

  const handleSwitch = (provider: "cloudflare" | "seedr") => {
    const config = provider === "seedr" ? { email: seedrConfig.email, password: seedrConfig.password } : undefined;
    switchMutation.mutate({ provider, config, note: switchNote || undefined });
  };

  const handleVerify = (provider: "cloudflare" | "seedr", config?: Record<string, unknown>) => {
    verifyMutation.mutate({ provider, config });
  };

  return (
    <AdminLayout>
      <div style={{
        background: "radial-gradient(ellipse at 20% 10%, hsl(var(--primary)/0.06) 0%, transparent 50%), hsl(var(--background))",
        minHeight: "100%",
      }}>
        <div className="p-6 sm:p-8 space-y-8 max-w-6xl mx-auto">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CloudLightning className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">Infrastructure Control</p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none">Download Engine</h1>
              <p className="text-white/40 text-sm mt-2 max-w-lg">
                Configure the global download provider. Changes are persisted to D1, logged to the audit trail, and take effect immediately for all users.
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
              <button
                onClick={() => refetch()}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </button>
            </div>
          </div>

          {isError && (
            <div className="p-4 rounded-2xl border border-destructive/20 bg-destructive/10 flex items-center gap-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Could not load provider data. Check that the API is running and you are authenticated as admin.
            </div>
          )}

          {/* ── Active Engine Banner ──────────────────────────────────── */}
          {!isLoading && (
            <div
              className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
              style={{
                background: activeProvider === "seedr"
                  ? "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.03) 100%)"
                  : "linear-gradient(135deg, rgba(243,128,32,0.08) 0%, rgba(243,128,32,0.03) 100%)",
                borderColor: activeProvider === "seedr" ? "rgba(34,197,94,0.2)" : "rgba(243,128,32,0.2)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                    style={{
                      background: activeProvider === "seedr" ? "rgba(34,197,94,0.12)" : "rgba(243,128,32,0.12)",
                      border: activeProvider === "seedr" ? "2px solid rgba(34,197,94,0.3)" : "2px solid rgba(243,128,32,0.3)",
                    }}>
                    {activeProvider === "seedr" ? "🌱" : "⚡"}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] mb-1"
                      style={{ color: activeProvider === "seedr" ? "#22c55e" : "#F38020" }}>● Active Engine</p>
                    <h2 className="text-2xl font-black text-white">
                      {activeProvider === "seedr" ? "Seedr.cc Cloud" : "Cloudflare Workers"}
                    </h2>
                    <p className="text-sm text-white/40 mt-0.5">All new download jobs route through this provider</p>
                  </div>
                </div>
                {healthMap[activeProvider] && (
                  <div className="sm:ml-auto">
                    <HealthStatusBadge status={healthMap[activeProvider].status} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Provider Cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProviderCard
              id="cloudflare"
              name="Cloudflare Workers"
              tagline="Self-hosted compute cluster — full control"
              active={activeProvider === "cloudflare"}
              health={healthMap["cloudflare"]}
              onSelect={() => handleSwitch("cloudflare")}
              switching={switchMutation.isPending && switchMutation.variables?.provider === "cloudflare"}
              onVerify={(config) => handleVerify("cloudflare", config)}
              verifying={verifyMutation.isPending && verifyMutation.variables?.provider === "cloudflare"}
            />

            <ProviderCard
              id="seedr"
              name="Seedr.cc"
              tagline="Managed cloud — zero infrastructure"
              active={activeProvider === "seedr"}
              health={healthMap["seedr"]}
              onSelect={() => handleSwitch("seedr")}
              switching={switchMutation.isPending && switchMutation.variables?.provider === "seedr"}
              onVerify={(config) => handleVerify("seedr", config)}
              verifying={verifyMutation.isPending && verifyMutation.variables?.provider === "seedr"}
              seedrConfig={seedrConfig}
              setSeedrConfig={setSeedrConfig}
            />
          </div>

          {/* ── Switch Note ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <label className="text-xs font-semibold uppercase tracking-widest text-white/40 block mb-2">
              Switch Reason (optional — recorded in audit log)
            </label>
            <input
              type="text"
              placeholder="e.g. Seedr maintenance window, switching to self-hosted for cost control…"
              value={switchNote}
              onChange={e => setSwitchNote(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* ── Change History ───────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <History className="w-4 h-4 text-white/40" />
                <span className="text-sm font-bold text-white/60 uppercase tracking-widest">Provider Change History</span>
              </div>
              <ChevronRight className={cn("w-4 h-4 text-white/30 transition-transform", showHistory && "rotate-90")} />
            </button>

            {showHistory && (
              <div className="border-t border-white/5">
                {!historyData ? (
                  <div className="p-6 text-center text-white/30 text-sm">Loading history…</div>
                ) : historyData.data.length === 0 ? (
                  <div className="p-6 text-center text-white/30 text-sm">No history yet</div>
                ) : (
                  historyData.data.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-4 px-6 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                        style={{ background: entry.provider === "seedr" ? "rgba(34,197,94,0.12)" : "rgba(243,128,32,0.12)" }}>
                        {entry.provider === "seedr" ? "🌱" : "⚡"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          Switched to {entry.provider === "seedr" ? "Seedr.cc" : "Cloudflare Workers"}
                        </p>
                        {entry.note && <p className="text-xs text-white/40 truncate">{entry.note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-white/40">{entry.createdBy ?? "system"}</p>
                        <p className="text-xs text-white/25">{new Date(entry.createdAt).toLocaleString()}</p>
                      </div>
                      {entry.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">Current</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
