/**
 * Speed & Intelligence (M6): writes entitlements.speed_tier — a tier name,
 * never a model ID. The tier→model mapping lives server-side in the gateway.
 * The write is shared with the MA5 settings mini-app (lib/settings/account.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { isSpeedTier, setSpeedTier } from "@/lib/settings/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    speed_tier?: string;
  };
  if (!body.speed_tier || !isSpeedTier(body.speed_tier)) {
    return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  }
  const ok = await setSpeedTier(serviceClient(), userId, body.speed_tier);
  if (!ok) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
