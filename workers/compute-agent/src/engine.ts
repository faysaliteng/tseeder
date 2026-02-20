/**
 * TorrentEngine — Abstract interface + WebTorrent production implementation.
 * The StubTorrentEngine is kept below for reference only — never used in production.
 *
 * WebTorrentEngine requires `webtorrent` (npm) installed in the compute agent.
 * It satisfies the TorrentEngine interface exactly.
 *
 * Environment:  Bun / Node.js container (NOT Cloudflare Workers — V8 isolates
 *               do not support WebTorrent's native TCP/UDP requirements).
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

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
  /** Start fetching metadata then downloading. Returns an async progress stream. */
  start(options: StartOptions): Promise<AsyncIterable<TorrentProgress>>;
  /** Gracefully stop the torrent */
  stop(jobId: string): Promise<void>;
  /** Get current progress (from internal cache) */
  getProgress(jobId: string): TorrentProgress | null;
  /** Get metadata once available */
  getMetadata(jobId: string): TorrentMetadata | null;
  /** List downloaded files once metadata is ready */
  getFiles(jobId: string): TorrentFileEntry[];
}

// ─── WebTorrentEngine ─────────────────────────────────────────────────────────
// Production implementation. Uses the `webtorrent` npm package.
// Import is dynamic so the module can still be type-checked in environments
// where webtorrent is not installed (e.g. type-check CI without the agent deps).

interface WTorrent {
  infoHash: string;
  name: string;
  length: number;
  files: Array<{ path: string; length: number }>;
  announce: string[];
  comment?: string;
  created?: Date;

  downloaded: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  progress: number;  // 0–1
  timeRemaining: number;  // ms, or Infinity

  on(event: "ready", cb: () => void): void;
  on(event: "metadata", cb: () => void): void;
  on(event: "download", cb: (bytes: number) => void): void;
  on(event: "done", cb: () => void): void;
  on(event: "error", cb: (err: Error) => void): void;
  on(event: "noPeers", cb: (announceType: string) => void): void;
  destroy(cb?: () => void): void;
}

interface WTClient {
  add(
    torrentId: string | Buffer | Uint8Array,
    opts: { path: string; maxWebConns?: number; downloadLimit?: number; uploadLimit?: number },
  ): WTorrent;
  destroy(cb?: () => void): void;
}

type JobEntry = {
  torrent: WTorrent;
  metadata: TorrentMetadata | null;
  progress: TorrentProgress;
  doneResolvers: Array<(done: boolean) => void>;
};

export class WebTorrentEngine implements TorrentEngine {
  private client: WTClient | null = null;
  private jobs = new Map<string, JobEntry>();

  private async getClient(): Promise<WTClient> {
    if (!this.client) {
      // Dynamic import — Bun does not support require() for async modules
      const WebTorrent = (await import("webtorrent")).default;
      this.client = new WebTorrent() as WTClient;
    }
    return this.client;
  }

