import { useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/mock-data";
import {
  Plus, Upload, Zap, Menu, X, Star,
  LogOut, User, HelpCircle, Settings, CloudLightning,
} from "lucide-react";
import nexloadLogo from "@/assets/nexload-logo.png";

interface TopHeaderProps {
  usage: {
    plan: { name: string; maxStorageGb: number; bandwidthGb: number };
    storageUsedBytes: number;
    bandwidthUsedBytes: number;
  };
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

// Provider indicator chip
function ProviderChip() {
  const provider = typeof window !== "undefined" ? (localStorage.getItem("download_provider") ?? "cloudflare") : "cloudflare";
  const isSeedr = provider === "seedr";
  return (
    <div className={cn(
      "hidden sm:flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border",
      isSeedr
        ? "border-success/40 bg-success/10 text-success"
        : "border-orange-500/40 bg-orange-500/10 text-orange-400"
    )}>
      <div className={cn(
        "w-1.5 h-1.5 rounded-full animate-glow-pulse",
        isSeedr ? "bg-success" : "bg-orange-400"
      )} style={{ boxShadow: isSeedr ? "0 0 4px hsl(142 71% 45%)" : "0 0 4px rgb(251 146 60)" }} />
      {isSeedr ? "🌱 Seedr" : <><CloudLightning className="w-2.5 h-2.5" />CF</>}
    </div>
  );
}

export function TopHeader({ usage, onAddMagnet, onUploadTorrent }: TopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [addRipple, setAddRipple] = useState(false);
  const pasteRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const storageUsedPct = Math.min(100, (usage.storageUsedBytes / (usage.plan.maxStorageGb * 1e9)) * 100);
  const isPro = usage.plan.name !== "free";

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
    <header className="sticky top-0 z-50 glass border-b border-border/60 shadow-[0_4px_24px_hsl(220_26%_0%/0.4)]">
      <div className="flex items-center gap-2.5 px-4 h-[72px]">

        {/* Logo */}
        <Link
          to="/app/dashboard"
          className="relative flex items-center justify-center w-12 h-12 rounded-xl overflow-hidden shrink-0 hover:scale-105 transition-transform duration-200"
          style={{ border: "1px solid hsl(239 84% 67% / 0.3)", boxShadow: "0 0 16px hsl(239 84% 67% / 0.15)" }}
        >
          <img src={nexloadLogo} alt="Nexload" className="w-full h-full object-cover" />
        </Link>

        {/* Storage ring + plan info */}
        <div className="flex items-center gap-2.5 ml-1">
          <StorageRing
            usedPct={storageUsedPct}
            usedBytes={usage.storageUsedBytes}
            maxGb={usage.plan.maxStorageGb}
          />
          <div className="flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-foreground tracking-widest uppercase whitespace-nowrap">
                {isPro ? "PRO" : "FREE"}
              </span>
              {!isPro && (
                <button className="text-[10px] font-bold text-warning flex items-center gap-0.5 hover:opacity-80 whitespace-nowrap shrink-0 transition-opacity">
                  ▲ UPGRADE
                </button>
              )}
            </div>
            <div className="text-xs font-semibold">
              <span className="text-success">{formatBytes(usage.storageUsedBytes)}</span>
              <span className="text-muted-foreground"> / {usage.plan.maxStorageGb} GB</span>
            </div>
            <ProviderChip />
          </div>
        </div>

        <div className="flex-1" />

        {/* Nav tabs */}
        <nav className="hidden sm:flex items-center gap-1 mr-2 h-full">
          <NavTab to="/app/dashboard" active={isDashboard}>
            <Star className="w-4 h-4" />
          </NavTab>
          <NavTab to="/app/settings" active={isSettings}>
            <Settings className="w-4 h-4" />
          </NavTab>
        </nav>

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
            <button
              className="w-8 h-8 hidden sm:flex items-center justify-center rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors shrink-0"
              title="Speed"
            >
              <Zap className="w-4 h-4" />
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

            <IconBtn className="hidden sm:flex" title="Transfer speed">
              <Zap className="w-4.5 h-4.5" />
            </IconBtn>

            <IconBtn
              onClick={() => setMenuOpen(o => !o)}
              title="Menu"
              className="relative"
            >
              <Menu className="w-5 h-5" />
              {/* Notification dot */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border border-background shadow-glow-danger" />
            </IconBtn>
          </div>
        )}

        {/* Avatar circle */}
        <div className="w-9 h-9 rounded-full overflow-hidden border border-primary/20 bg-secondary flex items-center justify-center shrink-0 hidden sm:block ml-1"
          style={{ boxShadow: "0 0 8px hsl(239 84% 67% / 0.2)" }}>
          <img src={nexloadLogo} alt="" className="w-full h-full object-cover opacity-90" />
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
              <button className="w-full flex items-center justify-between px-4 py-3.5 font-bold text-sm hover:opacity-90 transition-opacity relative overflow-hidden group"
                style={{ background: "linear-gradient(90deg, hsl(38 92% 40%), hsl(38 92% 50%))" }}>
                <span className="text-black flex items-center gap-2"><Zap className="w-4 h-4" /> Become Premium</span>
                <span className="text-xl">🏆</span>
                <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </button>
            )}
            <div className="py-1.5">
              <DropdownLink icon="👥" label="Invite For Space" onClick={() => setMenuOpen(false)} />
              <div className="mx-3 my-1 dashed-separator" />
              <DropdownLink icon={null} label="Files" lucideIcon={Star} onClick={() => { navigate("/app/dashboard"); setMenuOpen(false); }} />
              <DropdownLink icon={null} label="Account" lucideIcon={User} onClick={() => { navigate("/app/settings"); setMenuOpen(false); }} />
              <DropdownLink icon={null} label="Help" lucideIcon={HelpCircle} onClick={() => setMenuOpen(false)} />
            </div>
            <div className="mx-3 dashed-separator" />
            <div className="py-1.5">
              <DropdownLink icon={null} label="Logout" lucideIcon={LogOut} onClick={() => { navigate("/auth/login"); setMenuOpen(false); }} />
            </div>
          </div>
        </>
      )}
    </header>
  );
}

function NavTab({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center justify-center px-3 pb-1 pt-1 transition-all duration-200",
        active
          ? "text-primary border-b-2 border-primary drop-shadow-[0_0_6px_hsl(239_84%_67%/0.6)]"
          : "text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-border",
      )}
    >
      {children}
    </Link>
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
