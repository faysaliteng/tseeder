import type { Env } from "./index";
import { hashToken, verifyCsrfToken } from "./crypto";
import { getSessionByTokenHash } from "./d1-helpers";
import { extractCookie } from "./handlers/auth";

type Ctx = { params: Record<string, string>; query: Record<string, string>; user?: { id: string; role: string; email?: string } };
type Middleware = (req: Request, env: Env, ctx: Ctx) => Promise<Response | null>;

const ROLE_ORDER = ["user", "support", "admin", "superadmin"];

export const authMiddleware: Middleware = async (req, env, ctx) => {
  const cookie = req.headers.get("Cookie") ?? "";
  const token = extractCookie(cookie, "session")
    ?? req.headers.get("Authorization")?.replace("Bearer ", "").trim();

  if (!token) return json401("AUTH_REQUIRED", "Authentication required");

  const tokenHash = await hashToken(token);
  const session = await getSessionByTokenHash(env.DB, tokenHash);

  if (!session) return json401("AUTH_INVALID", "Invalid or expired session");
  if (session.suspended) return json401("AUTH_SUSPENDED", "Account suspended");

  ctx.user = { id: session.uid, role: session.role, email: session.email };
  return null;
};

export function rbacMiddleware(requiredRole: string): Middleware {
  return async (_req, _env, ctx) => {
    if (!ctx.user) return json401("AUTH_REQUIRED", "Authentication required");
    const userIdx = ROLE_ORDER.indexOf(ctx.user.role);
    const reqIdx = ROLE_ORDER.indexOf(requiredRole);
    if (userIdx < reqIdx) return json403("INSUFFICIENT_ROLE", "Insufficient permissions");
    return null;
  };
}

export const csrfMiddleware: Middleware = async (req, env, ctx) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return null;

  // API key / Bearer auth is exempt from CSRF — the token itself acts as the
  // second factor for mutation requests (extension, scripts, integrations).
  // Extensions may share the domain with the web app, so cookies could be sent
  // alongside the Bearer header. The presence of Bearer alone is sufficient.
  const hasBearerToken = !!req.headers.get("Authorization")?.startsWith("Bearer ");
  if (hasBearerToken) return null;

  const csrfHeader = req.headers.get("X-CSRF-Token");
  if (!csrfHeader) return json403("CSRF_REQUIRED", "X-CSRF-Token header required");

  const cookie = req.headers.get("Cookie") ?? "";
  const sessionToken = extractCookie(cookie, "session") ?? "";
  const sessionHash = await hashToken(sessionToken);
  const session = await getSessionByTokenHash(env.DB, sessionHash);
  if (!session) return json403("CSRF_INVALID", "Invalid session for CSRF check");

  const valid = await verifyCsrfToken(csrfHeader, session.id, env.CSRF_SECRET);
  if (!valid) return json403("CSRF_INVALID", "Invalid CSRF token");
  return null;
};

export function rateLimitMiddleware(key: string, max: number, windowSeconds: number): Middleware {
  return async (req, env, ctx) => {
    try {
      const id = ctx.user?.id ?? req.headers.get("CF-Connecting-IP") ?? "unknown";
      const kvKey = `rl:${key}:${id}`;
      const raw = await env.RATE_LIMIT_KV.get(kvKey);
      const current = parseInt(raw ?? "0");
      if (current >= max) {
        return Response.json(
          { error: { code: "RATE_LIMITED", message: "Rate limit exceeded" } },
          { status: 429, headers: { "Retry-After": String(windowSeconds) } },
        );
      }
      await env.RATE_LIMIT_KV.put(kvKey, String(current + 1), { expirationTtl: windowSeconds });
    } catch (e) {
      // Fail open — if KV is unavailable (e.g. daily limit exceeded),
      // allow the request through rather than returning a 500.
      console.error("Rate-limit KV error (failing open):", e);
    }
    return null;
  };
}

function json401(code: string, message: string) {
  return Response.json({ error: { code, message } }, { status: 401 });
}
function json403(code: string, message: string) {
  return Response.json({ error: { code, message } }, { status: 403 });
}
