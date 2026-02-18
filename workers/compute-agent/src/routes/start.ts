import type { IncomingMessage, ServerResponse } from "node:http";
import { jobRegistry } from "../job-registry";
import { StubTorrentEngine } from "../engine";
import { uploadToR2 } from "../r2-upload";
import { postCallback } from "../callback";
import { logger } from "../logger";
import * as fs from "node:fs";
import * as path from "node:path";

const engine = new StubTorrentEngine();

interface StartPayload {
  jobId: string;
  type: "magnet" | "torrent";
  magnetUri?: string;
  torrentBase64?: string;
  callbackUrl: string;
  callbackSecret: string;
  correlationId: string;
}

export async function handleStart(
  req: IncomingMessage,
  res: ServerResponse,
  correlationId: string,
): Promise<void> {
  const body = await readJson<StartPayload>(req);

  if (!body?.jobId || !body?.callbackUrl) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "jobId and callbackUrl are required" }));
    return;
  }

  const { jobId, type, magnetUri, torrentBase64, callbackUrl, callbackSecret } = body;
  const downloadDir = path.join(process.env.DOWNLOAD_DIR ?? "/tmp/rdm", jobId);
  fs.mkdirSync(downloadDir, { recursive: true });

  // Register job
  jobRegistry.set(jobId, { status: "starting", startedAt: Date.now() });

  res.writeHead(202, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, jobId, message: "Job started" }));

  // Run download pipeline in background (no await)
  runDownloadPipeline({ jobId, type, magnetUri, torrentBase64, downloadDir, callbackUrl, callbackSecret, correlationId })
    .catch(err => logger.error({ jobId, err }, "Download pipeline error"));
}

async function runDownloadPipeline(opts: {
  jobId: string;
  type: "magnet" | "torrent";
  magnetUri?: string;
  torrentBase64?: string;
  downloadDir: string;
  callbackUrl: string;
  callbackSecret: string;
  correlationId: string;
}): Promise<void> {
  const { jobId, type, magnetUri, torrentBase64, downloadDir, callbackUrl, callbackSecret, correlationId } = opts;
  let idempotencySeq = 0;

  try {
    const torrentBuffer = torrentBase64 ? Buffer.from(torrentBase64, "base64") : undefined;

    const progressStream = await engine.start({
      jobId,
      magnetUri,
      torrentBuffer,
      downloadDir,
    });

    for await (const progress of progressStream) {
      // Post progress update to Workers API every tick
      await postCallback(callbackUrl, callbackSecret, correlationId, {
        jobId,
        workerId: process.env.WORKER_ID ?? "agent-1",
        eventType: progress.status === "done" ? "job_completed" : "progress_update",
        idempotencyKey: `${jobId}:${++idempotencySeq}`,
        ...progress,
        status: mapStatus(progress.status),
        files: progress.status === "done" ? buildFileList(downloadDir, jobId) : undefined,
      });

      if (progress.status === "done") {
        // Upload all files to R2
        await uploadAllFiles(jobId, downloadDir, callbackUrl, callbackSecret, correlationId);
        jobRegistry.set(jobId, { status: "completed", startedAt: Date.now() });
        return;
      }
    }
  } catch (err) {
    logger.error({ jobId, err }, "Download pipeline failed");
    await postCallback(callbackUrl, callbackSecret, correlationId, {
      jobId,
      workerId: process.env.WORKER_ID ?? "agent-1",
      eventType: "job_failed",
      idempotencyKey: `${jobId}:error:${Date.now()}`,
      progressPct: 0, downloadSpeed: 0, uploadSpeed: 0, eta: 0,
      peers: 0, seeds: 0, bytesDownloaded: 0, bytesTotal: 0,
      status: "failed",
      error: String(err),
    });
    jobRegistry.set(jobId, { status: "failed", startedAt: Date.now() });
  }
}

async function uploadAllFiles(
  jobId: string,
  dir: string,
  callbackUrl: string,
  callbackSecret: string,
  correlationId: string,
): Promise<void> {
  const files = walkDir(dir);
  for (const filePath of files) {
    const r2Key = `jobs/${jobId}/${path.relative(dir, filePath)}`;
    await uploadToR2(filePath, r2Key);
    logger.info({ jobId, r2Key }, "File uploaded to R2");
  }
}

function walkDir(dir: string): string[] {
  const result: string[] = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walkDir(full));
    else result.push(full);
  }
  return result;
}

function buildFileList(dir: string, jobId: string) {
  return walkDir(dir).map(fp => ({
    path: path.relative(dir, fp),
    sizeBytes: fs.statSync(fp).size,
    r2Key: `jobs/${jobId}/${path.relative(dir, fp)}`,
    isComplete: true,
  }));
}

function mapStatus(s: string): string {
  const map: Record<string, string> = {
    metadata: "metadata_fetch",
    downloading: "downloading",
    seeding: "uploading",
    done: "completed",
    error: "failed",
  };
  return map[s] ?? s;
}

async function readJson<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve(null); }
    });
    req.on("error", () => resolve(null));
  });
}
