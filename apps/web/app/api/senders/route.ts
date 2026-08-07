/**
 * People (M4 task 1): list known senders; promote/demote between tier 1
 * (known) and tier 2 (unknown). Tier 0 is reserved for the account's own
 * verified handles and is never assignable here.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("senders")
    .select("id, platform, address, trust_tier, first_seen")
    .eq("user_id", userId)
    .order("first_seen", { ascending: false })
    .limit(200);
  return NextResponse.json({ senders: data ?? [] });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    trust_tier?: number;
  };
  if (!body.id || ![1, 2].includes(body.trust_tier ?? -1)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { error } = await supabase
    .from("senders")
    .update({ trust_tier: body.trust_tier })
    .eq("id", body.id)
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
