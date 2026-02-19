import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { admin as adminApi, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DangerModal } from "@/components/admin/AdminUI";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/mock-data";
import {
  ArrowLeft, ShieldCheck, ShieldOff, LogOut, User,
  Briefcase, ScrollText, HardDrive, XCircle, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = ["user", "support", "admin", "superadmin"];
const PLANS = ["free", "pro", "business", "enterprise"];

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dangerModal, setDangerModal] = useState<"suspend" | "logout" | "role" | null>(null);
  const [pendingRole, setPendingRole] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-user-detail", id],
    queryFn: () => adminApi.getUser(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (body: { suspended?: boolean; role?: string; planId?: string }) =>
      adminApi.updateUser(id!, body),
    onSuccess: () => {
      toast({ title: "User updated" });
      qc.invalidateQueries({ queryKey: ["admin-user-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDangerModal(null);
    },
    onError: (err) => toast({
      title: "Error",
      description: err instanceof ApiError ? err.message : "Failed",
      variant: "destructive",
    }),
  });

  const forceLogoutMutation = useMutation({
    mutationFn: () => adminApi.forceLogout(id!),
    onSuccess: () => {
      toast({ title: "Sessions terminated" });
      qc.invalidateQueries({ queryKey: ["admin-user-detail", id] });
      setDangerModal(null);
    },
    onError: (err) => toast({
      title: "Error",
      description: err instanceof ApiError ? err.message : "Failed",
      variant: "destructive",
    }),
  });

  const user = data?.user as any;
  const plan = data?.plan as any;
  const usage = data?.usage as any;
  const sessions = (data?.sessions ?? []) as any[];
  const recentJobs = (data?.recentJobs ?? []) as any[];
  const auditTimeline = (data?.auditTimeline ?? []) as any[];

  if (isLoading) return (
    <AdminLayout>
      <div className="p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    </AdminLayout>
  );

  if (error || !user) return (
    <AdminLayout>
      <div className="p-6 text-center">
        <XCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">User not found</p>
        <button onClick={() => navigate("/admin/users")} className="mt-4 text-xs text-primary hover:underline">
          ← Back to users
        </button>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-4xl">
        {/* Back + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/users")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Users
          </button>
        </div>

        {/* User header */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card flex flex-wrap items-start gap-5">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{user.email}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary">{user.role}</span>
              <span className={cn("text-xs font-medium", user.suspended ? "text-destructive" : "text-[hsl(var(--success))]")}>
                {user.suspended ? "● Suspended" : "● Active"}
              </span>
              <span className="text-xs text-muted-foreground">Plan: {user.plan_name ?? plan?.name ?? "—"}</span>
              <span className="text-xs text-muted-foreground">Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDangerModal("suspend")}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors",
                user.suspended
                  ? "border-[hsl(var(--success)/0.4)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)]"
                  : "border-destructive/40 text-destructive hover:bg-destructive/10"
              )}
            >
              {user.suspended ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
              {user.suspended ? "Reinstate" : "Suspend"}
            </button>
            <button
              onClick={() => setDangerModal("logout")}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Force Logout
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Jobs", value: usage?.totalJobs ?? "—", icon: Briefcase },
            { label: "Storage Used", value: usage?.storageBytes ? formatBytes(usage.storageBytes) : "—", icon: HardDrive },
            { label: "Active Sessions", value: sessions.length, icon: User },
            { label: "Email Verified", value: user.email_verified ? "Yes" : "No", icon: CheckCircle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Change role + plan */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Change Role</h2>
            <div className="flex gap-2">
              <select
                defaultValue={user.role}
                onChange={e => setPendingRole(e.target.value)}
                className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
              <button
                onClick={() => pendingRole && pendingRole !== user.role && setDangerModal("role")}
                className="px-4 py-2 text-xs rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <LogOut className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Active Sessions ({sessions.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {sessions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No active sessions</p>
            ) : sessions.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-mono truncate">{s.device_info ?? "Unknown device"}</p>
                  <p className="text-xs text-muted-foreground">
                    IP: {s.ip_address ?? "—"} · Last seen: {new Date(s.last_seen_at).toLocaleString()} · Expires: {new Date(s.expires_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent jobs */}
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Recent Jobs</h2>
          </div>
          <div className="divide-y divide-border">
            {recentJobs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No jobs found</p>
            ) : recentJobs.map((j: any) => (
              <div key={j.id} className="flex items-center gap-3 px-4 py-3">
                <StatusBadge status={j.status} />
                <span className="text-sm text-foreground truncate flex-1">{j.name || "—"}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(j.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit timeline */}
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Audit Timeline</h2>
          </div>
          <div className="divide-y divide-border">
            {auditTimeline.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No audit events</p>
            ) : auditTimeline.map((e: any) => (
              <div key={e.id ?? e.created_at} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
                <code className="text-xs font-mono text-primary">{e.action}</code>
                {e.target_id && <span className="text-xs text-muted-foreground font-mono truncate">{e.target_type}/{e.target_id}</span>}
                {e.ip_address && <span className="text-xs text-muted-foreground ml-auto">{e.ip_address}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <DangerModal
        open={dangerModal === "suspend"}
        title={user.suspended ? "Reinstate User" : "Suspend User"}
        description={`This will ${user.suspended ? "reinstate" : "suspend"} ${user.email}.${!user.suspended ? " All sessions will be immediately terminated." : ""}`}
        confirmPhrase={user.suspended ? "reinstate" : "suspend"}
        reasonRequired={!user.suspended}
        onClose={() => setDangerModal(null)}
        onConfirm={() => updateMutation.mutate({ suspended: !user.suspended })}
        isPending={updateMutation.isPending}
      />

      <DangerModal
        open={dangerModal === "logout"}
        title="Force Logout"
        description={`Terminate all active sessions for ${user.email}. They will be immediately signed out of all devices.`}
        confirmPhrase="force-logout"
        onClose={() => setDangerModal(null)}
        onConfirm={() => forceLogoutMutation.mutate()}
        isPending={forceLogoutMutation.isPending}
      />

      <DangerModal
        open={dangerModal === "role"}
        title="Change User Role"
        description={`Change role from "${user.role}" to "${pendingRole}". This changes the user's permissions immediately.`}
        confirmPhrase="change-role"
        reasonRequired
        onClose={() => { setDangerModal(null); setPendingRole(""); }}
        onConfirm={() => updateMutation.mutate({ role: pendingRole })}
        isPending={updateMutation.isPending}
      />
    </AdminLayout>
  );
}
