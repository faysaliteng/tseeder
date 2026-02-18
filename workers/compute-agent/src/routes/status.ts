import type { IncomingMessage, ServerResponse } from "node:http";
import { StubTorrentEngine } from "../engine";
import { jobRegistry } from "../job-registry";

const engine = new StubTorrentEngine();

export async function handleStatus(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
): Promise<void> {
  const progress = engine.getProgress(jobId);
  const meta = jobRegistry.get(jobId);
  if (!meta) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Job not found" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ jobId, registryStatus: meta.status, progress }));
}

export async function handleFiles(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
): Promise<void> {
  const files = engine.getFiles(jobId);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ jobId, files }));
}
