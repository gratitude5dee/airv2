/**
 * Rotate a still-valid device token. Device tokens are deliberately short
 * lived; the durable half of the credential is the `desktop_devices` row, so a
 * desktop that has been offline past the TTL has to be paired again.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { desktopSession, mintDeviceToken } from "@/lib/auth/desktop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await desktopSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { token, expiresIn } = mintDeviceToken(session.userId, session.deviceId);
  return NextResponse.json({ token, expires_in: expiresIn });
}
