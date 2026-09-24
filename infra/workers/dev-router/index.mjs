// air-dev (V13 §7.3): the dev-link router on *.dev.wzrd.tech.
//
// Per request:
//  1. Slug out of the host: <username>-<appname>.dev.wzrd.tech (the same
//     regex the Dispatcher uses). Anything else → 404.
//  2. `x-air-candidate` present → verify against CANDIDATE_SECRET (CF4):
//     valid for this slug and unexpired → target <slug>-draft. Expired or
//     wrong-slug → 404 (a dead candidate serves nothing). Otherwise →
//     target <slug>-dev.
//  3. env.APPS.get(script).fetch(request); a missing script → the branded
//     404 ("this dev link has expired or doesn't exist").
//  4. noindex + Referrer-Policy + no-store on HTML, the Dispatcher's CSP
//     ceiling on everything.
//
// There are no cookies, tokens, KV lookups or Supabase calls on the hot
// path; the manifest read only happens on the candidate branch to prove
// the token's version is the draft being served.
//
// Secret: CANDIDATE_SECRET (shared with air-create, `wrangler secret put`).

const SLUG_RE = /^[a-z0-9_]{2,24}-[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(text) {
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

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/** Verify `<b64url(json)>.<b64url(sig)>` and return {slug, version, exp}. */
async function verifyCandidate(secret, token) {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sigBytes = unb64url(token.slice(dot + 1));
  if (sigBytes === null) return null;
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload))
  );
  if (sigBytes.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= sigBytes[i] ^ expected[i];
  if (diff !== 0) return null;
  const dataBytes = unb64url(payload);
  if (dataBytes === null) return null;
  let claims;
  try {
    claims = JSON.parse(decoder.decode(dataBytes));
  } catch {
    return null;
  }
  if (typeof claims.slug !== "string" || typeof claims.version !== "string") return null;
  const exp = Number(claims.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return null;
  return claims;
}

const CSP =
  "default-src 'self'; img-src 'self' data: https://media.wzrd.tech; " +
  "media-src 'self' https://media.wzrd.tech; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'";

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>dev link</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0b;color:#d4d4d8;font:16px/1.5 ui-sans-serif,system-ui,sans-serif}main{text-align:center;padding:2rem}h1{font-size:1.25rem;font-weight:600;margin:0 0 .5rem}p{margin:0;color:#8b8b93}</style>
</head><body><main><h1>this dev link has expired or doesn't exist</h1><p>ask the owner for a new one</p></main></body></html>`;

function notFound() {
  return new Response(NOT_FOUND_HTML, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
    },
  });
}

function slugFromHost(hostname) {
  if (!hostname.endsWith(".dev.wzrd.tech") && hostname !== "dev.wzrd.tech") return null;
  const slug = hostname === "dev.wzrd.tech" ? "" : hostname.slice(0, -".dev.wzrd.tech".length);
  return SLUG_RE.test(slug) ? slug : null;
}

/**
 * The draft version the signed manifest names, or null. Candidate branch
 * only — the manifest's `draft` is what the job is allowed to load through
 * the `x-air-candidate` header; `dev` is what the bare dev link serves.
 * The manifest payload is base64url(JSON(AppManifest)) + sig.
 */
async function manifestVersion(env, slug, field) {
  if (!env.AIR_MANIFEST) return null;
  const raw = await env.AIR_MANIFEST.get(`app:${slug}`, "text");
  if (!raw) return null;
  try {
    const signed = JSON.parse(raw);
    if (typeof signed.payload !== "string") return null;
    const manifest = JSON.parse(
      decoder.decode(unb64url(signed.payload) ?? new Uint8Array(0))
    );
    const value = manifest?.[field];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = slugFromHost(url.hostname);
    if (slug === null) return notFound();

    let script = `${slug}-dev`;
    const candidate = request.headers.get("x-air-candidate");
    if (candidate !== null) {
      const claims = await verifyCandidate(env.CANDIDATE_SECRET ?? "", candidate);
      if (claims === null || claims.slug !== slug) return notFound();
      const draft = await manifestVersion(env, slug, "draft");
      if (draft === null || draft !== claims.version) return notFound();
      script = `${slug}-draft`;
    } else {
      // Dev links are unreachable past their TTL (§7.3) — the manifest's
      // dev_expires_at is the clock, and the cron's manifest null is the
      // revoke. A missing manifest reads as expired, not broken.
      const expiresAt = await manifestVersion(env, slug, "dev_expires_at");
      const expires = expiresAt === null ? 0 : Date.parse(expiresAt);
      if (!Number.isFinite(expires) || expires <= Date.now()) return notFound();
    }

    let upstream;
    try {
      upstream = await env.APPS.get(script).fetch(request);
    } catch {
      return notFound();
    }
    if (!upstream) return notFound();

    const headers = new Headers(upstream.headers);
    headers.set("x-robots-tag", "noindex, nofollow");
    headers.set("referrer-policy", "no-referrer");
    headers.set("content-security-policy", headers.get("content-security-policy") ?? CSP);
    if ((headers.get("content-type") ?? "").includes("text/html")) {
      headers.set("cache-control", "no-store");
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
};
