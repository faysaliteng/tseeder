/**
 * Crypto Payment Gateway Handlers
 *
 * Public routes:
 *   GET  /crypto/wallets          — list enabled coins + addresses
 *   POST /crypto/orders           — create a payment order (authenticated)
 *   GET  /crypto/orders/:id       — poll order status (authenticated)
 *
 * Admin routes:
 *   GET  /admin/crypto/wallets    — list all wallet configs
 *   POST /admin/crypto/wallets    — set wallet address for a coin
 *   GET  /admin/crypto/orders     — list all orders with filters
 *   POST /admin/crypto/orders/:id/confirm — manually confirm an order
 */

import type { Env } from "../index";
import { apiError } from "./auth";
import { writeAuditLog } from "../d1-helpers";

type Ctx = { params: Record<string, string>; query: Record<string, string>; user?: { id: string; role: string; email?: string } };

const VALID_COINS = ["BTC", "USDT", "USDT-TRC20", "USDT-SOL", "USDT-POLYGON", "LTC", "BNB"];
const ORDER_EXPIRY_MINUTES = 30;

// ── Coin symbol mapping ───────────────────────────────────────────────────────
const COIN_TICKERS: Record<string, string> = {
  BTC: "BTC",
  USDT: "USDT",
  "USDT-TRC20": "USDT",
  "USDT-SOL": "USDT",
  "USDT-POLYGON": "USDT",
  LTC: "LTC",
  BNB: "BNB",
};

const CMC_API_KEY = "0b653f3ddc594101bdf445fac7dd9149";

async function fetchCryptoPrice(coin: string): Promise<number> {
  const ticker = COIN_TICKERS[coin];
  if (!ticker) throw new Error(`Unknown coin: ${coin}`);

  // Stablecoins — hardcode to $1
  if (ticker === "USDT") return 1;

  // CoinMarketCap API
  const resp = await fetch(
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${ticker}&convert=USD`,
    {
      headers: {
        "X-CMC_PRO_API_KEY": CMC_API_KEY,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) throw new Error(`CoinMarketCap API error: ${resp.status}`);
  const data = await resp.json<any>();
  const price = data?.data?.[ticker]?.quote?.USD?.price;
  if (!price || price <= 0) throw new Error(`Invalid price for ${coin}`);
  return price;
}

// ── GET /crypto/wallets ───────────────────────────────────────────────────────

export async function handleGetCryptoWallets(_req: Request, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    "SELECT coin, address, network, is_active FROM crypto_wallets WHERE is_active = 1"
  ).all<{ coin: string; address: string; network: string; is_active: number }>();

  return Response.json({ wallets: rows.results });
}

// ── POST /crypto/orders ───────────────────────────────────────────────────────

export async function handleCreateCryptoOrder(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;

  const body = await req.json().catch(() => null) as { planName?: string; coin?: string } | null;
  if (!body?.planName || !body?.coin) {
    return apiError("VALIDATION_ERROR", "planName and coin are required", 400, correlationId);
  }

  const coin = body.coin.toUpperCase();
  if (!VALID_COINS.includes(coin)) {
    return apiError("VALIDATION_ERROR", `Invalid coin. Must be one of: ${VALID_COINS.join(", ")}`, 400, correlationId);
  }

  // Get wallet
  const wallet = await env.DB.prepare(
    "SELECT address, network FROM crypto_wallets WHERE coin = ? AND is_active = 1"
  ).bind(coin).first<{ address: string; network: string }>();

  if (!wallet) {
    return apiError("CRYPTO_UNAVAILABLE", `No active wallet configured for ${coin}`, 400, correlationId);
  }

  // Get plan price
  const priceRow = await env.DB.prepare(
    "SELECT price_usd FROM crypto_prices WHERE plan_name = ?"
  ).bind(body.planName.toLowerCase()).first<{ price_usd: number }>();

  // Fallback to plans table price_cents
  let priceUsd: number;
  if (priceRow) {
    priceUsd = priceRow.price_usd;
  } else {
    const plan = await env.DB.prepare(
      "SELECT price_cents FROM plans WHERE name = ? LIMIT 1"
    ).bind(body.planName.toLowerCase()).first<{ price_cents: number }>();
    if (!plan || plan.price_cents <= 0) {
      return apiError("BILLING_PLAN_NOT_FOUND", `No price configured for plan: ${body.planName}`, 400, correlationId);
    }
    priceUsd = plan.price_cents / 100;
  }

  // Fetch live crypto price
  let cryptoPrice: number;
  try {
    cryptoPrice = await fetchCryptoPrice(coin);
  } catch (err) {
    return apiError("PRICE_FETCH_FAILED", `Could not fetch ${coin} price: ${(err as Error).message}`, 503, correlationId);
  }

  const amountCrypto = parseFloat((priceUsd / cryptoPrice).toFixed(8));
  const orderId = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60_000).toISOString();

  await env.DB.prepare(`
    INSERT INTO crypto_orders (id, user_id, plan_name, coin, network, wallet_address, amount_usd, amount_crypto, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(orderId, userId, body.planName.toLowerCase(), coin, wallet.network, wallet.address, priceUsd, amountCrypto, expiresAt).run();

  await writeAuditLog(env.DB, {
    actorId: userId, action: "crypto.order_created",
    targetType: "crypto_order", targetId: orderId,
    metadata: { coin, amountUsd: priceUsd, amountCrypto, planName: body.planName },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  const order = await env.DB.prepare("SELECT * FROM crypto_orders WHERE id = ?").bind(orderId).first();

  return Response.json({ order }, { status: 201 });
}

// ── GET /crypto/orders/:id ────────────────────────────────────────────────────

export async function handleGetCryptoOrder(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const userId = ctx.user!.id;
  const orderId = ctx.params.id;

  const order = await env.DB.prepare(
    "SELECT * FROM crypto_orders WHERE id = ? AND user_id = ?"
  ).bind(orderId, userId).first();

  if (!order) {
    return apiError("NOT_FOUND", "Order not found", 404, correlationId);
  }

  // Check if expired
  if (order.status === "pending" && new Date(order.expires_at as string) < new Date()) {
    await env.DB.prepare(
      "UPDATE crypto_orders SET status = 'expired', updated_at = datetime('now') WHERE id = ?"
    ).bind(orderId).run();
    (order as any).status = "expired";
  }

  return Response.json({ order });
}

// ── Admin: GET /admin/crypto/wallets ──────────────────────────────────────────

export async function handleAdminListCryptoWallets(_req: Request, env: Env): Promise<Response> {
  const rows = await env.DB.prepare("SELECT * FROM crypto_wallets").all();
  return Response.json({ wallets: rows.results });
}

// ── Admin: POST /admin/crypto/wallets ─────────────────────────────────────────

export async function handleAdminSetCryptoWallet(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const body = await req.json().catch(() => null) as { coin?: string; address?: string; network?: string } | null;

  if (!body?.coin || !body?.address) {
    return apiError("VALIDATION_ERROR", "coin and address are required", 400, correlationId);
  }

  const coin = body.coin.toUpperCase();
  if (!VALID_COINS.includes(coin)) {
    return apiError("VALIDATION_ERROR", `Invalid coin. Must be one of: ${VALID_COINS.join(", ")}`, 400, correlationId);
  }

  // Basic address validation
  if (body.address.length < 20 || body.address.length > 100) {
    return apiError("VALIDATION_ERROR", "Invalid wallet address length", 400, correlationId);
  }

  await env.DB.prepare(`
    INSERT INTO crypto_wallets (coin, address, network, is_active, updated_by, updated_at)
    VALUES (?, ?, ?, 1, ?, datetime('now'))
    ON CONFLICT(coin) DO UPDATE SET
      address = excluded.address,
      network = excluded.network,
      is_active = 1,
      updated_by = excluded.updated_by,
      updated_at = datetime('now')
  `).bind(coin, body.address.trim(), body.network ?? "", ctx.user!.id).run();

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "crypto.wallet_updated",
    targetType: "crypto_wallet", targetId: coin,
    metadata: { address: body.address.trim(), network: body.network },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ message: `Wallet for ${coin} updated`, coin });
}

// ── Admin: GET /admin/crypto/orders ───────────────────────────────────────────

export async function handleAdminListCryptoOrders(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const status = ctx.query.status;
  const page = parseInt(ctx.query.page ?? "1");
  const limit = Math.min(parseInt(ctx.query.limit ?? "50"), 100);
  const offset = (page - 1) * limit;

  let where = "1=1";
  const bindings: any[] = [];

  if (status) {
    where += " AND status = ?";
    bindings.push(status);
  }

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(`SELECT * FROM crypto_orders WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM crypto_orders WHERE ${where}`)
      .bind(...bindings).first<{ cnt: number }>(),
  ]);

  return Response.json({
    orders: rows.results,
    meta: { page, limit, total: countRow?.cnt ?? 0, totalPages: Math.ceil((countRow?.cnt ?? 0) / limit) },
  });
}

