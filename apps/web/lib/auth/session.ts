/**
 * Web session tokens (M6). HS256 JWT signed with SESSION_SECRET, carried in
 * an httpOnly cookie. The browser never sees hosted_token, API_SERVER_KEY,
 * or any *.on.ascii.dev URL (C3/C16) — this cookie maps to user_id only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_COOKIE = "air_session";

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(userId: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    })
  );
  const payload = `${header}.${body}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(parts[2] as string);
  if (expected.length !== actual.length) return undefined;
  if (!timingSafeEqual(expected, actual)) return undefined;
  try {
    const claims = JSON.parse(
      Buffer.from(parts[1] as string, "base64url").toString()
    ) as { sub?: string; exp?: number };
    if (!claims.sub || !claims.exp) return undefined;
    if (claims.exp < Math.floor(Date.now() / 1000)) return undefined;
    return claims.sub;
  } catch {
    return undefined;
  }
}
