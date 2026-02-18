/**
 * Queue Consumer — processes job dispatch messages from rdm-job-queue
 */

import type { Env } from "./index";
import { JobStatus } from "@rdm/shared";

interface JobQueueMessage {
  jobId: string;
  userId: string;
  type: "magnet" | "torrent";
  magnetUri?: string;
  torrentBase64?: string;
  correlationId: string;
  attempt: number;
}

export async function handleQueueBatch(
  batch: MessageBatch<unknown>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const msg = message.body as JobQueueMessage;
    const log = (level: string, text: string, extra?: Record<string, unknown>) =>
      console.log(JSON.stringify({ ts: new Date().toISOString(), level, correlationId: msg.correlationId, jobId: msg.jobId, msg: text, ...extra }));

    try {
      log("info", "Processing queue message", { attempt: msg.attempt });
      await processJob(msg, env, log);
      message.ack();
    } catch (err) {
      log("error", "Queue processing error", { error: String(err) });

      if (msg.attempt >= 5) {
        log("error", "Max retries exceeded — sending to DLQ");
        await env.JOB_DLQ.send({ ...msg, failedAt: new Date().toISOString(), error: String(err) });

        // TODO: Mark job as failed in D1
        // await env.DB.prepare("UPDATE jobs SET status = 'failed', error = ? WHERE id = ?")
        //   .bind(String(err), msg.jobId).run();

        message.ack(); // ack to remove from main queue
      } else {
        message.retry(); // exponential backoff handled by Queue
      }
    }
  }
}

async function processJob(
  msg: JobQueueMessage,
  env: Env,
  log: (level: string, text: string, extra?: Record<string, unknown>) => void,
): Promise<void> {
  // Step 1: Select least-loaded compute agent
  const workerUrl = await selectWorker(env, log);
  if (!workerUrl) throw new Error("No available compute workers");

  // TODO: Update job status to metadata_fetch in D1
  // await env.DB.prepare("UPDATE jobs SET status = 'metadata_fetch', worker_id = ?, updated_at = datetime('now') WHERE id = ?")
  //   .bind(workerUrl, msg.jobId).run();

  // Step 2: Send job to compute agent
  const callbackUrl = `${env.APP_DOMAIN}/jobs/callback`;
  const payload = {
    jobId: msg.jobId,
    type: msg.type,
    magnetUri: msg.magnetUri,
    torrentBase64: msg.torrentBase64,
    callbackUrl,
    callbackSecret: await generateCallbackHmac(msg.jobId, env.CALLBACK_SIGNING_SECRET),
    correlationId: msg.correlationId,
  };

  const response = await fetch(`${workerUrl}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}`,
      "X-Correlation-ID": msg.correlationId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Worker rejected job: ${response.status} ${text}`);
  }

  log("info", "Job dispatched to compute agent", { workerUrl });
}

async function selectWorker(
  env: Env,
  log: (level: string, text: string, extra?: Record<string, unknown>) => void,
): Promise<string | null> {
  try {
    const response = await fetch(`${env.WORKER_CLUSTER_URL}/health`, {
      headers: { "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    // TODO: Parse worker list and pick least-loaded by capacity
    // const workers: { url: string; capacity: number; activJobs: number }[] = await response.json();
    // return workers.sort((a, b) => a.activJobs / a.capacity - b.activJobs / b.capacity)[0]?.url ?? null;

    return env.WORKER_CLUSTER_URL;
  } catch (err) {
    log("warn", "Could not reach worker cluster", { error: String(err) });
    return null;
  }
}

async function generateCallbackHmac(jobId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(jobId));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}
