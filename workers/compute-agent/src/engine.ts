/**
 * TorrentEngine — Abstract interface
 * Implement this to plug in any torrent library (WebTorrent, libtorrent bindings, etc.)
 */

export interface TorrentMetadata {
  infohash: string;
  name: string;
  totalSizeBytes: number;
  files: TorrentFileEntry[];
  announceList: string[][];
  comment?: string;
  createdAt?: Date;
}

export interface TorrentFileEntry {
  path: string;
  sizeBytes: number;
  mimeType?: string;
}

export interface TorrentProgress {
  progressPct: number;
  downloadSpeed: number;    // bytes/s
  uploadSpeed: number;      // bytes/s
  peers: number;
  seeds: number;
  bytesDownloaded: number;
  bytesTotal: number;
  eta: number;              // seconds, -1 if unknown
  status: "metadata" | "downloading" | "seeding" | "done" | "error";
  error?: string;
}

export interface StartOptions {
  jobId: string;
  magnetUri?: string;
  torrentBuffer?: Buffer;
  downloadDir: string;
  maxDownloadSpeed?: number;   // bytes/s, 0 = unlimited
  maxUploadSpeed?: number;
}

export interface TorrentEngine {
  /**
   * Start fetching metadata and then downloading content.
   * Returns a stream of progress events.
   */
  start(options: StartOptions): Promise<AsyncIterable<TorrentProgress>>;

  /** Gracefully pause or stop the torrent */
  stop(jobId: string): Promise<void>;

  /** Get current progress synchronously (from internal cache) */
  getProgress(jobId: string): TorrentProgress | null;

  /** Get metadata once available */
  getMetadata(jobId: string): TorrentMetadata | null;

  /** List downloaded files once metadata is ready */
  getFiles(jobId: string): TorrentFileEntry[];
}

/**
 * StubTorrentEngine — replace with a real implementation
 * (e.g. WebTorrent, Deluge RPC, libtorrent WASM, etc.)
 */
export class StubTorrentEngine implements TorrentEngine {
  private jobs = new Map<string, { progress: TorrentProgress; metadata: TorrentMetadata | null }>();

  async start(options: StartOptions): Promise<AsyncIterable<TorrentProgress>> {
    this.jobs.set(options.jobId, {
      progress: {
        progressPct: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        peers: 0,
        seeds: 0,
        bytesDownloaded: 0,
        bytesTotal: 1_000_000_000,
        eta: 999,
        status: "metadata",
      },
      metadata: null,
    });

    const self = this;
    return {
      [Symbol.asyncIterator]() {
        let tick = 0;
        return {
          async next() {
            // Simulate progress
            await new Promise(r => setTimeout(r, 2000));
            tick++;
            const job = self.jobs.get(options.jobId);
            if (!job) return { value: undefined, done: true };

            const pct = Math.min(tick * 5, 100);
            const progress: TorrentProgress = {
              progressPct: pct,
              downloadSpeed: Math.random() * 5_000_000,
              uploadSpeed: Math.random() * 500_000,
              peers: Math.floor(Math.random() * 50) + 5,
              seeds: Math.floor(Math.random() * 100) + 10,
              bytesDownloaded: (pct / 100) * 1_000_000_000,
              bytesTotal: 1_000_000_000,
              eta: pct >= 100 ? 0 : Math.floor(((100 - pct) / 5) * 2),
              status: pct >= 100 ? "done" : pct > 5 ? "downloading" : "metadata",
            };
            job.progress = progress;

            return { value: progress, done: pct >= 100 };
          },
          return() { return Promise.resolve({ value: undefined, done: true }); },
        };
      },
    };
  }

  async stop(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  getProgress(jobId: string): TorrentProgress | null {
    return this.jobs.get(jobId)?.progress ?? null;
  }

  getMetadata(jobId: string): TorrentMetadata | null {
    return this.jobs.get(jobId)?.metadata ?? null;
  }

  getFiles(jobId: string): TorrentFileEntry[] {
    return this.jobs.get(jobId)?.metadata?.files ?? [];
  }
}
