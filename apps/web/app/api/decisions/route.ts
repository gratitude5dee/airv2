/**
 * "Needs you" queue (M6 task 2): list pending decisions; resolve one.
 * Approving an email_draft sends it via the control-plane key — the only
 * send path that exists (C10).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { sendDraft } from "@/lib/agentmail/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("decisions")
    .select("id, kind, platform, sender, ref, label, status, created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ decisions: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: string;
  };
  if (!body.id || !["approve", "dismiss"].includes(body.action ?? "")) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, kind, ref, status")
    .eq("id", body.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!decision || decision.status !== "pending") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (body.action === "approve" && decision.kind === "email_draft" && decision.ref) {
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
    await sendDraft(
      address.agentmail_inbox_id as string,
      decision.ref as string,
      decision.id as string
    );
  }

  if (
    body.action === "approve" &&
    ["reconnect", "revise"].includes(decision.kind as string) &&
    decision.ref
  ) {
    // Approving re-queues the parked slot; the next sweep publishes it.
    await supabase
      .from("content_slots")
      .update({
        status: "scheduled",
        scheduled_at: new Date().toISOString(),
        attempt: 0,
        last_verdict: null,
        error_message: null,
      })
      .eq("id", decision.ref)
      .eq("user_id", userId)
      .eq("status", "parked");
  }

  await supabase
    .from("decisions")
    .update({
      status: body.action === "approve" ? "approved" : "dismissed",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", decision.id)
    .eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
