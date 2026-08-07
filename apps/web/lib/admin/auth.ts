import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "../env";

export function adminAuthorized(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = env.adminApiKey();
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
