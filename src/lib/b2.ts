/**
 * B2 Storage — Native B2 REST API (works with master keys & application keys)
 *
 * Unlike the S3-compatible API, the B2 native API works with ALL key types
 * including master application keys.
 *
 * Used for: uploading images, metadata, and text to Backblaze B2 cloud storage.
 */

import { randomUUID } from "crypto";

const B2_KEY_ID = process.env.B2_KEY_ID || "";
const B2_APP_KEY = process.env.B2_APP_KEY || "";
const B2_BUCKET = process.env.B2_BUCKET || "mediaforge-prod";
const B2_CONFIGURED = !!(B2_KEY_ID && B2_APP_KEY);

// ── Auth cache (re-authorized every 23h) ──
let _auth: {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  expiresAt: number;
} | null = null;

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  accountId: string;
  allowed: { bucketId: string; bucketName: string; capabilities: string[] };
}

async function authorize(): Promise<B2AuthResponse> {
  if (_auth && Date.now() < _auth.expiresAt) {
    return {
      authorizationToken: _auth.authorizationToken,
      apiUrl: _auth.apiUrl,
      downloadUrl: _auth.downloadUrl,
      accountId: "",
      allowed: { bucketId: "", bucketName: "", capabilities: [] },
    };
  }

  const creds = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString("base64");

  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    method: "GET",
    headers: {
      Authorization: `Basic ${creds}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`B2 authorize failed (${res.status}): ${text}`);
  }

  const data: B2AuthResponse = await res.json();

  _auth = {
    authorizationToken: data.authorizationToken,
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000, // 23 hours
  };

  console.log(`[b2] Authorized: bucket=${B2_BUCKET}, apiUrl=${data.apiUrl}`);
  return data;
}

// ── Upload URL cache (per bucket) ──
let _uploadCache: {
  bucketId: string;
  uploadUrl: string;
  authorizationToken: string;
} | null = null;

async function getUploadUrl(apiUrl: string, authToken: string): Promise<{
  bucketId: string;
  uploadUrl: string;
  authorizationToken: string;
}> {
  // Cache the upload URL (valid until used or 24h)
  if (_uploadCache) return _uploadCache;

  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: authToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId: process.env.B2_BUCKET_ID || "" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`B2 get upload URL failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  _uploadCache = {
    bucketId: data.bucketId,
    uploadUrl: data.uploadUrl,
    authorizationToken: data.authorizationToken,
  };

  return _uploadCache;
}

// ── Public API ──

export interface B2UploadResult {
  key: string;
  url: string;
  size: number;
}

export function isB2Configured(): boolean {
  return B2_CONFIGURED;
}

/**
 * Upload a buffer to Backblaze B2 using native B2 API
 */
export async function uploadToB2(
  buffer: Buffer,
  folder: string,
  fileName: string,
  mimeType: string
): Promise<B2UploadResult> {
  if (!B2_CONFIGURED) throw new Error("B2 not configured");

  const auth = await authorize();
  const uploadInfo = await getUploadUrl(auth.apiUrl, auth.authorizationToken);

  const key = `${folder}/${fileName}`;

  // B2 native upload — upload URL is consumed after one use, so clear cache
  _uploadCache = null;

  const res = await fetch(uploadInfo.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: uploadInfo.authorizationToken,
      "Content-Type": mimeType,
      "X-Bz-File-Name": key,
      "X-Bz-Content-Sha1": "do_not_verify",
      "Content-Length": String(buffer.length),
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`B2 upload failed (${res.status}): ${text}`);
  }

  const downloadUrl = `${auth.downloadUrl}/file/${B2_BUCKET}/${key}`;
  console.log(`[b2] Upload success: ${key} (${buffer.length} bytes)`);

  return { key, url: downloadUrl, size: buffer.length };
}

/**
 * Upload metadata JSON to B2
 */
export async function uploadMetadataToB2(
  metadata: Record<string, unknown>
): Promise<B2UploadResult> {
  const id = (metadata.id as string) || randomUUID();
  const key = `metadata/${id}.json`;
  const buffer = Buffer.from(JSON.stringify(metadata, null, 2), "utf-8");

  return uploadToB2(buffer, "metadata", `${id}.json`, "application/json");
}

/**
 * Download a file from B2 via native API (returns buffer)
 */
export async function downloadFromB2(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!B2_CONFIGURED) throw new Error("B2 not configured");

  const auth = await authorize();

  // b2_download_file_by_name uses GET to the download URL
  const res = await fetch(`${auth.downloadUrl}/file/${B2_BUCKET}/${key}`, {
    method: "GET",
    headers: {
      Authorization: auth.authorizationToken,
    },
  });

  if (!res.ok) {
    throw new Error(`B2 download failed (${res.status})`);
  }

  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const contentType = res.headers.get("content-type") || "application/octet-stream";

  return { buffer, contentType };
}

/**
 * Get a download URL for a B2 file
 * Note: B2 native API doesn't support "signed URLs" like S3.
 * For private buckets, files must be served through the API or a proxy.
 */
export async function getB2SignedUrl(key: string): Promise<string> {
  // For private buckets, serve through our /api/serve endpoint
  return `/api/serve?key=${encodeURIComponent(key)}`;
}

/**
 * List files in a B2 folder prefix
 */
export async function listB2Files(prefix: string, maxKeys = 50) {
  if (!B2_CONFIGURED) throw new Error("B2 not configured");

  const auth = await authorize();

  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: process.env.B2_BUCKET_ID || "",
      prefix,
      maxFileCount: maxKeys,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`B2 list failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  return (data.files || []).map((obj: { fileName: string; size: number; uploadTimestamp: number }) => ({
    key: obj.fileName,
    size: obj.size || 0,
    lastModified: obj.uploadTimestamp ? new Date(obj.uploadTimestamp).toISOString() : "",
  }));
}

/**
 * Delete a file from B2
 */
export async function deleteFromB2(key: string) {
  if (!B2_CONFIGURED) throw new Error("B2 not configured");

  const auth = await authorize();

  // Need file ID to delete — get it first via list
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: process.env.B2_BUCKET_ID || "",
      prefix: key,
      maxFileCount: 1,
    }),
  });

  if (!res.ok) return;

  const data = await res.json();
  const file = (data.files || []).find((f: { fileName: string }) => f.fileName === key);
  if (!file?.fileId) return;

  await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileId: file.fileId,
      fileName: key,
    }),
  });

  console.log(`[b2] Deleted: ${key}`);
}