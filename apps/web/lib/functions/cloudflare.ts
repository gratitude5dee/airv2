/**
 * V11 §7 (1): the only module that talks to the Cloudflare API for Workers
 * for Platforms. It owns CLOUDFLARE_API_TOKEN — scoped to the `air-apps`
 * dispatch namespace, the manifest KV namespace, and D1 — and nothing else
 * reads it (CR6, C18). The Box never holds this token; a user Worker never
 * holds anything.
 *
 * Surface (all under /accounts/{account_id}):
 *   workers/dispatch/namespaces/{ns}/scripts                          GET
 *   workers/dispatch/namespaces/{ns}/scripts/{script}                 PUT/DELETE
 *   workers/dispatch/namespaces/{ns}/scripts/{script}/secrets         PUT
 *   workers/dispatch/namespaces/{ns}/scripts/{script}/secrets/{name}  DELETE
 *   workers/dispatch/namespaces/{ns}/scripts/{script}/assets-upload-session  POST
 *   workers/assets/upload?base64=true                                 POST (jwt)
 *   storage/kv/namespaces/{kv}/values/{key}                           GET/PUT/DELETE
 *   d1/database                                                       POST
 *   storage/kv/namespaces                                             POST
 *
 * Every call is server-side, retried once on 5xx, and reports a typed
 * CloudflareError. When the credentials are absent the lane reports itself
 * unconfigured and callers stay on the legacy R2 lane.
 */
import { createHash } from "node:crypto";
import { env } from "../env";

export class CloudflareError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CloudflareError";
    this.status = status;
  }
}

interface Credentials {
  accountId: string;
  apiToken: string;
}

export function cloudflareConfigured(): boolean {
  return Boolean(env.cloudflareAccountId() && env.cloudflareApiToken());
}

function credentials(): Credentials {
  const accountId = env.cloudflareAccountId();
  const apiToken = env.cloudflareApiToken();
  if (!accountId || !apiToken) {
    throw new CloudflareError(503, "workers platform is not configured");
  }
  return { accountId, apiToken };
}

const API = "https://api.cloudflare.com/client/v4";

interface ApiEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
}

async function call<T>(
  path: string,
  init: RequestInit & { token?: string } = {}
): Promise<T> {
  const creds = credentials();
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Authorization", `Bearer ${token ?? creds.apiToken}`);
  const url = `${API}/accounts/${creds.accountId}/${path}`;
  let response = await fetch(url, { ...rest, headers });
  if (response.status >= 500) {
    response = await fetch(url, { ...rest, headers });
  }
  const text = await response.text();
  let body: ApiEnvelope<T> | null = null;
  try {
    body = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    body = null;
  }
  if (!response.ok || !body || body.success === false) {
    const detail =
      body?.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ??
      text.slice(0, 200);
    throw new CloudflareError(
      response.status,
      `cloudflare ${rest.method ?? "GET"} ${path} failed: ${detail}`
    );
  }
  return body.result;
}

// ── Dispatch namespace scripts ──────────────────────────────────────────────

export type ScriptBinding =
  | { type: "assets"; name: "ASSETS" }
  | { type: "d1"; name: "DB"; id: string }
  | { type: "kv_namespace"; name: "KV"; namespace_id: string }
  | { type: "secret_text"; name: string; text: string }
  | { type: "plain_text"; name: string; text: string };

export interface ScriptModule {
  name: string;
  content: string;
  type: "application/javascript+module" | "text/javascript";
}

export interface ScriptUpload {
  script: string;
  mainModule: string;
  modules: ScriptModule[];
  bindings: ScriptBinding[];
  tags: string[];
  compatibilityDate: string;
  limits: { cpu_ms: number; subrequests: number };
  /**
   * Carry the script's existing `secret_text` bindings (owner secrets set
   * through the secrets endpoint) across this upload; the control plane
   * never holds their values so it cannot restate them (§11.4).
   */
  keepSecrets?: boolean;
  /** Completion token from the assets upload; omitted for Functions-only scripts. */
  assetsJwt?: string;
  assetsConfig?: {
    html_handling: "auto-trailing-slash" | "none";
    not_found_handling: "single-page-application" | "404-page" | "none";
  };
}

/**
 * Upload (create or replace) a user Worker in the dispatch namespace. The
 * digest returned is over the module sources + metadata, recorded as
 * miniapp_versions.worker_sha256 (CR10).
 */
