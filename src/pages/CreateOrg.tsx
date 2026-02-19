import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { orgs as orgsApi, ApiError } from "@/lib/api";
import { TopHeader } from "@/components/TopHeader";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2, ChevronLeft } from "lucide-react";

export default function CreateOrgPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: () => orgsApi.create(name.trim()),
    onSuccess: (data) => {
      toast({ title: "Organization created", description: `"${data.org.name}" is ready.` });
      // Switch to new org context
      localStorage.setItem("activeOrgSlug", data.org.slug);
      navigate(`/app/org/${data.org.slug}/settings`);
    },
    onError: (err) => {
      toast({
        title: "Failed to create org",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const dummyUsage = {
    plan: { name: "pro", maxStorageGb: 100, bandwidthGb: 1000 },
    storageUsedBytes: 0,
    bandwidthUsedBytes: 0,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopHeader usage={dummyUsage} onAddMagnet={() => {}} onUploadTorrent={() => {}} />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-12 space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Create Organization</h1>
            <p className="text-xs text-muted-foreground">Share jobs, storage, and quotas with your team.</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Organization Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && name.trim().length >= 2 && createMutation.mutate()}
              placeholder="Acme Corp"
              className="w-full bg-input/60 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-all"
            />
            <p className="text-xs text-muted-foreground">At least 2 characters. You'll be the owner.</p>
          </div>

          <button
            onClick={() => createMutation.mutate()}
            disabled={name.trim().length < 2 || createMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-glow-primary"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            Create Organization
          </button>
        </div>
      </main>
    </div>
  );
}
