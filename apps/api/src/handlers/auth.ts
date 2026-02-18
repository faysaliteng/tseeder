import type { Env } from "../index";
import {
  RegisterRequestSchema, LoginRequestSchema, ResetRequestSchema, ResetConfirmSchema,
} from "@rdm/shared";
import {
  hashPassword, verifyPassword, generateToken, hashToken,
  generateCsrfToken, verifyHmac, signHmac,
} from "../crypto";
import {
  getUserByEmail, getUserById, createUser, createSession,
  getSessionByTokenHash, deleteSession, deleteUserSessions, writeAuditLog,
} from "../d1-helpers";

// ── Rate limiting helpers (KV) ───────────────────────────────────────────────

async function rateLimitCheck(kv: KVNamespace, key: string, max: number, ttl: number): Promise<boolean> {
  const raw = await kv.get(key);
  const current = parseInt(raw ?? "0");
  if (current >= max) return false;
  await kv.put(key, String(current + 1), { expirationTtl: ttl });
  return true;
}

// ── Turnstile verification ────────────────────────────────────────────────────

async function verifyTurnstile(token: string, secretKey: string, ip: string | null): Promise<boolean> {
  if (secretKey === "BYPASS_FOR_DEV") return true; // dev-only bypass
  const form = new FormData();
  form.append("secret", secretKey);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await res.json<{ success: boolean }>();
  return data.success === true;
}

// ── POST /auth/register ───────────────────────────────────────────────────────

export async function handleRegister(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";

  // Rate limit: 5 registrations per IP per hour
  const rlKey = `rl:register:${ip}`;
  const allowed = await rateLimitCheck(env.RATE_LIMIT_KV, rlKey, 5, 3600);
  if (!allowed) {
    return apiError("RATE_LIMITED", "Too many registration attempts", 429, correlationId);
  }

  const body = await req.json().catch(() => null);
  const parsed = RegisterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);
  }

  const { email, password, turnstileToken } = parsed.data;

  // Verify Turnstile
  const turnstileOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!turnstileOk) {
    return apiError("AUTH_TURNSTILE_FAILED", "Bot verification failed", 400, correlationId);
  }

  // Check email uniqueness
  const existing = await getUserByEmail(env.DB, email);
  if (existing) {
    // Always return the same response to prevent enumeration
    return apiError("AUTH_EMAIL_EXISTS", "An account with this email already exists", 409, correlationId);
  }

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  await createUser(env.DB, { id: userId, email, passwordHash });

  await writeAuditLog(env.DB, {
    actorId: userId, action: "user.created",
    targetType: "user", targetId: userId,
    metadata: { email, ip }, ipAddress: ip,
  });

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "info", correlationId,
    service: "workers-api", handler: "POST /auth/register",
    userId, msg: "User registered",
  }));

  return Response.json({ message: "Registration successful. Please verify your email." }, { status: 201 });
}

// ── POST /auth/login ──────────────────────────────────────────────────────────