// ── Admin: POST /admin/crypto/orders/:id/confirm ──────────────────────────────

export async function handleAdminConfirmCryptoOrder(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const correlationId = req.headers.get("X-Correlation-ID") ?? crypto.randomUUID();
  const orderId = ctx.params.id;
  const body = await req.json().catch(() => null) as { reason?: string } | null;

  if (!body?.reason || body.reason.length < 10) {
    return apiError("VALIDATION_ERROR", "Reason is required (min 10 characters)", 400, correlationId);
  }

  const order = await env.DB.prepare("SELECT * FROM crypto_orders WHERE id = ?").bind(orderId).first<{
    id: string; user_id: string; plan_name: string; status: string;
  }>();

  if (!order) return apiError("NOT_FOUND", "Order not found", 404, correlationId);
  if (order.status === "confirmed") return apiError("ALREADY_CONFIRMED", "Order already confirmed", 400, correlationId);

  // Update order status
  await env.DB.prepare(`
    UPDATE crypto_orders SET status = 'confirmed', confirmed_at = datetime('now'), confirmed_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(ctx.user!.id, orderId).run();

  // Apply the plan (same logic as Stripe)
  const plan = await env.DB.prepare("SELECT id FROM plans WHERE name = ? LIMIT 1")
    .bind(order.plan_name).first<{ id: string }>();

  if (plan) {
    await env.DB.prepare(`
      INSERT INTO user_plan_assignments (user_id, plan_id)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET plan_id = excluded.plan_id, started_at = datetime('now')
    `).bind(order.user_id, plan.id).run();
  }

  await writeAuditLog(env.DB, {
    actorId: ctx.user!.id, action: "crypto.order_confirmed_manual",
    targetType: "crypto_order", targetId: orderId,
    metadata: { reason: body.reason, userId: order.user_id, planName: order.plan_name },
    ipAddress: req.headers.get("CF-Connecting-IP") ?? undefined,
  });

  return Response.json({ message: "Order confirmed", orderId });
}
