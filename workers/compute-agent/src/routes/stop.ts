import type { IncomingMessage, ServerResponse } from "node:http";
import { StubTorrentEngine } from "../engine";
import { jobRegistry } from "../job-registry";

const engine = new StubTorrentEngine();

export async function handleStop(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  correlationId: string,
): Promise<void> {
  await engine.stop(jobId);
  jobRegistry.delete(jobId);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, jobId, message: "Stopped" }));
}
