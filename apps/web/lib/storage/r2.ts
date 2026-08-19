/**
 * MA4 public media lane: S3-compatible client for the platform R2 bucket
 * (air-media, public read via media.wzrd.tech). Credentials are server-side
 * only (C2-adjacent): they never enter a per-box env, a browser response, or
 * a log line. No SDK dependency — SigV4 is implemented directly against the
 * Cloudflare R2 S3 endpoint.
 *
 * Key layout:
 *   u/<username>/…            per-user public media (user_buckets prefix)
 *   apps/<slug>/<version>/…   published mini-app bundles (MA3)
 *   _platform/…               store-owned assets (OG images etc.)
 */
import { createHash, createHmac } from "node:crypto";
import { env } from "../env";

export class R2Error extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "R2Error";
    this.status = status;
  }
}

interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function r2Configured(): boolean {
  return Boolean(
    env.r2AccountId() && env.r2AccessKeyId() && env.r2SecretAccessKey()
  );
}

function credentials(): R2Credentials {
  const accountId = env.r2AccountId();
  const accessKeyId = env.r2AccessKeyId();
  const secretAccessKey = env.r2SecretAccessKey();
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new R2Error(503, "public media storage is not configured");
  }
  return { accountId, accessKeyId, secretAccessKey };
}

function endpointHost(creds: R2Credentials): string {
  return `${creds.accountId}.r2.cloudflarestorage.com`;
}

/** Public, logged-out URL for a stored key (media.wzrd.tech custom domain). */
export function publicUrl(key: string): string {
  const base = env.r2PublicBaseUrl().replace(/\/$/, "");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

const REGION = "auto";
const SERVICE = "s3";

function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function amzDate(now: Date): { date: string; stamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { date: iso, stamp: iso.slice(0, 8) };
}

function signingKey(secret: string, stamp: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, stamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function canonicalQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(
      ([name, value]) =>
        `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
    )
    .join("&");
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

function signRequest(
  method: string,
  key: string,
  options?: {
    query?: Record<string, string>;
    body?: Buffer;
    contentType?: string;
  }
): SignedRequest {
  const creds = credentials();
  const host = endpointHost(creds);
  const bucket = env.r2Bucket();
  const path = `/${bucket}/${encodeKey(key)}`;
  const { date, stamp } = amzDate(new Date());
  const payloadHash = sha256Hex(options?.body ?? Buffer.alloc(0));
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date,
    ...(options?.contentType ? { "content-type": options.contentType } : {}),
  };
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name]}\n`)
    .join("");
  const query = canonicalQuery(options?.query ?? {});
  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaderNames.join(";"),
    payloadHash,
  ].join("\n");
  const scope = `${stamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    date,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac(
    "sha256",
    signingKey(creds.secretAccessKey, stamp)
  )
    .update(stringToSign)
    .digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`;
  const requestHeaders: Record<string, string> = { ...headers };
  delete requestHeaders.host;
  requestHeaders.authorization = authorization;
  return {
    url: `https://${host}${path}${query ? `?${query}` : ""}`,
    headers: requestHeaders,
  };
}

/**
 * Presigned PUT (query-string SigV4): lets an owner surface upload one object
 * directly without the credentials ever leaving the server. The URL pins the
 * content type; TTL is short.
 */
export function presignPut(
  key: string,
  contentType: string,
  ttlSeconds = 600
): string {
  const creds = credentials();
  const host = endpointHost(creds);
  const bucket = env.r2Bucket();
  const path = `/${bucket}/${encodeKey(key)}`;
  const { date, stamp } = amzDate(new Date());
  const scope = `${stamp}/${REGION}/${SERVICE}/aws4_request`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${creds.accessKeyId}/${scope}`,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(ttlSeconds),
    "X-Amz-SignedHeaders": "content-type;host",
  };
  const canonical = canonicalQuery(query);
  const canonicalRequest = [
    "PUT",
    path,
    canonical,
    `content-type:${contentType}\nhost:${host}\n`,
    "content-type;host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    date,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac(
    "sha256",
    signingKey(creds.secretAccessKey, stamp)
  )
    .update(stringToSign)
    .digest("hex");
  return `https://${host}${path}?${canonical}&X-Amz-Signature=${signature}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const signed = signRequest("PUT", key, { body, contentType });
  const response = await fetch(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body: new Uint8Array(body),
  });
  if (!response.ok) {
    throw new R2Error(response.status, `r2 put failed: ${response.status}`);
  }
}

