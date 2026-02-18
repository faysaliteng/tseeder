import type { IncomingMessage, ServerResponse } from "node:http";
import { jobRegistry } from "../job-registry";
import * as os from "node:os";

export async function handleFiles(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
): Promise<void> {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ jobId, files: [] }));
}

export async function handleHealth(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const activeJobs = jobRegistry.size;
  const maxJobs = parseInt(process.env.MAX_CONCURRENT_JOBS ?? "10");
  const capacityPct = Math.round((activeJobs / maxJobs) * 100);
  const freeMem = os.freemem();
  const totalMem = os.totalmem();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: capacityPct < 90 ? "available" : "full",
    workerId: process.env.WORKER_ID ?? "agent-1",
    activeJobs,
    maxJobs,
    capacityPct,
    freeMem,
    totalMem,
    uptime: process.uptime(),
    ts: new Date().toISOString(),
  }));
}
