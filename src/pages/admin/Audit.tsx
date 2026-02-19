import { useQuery } from "@tanstack/react-query";
import { admin as adminApi } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, AdminTable, Paginator } from "@/components/admin/AdminUI";
import { ScrollText, Download } from "lucide-react";
import { useState } from "react";

interface AuditEntry {
  id: string;
  actor_id: string;
  actor_email?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: string | object;
  ip_address?: string;
  created_at: string;
}

const ACTION_COLOURS: Record<string, string> = {
  "user.suspended": "text-destructive",
  "job.terminated": "text-destructive",
  "blocklist.added": "text-[hsl(var(--warning))]",
  "user.updated": "text-primary",
  "user.plan_changed": "text-primary",
};

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", page],
    queryFn: () => adminApi.audit(page),
    staleTime: 10_000,
  });

  const entries = (data?.data ?? []) as AuditEntry[];
  const filtered = actionFilter ? entries.filter(e => e.action.includes(actionFilter)) : entries;

  const handleExport = () => {
    const csv = [
      ["Timestamp", "Actor", "Action", "Target Type", "Target ID", "IP"],
      ...entries.map(e => [
        e.created_at, e.actor_email ?? e.actor_id, e.action,
        e.target_type ?? "", e.target_id ?? "", e.ip_address ?? "",
      ]),
    ].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-page${page}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <AdminPageHeader
          title="Audit Log"
          description="Immutable, append-only record of all admin and sensitive user actions."
          actions={
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs bg-secondary border border-border text-foreground rounded-lg px-3 py-2 hover:bg-muted transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          }
        />

        {/* Action filter */}
        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">All Actions</option>
            {["user.suspended", "user.updated", "user.plan_changed", "job.terminated", "blocklist.added"].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {data?.meta && <span className="text-xs text-muted-foreground ml-auto">{data.meta.total} entries total</span>}
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <AdminTable
            headers={["Timestamp", "Actor", "Action", "Target", "IP"]}
            loading={isLoading}
          >
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No audit entries found</td></tr>
            ) : filtered.map(entry => {
              const colour = ACTION_COLOURS[entry.action] ?? "text-foreground";
              return (
                <tr key={entry.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground max-w-[160px] truncate">
                    {entry.actor_email ?? entry.actor_id}
                  </td>
                  <td className="px-4 py-3">
                    <code className={`text-xs font-mono font-semibold ${colour}`}>{entry.action}</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono max-w-[180px] truncate">
                    {entry.target_type && <span className="text-foreground/60">{entry.target_type}/</span>}
                    {entry.target_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{entry.ip_address ?? "—"}</td>
                </tr>
              );
            })}
          </AdminTable>
          <Paginator page={page} totalPages={data?.meta?.totalPages ?? 1} onPage={setPage} />
        </div>
      </div>
    </AdminLayout>
  );
}