export async function getObject(
  key: string
): Promise<{ body: Buffer; contentType: string } | null> {
  const signed = signRequest("GET", key);
  const response = await fetch(signed.url, { headers: signed.headers });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new R2Error(response.status, `r2 get failed: ${response.status}`);
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType:
      response.headers.get("content-type") ?? "application/octet-stream",
  };
}

/** HEAD for usage accounting after a presigned upload. Null when absent. */
export async function headObject(
  key: string
): Promise<{ sizeBytes: number; contentType: string } | null> {
  const signed = signRequest("HEAD", key);
  const response = await fetch(signed.url, {
    method: "HEAD",
    headers: signed.headers,
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new R2Error(response.status, `r2 head failed: ${response.status}`);
  }
  return {
    sizeBytes: Number(response.headers.get("content-length") ?? "0"),
    contentType:
      response.headers.get("content-type") ?? "application/octet-stream",
  };
}

export async function deleteObject(key: string): Promise<void> {
  const signed = signRequest("DELETE", key);
  const response = await fetch(signed.url, {
    method: "DELETE",
    headers: signed.headers,
  });
  if (!response.ok && response.status !== 404) {
    throw new R2Error(response.status, `r2 delete failed: ${response.status}`);
  }
}

/** List object keys under a prefix (paged; bounded by maxKeys). */
export async function listKeys(
  prefix: string,
  maxKeys = 1000
): Promise<string[]> {
  const creds = credentials();
  const host = endpointHost(creds);
  const bucket = env.r2Bucket();
  const keys: string[] = [];
  let token: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const query: Record<string, string> = {
      "list-type": "2",
      prefix,
      "max-keys": String(Math.min(maxKeys - keys.length, 1000)),
      ...(token ? { "continuation-token": token } : {}),
    };
    const { date, stamp } = amzDate(new Date());
    const payloadHash = sha256Hex(Buffer.alloc(0));
    const path = `/${bucket}`;
    const canonical = canonicalQuery(query);
    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": date,
    };
    const signedNames = Object.keys(headers).sort();
    const canonicalRequest = [
      "GET",
      path,
      canonical,
      signedNames.map((name) => `${name}:${headers[name]}\n`).join(""),
      signedNames.join(";"),
      payloadHash,
    ].join("\n");
    const scope = `${stamp}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      date,
      scope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const signature = createHmac(
      "sha256",
      signingKey(creds.secretAccessKey, stamp)
    )
      .update(stringToSign)
      .digest("hex");
    const response = await fetch(`https://${host}${path}?${canonical}`, {
      headers: {
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": date,
        authorization:
          `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, ` +
          `SignedHeaders=${signedNames.join(";")}, Signature=${signature}`,
      },
    });
    if (!response.ok) {
      throw new R2Error(response.status, `r2 list failed: ${response.status}`);
    }
    const xml = await response.text();
    for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
      keys.push(
        (match[1] ?? "")
          .replaceAll("&amp;", "&")
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">")
          .replaceAll("&quot;", '"')
          .replaceAll("&#39;", "'")
      );
    }
    if (keys.length >= maxKeys) break;
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    if (!truncated) break;
    const tokenMatch = xml.match(
      /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/
    );
    if (!tokenMatch) break;
    token = tokenMatch[1];
  }
  return keys;
}

/** Delete everything under a prefix (deletion cascade, MA4). */
export async function deletePrefix(prefix: string): Promise<number> {
  let removed = 0;
  for (let page = 0; page < 100; page += 1) {
    const keys = await listKeys(prefix, 500);
    if (keys.length === 0) break;
    for (const key of keys) {
      await deleteObject(key);
      removed += 1;
    }
    if (keys.length < 500) break;
  }
  return removed;
}
