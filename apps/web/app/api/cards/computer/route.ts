/**
 * Agent-initiated computer card. The user's own Hermes (authenticated by its
 * per-box GATEWAY_TOKEN, same credential as the inference gateway) asks the
 * control plane to send its owner an iMessage mini-app card that opens the
 * box's computer view — used when a browser step needs the human (e.g. a
 * Meta login). The box never learns the desktop URL or any link; the mint
 * happens control-plane-side and the single-use token goes only to the
 * owner's iMessage thread (C15: this is owner-scoped — the card is sent to
 * the user the box belongs to, never to an arbitrary recipient).
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

  // The owner's iMessage destination: only the durable per-user record,
  // written exclusively from tier-0 (owner-handle) inbounds. No flush_jobs
  // fallback — its latest row can belong to a tier-1 contact's thread on a
  // shared line, and the screen card must never land there.
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
    claim = await claimCardSend(supabase, userId, "computer");
    if (!claim) {
      return NextResponse.json(
        { error: "a computer card was sent recently — wait before sending another" },
        { status: 429 }
      );
    }
    await sendMiniAppCard(spaceId, phone, userId, "computer", "default");
  } catch (error) {
    await claim?.release().catch(() => undefined);
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "computer card send failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "card send failed" }, { status: 502 });
  }
  console.log(
    JSON.stringify({ msg: "computer card sent", user_id: userId })
  );
  return NextResponse.json({ ok: true });
}
