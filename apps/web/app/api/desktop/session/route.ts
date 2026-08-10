/**
 * Remote gateway handshake for the desktop app.
 *
 *   POST   { pairing_token, label? } -> single-use redeem, returns a scoped
 *                                       short-lived device token
 *   GET    Bearer <device token>     -> whoami + agent addresses, so the
 *                                       desktop can render the same identity
 *                                       as the web app without box access
 *   DELETE Bearer <device token>     -> unpair this device
 *
 * The response never contains a box origin or token: the desktop's entire view
 * of the box is this control plane (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  desktopSession,
  mintDeviceToken,
  pairDevice,
} from "@/lib/auth/desktop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    pairing_token?: string;
    label?: string;
  };
  const pairingToken = (body.pairing_token ?? "").trim();
  if (!pairingToken) {
    return NextResponse.json({ error: "missing pairing token" }, { status: 400 });
  }
  const supabase = serviceClient();
  const device = await pairDevice(supabase, pairingToken, body.label);
  if (!device) {
    return NextResponse.json({ error: "invalid pairing token" }, { status: 401 });
  }
  const { token, expiresIn } = mintDeviceToken(device.userId, device.deviceId);
  return NextResponse.json({
    device_id: device.deviceId,
    token,
    expires_in: expiresIn,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await desktopSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [{ data: user }, { data: addresses }] = await Promise.all([
    supabase
      .from("users")
      .select("id, status, username, created_at")
      .eq("id", session.userId)
      .maybeSingle(),
    supabase
      .from("agent_addresses")
      .select("address, is_primary")
      .eq("user_id", session.userId)
      .is("retired_at", null),
  ]);
  if (!user) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    device_id: session.deviceId,
    user,
    addresses: addresses ?? [],
  });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await desktopSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await supabase
    .from("desktop_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", session.deviceId);
  return NextResponse.json({ revoked: true });
}
