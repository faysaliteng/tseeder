import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin as adminApi, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, AdminTable, Paginator, DangerModal } from "@/components/admin/AdminUI";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Ban, Lock, AlertTriangle, List } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "blocklist" | "events" | "controls";

export default function AdminSecurity() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("blocklist");
  const [blocklist, setBlocklist] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blocklistPage, setBlocklistPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [severity, setSeverity] = useState("");

  const { data: blocklistData, isLoading: blLoading } = useQuery({
    queryKey: ["admin-blocklist", blocklistPage],
    queryFn: () => adminApi.listBlocklist(blocklistPage),
    enabled: tab === "blocklist",
  });

  const { data: eventsData, isLoading: evLoading } = useQuery({
    queryKey: ["admin-security-events", eventsPage, severity],
    queryFn: () => adminApi.securityEvents(eventsPage, severity || undefined),
    enabled: tab === "events",
  });

  const blocklistMutation = useMutation({
    mutationFn: () => adminApi.addBlocklist(blocklist, blockReason || undefined),
    onSuccess: (data) => {
      toast({ title: "Blocklisted", description: `${blocklist} added. ${data.jobsTerminated} job(s) terminated.` });
      setBlocklist(""); setBlockReason(""); setBlockModalOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-blocklist"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Invalid infohash", variant: "destructive" });
    },
  });

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "blocklist", label: "Blocklist", icon: Ban },
    { key: "events", label: "Security Events", icon: ShieldAlert },
    { key: "controls", label: "Controls", icon: Lock },
  ];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        <AdminPageHeader
          title="Security Center"
          description="Blocklist management, security event monitoring, and platform controls."
        />

        {/* Add infohash */}
        <div className="bg-card border border-destructive/30 rounded-xl p-5 shadow-card space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive" /> Block Infohash
          </h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text" value={blocklist}
              onChange={e => setBlocklist(e.target.value)}
              placeholder="40-character SHA1 hex infohash…"
              className="flex-1 min-w-0 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <input
              type="text" value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-48 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={() => {
                if (!blocklist.match(/^[a-f0-9]{40}$/i)) {
                  toast({ title: "Invalid infohash", description: "Must be exactly 40 hex characters.", variant: "destructive" });
                  return;
                }
                setBlockModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Ban className="w-4 h-4" /> Block
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Blocklist tab */}
        {tab === "blocklist" && (
          <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <AdminTable
              headers={["Infohash", "Reason", "Added By", "Date"]}
              loading={blLoading}
            >
              {(blocklistData?.data as any[] ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">No blocked infohashes</td></tr>
              ) : (blocklistData?.data as any[] ?? []).map((b: any) => (
                <tr key={b.infohash} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{b.infohash}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{b.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{b.added_by_email ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(b.added_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </AdminTable>
            <Paginator page={blocklistPage} totalPages={blocklistData?.meta?.totalPages ?? 1} onPage={setBlocklistPage} />
          </div>
        )}

        {/* Security events tab */}
        {tab === "events" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select
                value={severity}
                onChange={e => { setSeverity(e.target.value); setEventsPage(1); }}
                className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">All Severities</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="critical">Critical</option>
              </select>
              {eventsData?.meta && <span className="text-xs text-muted-foreground ml-auto">{eventsData.meta.total} events</span>}
            </div>
            <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
              <AdminTable
                headers={["Timestamp", "Type", "Actor", "IP", "Severity"]}
                loading={evLoading}
              >
                {(eventsData?.data as any[] ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No security events</td></tr>
                ) : (eventsData?.data as any[] ?? []).map((e: any) => (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3"><code className="text-xs font-mono text-primary">{e.event_type}</code></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{e.actor_email ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{e.ip_address ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        e.severity === "critical" ? "bg-destructive/15 text-destructive" :
                        e.severity === "warn" ? "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]" :
                        "bg-muted/40 text-muted-foreground"
                      )}>
                        {e.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </AdminTable>
              <Paginator page={eventsPage} totalPages={eventsData?.meta?.totalPages ?? 1} onPage={setEventsPage} />
            </div>
          </div>
        )}

        {/* Controls tab */}
        {tab === "controls" && (
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: ShieldAlert, title: "RBAC Enforcement", desc: "All admin routes are protected server-side by role-based middleware. Non-admins receive 403.", ok: true },
              { icon: Lock, title: "CSRF Protection", desc: "All state-mutating requests require a valid CSRF token tied to the session. Enforced globally.", ok: true },
              { icon: AlertTriangle, title: "Rate Limiting", desc: "Per-user and per-IP rate limits are enforced via KV storage on all sensitive endpoints.", ok: true },
            ].map(({ icon: Icon, title, desc, ok }) => (
              <div key={title} className="bg-card border border-border rounded-xl p-4 shadow-card space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", ok ? "text-[hsl(var(--success))]" : "text-destructive")} />
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
                <span className={cn("text-xs font-semibold", ok ? "text-[hsl(var(--success))]" : "text-destructive")}>
                  {ok ? "✓ Active" : "✗ Inactive"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <DangerModal
        open={blockModalOpen}
        title="Block Infohash"
        description={`Add "${blocklist}" to the global blocklist. All active jobs with this infohash will be immediately cancelled.`}
        confirmPhrase="block"
        onClose={() => setBlockModalOpen(false)}
        onConfirm={() => blocklistMutation.mutate()}
        isPending={blocklistMutation.isPending}
      />
    </AdminLayout>
  );
}
