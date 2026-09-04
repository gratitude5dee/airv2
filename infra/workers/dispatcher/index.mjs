// Air Dispatcher (V11 §11.2): the platform Worker on `*.apps.wzrd.tech`.
//
// Per request:
//  1. `/__air/health` and `/__air/csp` are answered here (content-free).
//  2. `?t=<app token>` is exchanged exactly once for the host-only
//     `__Host-air_app` cookie and a 303 to the same path without `?t=` (§6.4).
//     "Once" is enforced by the TOKEN_REPLAY Durable Object, one instance per
//     jti: its storage is single-writer, so two concurrent redemptions of the
//     same token cannot both pass (KV is eventually consistent and cannot
//     promise that). Otherwise the cookie is verified. No cookie → 401 that
//     links back to the mini origin, which re-runs the gate chain.
//  3. The signed manifest `app:<slug>` in AIR_MANIFEST decides: suspended or
//     unpublished → 404 (unless an owner carries `draft`), and which script
//     (`<slug>` or `<slug>-draft`) serves.
//  4. `/api/*` goes to the app's user Worker with every inbound `X-Air-*`
//     stripped and the pseudonymous identity headers set; everything else is
//     the script's static assets.
//  5. Response headers the user code cannot override: the CSP ceiling (CR12),
//     Referrer-Policy, nosniff, cache rules, Report-To → /__air/csp.
//
// The Dispatcher holds one secret (APP_ORIGIN_SIGNING_KEY, mirrored from
// Vercel) and no platform credential. It never talks to Supabase, R2, the Box,
// or the mini origin; suspension reaches it only through the manifest (CR16).

import { DurableObject } from "cloudflare:workers";

const TOKEN_TTL_S = 60;
const COOKIE_TTL_S = 15 * 60;
const COOKIE_NAME = "__Host-air_app";
const MANIFEST_TTL_S = 60;
const ROLES = new Set(["owner", "guest", "anon", "agent"]);

const encoder = new TextEncoder();

/**
 * One instance per token jti. `redeem` is atomic: a Durable Object processes
 * one request at a time and storage reads/writes inside it are not
 * interleaved with other requests, so the first caller gets `true` and every
 * later (or concurrent) caller gets `false`. The instance erases itself once
 * the token could no longer verify anyway.
 */
