/**
 * Blog / CMS handlers
 * Public:  GET /blog/articles, GET /blog/articles/:slug
 * Admin:   GET/POST /admin/articles, PATCH/DELETE /admin/articles/:id
 *          POST /admin/articles/:id/publish
 */

import type { Env } from "../index";

type Ctx = {
  params: Record<string, string>;
  query: Record<string, string>;
  user?: { id: string; role: string };
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

function estimateReadTime(body: string): string {
  const words = body.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return `${mins} min`;
}

function parseTags(raw: string | null): string[] {
  try { return JSON.parse(raw ?? "[]"); } catch { return []; }
}

function rowToArticle(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    coverImage: row.cover_image ?? null,
    category: row.category,
    tags: parseTags(row.tags as string),
    status: row.status,
    readTime: row.read_time ?? null,
    authorId: row.author_id ?? null,
    authorName: row.author_name ?? null,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function err(code: string, msg: string, status: number) {
  return Response.json({ error: { code, message: msg } }, { status });
}

// ─── Public: list published articles ──────────────────────────────────────────

export async function handleListArticles(req: Request, env: Env, ctx: Ctx) {
  const { category, limit = "20", page = "1" } = ctx.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const pg  = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pg - 1) * lim;

  let where = "WHERE a.status = 'published'";
  const bindings: unknown[] = [];

  if (category && category !== "All") {
    where += " AND a.category = ?";
    bindings.push(category);
  }

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM articles a ${where}`
  ).bind(...bindings).first<{ total: number }>();

  const total = countRow?.total ?? 0;

  const rows = await env.DB.prepare(
    `SELECT a.* FROM articles a ${where}
     ORDER BY a.published_at DESC LIMIT ? OFFSET ?`
  ).bind(...bindings, lim, offset).all();

  return json({
    articles: (rows.results ?? []).map(rowToArticle),
    meta: { page: pg, limit: lim, total, totalPages: Math.ceil(total / lim) },
  });
}

// ─── Public: get single article by slug ───────────────────────────────────────

export async function handleGetArticle(req: Request, env: Env, ctx: Ctx) {
  const { slug } = ctx.params;
  if (!slug) return err("NOT_FOUND", "Article not found", 404);

  const row = await env.DB.prepare(
    `SELECT * FROM articles WHERE slug = ? AND status = 'published'`
  ).bind(slug).first();

  if (!row) return err("NOT_FOUND", "Article not found", 404);
  return json({ article: rowToArticle(row as Record<string, unknown>) });
}

// ─── Admin: list all articles ──────────────────────────────────────────────────

export async function handleAdminListArticles(req: Request, env: Env, ctx: Ctx) {
  const { status, category, q, page = "1", limit = "20" } = ctx.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const pg  = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pg - 1) * lim;

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (status && status !== "all") { conditions.push("status = ?"); bindings.push(status); }
  if (category && category !== "All") { conditions.push("category = ?"); bindings.push(category); }
  if (q) { conditions.push("title LIKE ?"); bindings.push(`%${q}%`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM articles ${where}`
  ).bind(...bindings).first<{ total: number }>();

  const total = countRow?.total ?? 0;

  const rows = await env.DB.prepare(
    `SELECT * FROM articles ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
  ).bind(...bindings, lim, offset).all();

  return json({
    articles: (rows.results ?? []).map(rowToArticle),
    meta: { page: pg, limit: lim, total, totalPages: Math.ceil(total / lim) },
  });
}

// ─── Admin: create article ─────────────────────────────────────────────────────

export async function handleAdminCreateArticle(req: Request, env: Env, ctx: Ctx) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("BAD_REQUEST", "Invalid JSON", 400); }

  const title = (body.title as string | undefined)?.trim();
  if (!title || title.length < 3 || title.length > 200)
    return err("VALIDATION_ERROR", "Title must be 3–200 characters", 400);

  const excerpt     = ((body.excerpt as string | undefined) ?? "").slice(0, 500);
  const articleBody = (body.body as string | undefined) ?? "";
  const category    = ((body.category as string | undefined) ?? "General").slice(0, 50);
  const coverImage  = (body.coverImage as string | null | undefined) ?? null;
  const status      = ["draft", "published"].includes(body.status as string) ? body.status as string : "draft";
  const tags        = JSON.stringify(Array.isArray(body.tags) ? body.tags.slice(0, 10) : []);
  const readTime    = (body.readTime as string | undefined) ?? estimateReadTime(articleBody);
  const now         = new Date().toISOString();

  let slug = ((body.slug as string | undefined) ?? "")
    .toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 100) || slugify(title);

  // Ensure slug uniqueness
  const existing = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(slug).first();
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const publishedAt = status === "published" ? now : null;
  const authorName = ctx.user?.id
    ? ((await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(ctx.user.id).first<{ email: string }>())?.email ?? null)
    : null;

  const id = crypto.randomUUID().replace(/-/g, "");

  await env.DB.prepare(`
    INSERT INTO articles (id, slug, title, excerpt, body, cover_image, category, tags, status, read_time, author_id, author_name, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, slug, title, excerpt, articleBody, coverImage, category, tags, status, readTime,
    ctx.user?.id ?? null, authorName, publishedAt, now, now).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata, created_at)
    VALUES (?, ?, 'article.create', 'article', ?, ?, ?)
  `).bind(crypto.randomUUID(), ctx.user?.id, id, JSON.stringify({ title, slug, status }), now).run();

  const article = await env.DB.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first();
  return json({ article: rowToArticle(article as Record<string, unknown>) }, 201);
}

// ─── Admin: update article ─────────────────────────────────────────────────────

export async function handleAdminUpdateArticle(req: Request, env: Env, ctx: Ctx) {
  const { id } = ctx.params;
  if (!id) return err("NOT_FOUND", "Article not found", 404);

  const existing = await env.DB.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first();
  if (!existing) return err("NOT_FOUND", "Article not found", 404);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("BAD_REQUEST", "Invalid JSON", 400); }

  const now = new Date().toISOString();
  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (body.title !== undefined) {
    const t = (body.title as string).trim();
    if (t.length < 3 || t.length > 200) return err("VALIDATION_ERROR", "Title must be 3–200 characters", 400);
    updates.push("title = ?"); bindings.push(t);
  }
  if (body.slug !== undefined) {
    const s = (body.slug as string).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 100);
    // check uniqueness (exclude self)
    const clash = await env.DB.prepare("SELECT id FROM articles WHERE slug = ? AND id != ?").bind(s, id).first();
    if (clash) return err("CONFLICT", "Slug already in use", 409);
    updates.push("slug = ?"); bindings.push(s);
  }
  if (body.excerpt !== undefined) { updates.push("excerpt = ?"); bindings.push((body.excerpt as string).slice(0, 500)); }
  if (body.body !== undefined) {
    updates.push("body = ?"); bindings.push(body.body as string);
    // auto-update read time if not explicitly provided
    if (body.readTime === undefined) {
      updates.push("read_time = ?"); bindings.push(estimateReadTime(body.body as string));
    }
  }
  if (body.readTime !== undefined) { updates.push("read_time = ?"); bindings.push((body.readTime as string).slice(0, 20)); }
  if (body.category !== undefined) { updates.push("category = ?"); bindings.push((body.category as string).slice(0, 50)); }
  if (body.coverImage !== undefined) { updates.push("cover_image = ?"); bindings.push(body.coverImage); }
  if (body.tags !== undefined) { updates.push("tags = ?"); bindings.push(JSON.stringify(Array.isArray(body.tags) ? body.tags.slice(0, 10) : [])); }
  if (body.status !== undefined) {
    if (!["draft", "published", "archived"].includes(body.status as string))
      return err("VALIDATION_ERROR", "Invalid status", 400);
    updates.push("status = ?"); bindings.push(body.status);
    // set published_at when first publishing
    if (body.status === "published" && !(existing as Record<string, unknown>).published_at) {
      updates.push("published_at = ?"); bindings.push(now);
    }
  }

  if (updates.length === 0) return err("BAD_REQUEST", "No fields to update", 400);

  updates.push("updated_at = ?"); bindings.push(now);
  bindings.push(id);

  await env.DB.prepare(`UPDATE articles SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata, created_at)
    VALUES (?, ?, 'article.update', 'article', ?, ?, ?)
  `).bind(crypto.randomUUID(), ctx.user?.id, id, JSON.stringify({ fields: updates.length }), now).run();

  const updated = await env.DB.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first();
  return json({ article: rowToArticle(updated as Record<string, unknown>) });
}

// ─── Admin: delete article ─────────────────────────────────────────────────────

export async function handleAdminDeleteArticle(req: Request, env: Env, ctx: Ctx) {
  const { id } = ctx.params;
  if (!id) return err("NOT_FOUND", "Article not found", 404);

  const existing = await env.DB.prepare("SELECT title, slug FROM articles WHERE id = ?").bind(id).first<{ title: string; slug: string }>();
  if (!existing) return err("NOT_FOUND", "Article not found", 404);

  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata, created_at)
    VALUES (?, ?, 'article.delete', 'article', ?, ?, ?)
  `).bind(crypto.randomUUID(), ctx.user?.id, id, JSON.stringify({ title: existing.title, slug: existing.slug }), now).run();

  await env.DB.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
  return json({ message: "Article deleted", id });
}

// ─── Admin: toggle publish ─────────────────────────────────────────────────────

export async function handleAdminTogglePublish(req: Request, env: Env, ctx: Ctx) {
  const { id } = ctx.params;
  if (!id) return err("NOT_FOUND", "Article not found", 404);

  const existing = await env.DB.prepare("SELECT status, published_at FROM articles WHERE id = ?")
    .bind(id).first<{ status: string; published_at: string | null }>();
  if (!existing) return err("NOT_FOUND", "Article not found", 404);

  const now = new Date().toISOString();
  const newStatus = existing.status === "published" ? "draft" : "published";
  const publishedAt = newStatus === "published" && !existing.published_at ? now : (existing.published_at ?? null);

  await env.DB.prepare(
    "UPDATE articles SET status = ?, published_at = ?, updated_at = ? WHERE id = ?"
  ).bind(newStatus, publishedAt, now, id).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata, created_at)
    VALUES (?, ?, 'article.toggle_publish', 'article', ?, ?, ?)
  `).bind(crypto.randomUUID(), ctx.user?.id, id, JSON.stringify({ newStatus }), now).run();

  return json({ id, status: newStatus, publishedAt });
}
