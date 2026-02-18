import { useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/mock-data";
import {
  Plus, Upload, Zap, Menu, X, Star, Shield, Settings,
  HelpCircle, LogOut, ChevronUp, User, Link as LinkIcon,
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

  const storageUsedPct = Math.min(100, Math.round(
    (usage.storageUsedBytes / (usage.plan.maxStorageGb * 1e9)) * 100
  ));
  const bandwidthUsedPct = Math.min(100, Math.round(
    (usage.bandwidthUsedBytes / (usage.plan.bandwidthGb * 1e9)) * 100
  ));

  const isPro = usage.plan.name !== "free";

  const handlePasteSubmit = () => {
    const val = pasteValue.trim();
    if (val.startsWith("magnet:")) {
      onAddMagnet(val);
      setPasteValue("");
      setPasteOpen(false);
    }
  };

  const handlePasteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handlePasteSubmit();
    if (e.key === "Escape") { setPasteOpen(false); setPasteValue(""); }
  };

  const openPaste = () => {
    setPasteOpen(true);
    setTimeout(() => pasteRef.current?.focus(), 50);
  };

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border shadow-card">
      <div className="flex items-center gap-3 px-4 h-16">

        {/* Logo + User info */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="flex items-center justify-center w-11 h-11 rounded-full overflow-hidden border-2 border-border shrink-0 hover:border-primary/50 transition-colors">
            <img src={logoImg} alt="TorrentFlow" className="w-full h-full object-cover" />
          </Link>

          <div className="hidden sm:block min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground tracking-wide uppercase">
                {isPro ? "PRO" : "FREE"}
              </span>
              {!isPro && (
                <button className="text-xs font-semibold text-warning flex items-center gap-0.5 hover:underline">
                  <ChevronUp className="w-3 h-3" /> Upgrade
                </button>
              )}
            </div>
            {/* Storage bar */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${storageUsedPct}%`,
                    background: storageUsedPct > 80
                      ? "hsl(var(--destructive))"
                      : "hsl(var(--success))",
                  }}
                />
              </div>
              <span className="text-xs font-medium">
                <span className="text-success">{formatBytes(usage.storageUsedBytes)}</span>
                <span className="text-muted-foreground"> / {usage.plan.maxStorageGb} GB</span>
              </span>
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quick paste URL bar */}
        {pasteOpen ? (
          <div className="flex items-center gap-1 flex-1 max-w-md animate-in fade-in slide-in-from-top-2 duration-150">
            <button
              onClick={() => { setPasteOpen(false); setPasteValue(""); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <input
              ref={pasteRef}
              type="text"
              placeholder="Paste magnet link URL here…"
              value={pasteValue}
              onChange={e => setPasteValue(e.target.value)}
              onKeyDown={handlePasteKeyDown}
              className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteValue.trim()}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {/* Star / favourites */}
            <button
              className="flex flex-col items-center justify-center w-10 h-10 text-muted-foreground hover:text-foreground transition-colors"
              title="Starred files"
            >
              <Star className="w-5 h-5" />
            </button>

            {/* Add / paste */}
            <button
              onClick={openPaste}
              className="flex items-center justify-center w-10 h-10 text-muted-foreground hover:text-foreground transition-colors"
              title="Paste magnet link"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Upload torrent */}
            <button
              onClick={onUploadTorrent}
              className="flex items-center justify-center w-10 h-10 text-muted-foreground hover:text-foreground transition-colors"
              title="Upload .torrent file"
            >
              <Upload className="w-5 h-5" />
            </button>

            {/* Zap / speed */}
            <button
              className="hidden sm:flex items-center justify-center w-10 h-10 text-muted-foreground hover:text-foreground transition-colors"
              title="Speed settings"
            >
              <Zap className="w-5 h-5" />
            </button>

            {/* Hamburger menu */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center justify-center w-10 h-10 text-muted-foreground hover:text-foreground transition-colors relative"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* App icon */}
        <div className="w-8 h-8 rounded-full overflow-hidden border border-border hidden sm:block">
          <img src={logoImg} alt="" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-4 top-[68px] z-50 w-56 bg-card border border-border rounded-xl shadow-card overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {!isPro && (
              <button className="w-full flex items-center justify-between px-4 py-3 bg-warning text-warning-foreground font-bold text-sm hover:opacity-90 transition-opacity">
                <span>Become Premium</span>
                <span className="text-lg">🏆</span>
              </button>
            )}
            <div className="py-1">
              <MenuLink icon={Star} label="Favourites" onClick={() => setMenuOpen(false)} />
              <MenuLink icon={User} label="Account" onClick={() => { navigate("/settings"); setMenuOpen(false); }} />
              <MenuLink icon={Shield} label="Admin" onClick={() => { navigate("/admin"); setMenuOpen(false); }} />
              <MenuLink icon={HelpCircle} label="Help" onClick={() => setMenuOpen(false)} />
            </div>
            <div className="border-t border-border py-1">
              <MenuLink icon={LogOut} label="Logout" onClick={() => { navigate("/auth/login"); setMenuOpen(false); }} />
            </div>
          </div>
        </>
      )}
    </header>
  );
}

function MenuLink({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
    >
      <span>{label}</span>
      <Icon className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}
