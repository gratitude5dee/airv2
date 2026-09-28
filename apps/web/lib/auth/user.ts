import type { NextRequest } from "next/server";
import { serviceClient } from "../supabase";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function sessionUserId(
  request: NextRequest
): Promise<string | undefined> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return undefined;
  const claims = verifySessionToken(token);
  if (!claims) return undefined;
  // R-SEC-07: the token is only half the answer — the session is live while
  // its row is unrevoked, so a logged-out or deleted account's cookie dies
  // on the next request (SECURITY-DECISIONS §8.4).
  const { data, error } = await serviceClient()
    .from("sessions")
    .select("id")
    .eq("id", claims.sessionId)
    .eq("user_id", claims.userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return undefined;
  return claims.userId;
}
