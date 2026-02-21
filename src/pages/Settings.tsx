import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usage as usageApi, auth as authApi, authMe, apiKeys as apiKeysApi, providers as providersApi, billing as billingApi, type ApiKey, ApiError } from "@/lib/api";
import { TopHeader } from "@/components/TopHeader";
import { formatBytes } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, User, Lock, Bell, Trash2, Check, X, Loader2, Eye, EyeOff,
  Key, Plus, Copy, AlertTriangle, Clock, Zap, CloudLightning, ExternalLink, Languages,
  Info, Plug, Server, HardDrive, Wifi, Terminal, ChevronDown, ChevronUp,
} from "lucide-react";


// ── Section header with gradient ───────────────────────────────────────────
function SectionHeader({ title, icon: Icon, gradient = "from-primary/80 to-primary-glow/80" }: {
  title: string; icon: React.ElementType; gradient?: string;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-3.5 rounded-t-xl text-white font-bold text-sm uppercase tracking-widest relative overflow-hidden bg-gradient-to-r",
      gradient
    )}>
      <span className="relative z-10 flex items-center gap-2"><Icon className="w-4 h-4" />{title}</span>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden border border-border/60 mb-6">
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
    <div className="px-4 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/5 transition-colors">
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">{label}</div>
      {editing ? (
        <div className="flex items-center gap-2 mt-1">
          <div className="relative flex-1">
            <Input
              value={draft}
              type={type === "password" && !showPwd ? "password" : "text"}
              onChange={e => setDraft(e.target.value)}
              className="bg-input border-border/60 focus:border-primary/60 text-sm h-9 pr-8 rounded-lg"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
            />
            {type === "password" && (
              <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <button onClick={save} disabled={loading} className="text-success hover:opacity-80">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button onClick={cancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm text-foreground">{type === "password" ? "••••••••" : value}</span>
          {onSave && (
            <button onClick={() => setEditing(true)} className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors ml-4">Edit</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Storage arc ────────────────────────────────────────────────────────────
function StorageArc({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(220 20% 18%)" strokeWidth="7" />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease", filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

// ── Copy button helper ──────────────────────────────────────────────────────
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-semibold shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ── Collapsible integration panel ───────────────────────────────────────────
function IntegrationPanel({
  title, icon: Icon, iconColor = "text-info", badgeColor = "bg-info/10 border-info/30",
  description, children,
}: {
  title: string; icon: React.ElementType; iconColor?: string; badgeColor?: string;
  description: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/5 transition-colors text-left"
      >
        <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center shrink-0", badgeColor)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-4 bg-muted/5 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Config row ─────────────────────────────────────────────────────────────
function ConfigRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 font-medium">{label}</span>
      <div className="flex-1 min-w-0 flex items-center gap-2 bg-background/60 border border-border/40 rounded-lg px-3 py-1.5">
        <span className={cn("text-xs flex-1 truncate", mono ? "font-mono text-foreground" : "text-foreground")}>{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

// ── The full integrations section ───────────────────────────────────────────
function IntegrationsSection({ apiKeys, userEmail }: { apiKeys: ApiKey[]; userEmail: string }) {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "https://api.fseeder.cc";
  const webdavUrl = apiBase.replace("api.", "webdav.") + "/" + (userEmail !== "—" ? userEmail.split("@")[0] : "your-username");
  const qbtHost = "qbt.fseeder.cc";
  const stremioAddonUrl = "https://stremio.fseeder.cc/YOUR_API_KEY/manifest.json";
  const firstKey = apiKeys[0];
  const apiKeyDisplay = firstKey ? `${firstKey.prefix}••••••••` : "Generate an API key above first";

  return (
    <SectionCard>
      <SectionHeader title="Integrations" icon={Plug} gradient="from-info/60 to-primary/60" />
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Connect tseeder to your media stack. Each integration uses your API key for authentication.
          {!firstKey && <span className="text-warning font-semibold"> Generate an API key in the section above to get your personal URLs.</span>}
        </p>

        {/* ── Stremio ── */}
        <IntegrationPanel
          title="Stremio Plugin"
          icon={Wifi}
          iconColor="text-primary"
          badgeColor="bg-primary/10 border-primary/30"
          description="Stream torrents directly in Stremio without waiting for downloads"
        >
          <p className="text-xs text-muted-foreground">
            Install the tseeder addon in Stremio. Open the URL below in your browser or paste it into Stremio's "Install addon from URL" field.
          </p>
          <ConfigRow label="Addon URL" value={firstKey ? stremioAddonUrl.replace("YOUR_API_KEY", firstKey.prefix + "…") : stremioAddonUrl} />
          <div className="flex gap-2 pt-1">
            <a
              href="https://www.stremio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-all font-semibold"
            >
              <ExternalLink className="w-3 h-3" /> Open Stremio
            </a>
          </div>
          <div className="p-3 rounded-xl bg-info/5 border border-info/20 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Setup steps:</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Open Stremio → Add-ons → Community Add-ons</li>
              <li>Click "Install addon from URL"</li>
              <li>Paste the Addon URL above</li>
              <li>Your tseeder library will appear under the tseeder catalog</li>
            </ol>
          </div>
        </IntegrationPanel>

        {/* ── Sonarr / Radarr ── */}
        <IntegrationPanel
          title="Sonarr & Radarr"
          icon={Server}
          iconColor="text-warning"
          badgeColor="bg-warning/10 border-warning/30"
          description="Use tseeder as the download client for your media automation stack"
        >
          <p className="text-xs text-muted-foreground">
            In Sonarr or Radarr go to <strong className="text-foreground">Settings → Download Clients → Add → tseeder</strong> and enter these values:
          </p>
          <div className="space-y-2">
            <ConfigRow label="Host" value={apiBase.replace("https://", "").replace("http://", "")} />
            <ConfigRow label="Port" value="443" mono />
            <ConfigRow label="API Key" value={firstKey ? `${firstKey.prefix}………` : "Your API key"} />
            <ConfigRow label="Category" value="sonarr" />
            <ConfigRow label="Use SSL" value="✓ Yes" mono={false} />
          </div>
          <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 text-xs text-muted-foreground">
            <strong className="text-foreground">Path mapping:</strong> Set the remote path to <code className="font-mono bg-muted/40 px-1 rounded">/downloads</code> and map it to your local media library path. tseeder exposes completed files via WebDAV.
          </div>
        </IntegrationPanel>

        {/* ── WebDAV ── */}
        <IntegrationPanel
          title="WebDAV / Drive Mount"
          icon={HardDrive}
          iconColor="text-success"
          badgeColor="bg-success/10 border-success/30"
          description="Mount your tseeder vault as a local drive on Windows, macOS or Linux"
        >
          <p className="text-xs text-muted-foreground">
            Use these credentials to mount your tseeder vault via WebDAV, SFTP, or rclone.
          </p>
          <div className="space-y-2">
            <ConfigRow label="WebDAV URL" value={webdavUrl} />
            <ConfigRow label="Username" value={userEmail !== "—" ? userEmail : "your@email.com"} mono={false} />
            <ConfigRow label="Password" value="Your account password" mono={false} />
            <ConfigRow label="Protocol" value="HTTPS (port 443)" mono={false} />
          </div>
          <div className="p-3 rounded-xl bg-success/5 border border-success/20 text-xs space-y-2">
            <p className="font-semibold text-foreground">Platform instructions:</p>
            <div className="space-y-1.5 text-muted-foreground">
              <p><strong className="text-foreground">Windows:</strong> File Explorer → Map network drive → enter WebDAV URL</p>
              <p><strong className="text-foreground">macOS:</strong> Finder → ⌘K → enter WebDAV URL → Connect</p>
              <p><strong className="text-foreground">Linux (rclone):</strong></p>
              <code className="block bg-muted/30 rounded p-2 font-mono text-[11px] whitespace-pre">{`rclone config  # select WebDAV
rclone mount tseeder: ~/tseeder --vfs-cache-mode full`}</code>
            </div>
          </div>
        </IntegrationPanel>

        {/* ── qBittorrent Bridge ── */}
        <IntegrationPanel
          title="qBittorrent Remote Bridge"
          icon={Terminal}
          iconColor="text-info"
          badgeColor="bg-info/10 border-info/30"
          description="Control tseeder from nzb360, Flud, LunaSea and other qBittorrent-compatible apps"
        >
          <p className="text-xs text-muted-foreground">
            The tseeder qBittorrent bridge speaks the native qBittorrent WebUI protocol. Enter these settings in any compatible remote app — no plugin needed.
          </p>
          <div className="space-y-2">
            <ConfigRow label="Host" value={qbtHost} />
            <ConfigRow label="Port" value="443" />
            <ConfigRow label="Username" value={userEmail !== "—" ? userEmail : "your@email.com"} mono={false} />
            <ConfigRow label="Password" value="Your account password" mono={false} />
            <ConfigRow label="Use HTTPS" value="✓ Yes" mono={false} />
          </div>
          <div className="p-3 rounded-xl bg-info/5 border border-info/20 text-xs text-muted-foreground">
            <strong className="text-foreground">Supported apps:</strong> nzb360, Flud, LunaSea, Sonarr/Radarr (via qBittorrent download client), Transmission Remote, and any app that supports qBittorrent WebUI.
          </div>
        </IntegrationPanel>

        {/* ── VLC / Kodi Streaming ── */}
        <IntegrationPanel
          title="VLC / Kodi Streaming"
          icon={Zap}
          iconColor="text-primary-glow"
          badgeColor="bg-primary/10 border-primary/20"
          description="Generate signed streaming URLs to open files directly in VLC, Kodi, or Infuse"
        >
          <p className="text-xs text-muted-foreground">
            For any completed file, click the <strong className="text-foreground">⚡ Stream</strong> button in the file browser to get a signed streaming URL (valid 1 hour). Open it directly in your media player:
          </p>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="shrink-0 font-bold text-foreground w-16">VLC:</span>
              <span>Media → Open Network Stream → paste URL → Play</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 font-bold text-foreground w-16">Kodi:</span>
              <span>Videos → Enter Location → paste URL</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 font-bold text-foreground w-16">API:</span>
              <code className="bg-muted/40 px-1.5 py-0.5 rounded font-mono text-[10px]">POST /files/{"{"} fileId {"}"}/signed-url</code>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground">
            Streaming URLs are time-limited and signed with your session. For persistent access, use the <strong className="text-foreground">WebDAV mount</strong> instead.
          </div>
        </IntegrationPanel>

        {/* ── SFTP ── */}
        <IntegrationPanel
          title="SFTP / SSH Access"
          icon={Key}
          iconColor="text-muted-foreground"
          badgeColor="bg-muted/20 border-border"
          description="SSH key-based SFTP access — Business plan and above"
        >
          <p className="text-xs text-muted-foreground">
            SFTP access is available on Business plans. Generate an SSH key pair locally and add your public key here. Then connect with:
          </p>
          <code className="block bg-muted/30 rounded-lg p-3 font-mono text-[11px] text-foreground break-all">
            {`sftp -P 22 ${userEmail !== "—" ? userEmail : "you@email.com"}@sftp.tseeder.com`}
          </code>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full rounded-xl" disabled>
            <Plus className="w-3.5 h-3.5" /> Add SSH Public Key — Upgrade to Business
          </Button>
        </IntegrationPanel>
      </div>
    </SectionCard>
  );
}

// ── Billing section ─────────────────────────────────────────────────────────
function BillingSection({ planName }: { planName: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);

  const handleUpgrade = async (plan: string) => {
    setLoading("checkout");
    try {
      const { checkoutUrl } = await billingApi.checkout(plan);
      window.location.href = checkoutUrl;
    } catch (err) {
      toast({ title: "Billing error", description: err instanceof ApiError ? err.message : "Failed to open checkout", variant: "destructive" });
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading("portal");
    try {
      const { portalUrl } = await billingApi.portal();
      window.location.href = portalUrl;
    } catch (err) {
      toast({ title: "Billing error", description: err instanceof ApiError ? err.message : "No billing account found. Subscribe first.", variant: "destructive" });
      setLoading(null);
    }
  };

  const isPaid = planName !== "free";

  const handleCrypto = (plan: string) => {
    window.location.href = `/app/crypto-checkout?plan=${plan}`;
  };

  return (
    <SectionCard>
      <SectionHeader title="Billing" icon={Zap} gradient="from-warning/60 to-primary/60" />
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Current Plan</div>
            <span className="text-base font-bold text-foreground uppercase">{planName}</span>
          </div>
          {isPaid ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-border gap-1.5"
              onClick={handleManage}
              disabled={loading === "portal"}
            >
              {loading === "portal" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              Manage Billing
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-xl border-primary/40 text-primary gap-1.5 hover:bg-primary/10"
                onClick={() => handleUpgrade("pro")} disabled={!!loading}>
                {loading === "checkout" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Upgrade to Pro
              </Button>
            </div>
          )}
        </div>

        {/* Crypto payment option */}
        {!isPaid && (
          <div className="border border-warning/30 rounded-xl p-3 bg-warning/5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-warning uppercase tracking-widest">Pay with Crypto</span>
            </div>
            <p className="text-xs text-muted-foreground">Pay with Bitcoin, USDT, Litecoin or BNB. Instant activation on confirmation.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-xl border-warning/40 text-warning gap-1.5 hover:bg-warning hover:text-black transition-all"
                onClick={() => handleCrypto("pro")}>
                <Zap className="w-3.5 h-3.5" /> Pro — Crypto
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl border-warning/40 text-warning gap-1.5 hover:bg-warning hover:text-black transition-all"
                onClick={() => handleCrypto("business")}>
                <Zap className="w-3.5 h-3.5" /> Business — Crypto
              </Button>
            </div>
          </div>
        )}

        {!isPaid && (
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="glass-card rounded-lg p-3 space-y-1">
              <p className="font-bold text-foreground">Pro</p>
              <p>100 GB storage · 10 jobs</p>
              <p>Priority processing</p>
            </div>
            <div className="glass-card rounded-lg p-3 space-y-1">
              <p className="font-bold text-foreground">Business</p>
              <p>1 TB storage · Unlimited jobs</p>
              <p>Team accounts · API access</p>
            </div>
          </div>
        )}
        {isPaid && (
          <p className="text-xs text-muted-foreground">
            Manage your subscription, view invoices, or cancel at any time through the Stripe billing portal.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Load real user data from /auth/me
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => authMe.me(),
    retry: false,
  });

  const userEmail = meData?.user?.email ?? "—";
  const userInitial = userEmail[0]?.toUpperCase() ?? "U";

  // Active provider from real API (read-only for users — admin-controlled)
  const { data: providerData } = useQuery({
    queryKey: ["providers", "active"],
    queryFn: () => providersApi.getActive(),
    retry: false,
  });
  const activeProvider = providerData?.provider ?? "cloudflare";

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: () => authMe.changePassword(currentPwd, newPwd),
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setChangingPassword(false);
      setCurrentPwd("");
      setNewPwd("");
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed to change password", variant: "destructive" });
    },
  });


  const { data: usageData, isLoading: usageLoading } = useQuery({ queryKey: ["usage"], queryFn: () => usageApi.get() });
  const { data: keysData, isLoading: keysLoading } = useQuery({ queryKey: ["api-keys"], queryFn: () => apiKeysApi.list() });

  const [newKeyName, setNewKeyName] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => apiKeysApi.create(name),
    onSuccess: ({ secret }) => { setCreatedSecret(secret); setNewKeyName(""); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (err) => { toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed to create key", variant: "destructive" }); },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => { toast({ title: "API key revoked" }); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (err) => { toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed to revoke", variant: "destructive" }); },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await authApi.logout();
      const { setCsrfToken } = await import("@/lib/api");
      setCsrfToken("");
    },
    onSuccess: () => { qc.clear(); window.location.href = "/auth/login"; },
    onError: () => { qc.clear(); window.location.href = "/auth/login"; },
  });

  const storageUsedPct = usageData ? Math.min(100, (usageData.storageUsedBytes / (usageData.plan.maxStorageGb * 1e9)) * 100) : 0;
  const bandwidthPct = usageData && usageData.plan.bandwidthGb < 9999
    ? Math.min(100, (usageData.bandwidthUsedBytes / (usageData.plan.bandwidthGb * 1e9)) * 100) : 0;
  const bandwidthUnlimited = !usageData || usageData.plan.bandwidthGb >= 9999;

  const storageColor = storageUsedPct > 80 ? "hsl(0 72% 51%)" : storageUsedPct > 60 ? "hsl(38 92% 50%)" : "hsl(142 71% 45%)";

  const headerUsage = {
    plan: { name: usageData?.plan.name ?? "free", maxStorageGb: usageData?.plan.maxStorageGb ?? 5, bandwidthGb: usageData?.plan.bandwidthGb ?? 20 },
    storageUsedBytes: usageData?.storageUsedBytes ?? 0,
    bandwidthUsedBytes: usageData?.bandwidthUsedBytes ?? 0,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 60% 40% at 80% 10%, hsl(265 89% 70% / 0.05) 0%, transparent 60%)"
      }} />
      <div className="relative z-10 flex flex-col flex-1">
        <TopHeader usage={headerUsage} onAddMagnet={() => {}} onUploadTorrent={() => {}} />

        <div className="bg-card/40 border-b border-border/40 px-4 flex items-center gap-4 h-10 backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b-2 border-primary text-primary pb-0 h-full">
            <User className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-widest">Settings</span>
          </div>
        </div>

        <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 py-6 sm:py-8">

          {/* ── Account ──────────────────────────────────────────────── */}
          <SectionCard>
            <SectionHeader title="Account" icon={User} gradient="from-primary/70 to-primary-glow/70" />
            <div className="flex items-center gap-4 px-4 py-5 border-b border-border/40">
              <div className="relative w-16 h-16 shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/30 to-primary-glow/20 flex items-center justify-center"
                  style={{ boxShadow: "0 0 16px hsl(239 84% 67% / 0.2)" }}>
                  <span className="text-2xl font-black text-primary">{userInitial}</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full gradient-primary border-2 border-background flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Profile photo</p>
                <button className="text-xs text-primary hover:text-primary/80 mt-0.5 font-medium transition-colors">Change photo</button>
              </div>
            </div>
            <EditableField label="Email" value={userEmail} />
            {/* Password change */}
            <div className="px-4 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/5 transition-colors">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Password</div>
              {changingPassword ? (
                <div className="space-y-2 mt-1">
                  <div className="relative">
                    <Input
                      type={showCurrentPwd ? "text" : "password"}
                      placeholder="Current password"
                      value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      className="bg-input border-border/60 focus:border-primary/60 text-sm h-9 pr-8 rounded-lg"
                    />
                    <button type="button" onClick={() => setShowCurrentPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showCurrentPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showNewPwd ? "text" : "password"}
                      placeholder="New password (min 8 chars)"
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      className="bg-input border-border/60 focus:border-primary/60 text-sm h-9 pr-8 rounded-lg"
                      onKeyDown={e => { if (e.key === "Enter" && currentPwd && newPwd.length >= 8) changePasswordMutation.mutate(); }}
                    />
                    <button type="button" onClick={() => setShowNewPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="gradient-primary text-white border-0 rounded-lg gap-1.5"
                      disabled={!currentPwd || newPwd.length < 8 || changePasswordMutation.isPending}
                      onClick={() => changePasswordMutation.mutate()}
                    >
                      {changePasswordMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Save
                    </Button>
                    <button onClick={() => { setChangingPassword(false); setCurrentPwd(""); setNewPwd(""); }} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-sm text-foreground">••••••••</span>
                  <button onClick={() => setChangingPassword(true)} className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors ml-4">Change</button>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── Storage ──────────────────────────────────────────────── */}
          <SectionCard>
            <SectionHeader title="Storage & Usage" icon={TrendingUp} gradient="from-success/70 to-info/70" />
            <div className="px-4 py-5 space-y-5">
              {usageLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-4 shimmer rounded w-3/4" />)}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-6">
                    {/* Storage arc */}
                    <div className="relative shrink-0">
                      <StorageArc pct={storageUsedPct} color={storageColor} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold" style={{ color: storageColor }}>{Math.round(storageUsedPct)}%</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground font-medium">Storage</span>
                          <span className="font-bold tabular-nums" style={{ color: storageColor }}>
                            {formatBytes(usageData?.storageUsedBytes ?? 0)} / {usageData?.plan.maxStorageGb ?? 5} GB
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${storageUsedPct}%`, background: storageColor, boxShadow: `0 0 8px ${storageColor}` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground font-medium">Bandwidth</span>
                          <span className="font-bold text-info tabular-nums">
                            {formatBytes(usageData?.bandwidthUsedBytes ?? 0)} / {bandwidthUnlimited ? "∞" : `${usageData?.plan.bandwidthGb} GB`}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${bandwidthUnlimited ? 100 : bandwidthPct}%`, background: "hsl(var(--info))", boxShadow: "0 0 8px hsl(var(--info) / 0.5)" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Current Plan</div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground uppercase">{usageData?.plan.name ?? "free"}</span>
                        <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full border border-border/40">
                          {usageData?.plan.maxStorageGb ?? 5} GB · {usageData?.plan.maxJobs ?? 3} jobs
                        </span>
                      </div>
                    </div>
                    {(usageData?.plan.name === "free" || !usageData) && (
                      <button onClick={() => navigate("/app/crypto-checkout?plan=pro")} className="flex items-center gap-1.5 text-xs font-bold text-warning border border-warning/40 rounded-xl px-4 py-2 hover:bg-warning hover:text-black transition-all shadow-[0_0_12px_hsl(38_92%_50%/0.2)] relative overflow-hidden group">
                        <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <Zap className="w-3 h-3 relative z-10" /><span className="relative z-10">Upgrade ▲</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-card rounded-lg p-3">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Active Jobs</div>
                      <p className="text-xl font-bold text-foreground tabular-nums">{usageData?.activeJobs ?? 0}<span className="text-sm text-muted-foreground"> / {usageData?.plan.maxJobs ?? 3}</span></p>
                    </div>
                    <div className="glass-card rounded-lg p-3">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Retention</div>
                      <p className="text-xl font-bold text-foreground tabular-nums">{usageData?.plan.retentionDays ?? 7}<span className="text-sm text-muted-foreground"> days</span></p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          {/* ── Download Provider ─────────────────────────────────────── */}
          <SectionCard>
            <SectionHeader title="Download Provider" icon={Zap} gradient="from-primary/70 to-info/70" />
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/20 border border-border/40">
                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  The active download engine is controlled by platform admins.
                  Currently: <strong className="text-foreground capitalize">{activeProvider === "seedr" ? "Seedr.cc" : "Cloudflare Workers"}</strong>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Cloudflare card */}
                <div className={cn(
                  "flex flex-col items-start gap-3 rounded-xl border-2 p-4 relative overflow-hidden",
                  activeProvider === "cloudflare"
                    ? "border-primary bg-primary/8 shadow-glow-primary"
                    : "border-border bg-muted/10 opacity-50"
                )}>
                  {activeProvider === "cloudflare" && <span className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />}
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border", activeProvider === "cloudflare" ? "bg-primary/10 border-primary/30" : "bg-muted border-border")}>
                    <CloudLightning className={cn("w-5 h-5", activeProvider === "cloudflare" ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className={cn("text-sm font-bold", activeProvider === "cloudflare" ? "text-primary" : "text-foreground")}>Cloudflare</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Self-hosted workers</p>
                  </div>
                  {activeProvider === "cloudflare" && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 rounded-full px-2 py-0.5 bg-primary/10">● Active</span>
                  )}
                </div>

                {/* Seedr.cc card */}
                <div className={cn(
                  "flex flex-col items-start gap-3 rounded-xl border-2 p-4 relative overflow-hidden",
                  activeProvider === "seedr"
                    ? "border-success bg-success/5 shadow-glow-success"
                    : "border-border bg-muted/10 opacity-50"
                )}>
                  {activeProvider === "seedr" && <span className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent pointer-events-none" />}
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border", activeProvider === "seedr" ? "bg-success/10 border-success/30" : "bg-muted border-border")}>
                    <Zap className={cn("w-5 h-5", activeProvider === "seedr" ? "text-success" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className={cn("text-sm font-bold", activeProvider === "seedr" ? "text-success" : "text-foreground")}>Seedr.cc</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Cloud torrent</p>
                  </div>
                  {activeProvider === "seedr"
                    ? <span className="text-[10px] font-bold uppercase tracking-widest text-success border border-success/30 rounded-full px-2 py-0.5 bg-success/10">● Active</span>
                    : <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5">Inactive</span>}
                </div>
              </div>
            </div>
          </SectionCard>


          {/* ── Integrations ─────────────────────────────────────────── */}
          <IntegrationsSection apiKeys={keysData?.keys ?? []} userEmail={userEmail} />

          {/* ── Billing ───────────────────────────────────────────────── */}
          <BillingSection planName={usageData?.plan.name ?? "free"} />


          <SectionCard>
            <SectionHeader title="Security" icon={Lock} gradient="from-warning/60 to-destructive/60" />
            <div className="px-4 py-4 space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2 border-border hover:border-primary/40 rounded-xl">
                <Lock className="w-4 h-4 text-muted-foreground" /> Change Password
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 border-border hover:border-primary/40 rounded-xl">
                <Bell className="w-4 h-4 text-muted-foreground" /> Notification Preferences
              </Button>
            </div>
          </SectionCard>

          {/* ── API Keys ──────────────────────────────────────────────── */}
          <SectionCard>
            <SectionHeader title="API Keys" icon={Key} gradient="from-info/60 to-primary/60" />

            {createdSecret && (
              <div className="mx-4 mt-4 p-4 bg-success/8 border border-success/30 rounded-xl space-y-2 neon-border-success animate-scale-in">
                <p className="text-xs font-bold text-success flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Copy your secret now — it won't be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-background/60 border border-border/60 rounded-lg px-2 py-2 text-foreground break-all select-all" style={{ fontFamily: "monospace" }}>
                    {createdSecret}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(createdSecret); setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000); }}
                    className="shrink-0 p-2 rounded-lg border border-border hover:border-primary/50 text-muted-foreground hover:text-primary transition-all"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button onClick={() => setCreatedSecret(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Dismiss</button>
              </div>
            )}

            <div className="px-4 py-3.5 border-b border-border/40">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Create New Key</div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Key name (e.g. ci-deploy)"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newKeyName.trim()) createKeyMutation.mutate(newKeyName.trim()); }}
                  className="bg-input border-border/60 rounded-xl h-9 flex-1"
                  maxLength={64}
                />
                <Button
                  size="sm"
                  className="h-9 gap-1.5 gradient-primary text-white border-0 rounded-xl shadow-glow-primary shrink-0"
                  disabled={!newKeyName.trim() || createKeyMutation.isPending}
                  onClick={() => createKeyMutation.mutate(newKeyName.trim())}
                >
                  {createKeyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Generate
                </Button>
              </div>
            </div>

            <div>
              {keysLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                    <div className="h-3 shimmer rounded flex-1" />
                    <div className="h-3 shimmer rounded w-24" />
                  </div>
                ))
              ) : (keysData?.keys ?? []).length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">No API keys yet.</div>
              ) : (
                (keysData?.keys ?? []).map((key: ApiKey) => (
                  <div key={key.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/5 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Key className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{key.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <code className="text-xs text-muted-foreground font-mono">{key.prefix}••••••••</code>
                        {key.lastUsedAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> {new Date(key.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => revokeKeyMutation.mutate(key.id)}
                      disabled={revokeKeyMutation.isPending}
                      className="text-xs text-destructive border border-destructive/30 rounded-lg px-2.5 py-1 hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40 shrink-0"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* ── International ─────────────────────────────────────────── */}
          <SectionCard>
            <SectionHeader title="International" icon={Languages} gradient="from-muted-foreground/50 to-muted-foreground/30" />
            <div className="px-4 py-3.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Site Language</div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-sm text-foreground">English (en)</span>
                <button className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors">Edit</button>
              </div>
            </div>
          </SectionCard>

          {/* ── Danger Zone ───────────────────────────────────────────── */}
          <SectionCard>
            <SectionHeader title="Danger Zone" icon={Trash2} gradient="from-destructive/80 to-destructive/60" />
            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-3">Sign out of your account on this device.</p>
                <Button
                  variant="outline"
                  className="border-border hover:border-primary/40 gap-2 rounded-xl"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Sign Out
                </Button>
              </div>
              <div className="border-t border-border/40 pt-4">
                <p className="text-sm text-muted-foreground mb-3">Permanently delete your account and all files. This cannot be undone.</p>
                <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive gap-2 rounded-xl">
                  <Trash2 className="w-4 h-4" /> Delete Account
                </Button>
              </div>
            </div>
          </SectionCard>
        </main>
      </div>
    </div>
  );
}