export class TokenReplay extends DurableObject {
  async redeem(ttlSeconds) {
    if (await this.ctx.storage.get("used")) return false;
    await this.ctx.storage.put("used", 1);
    await this.ctx.storage.setAlarm(Date.now() + ttlSeconds * 2 * 1000);
    return true;
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

async function redeemOnce(env, jti) {
  const stub = env.TOKEN_REPLAY.get(env.TOKEN_REPLAY.idFromName(jti));
  return stub.redeem(TOKEN_TTL_S);
}

function b64urlDecode(text) {
  const pad = "=".repeat((4 - (text.length % 4)) % 4);
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(secret, payload) {
  const key = await hmacKey(secret);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return b64urlEncode(new Uint8Array(mac));
}

async function verify(secret, payload, sig) {
  const key = await hmacKey(secret);
  let mac;
  try {
    mac = b64urlDecode(sig);
  } catch {
    return false;
  }
  return crypto.subtle.verify("HMAC", key, mac, encoder.encode(payload));
}

function decodeClaims(payload) {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  } catch {
    return null;
  }
}

/** Mirrors apps/web/lib/functions/tokens.ts verifyAppToken. */
async function verifyAppToken(secret, token, app, now) {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  if (!(await verify(secret, payload, token.slice(dot + 1)))) return null;
  const claims = decodeClaims(payload);
  if (!claims || claims.app !== app) return null;
  if (typeof claims.exp !== "number" || claims.exp < now) return null;
  if (claims.exp - now > TOKEN_TTL_S) return null;
  if (!claims.principal || !claims.jti || !claims.resource) return null;
  if (!ROLES.has(claims.role)) return null;
  return claims;
}

/** Cookie payload: the token's claims re-signed with a 15-minute exp and a
 *  `c` kind so an app token can never be replayed as a cookie or vice versa. */
async function mintCookie(secret, claims, now) {
  const body = {
    k: "c",
    app: claims.app,
    principal: claims.principal,
    role: claims.role,
    resource: claims.resource,
    exp: now + COOKIE_TTL_S,
    ...(claims.draft === true ? { draft: true } : {}),
  };
  const payload = b64urlEncode(encoder.encode(JSON.stringify(body)));
  return `${payload}.${await sign(secret, payload)}`;
}

async function verifyCookie(secret, value, app, now) {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  if (!(await verify(secret, payload, value.slice(dot + 1)))) return null;
  const claims = decodeClaims(payload);
  if (!claims || claims.k !== "c" || claims.app !== app) return null;
  if (typeof claims.exp !== "number" || claims.exp < now) return null;
  if (claims.exp - now > COOKIE_TTL_S) return null;
  if (!ROLES.has(claims.role)) return null;
  return claims;
}

function readCookie(request) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

function setCookie(value) {
  return `${COOKIE_NAME}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_TTL_S}`;
}

async function readManifest(env, slug) {
  const raw = await env.AIR_MANIFEST.get(`app:${slug}`, {
    cacheTtl: MANIFEST_TTL_S,
  });
  if (!raw) return null;
  let signed;
  try {
    signed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof signed?.payload !== "string" || typeof signed?.sig !== "string") {
    return null;
  }
  if (!(await verify(env.APP_ORIGIN_SIGNING_KEY, signed.payload, signed.sig))) {
    return null;
  }
  const manifest = decodeClaims(signed.payload);
  return manifest && manifest.slug === slug ? manifest : null;
}

function slugFromHost(request, env) {
  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const suffix = `.${env.APPS_ORIGIN_SUFFIX}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return /^[a-z0-9_]{2,24}-[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug)
    ? slug
    : null;
}

function csp(env) {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://media.wzrd.tech data:",
    "connect-src 'self'",
    "font-src 'self'",
    "media-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    `frame-ancestors ${env.MINI_ORIGIN} ${env.APP_ORIGIN}`,
    "report-to air-csp",
  ].join("; ");
}

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

function finalize(response, env, url) {
  const headers = new Headers(response.headers);
  headers.set("content-security-policy", csp(env));
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set(
    "report-to",
    JSON.stringify({
      group: "air-csp",
      max_age: 86400,
      endpoints: [{ url: `${url.origin}/__air/csp` }],
    })
  );
  const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");
  headers.set("cache-control", isApi ? "no-store" : "public, max-age=60");
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith("x-air-")) headers.delete(name);
  }
  return new Response(response.body, { status: response.status, headers });
}

function miniUrl(env, slug) {
  const dash = slug.indexOf("-");
  return `${env.MINI_ORIGIN}/${slug.slice(0, dash)}/${slug.slice(dash + 1)}`;
}

function unauthorized(env, slug) {
  const back = miniUrl(env, slug);
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Open from Air</title><p style="font:16px -apple-system,system-ui;padding:2rem">` +
      `This link has expired. <a href="${back}">Open it again</a>.</p>`,
    {
      status: 401,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/__air/health") {
      return json({ ok: true }, 200);
    }
    if (url.pathname === "/__air/csp") {
      // Content-free: count only. The body is dropped unread (CR12 telemetry).
      if (request.method === "POST" && env.CSP_COUNTS) {
        const slug = slugFromHost(request, env) ?? "unknown";
        const day = new Date().toISOString().slice(0, 10);
        const key = `csp:${slug}:${day}`;
        ctx.waitUntil(
          env.CSP_COUNTS.get(key)
            .then((n) =>
              env.CSP_COUNTS.put(key, String((Number(n) || 0) + 1), {
                expirationTtl: 3 * 86400,
              })
            )
            .catch(() => undefined)
        );
      }
      return new Response(null, { status: 204 });
    }

    const slug = slugFromHost(request, env);
    if (!slug) return json({ error: "unknown_app" }, 404);
    const now = Math.floor(Date.now() / 1000);

    // (2) token exchange — exactly once, then the address bar loses ?t=.
    const t = url.searchParams.get("t");
    if (t) {
      const claims = await verifyAppToken(env.APP_ORIGIN_SIGNING_KEY, t, slug, now);
      if (!claims) return unauthorized(env, slug);
      if (!(await redeemOnce(env, claims.jti))) return unauthorized(env, slug);
      url.searchParams.delete("t");
      return new Response(null, {
        status: 303,
        headers: {
          location: url.pathname + url.search,
          "set-cookie": setCookie(
            await mintCookie(env.APP_ORIGIN_SIGNING_KEY, claims, now)
          ),
          "referrer-policy": "no-referrer",
          "cache-control": "no-store",
        },
      });
    }

    const cookie = readCookie(request);
    const session = cookie
      ? await verifyCookie(env.APP_ORIGIN_SIGNING_KEY, cookie, slug, now)
      : null;
    if (!session) return unauthorized(env, slug);

    // (3) manifest: suspension and the live/draft pointer.
    const manifest = await readManifest(env, slug);
    if (!manifest || manifest.status === "suspended") {
      return json({ error: "not_found" }, 404);
    }
    const wantsDraft = session.draft === true && session.role === "owner";
    if (manifest.status !== "published" && !wantsDraft) {
      return json({ error: "not_found" }, 404);
    }
    const version = wantsDraft ? manifest.draft : manifest.live;
    if (!version) return json({ error: "not_found" }, 404);
    const script = wantsDraft ? `${slug}-draft` : slug;

    const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");
    if (isApi) {
      if (env.CREATE_FUNCTIONS_ENABLED !== "1") {
        return finalize(json({ error: "functions_disabled" }, 503), env, url);
      }
      if (!manifest.functions) {
        return finalize(json({ error: "no_functions" }, 404), env, url);
      }
    }

    // (4) forward with pseudonymous identity only (CR9).
    const headers = new Headers(request.headers);
    for (const name of [...headers.keys()]) {
      if (name.toLowerCase().startsWith("x-air-")) headers.delete(name);
    }
    headers.delete("cookie");
    headers.set("X-Air-App", slug);
    headers.set("X-Air-Principal", session.principal);
    headers.set("X-Air-Role", session.role);
    headers.set("X-Air-Resource", session.resource);
    headers.set("X-Air-Version", version);
    const forwarded = new Request(url.toString(), {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "manual",
    });

    let worker;
    try {
      worker = env.DISPATCHER.get(
        script,
        {},
        {
          limits: { cpuMs: Number(env.CPU_MS ?? 50), subRequests: 20 },
          outbound: {
            app: slug,
            owner_ref: manifest.owner_ref,
            role: session.role,
          },
        }
      );
    } catch {
      return finalize(json({ error: "not_found" }, 404), env, url);
    }

    let response;
    try {
      response = await worker.fetch(forwarded);
    } catch (error) {
      const message = String(error?.message ?? error);
      if (/not found|no such worker/i.test(message)) {
        return finalize(json({ error: "not_found" }, 404), env, url);
      }
      const requestId = crypto.randomUUID();
      console.log(JSON.stringify({ msg: "user worker error", app: slug, request_id: requestId }));
      return finalize(
        json({ error: "app_error", app: slug, request_id: requestId }, 502),
        env,
        url
      );
    }

    // Sliding cookie: every authenticated response refreshes the 15 minutes.
    const out = finalize(response, env, url);
    out.headers.append(
      "set-cookie",
      setCookie(await mintCookie(env.APP_ORIGIN_SIGNING_KEY, session, now))
    );
    return out;
  },
};
