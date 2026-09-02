/**
 * People (M4 task 1, V8 detail): list known senders with per-sender run
 * counts; promote/demote between tier 1 (known) and tier 2 (unknown); block
 * email senders, mirrored to AgentMail's inbox-scoped receive-block list —
 * the enforcement layer. Tier 0 is reserved for the account's own verified
 * handles and is never assignable here.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import {
  addInboxBlockEntry,
  removeInboxBlockEntry,
} from "@/lib/mail/client";

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
    .select(
      "id, platform, address, trust_tier, first_seen, blocked_at, tier_changed_at"
    )
    .eq("user_id", userId)
    .order("first_seen", { ascending: false })
    .limit(200);

  // Per-sender message counts from agent_runs (V8). One bounded query; rows
  // predating the sender_id column simply don't count.
  const counts = new Map<string, number>();
  const { data: runRows } = await supabase
    .from("agent_runs")
    .select("sender_id")
    .eq("user_id", userId)
    .not("sender_id", "is", null)
    .limit(5000);
  for (const row of runRows ?? []) {
    const senderId = row.sender_id as string;
    counts.set(senderId, (counts.get(senderId) ?? 0) + 1);
  }

  return NextResponse.json({
    senders: (data ?? []).map((s) => ({
      ...s,
      run_count: counts.get(s.id as string) ?? 0,
    })),
  });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    trust_tier?: number;
    blocked?: boolean;
  };
  if (!body.id) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const supabase = serviceClient();

  if (typeof body.blocked === "boolean") {
    const { data: sender } = await supabase
      .from("senders")
      .select("id, platform, address, blocked_at")
      .eq("id", body.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!sender) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (sender.platform !== "email") {
      // AgentMail Lists is the enforcement layer; there is no equivalent
      // for other platforms, so a block toggle there would be decorative.
      return NextResponse.json(
        { error: "only email senders can be blocked" },
        { status: 400 }
      );
    }
    const { data: address } = await supabase
      .from("agent_addresses")
      .select("agentmail_inbox_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .is("retired_at", null)
      .maybeSingle();
    if (!address?.agentmail_inbox_id) {
      return NextResponse.json({ error: "no inbox" }, { status: 409 });
    }
    try {
      if (body.blocked) {
        await addInboxBlockEntry(
          address.agentmail_inbox_id as string,
          sender.address as string
        );
      } else {
        await removeInboxBlockEntry(
          address.agentmail_inbox_id as string,
          sender.address as string
        );
      }
    } catch (error) {
      // The list is the enforcement layer — never record a block that
      // AgentMail didn't accept.
      console.error(
        JSON.stringify({
          msg: "agentmail block mirror failed",
          user_id: userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return NextResponse.json(
        { error: "could not update the block list — try again" },
        { status: 502 }
      );
    }
    const { error } = await supabase
      .from("senders")
      .update({ blocked_at: body.blocked ? new Date().toISOString() : null })
      .eq("id", body.id)
      .eq("user_id", userId);
    if (error) {
      return NextResponse.json({ error: "update failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (![1, 2].includes(body.trust_tier ?? -1)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { error } = await supabase
    .from("senders")
    .update({
      trust_tier: body.trust_tier,
      tier_changed_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
