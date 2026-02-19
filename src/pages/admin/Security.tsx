import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin as adminApi, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, DangerModal } from "@/components/admin/AdminUI";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Ban, Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminSecurity() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [blocklist, setBlocklist] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  const { data: auditData } = useQuery({
    queryKey: ["admin-audit", 1],
    queryFn: () => adminApi.audit(1),
    staleTime: 10_000,
  });

  const blocklistMutation = useMutation({
    mutationFn: () => adminApi.addBlocklist(blocklist, blockReason || undefined),
    onSuccess: () => {
      toast({ title: "Blocklisted", description: `Infohash ${blocklist} added.` });
      setBlocklist(""); setBlockReason(""); setBlockModalOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Invalid infohash", variant: "destructive" });
    },
  });

  const suspiciousEvents = ((auditData?.data ?? []) as any[]).filter((e: any) =>
    ["user.suspended", "blocklist.added"].includes(e.action)
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <AdminPageHeader
          title="Security Center"
          description="Risk signals, blocklist management, and security event monitoring."
        />

        {/* Infohash blocklist */}
        <div className="bg-card border border-destructive/30 rounded-xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive" /> Infohash Blocklist
          </h2>
          <p className="text-xs text-muted-foreground">
            Block a torrent infohash globally. Any job with this infohash will be immediately terminated and future submissions rejected.
          </p>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={blocklist}
              onChange={e => setBlocklist(e.target.value)}
              placeholder="40-character hex infohash (SHA1)…"
              className="flex-1 min-w-0 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <input
              type="text"
              value={blockReason}
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

        {/* Security info cards */}
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

        {/* Recent security events (from audit log) */}
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[hsl(var(--warning))]" />
            <h2 className="text-sm font-semibold text-foreground">Recent Security Events</h2>
          </div>
          <div className="divide-y divide-border">
            {suspiciousEvents.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No recent security events</div>
            ) : suspiciousEvents.map((e: any) => (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{e.actor_email ?? e.actor_id}</span>
                    {" → "}
                    <code className="text-xs bg-muted px-1 rounded">{e.action}</code>
                    {" on "}
                    <span className="font-mono text-xs">{e.target_id ?? "—"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(e.created_at).toLocaleString()} &bull; IP: {e.ip_address ?? "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DangerModal
        open={blockModalOpen}
        title="Block Infohash"
        description={`Add infohash "${blocklist}" to the global blocklist. All current and future jobs with this infohash will be terminated.`}
        confirmPhrase="block"
        reasonRequired={false}
        onClose={() => setBlockModalOpen(false)}
        onConfirm={() => blocklistMutation.mutate()}
        isPending={blocklistMutation.isPending}
      />
    </AdminLayout>
  );
}
