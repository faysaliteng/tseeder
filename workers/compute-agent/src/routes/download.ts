import type { IncomingMessage, ServerResponse } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "../logger";

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR ?? "/tmp/rdm";

/**
 * GET /download/:jobId/*filePath
 * Serves a completed file directly from local disk.
 */
export async function handleDownload(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  filePath: string,
): Promise<void> {
  const absPath = path.join(DOWNLOAD_DIR, jobId, filePath);

  // Prevent path traversal
  if (!absPath.startsWith(path.join(DOWNLOAD_DIR, jobId))) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Forbidden" }));
    return;
  }

  if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "File not found" }));
    return;
  }

  const stat = fs.statSync(absPath);
  const fileName = path.basename(absPath);

  logger.info({ jobId, filePath, sizeBytes: stat.size }, "Serving file download");

  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    "Content-Length": stat.size.toString(),
  });

  const stream = fs.createReadStream(absPath);
  stream.pipe(res);
  stream.on("error", (err) => {
    logger.error({ jobId, filePath, err: err.message }, "File stream error");
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Stream error" }));
    }
  });
}
