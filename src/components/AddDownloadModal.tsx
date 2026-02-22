import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { jobs as jobsApi, ApiError } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Magnet, Upload, X, FileIcon, Loader2, AlertCircle, Zap, CheckCircle2, ArrowUpCircle, Trash2 } from "lucide-react";
import { PricingModal } from "@/components/PricingModal";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AddDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobAdded: () => void;
  initialMagnetUri?: string;
}

const MAGNET_REGEX = /^magnet:\?xt=urn:btih:[a-f0-9]{32,40}/i;

export function AddDownloadModal({ open, onOpenChange, onJobAdded, initialMagnetUri }: AddDownloadModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"magnet" | "torrent">("magnet");
  const [magnetUri, setMagnetUri] = useState(initialMagnetUri ?? "");
  const [magnetError, setMagnetError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [apiError, setApiError] = useState("");
  const [quotaError, setQuotaError] = useState<"QUOTA_STORAGE" | "QUOTA_JOBS" | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  

  useEffect(() => {
    if (open && initialMagnetUri) {
      setMagnetUri(initialMagnetUri);
      setTab("magnet");
      validateMagnet(initialMagnetUri);
    }
    if (!open) { setApiError(""); setQuotaError(null); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMagnetUri]);

  const validateMagnet = (val: string) => {
    if (!val) { setMagnetError(""); return; }
    if (!MAGNET_REGEX.test(val)) setMagnetError("Invalid magnet URI — must start with magnet:?xt=urn:btih:");
    else setMagnetError("");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".torrent")) setTorrentFile(file);
    else toast({ title: "Invalid file", description: "Only .torrent files are accepted.", variant: "destructive" });
  }, [toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setTorrentFile(file);
  };

  const magnetMutation = useMutation({
    mutationFn: () => jobsApi.createMagnet(magnetUri),
    onSuccess: (job) => {
      const name = (job as { name?: string }).name ?? "Download";
      toast({ title: "Download queued", description: `"${name}" has been added.` });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
      onJobAdded();
      setMagnetUri("");
      setApiError("");
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to add download";
      if (msg === "QUOTA_STORAGE" || msg.includes("QUOTA_STORAGE")) {
        setQuotaError("QUOTA_STORAGE");
        setApiError("");
      } else if (msg === "QUOTA_JOBS" || msg.includes("QUOTA_JOBS")) {
        setQuotaError("QUOTA_JOBS");
        setApiError("");
      } else {
        setQuotaError(null);
        setApiError(msg);
      }
    },
  });

  const torrentMutation = useMutation({
    mutationFn: () => jobsApi.createTorrent(torrentFile!),
    onSuccess: (job) => {
      const name = (job as { name?: string }).name ?? torrentFile?.name ?? "Download";
      toast({ title: "Download queued", description: `"${name}" has been added.` });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
      onJobAdded();
      setTorrentFile(null);
      setApiError("");
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to add download";
      if (msg === "QUOTA_STORAGE" || msg.includes("QUOTA_STORAGE")) {
        setQuotaError("QUOTA_STORAGE");
        setApiError("");
      } else if (msg === "QUOTA_JOBS" || msg.includes("QUOTA_JOBS")) {
        setQuotaError("QUOTA_JOBS");
        setApiError("");
      } else {
        setQuotaError(null);
        setApiError(msg);
      }
    },
  });

  const isPending = magnetMutation.isPending || torrentMutation.isPending;

  const handleSubmit = () => {
    setApiError("");
    setQuotaError(null);
    if (tab === "magnet") {
      if (!magnetUri || magnetError) return;
      magnetMutation.mutate();
    } else {
      if (!torrentFile) return;
      torrentMutation.mutate();
    }
  };

  const canSubmit = tab === "magnet"
    ? !!(magnetUri && !magnetError && !isPending)
    : !!(torrentFile && !isPending);

  // Detect magnet: prefix for mono highlighting
  const magnetPrefix = magnetUri.startsWith("magnet:") ? "magnet:" : "";
  const magnetRest = magnetPrefix ? magnetUri.slice(7) : magnetUri;

  return (
    <>
    <Dialog open={open} onOpenChange={v => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg glass-premium border-primary/15 rounded-2xl shadow-[0_32px_80px_hsl(220_26%_0%/0.7)]">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2.5 text-lg font-bold">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow-primary">
              <Zap className="w-4 h-4 text-white" />
            </div>
            Add Download
          </DialogTitle>
        </DialogHeader>

        {/* Pill tabs */}
        <div className="flex gap-1.5 p-1 bg-muted/30 rounded-xl border border-border/40 mt-2">
          {(["magnet", "torrent"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200",
                tab === t
                  ? "gradient-primary text-white shadow-glow-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {t === "magnet" ? <Magnet className="w-3.5 h-3.5" /> : <FileIcon className="w-3.5 h-3.5" />}
              {t === "magnet" ? "Magnet Link" : "Torrent File"}
            </button>
          ))}
        </div>

        {quotaError && (
          <div className="mt-1 p-4 bg-warning/10 border border-warning/30 rounded-xl animate-scale-in">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning mb-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {quotaError === "QUOTA_STORAGE" ? "Storage Full" : "Task Limit Reached"}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {quotaError === "QUOTA_STORAGE"
                ? "Your storage is full. Delete some files to free up space, or upgrade your plan for more storage."
                : "You've reached your concurrent task limit. Wait for a task to finish, or upgrade for more slots."}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 rounded-lg text-xs border-border hover:border-primary/30"
                onClick={() => { onOpenChange(false); navigate("/app/dashboard"); }}
              >
                <Trash2 className="w-3 h-3 mr-1.5" />
                Manage Files
              </Button>
              <Button
                size="sm"
                className="flex-1 rounded-lg text-xs gradient-primary text-white border-0 shadow-glow-primary"
                onClick={() => { onOpenChange(false); setPricingOpen(true); }}
              >
                <ArrowUpCircle className="w-3 h-3 mr-1.5" />
                Upgrade Plan
              </Button>
            </div>
          </div>
        )}

        {apiError && (
          <div className="flex items-center gap-2 mt-1 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive animate-scale-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {apiError}
          </div>
        )}

        {tab === "magnet" && (
          <div className="mt-2 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Magnet URI</label>
            {/* Syntax-highlighted monospace input */}
            <div className={cn(
              "relative rounded-xl border bg-input/60 overflow-hidden transition-all",
              magnetError ? "border-destructive/60" : "border-border/60 focus-within:border-primary/60 focus-within:shadow-[0_0_0_2px_hsl(239_84%_67%/0.1)]"
            )}>
              <textarea
                placeholder="magnet:?xt=urn:btih:..."
                value={magnetUri}
                onChange={e => { setMagnetUri(e.target.value); validateMagnet(e.target.value); }}
                rows={3}
                className="w-full bg-transparent px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
                aria-describedby={magnetError ? "magnet-error" : undefined}
                style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
              />
            </div>
            {magnetError && (
              <p id="magnet-error" className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {magnetError}
              </p>
            )}
          </div>
        )}

        {tab === "torrent" && (
          <div className="mt-2">
            <div
              onDragEnter={() => setDragActive(true)}
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 relative overflow-hidden",
                dragActive
                  ? "border-primary bg-primary/10 shadow-glow-primary"
                  : "border-border/50 hover:border-primary/40 hover:bg-primary/5",
              )}
              onClick={() => document.getElementById("torrent-file-input")?.click()}
            >
              {torrentFile ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shadow-glow-success">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{torrentFile.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setTorrentFile(null); }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={cn(
                    "w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4 transition-all",
                    dragActive ? "border-primary bg-primary/20 shadow-glow-primary" : "border-border bg-muted/30"
                  )}>
                    <Upload className={cn("w-7 h-7 transition-colors", dragActive ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    Drop your <span className="text-primary">.torrent</span> file here
                  </p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </>
              )}
              <input
                id="torrent-file-input"
                type="file"
                accept=".torrent"
                className="sr-only"
                onChange={handleFileInput}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-border hover:border-primary/30"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gradient-primary text-white border-0 rounded-xl relative overflow-hidden group shadow-glow-primary disabled:shadow-none"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <span className="relative flex items-center justify-center gap-2">
              {isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Adding…</>
                : <><Zap className="w-4 h-4" />Add Download</>}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </>
  );
}
