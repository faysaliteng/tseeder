import { useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/mock-data";
import {
  Plus, Upload, Zap, Menu, X, Star,
  LogOut, User, HelpCircle, Settings,
} from "lucide-react";
import logoImg from "@/assets/logo.png";

interface TopHeaderProps {
  usage: {
    plan: { name: string; maxStorageGb: number; bandwidthGb: number };
    storageUsedBytes: number;
    bandwidthUsedBytes: number;
  };
  onAddMagnet: (uri: string) => void;
  onUploadTorrent: () => void;
}

export function TopHeader({ usage, onAddMagnet, onUploadTorrent }: TopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
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
    setPasteOpen(true);
    setTimeout(() => pasteRef.current?.focus(), 50);
  };

  const isSettings = location.pathname === "/app/settings";
  const isDashboard = location.pathname === "/app/dashboard" || location.pathname === "/";

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-dashed border-border shadow-card">
      {/* Main header row */}
      <div className="flex items-center gap-2 px-4 h-[72px]">

        {/* Avatar / Logo circle */}
        <Link
          to="/app/dashboard"
          className="flex items-center justify-center w-14 h-14 rounded-full overflow-hidden border-2 border-border shrink-0 hover:border-primary/60 transition-colors bg-secondary"
        >
          <img src={logoImg} alt="TorrentFlow" className="w-full h-full object-cover" />
        </Link>

        {/* Plan label + storage bar */}
        <div className="flex flex-col min-w-0 ml-1 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs sm:text-sm text-foreground tracking-widest uppercase whitespace-nowrap">
              {isPro ? "PRO" : (
                <>
                  <span className="hidden sm:inline">NON-PREMIUM</span>
                  <span className="sm:hidden">FREE</span>
                </>
              )}
            </span>
            {!isPro && (
              <button className="text-xs font-bold text-warning flex items-center gap-0.5 hover:underline whitespace-nowrap shrink-0">
                ▲ GET MORE
              </button>
            )}
          </div>
          {/* Seedr-style storage progress bar */}
          <div className="mt-1 w-20 sm:w-32 h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${storageUsedPct}%`,
                background: storageUsedPct > 80
                  ? "hsl(var(--destructive))"
                  : "hsl(142 71% 45%)",
              }}
            />
          </div>
          <div className="mt-0.5 text-xs font-semibold">
            <span className="text-success">{formatBytes(usage.storageUsedBytes)}</span>
            <span className="text-muted-foreground"> / {usage.plan.maxStorageGb}.00 GB</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Seedr-style nav tabs (Files / Settings) */}
        <nav className="hidden sm:flex items-center gap-1 mr-2 h-full">
          <NavTab to="/app/dashboard" active={isDashboard}>
            <Star className="w-4 h-4" />
          </NavTab>
          <NavTab to="/app/settings" active={isSettings}>
            <Settings className="w-4 h-4" />
          </NavTab>
        </nav>

        {/* Paste URL bar (expands in place) */}
        {pasteOpen ? (
          <div className="flex items-center gap-1.5 flex-1 max-w-sm animate-in fade-in slide-in-from-right-2 duration-150">
            <button
              onClick={() => { setPasteOpen(false); setPasteValue(""); }}
              className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground transition-colors shrink-0 text-xs font-bold"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <input
              ref={pasteRef}
              type="text"
              placeholder="Paste link URL Here"
              value={pasteValue}
              onChange={e => setPasteValue(e.target.value)}
              onKeyDown={handlePasteKeyDown}
              className="flex-1 bg-input border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={handlePasteSubmit}
              className="w-8 h-8 flex items-center justify-center rounded border border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onUploadTorrent}
              className="w-8 h-8 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Upload .torrent"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              className="w-8 h-8 hidden sm:flex items-center justify-center rounded border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
              title="Speed"
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            {/* Add / paste magnet */}
            <IconBtn onClick={openPaste} title="Paste magnet link">
              <Plus className="w-5 h-5" />
            </IconBtn>

            {/* Upload torrent */}
            <IconBtn onClick={onUploadTorrent} title="Upload .torrent file">
              <Upload className="w-5 h-5" />
            </IconBtn>

            {/* Speed/zap */}
            <IconBtn className="hidden sm:flex" title="Transfer speed">
              <Zap className="w-5 h-5" />
            </IconBtn>

            {/* Hamburger */}
            <IconBtn onClick={() => setMenuOpen(o => !o)} title="Menu">
              <Menu className="w-5 h-5" />
            </IconBtn>
          </div>
        )}

        {/* App globe icon (Seedr uses Brave browser icon) */}
        <div className="w-9 h-9 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0 hidden sm:block ml-1">
          <img src={logoImg} alt="" className="w-full h-full object-cover opacity-80" />
        </div>
      </div>

      {/* Seedr-style dashed separator */}
      <div className="dashed-separator mx-4" />

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-4 top-[76px] z-50 w-60 bg-card border border-border rounded-xl shadow-card overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {!isPro && (
              <button className="w-full flex items-center justify-between px-4 py-3.5 bg-warning text-black font-bold text-sm hover:opacity-90 transition-opacity">
                <span>Become Premium</span>
                <span className="text-xl">🏆</span>
              </button>
            )}
            <div className="py-1.5">
              <DropdownLink icon="👥" label="Invite For Space" onClick={() => setMenuOpen(false)} />
              <div className="mx-3 my-1 dashed-separator" />
              <DropdownLink icon={null} label="Files" lucideIcon={Star} onClick={() => { navigate("/app/dashboard"); setMenuOpen(false); }} />
              <DropdownLink icon={null} label="Account" lucideIcon={User} onClick={() => { navigate("/app/settings"); setMenuOpen(false); }} />
              
              <DropdownLink icon={null} label="Tutorials" lucideIcon={HelpCircle} onClick={() => setMenuOpen(false)} />
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
        "flex flex-col items-center justify-center px-3 pb-1 pt-1 transition-colors",
        active ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground border-b-2 border-transparent",
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
        "flex items-center justify-center w-10 h-10 text-muted-foreground hover:text-foreground transition-colors",
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
      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
    >
      <span>{label}</span>
      {icon && <span className="text-base">{icon}</span>}
      {LucideIcon && <LucideIcon className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}
