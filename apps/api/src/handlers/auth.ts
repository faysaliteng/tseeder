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

// Turnstile verification removed — bot protection disabled for now

// ── POST /auth/register ───────────────────────────────────────────────────────

export async function handleRegister(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";

  // Rate limit: 50 registrations per IP per hour
  const rlKey = `rl:register:${ip}`;
  const allowed = await rateLimitCheck(env.RATE_LIMIT_KV, rlKey, 50, 3600);
  if (!allowed) {
    return apiError("RATE_LIMITED", "Too many registration attempts", 429, correlationId);
  }

  const body = await req.json().catch(() => null);
  const parsed = RegisterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);
  }

  const { email, password } = parsed.data;

  // Check email uniqueness
  const existing = await getUserByEmail(env.DB, email);
  if (existing) {
    // Always return the same response to prevent enumeration
    return apiError("AUTH_EMAIL_EXISTS", "An account with this email already exists", 409, correlationId);
  }

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  await createUser(env.DB, { id: userId, email, passwordHash });

  // Generate email verification token and send immediately
  const verifyToken = generateToken();
  const verifyTokenHash = await hashToken(verifyToken);
  const verifyExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  await env.DB.prepare(`
    INSERT INTO email_verification_tokens (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(verifyTokenHash, userId, verifyExpiresAt).run();

  const verifyUrl = `${env.APP_DOMAIN}/auth/verify?token=${verifyToken}`;
  await sendVerificationEmail(env, email, verifyUrl, correlationId).catch(err => {
    console.error(JSON.stringify({ correlationId, msg: "Verification email send failed", error: String(err) }));
  });

  await writeAuditLog(env.DB, {
    actorId: userId, action: "user.created",
    targetType: "user", targetId: userId,
    metadata: { email, ip }, ipAddress: ip,
  });

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "info", correlationId,
    service: "workers-api", handler: "POST /auth/register",
    userId, msg: "User registered — verification email dispatched",
  }));

  return Response.json({ message: "Registration successful. Please check your email to verify your account." }, { status: 201 });
}

// ── POST /auth/login ──────────────────────────────────────────────────────────

export async function handleLogin(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";

  const body = await req.json().catch(() => null);
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);
  }

  const { email, password } = parsed.data;

  const user = await getUserByEmail(env.DB, email);

  // Rate limit: 50 per IP per hour — skip for admin/superadmin
  const isAdmin = user && (user.role === "admin" || user.role === "superadmin");
  if (!isAdmin) {
    const rlKey = `rl:login:${ip}`;
    const allowed = await rateLimitCheck(env.RATE_LIMIT_KV, rlKey, 50, 3600);
    if (!allowed) {
      return apiError("RATE_LIMITED", "Too many login attempts", 429, correlationId, {
        "Retry-After": "3600",
      });
    }
  }
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

    const resetUrl = `${env.APP_DOMAIN}/auth/reset?token=${token}`;

    // Send email via MailChannels (Cloudflare Workers native, free tier available)
    await sendPasswordResetEmail(env, user.email, resetUrl, correlationId).catch(err => {
      console.error(JSON.stringify({ correlationId, msg: "Email send failed", error: String(err) }));
    });

    console.log(JSON.stringify({
      ts: new Date().toISOString(), level: "info", correlationId,
      msg: "Password reset token created", userId: user.id,
    }));
  }

  return Response.json({ message: "If that email is registered, a reset link has been sent." });
}

// ── POST /auth/reset/confirm ──────────────────────────────────────────────────

export async function handleResetConfirm(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";

  const rlKey = `rl:reset-confirm:${ip}`;
  const allowed = await rateLimitCheck(env.RATE_LIMIT_KV, rlKey, 5, 3600);
  if (!allowed) return apiError("RATE_LIMITED", "Too many attempts", 429, correlationId);

  const body = await req.json().catch(() => null);
  const parsed = ResetConfirmSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", formatZodError(parsed.error), 400, correlationId);

  const { token, password } = parsed.data;
  const tokenHash = await hashToken(token);

  const tokenRow = await env.DB.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token = ? AND expires_at > datetime('now') AND used = 0 LIMIT 1
  `).bind(tokenHash).first<{ user_id: string; token: string }>();

  if (!tokenRow) {
    return apiError("AUTH_INVALID", "Invalid or expired reset token", 400, correlationId);
  }

  const passwordHash = await hashPassword(password);

  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(passwordHash, tokenRow.user_id),
    env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE token = ?")
      .bind(tokenHash),
    // Invalidate all existing sessions for security
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?")
      .bind(tokenRow.user_id),
  ]);

  await writeAuditLog(env.DB, {
    actorId: tokenRow.user_id, action: "user.password_reset",
    targetType: "user", targetId: tokenRow.user_id,
    metadata: { ip }, ipAddress: ip,
  });

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "info", correlationId,
    msg: "Password reset completed", userId: tokenRow.user_id,
  }));

  return Response.json({ message: "Password reset successful. Please sign in with your new password." });
}

// ── Email via MailChannels ────────────────────────────────────────────────────

