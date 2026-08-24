/**
 * Pairing exchange the Berd side calls (berd.goal.md §MA-B2, §3): outbound
 * from the user's desktop app or a self-hosted instance on their own Box
 * (§3.3). The single-use owner-minted code is the credential; the response
 * carries the per-device token exactly once. Every failure is the same 403 —
 * an attacker probing codes learns nothing about which ones exist.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { exchangeBerdPairingCode } from "@/lib/miniapps/berd/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    deviceLabel?: string;
    protocolVersion?: number;
  };
  if (typeof body.code !== "string") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await exchangeBerdPairingCode(serviceClient(), {
    code: body.code,
    deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel : "",
    protocolVersion:
      typeof body.protocolVersion === "number" &&
      Number.isInteger(body.protocolVersion) &&
      body.protocolVersion > 0
        ? body.protocolVersion
        : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ token: result.token });
}
