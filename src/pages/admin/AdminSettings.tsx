import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Settings, Flag, Key, Shield } from "lucide-react";

// Feature flags (static config for now — can be wired to a D1 table later)
const FEATURE_FLAGS = [
  { key: "registration_open", label: "Open Registration", description: "Allow new users to sign up", enabled: true },
  { key: "email_verification", label: "Email Verification Required", description: "Require email verification before login", enabled: true },
  { key: "torrent_upload", label: "Torrent File Upload", description: "Allow .torrent file uploads", enabled: true },
  { key: "magnet_links", label: "Magnet Links", description: "Allow magnet link submissions", enabled: true },
  { key: "free_plan_active", label: "Free Plan Available", description: "Allow users to sign up on the Free plan", enabled: true },
];

export default function AdminSettings() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <AdminPageHeader
          title="Admin Settings"
          description="Feature flags, configuration, and operational controls."
        />

        {/* Feature flags */}
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Flag className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Feature Flags</h2>
            <span className="text-xs text-muted-foreground ml-1">(read-only — configure in D1 or wrangler.toml)</span>
          </div>
          <div className="divide-y divide-border">
            {FEATURE_FLAGS.map(flag => (
              <div key={flag.key} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{flag.label}</p>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                  <code className="text-[10px] text-muted-foreground/60 font-mono">{flag.key}</code>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${flag.enabled ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" : "bg-muted text-muted-foreground"}`}>
                  {flag.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
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
              { role: "support", desc: "Read-only access to users and jobs. Cannot modify.", color: "text-[hsl(var(--info))]" },
              { role: "admin", desc: "Full user/job management. Cannot change superadmin accounts.", color: "text-primary" },
              { role: "superadmin", desc: "Full platform access including role management and system settings.", color: "text-[hsl(var(--primary-glow))]" },
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
            The compute agent authenticates to the API using a bearer token defined in{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">WORKER_CLUSTER_TOKEN</code> (Wrangler secret).
            Rotate this value in <code className="bg-muted px-1 py-0.5 rounded text-xs">wrangler secret put WORKER_CLUSTER_TOKEN</code> and redeploy the agent.
          </p>
          <div className="text-xs text-muted-foreground space-y-1 font-mono bg-muted/30 rounded-lg p-3">
            <p># Rotate worker token</p>
            <p>$ wrangler secret put WORKER_CLUSTER_TOKEN</p>
            <p># Then redeploy agent</p>
            <p>$ docker build -t torrentflow-agent . {"&&"} docker push ...</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
