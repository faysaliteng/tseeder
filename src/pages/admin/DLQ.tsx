import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminDlq, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader, AdminTable, Paginator, DangerModal } from "@/components/admin/AdminUI";
import { AlertOctagon, ChevronDown, ChevronRight, RefreshCw, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface DlqJob {
  id: string;
  name: string | null;
  status: string;
  error: string | null;
  user_email: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  event_count: number;
}

export default function AdminDLQ() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [replayTarget, setReplayTarget] = useState<DlqJob | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-dlq", page],
    queryFn: () => adminDlq.list(page),
    refetchInterval: 30_000,
  });

  const replayMutation = useMutation({
    mutationFn: ({ id, reason, ticketId }: { id: string; reason: string; ticketId: string }) =>
      adminDlq.replay(id, reason, ticketId),
    onSuccess: (result) => {
      toast({
        title: "Job replayed",
        description: result.message,
      });
      setReplayTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-dlq"] });
    },
    onError: (err) => {
      toast({
        title: "Replay failed",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const jobs = (data?.data ?? []) as DlqJob[];
  const meta = data?.meta;

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
          title="DLQ Replay"
          description="Failed jobs eligible for re-queuing. Every replay requires a reason and ticket ID for audit accountability."
          actions={
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
              Refresh
            </button>
          }
        />

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-destructive" />
            <span className="text-sm font-semibold text-foreground">
              Failed Jobs ({meta?.total ?? 0})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60" style={{ background: "linear-gradient(90deg, hsl(220 24% 12%), hsl(220 26% 10%))" }}>
                  {["", "Job Name", "User", "Error (truncated)", "Failed At", "Actions"].map(h => (
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
                  : jobs.map(job => (
                      <>
                        <tr
                          key={job.id}
                          className="hover:bg-muted/10 transition-colors cursor-pointer"
                          onClick={() => toggleExpand(job.id)}
                        >
                          <td className="px-4 py-3.5">
                            {expanded.has(job.id)
                              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-foreground text-xs max-w-[200px] truncate">
                              {job.name ?? "Unnamed"}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">{job.id.slice(0, 12)}…</p>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">
                            {job.user_email ?? job.user_id}
                          </td>
                          <td className="px-4 py-3.5 max-w-[280px]">
                            <p className="text-xs text-destructive truncate font-mono">
                              {job.error?.slice(0, 80) ?? "No error message"}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(job.updated_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setReplayTarget(job)}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-medium"
                            >
                              <RotateCcw className="w-3 h-3" /> Replay
                            </button>
                          </td>
                        </tr>
                        {expanded.has(job.id) && (
                          <tr key={`${job.id}-expanded`} className="bg-muted/5">
                            <td colSpan={6} className="px-8 py-4">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Full Error Payload</p>
                              <pre className="text-xs text-destructive/90 bg-destructive/5 border border-destructive/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed max-h-48 overflow-y-auto">
                                {job.error ?? "No error payload"}
                              </pre>
                              <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                                <span>Events: <strong className="text-foreground">{job.event_count}</strong></span>
                                <span>Created: <strong className="text-foreground">{new Date(job.created_at).toLocaleString()}</strong></span>
                                <span>Job ID: <strong className="text-foreground font-mono">{job.id}</strong></span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
              </tbody>
            </table>

            {!isLoading && jobs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertOctagon className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-foreground">No failed jobs</p>
                <p className="text-xs text-muted-foreground mt-1">The DLQ is clean — all jobs are healthy.</p>
              </div>
            )}
          </div>

          {meta && meta.totalPages > 1 && (
            <Paginator page={page} totalPages={meta.totalPages} onPage={setPage} />
          )}
        </div>
      </div>

      {/* Replay modal */}
      {replayTarget && (
        <DangerModal
          open={!!replayTarget}
          title="Replay Failed Job"
          description={`Re-queue job "${replayTarget.name ?? replayTarget.id.slice(0, 12)}" for processing. This will reset it to 'submitted' status and enqueue it again.`}
          confirmPhrase="replay"
          reasonRequired
          ticketIdRequired
          isPending={replayMutation.isPending}
          onClose={() => setReplayTarget(null)}
          onConfirm={({ reason, ticketId }) => {
            if (!ticketId) return;
            replayMutation.mutate({ id: replayTarget.id, reason, ticketId });
          }}
        />
      )}
    </AdminLayout>
  );
}