export async function putDispatchScript(
  upload: ScriptUpload
): Promise<{ digest: string }> {
  const metadata: Record<string, unknown> = {
    main_module: upload.mainModule,
    compatibility_date: upload.compatibilityDate,
    bindings: upload.bindings,
    tags: upload.tags,
    limits: upload.limits,
    ...(upload.keepSecrets ? { keep_bindings: ["secret_text"] } : {}),
    ...(upload.assetsJwt
      ? {
          assets: {
            jwt: upload.assetsJwt,
            config: upload.assetsConfig ?? {
              html_handling: "auto-trailing-slash",
              not_found_handling: "none",
            },
          },
        }
      : {}),
  };
  const form = new FormData();
  form.set(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  for (const mod of upload.modules) {
    form.set(mod.name, new Blob([mod.content], { type: mod.type }), mod.name);
  }
  await call(
    `workers/dispatch/namespaces/${env.cfDispatchNamespace()}/scripts/${encodeURIComponent(upload.script)}`,
    { method: "PUT", body: form }
  );
  return { digest: scriptDigest(upload) };
}

export function scriptDigest(upload: ScriptUpload): string {
  const hash = createHash("sha256");
  for (const mod of [...upload.modules].sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    hash.update(mod.name).update("\0").update(mod.content).update("\0");
  }
  hash.update(
    JSON.stringify({
      main: upload.mainModule,
      compat: upload.compatibilityDate,
      bindings: upload.bindings.map((b) =>
        b.type === "secret_text" ? { type: b.type, name: b.name } : b
      ),
      limits: upload.limits,
    })
  );
  return hash.digest("hex");
}

/** Names of every script in the dispatch namespace: the vendor-side inventory. */
export async function listDispatchScripts(): Promise<string[]> {
  const result = await call<Array<{ id: string }>>(
    `workers/dispatch/namespaces/${env.cfDispatchNamespace()}/scripts`
  );
  return result.map((script) => script.id);
}

export async function deleteDispatchScript(script: string): Promise<void> {
  try {
    await call(
      `workers/dispatch/namespaces/${env.cfDispatchNamespace()}/scripts/${encodeURIComponent(script)}?force=true`,
      { method: "DELETE" }
    );
  } catch (error) {
    if (error instanceof CloudflareError && error.status === 404) return;
    throw error;
  }
}

/**
 * Set one owner secret on a dispatch script (§11.4). The value goes to
 * Cloudflare and nowhere else — never logged, never persisted here.
 * `false` when the script does not exist yet (the binding lands once the
 * owner re-enters the value after that target's first deploy).
 */
export async function putDispatchScriptSecret(
  script: string,
  name: string,
  text: string
): Promise<boolean> {
  try {
    await call(
      `workers/dispatch/namespaces/${env.cfDispatchNamespace()}/scripts/${encodeURIComponent(script)}/secrets`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, text, type: "secret_text" }),
      }
    );
    return true;
  } catch (error) {
    if (error instanceof CloudflareError && error.status === 404) return false;
    throw error;
  }
}

export async function deleteDispatchScriptSecret(
  script: string,
  name: string
): Promise<void> {
  try {
    await call(
      `workers/dispatch/namespaces/${env.cfDispatchNamespace()}/scripts/${encodeURIComponent(script)}/secrets/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );
  } catch (error) {
    if (error instanceof CloudflareError && error.status === 404) return;
    throw error;
  }
}

// ── Static assets ───────────────────────────────────────────────────────────

export interface AssetFile {
  /** Leading-slash path inside the bundle, e.g. `/index.html`. */
  path: string;
  bytes: Buffer;
  contentType: string;
}

/**
 * Manifest hash: the vendor wants 32 hex chars per file. Salting with the
 * owner id keeps identical files from being cross-tenant deduplicated in a
 * way that would reveal one publisher's content to another (§11.1).
 */
export function assetHash(bytes: Buffer, salt: string): string {
  return createHash("sha256")
    .update(salt)
    .update("\0")
    .update(bytes)
    .digest("hex")
    .slice(0, 32);
}

interface UploadSession {
  jwt: string;
  buckets?: string[][];
}

/**
 * Two-step assets upload: open a session with the manifest, upload the
 * buckets the vendor asks for (base64 multipart), and receive the completion
 * token to attach to the script upload. Returns null jwt only when every
 * file is already present (vendor returns no buckets).
 */
export async function uploadAssets(
  script: string,
  files: AssetFile[],
  salt: string
): Promise<{ jwt: string; manifest: Record<string, { hash: string; size: number }> }> {
  const manifest: Record<string, { hash: string; size: number }> = {};
  const byHash = new Map<string, AssetFile>();
  for (const file of files) {
    const hash = assetHash(file.bytes, salt);
    manifest[file.path] = { hash, size: file.bytes.length };
    byHash.set(hash, file);
  }
  const session = await call<UploadSession>(
    `workers/dispatch/namespaces/${env.cfDispatchNamespace()}/scripts/${encodeURIComponent(script)}/assets-upload-session`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest }),
    }
  );
  let completion = session.jwt;
  for (const bucket of session.buckets ?? []) {
    const form = new FormData();
    for (const hash of bucket) {
      const file = byHash.get(hash);
      if (!file) continue;
      form.set(
        hash,
        new Blob([file.bytes.toString("base64")], { type: file.contentType }),
        hash
      );
    }
    const result = await call<{ jwt?: string }>(
      "workers/assets/upload?base64=true",
      { method: "POST", body: form, token: session.jwt }
    );
    if (result.jwt) completion = result.jwt;
  }
  return { jwt: completion, manifest };
}

// ── KV manifest ─────────────────────────────────────────────────────────────

function manifestKv(): string {
  const id = env.cfManifestKvId();
  if (!id) throw new CloudflareError(503, "manifest KV is not configured");
  return id;
}

/**
 * The Outbound Worker's own KV (§11.3): runtime tokens live here under an
 * opaque reference and nowhere a user Worker or the Dispatcher can read.
 */
function runtimeKv(): string {
  const id = env.cfRuntimeKvId();
  if (!id) throw new CloudflareError(503, "runtime KV is not configured");
  return id;
}

export function runtimeKvConfigured(): boolean {
  return Boolean(env.cfRuntimeKvId());
}

export async function putRuntimeKvValue(key: string, value: string): Promise<void> {
  await call(
    `storage/kv/namespaces/${runtimeKv()}/values/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: value,
    }
  );
}

