/**
 * Compute Agent — External Torrent Worker Service
 * Node.js / Bun HTTP server
 *
 * Run one or more of these in containers/VMs. Each registers with the orchestrator.
 * This file is the entrypoint. Replace the TorrentEngine stub with your real implementation.
 */

import { createServer } from "node:http";
import { handleStart } from "./routes/start";
import { handleStop } from "./routes/stop";
import { handleStatus } from "./routes/status";
import { handleFiles } from "./routes/files";
import { handleHealth } from "./routes/health";
import { logger } from "./logger";

const PORT = parseInt(process.env.PORT ?? "8787");

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const correlationId = req.headers["x-correlation-id"] as string ?? crypto.randomUUID();
  const method = req.method ?? "GET";

  logger.info({ correlationId, method, path: url.pathname }, "Incoming request");

  try {
    // ── Auth: verify Bearer token from Cloudflare Queue Consumer ─────────────
    const authHeader = req.headers["authorization"] ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    const token = authHeader.replace("Bearer ", "");
    if (token !== process.env.WORKER_CLUSTER_TOKEN) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    // ── Routing ───────────────────────────────────────────────────────────────
    if (method === "POST" && url.pathname === "/start") {
      return handleStart(req, res, correlationId);
    }

    const stopMatch = url.pathname.match(/^\/stop\/(.+)$/);
    if (method === "POST" && stopMatch) {
      return handleStop(req, res, stopMatch[1], correlationId);
    }

    const statusMatch = url.pathname.match(/^\/status\/(.+)$/);
    if (method === "GET" && statusMatch) {
      return handleStatus(req, res, statusMatch[1]);
    }

    const filesMatch = url.pathname.match(/^\/files\/(.+)$/);
    if (method === "GET" && filesMatch) {
      return handleFiles(req, res, filesMatch[1]);
    }

    if (method === "GET" && url.pathname === "/health") {
      return handleHealth(req, res);
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  } catch (err) {
    logger.error({ correlationId, err }, "Unhandled error");
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, "Compute agent started");
});
