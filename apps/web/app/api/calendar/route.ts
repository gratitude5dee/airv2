/**
 * V3 merged calendar feed: reads events.json from the box + overlays
 * agent_schedules — assembled per-request, nothing cached server-side (C4).
 * Event content never lands in Postgres or any server cache.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { readEventsStore, type CalendarEvent } from "@/lib/calendar/store";
import { SCHEDULE_COLUMNS } from "@/lib/calendar/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reading the store may wake the box.
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();

  const { data: scheduleRows } = await supabase
    .from("agent_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "deleted")
    .order("next_run_at", { ascending: true });

  let events: CalendarEvent[] = [];
  let boxAwake = true;
  try {
    const box = await ensureBoxAwake(supabase, userId);
    events = await readEventsStore(box.boxId);
    await armStopAfter(supabase, userId).catch(() => undefined);
  } catch {
    boxAwake = false;
  }

  return NextResponse.json({
    events,
    schedules: scheduleRows ?? [],
    box_awake: boxAwake,
  });
}
