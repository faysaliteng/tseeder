/**
 * Seedr Cron Poller
 * Runs on a Cloudflare Cron Trigger every 2 minutes.
 * Polls Seedr.cc REST API for transfer progress on all active Seedr-provider jobs,
 * updates Durable Objects + D1, and marks jobs complete when Seedr reports 101%.
 */

import type { Env } from "./index";
import { JobStatus } from "@rdm/shared";
import { updateJobStatus, upsertFiles, appendJobEvent } from "./d1-helpers";

interface SeedrTransfer {
  id: number;
  name: string;
  progress: number;  // 0–100, 101 = complete
  size: number;
  downloaded: number;
  seeders?: number;
  torrent_hash?: string;
}

interface SeedrTransfersResponse {
  torrents?: SeedrTransfer[];
  transfers?: SeedrTransfer[];
  result?: boolean | string;
}

interface SeedrFolder {
  id: number;
  name: string;
  fullname?: string;
}

interface SeedrFolderContents {
  files?: Array<{
    id: number;
    name: string;
    size: number;
    hash?: string;
    play_video_hash?: string;
    folder_id?: number;
    stream_link?: string;
  }>;
  folders?: SeedrFolder[];
}

interface ActiveSeedrJob {
  id: string;
  worker_id: string;  // format: "seedr:<transferId>"
  user_id: string;
  name: string;
}

