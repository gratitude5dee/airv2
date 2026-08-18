/**
 * Agent-initiated browser card (V6 step 5): at the human-submit moment the
 * agent re-raises the live browser view on iMessage so the owner can review
 * the filled checkout and click Place order themselves. Identical trust
 * shape to /api/cards/computer — per-box gateway-token auth, the durable
 * tier-0-only imessage_destinations record (never a flush_jobs fallback,
 * which can point at a tier-1 thread on a shared line), the cooldown-
 * governed card_sends claim, and a control-plane-side single-use link mint
 * so the box never learns any URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sendMiniAppCard } from "@/lib/miniapps/cards";
import { claimCardSend, type CardClaim } from "@/lib/miniapps/cardSends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (!box) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = box.user_id as string;

  const { data: dest } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  const spaceId = dest?.space_id ? String(dest.space_id) : "";
  const phone = dest?.phone ? String(dest.phone) : "";
  if (!spaceId || !phone) {
    return NextResponse.json(
      { error: "no known imessage destination for this user" },
      { status: 409 }
    );
  }

  let claim: CardClaim | undefined;
  try {
    claim = await claimCardSend(supabase, userId, "browser");
    if (!claim) {
      return NextResponse.json(
        { error: "a browser card was sent recently — wait before sending another" },
        { status: 429 }
      );
    }
    await sendMiniAppCard(spaceId, phone, userId, "browser", "default");
  } catch (error) {
    await claim?.release().catch(() => undefined);
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "browser card send failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "card send failed" }, { status: 502 });
  }
  console.log(
    JSON.stringify({ msg: "browser card sent", user_id: userId })
  );
  return NextResponse.json({ ok: true });
}
