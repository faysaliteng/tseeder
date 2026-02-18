import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Magnet, Upload, X, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@/lib/mock-data";
import { MOCK_JOBS } from "@/lib/mock-data";
import { JobStatus } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

interface AddDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobAdded: (job: Job) => void;
}

const MAGNET_REGEX = /^magnet:\?xt=urn:btih:[a-f0-9]{40}/i;

export function AddDownloadModal({ open, onOpenChange, onJobAdded }: AddDownloadModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"magnet" | "torrent">("magnet");
  const [magnetUri, setMagnetUri] = useState("");
  const [magnetError, setMagnetError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async () => {
    if (tab === "magnet" && (!magnetUri || magnetError)) return;
    if (tab === "torrent" && !torrentFile) return;

    setLoading(true);
    // Simulate instant job creation (optimistic UI)
    await new Promise(r => setTimeout(r, 600));

    const newJob: Job = {
      id: `job-${Date.now()}`,
      name: tab === "magnet"
        ? magnetUri.match(/&dn=([^&]+)/)?.[1]?.replace(/\+/g, " ") ?? "New torrent"
        : torrentFile!.name.replace(".torrent", ""),
      status: "submitted",
      progressPct: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      eta: 0,
      peers: 0,
      seeds: 0,
      bytesDownloaded: 0,
      bytesTotal: 0,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      infohash: null,
    };

    onJobAdded(newJob);
    toast({ title: "Download queued", description: `"${newJob.name}" has been added.` });
    setLoading(false);
    setMagnetUri("");
    setTorrentFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  <p className="text-sm text-muted-foreground">Drag & drop a <span className="text-foreground">.torrent</span> file here</p>
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
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 gradient-primary text-white border-0"
            disabled={loading || (tab === "magnet" ? (!magnetUri || !!magnetError) : !torrentFile)}
            onClick={handleSubmit}
          >
            {loading ? "Adding…" : "Add Download"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
