/**
 * Posts progress callbacks to the Cloudflare Workers API
 */

import { logger } from "./logger";

export async function postCallback(
  callbackUrl: string,
  signingSecret: string,
  correlationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = await hmacSha256(body, signingSecret);

  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${signature}`,
          "X-Correlation-ID": correlationId,
          "X-Idempotency-Key": payload.idempotencyKey as string,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        logger.info({ jobId: payload.jobId, eventType: payload.eventType }, "Callback posted");
        return;
      }

      logger.warn({ jobId: payload.jobId, status: res.status, attempt }, "Callback non-OK, retrying");
    } catch (err) {
      logger.warn({ jobId: payload.jobId, err, attempt }, "Callback fetch error, retrying");
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt - 1), 16_000)));
  }

  logger.error({ jobId: payload.jobId }, "Callback failed after max retries");
}

async function hmacSha256(body: string, secret: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(body).digest("hex");
}
