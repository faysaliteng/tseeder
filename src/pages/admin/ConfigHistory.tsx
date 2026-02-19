import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminConfig } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, Paginator } from "@/components/admin/AdminUI";
import { History, ChevronDown, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

function tryPrettyJson(val: string | null): string {
  if (!val) return "null";
  try {
    return JSON.stringify(JSON.parse(val), null, 2);
  } catch {
    return val;
  }
}

interface ConfigChange {
  id: string;
  key: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
  changed_by_email: string | null;
}

export default function AdminConfigHistory() {
  const [page, setPage] = useState(1);
  const [filterKey, setFilterKey] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["admin-config-history", page, filterKey],
    queryFn: () => adminConfig.history(page, filterKey || undefined),
  });

  const rows = (data?.data ?? []) as ConfigChange[];
  const meta = data?.meta;

  // Collect distinct keys for filter dropdown
  const keys = Array.from(new Set(rows.map(r => r.key))).sort();

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5">
        <AdminPageHeader
          title="Config History"
          description="Read-only versioned history of all configuration changes with before/after diffs."
          actions={
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={filterKey}
                onChange={e => { setFilterKey(e.target.value); setPage(1); }}
                className="text-xs bg-input border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/40"
              >
                <option value="">All keys</option>
                {keys.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          }
        />

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Config Changes ({meta?.total ?? 0})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60" style={{ background: "linear-gradient(90deg, hsl(220 24% 12%), hsl(220 26% 10%))" }}>
                  {["", "Key", "Changed By", "Old → New", "Reason", "Timestamp"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {[0,1,2,3,4,5].map(j => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-3 shimmer rounded w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : rows.map(row => (
                      <>
                        <tr
                          key={row.id}
                          className="hover:bg-muted/10 transition-colors cursor-pointer"
                          onClick={() => toggleExpand(row.id)}
                        >
                          <td className="px-4 py-3.5">
                            {expanded.has(row.id)
                              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          </td>
                          <td className="px-4 py-3.5">
                            <code className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {row.key}
                            </code>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">
                            {row.changed_by_email ?? "system"}
                          </td>
                          <td className="px-4 py-3.5 text-xs max-w-[200px]">
                            <span className="text-destructive/80 line-through truncate block max-w-[80px]">
                              {row.old_value?.slice(0, 20) ?? "null"}
                            </span>
                            <span className="text-success truncate block max-w-[80px]">
                              {row.new_value?.slice(0, 20) ?? "null"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[150px] truncate">
                            {row.reason ?? "—"}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(row.created_at).toLocaleString()}
                          </td>
                        </tr>
                        {expanded.has(row.id) && (
                          <tr key={`${row.id}-diff`} className="bg-muted/5">
                            <td colSpan={6} className="px-8 py-4">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                                Before / After Diff
                              </p>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[10px] font-bold text-destructive mb-1.5 uppercase tracking-wider">Old Value</p>
                                  <pre className="text-xs text-destructive/80 bg-destructive/5 border border-destructive/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed max-h-48 overflow-y-auto">
                                    {tryPrettyJson(row.old_value)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-success mb-1.5 uppercase tracking-wider">New Value</p>
                                  <pre className="text-xs text-success/80 bg-success/5 border border-success/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed max-h-48 overflow-y-auto">
                                    {tryPrettyJson(row.new_value)}
                                  </pre>
                                </div>
                              </div>
                              {row.reason && (
                                <p className="text-xs text-muted-foreground mt-3">
                                  <span className="font-semibold text-foreground">Reason: </span>{row.reason}
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
              </tbody>
            </table>

            {!isLoading && rows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <History className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-foreground">No config changes recorded</p>
                <p className="text-xs text-muted-foreground mt-1">Config changes are logged when feature flags or provider settings are modified.</p>
              </div>
            )}
          </div>

          {meta && meta.totalPages > 1 && (
            <Paginator page={page} totalPages={meta.totalPages} onPage={setPage} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
