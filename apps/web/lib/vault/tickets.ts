/**
 * V6 fill tickets (C20): single-use, short-TTL HMAC tokens that authorize
 * `air-vault type` to fill card-kind fields — minted ONLY when the owner
 * approves a `purchase_review` decision, never from a model turn. Same
 * token discipline as mini-app links (HMAC-SHA256, base64url payload.mac,
 * jti + exp, constant-time verify) with a domain-separating `use` claim so
 * a mini-app token can never pass as a fill ticket. Redemption goes through
 * the fill_ticket_redemptions ledger: first insert of a jti wins (single
 * use). Claims carry an amount BAND, never a card value (C18).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

export const FILL_TICKET_USE = "fill_ticket";
/** exp ≤ 10 minutes, always (§V6 choreography step 4). */
export const MAX_TTL_MINUTES = 10;

export interface FillTicketClaims {
  use: typeof FILL_TICKET_USE;
  userId: string;
  itemId: string;
  host: string;
  amountBand: string;
  jti: string;
  exp: number;
}

const BANDS: [number, string][] = [
  [25, "under $25"],
  [100, "$25–$100"],
  [500, "$100–$500"],
  [2000, "$500–$2,000"],
];

/** Coarse display band for an order amount — shown on approval surfaces
 * and bound into the ticket instead of the exact figure. */
export function amountBand(amountUsd: number): string {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) return "unknown amount";
  for (const [ceiling, label] of BANDS) {
    if (amountUsd < ceiling) return label;
  }
  return "over $2,000";
}

function sign(payload: string): string {
  return createHmac("sha256", env.miniappSigningKey())
    .update(payload)
    .digest("base64url");
}

export function mintFillTicket(
  userId: string,
  itemId: string,
  host: string,
  band: string,
  ttlMinutes = MAX_TTL_MINUTES
): { token: string; claims: FillTicketClaims } {
  const claims: FillTicketClaims = {
    use: FILL_TICKET_USE,
    userId,
    itemId,
    host: host.toLowerCase().replace(/^www\./, ""),
    amountBand: band,
    jti: randomBytes(12).toString("base64url"),
    exp:
      Math.floor(Date.now() / 1000) +
      Math.min(ttlMinutes, MAX_TTL_MINUTES) * 60,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  console.log(
    JSON.stringify({
      msg: "fill ticket minted",
      user_id: userId,
      item_id: itemId,
      host: claims.host,
      amount_band: band,
      jti: claims.jti,
    })
  );
  return { token: `${payload}.${sign(payload)}`, claims };
}

export function verifyFillTicket(
  token: string,
  userId: string
): FillTicketClaims | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: FillTicketClaims;
  try {
    claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as FillTicketClaims;
  } catch {
    return null;
  }
  if (claims.use !== FILL_TICKET_USE) return null;
  if (claims.userId !== userId) return null;
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;
  if (!claims.itemId || !claims.host || !claims.jti) return null;
  return claims;
}

/** Single-use redemption: first insert of a jti wins; replays are rejected. */
export async function redeemFillTicket(
  supabase: SupabaseClient,
  claims: FillTicketClaims
): Promise<boolean> {
  const { error } = await supabase.from("fill_ticket_redemptions").insert({
    jti: claims.jti,
    user_id: claims.userId,
    item_id: claims.itemId,
    host: claims.host,
    amount_band: claims.amountBand,
  });
  if (error) {
    // 23505: jti already redeemed. 23503: the user was deleted after mint.
    if (error.code === "23505" || error.code === "23503") return false;
    throw new Error(`fill ticket redemption failed: ${error.message}`);
  }
  console.log(
    JSON.stringify({
      msg: "fill ticket redeemed",
      user_id: claims.userId,
      item_id: claims.itemId,
      host: claims.host,
      jti: claims.jti,
    })
  );
  return true;
}
