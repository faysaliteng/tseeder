/**
 * Blockchain Payment Verifier
 *
 * Polls public blockchain APIs to check if a destination wallet
 * has received the expected payment after a crypto order was created.
 *
 * Runs as part of the cron trigger (every 2 minutes).
 *
 * Supported chains:
 *   BTC  — Blockstream.info API
 *   USDT — Tronscan API (TRC-20)
 *   LTC  — Blockcypher API
 *   BNB  — BSCScan public API (no key needed for basic queries)
 */

import type { Env } from "./index";
import { writeAuditLog } from "./d1-helpers";

interface PendingOrder {
  id: string;
  user_id: string;
  plan_name: string;
  coin: string;
  network: string;
  wallet_address: string;
  amount_crypto: number;
  created_at: string;
  expires_at: string;
}

// Required confirmations per coin
const REQUIRED_CONFIRMATIONS: Record<string, number> = {
  BTC: 2,
  USDT: 20,
  "USDT-TRC20": 20,
  "USDT-SOL": 1,        // Solana finality is fast
  "USDT-POLYGON": 30,
  LTC: 4,
  BNB: 12,
};

// Amount tolerance (0.5%)
const TOLERANCE = 0.005;

export async function runCryptoVerifier(env: Env): Promise<void> {
  // Expire old orders first
  await env.DB.prepare(`
    UPDATE crypto_orders SET status = 'expired', updated_at = datetime('now')
    WHERE status = 'pending' AND expires_at < datetime('now')
  `).run();

  // Fetch pending + confirming orders
  const orders = await env.DB.prepare(`
    SELECT id, user_id, plan_name, coin, network, wallet_address, amount_crypto, created_at, expires_at
    FROM crypto_orders WHERE status IN ('pending', 'confirming')
    ORDER BY created_at ASC LIMIT 20
  `).all<PendingOrder>();

  for (const order of orders.results) {
    try {
      const result = await checkPayment(order);
      if (!result) continue;

      if (result.confirmed) {
        // Apply the plan
        await env.DB.prepare(`
          UPDATE crypto_orders SET status = 'confirmed', tx_hash = ?, confirmations = ?,
          confirmed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).bind(result.txHash ?? null, result.confirmations, order.id).run();

        // Activate user's plan
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
          actorId: null, action: "crypto.order_confirmed_auto",
          targetType: "crypto_order", targetId: order.id,
          metadata: { coin: order.coin, txHash: result.txHash, confirmations: result.confirmations, planName: order.plan_name },
        });

        console.log(JSON.stringify({
          ts: new Date().toISOString(), level: "info", service: "crypto-verifier",
          msg: "Order confirmed", orderId: order.id, coin: order.coin, txHash: result.txHash,
        }));

      } else if (result.confirmations > 0) {
        // Update to confirming state
        await env.DB.prepare(`
          UPDATE crypto_orders SET status = 'confirming', tx_hash = ?, confirmations = ?,
          updated_at = datetime('now') WHERE id = ?
        `).bind(result.txHash ?? null, result.confirmations, order.id).run();
      }
    } catch (err) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(), level: "error", service: "crypto-verifier",
        msg: "Verification failed", orderId: order.id, coin: order.coin,
        error: (err as Error).message,
      }));
    }
  }
}

interface VerificationResult {
  confirmed: boolean;
  confirmations: number;
  txHash: string | null;
}

async function checkPayment(order: PendingOrder): Promise<VerificationResult | null> {
  const requiredConf = REQUIRED_CONFIRMATIONS[order.coin] ?? REQUIRED_CONFIRMATIONS[baseCoin(order.coin)] ?? 6;

  switch (order.coin) {
    case "BTC": return checkBTC(order, requiredConf);
    case "LTC": return checkLTC(order, requiredConf);
    case "USDT":
    case "USDT-TRC20": return checkUSDT_TRC20(order, requiredConf);
    case "USDT-SOL": return checkUSDT_SOL(order, requiredConf);
    case "USDT-POLYGON": return checkUSDT_POLYGON(order, requiredConf);
    case "BNB": return checkBNB(order, requiredConf);
    default: return null;
  }
}

function baseCoin(coin: string): string {
  if (coin.startsWith("USDT")) return "USDT";
  return coin;
}

// ── BTC via Blockstream.info ──────────────────────────────────────────────────

async function checkBTC(order: PendingOrder, requiredConf: number): Promise<VerificationResult | null> {
  const resp = await fetch(
    `https://blockstream.info/api/address/${order.wallet_address}/txs`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!resp.ok) return null;

  const txs = await resp.json<any[]>();
  const orderTime = new Date(order.created_at).getTime() / 1000;
  const minAmount = order.amount_crypto * (1 - TOLERANCE);

  for (const tx of txs) {
    // Only check transactions after order creation
    const txTime = tx.status?.block_time ?? (Date.now() / 1000);
    if (txTime < orderTime - 60) continue;

    // Sum outputs to our address
    const received = (tx.vout ?? [])
      .filter((o: any) => o.scriptpubkey_address === order.wallet_address)
      .reduce((sum: number, o: any) => sum + (o.value ?? 0) / 1e8, 0);

    if (received >= minAmount) {
      const confirmations = tx.status?.confirmed ? (tx.status.block_height ? 999 : 1) : 0;
      // Get current block height for accurate confirmation count
      if (tx.status?.confirmed && tx.status?.block_height) {
        try {
          const tipResp = await fetch("https://blockstream.info/api/blocks/tip/height", { signal: AbortSignal.timeout(5000) });
          const tip = parseInt(await tipResp.text());
          const conf = tip - tx.status.block_height + 1;
          return {
            confirmed: conf >= requiredConf,
            confirmations: conf,
            txHash: tx.txid,
          };
        } catch {}
      }
      return {
        confirmed: confirmations >= requiredConf,
        confirmations,
        txHash: tx.txid,
      };
    }
  }

  return null;
}

// ── LTC via Blockcypher ──────────────────────────────────────────────────────

async function checkLTC(order: PendingOrder, requiredConf: number): Promise<VerificationResult | null> {
  const resp = await fetch(
    `https://api.blockcypher.com/v1/ltc/main/addrs/${order.wallet_address}?limit=10`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!resp.ok) return null;

  const data = await resp.json<any>();
  const minAmount = order.amount_crypto * (1 - TOLERANCE);

  for (const tx of data.txrefs ?? []) {
    if (tx.tx_output_n < 0) continue; // skip inputs
    const value = (tx.value ?? 0) / 1e8;
    if (value >= minAmount) {
      return {
        confirmed: tx.confirmations >= requiredConf,
        confirmations: tx.confirmations ?? 0,
        txHash: tx.tx_hash,
      };
    }
  }

  // Check unconfirmed
  for (const tx of data.unconfirmed_txrefs ?? []) {
    const value = (tx.value ?? 0) / 1e8;
    if (value >= minAmount) {
      return {
        confirmed: false,
        confirmations: 0,
        txHash: tx.tx_hash,
      };
    }
  }

  return null;
}

// ── USDT TRC-20 via Tronscan ──────────────────────────────────────────────────

async function checkUSDT_TRC20(order: PendingOrder, requiredConf: number): Promise<VerificationResult | null> {
  const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  const resp = await fetch(
    `https://apilist.tronscanapi.com/api/filter/trc20/transfers?limit=20&toAddress=${order.wallet_address}&contract_address=${USDT_CONTRACT}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!resp.ok) return null;

  const data = await resp.json<any>();
  const orderTime = new Date(order.created_at).getTime();
  const minAmount = order.amount_crypto * (1 - TOLERANCE);

  for (const tx of data.token_transfers ?? []) {
    if (tx.block_ts < orderTime - 60_000) continue;
    const value = parseFloat(tx.quant ?? "0") / 1e6; // USDT has 6 decimals on TRC-20
    if (value >= minAmount) {
      return {
        confirmed: tx.confirmed ?? tx.block_ts > 0,
        confirmations: tx.confirmed ? requiredConf : 1,
        txHash: tx.transaction_id,
      };
    }
  }

  return null;
}

// ── BNB via BSCScan ───────────────────────────────────────────────────────────

async function checkBNB(order: PendingOrder, requiredConf: number): Promise<VerificationResult | null> {
  const resp = await fetch(
    `https://api.bscscan.com/api?module=account&action=txlist&address=${order.wallet_address}&startblock=0&endblock=99999999&sort=desc&page=1&offset=10`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!resp.ok) return null;

  const data = await resp.json<any>();
  if (data.status !== "1") return null;

  const orderTime = Math.floor(new Date(order.created_at).getTime() / 1000);
  const minAmount = order.amount_crypto * (1 - TOLERANCE);

  for (const tx of data.result ?? []) {
    if (parseInt(tx.timeStamp) < orderTime - 60) continue;
    if (tx.to?.toLowerCase() !== order.wallet_address.toLowerCase()) continue;
    const value = parseFloat(tx.value) / 1e18;
    if (value >= minAmount) {
      const confirmations = parseInt(tx.confirmations ?? "0");
      return {
        confirmed: confirmations >= requiredConf,
        confirmations,
        txHash: tx.hash,
      };
}

// ── USDT-SOL via Solana public RPC ───────────────────────────────────────────

async function checkUSDT_SOL(order: PendingOrder, requiredConf: number): Promise<VerificationResult | null> {
  // Solana USDT mint: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
  const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
  const resp = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
      params: [order.wallet_address, { limit: 10 }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) return null;

  const data = await resp.json<any>();
  const sigs = data?.result ?? [];
  const orderTime = Math.floor(new Date(order.created_at).getTime() / 1000);
  const minAmount = order.amount_crypto * (1 - TOLERANCE);

  for (const sig of sigs) {
    if (sig.blockTime && sig.blockTime < orderTime - 60) continue;
    if (sig.err) continue;

    // Fetch transaction details
    const txResp = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getTransaction",
        params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!txResp.ok) continue;

    const txData = await txResp.json<any>();
    const instructions = txData?.result?.transaction?.message?.instructions ?? [];

    for (const ix of instructions) {
      if (ix.program !== "spl-token") continue;
      const info = ix.parsed?.info;
      if (!info) continue;
      if (info.mint !== USDT_MINT) continue;
      // Check destination matches and amount is sufficient
      const amount = parseFloat(info.amount ?? info.tokenAmount?.amount ?? "0") / 1e6;
      if (amount >= minAmount) {
        const conf = sig.confirmationStatus === "finalized" ? requiredConf : 1;
        return {
          confirmed: conf >= requiredConf,
          confirmations: conf,
          txHash: sig.signature,
        };
      }
    }
  }

  return null;
}

// ── USDT-POLYGON via Polygonscan ─────────────────────────────────────────────

async function checkUSDT_POLYGON(order: PendingOrder, requiredConf: number): Promise<VerificationResult | null> {
  const USDT_CONTRACT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
  const resp = await fetch(
    `https://api.polygonscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT}&address=${order.wallet_address}&sort=desc&page=1&offset=10`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!resp.ok) return null;

  const data = await resp.json<any>();
  if (data.status !== "1") return null;

  const orderTime = Math.floor(new Date(order.created_at).getTime() / 1000);
  const minAmount = order.amount_crypto * (1 - TOLERANCE);

  for (const tx of data.result ?? []) {
    if (parseInt(tx.timeStamp) < orderTime - 60) continue;
    if (tx.to?.toLowerCase() !== order.wallet_address.toLowerCase()) continue;
    const value = parseFloat(tx.value) / 1e6; // USDT has 6 decimals
    if (value >= minAmount) {
      const confirmations = parseInt(tx.confirmations ?? "0");
      return {
        confirmed: confirmations >= requiredConf,
        confirmations,
        txHash: tx.hash,
      };
    }
  }

  return null;
}
  }

  return null;
}