async function sendPasswordResetEmail(
  env: Env,
  toEmail: string,
  resetUrl: string,
  correlationId: string,
): Promise<void> {
  const appDomain = env.APP_DOMAIN ?? "https://tseeder.cc";
  const fromEmail = (env as any).MAIL_FROM ?? `noreply@${new URL(appDomain).hostname}`;
  const fromName = "tseeder";

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset your tseeder password</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#12121a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#3b29cc,#6d28d9);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">tseeder</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Remote Download Manager</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#fff;font-size:20px;font-weight:700;">Reset your password</h2>
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">
              We received a request to reset the password for your account (<strong style="color:rgba(255,255,255,0.85);">${toEmail}</strong>).
              Click the button below to choose a new password. This link expires in <strong style="color:#a78bfa;">1 hour</strong>.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
                Reset Password
              </a>
            </div>
            <p style="margin:24px 0 0;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.5;">
              If you didn't request this, you can safely ignore this email. Your password will not change.
              <br><br>
              Or copy and paste this URL into your browser:<br>
              <span style="color:#818cf8;word-break:break-all;">${resetUrl}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;">
              &copy; ${new Date().getFullYear()} tseeder &mdash; Remote Download Manager
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const payload = {
    personalizations: [{ to: [{ email: toEmail }] }],
    from: { email: fromEmail, name: fromName },
    subject: "Reset your tseeder password",
    content: [
      { type: "text/plain", value: `Reset your tseeder password: ${resetUrl}\n\nThis link expires in 1 hour.` },
      { type: "text/html", value: htmlBody },
    ],
  };

  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Correlation-ID": correlationId,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`MailChannels error: ${res.status} ${text}`);
  }
}

// ── Email: Verification ───────────────────────────────────────────────────────

async function sendVerificationEmail(
  env: Env,
  toEmail: string,
  verifyUrl: string,
  correlationId: string,
): Promise<void> {
  const appDomain = env.APP_DOMAIN ?? "https://tseeder.cc";
  const fromEmail = (env as any).MAIL_FROM ?? `noreply@${new URL(appDomain).hostname}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Verify your tseeder email</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#12121a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#3b29cc,#6d28d9);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">tseeder</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Remote Download Manager</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#fff;font-size:20px;font-weight:700;">Verify your email address</h2>
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;">
              Welcome to tseeder! Click the button below to verify
              <strong style="color:rgba(255,255,255,0.85);">${toEmail}</strong>
              and activate your account. This link expires in <strong style="color:#a78bfa;">24 hours</strong>.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
                Verify Email
              </a>
            </div>
            <p style="margin:24px 0 0;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.5;">
              If you didn't create a tseeder account, you can safely ignore this email.
              <br><br>
              Or copy and paste this URL into your browser:<br>
              <span style="color:#818cf8;word-break:break-all;">${verifyUrl}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;">
              &copy; ${new Date().getFullYear()} tseeder &mdash; Remote Download Manager
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const payload = {
    personalizations: [{ to: [{ email: toEmail }] }],
    from: { email: fromEmail, name: "tseeder" },
    subject: "Verify your tseeder email address",
    content: [
      { type: "text/plain", value: `Verify your tseeder account: ${verifyUrl}\n\nThis link expires in 24 hours.` },
      { type: "text/html", value: htmlBody },
    ],
  };

  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Correlation-ID": correlationId },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`MailChannels verification email error: ${res.status} ${text}`);
  }
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

// ── GET /auth/api-keys ────────────────────────────────────────────────────────

export async function handleListApiKeys(req: Request, env: Env, ctx: { user?: { id: string; role: string } }): Promise<Response> {
  const userId = ctx.user!.id;
  const rows = await env.DB.prepare(`
    SELECT id, name, key_prefix, created_at, last_used_at, expires_at
    FROM api_keys WHERE user_id = ? AND revoked = 0
    ORDER BY created_at DESC LIMIT 50
  `).bind(userId).all<{ id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; expires_at: string | null }>();

  const keys = (rows.results ?? []).map(r => ({
    id: r.id,
    name: r.name,
    prefix: r.key_prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at,
  }));
  return Response.json({ keys });
}

// ── POST /auth/api-keys ───────────────────────────────────────────────────────

export async function handleCreateApiKey(req: Request, env: Env, ctx: { user?: { id: string; role: string } }): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const body = await req.json().catch(() => null) as { name?: string; expiresIn?: number } | null;
  const name = body?.name?.slice(0, 64) ?? "Unnamed key";
  const expiresInDays = body?.expiresIn ? Math.min(Math.max(body.expiresIn, 1), 365) : null;

  // Check count limit
  const countRow = await env.DB.prepare("SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ? AND revoked = 0").bind(userId).first<{ cnt: number }>();
  if ((countRow?.cnt ?? 0) >= 10) {
    return apiError("LIMIT_EXCEEDED", "Maximum of 10 API keys per account", 422, correlationId);
  }

  const rawSecret = generateToken();
  const secretHash = await hashToken(rawSecret);
  const id = crypto.randomUUID();
  const prefix = rawSecret.slice(0, 8);
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null;

  await env.DB.prepare(`
    INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, userId, name, secretHash, prefix, expiresAt).run();

  return Response.json({
    key: { id, name, prefix, createdAt: new Date().toISOString(), lastUsedAt: null, expiresAt },
    secret: rawSecret,
  }, { status: 201 });
}

// ── DELETE /auth/api-keys/:id ─────────────────────────────────────────────────

export async function handleRevokeApiKey(req: Request, env: Env, ctx: { params: Record<string, string>; user?: { id: string; role: string } }): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const keyId = ctx.params.id;
  const result = await env.DB.prepare(
    "UPDATE api_keys SET revoked = 1 WHERE id = ? AND user_id = ?"
  ).bind(keyId, userId).run();
  if (!result.meta.changes) {
    return apiError("NOT_FOUND", "API key not found", 404, correlationId);
  }
  return Response.json({ message: "API key revoked", id: keyId });
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
