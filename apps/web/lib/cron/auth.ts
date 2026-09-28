/**
 * Shared Vercel-cron guard: `Authorization: Bearer ${CRON_SECRET}` checked
 * in constant time. Every /api/cron/* route uses this — a route without it
 * fails closed because the secret never compares equal to anything.
 */
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

export function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env["CRON_SECRET"] ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}
