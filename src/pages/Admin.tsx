import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MOCK_JOBS, formatBytes } from "@/lib/mock-data";
import { Shield, Users, Activity, AlertTriangle, Search, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MOCK_USERS = [
  { id: "u1", email: "alice@acme.com", role: "user", plan: "pro", jobs: 3, storage: "8.2 GB", status: "active" },
  { id: "u2", email: "bob@acme.com", role: "admin", plan: "business", jobs: 12, storage: "47.1 GB", status: "active" },
  { id: "u3", email: "charlie@spam.io", role: "user", plan: "free", jobs: 1, storage: "2.1 GB", status: "suspended" },
];

export default function AdminPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [blocklist, setBlocklist] = useState("");

  const handleSuspend = (userId: string) => {
    toast({ title: "User suspended", description: `User ${userId} has been suspended.` });
  };
  const handleBlocklist = () => {
    if (!blocklist.match(/^[a-f0-9]{40}$/i)) {
      toast({ title: "Invalid infohash", description: "Must be 40 hex characters.", variant: "destructive" });
      return;
    }
    toast({ title: "Blocklisted", description: `Infohash ${blocklist} added to blocklist.` });
    setBlocklist("");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          </div>

          {/* System Health */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Queue Depth", value: "12", icon: Activity, ok: true },
              { label: "DLQ Depth", value: "0", icon: AlertTriangle, ok: true },
              { label: "Active Workers", value: "3 / 5", icon: Users, ok: true },
              { label: "Error Rate 5xx", value: "0.02%", icon: Shield, ok: true },
            ].map(({ label, value, icon: Icon, ok }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className={`text-lg font-bold ${ok ? "text-foreground" : "text-destructive"}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Blocklist */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <Ban className="w-4 h-4 text-destructive" />
              <h2 className="text-sm font-semibold text-foreground">Infohash Blocklist</h2>
            </div>
            <div className="flex gap-2">
              <Input value={blocklist} onChange={e => setBlocklist(e.target.value)} placeholder="40-char hex infohash…" className="bg-input font-mono text-xs flex-1" />
              <Button variant="destructive" onClick={handleBlocklist} size="sm">Add to Blocklist</Button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Users</h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="bg-input pl-8 h-8 text-xs w-48" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {["Email", "Role", "Plan", "Jobs", "Storage", "Status", ""].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {MOCK_USERS.filter(u => u.email.includes(search)).map(user => (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground">{user.email}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{user.role}</td>
                      <td className="px-4 py-3"><Badge variant="secondary" className="text-xs capitalize">{user.plan}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{user.jobs}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.storage}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${user.status === "active" ? "text-success" : "text-destructive"}`}>{user.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSuspend(user.id)}>
                          {user.status === "active" ? "Suspend" : "Reinstate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* All Jobs */}
          <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">All Jobs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {["Name", "Status", "Size", "Created", ""].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {MOCK_JOBS.map(job => (
                    <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground max-w-xs truncate">{job.name}</td>
                      <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{job.bytesTotal ? formatBytes(job.bytesTotal) : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(job.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive hover:text-white">
                          Terminate
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