export async function runSeedrPoller(env: Env): Promise<void> {
  const log = (level: string, msg: string, extra?: Record<string, unknown>) =>
    console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: "seedr-poller", msg, ...extra }));

  // 1. Get Seedr credentials from env secrets
  const seedrEmail = (env as any).SEEDR_EMAIL as string | undefined;
  const seedrPassword = (env as any).SEEDR_PASSWORD as string | undefined;

  if (!seedrEmail || !seedrPassword) {
    log("warn", "SEEDR_EMAIL or SEEDR_PASSWORD not set — skipping cron poll");
    return;
  }

  const auth = "Basic " + btoa(`${seedrEmail}:${seedrPassword}`);

  // 2. Find all active Seedr jobs in D1
  const activeJobs = await env.DB.prepare(`
    SELECT id, worker_id, user_id, name FROM jobs
    WHERE worker_id LIKE 'seedr:%'
    AND status IN ('metadata_fetch', 'queued', 'downloading', 'uploading')
    LIMIT 100
  `).all<ActiveSeedrJob>();

  if (activeJobs.results.length === 0) {
    log("info", "No active Seedr jobs to poll");
    return;
  }

  log("info", `Polling ${activeJobs.results.length} Seedr jobs`);

  // 3. Fetch all active transfers from Seedr in one call
  let seedrTransfers: SeedrTransfer[] = [];
  try {
    const res = await fetch("https://www.seedr.cc/rest/transfer", {
      headers: { "Authorization": auth },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      log("error", `Seedr transfers list failed: ${res.status}`);
      return;
    }

    const data = await res.json<SeedrTransfersResponse>();
    seedrTransfers = data.torrents ?? data.transfers ?? [];
    log("info", `Seedr returned ${seedrTransfers.length} transfers`);
  } catch (err) {
    log("error", "Failed to fetch Seedr transfers", { error: String(err) });
    return;
  }

  // Build lookup map: seedrTransferId => transfer
  const transferMap = new Map<number, SeedrTransfer>(
    seedrTransfers.map(t => [t.id, t]),
  );

  // 4. Process each active job
  for (const job of activeJobs.results) {
    const seedrIdStr = job.worker_id.replace("seedr:", "");
    const seedrId = parseInt(seedrIdStr, 10);

    if (isNaN(seedrId)) {
      log("warn", "Invalid seedr worker_id, skipping", { jobId: job.id, workerId: job.worker_id });
      continue;
    }

    const transfer = transferMap.get(seedrId);

    // If Seedr no longer shows this transfer, it may have been deleted/expired
    if (!transfer) {
      log("warn", "Seedr transfer not found in list — may be expired", { jobId: job.id, seedrId });
      continue;
    }

    const progressPct = Math.min(100, transfer.progress);
    const isComplete = transfer.progress >= 101;

    // Update Durable Object with live progress
    try {
      const doId = env.JOB_PROGRESS_DO.idFromName(job.id);
      await env.JOB_PROGRESS_DO.get(doId).fetch(new Request("http://do/update", {
        method: "POST",
        body: JSON.stringify({
          jobId: job.id,
          status: isComplete ? JobStatus.Uploading : JobStatus.Downloading,
          progressPct,
          bytesDownloaded: transfer.downloaded ?? 0,
          bytesTotal: transfer.size ?? 0,
        }),
        headers: { "Content-Type": "application/json" },
      }));
    } catch (err) {
      log("warn", "Failed to update DO progress", { jobId: job.id, error: String(err) });
    }

    if (isComplete) {
      // Fetch folder contents from Seedr to get file list
      log("info", "Seedr transfer complete — fetching file list", { jobId: job.id, seedrId });

      let files: Array<{ path: string; sizeBytes: number; mimeType: string | null; isComplete: boolean }> = [];

      try {
        // Get root folder contents (Seedr organises by folder)
        const folderRes = await fetch(`https://www.seedr.cc/rest/folder/${transfer.id}`, {
          headers: { "Authorization": auth },
          signal: AbortSignal.timeout(10_000),
        });

        if (folderRes.ok) {
          const folderData = await folderRes.json<SeedrFolderContents>();

          for (const f of folderData.files ?? []) {
            files.push({
              path: f.name,
              sizeBytes: f.size,
              mimeType: guessMimeType(f.name),
              isComplete: true,
            });
          }

          // Recurse one level into sub-folders
          for (const folder of folderData.folders ?? []) {
            try {
              const subRes = await fetch(`https://www.seedr.cc/rest/folder/${folder.id}`, {
                headers: { "Authorization": auth },
                signal: AbortSignal.timeout(8_000),
              });
              if (subRes.ok) {
                const subData = await subRes.json<SeedrFolderContents>();
                for (const f of subData.files ?? []) {
                  files.push({
                    path: `${folder.name}/${f.name}`,
                    sizeBytes: f.size,
                    mimeType: guessMimeType(f.name),
                    isComplete: true,
                  });
                }
              }
            } catch { /* non-fatal, skip subfolder */ }
          }
        }
      } catch (err) {
        log("warn", "Failed to fetch Seedr folder contents", { jobId: job.id, error: String(err) });
      }

      // Upsert files into D1
      if (files.length > 0) {
        await upsertFiles(env.DB, job.id, files);
      }

      // Mark job as completed in D1
      await updateJobStatus(env.DB, {
        id: job.id,
        status: JobStatus.Completed,
        completedAt: new Date().toISOString(),
      });

      await appendJobEvent(env.DB, {
        jobId: job.id,
        eventType: "seedr_completed",
        payload: {
          seedrId,
          filesFound: files.length,
          bytesTotal: transfer.size,
          provider: "seedr",
        },
        correlationId: crypto.randomUUID(),
      });

      // Final DO update: mark complete
      try {
        const doId = env.JOB_PROGRESS_DO.idFromName(job.id);
        await env.JOB_PROGRESS_DO.get(doId).fetch(new Request("http://do/update", {
          method: "POST",
          body: JSON.stringify({
            jobId: job.id,
            status: JobStatus.Completed,
            progressPct: 100,
            bytesTotal: transfer.size ?? 0,
            bytesDownloaded: transfer.size ?? 0,
          }),
          headers: { "Content-Type": "application/json" },
        }));
      } catch { /* non-fatal */ }

      log("info", "Job completed via Seedr", { jobId: job.id, seedrId, files: files.length });
    } else {
      // Still in progress: update D1 status if needed (stay in downloading)
      await env.DB.prepare(
        "UPDATE jobs SET updated_at = datetime('now') WHERE id = ?"
      ).bind(job.id).run();

      log("info", "Seedr job in progress", { jobId: job.id, seedrId, progressPct });
    }
  }
}

// ── MIME type guesser ─────────────────────────────────────────────────────────

function guessMimeType(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    mp4: "video/mp4", mkv: "video/x-matroska", avi: "video/x-msvideo",
    mov: "video/quicktime", wmv: "video/x-ms-wmv", webm: "video/webm",
    mp3: "audio/mpeg", flac: "audio/flac", aac: "audio/aac",
    ogg: "audio/ogg", wav: "audio/wav",
    pdf: "application/pdf", zip: "application/zip",
    rar: "application/x-rar-compressed", "7z": "application/x-7z-compressed",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    txt: "text/plain", srt: "text/plain", sub: "text/plain",
    epub: "application/epub+zip", mobi: "application/x-mobipocket-ebook",
  };
  return map[ext] ?? null;
}
