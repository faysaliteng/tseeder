import type { Env } from "../index";

// GET /jobs/:id/files
export async function handleGetFiles(
  req: Request,
  env: Env,
  ctx: { params: Record<string, string>; user?: { id: string; role: string } },
): Promise<Response> {
  const { id } = ctx.params;

  // TODO: Verify job ownership in D1
  // TODO: Query files table
  // const result = await env.DB.prepare("SELECT * FROM files WHERE job_id = ? ORDER BY path").bind(id).all();

  return Response.json({ jobId: id, files: [], tree: [] });
}

// POST /files/:fileId/signed-url
export async function handleSignedUrl(
  req: Request,
  env: Env,
  ctx: { params: Record<string, string>; user?: { id: string; role: string } },
): Promise<Response> {
  const { fileId } = ctx.params;

  // TODO: Verify file ownership (file → job → user) in D1
  // const file = await env.DB.prepare(
  //   "SELECT f.*, j.user_id FROM files f JOIN jobs j ON j.id = f.job_id WHERE f.id = ? AND j.user_id = ?"
  // ).bind(fileId, ctx.user!.id).first();
  // if (!file) return Response.json({ error: "Not found" }, { status: 404 });
  // if (!file.is_complete || !file.r2_key) return Response.json({ error: "File not ready" }, { status: 409 });

  // TODO: Generate R2 presigned URL (S3-compatible)
  // const url = await generateR2SignedUrl(env, file.r2_key as string, 3600);

  return Response.json({
    fileId,
    url: "https://your-r2-bucket.r2.cloudflarestorage.com/SIGNED_URL_PLACEHOLDER",
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  });
}

// DELETE /files/:fileId
export async function handleDeleteFile(
  req: Request,
  env: Env,
  ctx: { params: Record<string, string>; user?: { id: string; role: string } },
): Promise<Response> {
  const { fileId } = ctx.params;

  // TODO: Verify ownership, delete from R2, delete from D1

  return Response.json({ message: "File deleted", fileId });
}
