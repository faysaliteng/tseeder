/**
 * R2 multipart upload using S3-compatible API with real AWS SigV4 signing.
 *
 * Uses @aws-sdk/signature-v4 + @aws-crypto/sha256-js — both are pure JS and
 * run in Bun/Node without native bindings.
 */

import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { logger } from "./logger";

const PART_SIZE = 5 * 1024 * 1024; // 5 MB minimum for S3 multipart

// ─── SigV4 implementation ─────────────────────────────────────────────────────

interface SigV4Creds {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

function hmacSha256(key: crypto.BinaryLike | crypto.KeyObject, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256("AWS4" + secretKey, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

async function buildSigV4Headers(
  method: string,
  url: URL,
  body: Buffer,
  creds: { accessKeyId: string; secretAccessKey: string },
  contentType: string,
  region = "auto",
  service = "s3",
): Promise<Headers> {
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]/g, "").slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";

  const payloadHash = body.length > 0 ? sha256Hex(body) : sha256Hex(Buffer.alloc(0));

  const headers: Record<string, string> = {
    "host": url.host,
    "content-type": contentType,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };

  // Canonical headers (sorted by key)
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = sortedKeys.join(";");

  // Canonical query string (sorted by parameter)
  const queryParams = [...url.searchParams.entries()]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort()
    .join("&");

  const canonicalUri = url.pathname || "/";

  const canonicalRequest = [
    method,
    canonicalUri,
    queryParams,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest)),
  ].join("\n");

  const signingKey = getSigningKey(creds.secretAccessKey, dateStamp, region, service);
  const signature = hmacSha256(signingKey, stringToSign).toString("hex");

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  const h = new Headers();
  h.set("Host", url.host);
  h.set("Content-Type", contentType);
  h.set("x-amz-date", amzDate);
  h.set("x-amz-content-sha256", payloadHash);
  h.set("Authorization", authorization);
  return h;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function uploadToR2(localPath: string, r2Key: string): Promise<void> {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 upload configuration missing. Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.",
    );
  }

  const creds: SigV4Creds = { endpoint, bucket, accessKeyId, secretAccessKey };
  const fileSize = fs.statSync(localPath).size;

  if (fileSize < PART_SIZE) {
    await singleUpload(localPath, r2Key, fileSize, creds);
  } else {
    await multipartUpload(localPath, r2Key, fileSize, creds);
  }
}

// ─── Single-part upload ───────────────────────────────────────────────────────

async function singleUpload(
  localPath: string,
  key: string,
  fileSize: number,
  creds: SigV4Creds,
): Promise<void> {
  const body = fs.readFileSync(localPath);
  const url = new URL(`${creds.endpoint}/${creds.bucket}/${key}`);
  const headers = await buildSigV4Headers("PUT", url, body, creds, "application/octet-stream");
  headers.set("Content-Length", String(fileSize));

  const response = await fetch(url.toString(), { method: "PUT", headers, body });
  if (!response.ok) {
    const text = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`R2 single upload failed: ${response.status} ${text}`);
  }
  logger.info({ key, size: body.length }, "R2 single upload complete");
}

// ─── Multipart upload ─────────────────────────────────────────────────────────

async function multipartUpload(
  localPath: string,
  key: string,
  fileSize: number,
  creds: SigV4Creds,
): Promise<void> {
  const baseUrl = `${creds.endpoint}/${creds.bucket}/${key}`;

  // 1. Initiate
  const initUrl = new URL(`${baseUrl}?uploads`);
  const initHeaders = await buildSigV4Headers("POST", initUrl, Buffer.alloc(0), creds, "application/octet-stream");
  const initRes = await fetch(initUrl.toString(), { method: "POST", headers: initHeaders });
  if (!initRes.ok) throw new Error(`Initiate multipart failed: ${initRes.status}`);

  const initXml = await initRes.text();
  const uploadId = initXml.match(/<UploadId>(.+?)<\/UploadId>/)?.[1];
  if (!uploadId) throw new Error("Could not extract UploadId from CreateMultipartUpload response");

  // 2. Upload parts
  const fd = fs.openSync(localPath, "r");
  const parts: { PartNumber: number; ETag: string }[] = [];
  let partNumber = 1;
  let offset = 0;

  try {
    while (offset < fileSize) {
      const chunkSize = Math.min(PART_SIZE, fileSize - offset);
      const chunk = Buffer.alloc(chunkSize);
      fs.readSync(fd, chunk, 0, chunkSize, offset);

      const partUrl = new URL(`${baseUrl}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`);
      const partHeaders = await buildSigV4Headers("PUT", partUrl, chunk, creds, "application/octet-stream");
      partHeaders.set("Content-Length", String(chunkSize));

      const partRes = await fetch(partUrl.toString(), { method: "PUT", headers: partHeaders, body: chunk });
      if (!partRes.ok) {
        const text = await partRes.text().catch(() => `HTTP ${partRes.status}`);
        throw new Error(`Part ${partNumber} upload failed: ${partRes.status} ${text}`);
      }

      const etag = partRes.headers.get("ETag") ?? "";
      parts.push({ PartNumber: partNumber, ETag: etag.replace(/"/g, "") });

      logger.info({ key, partNumber, chunkSize, offset }, "R2 part uploaded");
      offset += chunkSize;
      partNumber++;
    }
  } finally {
    fs.closeSync(fd);
  }

  // 3. Complete
  const completeXml = `<CompleteMultipartUpload>${
    parts.map(p => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`).join("")
  }</CompleteMultipartUpload>`;

  const completeBody = Buffer.from(completeXml);
  const completeUrl = new URL(`${baseUrl}?uploadId=${encodeURIComponent(uploadId)}`);
  const completeHeaders = await buildSigV4Headers("POST", completeUrl, completeBody, creds, "application/xml");
  completeHeaders.set("Content-Length", String(completeBody.length));

  const completeRes = await fetch(completeUrl.toString(), {
    method: "POST",
    headers: completeHeaders,
    body: completeBody,
  });

  if (!completeRes.ok) {
    const text = await completeRes.text().catch(() => `HTTP ${completeRes.status}`);
    throw new Error(`Complete multipart failed: ${completeRes.status} ${text}`);
  }

  logger.info({ key, parts: parts.length, totalBytes: fileSize }, "R2 multipart upload complete");
}
