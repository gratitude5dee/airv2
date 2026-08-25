/**
 * M7.5 mini-app tokens (C15/C17): signed, scoped, short-TTL. Minted only
 * inside owner-initiated flows — tier-2 senders can never cause a mint. The
 * token binds (user_id, app, resource_id) so a Kanban token is rejected at
 * /todo (path is a routing hint, never an authorization). Tokens are
 * multi-use within their TTL: messaging platforms fetch card URLs to render
 * previews before the user taps, so expiry — not first-use — is the gate.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

export type MiniAppRole = "owner" | "guest";

export interface MiniAppClaims {
  userId: string;
  app: string;
  resourceId: string;
  jti: string;
  exp: number;
  /** Absent on pre-V9 tokens; treated as "owner". */
  role?: MiniAppRole | undefined;
  /** Guest sessions carry the grant they were minted from (MA4). */
  grantId?: string | undefined;
  /** Set when the link was minted for a message card — the app is opening
   *  inside a messaging webview (Messages extension), not a browser. */
  via?: "card" | undefined;
}

function sign(payload: string): string {
  return createHmac("sha256", env.miniappSigningKey())
    .update(payload)
    .digest("base64url");
}

export function mintToken(
  userId: string,
  app: string,
  resourceId: string,
  ttlMinutes = 10,
  extra?: { role?: MiniAppRole | undefined; grantId?: string | undefined; via?: "card" | undefined }
): string {
  const claims: MiniAppClaims = {
    userId,
    app,
    resourceId,
    jti: randomBytes(12).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + ttlMinutes * 60,
    ...(extra ?? {}),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  console.log(
    JSON.stringify({ msg: "miniapp token minted", user_id: userId, app, jti: claims.jti })
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string, app: string): MiniAppClaims | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: MiniAppClaims;
  try {
    claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as MiniAppClaims;
  } catch {
    return null;
  }
  if (claims.app !== app) return null;
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;
  if (!claims.userId || !claims.jti) return null;
  return claims;
}

/**
 * Record a redemption for audit. Returns false only when the user no longer
 * exists; a jti seen before is fine — platform preview fetches redeem the
 * URL seconds before the user's real tap, so replays within TTL must work.
 */
export async function recordRedemption(
  supabase: SupabaseClient,
  claims: MiniAppClaims
): Promise<boolean> {
  const { error } = await supabase.from("miniapp_redemptions").insert({
    jti: claims.jti,
    user_id: claims.userId,
    app: claims.app,
  });
  if (error) {
    // 23505: jti already recorded — a replay within TTL, allowed.
    if (error.code === "23505") return true;
    // 23503: the user was deleted after mint — no longer redeemable.
    if (error.code === "23503") return false;
    throw new Error(`miniapp redemption failed: ${error.message}`);
  }
  console.log(
    JSON.stringify({
      msg: "miniapp token redeemed",
      user_id: claims.userId,
      app: claims.app,
      jti: claims.jti,
    })
  );
  return true;
}
