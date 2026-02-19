import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { orgs as orgsApi, type ApiOrg } from "@/lib/api";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

function getActiveOrgSlug(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("activeOrgSlug") : null;
}

function setActiveOrgSlug(slug: string | null) {
  if (slug) {
    localStorage.setItem("activeOrgSlug", slug);
  } else {
    localStorage.removeItem("activeOrgSlug");
  }
  // Dispatch storage event so api.ts request() picks it up on next call
  window.dispatchEvent(new Event("storage"));
}

export function OrgSwitcher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => orgsApi.list(),
    staleTime: 60_000,
  });

  const activeSlug = getActiveOrgSlug();
  const orgs: ApiOrg[] = data?.orgs ?? [];
  const activeOrg = orgs.find(o => o.slug === activeSlug);
  const displayName = activeOrg?.name ?? "Personal";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/60 text-xs text-foreground hover:border-primary/40 hover:bg-muted/20 transition-all"
      >
        <Building2 className="w-3.5 h-3.5 text-primary" />
        <span className="max-w-[96px] truncate font-semibold">{displayName}</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-50 w-56 glass-premium rounded-xl shadow-[0_16px_48px_hsl(220_26%_0%/0.5)] border border-primary/10 overflow-hidden animate-scale-in">
            {/* Personal */}
            <button
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors",
                !activeSlug && "text-primary font-semibold",
              )}
              onClick={() => { setActiveOrgSlug(null); setOpen(false); }}
            >
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">P</div>
              <span className="flex-1 text-left">Personal</span>
              {!activeSlug && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>

            {orgs.length > 0 && (
              <div className="border-t border-border/40">
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">Organizations</p>
                {orgs.map(org => (
                  <button
                    key={org.slug}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors",
                      activeSlug === org.slug && "text-primary font-semibold",
                    )}
                    onClick={() => { setActiveOrgSlug(org.slug); setOpen(false); }}
                  >
                    <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-left truncate">{org.name}</span>
                    {activeSlug === org.slug && <Check className="w-3.5 h-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-border/40">
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                onClick={() => {
                  setOpen(false);
                  navigate("/app/org/new");
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Create Organization
              </button>
              {activeOrg && (
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/app/org/${activeOrg.slug}/settings`);
                  }}
                >
                  <Building2 className="w-3.5 h-3.5" /> Org Settings
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
