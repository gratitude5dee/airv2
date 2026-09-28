import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { SESSION_COOKIE, revokeSessionToken } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // R-SEC-07: logout revokes the session row, not just the cookie — a
  // captured JWT dies here instead of living out its 30 days.
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionToken(serviceClient(), token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
