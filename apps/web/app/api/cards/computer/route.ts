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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Minimum gap between agent-initiated computer cards per user. */
const CARD_COOLDOWN_MS = 2 * 60 * 1000;

/**
 * Atomic per-user rate limit: the insert wins the first send; afterwards a
 * conditional update only matches when the previous send is older than the
 * cooldown, so concurrent calls cannot both pass.
 */
async function claimCardSend(
  supabase: ReturnType<typeof serviceClient>,
  userId: string
): Promise<boolean> {
  const now = new Date();
  const { error } = await supabase
    .from("computer_card_sends")
    .insert({ user_id: userId, sent_at: now.toISOString() });
  if (!error) return true;
  if (error.code !== "23505") {
    throw new Error(`computer_card_sends insert failed: ${error.message}`);
  }
  const cutoff = new Date(now.getTime() - CARD_COOLDOWN_MS).toISOString();
  const { data, error: updateError } = await supabase
    .from("computer_card_sends")
    .update({ sent_at: now.toISOString() })
    .eq("user_id", userId)
    .lt("sent_at", cutoff)
    .select("user_id");
  if (updateError) {
    throw new Error(`computer_card_sends update failed: ${updateError.message}`);
  }
  return (data?.length ?? 0) > 0;
}

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

  // The owner's iMessage destination: the durable per-user record (refreshed
  // on every inbound), falling back to an in-flight flush job for users who
  // haven't texted since the destination table was introduced.
  const { data: dest } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  let spaceId = dest?.space_id ? String(dest.space_id) : "";
  let phone = dest?.phone ? String(dest.phone) : "";
  if (!spaceId || !phone) {
    const { data: job } = await supabase
      .from("flush_jobs")
      .select("space_id, phone")
      .eq("user_id", userId)
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    spaceId = job?.space_id ? String(job.space_id) : "";
    phone = job?.phone ? String(job.phone) : "";
  }
  if (!spaceId || !phone) {
    return NextResponse.json(
      { error: "no known imessage destination for this user" },
      { status: 409 }
    );
  }

  try {
    if (!(await claimCardSend(supabase, userId))) {
      return NextResponse.json(
        { error: "a computer card was sent recently — wait before sending another" },
        { status: 429 }
      );
    }
    await sendMiniAppCard(spaceId, phone, userId, "computer", "default");
  } catch (error) {
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
