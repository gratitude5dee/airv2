/**
 * V13 CF1 — the signed bridge between `air-create` and the Vercel adapter.
 * Same construction on both ends (this file is the worker mirror of
 * `apps/web/lib/create/bridge.ts`):
 *
 *   x-air-sig = hex HMAC-SHA256(secret, "<ts>.<method>.<path>.<sha256(body)>")
 *   x-air-ts  = unix seconds, within ±300 s
 *
 * And the signed tokens the same secret family mints for smaller doors:
 * `<b64url(payload json)>.<b64url(hmac(payload))>` — used for candidate
 * checks (CF4) and live tokens. Nothing in either scheme carries content.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const BRIDGE_TS_HEADER = "x-air-ts";
export const BRIDGE_SIG_HEADER = "x-air-sig";
export const BRIDGE_TOLERANCE_S = 300;

export function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unb64url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The exact string the signature covers. Path is path+search, no host. */
export async function bridgePayload(
  ts: string,
  method: string,
  path: string,
  body: string
): Promise<string> {
  return `${ts}.${method.toUpperCase()}.${path}.${await sha256Hex(body)}`;
}

/** Sign an outbound adapter request. */
export async function bridgeSign(
  secret: string,
  method: string,
  path: string,
  body: string,
  now = Date.now()
): Promise<{ ts: string; sig: string }> {
  const ts = Math.floor(now / 1000).toString();
  return { ts, sig: await hmacHex(secret, await bridgePayload(ts, method, path, body)) };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify an inbound CF1 request. `true` = signed and fresh; `false` =
 * presented but wrong; `null` = no signature headers at all (unsigned means
 * the lane was never configured → the route answers 503; wrong or stale is
 * 401, logged content-free).
 */
export async function verifyBridgeRequest(
  headers: Headers,
  method: string,
  path: string,
  body: string,
  secret: string | undefined,
  now = Date.now()
): Promise<boolean | null> {
  const ts = headers.get(BRIDGE_TS_HEADER);
  const sig = headers.get(BRIDGE_SIG_HEADER);
  if (ts === null && sig === null) return null;
  if (ts === null || sig === null || secret === undefined || secret === "") return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(now / 1000 - tsNum) > BRIDGE_TOLERANCE_S) {
    return false;
  }
  const expected = await hmacHex(secret, await bridgePayload(ts, method, path, body));
  return timingSafeEqual(expected, sig.toLowerCase());
}

/** Mint `b64url(payload).b64url(sig)` for a small door (candidate, live). */
export async function mintSignedToken(
  secret: string,
  claims: Record<string, string | number>
): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify(claims)));
  const sig = b64url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload))
    )
  );
  return `${payload}.${sig}`;
}

/**
 * Verify a signed token: signature, `exp` (unix seconds), and that every
 * `claims` entry equals the payload's value. Null on any failure.
 */
export async function verifySignedToken(
  secret: string,
  token: string,
  claims: Record<string, string | number> = {},
  now = Date.now()
): Promise<Record<string, unknown> | null> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const sigBytes = unb64url(sig);
  if (sigBytes === null) return null;
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload))
  );
  if (sigBytes.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= sigBytes[i]! ^ expected[i]!;
  if (diff !== 0) return null;
  const dataBytes = unb64url(payload);
  if (dataBytes === null) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(decoder.decode(dataBytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const exp = Number(parsed["exp"]);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null;
  for (const [key, value] of Object.entries(claims)) {
    if (parsed[key] !== value) return null;
  }
  return parsed;
}
