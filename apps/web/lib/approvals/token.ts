/**
 * Hosted-approval link tokens: short-TTL HMAC tokens that let the owner
 * open app.wzrd.tech/approve/<decision> from a deep link (iMessage) without
 * a web session. Same token discipline as fill tickets (HMAC-SHA256,
 * base64url payload.mac, constant-time verify) with a domain-separating
 * `use` claim so an approval link can never pass as a fill ticket (and
 * vice versa). The token only names a decision — it carries no value and
 * authorizes nothing beyond viewing/resolving that one decision, which the
 * decision's own status machine already gates (pending-only, single flip).
 * Minted at send time, never stored (architecture: a URL in a database is
 * a URL waiting to leak).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

export const APPROVAL_LINK_USE = "approval_link";
/** Deep links stay fresh for 15 minutes — the Needs-you queue remains the
 * durable surface after that. */
export const APPROVAL_LINK_TTL_MINUTES = 15;

export interface ApprovalLinkClaims {
  use: typeof APPROVAL_LINK_USE;
  userId: string;
  decisionId: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env.miniappSigningKey())
    .update(payload)
    .digest("base64url");
}

export function mintApprovalToken(
  userId: string,
  decisionId: string,
  ttlMinutes = APPROVAL_LINK_TTL_MINUTES
): string {
  const claims: ApprovalLinkClaims = {
    use: APPROVAL_LINK_USE,
    userId,
    decisionId,
    exp: Math.floor(Date.now() / 1000) + Math.min(ttlMinutes, 60) * 60,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyApprovalToken(
  token: string,
  decisionId: string
): ApprovalLinkClaims | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: ApprovalLinkClaims;
  try {
    claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as ApprovalLinkClaims;
  } catch {
    return null;
  }
  if (claims.use !== APPROVAL_LINK_USE) return null;
  if (claims.decisionId !== decisionId) return null;
  if (!claims.userId) return null;
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}

/** The hosted approval deep link for a decision. */
export function mintApprovalUrl(
  userId: string,
  decisionId: string,
  ttlMinutes = APPROVAL_LINK_TTL_MINUTES
): string {
  const token = mintApprovalToken(userId, decisionId, ttlMinutes);
  return `${env.appOrigin()}/approve/${decisionId}?k=${token}`;
}
