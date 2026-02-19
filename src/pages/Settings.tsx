import { useState } from "react";
import { TopHeader } from "@/components/TopHeader";
import { MOCK_USAGE, formatBytes } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendingUp, Languages, User, Lock, Bell, Trash2, Edit2, Check, X } from "lucide-react";
import logoImg from "@/assets/logo.png";

interface SectionHeaderProps {
  title: string;
  icon: React.ElementType;
  accent?: string;
}

function SectionHeader({ title, icon: Icon, accent = "bg-slate-700" }: SectionHeaderProps) {
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
  label, value, onSave,
}: { label: string; value: string; onSave?: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => { onSave?.(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div className="px-4 py-3 border-b border-dashed border-border/60 last:border-0">
      <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
      {editing ? (
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="bg-input text-sm h-8 flex-1"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          />
          <button onClick={save} className="text-success hover:opacity-80 transition-opacity"><Check className="w-4 h-4" /></button>
          <button onClick={cancel} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm text-foreground">{value}</span>
          {onSave && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary hover:underline font-medium ml-4"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const usage = MOCK_USAGE;
  const [email, setEmail] = useState("user@example.com");
  const [language, setLanguage] = useState("en");

  const storageUsedPct = Math.min(100, (usage.storageUsedBytes / (usage.plan.maxStorageGb * 1e9)) * 100);
  const bandwidthUnlimited = usage.plan.bandwidthGb >= 9999;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopHeader
        usage={usage}
        onAddMagnet={() => {}}
        onUploadTorrent={() => {}}
      />

      {/* Sub-nav tab */}
      <div className="bg-card/40 border-b border-dashed border-border px-4 flex items-center gap-4 h-10">
        <div className="flex items-center gap-2 border-b-2 border-primary text-primary pb-0 h-full">
          <User className="w-4 h-4" />
          <span className="text-sm font-semibold uppercase tracking-widest">Settings</span>
        </div>
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">

        {/* ── Account section ─────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="Account" icon={User} accent="bg-slate-700" />
          {/* Red accent stripe */}
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
          <EditableField label="Email" value={email} onSave={setEmail} />
          <EditableField label="Username" value="user_1234" onSave={() => {}} />
        </SectionCard>

        {/* ── Storage section ──────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="Storage" icon={TrendingUp} accent="bg-slate-700" />
          <div className="h-0.5 bg-destructive" />
          <div className="px-4 py-5 space-y-5">
            {/* Storage used */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Storage Used</span>
                <span className="font-semibold text-foreground">
                  {formatBytes(usage.storageUsedBytes)} / {usage.plan.maxStorageGb}.00 GB
                </span>
              </div>
              <div className="h-4 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${storageUsedPct}%`,
                    background: storageUsedPct > 80
                      ? "hsl(var(--destructive))"
                      : "hsl(142 71% 45%)",
                    boxShadow: "0 0 8px hsl(142 71% 45% / 0.5)",
                  }}
                />
              </div>
            </div>

            {/* Bandwidth used */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Bandwidth Used (Downloads + Links)</span>
                <span className="font-semibold text-foreground">
                  {formatBytes(usage.bandwidthUsedBytes)} / {bandwidthUnlimited ? "UNLIMITED" : `${usage.plan.bandwidthGb} GB`}
                </span>
              </div>
              <div className="h-4 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: bandwidthUnlimited ? "100%" : `${Math.min(100, (usage.bandwidthUsedBytes / (usage.plan.bandwidthGb * 1e9)) * 100)}%`,
                    background: "hsl(var(--info))",
                    boxShadow: "0 0 8px hsl(var(--info) / 0.5)",
                  }}
                />
              </div>
            </div>

            {/* Plan badge */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Current Plan</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground uppercase">{usage.plan.name}</span>
                  <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                    {usage.plan.maxStorageGb} GB · {usage.plan.maxJobs} jobs
                  </span>
                </div>
              </div>
              {usage.plan.name === "free" && (
                <button className="text-xs font-bold text-warning border border-warning rounded px-3 py-1.5 hover:bg-warning hover:text-black transition-colors">
                  Upgrade ▲
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── International section ────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="International" icon={Languages} accent="bg-slate-700" />
          <div className="h-0.5 bg-destructive" />
          <EditableField label="Site Language" value={language} onSave={setLanguage} />
        </SectionCard>

        {/* ── Security section ─────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="Security" icon={Lock} accent="bg-slate-700" />
          <div className="h-0.5 bg-destructive" />
          <div className="px-4 py-4 space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2 border-border hover:border-primary/50">
              <Lock className="w-4 h-4 text-muted-foreground" />
              Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 border-border hover:border-primary/50">
              <Bell className="w-4 h-4 text-muted-foreground" />
              Notification Preferences
            </Button>
          </div>
        </SectionCard>

        {/* ── Danger zone ──────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="Danger Zone" icon={Trash2} accent="bg-destructive/80" />
          <div className="h-0.5 bg-destructive" />
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete your account and all associated files. This action cannot be undone.
            </p>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </Button>
          </div>
        </SectionCard>
      </main>
    </div>
  );
}
