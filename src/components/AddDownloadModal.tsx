import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { jobs as jobsApi, ApiError } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Magnet, Upload, X, FileIcon, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AddDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobAdded: () => void;
  /** Pre-fill the magnet URI field and switch to the magnet tab */
  initialMagnetUri?: string;
}

const MAGNET_REGEX = /^magnet:\?xt=urn:btih:[a-f0-9]{32,40}/i;

export function AddDownloadModal({ open, onOpenChange, onJobAdded, initialMagnetUri }: AddDownloadModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"magnet" | "torrent">("magnet");
  const [magnetUri, setMagnetUri] = useState(initialMagnetUri ?? "");
  const [magnetError, setMagnetError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [apiError, setApiError] = useState("");

  // Sync initialMagnetUri when modal opens
  useEffect(() => {
    if (open && initialMagnetUri) {
      setMagnetUri(initialMagnetUri);
      setTab("magnet");
      validateMagnet(initialMagnetUri);
    }
    if (!open) { setApiError(""); }
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
      toast({ title: "Download queued", description: `"${job.name}" has been added.` });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
      onJobAdded();
      setMagnetUri("");
      setApiError("");
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to add download";
      setApiError(msg);
    },
  });

  const torrentMutation = useMutation({
    mutationFn: () => jobsApi.createTorrent(torrentFile!),
    onSuccess: (job) => {
      toast({ title: "Download queued", description: `"${job.name}" has been added.` });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
      onJobAdded();
      setTorrentFile(null);
      setApiError("");
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to add download";
      setApiError(msg);
    },
  });

  const isPending = magnetMutation.isPending || torrentMutation.isPending;

  const handleSubmit = () => {
    setApiError("");
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add Download</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as "magnet" | "torrent")} className="mt-2">
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="magnet" className="flex-1 gap-2 data-[state=active]:bg-card">
              <Magnet className="w-4 h-4" /> Magnet Link
            </TabsTrigger>
            <TabsTrigger value="torrent" className="flex-1 gap-2 data-[state=active]:bg-card">
              <FileIcon className="w-4 h-4" /> Torrent File
            </TabsTrigger>
          </TabsList>

          {apiError && (
            <div className="flex items-center gap-2 mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {apiError}
            </div>
          )}

          <TabsContent value="magnet" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="magnet-input" className="text-foreground">Magnet URI</Label>
              <Input
                id="magnet-input"
                placeholder="magnet:?xt=urn:btih:..."
                value={magnetUri}
                onChange={e => { setMagnetUri(e.target.value); validateMagnet(e.target.value); }}
                className={cn("bg-input font-mono text-xs", magnetError && "border-destructive")}
                aria-describedby={magnetError ? "magnet-error" : undefined}
              />
              {magnetError && (
                <p id="magnet-error" className="text-xs text-destructive">{magnetError}</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="torrent" className="mt-4">
            <div
              onDragEnter={() => setDragActive(true)}
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                dragActive ? "border-primary bg-accent/30" : "border-border hover:border-primary/50 hover:bg-accent/10",
              )}
              onClick={() => document.getElementById("torrent-file-input")?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              {torrentFile ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-foreground font-medium">{torrentFile.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setTorrentFile(null); }}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Drag & drop a <span className="text-foreground">.torrent</span> file here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                </>
              )}
              <input
                id="torrent-file-input"
                type="file"
                accept=".torrent"
                className="sr-only"
                onChange={handleFileInput}
                aria-label="Upload torrent file"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1 gradient-primary text-white border-0"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isPending
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Adding…</>
              : "Add Download"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
