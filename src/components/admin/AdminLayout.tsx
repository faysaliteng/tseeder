import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";
import {
  LayoutDashboard, Users, Briefcase, Server, HardDrive,
  ShieldAlert, ScrollText, Settings, ChevronLeft, ChevronRight,
  LogOut, Search, Bell, Menu, X, Layers,
} from "lucide-react";

const NAV = [
  { to: "/admin/overview",        label: "Overview",       icon: LayoutDashboard },
  { to: "/admin/users",           label: "Users",          icon: Users },
  { to: "/admin/jobs",            label: "Jobs",           icon: Briefcase },
  { to: "/admin/infrastructure",  label: "Infrastructure", icon: Layers },
  { to: "/admin/workers",         label: "Workers",        icon: Server },
  { to: "/admin/storage",         label: "Storage",        icon: HardDrive },
  { to: "/admin/security",        label: "Security",       icon: ShieldAlert },
  { to: "/admin/audit",           label: "Audit Log",      icon: ScrollText },
  { to: "/admin/settings",        label: "Settings",       icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-2.5 px-3 h-14 border-b border-[hsl(var(--sidebar-border))] shrink-0",
        !mobile && collapsed && "justify-center px-0",
      )}>
        <Link
          to="/admin/overview"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 min-w-0"
        >
          <img src={logoImg} alt="TorrentFlow" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          {(mobile || !collapsed) && (
            <div className="min-w-0">
              <p className="text-xs font-bold text-[hsl(var(--sidebar-foreground))] tracking-widest uppercase leading-tight">TorrentFlow</p>
              <p className="text-[10px] text-[hsl(var(--sidebar-primary))] font-semibold tracking-widest uppercase leading-tight">Admin Console</p>
            </div>
          )}
        </Link>
        {/* Mobile close */}
        {mobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto text-[hsl(var(--sidebar-foreground))] hover:text-[hsl(var(--sidebar-accent-foreground))] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              title={!mobile && collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm font-medium transition-colors",
                !mobile && collapsed && "justify-center px-0 mx-1",
                active
                  ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {(mobile || !collapsed) && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: back to app + collapse */}
      <div className={cn(
        "border-t border-[hsl(var(--sidebar-border))] py-2 px-2 space-y-1",
        !mobile && collapsed && "px-1",
      )}>
        <Link
          to="/app/dashboard"
          onClick={() => setMobileOpen(false)}
          title={!mobile && collapsed ? "Back to App" : undefined}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg text-xs text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] transition-colors",
            !mobile && collapsed && "justify-center px-0",
          )}
        >
          <LogOut className="w-4 h-4 shrink-0 rotate-180" />
          {(mobile || !collapsed) && <span>Back to App</span>}
        </Link>

        {/* Collapse toggle (desktop only) */}
        {!mobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-xs text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] transition-colors",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>
            }
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Mobile overlay sidebar ───────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-64 bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside className={cn(
        "hidden lg:flex flex-col bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] shrink-0 transition-all duration-200 z-30",
        collapsed ? "w-14" : "w-56",
      )}>
        <SidebarContent />
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-3 px-4 bg-card border-b border-border shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Global search — hidden on very small screens */}
          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search users, jobs, infohash…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex-1" />

          {/* Notification bell */}
          <button className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative">
            <Bell className="w-5 h-5" />
          </button>

          {/* Admin badge */}
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" />
            <span className="text-xs font-semibold text-foreground hidden sm:inline">Admin Session</span>
            <span className="text-xs font-semibold text-foreground sm:hidden">Admin</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
