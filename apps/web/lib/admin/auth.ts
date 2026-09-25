import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "../env";

/**
 * R-SEC-10: one shared ADMIN_API_KEY covers every /api/admin/* route, so
 * the key alone can never name a human in admin_audit. Every admin call
 * must therefore also carry an X-Admin-Operator header — an operator id
 * (unix name or email-ish handle), required AND well-formed, which the
 * audit-writing routes record on the row.
 */
export const ADMIN_OPERATOR_HEADER = "x-admin-operator";

const OPERATOR_RE = /^[A-Za-z0-9._@-]{1,64}$/;

/**
 * Returns the authenticated operator id, or null on any failure — bad
 * Bearer, or a missing/malformed X-Admin-Operator. Every /api/admin route
 * calls this, so the operator requirement is uniform, not opt-in.
 */
export function adminAuthorized(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = env.adminApiKey();
  if (
    token.length !== expected.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  ) {
    return null;
  }
  const operator = request.headers.get(ADMIN_OPERATOR_HEADER)?.trim() ?? "";
  if (!OPERATOR_RE.test(operator)) return null;
  return operator;
}
