import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { jobs as jobsApi, type ApiJob } from "@/lib/api";
import {
  Plus, Upload, Zap, Menu, X, Star,
  LogOut, User, HelpCircle, Settings, CloudLightning,
  BookOpen, Users, Copy, Check, ServerCog,
  Play, Loader2, Clock,
} from "lucide-react";
import fseederLogo from "@/assets/fseeder-logo.png";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { PricingModal } from "@/components/PricingModal";

interface TopHeaderProps {
  usage: {
    plan: { name: string; maxStorageGb: number; bandwidthGb: number };
    storageUsedBytes: number;
    bandwidthUsedBytes: number;
  } | null;
  onAddMagnet: (uri: string) => void;
  onUploadTorrent: () => void;
}

// SVG circular storage ring (Apple Watch style)
function StorageRing({
  usedPct, usedBytes, maxGb, size = 52,
}: {
  usedPct: number; usedBytes: number; maxGb: number; size?: number;
}) {
  const radius = (size - 6) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (usedPct / 100) * circ;
  const color = usedPct > 80
    ? "hsl(0 72% 51%)"
    : usedPct > 60
    ? "hsl(38 92% 50%)"
    : "hsl(142 71% 45%)";
  const glowColor = usedPct > 80 ? "hsl(0 72% 51% / 0.5)" : usedPct > 60 ? "hsl(38 92% 50% / 0.5)" : "hsl(142 71% 45% / 0.5)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <defs>
          <filter id="ring-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(220 20% 18%)" strokeWidth="4" />
        {/* Progress */}
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          filter="url(#ring-glow)"
          style={{
            transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease",
            filter: `drop-shadow(0 0 4px ${glowColor})`,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-bold tabular-nums leading-none" style={{ color }}>
          {Math.round(usedPct)}%
        </span>
      </div>
    </div>
  );
}

// Provider indicator chip — checks real agent health
function ProviderChip() {
  const provider = typeof window !== "undefined" ? (localStorage.getItem("download_provider") ?? "cloudflare") : "cloudflare";
  const isSeedr = provider === "seedr";
  const [agentHealthy, setAgentHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "https://api.fseeder.cc"}/system-status`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) { setAgentHealthy(false); return; }
        const data = await res.json();
        if (!cancelled) setAgentHealthy(data.agent?.status === "healthy");
      } catch {
        if (!cancelled) setAgentHealthy(false);
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const isHealthy = isSeedr || agentHealthy === true;
  const isLoading = !isSeedr && agentHealthy === null;

  return (
    <div className={cn(
      "hidden sm:flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border",
      isHealthy
        ? "border-success/40 bg-success/10 text-success"
        : isLoading
          ? "border-muted/40 bg-muted/10 text-muted-foreground"
          : "border-destructive/40 bg-destructive/10 text-destructive"
    )}>
      <div className={cn(
        "w-1.5 h-1.5 rounded-full",
        isHealthy ? "bg-success animate-glow-pulse" : isLoading ? "bg-muted-foreground animate-pulse" : "bg-destructive"
      )} style={{ boxShadow: isHealthy ? "0 0 4px hsl(142 71% 45%)" : undefined }} />
      {isSeedr ? "🌱 Seedr" : <><CloudLightning className="w-2.5 h-2.5" />CF</>}
    </div>
  );
}

// ── Wishlist Dropdown — shows queued jobs when free plan limit reached ─────
function WishlistDropdown({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: jobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list({ limit: 100 }),
    staleTime: 10_000,
  });

  const allJobs: ApiJob[] = jobsData?.data ?? [];
  const activeStatuses = ["downloading", "uploading", "metadata_fetch", "submitted"];
  const activeJobs = allJobs.filter(j => activeStatuses.includes(j.status));
  const queuedJobs = allJobs.filter(j => j.status === "queued");
  // On free plan, max 2 simultaneous - show queued as wishlist
  const wishlistJobs = queuedJobs;
  const totalWishlist = wishlistJobs.length;

  return (
    <div className="relative hidden sm:block">
      <button
        onClick={onToggle}
        title="Wishlist"
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 relative",
          open ? "text-warning bg-warning/10" : "text-muted-foreground hover:text-warning hover:bg-muted/40"
        )}
      >
        <Star className="w-5 h-5" />
        {totalWishlist > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-warning text-[9px] font-bold text-black flex items-center justify-center shadow-[0_0_6px_hsl(38_92%_50%/0.5)]">
            {totalWishlist}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute right-0 top-12 z-50 w-80 glass-premium rounded-xl shadow-[0_12px_40px_hsl(220_26%_0%/0.6)] border border-border/60 animate-scale-in overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <span className="text-sm font-bold text-foreground">Wishlist</span>
              <div className="flex items-center gap-2">
                {totalWishlist > 0 && (
                  <span className="text-xs text-warning font-semibold">{totalWishlist} queued</span>
                )}
                <Star className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            {/* Active downloads count */}
            <div className="px-4 py-2 border-b border-border/30 bg-muted/5">
              <p className="text-xs text-muted-foreground">
                <span className="text-primary font-semibold">{activeJobs.length}</span> / 2 active downloads (Free plan)
              </p>
            </div>
            {totalWishlist === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">Wishlist Empty</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Free plan allows 2 simultaneous downloads. Extra tasks queue here automatically.
                </p>
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto">
                {wishlistJobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => { navigate(`/app/dashboard/${job.id}`); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left border-b border-border/20 last:border-0"
                  >
                    <Clock className="w-4 h-4 text-warning shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate font-medium">{job.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.bytesTotal > 0 ? formatBytes(job.bytesTotal) : "Waiting…"} · Queued
                      </p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function TopHeader({ usage, onAddMagnet, onUploadTorrent }: TopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [addRipple, setAddRipple] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const pasteRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const safeUsage = usage ?? {
    plan: { name: "free", maxStorageGb: 5, bandwidthGb: 50 },
    storageUsedBytes: 0,
    bandwidthUsedBytes: 0,
  };
  const storageUsedPct = Math.min(100, (safeUsage.storageUsedBytes / (safeUsage.plan.maxStorageGb * 1e9)) * 100);
  const isPro = safeUsage.plan.name !== "free";

  const handlePasteSubmit = () => {
    const val = pasteValue.trim();
    if (!val) return;
    onAddMagnet(val);
    setPasteValue("");
    setPasteOpen(false);
  };

  const handlePasteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handlePasteSubmit();
    if (e.key === "Escape") { setPasteOpen(false); setPasteValue(""); }
  };

  const openPaste = () => {
    setAddRipple(true);
    setTimeout(() => setAddRipple(false), 600);
    setPasteOpen(true);
    setTimeout(() => pasteRef.current?.focus(), 50);
  };

  const isSettings = location.pathname === "/app/settings";
  const isDashboard = location.pathname === "/app/dashboard" || location.pathname === "/";

  return (
    <>
    <header className="sticky top-0 z-50 glass border-b border-border/60 shadow-[0_4px_24px_hsl(220_26%_0%/0.4)]">
      <div className="flex items-center gap-2.5 px-4 h-[72px]">

        {/* Logo */}
        <Link
          to="/app/dashboard"
          className="relative flex items-center justify-center w-12 h-12 rounded-xl overflow-hidden shrink-0 hover:scale-105 transition-transform duration-200"
          style={{ border: "1px solid hsl(239 84% 67% / 0.3)", boxShadow: "0 0 16px hsl(239 84% 67% / 0.15)" }}
        >
          <img src={fseederLogo} alt="fseeder" className="w-full h-full object-cover" />
        </Link>

        {/* Storage ring + plan info */}
        <div className="flex items-center gap-2.5 ml-1">
          <StorageRing
            usedPct={storageUsedPct}
            usedBytes={safeUsage.storageUsedBytes}
            maxGb={safeUsage.plan.maxStorageGb}
          />
          <div className="flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-foreground tracking-widest uppercase whitespace-nowrap">
                {isPro ? "PRO" : "FREE"}
              </span>
              {!isPro && (
                <button
                  onClick={() => setPricingOpen(true)}
                  className="text-[10px] font-bold text-warning flex items-center gap-0.5 hover:opacity-80 whitespace-nowrap shrink-0 transition-opacity"
                >
                  ▲ UPGRADE
                </button>
              )}
            </div>
            <div className="text-xs font-semibold">
              <span className="text-success">{formatBytes(safeUsage.storageUsedBytes)}</span>
              <span className="text-muted-foreground"> / {safeUsage.plan.maxStorageGb} GB</span>
            </div>
            <ProviderChip />
          </div>
        </div>

        {/* Org switcher */}
        <div className="hidden sm:block ml-1">
          <OrgSwitcher />
        </div>

        <div className="flex-1" />

        {/* Wishlist star button */}
        <WishlistDropdown open={wishlistOpen} onToggle={() => { setWishlistOpen(o => !o); setServerOpen(false); }} onClose={() => setWishlistOpen(false)} />

        {/* Paste bar or action buttons */}
        {pasteOpen ? (
          <div className="flex items-center gap-1.5 flex-1 max-w-sm animate-slide-up-fade">
            <button
              onClick={() => { setPasteOpen(false); setPasteValue(""); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <input
              ref={pasteRef}
              type="text"
              placeholder="Paste magnet or URL…"
              value={pasteValue}
              onChange={e => setPasteValue(e.target.value)}
              onKeyDown={handlePasteKeyDown}
              className="flex-1 bg-input/60 border border-primary/40 rounded-xl px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_hsl(239_84%_67%/0.15)] transition-all backdrop-blur-sm"
            />
            <button
              onClick={handlePasteSubmit}
              className="w-8 h-8 flex items-center justify-center rounded-lg gradient-primary text-white shadow-glow-primary shrink-0 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onUploadTorrent}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
              title="Upload .torrent"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            {/* Glowing add button with ripple */}
            <button
              onClick={openPaste}
              title="Paste magnet link"
              className="relative flex items-center justify-center w-10 h-10 rounded-xl gradient-primary text-white shadow-glow-primary hover:opacity-90 transition-all hover:scale-105 duration-150 overflow-hidden"
            >
              <Plus className="w-5 h-5 relative z-10" />
              {addRipple && (
                <span className="absolute inset-0 rounded-xl animate-ping bg-white/20" />
              )}
            </button>

            <IconBtn onClick={onUploadTorrent} title="Upload .torrent file">
              <Upload className="w-4.5 h-4.5" />
            </IconBtn>

            {/* Streaming server selector (lightning) */}
            <div className="relative hidden sm:block">
              <IconBtn
                onClick={() => { setServerOpen(o => !o); setWishlistOpen(false); }}
                title="Select Download + Streaming Server"
                className={cn(serverOpen && "text-primary bg-primary/10")}
              >
                <Zap className="w-4.5 h-4.5" />
              </IconBtn>
              {serverOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setServerOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-72 glass-premium rounded-xl shadow-[0_12px_40px_hsl(220_26%_0%/0.6)] border border-border/60 animate-scale-in overflow-hidden">
                    <div className="px-4 py-3 text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/40"
                      style={{ background: "linear-gradient(90deg, hsl(239 84% 67% / 0.15), transparent)" }}>
                      <ServerCog className="w-4 h-4 text-primary" />
                      Select Download + Streaming Server
                      <Zap className="w-3.5 h-3.5 text-primary ml-auto" />
                    </div>
                    <div className="py-1">
                      <ServerOption label="Check Fastest" emoji="✅" active={false} onClick={() => setServerOpen(false)} />
                      <ServerOption label="Cloudflare Edge" emoji="⚡" active={true} onClick={() => setServerOpen(false)} />
                    </div>
                    <div className="mx-3 dashed-separator" />
                    <button
                      onClick={() => { setServerOpen(false); setPricingOpen(true); }}
                      className="w-full px-4 py-2.5 text-sm text-primary font-semibold hover:bg-primary/5 transition-colors flex items-center gap-2"
                    >
                      💎 Upgrade to Unlock All Locations
                    </button>
                    <div className="mx-3 dashed-separator" />
                    <div className="py-1 opacity-50 pointer-events-none">
                      <ServerOption label="Germany" emoji="🇩🇪" active={false} locked onClick={() => {}} />
                      <ServerOption label="US North" emoji="🇺🇸" active={false} locked onClick={() => {}} />
                      <ServerOption label="Singapore" emoji="🇸🇬" active={false} locked onClick={() => {}} />
                    </div>
                  </div>
                </>
              )}
            </div>

            <IconBtn
              onClick={() => { setMenuOpen(o => !o); setWishlistOpen(false); setServerOpen(false); }}
              title="Menu"
              className="relative"
            >
              <Menu className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border border-background shadow-glow-danger" />
            </IconBtn>
          </div>
        )}

        {/* Avatar circle */}
        <div className="w-9 h-9 rounded-full overflow-hidden border border-primary/20 bg-secondary flex items-center justify-center shrink-0 hidden sm:block ml-1"
          style={{ boxShadow: "0 0 8px hsl(239 84% 67% / 0.2)" }}>
          <img src={fseederLogo} alt="" className="w-full h-full object-cover opacity-90" />
        </div>
      </div>

      {/* Dashed separator */}
      <div className="dashed-separator mx-4" />

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-4 top-[76px] z-50 w-64 glass-premium rounded-2xl shadow-[0_16px_48px_hsl(220_26%_0%/0.6)] overflow-hidden animate-scale-in border border-primary/10">
            {!isPro && (
              <button
                onClick={() => { setMenuOpen(false); setPricingOpen(true); }}
                className="w-full flex items-center justify-between px-4 py-3.5 font-bold text-sm hover:opacity-90 transition-opacity relative overflow-hidden group"
                style={{ background: "linear-gradient(90deg, hsl(38 92% 40%), hsl(38 92% 50%))" }}
              >
                <span className="text-black flex items-center gap-2"><Zap className="w-4 h-4" /> Become Premium</span>
                <span className="text-xl">🏆</span>
                <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </button>
            )}
            <div className="py-1.5">
              <DropdownLink icon="👥" label="Invite For Space" onClick={() => { setMenuOpen(false); setInviteOpen(true); }} />
              <div className="mx-3 my-1 dashed-separator" />
              <DropdownLink icon={null} label="Files" lucideIcon={Star} onClick={() => { navigate("/app/dashboard"); setMenuOpen(false); }} />
              <DropdownLink icon={null} label="Account" lucideIcon={User} onClick={() => { navigate("/app/settings"); setMenuOpen(false); }} />
              <DropdownLink icon={null} label="Help" lucideIcon={HelpCircle} onClick={() => { window.open("https://fseeder.cc/help", "_blank"); setMenuOpen(false); }} />
              <DropdownLink icon={null} label="Tutorial" lucideIcon={BookOpen} onClick={() => { window.open("https://fseeder.cc/blog", "_blank"); setMenuOpen(false); }} />
            </div>
            <div className="mx-3 dashed-separator" />
            <div className="py-1.5">
              <DropdownLink icon={null} label="Logout" lucideIcon={LogOut} onClick={async () => { 
                setMenuOpen(false);
                try { const { auth, setCsrfToken } = await import("@/lib/api"); await auth.logout(); setCsrfToken(""); } catch {}
                const { QueryClient } = await import("@tanstack/react-query");
                window.location.href = "/auth/login";
              }} />
            </div>
          </div>
        </>
      )}
    </header>

    <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />

    {/* Invite For Space Modal */}
    {inviteOpen && (
      <>
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={() => setInviteOpen(false)} />
        <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
          <div className="relative w-full max-w-md pointer-events-auto glass-premium rounded-2xl shadow-[0_20px_60px_hsl(220_26%_0%/0.7)] border border-primary/10 animate-scale-in overflow-hidden p-6">
            <button onClick={() => setInviteOpen(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Invite For Space</h3>
                <p className="text-xs text-muted-foreground">Get 2 GB when your friend upgrades to Pro</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Your Referral Link</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/auth/register?ref=${btoa(Date.now().toString()).slice(0,8)}`}
                    className="flex-1 bg-input/60 border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/auth/register?ref=${btoa(Date.now().toString()).slice(0,8)}`);
                      setInviteCopied(true);
                      setTimeout(() => setInviteCopied(false), 2000);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shrink-0"
                  >
                    {inviteCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="dashed-separator" />
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Or invite by email</label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="flex-1 bg-input/60 border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                  <button
                    onClick={() => {
                      if (inviteEmail.trim()) {
                        window.open(`mailto:${inviteEmail}?subject=Join%20fseeder%20Cloud&body=Try%20fseeder%20-%20the%20fastest%20cloud%20torrent%20manager!%20${encodeURIComponent(window.location.origin)}/auth/register`);
                        setInviteEmail("");
                      }
                    }}
                    className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-bold shadow-glow-primary hover:opacity-90 transition-opacity shrink-0"
                  >
                    Send
                  </button>
                </div>
              </div>
              <div className="bg-success/5 border border-success/20 rounded-lg p-3 mt-2">
                <p className="text-xs text-success font-semibold">🎁 When your friend upgrades to any paid plan, you both get 2 GB extra storage!</p>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}

function IconBtn({
  onClick, title, className, children,
}: {
  onClick?: () => void; title?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all duration-150",
        className,
      )}
    >
      {children}
    </button>
  );
}

function DropdownLink({
  icon, lucideIcon: LucideIcon, label, onClick,
}: {
  icon: string | null;
  lucideIcon?: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors group"
    >
      <span className="group-hover:translate-x-0.5 transition-transform duration-150">{label}</span>
      {icon && <span className="text-base">{icon}</span>}
      {LucideIcon && <LucideIcon className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

function ServerOption({ label, emoji, active, locked, onClick }: {
  label: string; emoji: string; active: boolean; locked?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
        active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/20 hover:text-foreground",
        locked && "opacity-50"
      )}
    >
      <div className={cn(
        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
        active ? "border-primary" : "border-muted-foreground/40"
      )}>
        {active && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
      <span className="text-base">{emoji}</span>
      <span className="font-medium">{label}</span>
      {locked && <Zap className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
    </button>
  );
}
