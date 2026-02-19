import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgs as orgsApi, ApiError } from "@/lib/api";
import { TopHeader } from "@/components/TopHeader";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Users, Mail, Crown, Shield, User,
  Trash2, Plus, Loader2, ChevronLeft, RefreshCw, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  owner:  { label: "Owner",  icon: Crown,  color: "text-[hsl(var(--warning))]" },
  admin:  { label: "Admin",  icon: Shield, color: "text-primary" },
  member: { label: "Member", icon: User,   color: "text-muted-foreground" },
};

export default function OrgSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["org", slug],
    queryFn: () => orgsApi.get(slug!),
    enabled: !!slug,
  });

  const inviteMutation = useMutation({
    mutationFn: () => orgsApi.invite(slug!, inviteEmail, inviteRole),
    onSuccess: () => {
      toast({ title: "Invite sent", description: `Invitation sent to ${inviteEmail}` });
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["org", slug] });
    },
    onError: (err) => {
      toast({ title: "Invite failed", description: err instanceof ApiError ? err.message : "Unknown error", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => orgsApi.removeMember(slug!, userId),
    onSuccess: () => {
      toast({ title: "Member removed" });
      qc.invalidateQueries({ queryKey: ["org", slug] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => orgsApi.delete(slug!),
    onSuccess: () => {
      toast({ title: "Organization deleted" });
      localStorage.removeItem("activeOrgSlug");
      navigate("/app/dashboard");
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Unknown error", variant: "destructive" });
    },
  });

  const org = data?.org;
  const members = data?.members ?? [];
  const myRole = data?.org?.role ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";

  // Minimal usage placeholder for TopHeader while on this page
  const dummyUsage = {
    plan: { name: "pro", maxStorageGb: 100, bandwidthGb: 1000 },
    storageUsedBytes: 0,
    bandwidthUsedBytes: 0,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopHeader
        usage={dummyUsage}
        onAddMagnet={() => {}}
        onUploadTorrent={() => {}}
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {isLoading ? <span className="w-40 h-5 bg-muted rounded animate-pulse block" /> : org?.name ?? slug}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">/{slug}</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} /> Refresh
          </button>
        </div>

        {/* Plan info */}
        {org?.plan_id && (
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <Shield className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Plan: {org.plan_id}</p>
              <p className="text-xs text-muted-foreground">Shared across all org members</p>
            </div>
          </div>
        )}

        {/* Members */}
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Members</h2>
            <span className="ml-auto text-xs text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-32 animate-pulse" />
                    <div className="h-2 bg-muted rounded w-24 animate-pulse" />
                  </div>
                </div>
              ))
            ) : members.map((m: any) => {
              const roleCfg = ROLE_CONFIG[m.role] ?? ROLE_CONFIG.member;
              const RoleIcon = roleCfg.icon;
              return (
                <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground uppercase shrink-0">
                    {(m.email ?? m.user_id)?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.email ?? m.user_id}</p>
                    <p className="text-xs text-muted-foreground">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                  </div>
                  <span className={cn("flex items-center gap-1 text-xs font-semibold", roleCfg.color)}>
                    <RoleIcon className="w-3.5 h-3.5" /> {roleCfg.label}
                  </span>
                  {canManage && m.role !== "owner" && (
                    <button
                      onClick={() => removeMutation.mutate(m.user_id)}
                      disabled={removeMutation.isPending}
                      className="ml-2 text-xs px-2 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"
                    >
                      {removeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Invite member */}
        {canManage && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> Invite Member
            </h2>
            <div className="flex gap-2 flex-wrap">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && inviteEmail && inviteMutation.mutate()}
                className="flex-1 min-w-[200px] bg-input/60 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-all"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as "admin" | "member")}
                className="bg-input/60 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-all"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail || inviteMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-glow-primary"
              >
                {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Send Invite
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Invites expire after 7 days. The invitee will receive an email with a join link.
            </p>
          </div>
        )}

        {/* Danger zone */}
        {myRole === "owner" && (
          <div className="bg-card border border-destructive/30 rounded-xl p-5 shadow-card space-y-4">
            <h2 className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Danger Zone
            </h2>
            {!deleteConfirm ? (
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Delete this organization</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently deletes the org, removes all members, and unlinks shared jobs. This cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Org
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  Type <code className="bg-muted px-1 rounded font-mono text-destructive">{slug}</code> to confirm deletion:
                </p>
                <input
                  type="text"
                  value={deletePhrase}
                  onChange={e => setDeletePhrase(e.target.value)}
                  placeholder={`Type "${slug}" to confirm`}
                  className="w-full bg-input/60 border border-destructive/40 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-destructive transition-all"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeletePhrase(""); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deletePhrase !== slug || deleteMutation.isPending}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Permanently Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
