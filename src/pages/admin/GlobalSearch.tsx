import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminSearch } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Search, Users, Briefcase, ScrollText, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function ResultGroup({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="ml-auto text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

function ResultRow({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors text-left group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export default function AdminGlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQ = useDebounce(query, 350);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-search", debouncedQ],
    queryFn: () => adminSearch.search(debouncedQ),
    enabled: debouncedQ.length >= 2,
  });

  const users = (data?.results.users ?? []) as any[];
  const jobs = (data?.results.jobs ?? []) as any[];
  const auditLogs = (data?.results.auditLogs ?? []) as any[];
  const hasResults = users.length + jobs.length + auditLogs.length > 0;
  const searched = debouncedQ.length >= 2;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5">
        <AdminPageHeader
          title="Global Search"
          description="Search across users, jobs, and audit logs in real time."
        />

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search users, jobs, audit events…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-11 pr-12 py-3.5 bg-input/60 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:shadow-[0_0_0_2px_hsl(239_84%_67%/0.12)] transition-all"
          />
          {isFetching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Empty / hint state */}
        {!searched && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground">Type to search</p>
            <p className="text-sm text-muted-foreground mt-1">
              Enter at least 2 characters to search across the platform.
            </p>
          </div>
        )}

        {/* No results */}
        {searched && !isLoading && !hasResults && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-foreground">No results for "{debouncedQ}"</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different search term.</p>
          </div>
        )}

        {/* Results */}
        {searched && (isLoading || hasResults) && (
          <div className="space-y-4">
            {/* Users */}
            {(isLoading || users.length > 0) && (
              <ResultGroup title="Users" icon={Users} count={data?.totals.users ?? 0}>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-3">
                        <div className="h-3 shimmer rounded w-1/3" />
                        <div className="h-3 shimmer rounded w-1/4 ml-auto" />
                      </div>
                    ))
                  : users.map((u: any) => (
                      <ResultRow
                        key={u.id}
                        label={u.email}
                        sub={`${u.role} · ID: ${u.id.slice(0, 12)}… · ${u.suspended ? "SUSPENDED" : "Active"}`}
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                      />
                    ))}
              </ResultGroup>
            )}

            {/* Jobs */}
            {(isLoading || jobs.length > 0) && (
              <ResultGroup title="Jobs" icon={Briefcase} count={data?.totals.jobs ?? 0}>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-3">
                        <div className="h-3 shimmer rounded w-1/2" />
                      </div>
                    ))
                  : jobs.map((j: any) => (
                      <ResultRow
                        key={j.id}
                        label={j.name ?? "Unnamed"}
                        sub={`${j.status} · ${new Date(j.created_at).toLocaleDateString()}`}
                        onClick={() => navigate(`/admin/jobs`)}
                      />
                    ))}
              </ResultGroup>
            )}

            {/* Audit Logs */}
            {(isLoading || auditLogs.length > 0) && (
              <ResultGroup title="Audit Logs" icon={ScrollText} count={data?.totals.auditLogs ?? 0}>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-3">
                        <div className="h-3 shimmer rounded w-2/3" />
                      </div>
                    ))
                  : auditLogs.map((a: any) => (
                      <ResultRow
                        key={a.id}
                        label={a.action}
                        sub={`${a.actor_email ?? "system"} · ${new Date(a.created_at).toLocaleString()}`}
                        onClick={() => navigate(`/admin/audit`)}
                      />
                    ))}
              </ResultGroup>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
