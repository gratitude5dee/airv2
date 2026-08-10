/**
 * Slot reschedule/cancel (CM4). PATCH moves a scheduled or parked slot to a
 * new instant (re-queueing a parked one); DELETE cancels it. A slot mid-
 * publish is owned by its claim — neither touches 'publishing'.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import { isValidTimeZone, zonedTimeToInstant } from "@/lib/publish/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    scheduled_at?: string;
    local_time?: string;
    timezone?: string;
  };
  const { data: slot } = await supabase
    .from("content_slots")
    .select("id, status, timezone")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!slot) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!["scheduled", "parked"].includes(slot.status as string)) {
    return NextResponse.json({ error: "slot not movable" }, { status: 409 });
  }
  const timezone = body.timezone ?? (slot.timezone as string);
  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
  }
  let scheduledAt: Date;
  if (body.local_time) {
    try {
      scheduledAt = zonedTimeToInstant(body.local_time, timezone);
    } catch {
      return NextResponse.json({ error: "invalid local_time" }, { status: 400 });
    }
  } else if (body.scheduled_at) {
    scheduledAt = new Date(body.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "invalid scheduled_at" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { data: updated } = await supabase
    .from("content_slots")
    .update({
      scheduled_at: scheduledAt.toISOString(),
      timezone,
      status: "scheduled",
      attempt: 0,
      last_verdict: null,
      error_message: null,
    })
    .eq("id", id)
    .eq("user_id", session.userId)
    .in("status", ["scheduled", "parked"])
    .select("id, scheduled_at, timezone, status");
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "slot not movable" }, { status: 409 });
  }
  return NextResponse.json({ slot: updated[0] });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: cancelled } = await supabase
    .from("content_slots")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", session.userId)
    .in("status", ["scheduled", "parked"])
    .select("id");
  if (!cancelled || cancelled.length === 0) {
    return NextResponse.json({ error: "not cancellable" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
