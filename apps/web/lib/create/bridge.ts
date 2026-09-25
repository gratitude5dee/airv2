/**
 * V13 CF1 — the signed bridge between Vercel (`apps/web`) and Cloudflare
 * (the `air-create` Worker). Every call in either direction carries
 * `x-air-ts` (unix seconds) and `x-air-sig` =
 * HMAC-SHA256(CREATE_BRIDGE_SECRET, `${ts}.${METHOD}.${path}.${sha256(body)}`),
 * hex-encoded. Unsigned, stale (± CREATE_BRIDGE_TOLERANCE_S) or wrong-shape
 * requests get 401 and are logged content-free.
 *
 * `bridgePost` signs outbound calls to `CREATE_JOBS_ORIGIN`;
 * `requireBridgeAuth` guards the `/api/internal/create/*` adapter routes the
 * Workflow calls back into. Both sides compute the same digest — the path is
 * the request path only (`/v1/jobs/<id>/events`), never the origin.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

export const BRIDGE_TS_HEADER = "x-air-ts";
export const BRIDGE_SIG_HEADER = "x-air-sig";
export const BRIDGE_TOLERANCE_S = 300;

function sha256Hex(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/** The exact string both sides sign — kept identical to the Worker's copy. */
export function bridgePayload(ts: string, method: string, path: string, body: string): string {
  return `${ts}.${method.toUpperCase()}.${path}.${sha256Hex(body)}`;
}

export function bridgeSign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function hexEqual(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) {
    return false;
  }
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Verify an inbound bridge request. `path` must be the route path as the
 * signer knew it (the Next.js pathname — search params never signed).
 * Returns null when the secret is unset (lane unconfigured → caller 503s),
 * false on a bad/missing/stale signature, true when verified.
 */
export function verifyBridgeRequest(
  headers: Headers,
  method: string,
  path: string,
  body: string,
  now = Date.now()
): boolean | null {
  const secret = env.createBridgeSecret();
  if (!secret) return null;
  const ts = headers.get(BRIDGE_TS_HEADER) ?? "";
  const sig = headers.get(BRIDGE_SIG_HEADER) ?? "";
  const tsNum = Number(ts);
  if (!ts || !sig || !Number.isFinite(tsNum)) return false;
  if (Math.abs(now / 1000 - tsNum) > BRIDGE_TOLERANCE_S) return false;
  const expected = bridgeSign(secret, bridgePayload(ts, method, path, body));
  return hexEqual(expected, sig);
}

/** A nonce lives twice the signature window, so a signature old enough to
 * replay is already out of tolerance and safe to evict. */
const NONCE_TTL_MS = 2 * BRIDGE_TOLERANCE_S * 1000;

export type NonceClaim = "claimed" | "replay" | "unavailable";

/**
 * R-SEC-04: claim a verified signature in the nonce table
 * (`create_bridge_nonces`, migration 0128) with insert-on-conflict-do-
 * nothing. The same request arriving twice inside the tolerance window is
 * a replay — the caller answers 409. The signature itself is the nonce:
 * HMAC over ts.METHOD.path.sha256(body), so a replay is byte-identical.
 * Rows past 2x the window are deleted on each claim.
 */
export async function claimBridgeNonce(
  supabase: SupabaseClient,
  sig: string
): Promise<NonceClaim> {
  const cutoff = new Date(Date.now() - NONCE_TTL_MS).toISOString();
  await supabase
    .from("create_bridge_nonces")
    .delete()
    .lt("created_at", cutoff);
  const { data, error } = await supabase
    .from("create_bridge_nonces")
    .upsert({ sig }, { onConflict: "sig", ignoreDuplicates: true })
    .select("sig");
  if (error) {
    console.error(
      JSON.stringify({
        msg: "create bridge nonce claim failed",
        error: error.message,
      })
    );
    return "unavailable";
  }
  return (data?.length ?? 0) > 0 ? "claimed" : "replay";
}

export class BridgeError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "BridgeError";
  }
}

/**
 * POST a JSON body to the `air-create` Worker with a CF1 signature. Throws
 * `BridgeError` 503 when the lane is unconfigured, 502 on a non-2xx answer
 * (the upstream status is carried, content-free).
 */
export async function bridgePost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 15_000
): Promise<T> {
  const secret = env.createBridgeSecret();
  if (!secret) throw new BridgeError("create job lane unavailable", 503);
  const text = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = bridgeSign(secret, bridgePayload(ts, "POST", path, text));
  const res = await fetch(`${env.createJobsOrigin()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [BRIDGE_TS_HEADER]: ts,
      [BRIDGE_SIG_HEADER]: sig,
    },
    body: text,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new BridgeError(`create job call failed (${res.status})`, 502);
  }
  return (await res.json().catch(() => ({}))) as T;
}

/**
 * GET on the job origin (health, job status for the polling fallback relay).
 * Same signature over an empty body.
 */
export async function bridgeGet<T = unknown>(path: string, timeoutMs = 15_000): Promise<T> {
  const secret = env.createBridgeSecret();
  if (!secret) throw new BridgeError("create job lane unavailable", 503);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = bridgeSign(secret, bridgePayload(ts, "GET", path, ""));
  const res = await fetch(`${env.createJobsOrigin()}${path}`, {
    headers: { [BRIDGE_TS_HEADER]: ts, [BRIDGE_SIG_HEADER]: sig },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new BridgeError(`create job call failed (${res.status})`, 502);
  }
  return (await res.json().catch(() => ({}))) as T;
}

/** Token format: `b64url(payload-json).b64url(hmac-sha256(payload, secret))`. */
export function mintSignedToken(secret: string, payload: Record<string, unknown>): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(data, "utf8").digest("base64url");
  return `${data}.${mac}`;
}

/**
 * Verify a `mintSignedToken` token: HMAC over the payload segment, the
 * required `exp` claim (unix seconds, must be in the future) and any
 * asserted claims. Returns the payload or null. Never throws.
 */
export function verifySignedToken(
  secret: string,
  token: string,
  claims: Record<string, unknown> = {},
  now = Date.now()
): Record<string, unknown> | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(data, "utf8").digest("base64url");
  if (!hexEqual(
    Buffer.from(expected, "utf8").toString("hex"),
    Buffer.from(mac, "utf8").toString("hex")
  )) {
    return null;
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
  const exp = Number(payload["exp"]);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null;
  for (const [key, value] of Object.entries(claims)) {
    if (payload[key] !== value) return null;
  }
  return payload;
}

/**
 * §5.3 — the 10-minute token the progress mini-app trades a store session
 * for; the OwnerRoom verifies the same shape.
 */
export function mintLiveToken(jobId: string, userId: string, ttlS: number): string {
  const secret = env.liveTokenSecret();
  if (!secret) throw new BridgeError("live progress lane unavailable", 503);
  return mintSignedToken(secret, {
    job: jobId,
    user: userId,
    exp: Math.floor(Date.now() / 1000) + ttlS,
  });
}