  async start(options: StartOptions): Promise<AsyncIterable<TorrentProgress>> {
    const { jobId, magnetUri, torrentBuffer, downloadDir, maxDownloadSpeed = 0, maxUploadSpeed = 0 } = options;

    if (!magnetUri && !torrentBuffer) {
      throw new Error("Either magnetUri or torrentBuffer must be provided");
    }

    const client = await this.getClient();
    const source: string | Buffer = magnetUri ?? (torrentBuffer as Buffer);

    const initialProgress: TorrentProgress = {
      progressPct: 0, downloadSpeed: 0, uploadSpeed: 0,
      peers: 0, seeds: 0, bytesDownloaded: 0, bytesTotal: 0,
      eta: -1, status: "metadata",
    };

    return new Promise<AsyncIterable<TorrentProgress>>((resolve, reject) => {
      let resolved = false;
      const opts: Parameters<WTClient["add"]>[1] = {
        path: downloadDir,
        // Always cap upload to 1 B/s (effectively zero seeding)
        uploadLimit: 1,
        ...(maxDownloadSpeed > 0 ? { downloadLimit: maxDownloadSpeed } : {}),
      };

      const torrent = client.add(source, opts);

      const entry: JobEntry = {
        torrent,
        metadata: null,
        progress: initialProgress,
        doneResolvers: [],
      };
      this.jobs.set(jobId, entry);

      // Called once info-dictionary is fetched — before files are downloaded
      torrent.on("metadata", () => {
        entry.metadata = {
          infohash: torrent.infoHash,
          name: torrent.name,
          totalSizeBytes: torrent.length,
          files: torrent.files.map(f => ({ path: f.path, sizeBytes: f.length })),
          announceList: torrent.announce.map(a => [a]),
          comment: torrent.comment,
          createdAt: torrent.created,
        };
        entry.progress = { ...entry.progress, bytesTotal: torrent.length, status: "downloading" };
      });

      torrent.on("download", () => {
        const pct = Math.min(100, torrent.progress * 100);
        const etaSec = isFinite(torrent.timeRemaining) && torrent.timeRemaining > 0
          ? Math.round(torrent.timeRemaining / 1000) : -1;

        entry.progress = {
          progressPct: pct,
          downloadSpeed: torrent.downloadSpeed,
          uploadSpeed: torrent.uploadSpeed,
          peers: torrent.numPeers,
          seeds: 0,
          bytesDownloaded: torrent.downloaded,
          bytesTotal: torrent.length,
          eta: etaSec,
          status: pct >= 100 ? "done" : "downloading",
        };

        // Notify any waiting iterators
        for (const resolve of entry.doneResolvers) resolve(false);
        entry.doneResolvers = [];
      });

      torrent.on("done", () => {
        entry.progress = {
          ...entry.progress,
          progressPct: 100,
          downloadSpeed: 0,
          uploadSpeed: 0,
          eta: 0,
          bytesDownloaded: torrent.length,
          status: "done",
        };
        // Immediately destroy torrent — no seeding
        torrent.destroy(() => {});
        for (const resolve of entry.doneResolvers) resolve(true);
        entry.doneResolvers = [];
      });

      torrent.on("error", (err: Error) => {
        entry.progress = { ...entry.progress, status: "error", error: err.message };
        for (const resolve of entry.doneResolvers) resolve(true); // signal done (with error)
        entry.doneResolvers = [];
        if (!resolved) { resolved = true; reject(err); }
      });

      // Resolve the outer promise as soon as we have the torrent handle
      // (before metadata — so the caller can start receiving events immediately)
      torrent.on("ready", () => {
        if (!resolved) {
          resolved = true;
          resolve(this.createProgressStream(jobId));
        }
      });

      // Also resolve immediately if we got metadata already (magnet links skip "ready")
      torrent.on("metadata", () => {
        if (!resolved) {
          resolved = true;
          resolve(this.createProgressStream(jobId));
        }
      });

      // Safety: if nothing fires within 30s, resolve with stream anyway
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(this.createProgressStream(jobId));
        }
      }, 30_000);
    });
  }

  private createProgressStream(jobId: string): AsyncIterable<TorrentProgress> {
    const self = this;
    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<TorrentProgress>> {
            const entry = self.jobs.get(jobId);
            if (!entry) return { value: undefined as unknown as TorrentProgress, done: true };

            if (entry.progress.status === "done" || entry.progress.status === "error") {
              // Terminal — yield the final state then stop
              const finalProgress = { ...entry.progress };
              // Remove from map so next() stops
              return { value: finalProgress, done: false };
            }

            // Wait for the next download event or done event
            await new Promise<boolean>(res => {
              entry.doneResolvers.push(res);
              // Also timeout after 10s to send a heartbeat even if no data movement
              setTimeout(() => { res(false); }, 10_000);
            });

            const latest = self.jobs.get(jobId)?.progress;
            if (!latest) return { value: undefined as unknown as TorrentProgress, done: true };

            const isDone = latest.status === "done" || latest.status === "error";
            return { value: latest, done: isDone };
          },

          return(): Promise<IteratorResult<TorrentProgress>> {
            return Promise.resolve({ value: undefined as unknown as TorrentProgress, done: true });
          },
        };
      },
    };
  }

  async stop(jobId: string): Promise<void> {
    const entry = this.jobs.get(jobId);
    if (entry) {
      await new Promise<void>(res => entry.torrent.destroy(() => res()));
      this.jobs.delete(jobId);
    }
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

// ─── StubTorrentEngine ────────────────────────────────────────────────────────
// Reference-only. DO NOT use in production — import WebTorrentEngine instead.
// Kept for local unit testing without a torrent network.

export class StubTorrentEngine implements TorrentEngine {
  private jobs = new Map<string, { progress: TorrentProgress; metadata: TorrentMetadata | null }>();

  async start(options: StartOptions): Promise<AsyncIterable<TorrentProgress>> {
    this.jobs.set(options.jobId, {
      progress: {
        progressPct: 0, downloadSpeed: 0, uploadSpeed: 0,
        peers: 0, seeds: 0, bytesDownloaded: 0, bytesTotal: 1_000_000_000,
        eta: 999, status: "metadata",
      },
      metadata: null,
    });

    const self = this;
    return {
      [Symbol.asyncIterator]() {
        let tick = 0;
        return {
          async next() {
            await new Promise(r => setTimeout(r, 2000));
            tick++;
            const job = self.jobs.get(options.jobId);
            if (!job) return { value: undefined as unknown as TorrentProgress, done: true };

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
          return() { return Promise.resolve({ value: undefined as unknown as TorrentProgress, done: true }); },
        };
      },
    };
  }

  async stop(jobId: string): Promise<void> { this.jobs.delete(jobId); }
  getProgress(jobId: string): TorrentProgress | null { return this.jobs.get(jobId)?.progress ?? null; }
  getMetadata(jobId: string): TorrentMetadata | null { return this.jobs.get(jobId)?.metadata ?? null; }
  getFiles(jobId: string): TorrentFileEntry[] { return this.jobs.get(jobId)?.metadata?.files ?? []; }
}
