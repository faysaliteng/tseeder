import type { Env } from "../index";
import { SignedUrlRequestSchema } from "@rdm/shared";
import { getFileById, listFilesForJob, writeAuditLog } from "../d1-helpers";
import { signHmac, verifyHmac } from "../crypto";
import { apiError, formatZodError } from "./auth";

type Ctx = { params: Record<string, string>; user?: { id: string; role: string } };

// ── GET /jobs/:id/files ───────────────────────────────────────────────────────

export async function handleGetFiles(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { id } = ctx.params;
  const userId = ctx.user!.id;

  // Verify job ownership
  const job = await env.DB.prepare("SELECT id, user_id FROM jobs WHERE id = ?")
    .bind(id).first<{ id: string; user_id: string }>();

  if (!job) return apiError("NOT_FOUND", "Job not found", 404, correlationId);
  if (job.user_id !== userId && ctx.user?.role !== "admin" && ctx.user?.role !== "superadmin") {
    return apiError("NOT_FOUND", "Job not found", 404, correlationId);
  }

  const result = await listFilesForJob(env.DB, id);

  // Transform snake_case D1 rows to camelCase for the frontend
  const files = result.results.map(f => ({
    id: f.id,
    path: f.path,
    sizeBytes: f.size_bytes,
    mimeType: f.mime_type,
    isComplete: f.is_complete === 1,
    r2Key: f.r2_key,
  }));

  // Build a directory tree from flat file list
  const tree = buildFileTree(result.results);

  return Response.json({ jobId: id, files, tree });
}

// ── POST /files/:fileId/signed-url ────────────────────────────────────────────
// Returns a token-based streaming URL that proxies through the API worker.
// This avoids R2 signed URL encoding issues with special characters.

export async function handleSignedUrl(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { fileId } = ctx.params;
  const userId = ctx.user!.id;

  const body = await req.json().catch(() => ({}));
  const parsed = SignedUrlRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);

  const file = await getFileById(env.DB, fileId);
  if (!file) return apiError("NOT_FOUND", "File not found", 404, correlationId);

  // Ownership check (unless admin)
  if (file.user_id !== userId && !["admin", "superadmin"].includes(ctx.user?.role ?? "")) {
    return apiError("NOT_FOUND", "File not found", 404, correlationId);
  }

  if (!file.is_complete) {
    return apiError("VALIDATION_ERROR", "File is not ready for download yet", 409, correlationId);
  }

  // Generate a short-lived HMAC stream token
  const expiresIn = parsed.data.expiresIn;
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const payload = `stream:${fileId}:${expires}`;
  const token = await signHmac(payload, env.SESSION_SECRET);

  // Build the stream URL (goes through this same API worker)
  const apiBase = new URL(req.url).origin;
  const streamUrl = `${apiBase}/files/${fileId}/stream?token=${token}&expires=${expires}`;

  await writeAuditLog(env.DB, {
    actorId: userId, action: "file.signed_url",
    targetType: "file", targetId: fileId,
    metadata: { stream: true, expiresIn },
  });

  return Response.json({
    fileId,
    url: streamUrl,
    expiresAt: new Date(expires * 1000).toISOString(),
    filename: file.path.split("/").pop(),
  });
}

// ── GET /files/:fileId/stream?token=xxx&expires=xxx ───────────────────────────
// Token-based streaming proxy. No cookies needed — works with VLC, Kodi, etc.

export async function handleStreamProxy(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { fileId } = ctx.params;

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expiresStr = url.searchParams.get("expires");

  if (!token || !expiresStr) {
    return apiError("AUTH_ERROR", "Missing stream token", 401, correlationId);
  }

  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires) || Math.floor(Date.now() / 1000) > expires) {
    return apiError("AUTH_ERROR", "Stream token expired", 401, correlationId);
  }

  // Verify HMAC
  const payload = `stream:${fileId}:${expires}`;
  const valid = await verifyHmac(payload, env.SESSION_SECRET, token);
  if (!valid) {
    return apiError("AUTH_ERROR", "Invalid stream token", 401, correlationId);
  }

  const file = await getFileById(env.DB, fileId);
  if (!file) return apiError("NOT_FOUND", "File not found", 404, correlationId);
  if (!file.is_complete) return apiError("VALIDATION_ERROR", "File not ready", 409, correlationId);

  // Always proxy from agent — no R2
  const agentBase = env.WORKER_CLUSTER_URL;
  if (!agentBase) return apiError("SERVER_ERROR", "Agent not configured", 500, correlationId);

  const encodedPath = file.path.split("/").map(s => encodeURIComponent(s)).join("/");
  const agentUrl = `${agentBase.replace(/\/$/, "")}/download/${file.job_id}/${encodedPath}`;

  const agentRes = await fetch(agentUrl, {
    headers: {
      "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}`,
      "X-Correlation-ID": correlationId,
      ...(req.headers.get("Range") ? { "Range": req.headers.get("Range")! } : {}),
    },
  });

  if (!agentRes.ok) return apiError("SERVER_ERROR", `Agent stream failed: ${agentRes.status}`, 502, correlationId);

  const filename = file.path.split("/").pop() ?? "download";
  return new Response(agentRes.body, {
    status: agentRes.status,
    headers: {
      "Content-Type": agentRes.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
      "Content-Length": agentRes.headers.get("Content-Length") ?? "",
      "Accept-Ranges": "bytes",
    },
  });
}

