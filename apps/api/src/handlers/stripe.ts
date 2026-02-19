/**
 * Stripe Billing Handler
 *
 * Routes:
 *   POST /billing/checkout         — create Stripe Checkout Session (→ redirect)
 *   POST /billing/portal           — create Stripe Customer Portal session
 *   POST /billing/webhook          — receive + verify Stripe webhook events
 *
 * Requires Worker secrets:
 *   STRIPE_SECRET_KEY       — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET   — whsec_... (from Stripe Dashboard → Webhooks)
 *
 * Env vars (wrangler.toml [vars]):
 *   STRIPE_PUBLISHABLE_KEY  — pk_live_... (exposed to frontend via /billing/config)
 *
 * Plan → Stripe Price ID mapping lives in STRIPE_PRICE_IDS (JSON secret):
 *   {"pro":"price_xxx","business":"price_yyy","enterprise":"price_zzz"}
 */

import type { Env } from "../index";
import { apiError } from "./auth";
import { writeAuditLog } from "../d1-helpers";

type Ctx = { params: Record<string, string>; user?: { id: string; role: string; email?: string } };

// ── Stripe raw API helper ─────────────────────────────────────────────────────

async function stripeRequest<T>(
  secretKey: string,
  method: string,
  path: string,
  body?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const encoded = body
    ? new URLSearchParams(
        Object.entries(body)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : undefined;

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: encoded,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json<any>();
  if (!res.ok) {
    throw new Error(`Stripe API error ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  }
  return data as T;
}

// ── Stripe webhook signature verification ────────────────────────────────────

async function verifyStripeWebhook(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  // Stripe sends: t=timestamp,v1=signature(s)
  const parts = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  // Timing-safe compare
  return crypto.subtle.timingSafeEqual
    ? crypto.subtle.timingSafeEqual(new TextEncoder().encode(computed), new TextEncoder().encode(v1))
    : computed === v1;
}

// ── GET/POST /billing/config ──────────────────────────────────────────────────
// Returns the publishable key (safe to expose) so the frontend can init Stripe.js

export async function handleBillingConfig(_req: Request, env: Env): Promise<Response> {
  const publishableKey = (env as any).STRIPE_PUBLISHABLE_KEY ?? null;
  return Response.json({ publishableKey });
}

// ── POST /billing/checkout ────────────────────────────────────────────────────

export async function handleBillingCheckout(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const secretKey: string | undefined = (env as any).STRIPE_SECRET_KEY;

  if (!secretKey) {
    return apiError("BILLING_UNAVAILABLE", "Billing is not configured on this server", 503, correlationId);
  }

  const userId = ctx.user!.id;
  const userEmail: string = (ctx.user as any).email ?? "";
  const body = await req.json().catch(() => ({})) as { planName?: string; successUrl?: string; cancelUrl?: string };
  const planName = body.planName ?? "pro";
  const appDomain = env.APP_DOMAIN ?? "https://tseeder.cc";
  const successUrl = body.successUrl ?? `${appDomain}/app/settings?billing=success`;
  const cancelUrl = body.cancelUrl ?? `${appDomain}/app/settings?billing=cancelled`;

  // Resolve price ID from JSON secret or hardcoded map
  let priceId: string | undefined;
  try {
    const priceMap = JSON.parse((env as any).STRIPE_PRICE_IDS ?? "{}");
    priceId = priceMap[planName];
  } catch { /* ignore */ }

  if (!priceId) {
    return apiError("BILLING_PLAN_NOT_FOUND", `No Stripe price configured for plan: ${planName}`, 400, correlationId);
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(env.DB, secretKey, userId, userEmail);

  // Create Checkout Session
  const session = await stripeRequest<{ id: string; url: string }>(
    secretKey,
    "POST",
    "/checkout/sessions",
    {
      customer: customerId,
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "subscription_data[metadata][user_id]": userId,
      "subscription_data[metadata][plan_name]": planName,
      "metadata[user_id]": userId,
      "metadata[plan_name]": planName,
    } as any,
  );

  await writeAuditLog(env.DB, {
    actorId: userId, action: "billing.checkout_created",
    targetType: "user", targetId: userId,
    metadata: { planName, sessionId: session.id },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ checkoutUrl: session.url, sessionId: session.id });
}

// ── POST /billing/portal ──────────────────────────────────────────────────────

export async function handleBillingPortal(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const secretKey: string | undefined = (env as any).STRIPE_SECRET_KEY;

  if (!secretKey) {
    return apiError("BILLING_UNAVAILABLE", "Billing is not configured on this server", 503, correlationId);
  }

  const userId = ctx.user!.id;
  const appDomain = env.APP_DOMAIN ?? "https://tseeder.cc";
  const body = await req.json().catch(() => ({})) as { returnUrl?: string };
  const returnUrl = body.returnUrl ?? `${appDomain}/app/settings`;

  const row = await env.DB.prepare(
    "SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ? LIMIT 1",
  ).bind(userId).first<{ stripe_customer_id: string }>();

  if (!row) {
    return apiError("BILLING_NO_CUSTOMER", "No billing account found. Please subscribe first.", 404, correlationId);
  }

  const portal = await stripeRequest<{ url: string }>(
    secretKey,
    "POST",
    "/billing_portal/sessions",
    { customer: row.stripe_customer_id, return_url: returnUrl } as any,
  );

  return Response.json({ portalUrl: portal.url });
}

// ── POST /billing/webhook ─────────────────────────────────────────────────────

export async function handleBillingWebhook(req: Request, env: Env): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const webhookSecret: string | undefined = (env as any).STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error(JSON.stringify({ correlationId, msg: "STRIPE_WEBHOOK_SECRET not set" }));
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  const valid = await verifyStripeWebhook(rawBody, sig, webhookSecret);
  if (!valid) {
    console.warn(JSON.stringify({ correlationId, msg: "Stripe webhook signature verification failed" }));
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { type: string; data: { object: any } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const secretKey: string | undefined = (env as any).STRIPE_SECRET_KEY;
  if (!secretKey) return new Response("Server misconfigured", { status: 500 });

  console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", correlationId, msg: "Stripe webhook", type: event.type }));

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const customerId = session.customer;
      if (userId && customerId) {
        await env.DB.prepare(`
          INSERT INTO stripe_customers (user_id, stripe_customer_id)
          VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id
        `).bind(userId, customerId).run();
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      const planName = sub.metadata?.plan_name ?? "pro";

      if (userId) {
        await upsertSubscription(env.DB, userId, sub);
        await applyPlanByName(env.DB, userId, planName);

        await writeAuditLog(env.DB, {
          actorId: userId, action: `billing.subscription_${event.type === "customer.subscription.created" ? "created" : "updated"}`,
          targetType: "user", targetId: userId,
          metadata: { subscriptionId: sub.id, status: sub.status, planName },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;

      if (userId) {
        await env.DB.prepare(`
          UPDATE stripe_subscriptions SET status = 'canceled', updated_at = datetime('now')
          WHERE stripe_subscription_id = ?
        `).bind(sub.id).run();

        // Revert to free plan
        await applyPlanByName(env.DB, userId, "free");

        await writeAuditLog(env.DB, {
          actorId: userId, action: "billing.subscription_cancelled",
          targetType: "user", targetId: userId,
          metadata: { subscriptionId: sub.id },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = invoice.customer;
      if (customerId) {
        const row = await env.DB.prepare("SELECT user_id FROM stripe_customers WHERE stripe_customer_id = ? LIMIT 1")
          .bind(customerId).first<{ user_id: string }>();
        if (row) {
          await env.DB.prepare(`
            UPDATE stripe_subscriptions SET status = 'past_due', updated_at = datetime('now')
            WHERE user_id = ? AND status = 'active'
          `).bind(row.user_id).run();
        }
      }
      break;
    }

    default:
      // Ignore unknown events — Stripe sends many we don't care about
      break;
  }

  return new Response("ok", { status: 200 });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getOrCreateStripeCustomer(
  db: D1Database,
  secretKey: string,
  userId: string,
  email: string,
): Promise<string> {
  const row = await db.prepare(
    "SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ? LIMIT 1",
  ).bind(userId).first<{ stripe_customer_id: string }>();

  if (row) return row.stripe_customer_id;

  const customer = await stripeRequest<{ id: string }>(secretKey, "POST", "/customers", {
    email,
    metadata: { user_id: userId },
  } as any);

  await db.prepare(
    "INSERT INTO stripe_customers (user_id, stripe_customer_id) VALUES (?, ?)",
  ).bind(userId, customer.id).run();

  return customer.id;
}

async function upsertSubscription(db: D1Database, userId: string, sub: any): Promise<void> {
  const priceId = sub.items?.data?.[0]?.price?.id ?? sub.plan?.id ?? "";
  await db.prepare(`
    INSERT INTO stripe_subscriptions
      (user_id, stripe_subscription_id, stripe_price_id, plan_name, status,
       current_period_start, current_period_end, cancel_at_period_end, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      status                = excluded.status,
      stripe_price_id       = excluded.stripe_price_id,
      plan_name             = excluded.plan_name,
      current_period_start  = excluded.current_period_start,
      current_period_end    = excluded.current_period_end,
      cancel_at_period_end  = excluded.cancel_at_period_end,
      updated_at            = datetime('now')
  `).bind(
    userId, sub.id, priceId,
    sub.metadata?.plan_name ?? "pro",
    sub.status,
    sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
    sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    sub.cancel_at_period_end ? 1 : 0,
  ).run();
}

async function applyPlanByName(db: D1Database, userId: string, planName: string): Promise<void> {
  const plan = await db.prepare(
    "SELECT id FROM plans WHERE name = ? LIMIT 1",
  ).bind(planName.toLowerCase()).first<{ id: string }>();

  if (!plan) {
    console.warn(`applyPlanByName: plan not found in DB: ${planName}`);
    return;
  }

  await db.prepare(`
    INSERT INTO user_plan_assignments (user_id, plan_id)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET plan_id = excluded.plan_id, started_at = datetime('now')
  `).bind(userId, plan.id).run();
}
