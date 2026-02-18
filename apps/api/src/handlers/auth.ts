import type { Env } from "../index";
import { RegisterRequestSchema, LoginRequestSchema, ResetRequestSchema } from "@rdm/shared";

// POST /auth/register
export async function handleRegister(req: Request, env: Env): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = RegisterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { email, password, turnstileToken } = parsed.data;

  // TODO: Verify Turnstile token
  // const turnstileOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, req.headers.get("CF-Connecting-IP"));
  // if (!turnstileOk) return Response.json({ error: "Bot check failed" }, { status: 400 });

  // TODO: Hash password (Argon2id or bcrypt via WASM)
  // const passwordHash = await hashPassword(password);

  // TODO: Insert user into D1
  // const userId = crypto.randomUUID();
  // try {
  //   await env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
  //     .bind(userId, email.toLowerCase(), passwordHash).run();
  // } catch (e: any) {
  //   if (e.message?.includes("UNIQUE")) return Response.json({ error: "Email already registered" }, { status: 409 });
  //   throw e;
  // }

  // TODO: Send email verification token
  // TODO: Assign free plan

  return Response.json({ message: "Registration successful. Please verify your email." }, { status: 201 });
}

// POST /auth/login
export async function handleLogin(req: Request, env: Env): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // TODO: Fetch user + verify password
  // const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email.toLowerCase()).first();
  // if (!user || !await verifyPassword(password, user.password_hash as string)) {
  //   return Response.json({ error: "Invalid credentials" }, { status: 401 });
  // }
  // if (!user.email_verified) return Response.json({ error: "Email not verified" }, { status: 403 });
  // if (user.suspended) return Response.json({ error: "Account suspended" }, { status: 403 });

  // TODO: Create session in D1
  // const token = crypto.randomUUID() + crypto.randomUUID();
  // const tokenHash = await sha256(token);
  // const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  // await env.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
  //   .bind(crypto.randomUUID(), user.id, tokenHash, expiresAt).run();

  const sessionToken = "dev-token"; // TODO: replace with real token

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie",
    `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 3600}`);

  return new Response(JSON.stringify({ message: "Logged in" }), { status: 200, headers });
}

// POST /auth/logout
export async function handleLogout(req: Request, env: Env): Promise<Response> {
  // TODO: Invalidate session in D1

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  return new Response(JSON.stringify({ message: "Logged out" }), { status: 200, headers });
}

// POST /auth/reset
export async function handleReset(req: Request, env: Env): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = ResetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed" }, { status: 400 });
  }

  // TODO: Generate reset token, send email
  // Always return 200 to avoid email enumeration
  return Response.json({ message: "If that email is registered, a reset link has been sent." });
}

// POST /auth/verify-email
export async function handleVerifyEmail(req: Request, env: Env): Promise<Response> {
  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (!token) return Response.json({ error: "Token required" }, { status: 400 });

  // TODO: Validate token, mark user email_verified = 1 in D1

  return Response.json({ message: "Email verified successfully." });
}
