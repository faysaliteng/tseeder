import type { IncomingMessage, ServerResponse } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "../logger";

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR ?? "/tmp/rdm";

/**
 * DELETE /cleanup/:jobId — remove local files for a completed/deleted job
 */
export async function handleCleanup(
  _req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  correlationId: string,
): Promise<void> {
  const jobDir = path.join(DOWNLOAD_DIR, jobId);

  if (!fs.existsSync(jobDir)) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, jobId, message: "Already cleaned" }));
    return;
  }

  try {
    fs.rmSync(jobDir, { recursive: true, force: true });
    logger.info({ correlationId, jobId }, "Cleaned up local files");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, jobId, message: "Cleaned" }));
  } catch (err) {
    logger.error({ correlationId, jobId, err }, "Cleanup failed");
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Cleanup failed" }));
  }
}

/**
 * Auto-purge job directories older than maxAgeDays.
 * Called on startup and periodically via setInterval.
 */
export function autoPurgeOldFiles(maxAgeDays = 2): void {
  if (!fs.existsSync(DOWNLOAD_DIR)) return;

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let purged = 0;

  try {
    for (const entry of fs.readdirSync(DOWNLOAD_DIR)) {
      const fullPath = path.join(DOWNLOAD_DIR, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && stat.mtimeMs < cutoff) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        purged++;
        logger.info({ jobId: entry }, "Auto-purged old job directory");
      }
    }
  } catch (err) {
    logger.error({ err }, "Auto-purge scan failed");
  }

  if (purged > 0) {
    logger.info({ purged, maxAgeDays }, "Auto-purge complete");
  }
}
