import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin as adminApi, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, AdminTable, Paginator, DangerModal } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/mock-data";
import { Search, ShieldCheck, ShieldOff, UserX, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = ["user", "support", "admin", "superadmin"];

interface AdminUser {
  id: string; email: string; role: string; suspended: boolean;
  plan_name?: string; email_verified?: boolean; created_at?: string;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [dangerAction, setDangerAction] = useState<"suspend" | "role" | null>(null);
  const [pendingRole, setPendingRole] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search, roleFilter],
    queryFn: () => adminApi.listUsers({ page, q: search || undefined }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { suspended?: boolean; role?: string } }) =>
      adminApi.updateUser(id, body),
    onSuccess: (_, vars) => {
      toast({ title: "User updated", description: `Action applied to user.` });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDangerAction(null); setSelectedUser(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed", variant: "destructive" });
    },
  });

  const users = (data?.data ?? []) as AdminUser[];

  const roleBadgeVariant = (role: string) => {
    if (role === "superadmin") return "bg-[hsl(265_89%_70%/0.15)] text-[hsl(265_89%_75%)] border-[hsl(265_89%_70%/0.3)]";
    if (role === "admin") return "bg-[hsl(239_84%_67%/0.15)] text-[hsl(239_84%_75%)] border-[hsl(239_84%_67%/0.3)]";
    if (role === "support") return "bg-[hsl(199_89%_48%/0.15)] text-[hsl(199_89%_60%)] border-[hsl(199_89%_48%/0.3)]";
    return "bg-muted/40 text-muted-foreground border-border";
  };

  const navigate = useNavigate();

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <AdminPageHeader title="User Management" description="Search, inspect, suspend, and manage roles for all users." />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by email…"
              className="bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors w-56"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
          {data?.meta && (
            <span className="text-xs text-muted-foreground ml-auto">{data.meta.total} users total</span>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <AdminTable
            headers={["Email", "Role", "Plan", "Status", "Verified", "Joined", "Actions"]}
            loading={isLoading}
          >
            {users.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No users found</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="hover:bg-muted/20 transition-colors group cursor-pointer" onClick={() => navigate(`/admin/users/${user.id}`)}>
                <td className="px-4 py-3 text-foreground font-medium text-sm hover:text-primary transition-colors">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border capitalize", roleBadgeVariant(user.role))}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{user.plan_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs font-medium", user.suspended ? "text-destructive" : "text-[hsl(var(--success))]")}>
                    {user.suspended ? "Suspended" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{user.email_verified ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Suspend/reinstate */}
                    <button
                      onClick={() => { setSelectedUser(user); setDangerAction("suspend"); }}
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors",
                        user.suspended
                          ? "border-[hsl(var(--success)/0.5)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)]"
                          : "border-destructive/50 text-destructive hover:bg-destructive/10"
                      )}
                    >
                      {user.suspended ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                      {user.suspended ? "Reinstate" : "Suspend"}
                    </button>

                    {/* Role change */}
                    <select
                      defaultValue={user.role}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        setPendingRole(e.target.value);
                        setSelectedUser(user);
                        setDangerAction("role");
                      }}
                      className="text-xs bg-input border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary"
                    >
                      {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
          <Paginator page={page} totalPages={data?.meta?.totalPages ?? 1} onPage={setPage} />
        </div>
      </div>

      {/* Suspend confirm */}
      <DangerModal
        open={dangerAction === "suspend" && !!selectedUser}
        title={selectedUser?.suspended ? "Reinstate User" : "Suspend User"}
        description={`This will ${selectedUser?.suspended ? "reinstate" : "suspend"} ${selectedUser?.email}. ${!selectedUser?.suspended ? "They will be immediately logged out and blocked from accessing the platform." : ""}`}
        confirmPhrase={selectedUser?.suspended ? "reinstate" : "suspend"}
        reasonRequired={!selectedUser?.suspended}
        onClose={() => { setDangerAction(null); setSelectedUser(null); }}
        onConfirm={(reason) => {
          if (!selectedUser) return;
          updateMutation.mutate({ id: selectedUser.id, body: { suspended: !selectedUser.suspended } });
        }}
        isPending={updateMutation.isPending}
      />

      {/* Role change confirm */}
      <DangerModal
        open={dangerAction === "role" && !!selectedUser}
        title="Change User Role"
        description={`Change ${selectedUser?.email} from "${selectedUser?.role}" to "${pendingRole}". This affects their permissions immediately.`}
        confirmPhrase={`change-role`}
        reasonRequired
        onClose={() => { setDangerAction(null); setSelectedUser(null); setPendingRole(""); }}
        onConfirm={(reason) => {
          if (!selectedUser) return;
          updateMutation.mutate({ id: selectedUser.id, body: { role: pendingRole } });
        }}
        isPending={updateMutation.isPending}
      />
    </AdminLayout>
  );
}
