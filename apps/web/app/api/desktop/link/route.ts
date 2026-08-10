/**
 * Desktop pairing mint. Only the authenticated owner in a browser session can
 * cause a mint (same rule as the mini-app link, C15): the web app shows the
 * short code, the desktop app exchanges it at /api/desktop/session.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { mintPairingToken } from "@/lib/auth/desktop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { token, expiresIn } = mintPairingToken(userId);
  return NextResponse.json({ pairing_token: token, expires_in: expiresIn });
}
