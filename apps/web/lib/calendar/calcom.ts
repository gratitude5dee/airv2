/**
 * cal.com webhook verification (M2's ingress discipline on a third channel):
 * per-account HMAC-SHA256 over the raw body in `x-cal-signature-256`,
 * verified before any DB write; stale payloads rejected.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const STALENESS_WINDOW_MS = 10 * 60 * 1000;

export function verifyCalcomSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.trim().toLowerCase();
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

/** true when the payload's createdAt is outside the freshness window. */
export function isStale(createdAt: string | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return true;
  return Math.abs(now - timestamp) > STALENESS_WINDOW_MS;
}

export interface CalcomEnvelope {
  triggerEvent?: string;
  createdAt?: string;
  payload?: { uid?: string; bookingId?: number };
}

/** Stable dedupe key: uid + trigger — a replay maps onto the same key. */
export function calcomDedupeKey(envelope: CalcomEnvelope): string {
  const uid =
    envelope.payload?.uid ??
    (envelope.payload?.bookingId !== undefined
      ? String(envelope.payload.bookingId)
      : "unknown");
  return `${envelope.triggerEvent ?? "event"}:${uid}:${envelope.createdAt ?? ""}`;
}
