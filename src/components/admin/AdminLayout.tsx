import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import fseederLogo from "@/assets/fseeder-logo.png";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { admin as adminApi, authMe, auth, setCsrfToken } from "@/lib/api";
import {
  LayoutDashboard, Users, Briefcase, Server, HardDrive,
  ShieldAlert, ScrollText, Settings, ChevronLeft, ChevronRight,
  LogOut, Search, Bell, Menu, X, Layers,
  Command, FileText, AlertOctagon, History, Activity, Power,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const NAV = [
  { to: "/admin/overview",        label: "Overview",        icon: LayoutDashboard, color: "text-primary" },
  { to: "/admin/users",           label: "Users",           icon: Users,           color: "text-info" },
  { to: "/admin/jobs",            label: "Jobs",            icon: Briefcase,       color: "text-warning" },
  { to: "/admin/infrastructure",  label: "Infrastructure",  icon: Layers,          color: "text-success" },
  { to: "/admin/workers",         label: "Workers",         icon: Server,          color: "text-primary-glow" },
  { to: "/admin/storage",         label: "Storage",         icon: HardDrive,       color: "text-info" },
  { to: "/admin/observability",   label: "Observability",   icon: Activity,        color: "text-success" },
  { to: "/admin/dlq",             label: "DLQ Replay",      icon: AlertOctagon,    color: "text-destructive" },
  { to: "/admin/search",          label: "Global Search",   icon: Search,          color: "text-info" },
  { to: "/admin/config-history",  label: "Config History",  icon: History,         color: "text-muted-foreground" },
  { to: "/admin/security",        label: "Security",        icon: ShieldAlert,     color: "text-destructive" },
  { to: "/admin/audit",           label: "Audit Log",       icon: ScrollText,      color: "text-muted-foreground" },
  { to: "/admin/blog",            label: "Blog / CMS",      icon: FileText,        color: "text-info" },
  { to: "/admin/settings",        label: "Settings",        icon: Settings,        color: "text-muted-foreground" },
];

const CMD_ITEMS = [
  { group: "Navigation", label: "Overview",       to: "/admin/overview",       icon: LayoutDashboard },
  { group: "Navigation", label: "Users",          to: "/admin/users",          icon: Users },
  { group: "Navigation", label: "Jobs",           to: "/admin/jobs",           icon: Briefcase },
  { group: "Navigation", label: "Infrastructure", to: "/admin/infrastructure", icon: Layers },
  { group: "Navigation", label: "Workers",        to: "/admin/workers",        icon: Server },
  { group: "Navigation", label: "Storage",        to: "/admin/storage",        icon: HardDrive },
  { group: "Navigation", label: "Observability",  to: "/admin/observability",  icon: Activity },
  { group: "Navigation", label: "DLQ Replay",     to: "/admin/dlq",            icon: AlertOctagon },
  { group: "Navigation", label: "Global Search",  to: "/admin/search",         icon: Search },
  { group: "Navigation", label: "Config History", to: "/admin/config-history", icon: History },
  { group: "Navigation", label: "Security",       to: "/admin/security",       icon: ShieldAlert },
  { group: "Navigation", label: "Audit Log",      to: "/admin/audit",          icon: ScrollText },
  { group: "Navigation", label: "Blog / CMS",     to: "/admin/blog",           icon: FileText },
  { group: "Navigation", label: "Settings",       to: "/admin/settings",       icon: Settings },
  { group: "App", label: "Back to App",   to: "/app/dashboard", icon: LogOut },
  { group: "App", label: "Admin Login",   to: "/admin/login",   icon: Command },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Auth guard: redirect to /admin/login if not authenticated or not admin ──
  const { data: meData, isLoading: meLoading, isError: meError } = useQuery({
    queryKey: ["admin-auth-me"],
    queryFn: () => authMe.me(),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (meLoading) return;
    if (meError || !meData?.user) {
      navigate("/admin/login", { replace: true });
      return;
    }
    const role = meData.user.role;
    if (!["admin", "superadmin"].includes(role)) {
      navigate("/admin/login", { replace: true });
    }
  }, [meData, meLoading, meError, navigate]);

  // Real system health for notification bell
  const isAuthed = !meLoading && !meError && meData?.user && ["admin", "superadmin"].includes(meData.user.role);

  const { data: healthData } = useQuery({
    queryKey: ["admin-system-health-alerts"],
    queryFn: () => adminApi.systemHealth() as Promise<any>,
    refetchInterval: 60_000,
    retry: false,
    enabled: !!isAuthed,
  });

  const realAlerts: Array<{ id: number; msg: string; level: string }> = [];
  if (healthData) {
    if ((healthData.failedLast24h ?? 0) > 5) {
      realAlerts.push({ id: 1, msg: `${healthData.failedLast24h} jobs failed in the last 24h`, level: "danger" });
    }
    if (healthData.agent && healthData.agent.activeJobs >= healthData.agent.maxJobs) {
      realAlerts.push({ id: 2, msg: `Agent at full capacity: ${healthData.agent.activeJobs}/${healthData.agent.maxJobs} jobs`, level: "warn" });
    }
    if (healthData.status !== "healthy") {
      realAlerts.push({ id: 3, msg: `System status: ${healthData.status}`, level: "danger" });
    }
  }
  const alerts = realAlerts;

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Show nothing while checking auth
  if (meLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthed) {
    return null; // will redirect via useEffect
  }

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-2.5 px-3 h-14 border-b border-sidebar-border shrink-0",
        !mobile && collapsed && "justify-center px-0",
      )}>
        <Link to="/admin/overview" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-primary/20"
            style={{ boxShadow: "0 0 8px hsl(239 84% 67% / 0.2)" }}>
            <img src={fseederLogo} alt="fseeder" className="w-full h-full object-cover" />
          </div>
          {(mobile || !collapsed) && (
            <div className="min-w-0">
              <p className="text-xs font-bold text-sidebar-foreground tracking-widest uppercase leading-tight">fseeder</p>
              <p className="text-[10px] text-primary font-bold tracking-widest uppercase leading-tight">Admin Console</p>
            </div>
          )}
        </Link>
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-sidebar-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 px-2">
        {NAV.map(({ to, label, icon: Icon, color }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              title={!mobile && collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group relative",
                !mobile && collapsed && "justify-center px-0",
                active
                  ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(239_84%_67%/0.2)]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5",
              )}
            >
              {/* Active left accent */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary"
                  style={{ boxShadow: "0 0 8px hsl(239 84% 67%)" }} />
              )}
              <Icon className={cn("w-4 h-4 shrink-0 transition-all", active ? "text-primary" : color, active && "drop-shadow-[0_0_4px_hsl(239_84%_67%/0.8)]")} />
              {(mobile || !collapsed) && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={cn("border-t border-sidebar-border py-2 px-2 space-y-1", !mobile && collapsed && "px-1")}>
        <Link
          to="/app/dashboard"
          onClick={() => setMobileOpen(false)}
          title={!mobile && collapsed ? "Back to App" : undefined}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-xl text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all",
            !mobile && collapsed && "justify-center px-0",
          )}
        >
          <LogOut className="w-4 h-4 shrink-0 rotate-180" />
          {(mobile || !collapsed) && <span>Back to App</span>}
        </Link>

        {/* Logout button */}
        <button
          onClick={async () => {
            setLoggingOut(true);
            try {
              await auth.logout();
            } catch {}
            setCsrfToken("");
            queryClient.clear();
            window.location.href = "/admin/login";
          }}
          disabled={loggingOut}
          title={!mobile && collapsed ? "Logout" : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-2 py-2 rounded-xl text-xs text-destructive hover:bg-destructive/10 transition-all font-semibold",
            !mobile && collapsed && "justify-center px-0",
            loggingOut && "opacity-50 cursor-not-allowed",
          )}
        >
          <Power className="w-4 h-4 shrink-0" />
          {(mobile || !collapsed) && <span>{loggingOut ? "Logging out…" : "Logout"}</span>}
        </button>

        {!mobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              "w-full flex items-center gap-3 px-2 py-2 rounded-xl text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-all",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col z-10 animate-slide-up-fade">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col bg-sidebar-background border-r border-sidebar-border shrink-0 transition-all duration-200 z-30",
        collapsed ? "w-14" : "w-56",
      )}>
        <SidebarContent />
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-3 px-4 border-b border-border/40 shrink-0 relative"
          style={{ background: "hsl(220 24% 10% / 0.8)", backdropFilter: "blur(16px)" }}>

          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search — opens command palette */}
          <button
            onClick={() => setCmdOpen(true)}
            className="relative flex-1 max-w-md hidden sm:flex items-center gap-3 bg-input/40 border border-border/50 rounded-xl pl-9 pr-3 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:bg-input/60 transition-all backdrop-blur-sm text-left"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <span>Search users, jobs, pages…</span>
            <span className="ml-auto flex items-center gap-0.5 text-[10px] font-mono font-bold opacity-50">
              <kbd className="px-1 py-0.5 rounded border border-border bg-muted">⌘</kbd>
              <kbd className="px-1 py-0.5 rounded border border-border bg-muted">K</kbd>
            </span>
          </button>

          <div className="flex-1" />

          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(o => !o)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all relative"
            >
              <Bell className="w-5 h-5" />
              {alerts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border border-background"
                  style={{ boxShadow: "0 0 4px hsl(0 72% 51%)" }} />
              )}
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 top-11 z-50 w-72 glass-premium rounded-2xl shadow-[0_16px_48px_hsl(220_26%_0%/0.6)] overflow-hidden animate-scale-in border border-primary/10">
                  <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">System Alerts</span>
                    <span className="ml-auto w-5 h-5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">{alerts.length}</span>
                  </div>
                  {alerts.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">All systems healthy</div>
                  ) : alerts.map(a => (
                    <div key={a.id} className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors",
                    )}>
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                        a.level === "danger" ? "bg-destructive" : a.level === "warn" ? "bg-warning" : "bg-info")}
                        style={{ boxShadow: a.level === "danger" ? "0 0 4px hsl(0 72% 51%)" : undefined }} />
                      <p className="text-xs text-foreground leading-relaxed">{a.msg}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Admin badge */}
          <div className="flex items-center gap-2 glass-card rounded-xl px-3 py-1.5 border border-primary/10">
            <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center text-[10px] text-white font-bold shadow-glow-primary">A</div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-bold text-foreground leading-tight">Admin</span>
              <span className="text-[10px] text-success leading-tight flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />Session active
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* ⌘K Command Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search pages, users, jobs…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {["Navigation", "App"].map(group => {
            const items = CMD_ITEMS.filter(i => i.group === group);
            return (
              <CommandGroup key={group} heading={group}>
                {items.map(item => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.to}
                      value={item.label}
                      onSelect={() => {
                        navigate(item.to);
                        setCmdOpen(false);
                      }}
                      className="flex items-center gap-2.5 cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span>{item.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground/50 font-mono">{item.to}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
