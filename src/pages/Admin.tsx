import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin as adminApi, usage as usageApi, ApiError } from "@/lib/api";
import { TopHeader } from "@/components/TopHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/mock-data";
import type { JobStatus } from "@/lib/mock-data";
import { Shield, Users, Activity, AlertTriangle, Search, Ban, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  suspended: boolean;
  plan?: string;
  storageUsedBytes?: number;
  totalJobs?: number;
  createdAt?: string;
}

interface AdminJob {
  id: string;
  name: string;
  status: string;
  bytesTotal: number;
  createdAt: string;
  userId?: string;
}

interface SystemHealth {
  queueDepth?: number;
  dlqDepth?: number;
  activeWorkers?: number;
  maxWorkers?: number;
  errorRate5xx?: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [blocklist, setBlocklist] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [jobPage, setJobPage] = useState(1);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", userPage, userSearch],
    queryFn: () => adminApi.listUsers({ page: userPage, q: userSearch || undefined }),
    retry: 1,
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["admin-jobs", jobPage],
    queryFn: () => adminApi.listJobs({ page: jobPage }),
    retry: 1,
  });

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => adminApi.systemHealth(),
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const suspendMutation = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      adminApi.updateUser(id, { suspended }),
    onSuccess: () => {
      toast({ title: "User updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed", variant: "destructive" });
    },
  });

  const terminateMutation = useMutation({
    mutationFn: (id: string) => adminApi.terminateJob(id),
    onSuccess: () => {
      toast({ title: "Job terminated" });
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed", variant: "destructive" });
    },
  });

  const blocklistMutation = useMutation({
    mutationFn: () => adminApi.addBlocklist(blocklist, blockReason || undefined),
    onSuccess: () => {
      toast({ title: "Blocklisted", description: `Infohash ${blocklist} added.` });
      setBlocklist(""); setBlockReason("");
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Invalid infohash", variant: "destructive" });
    },
  });

  const handleBlocklist = () => {
    if (!blocklist.match(/^[a-f0-9]{40}$/i)) {
      toast({ title: "Invalid infohash", description: "Must be 40 hex characters.", variant: "destructive" });
      return;
    }
    blocklistMutation.mutate();
  };

  const health = healthData as SystemHealth | undefined;
  const users = (usersData?.data ?? []) as AdminUser[];
  const adminJobs = (jobsData?.data ?? []) as AdminJob[];

  const headerUsage = {
    plan: { name: usageData?.plan.name ?? "free", maxStorageGb: usageData?.plan.maxStorageGb ?? 5, bandwidthGb: usageData?.plan.bandwidthGb ?? 20 },
    storageUsedBytes: usageData?.storageUsedBytes ?? 0,
    bandwidthUsedBytes: usageData?.bandwidthUsedBytes ?? 0,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopHeader usage={headerUsage} onAddMagnet={() => {}} onUploadTorrent={() => {}} />

      {/* Sub-nav */}
      <div className="bg-card/40 border-b border-dashed border-border px-4 flex items-center gap-4 h-10">
        <div className="flex items-center gap-2 border-b-2 border-primary text-primary pb-0 h-full">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-semibold uppercase tracking-widest">Admin</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          {/* ── System Health ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> System Health
            </h2>
            <button onClick={() => refetchHealth()} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={cn("w-3.5 h-3.5", healthLoading && "animate-spin")} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Queue Depth", value: healthLoading ? "…" : String(health?.queueDepth ?? 0), icon: Activity, warn: (health?.queueDepth ?? 0) > 100 },
              { label: "DLQ Depth", value: healthLoading ? "…" : String(health?.dlqDepth ?? 0), icon: AlertTriangle, warn: (health?.dlqDepth ?? 0) > 0 },
              { label: "Active Workers", value: healthLoading ? "…" : `${health?.activeWorkers ?? 0} / ${health?.maxWorkers ?? "?"}`, icon: Users, warn: false },
              { label: "Error Rate 5xx", value: healthLoading ? "…" : (health?.errorRate5xx ?? "0.0%"), icon: Shield, warn: false },
            ].map(({ label, value, icon: Icon, warn }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Icon className={cn("w-3.5 h-3.5", warn ? "text-warning" : "text-muted-foreground")} />
                </div>
                <p className={cn("text-lg font-bold", warn ? "text-warning" : "text-foreground")}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Blocklist ──────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <Ban className="w-4 h-4 text-destructive" />
              <h2 className="text-sm font-semibold text-foreground">Infohash Blocklist</h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                value={blocklist}
                onChange={e => setBlocklist(e.target.value)}
                placeholder="40-char hex infohash…"
                className="bg-input font-mono text-xs flex-1 min-w-48"
              />
              <Input
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                placeholder="Reason (optional)"
                className="bg-input text-xs flex-1 min-w-36"
              />
              <Button
                variant="destructive"
                onClick={handleBlocklist}
                size="sm"
                disabled={blocklistMutation.isPending}
              >
                {blocklistMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add to Blocklist"}
              </Button>
            </div>
          </div>

          {/* ── Users Table ───────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Users
                {usersData?.meta && (
                  <span className="text-muted-foreground font-normal text-xs">({usersData.meta.total} total)</span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                    placeholder="Search email…"
                    className="bg-input pl-8 h-8 text-xs w-48"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {["Email", "Role", "Plan", "Jobs", "Storage", "Status", ""].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-muted rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No users found</td></tr>
                  ) : (
                    users.map(user => (
                      <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-foreground font-medium">{user.email}</td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">{user.role}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs capitalize">{user.plan ?? "free"}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.totalJobs ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {user.storageUsedBytes !== undefined ? formatBytes(user.storageUsedBytes) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-xs font-medium",
                            user.suspended ? "text-destructive" : "text-success",
                          )}>
                            {user.suspended ? "Suspended" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => suspendMutation.mutate({ id: user.id, suspended: !user.suspended })}
                            disabled={suspendMutation.isPending}
                          >
                            {user.suspended ? "Reinstate" : "Suspend"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {usersData?.meta && usersData.meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page {usersData.meta.page} of {usersData.meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>Prev</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={userPage >= usersData.meta.totalPages} onClick={() => setUserPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>

          {/* ── All Jobs Table ────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> All Jobs
                {jobsData?.meta && (
                  <span className="text-muted-foreground font-normal text-xs">({jobsData.meta.total} total)</span>
                )}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {["Name", "Status", "Size", "Created", ""].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-muted rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : adminJobs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No jobs found</td></tr>
                  ) : (
                    adminJobs.map(job => (
                      <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-foreground max-w-xs truncate">{job.name}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={job.status as JobStatus} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{job.bytesTotal ? formatBytes(job.bytesTotal) : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(job.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive hover:text-white"
                            onClick={() => terminateMutation.mutate(job.id)}
                            disabled={terminateMutation.isPending || ["completed","failed","cancelled"].includes(job.status)}
                          >
                            {terminateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Terminate"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {jobsData?.meta && jobsData.meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">Page {jobsData.meta.page} of {jobsData.meta.totalPages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={jobPage <= 1} onClick={() => setJobPage(p => p - 1)}>Prev</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={jobPage >= jobsData.meta.totalPages} onClick={() => setJobPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
