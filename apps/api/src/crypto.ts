/**
 * Cryptographic helpers using the Web Crypto API (SubtleCrypto)
 * Compatible with Cloudflare Workers — no native modules required
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 32;
const KEY_BYTES = 32;

// ── Password Hashing (PBKDF2-SHA256) ────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_BYTES * 8,
  );
  const saltHex = uint8ToHex(salt);
  const hashHex = uint8ToHex(new Uint8Array(derived));
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = parseInt(parts[1]);
  const salt = hexToUint8(parts[2]);
  const expectedHash = parts[3];

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_BYTES * 8,
  );
  const hashHex = uint8ToHex(new Uint8Array(derived));

  // Constant-time comparison to avoid timing attacks
  return timingSafeEqual(hashHex, expectedHash);
}

// ── Token Generation ──────────────────────────────────────────────────────────

export function generateToken(): string {
  return uint8ToHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return uint8ToHex(new Uint8Array(buf));
}

// ── HMAC-SHA256 ───────────────────────────────────────────────────────────────

export async function signHmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return uint8ToHex(new Uint8Array(sig));
}

export async function verifyHmac(payload: string, secret: string, expectedSig: string): Promise<boolean> {
  const actual = await signHmac(payload, secret);
  return timingSafeEqual(actual, expectedSig);
}

/** Verify agent callback: checks HMAC + timestamp replay window */
export async function verifyCallbackSignature(
  req: Request,
  body: string,
  secret: string,
): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const sig = authHeader.replace("Bearer ", "").trim();
  if (!sig) return false;

  // Also verify timestamp to prevent replay attacks (±5 minutes)
  const tsHeader = req.headers.get("X-Timestamp");
  if (!tsHeader) return false;
  const ts = parseInt(tsHeader, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  // HMAC over body + timestamp
  const payload = `${ts}.${body}`;
  return verifyHmac(payload, secret, sig);
}

// ── CSRF ──────────────────────────────────────────────────────────────────────

export async function generateCsrfToken(sessionId: string, secret: string): Promise<string> {
  const nonce = uint8ToHex(crypto.getRandomValues(new Uint8Array(16)));
  const sig = await signHmac(`csrf:${sessionId}:${nonce}`, secret);
  return `${nonce}.${sig}`;
}

export async function verifyCsrfToken(
  token: string,
  sessionId: string,
  secret: string,
): Promise<boolean> {
  const [nonce, sig] = token.split(".");
  if (!nonce || !sig) return false;
  const expected = await signHmac(`csrf:${sessionId}:${nonce}`, secret);
  return timingSafeEqual(sig, expected);
}

// ── R2 SigV4 ─────────────────────────────────────────────────────────────────

/** Generate an AWS SigV4-compatible signature for R2 presigned URLs */
export async function signS3Request(params: {
  method: string;
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresIn: number; // seconds
  endpoint: string;
}): Promise<string> {
  const { method, bucket, key, region, accessKeyId, secretAccessKey, expiresIn, endpoint } = params;

  const now = new Date();
  const dateStamp = formatDate(now);
  const amzDateTime = formatDateTime(now);

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const credentialParam = `${accessKeyId}/${scope}`;

  // AWS SigV4 requires encoding all chars except A-Z a-z 0-9 - _ . ~
  // encodeURIComponent leaves ! ' ( ) * unencoded — we must encode those too
  const s3Encode = (s: string) =>
    encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

  const encodedKey = key.split("/").map(s3Encode).join("/");

  // Build URL manually to prevent URL constructor from decoding percent-encoded chars
  const baseUrl = `${endpoint}/${bucket}/${encodedKey}`;
  const host = new URL(endpoint).hostname;

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credentialParam,
    "X-Amz-Date": amzDateTime,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalUri = `/${bucket}/${encodedKey}`;
  const canonicalQueryString = Object.entries(queryParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const requestHash = await sha256(canonicalRequest);
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDateTime,
    scope,
    requestHash,
  ].join("\n");

  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region, "s3");
  const signature = await hmacSha256Bytes(signingKey, stringToSign);
  const signatureHex = uint8ToHex(signature);

  // Build final URL with query string
  const qs = canonicalQueryString + `&X-Amz-Signature=${signatureHex}`;
  return `${baseUrl}?${qs}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uint8ToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexToUint8(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return uint8ToHex(new Uint8Array(buf));
}

async function hmacSha256Bytes(key: Uint8Array | ArrayBuffer, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function deriveSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<Uint8Array> {
  let key = await hmacSha256Bytes(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp);
  key = await hmacSha256Bytes(key, region);
  key = await hmacSha256Bytes(key, service);
  key = await hmacSha256Bytes(key, "aws4_request");
  return key;
}

function formatDate(d: Date): string {
  return d.toISOString().replace(/[^0-9]/g, "").slice(0, 8);
}

function formatDateTime(d: Date): string {
  // AWS SigV4 requires format: 20260220T212356Z (with the T separator)
  const iso = d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return iso; // e.g. "20260220T212356Z"
}
