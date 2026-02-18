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

  // Build a directory tree from flat file list
  const tree = buildFileTree(result.results);

  return Response.json({ jobId: id, files: result.results, tree });
}

// ── POST /files/:fileId/signed-url ────────────────────────────────────────────

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

  if (!file.is_complete || !file.r2_key) {
    return apiError("VALIDATION_ERROR", "File is not ready for download yet", 409, correlationId);
  }

  // Generate R2 presigned URL using SigV4
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
