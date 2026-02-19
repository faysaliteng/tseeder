import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usage as usageApi, auth as authApi, apiKeys as apiKeysApi, type ApiKey, ApiError } from "@/lib/api";
import { TopHeader } from "@/components/TopHeader";
import { formatBytes } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, Languages, User, Lock, Bell, Trash2, Check, X, Loader2, Eye, EyeOff,
  Key, Plus, Copy, AlertTriangle, Clock,
} from "lucide-react";
import logoImg from "@/assets/logo.png";

function SectionHeader({ title, icon: Icon, accent = "bg-slate-700" }: { title: string; icon: React.ElementType; accent?: string }) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-3 rounded-t-lg text-white font-bold text-sm uppercase tracking-wide", accent)}>
      <span>{title}</span>
      <Icon className="w-5 h-5 opacity-80" />
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-card mb-6">
      {children}
    </div>
  );
}

function EditableField({
  label, value, onSave, type = "text", loading,
}: { label: string; value: string; onSave?: (v: string) => void; type?: string; loading?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [showPwd, setShowPwd] = useState(false);

  const save = () => { onSave?.(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div className="px-4 py-3 border-b border-dashed border-border/60 last:border-0">
      <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
      {editing ? (
        <div className="flex items-center gap-2 mt-1">
          <div className="relative flex-1">
            <Input
              value={draft}
              type={type === "password" && !showPwd ? "password" : "text"}
              onChange={e => setDraft(e.target.value)}
              className="bg-input text-sm h-8 pr-8"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
            />
            {type === "password" && (
              <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <button onClick={save} disabled={loading} className="text-success hover:opacity-80 transition-opacity">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button onClick={cancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm text-foreground">
            {type === "password" ? "••••••••" : value}
          </span>
          {onSave && (
            <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline font-medium ml-4">
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
  });

  const { data: keysData, isLoading: keysLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiKeysApi.list(),
  });

  const [newKeyName, setNewKeyName] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => apiKeysApi.create(name),
    onSuccess: ({ secret }) => {
      setCreatedSecret(secret);
      setNewKeyName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed to create key", variant: "destructive" });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      toast({ title: "API key revoked" });
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed to revoke", variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => navigate("/auth/login"),
    onError: () => navigate("/auth/login"),
  });

  const storageUsedPct = usageData
    ? Math.min(100, (usageData.storageUsedBytes / (usageData.plan.maxStorageGb * 1e9)) * 100)
    : 0;
  const bandwidthPct = usageData && usageData.plan.bandwidthGb < 9999
    ? Math.min(100, (usageData.bandwidthUsedBytes / (usageData.plan.bandwidthGb * 1e9)) * 100)
    : 100;
  const bandwidthUnlimited = !usageData || usageData.plan.bandwidthGb >= 9999;

  const headerUsage = {
    plan: {
      name: usageData?.plan.name ?? "free",
      maxStorageGb: usageData?.plan.maxStorageGb ?? 5,
      bandwidthGb: usageData?.plan.bandwidthGb ?? 20,
    },
    storageUsedBytes: usageData?.storageUsedBytes ?? 0,
    bandwidthUsedBytes: usageData?.bandwidthUsedBytes ?? 0,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopHeader usage={headerUsage} onAddMagnet={() => {}} onUploadTorrent={() => {}} />

      {/* Sub-nav tab */}
      <div className="bg-card/40 border-b border-dashed border-border px-4 flex items-center gap-4 h-10">
        <div className="flex items-center gap-2 border-b-2 border-primary text-primary pb-0 h-full">
          <User className="w-4 h-4" />
          <span className="text-sm font-semibold uppercase tracking-widest">Settings</span>
        </div>
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 py-6 sm:py-8">

        {/* ── Account ──────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="Account" icon={User} accent="bg-slate-700" />
          <div className="h-0.5 bg-destructive" />
          <div className="flex items-center gap-4 px-4 py-4 border-b border-dashed border-border/60">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border bg-secondary flex items-center justify-center shrink-0">
              <img src={logoImg} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">Profile photo</p>
              <button className="text-xs text-primary hover:underline mt-0.5">Change photo</button>
            </div>
          </div>
          <EditableField label="Email" value="user@example.com" />
          <EditableField label="Username" value="user_1234" />
          <EditableField label="Password" value="" type="password" />
        </SectionCard>

        {/* ── Storage ──────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="Storage" icon={TrendingUp} accent="bg-slate-700" />
          <div className="h-0.5 bg-destructive" />
          <div className="px-4 py-5 space-y-5">
            {usageLoading ? (
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
                <div className="h-4 bg-muted rounded animate-pulse w-full" />
                <div className="h-4 bg-muted rounded animate-pulse w-2/3 mt-4" />
                <div className="h-4 bg-muted rounded animate-pulse w-full" />
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Storage Used</span>
                    <span className="font-semibold text-foreground">
                      {formatBytes(usageData?.storageUsedBytes ?? 0)} / {usageData?.plan.maxStorageGb ?? 5}.00 GB
                    </span>
                  </div>
                  <div className="h-4 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${storageUsedPct}%`,
                        background: storageUsedPct > 80 ? "hsl(var(--destructive))" : "hsl(142 71% 45%)",
                        boxShadow: "0 0 8px hsl(142 71% 45% / 0.5)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Bandwidth Used (Downloads + Links)</span>
                    <span className="font-semibold text-foreground">
                      {formatBytes(usageData?.bandwidthUsedBytes ?? 0)} / {bandwidthUnlimited ? "UNLIMITED" : `${usageData?.plan.bandwidthGb} GB`}
                    </span>
                  </div>
                  <div className="h-4 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${bandwidthPct}%`,
                        background: "hsl(var(--info))",
                        boxShadow: "0 0 8px hsl(var(--info) / 0.5)",
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Current Plan</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground uppercase">{usageData?.plan.name ?? "free"}</span>
                      <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                        {usageData?.plan.maxStorageGb ?? 5} GB · {usageData?.plan.maxJobs ?? 3} jobs
                      </span>
                    </div>
                  </div>
                  {(usageData?.plan.name === "free" || !usageData) && (
                    <button className="text-xs font-bold text-warning border border-warning rounded px-3 py-1.5 hover:bg-warning hover:text-black transition-colors">
                      Upgrade ▲
                    </button>
                  )}
                </div>

                {/* Usage breakdown */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Active Jobs</div>
                    <p className="text-lg font-bold text-foreground">{usageData?.activeJobs ?? 0} / {usageData?.plan.maxJobs ?? 3}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Retention</div>
                    <p className="text-lg font-bold text-foreground">{usageData?.plan.retentionDays ?? 7} days</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </SectionCard>

        {/* ── International ─────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="International" icon={Languages} accent="bg-slate-700" />
          <div className="h-0.5 bg-destructive" />
          <div className="px-4 py-3 border-b border-dashed border-border/60">
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Site Language</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-sm text-foreground">en</span>
              <button className="text-xs text-primary hover:underline font-medium ml-4">Edit</button>
            </div>
          </div>
        </SectionCard>

        {/* ── Security ─────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="Security" icon={Lock} accent="bg-slate-700" />
          <div className="h-0.5 bg-destructive" />
          <div className="px-4 py-4 space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2 border-border hover:border-primary/50">
              <Lock className="w-4 h-4 text-muted-foreground" /> Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 border-border hover:border-primary/50">
              <Bell className="w-4 h-4 text-muted-foreground" /> Notification Preferences
            </Button>
          </div>
        </SectionCard>

        {/* ── API Keys ──────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="API Keys" icon={Key} accent="bg-slate-700" />
          <div className="h-0.5 bg-destructive" />

          {/* One-time secret reveal */}
          {createdSecret && (
            <div className="mx-4 mt-4 p-3 bg-success/10 border border-success/30 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-success flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Copy your secret now — it will never be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-background border border-border rounded px-2 py-1.5 text-foreground break-all select-all">
                  {createdSecret}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdSecret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 2000);
                  }}
                  className="shrink-0 p-2 rounded border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy secret"
                >
                  {copiedSecret ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={() => setCreatedSecret(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Create new key */}
          <div className="px-4 py-3 border-b border-dashed border-border/60">
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Create New Key</div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Key name (e.g. ci-deploy)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newKeyName.trim()) createKeyMutation.mutate(newKeyName.trim()); }}
                className="bg-input text-sm h-8 flex-1"
                maxLength={64}
              />
              <Button
                size="sm"
                className="h-8 gap-1.5 gradient-primary text-white border-0 shrink-0"
                disabled={!newKeyName.trim() || createKeyMutation.isPending}
                onClick={() => createKeyMutation.mutate(newKeyName.trim())}
              >
                {createKeyMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Plus className="w-3.5 h-3.5" />}
                Generate
              </Button>
            </div>
          </div>

          {/* Key list */}
          <div>
            {keysLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse border-b border-dashed border-border/60 last:border-0">
                  <div className="h-3 bg-muted rounded flex-1" />
                  <div className="h-3 bg-muted rounded w-24" />
                </div>
              ))
            ) : (keysData?.keys ?? []).length === 0 ? (
              <div className="px-4 py-5 text-sm text-muted-foreground text-center">No API keys yet.</div>
            ) : (
              (keysData?.keys ?? []).map((key: ApiKey) => (
                <div key={key.id} className="flex items-center gap-3 px-4 py-3 border-b border-dashed border-border/60 last:border-0">
                  <Key className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{key.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <code className="text-xs text-muted-foreground font-mono">{key.prefix}••••••••</code>
                      {key.lastUsedAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> Used {new Date(key.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                      {key.expiresAt && (
                        <span className="text-xs text-muted-foreground">
                          Expires {new Date(key.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeKeyMutation.mutate(key.id)}
                    disabled={revokeKeyMutation.isPending}
                    className="text-xs text-destructive border border-destructive/40 rounded px-2 py-1 hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-40"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        {/* ── Danger Zone ───────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="Danger Zone" icon={Trash2} accent="bg-destructive/80" />
          <div className="h-0.5 bg-destructive" />
          <div className="px-4 py-4 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Sign out of your account on this device.
              </p>
              <Button
                variant="outline"
                className="border-border hover:border-primary/50 gap-2"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Sign Out
              </Button>
            </div>
            <div className="border-t border-dashed border-border/60 pt-3">
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete your account and all associated files. This action cannot be undone.
              </p>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </Button>
            </div>
          </div>
        </SectionCard>
      </main>
    </div>
  );
}