// ── GET /files/:fileId/download — Proxy download from agent ───────────────────

export async function handleProxyDownload(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { fileId } = ctx.params;
  const userId = ctx.user!.id;

  const file = await getFileById(env.DB, fileId);
  if (!file) return apiError("NOT_FOUND", "File not found", 404, correlationId);
  if (file.user_id !== userId && !["admin", "superadmin"].includes(ctx.user?.role ?? "")) {
    return apiError("NOT_FOUND", "File not found", 404, correlationId);
  }
  if (!file.is_complete) {
    return apiError("VALIDATION_ERROR", "File is not ready for download yet", 409, correlationId);
  }

  // Always proxy from agent — files are stored on agent's local disk, not R2

  // Proxy from agent
  const agentBase = env.WORKER_CLUSTER_URL;
  if (!agentBase) {
    return apiError("SERVER_ERROR", "Download agent not configured", 500, correlationId);
  }

  // Encode each path segment to handle spaces, brackets, etc.
  const encodedPath = file.path.split("/").map(s => encodeURIComponent(s)).join("/");
  const agentUrl = `${agentBase.replace(/\/$/, "")}/download/${file.job_id}/${encodedPath}`;
  const agentRes = await fetch(agentUrl, {
    headers: {
      "Authorization": `Bearer ${env.WORKER_CLUSTER_TOKEN}`,
      "X-Correlation-ID": correlationId,
    },
  });

  if (!agentRes.ok) {
    return apiError("SERVER_ERROR", `Agent download failed: ${agentRes.status}`, 502, correlationId);
  }

  const filename = file.path.split("/").pop() ?? "download";

  return new Response(agentRes.body, {
    status: 200,
    headers: {
      "Content-Type": agentRes.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Content-Length": agentRes.headers.get("Content-Length") ?? "",
    },
  });
}

// ── DELETE /files/:fileId ─────────────────────────────────────────────────────

export async function handleDeleteFile(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const { fileId } = ctx.params;
  const userId = ctx.user!.id;

  const file = await getFileById(env.DB, fileId);
  if (!file) return apiError("NOT_FOUND", "File not found", 404, correlationId);
  if (file.user_id !== userId && !["admin", "superadmin"].includes(ctx.user?.role ?? "")) {
    return apiError("NOT_FOUND", "File not found", 404, correlationId);
  }

  // Delete from R2 if key exists
  if (file.r2_key) {
    await env.FILES_BUCKET.delete(file.r2_key);
  }

  await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(fileId).run();

  await writeAuditLog(env.DB, {
    actorId: userId, action: "file.deleted",
    targetType: "file", targetId: fileId,
    metadata: { r2Key: file.r2_key, path: file.path },
  });

  return Response.json({ message: "File deleted", fileId });
}

// ── Tree builder ──────────────────────────────────────────────────────────────

interface FileNode {
  type: "file" | "folder";
  name: string;
  path: string;
  sizeBytes?: number;
  mimeType?: string | null;
  isComplete?: boolean;
  children?: FileNode[];
}

function buildFileTree(files: import("../d1-helpers").FileRow[]): FileNode[] {
  const root: FileNode[] = [];
  const folderMap = new Map<string, FileNode>();

  for (const file of files) {
    const parts = file.path.split("/");
    let currentLevel = root;

    // Build folders
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join("/");
      if (!folderMap.has(folderPath)) {
        const folderNode: FileNode = {
          type: "folder", name: parts[i], path: folderPath, children: [],
        };
        currentLevel.push(folderNode);
        folderMap.set(folderPath, folderNode);
      }
      currentLevel = folderMap.get(folderPath)!.children!;
    }

    // Add file
    currentLevel.push({
      type: "file",
      name: parts[parts.length - 1],
      path: file.path,
      sizeBytes: file.size_bytes,
      mimeType: file.mime_type,
      isComplete: file.is_complete === 1,
    });
  }

  return root;
}
