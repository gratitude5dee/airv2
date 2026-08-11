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

  // The owner's iMessage destination is the space/line of their most recent
  // conversation — the same place replies already go.
  const { data: job } = await supabase
    .from("flush_jobs")
    .select("space_id, phone")
    .eq("user_id", userId)
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job?.space_id || !job.phone) {
    return NextResponse.json(
      { error: "no imessage conversation for this user yet" },
      { status: 409 }
    );
  }

  try {
    await sendMiniAppCard(
      String(job.space_id),
      String(job.phone),
      userId,
      "computer",
      "default"
    );
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
