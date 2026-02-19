// Shared stat card for admin pages
export function StatCard({
  label, value, sub, icon: Icon, variant = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ElementType;
  variant?: "default" | "warn" | "danger" | "success";
}) {
  const colours = {
    default: "text-muted-foreground",
    warn: "text-[hsl(var(--warning))]",
    danger: "text-destructive",
    success: "text-[hsl(var(--success))]",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${colours[variant]}`} />
      </div>
      <p className={`text-2xl font-bold ${colours[variant]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// Section header
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

// Data table wrapper
export function AdminTable({
  headers, children, loading, empty = "No results",
}: {
  headers: string[];
  children: React.ReactNode;
  loading?: boolean;
  empty?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              {headers.map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {headers.map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Paginator
export function Paginator({
  page, totalPages, onPage,
}: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
      <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-3 py-1 text-xs rounded border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >Prev</button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="px-3 py-1 text-xs rounded border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >Next</button>
      </div>
    </div>
  );
}

// Danger confirm modal
import { useState } from "react";
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
  if (!open) return null;
  const ready = typed === confirmPhrase && (!reasonRequired || reason.trim().length > 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-destructive/60 rounded-xl shadow-card p-6 w-full max-w-md space-y-4">
        <h2 className="text-base font-bold text-destructive">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {reasonRequired && (
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Reason (required)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="Enter a reason…"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">
            Type <code className="bg-muted px-1 rounded">{confirmPhrase}</code> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-destructive transition-colors"
            placeholder={confirmPhrase}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
          <button
            disabled={!ready || isPending}
            onClick={() => { onConfirm(reason); setTyped(""); setReason(""); }}
            className="flex-1 py-2 rounded-lg bg-destructive text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {isPending ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
