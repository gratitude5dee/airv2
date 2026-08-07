/**
 * Speed & Intelligence (M6): writes entitlements.speed_tier — a tier name,
 * never a model ID. The tier→model mapping lives server-side in the gateway.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIERS = new Set(["fast", "balanced", "deep"]);

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    speed_tier?: string;
  };
  if (!body.speed_tier || !TIERS.has(body.speed_tier)) {
    return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { error } = await supabase
    .from("entitlements")
    .update({ speed_tier: body.speed_tier })
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
