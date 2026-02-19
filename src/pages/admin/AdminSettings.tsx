import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin as adminApi, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, DangerModal } from "@/components/admin/AdminUI";
import { useToast } from "@/hooks/use-toast";
import { Settings, Flag, Key, Shield, Loader2 } from "lucide-react";

interface FeatureFlag {
  key: string;
  value: number;
  description?: string;
  updated_by?: string;
  updated_at?: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [flagModal, setFlagModal] = useState<{ flag: FeatureFlag; newValue: number } | null>(null);

  const { data: flagsData, isLoading } = useQuery({
    queryKey: ["admin-flags"],
    queryFn: () => adminApi.listFlags(),
  });

  const updateFlagMutation = useMutation({
    mutationFn: ({ key, value, reason }: { key: string; value: number; reason: string }) =>
      adminApi.updateFlag(key, value, reason),
    onSuccess: () => {
      toast({ title: "Feature flag updated" });
      qc.invalidateQueries({ queryKey: ["admin-flags"] });
      setFlagModal(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed", variant: "destructive" });
    },
  });

  const flags = (flagsData?.flags ?? []) as FeatureFlag[];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        <AdminPageHeader
          title="Admin Settings"
          description="Feature flags, configuration, and operational controls."
        />

        {/* Feature flags — live from D1 */}
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Flag className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Feature Flags</h2>
            <span className="text-xs text-muted-foreground ml-1">— live from D1 · superadmin only</span>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-32 animate-pulse" />
                    <div className="h-2 bg-muted rounded w-56 animate-pulse" />
                  </div>
                  <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                </div>
              ))
            ) : flags.map(flag => (
              <div key={flag.key} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{flag.description ?? flag.key}</p>
                  <code className="text-[10px] text-muted-foreground/60 font-mono">{flag.key}</code>
                  {flag.updated_at && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Updated {new Date(flag.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setFlagModal({ flag, newValue: flag.value ? 0 : 1 })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    flag.value ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      flag.value ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
            {!isLoading && flags.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No feature flags found. Run migration 0003_admin_extended.sql.
              </div>
            )}
          </div>
        </div>

        {/* RBAC roles reference */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> RBAC Role Reference
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { role: "user", desc: "Standard user. Can manage own jobs and files.", color: "text-muted-foreground" },
              { role: "support", desc: "Read-only access to audit logs. Cannot modify data.", color: "text-[hsl(var(--info))]" },
              { role: "admin", desc: "Full user/job management. Cannot change superadmin accounts.", color: "text-primary" },
              { role: "superadmin", desc: "Full platform access including feature flag changes and role management.", color: "text-[hsl(265_89%_75%)]" },
            ].map(({ role, desc, color }) => (
              <div key={role} className="bg-muted/20 rounded-lg p-3 border border-border">
                <p className={`text-sm font-bold capitalize ${color}`}>{role}</p>
                <p className="text-xs text-muted-foreground mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Internal API key info */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" /> Internal Service Credentials
          </h2>
          <p className="text-sm text-muted-foreground">
            The compute agent authenticates to the API using a bearer token defined by the{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">WORKER_CLUSTER_TOKEN</code> secret.
            Rotate this value via Wrangler and redeploy the agent.
          </p>
          <div className="text-xs text-muted-foreground space-y-1 font-mono bg-muted/30 rounded-lg p-3">
            <p className="text-muted-foreground/60"># Rotate worker token</p>
            <p>$ wrangler secret put WORKER_CLUSTER_TOKEN</p>
            <p className="text-muted-foreground/60"># Redeploy agent</p>
            <p>$ docker build -t torrentflow-agent . && docker push ...</p>
          </div>
        </div>
      </div>

      {/* Feature flag toggle confirmation */}
      {flagModal && (
        <DangerModal
          open
          title={`${flagModal.newValue ? "Enable" : "Disable"} Feature Flag`}
          description={`${flagModal.newValue ? "Enable" : "Disable"} "${flagModal.flag.key}". This change takes effect immediately for all users.`}
          confirmPhrase={flagModal.newValue ? "enable" : "disable"}
          reasonRequired
          onClose={() => setFlagModal(null)}
          onConfirm={(_params) => updateFlagMutation.mutate({
            key: flagModal.flag.key,
            value: flagModal.newValue,
            reason,
          })}
          isPending={updateFlagMutation.isPending}
        />
      )}
    </AdminLayout>
  );
}
