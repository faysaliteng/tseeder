import { useState, useEffect, useRef } from "react";

// ── Count-up hook ──────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof target !== "number" || isNaN(target)) return;
    let start: number | null = null;
    const from = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * ease));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

// ── Sparkline SVG ──────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 64, h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="opacity-70">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────────
const VARIANT_STYLES = {
  default: {
    icon: "text-primary",
    iconBg: "bg-primary/10 border-primary/20",
    iconGlow: "shadow-[0_0_12px_hsl(239_84%_67%/0.3)]",
    value: "text-foreground",
    spark: "hsl(239,84%,67%)",
    trend: "text-primary",
  },
  warn: {
    icon: "text-warning",
    iconBg: "bg-warning/10 border-warning/20",
    iconGlow: "shadow-[0_0_12px_hsl(38_92%_50%/0.3)]",
    value: "text-warning",
    spark: "hsl(38,92%,50%)",
    trend: "text-warning",
  },
  danger: {
    icon: "text-destructive",
    iconBg: "bg-destructive/10 border-destructive/20",
    iconGlow: "shadow-[0_0_12px_hsl(0_72%_51%/0.3)]",
    value: "text-destructive",
    spark: "hsl(0,72%,51%)",
    trend: "text-destructive",
  },
  success: {
    icon: "text-success",
    iconBg: "bg-success/10 border-success/20",
    iconGlow: "shadow-[0_0_12px_hsl(142_71%_45%/0.3)]",
    value: "text-success",
    spark: "hsl(142,71%,45%)",
    trend: "text-success",
  },
};

export function StatCard({
  label, value, sub, icon: Icon, variant = "default", trend, sparkData,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ElementType;
  variant?: "default" | "warn" | "danger" | "success";
  trend?: { dir: "up" | "down"; label: string };
  sparkData?: number[];
}) {
  const styles = VARIANT_STYLES[variant];
  const numericValue = typeof value === "number" ? value : typeof value === "string" ? parseFloat(value) : NaN;
  const animated = useCountUp(isNaN(numericValue) ? 0 : numericValue);
  const displayValue = typeof value === "number" ? animated : value;

  return (
    <div className="glass-card rounded-xl p-4 hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden">
      {/* Subtle ambient glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top right, ${styles.spark}10 0%, transparent 70%)` }} />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${styles.iconBg} ${styles.iconGlow}`}>
            <Icon className={`w-4 h-4 ${styles.icon}`} />
          </div>
          {sparkData && <Sparkline data={sparkData} color={styles.spark} />}
        </div>

        <p className={`text-2xl font-bold tabular-nums tracking-tight animate-slide-up-fade ${styles.value}`}>
          {displayValue}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          {trend && (
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${styles.trend}`}>
              {trend.dir === "up" ? "↑" : "↓"} {trend.label}
            </span>
          )}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── AdminPageHeader ────────────────────────────────────────────────────────────
export function AdminPageHeader({
  title, description, actions,
}: {
  title: string; description?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ── AdminTable ─────────────────────────────────────────────────────────────────
export function AdminTable({
  headers, children, loading, empty = "No results",
}: {
  headers: string[];
  children: React.ReactNode;
  loading?: boolean;
  empty?: string;
}) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60" style={{ background: "linear-gradient(90deg, hsl(220 24% 12%), hsl(220 26% 10%))" }}>
              {headers.map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  <span className="flex items-center gap-1">{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-muted/10">
                    {headers.map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-3 shimmer rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : children}
          </tbody>
        </table>
        {!loading && !children && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <svg width="48" height="48" viewBox="0 0 48 48" className="text-muted-foreground/30 mb-4">
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 4" />
              <path d="M16 24h16M24 16v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            </svg>
            <p className="text-sm text-muted-foreground">{empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Paginator ─────────────────────────────────────────────────────────────────
export function Paginator({
  page, totalPages, onPage,
}: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/5">
      <span className="text-xs text-muted-foreground">Page <span className="font-semibold text-foreground">{page}</span> of {totalPages}</span>
      <div className="flex gap-1.5">
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p = i + 1;
          return (
            <button
              key={p}
              disabled={p === page}
              onClick={() => onPage(p)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all duration-150 ${
                p === page
                  ? "gradient-primary text-white shadow-glow-primary"
                  : "text-muted-foreground border border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5"
              }`}
            >
              {p}
            </button>
          );
        })}
        {totalPages > 7 && (
          <>
            <span className="w-7 h-7 flex items-center justify-center text-xs text-muted-foreground">…</span>
            <button
              onClick={() => onPage(totalPages)}
              className="w-7 h-7 rounded-lg text-xs font-semibold text-muted-foreground border border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
            >
              {totalPages}
            </button>
          </>
        )}
      </div>
      <div className="flex gap-1.5">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-primary/10 hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >← Prev</button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-primary/10 hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >Next →</button>
      </div>
    </div>
  );
}

// ── DangerModal ────────────────────────────────────────────────────────────────
export function DangerModal({
  open, title, description, confirmPhrase, reasonRequired,
  onClose, onConfirm, isPending,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmPhrase: string;
  reasonRequired?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [shake, setShake] = useState(false);

  if (!open) return null;

  const ready = typed === confirmPhrase && (!reasonRequired || reason.trim().length > 0);

  const handleWrongType = () => {
    if (typed && typed !== confirmPhrase) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay with radial red glow */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, hsl(0 72% 51% / 0.12) 0%, hsl(220 26% 0% / 0.85) 60%)" }}
        onClick={onClose}
      />
      <div className={`relative glass-card neon-border-danger rounded-2xl p-6 w-full max-w-md space-y-4 animate-danger-pulse ${shake ? "animate-shake" : ""}`}>
        {/* Pulsing red border overlay */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: "1px solid hsl(0 72% 51% / 0.4)", animation: "danger-pulse 1.5s ease-in-out infinite" }} />

        {/* Warning icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center shrink-0 shadow-glow-danger">
            <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-destructive">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        {reasonRequired && (
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5 uppercase tracking-wider">Reason <span className="text-destructive">*</span></label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-destructive/60 transition-colors resize-none"
              placeholder="Enter a reason…"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5 uppercase tracking-wider">
            Type <code className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-mono">{confirmPhrase}</code> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onBlur={handleWrongType}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-destructive/60 transition-colors"
            placeholder={confirmPhrase}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!ready || isPending}
            onClick={() => { onConfirm(reason); setTyped(""); setReason(""); }}
            className="flex-1 py-2.5 rounded-lg bg-destructive text-white text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-glow-danger"
          >
            {isPending ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