export async function deleteRuntimeKvValue(key: string): Promise<void> {
  try {
    await call(
      `storage/kv/namespaces/${runtimeKv()}/values/${encodeURIComponent(key)}`,
      { method: "DELETE" }
    );
  } catch (error) {
    if (error instanceof CloudflareError && error.status === 404) return;
    throw error;
  }
}

export async function putKvValue(key: string, value: string): Promise<void> {
  await call(
    `storage/kv/namespaces/${manifestKv()}/values/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: value,
    }
  );
}

/** Raw KV value (the GET endpoint returns the value, not an envelope); null when unset. */
export async function getKvValue(key: string): Promise<string | null> {
  const creds = credentials();
  const url =
    `${API}/accounts/${creds.accountId}/storage/kv/namespaces/${manifestKv()}` +
    `/values/${encodeURIComponent(key)}`;
  const headers = { Authorization: `Bearer ${creds.apiToken}` };
  let response = await fetch(url, { headers });
  if (response.status >= 500) {
    response = await fetch(url, { headers });
  }
  if (response.status === 404) return null;
  const text = await response.text();
  if (!response.ok) {
    throw new CloudflareError(
      response.status,
      `cloudflare GET kv ${key} failed: ${text.slice(0, 200)}`
    );
  }
  return text;
}

export async function deleteKvValue(key: string): Promise<void> {
  try {
    await call(
      `storage/kv/namespaces/${manifestKv()}/values/${encodeURIComponent(key)}`,
      { method: "DELETE" }
    );
  } catch (error) {
    if (error instanceof CloudflareError && error.status === 404) return;
    throw error;
  }
}

// ── Per-app resources (Functions, §11.1) ────────────────────────────────────

export async function createD1Database(name: string): Promise<{ uuid: string }> {
  return call<{ uuid: string }>("d1/database", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

/** The D1 database with exactly this name, if one exists (`?name=` is a search). */
export async function findD1Database(name: string): Promise<string | null> {
  const rows = await call<Array<{ uuid: string; name: string }>>(
    `d1/database?name=${encodeURIComponent(name)}&per_page=100`
  );
  return rows.find((row) => row.name === name)?.uuid ?? null;
}

export async function deleteD1Database(uuid: string): Promise<void> {
  try {
    await call(`d1/database/${encodeURIComponent(uuid)}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof CloudflareError && error.status === 404) return;
    throw error;
  }
}

export async function createKvNamespace(title: string): Promise<{ id: string }> {
  return call<{ id: string }>("storage/kv/namespaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

/** The KV namespace titled exactly this, if one exists (the list has no name filter). */
export async function findKvNamespace(title: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const rows = await call<Array<{ id: string; title: string }>>(
      `storage/kv/namespaces?per_page=100&page=${page}&order=title&direction=asc`
    );
    const hit = rows.find((row) => row.title === title);
    if (hit) return hit.id;
    if (rows.length < 100) return null;
  }
  return null;
}

export async function deleteKvNamespace(id: string): Promise<void> {
  try {
    await call(`storage/kv/namespaces/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (error instanceof CloudflareError && error.status === 404) return;
    throw error;
  }
}

/** One GET through the Dispatcher's health path after a deploy (§11.6). */
export async function dispatcherHealthy(): Promise<boolean> {
  try {
    const response = await fetch(env.cfDispatchHealthUrl(), {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
