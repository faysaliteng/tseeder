import type { IncomingMessage, ServerResponse } from "node:http";
import { engine } from "./start";
import { jobRegistry } from "../job-registry";

export async function handleStop(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
  correlationId: string,
): Promise<void> {
  // Mark as stopped in registry so the download pipeline loop exits
  jobRegistry.set(jobId, { status: "stopped", startedAt: Date.now() });
  await engine.stop(jobId);
  jobRegistry.delete(jobId);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, jobId, message: "Stopped" }));
}
