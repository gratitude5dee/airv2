/**
 * M7.5 mini-app tokens (C15/C17): signed, scoped, short-TTL, single-use for
 * anything with a side effect. Minted only inside owner-initiated flows —
 * tier-2 senders can never cause a mint. The token binds (user_id, app,
 * resource_id) so a Kanban token is rejected at /todo (path is a routing
 * hint, never an authorization).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

export interface MiniAppClaims {
  userId: string;
  app: string;
  resourceId: string;
  jti: string;
  exp: number;
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
  ttlMinutes = 10
): string {
  const claims: MiniAppClaims = {
    userId,
    app,
    resourceId,
    jti: randomBytes(12).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + ttlMinutes * 60,
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

/** Single-use redemption: first insert of a jti wins; replays are rejected. */
export async function redeemOnce(
  supabase: SupabaseClient,
  claims: MiniAppClaims
): Promise<boolean> {
  const { error } = await supabase.from("miniapp_redemptions").insert({
    jti: claims.jti,
    user_id: claims.userId,
    app: claims.app,
  });
  if (error) {
    // 23505: jti already redeemed. 23503: the user was deleted after mint —
    // the token is no longer redeemable either way.
    if (error.code === "23505" || error.code === "23503") return false;
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
