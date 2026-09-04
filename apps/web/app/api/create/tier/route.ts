/**
 * V11 §5.1 Create surface tier picker — the mini-origin (store session)
 * twin of `PUT /api/settings/speed`: reads and writes `entitlements.speed_tier`
 * through the same `setSpeedTier`, a tier name and never a model id. The
 * Create tier family (`create-<tier>`) clamps to this value at the gateway,
 * so the picker is the owner's only lever on Create model spend.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { isSpeedTier, setSpeedTier } from "@/lib/settings/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data } = await serviceClient()
    .from("entitlements")
    .select("speed_tier, monthly_cap_usd")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as { speed_tier?: unknown; monthly_cap_usd?: unknown } | null;
  const tier = String(row?.speed_tier ?? "");
  return NextResponse.json({
    speed_tier: isSpeedTier(tier) ? tier : "balanced",
    monthly_cap_usd: Number(row?.monthly_cap_usd ?? 0),
  });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { speed_tier?: unknown };
  const tier = typeof body.speed_tier === "string" ? body.speed_tier : "";
  if (!isSpeedTier(tier)) {
    return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  }
  const ok = await setSpeedTier(serviceClient(), userId, tier);
  if (!ok) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, speed_tier: tier });
}
