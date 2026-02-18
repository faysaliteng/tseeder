import type { Env } from "./index";

type Middleware = (req: Request, env: Env, ctx: { params: Record<string, string>; user?: { id: string; role: string } }) => Promise<Response | null>;

// ── Auth Middleware ───────────────────────────────────────────────────────────

export const authMiddleware: Middleware = async (req, env, ctx) => {
  const cookie = req.headers.get("Cookie") ?? "";
  const sessionToken = extractCookie(cookie, "session");
  const bearerToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  const token = sessionToken ?? bearerToken;

  if (!token) {
    return Response.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  // TODO: Look up session in D1
  // const tokenHash = await sha256(token);
  // const session = await env.DB.prepare(
  //   "SELECT s.*, u.id as uid, u.role, u.suspended FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > datetime('now')"
  // ).bind(tokenHash).first();
  //
  // if (!session || session.suspended) {
  //   return Response.json({ error: "Unauthorized", code: "SESSION_INVALID" }, { status: 401 });
  // }
  // ctx.user = { id: session.uid as string, role: session.role as string };

  // STUB: For development, set a mock user
  ctx.user = { id: "dev-user", role: "admin" };
  return null; // continue
};

// ── RBAC Middleware ───────────────────────────────────────────────────────────

const ROLE_ORDER = ["user", "support", "admin", "superadmin"];

export function rbacMiddleware(requiredRole: string): Middleware {
  return async (_req, _env, ctx) => {
    if (!ctx.user) {
      return Response.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }
    const userRoleIdx = ROLE_ORDER.indexOf(ctx.user.role);
    const requiredIdx = ROLE_ORDER.indexOf(requiredRole);
    if (userRoleIdx < requiredIdx) {
      return Response.json({ error: "Forbidden", code: "INSUFFICIENT_ROLE" }, { status: 403 });
    }
    return null;
  };
}

// ── CSRF Middleware ───────────────────────────────────────────────────────────

export const csrfMiddleware: Middleware = async (req, _env, _ctx) => {
  // Safe methods don't need CSRF
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return null;

  const csrfHeader = req.headers.get("X-CSRF-Token");
  if (!csrfHeader) {
    return Response.json({ error: "CSRF token missing", code: "CSRF_REQUIRED" }, { status: 403 });
  }

  // TODO: Validate CSRF token against KV store or signed HMAC
  // const isValid = await validateCsrfToken(csrfHeader, env.CSRF_SECRET);
  // if (!isValid) {
  //   return Response.json({ error: "Invalid CSRF token", code: "CSRF_INVALID" }, { status: 403 });
  // }

  return null;
};

// ── Rate Limit Middleware ─────────────────────────────────────────────────────

export function rateLimitMiddleware(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Middleware {
  return async (req, env, ctx) => {
    const identifier = ctx.user?.id ?? req.headers.get("CF-Connecting-IP") ?? "unknown";
    const kvKey = `rl:${key}:${identifier}`;

    // TODO: implement using KV atomic counters
    // const current = parseInt((await env.RATE_LIMIT_KV.get(kvKey)) ?? "0");
    // if (current >= maxRequests) {
    //   return Response.json(
    //     { error: "Rate limit exceeded", code: "RATE_LIMITED" },
    //     { status: 429, headers: { "Retry-After": String(windowSeconds) } },
    //   );
    // }
    // await env.RATE_LIMIT_KV.put(kvKey, String(current + 1), { expirationTtl: windowSeconds });

    return null;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
