/**
 * V11 §6.4 app tokens (CR2): the loader on the mini origin runs the gate
 * chain, then hands the visitor to `<slug>.apps.wzrd.tech` with a 60-second
 * token bound to (app, principal, role, resource, jti). The Dispatcher
 * verifies it under APP_ORIGIN_SIGNING_KEY — a key the mini-origin token
 * family never uses, so neither origin can mint the other's tokens.
 *
 * Wire format matches lib/miniapps/tokens.ts (`base64url(json).base64url(mac)`)
 * so the Worker-side verifier (infra/workers/dispatcher) is a few lines of
 * WebCrypto. Runtime tokens — the per-app credential the Outbound Worker
 * injects toward the gateway (§11.3) — are minted here too: random, hashed
 * at rest in miniapp_runtime_tokens, never shown twice.
 */
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "../env";

export type AppRole = "owner" | "guest" | "anon" | "agent";

export const APP_TOKEN_TTL_SECONDS = 60;

export interface AppTokenClaims {
  /** Registry slug; equals the dispatch script name (CR10). */
  app: string;
  /** Pseudonymous principal (lib/functions/identity.ts) — never a user id (CR9). */
  principal: string;
  role: AppRole;
  resource: string;
  jti: string;
  exp: number;
  /** Present only on owner previews of the draft Worker (CR13). */
  draft?: true;
}

export function appOriginConfigured(): boolean {
  return env.appOriginSigningKey() !== null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * Mint an app token. Returns null when the app-origin lane is unconfigured
 * so callers fall back to the legacy mini-origin render.
 */
export function mintAppToken(
  claims: Omit<AppTokenClaims, "jti" | "exp">
): string | null {
  const key = env.appOriginSigningKey();
  if (!key) return null;
  if (!claims.app || !claims.principal || !claims.resource) return null;
  const full: AppTokenClaims = {
    ...claims,
    jti: randomBytes(12).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + APP_TOKEN_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  console.log(
    JSON.stringify({
      msg: "app token minted",
      app: full.app,
      role: full.role,
      jti: full.jti,
      draft: full.draft === true,
    })
  );
  return `${payload}.${sign(payload, key)}`;
}

/** Verify an app token for `app` (the Dispatcher mirrors this in the Worker). */
export function verifyAppToken(
  token: string,
  app: string,
  now = Math.floor(Date.now() / 1000)
): AppTokenClaims | null {
  const key = env.appOriginSigningKey();
  if (!key) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload, key));
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) {
    return null;
  }
  let claims: AppTokenClaims;
  try {
    claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as AppTokenClaims;
  } catch {
    return null;
  }
  if (claims.app !== app) return null;
  if (typeof claims.exp !== "number" || claims.exp < now) return null;
  if (claims.exp - now > APP_TOKEN_TTL_SECONDS) return null;
  if (!claims.principal || !claims.jti || !claims.resource) return null;
  if (!["owner", "guest", "anon", "agent"].includes(claims.role)) return null;
  return claims;
}

/** Host-only cookie the Dispatcher sets after exchanging `?t=` (§6.4). */
export const APP_COOKIE_NAME = "__Host-air_app";

/**
 * Runtime token: 32 random bytes, base64url. Only the hash is stored; the
 * secret travels once — control plane → vendor API (`outbound.params`) —
 * and never to the Box, Postgres, or user code (CR6).
 */
export function mintRuntimeToken(): { secret: string; hash: string } {
  const secret = `art_${randomBytes(32).toString("base64url")}`;
  return { secret, hash: hashRuntimeToken(secret) };
}

export function hashRuntimeToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