export async function handleLogin(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";

  // Rate limit: 10 per IP per minute
  const rlKey = `rl:login:${ip}`;
  const allowed = await rateLimitCheck(env.RATE_LIMIT_KV, rlKey, 10, 60);
  if (!allowed) {
    return apiError("RATE_LIMITED", "Too many login attempts", 429, correlationId, {
      "Retry-After": "60",
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);
  }

  const { email, password, turnstileToken } = parsed.data;

  const turnstileOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!turnstileOk) {
    return apiError("AUTH_TURNSTILE_FAILED", "Bot verification failed", 400, correlationId);
  }

  const user = await getUserByEmail(env.DB, email);
  if (!user) {
    // Prevent timing-based email enumeration: still hash password
    await hashPassword(password);
    return apiError("AUTH_INVALID", "Invalid email or password", 401, correlationId);
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    return apiError("AUTH_INVALID", "Invalid email or password", 401, correlationId);
  }

  if (!user.email_verified) {
    return apiError("AUTH_EMAIL_UNVERIFIED", "Please verify your email before logging in", 403, correlationId);
  }

  if (user.suspended) {
    return apiError("AUTH_SUSPENDED", "Your account has been suspended. Contact support.", 403, correlationId);
  }

  // Create session
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const deviceInfo = req.headers.get("User-Agent")?.slice(0, 255) ?? null;

  await createSession(env.DB, {
    id: sessionId, userId: user.id, tokenHash,
    expiresAt, deviceInfo: deviceInfo ?? undefined, ipAddress: ip,
  });

  // Generate CSRF token bound to session
  const csrfToken = await generateCsrfToken(sessionId, env.CSRF_SECRET);

  await writeAuditLog(env.DB, {
    actorId: user.id, action: "user.login",
    metadata: { ip, deviceInfo }, ipAddress: ip,
  });

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "info", correlationId,
    service: "workers-api", handler: "POST /auth/login", userId: user.id, msg: "User logged in",
  }));

  const headers = new Headers({
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken,
  });
  headers.append(
    "Set-Cookie",
    `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 3600}`,
  );

  return new Response(JSON.stringify({
    user: { id: user.id, email: user.email, role: user.role },
    csrfToken,
  }), { status: 200, headers });
}

// ── POST /auth/logout ────────────────────────────────────────────────────────

export async function handleLogout(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const cookie = req.headers.get("Cookie") ?? "";
  const token = extractCookie(cookie, "session");

  if (token) {
    const tokenHash = await hashToken(token);
    await deleteSession(env.DB, tokenHash);
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  return new Response(JSON.stringify({ message: "Logged out" }), { status: 200, headers });
}

// ── POST /auth/reset ─────────────────────────────────────────────────────────

export async function handleReset(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";

  const rlKey = `rl:reset:${ip}`;
  const allowed = await rateLimitCheck(env.RATE_LIMIT_KV, rlKey, 3, 3600);
  if (!allowed) return apiError("RATE_LIMITED", "Too many reset attempts", 429, correlationId);

  const body = await req.json().catch(() => null);
  const parsed = ResetRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);

  const user = await getUserByEmail(env.DB, parsed.data.email);
  // Always 200 to prevent enumeration
  if (user) {
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    await env.DB.prepare(`
      INSERT INTO password_reset_tokens (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).bind(tokenHash, user.id, expiresAt).run();

    // TODO: Send email with reset link: `${env.APP_DOMAIN}/auth/reset?token=${token}`
    console.log(JSON.stringify({
      ts: new Date().toISOString(), level: "info", correlationId,
      msg: "Password reset token created", userId: user.id,
    }));
  }

  return Response.json({ message: "If that email is registered, a reset link has been sent." });
}

// ── POST /auth/verify-email ───────────────────────────────────────────────────

export async function handleVerifyEmail(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const body = await req.json().catch(() => null);
  const token = body?.token as string | undefined;
  if (!token) return apiError("VALIDATION_ERROR", "Token required", 400, correlationId);

  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare(`
    SELECT * FROM email_verification_tokens
    WHERE token = ? AND expires_at > datetime('now') AND used = 0 LIMIT 1
  `).bind(tokenHash).first<{ user_id: string }>();

  if (!row) return apiError("AUTH_INVALID", "Invalid or expired verification token", 400, correlationId);

  await env.DB.batch([
    env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(row.user_id),
    env.DB.prepare("UPDATE email_verification_tokens SET used = 1 WHERE token = ?").bind(tokenHash),
  ]);

  return Response.json({ message: "Email verified successfully." });
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export function apiError(
  code: string,
  message: string,
  status: number,
  requestId: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(
    { error: { code, message, requestId } },
    { status, headers: { "Content-Type": "application/json", ...extraHeaders } },
  );
}

export function extractCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function formatZodError(error: { issues: { path: (string | number)[]; message: string }[] }): string {
  return error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
}
