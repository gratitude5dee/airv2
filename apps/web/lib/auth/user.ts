import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export function sessionUserId(request: NextRequest): string | undefined {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return undefined;
  return verifySessionToken(token);
}
