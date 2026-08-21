/**
 * "Publish now" (CM4 task 8): make the slot due immediately and run the
 * same claim → cap → validate → publish path the cron worker runs — one
 * code path, so idempotency, caps, and verdicts behave identically whether
 * a post fires from the calendar or from this button.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { publishSlot } from "@/lib/publish/worker";
import {
  parseContentSlot,
  SLOT_COLUMNS,
  type ContentSlot,
} from "@/lib/publish/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Make the slot due now; a parked slot re-queues. The conditional update
  // refuses a slot already mid-publish.
  const { data: queued } = await supabase
    .from("content_slots")
    .update({
      scheduled_at: new Date().toISOString(),
      status: "scheduled",
      attempt: 0,
      last_verdict: null,
      error_message: null,
    })
    .eq("id", id)
    .eq("user_id", session.userId)
    .in("status", ["scheduled", "parked"])
    .select(SLOT_COLUMNS);
  if (!queued || queued.length === 0) {
    return NextResponse.json({ error: "not publishable" }, { status: 409 });
  }
  const slot = parseContentSlot(queued[0]);
  if (!slot) {
    return NextResponse.json({ error: "not publishable" }, { status: 409 });
  }

  let outcome: string;
  try {
    const box = await ensureBoxAwake(supabase, session.userId);
    outcome = await publishSlot(supabase, box, slot);
  } catch (error) {
    if (error instanceof StartLimitError) {
      // The slot is due — the next cron sweep publishes it.
      return NextResponse.json({ outcome: "queued" }, { status: 202 });
    }
    return NextResponse.json({ error: "publish failed" }, { status: 502 });
  } finally {
    // ensureBoxAwake nulls stop_after before it can fail; re-arm on every
    // exit so a failed publish can't leave the box running forever.
    await armStopAfter(supabase, session.userId).catch(() => undefined);
  }
  const { data: after } = await supabase
    .from("content_slots")
    .select("id, status, external_id, permalink, last_verdict, error_message, scheduled_at")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle();
  return NextResponse.json({ outcome, slot: after ?? null });
}
