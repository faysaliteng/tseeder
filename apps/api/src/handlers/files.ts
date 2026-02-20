import type { Env } from "../index";
import { SignedUrlRequestSchema } from "@rdm/shared";
import { getFileById, listFilesForJob, writeAuditLog } from "../d1-helpers";
import { signS3Request } from "../crypto";
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
// Now proxies through the agent tunnel instead of generating R2 signed URLs.

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

  // If file has an R2 key, use signed S3 URL (legacy path)
  if (file.r2_key) {
    const signedUrl = await signS3Request({
      method: "GET",
      bucket: env.R2_BUCKET_NAME,
      key: file.r2_key,
      region: "auto",
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      expiresIn: parsed.data.expiresIn,
      endpoint: env.R2_ENDPOINT,
    });

    await writeAuditLog(env.DB, {
      actorId: userId, action: "file.signed_url",
      targetType: "file", targetId: fileId,
      metadata: { r2Key: file.r2_key, expiresIn: parsed.data.expiresIn },
    });

    return Response.json({
      fileId,
      url: signedUrl,
      expiresAt: new Date(Date.now() + parsed.data.expiresIn * 1000).toISOString(),
      filename: file.path.split("/").pop(),
    });
  }

  // No R2 key — proxy download from agent via tunnel
  const job = await env.DB.prepare("SELECT id FROM jobs WHERE id = ?")
    .bind(file.job_id).first<{ id: string }>();
  if (!job) return apiError("NOT_FOUND", "Job not found", 404, correlationId);

  // Build agent download URL: /download/:jobId/:filePath
  const agentBase = env.WORKER_CLUSTER_URL;
  if (!agentBase) {
    return apiError("SERVER_ERROR", "Agent not configured", 500, correlationId);
  }

  const downloadUrl = `${agentBase.replace(/\/$/, "")}/download/${file.job_id}/${encodeURIComponent(file.path)}`;

  await writeAuditLog(env.DB, {
    actorId: userId, action: "file.signed_url",
    targetType: "file", targetId: fileId,
    metadata: { agentDownload: true, path: file.path },
  });

  return Response.json({
    fileId,
    url: downloadUrl,
    expiresAt: new Date(Date.now() + parsed.data.expiresIn * 1000).toISOString(),
    filename: file.path.split("/").pop(),
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

  // If file has R2 key, redirect to R2 signed URL
  if (file.r2_key) {
    const signedUrl = await signS3Request({
      method: "GET",
      bucket: env.R2_BUCKET_NAME,
      key: file.r2_key,
      region: "auto",
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      expiresIn: 3600,
      endpoint: env.R2_ENDPOINT,
    });
    return Response.redirect(signedUrl, 302);
  }

  // Proxy from agent
  const agentBase = env.WORKER_CLUSTER_URL;
  if (!agentBase) {
    return apiError("SERVER_ERROR", "Download agent not configured", 500, correlationId);
  }

  const agentUrl = `${agentBase.replace(/\/$/, "")}/download/${file.job_id}/${file.path}`;
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
