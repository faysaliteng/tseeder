/**
 * R2 multipart upload using S3-compatible API
 */

import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { logger } from "./logger";

const PART_SIZE = 5 * 1024 * 1024; // 5 MB minimum for multipart

export async function uploadToR2(localPath: string, r2Key: string): Promise<void> {
  const endpoint = process.env.R2_ENDPOINT!;
  const bucket = process.env.R2_BUCKET!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;

  const fileSize = fs.statSync(localPath).size;

  if (fileSize < PART_SIZE) {
    // Single-part upload
    await singleUpload(localPath, r2Key, { endpoint, bucket, accessKeyId, secretAccessKey });
  } else {
    // Multipart upload
    await multipartUpload(localPath, r2Key, fileSize, { endpoint, bucket, accessKeyId, secretAccessKey });
  }
}

async function singleUpload(
  localPath: string,
  key: string,
  creds: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string },
): Promise<void> {
  const body = fs.readFileSync(localPath);
  const url = `${creds.endpoint}/${creds.bucket}/${key}`;
  const response = await fetchWithSigV4("PUT", url, body, creds);
  if (!response.ok) {
    throw new Error(`R2 single upload failed: ${response.status} ${await response.text()}`);
  }
  logger.info({ key, size: body.length }, "R2 single upload complete");
}

async function multipartUpload(
  localPath: string,
  key: string,
  fileSize: number,
  creds: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string },
): Promise<void> {
  const url = `${creds.endpoint}/${creds.bucket}/${key}`;

  // 1. Initiate multipart upload
  const initRes = await fetchWithSigV4("POST", `${url}?uploads`, Buffer.alloc(0), creds);
  if (!initRes.ok) throw new Error(`Initiate multipart failed: ${initRes.status}`);
  const initXml = await initRes.text();
  const uploadId = initXml.match(/<UploadId>(.+?)<\/UploadId>/)?.[1];
  if (!uploadId) throw new Error("Could not extract UploadId from response");

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

      const partRes = await fetchWithSigV4(
        "PUT",
        `${url}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`,
        chunk,
        creds,
      );

      if (!partRes.ok) throw new Error(`Part ${partNumber} upload failed: ${partRes.status}`);
      const etag = partRes.headers.get("ETag") ?? "";
      parts.push({ PartNumber: partNumber, ETag: etag.replace(/"/g, "") });

      logger.info({ key, partNumber, chunkSize }, "Part uploaded");
      offset += chunkSize;
      partNumber++;
    }
  } finally {
    fs.closeSync(fd);
  }

  // 3. Complete multipart upload
  const completeXml = `<CompleteMultipartUpload>${parts.map(p =>
    `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`
  ).join("")}</CompleteMultipartUpload>`;

  const completeRes = await fetchWithSigV4(
    "POST",
    `${url}?uploadId=${encodeURIComponent(uploadId)}`,
    Buffer.from(completeXml),
    creds,
    "application/xml",
  );

  if (!completeRes.ok) throw new Error(`Complete multipart failed: ${completeRes.status}`);
  logger.info({ key, parts: parts.length }, "R2 multipart upload complete");
}

async function fetchWithSigV4(
  method: string,
  url: string,
  body: Buffer,
  creds: { accessKeyId: string; secretAccessKey: string },
  contentType = "application/octet-stream",
): Promise<Response> {
  const parsed = new URL(url);
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";

  // TODO: Implement full AWS SigV4 signing
  // For production, use @aws-sdk/signature-v4 or aws4 npm package
  // This is a stub — replace with real SigV4 implementation

  const headers = new Headers({
    "Content-Type": contentType,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    // "Authorization": buildSigV4Header(...) — TODO
  });

  return fetch(url, { method, headers, body: body.length > 0 ? body : undefined });
}
