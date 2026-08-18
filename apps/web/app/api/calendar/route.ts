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
import { listBots } from "@/lib/bots/store";
import { botTarget } from "@/lib/bots/client";
import { listJobs } from "@/lib/hermes/client";
import { displayRoutineName, isBotRoutineJob } from "@/lib/bots/routines";

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
  // V7 layer 3: each bot routine's next run. Safe metadata only (name +
  // next_run_at from the profile's jobs API) — prompt/output bodies stay on
  // the box (C4). Best-effort: a sleeping box just yields an empty overlay.
  const botRoutines: Array<{
    bot: string;
    routine: string;
    next_run_at: string | null;
  }> = [];
  try {
    const box = await ensureBoxAwake(supabase, userId);
    events = await readEventsStore(box.boxId);
    const bots = await listBots(supabase, userId);
    for (const bot of bots) {
      if (bot.status !== "ready") continue;
      try {
        const jobs = await listJobs(
          botTarget(box.target, bot.name, bot.api_server_key)
        );
        for (const job of jobs) {
          if (!isBotRoutineJob(bot.name, job.name)) continue;
          botRoutines.push({
            bot: bot.name,
            routine: displayRoutineName(bot.name, job.name),
            next_run_at: job.next_run_at ?? null,
          });
        }
      } catch {
        // this profile is unreachable; the rest still render
      }
    }
  } catch {
    boxAwake = false;
  } finally {
    // ensureBoxAwake nulls stop_after before it can fail; re-arm on every exit.
    await armStopAfter(supabase, userId).catch(() => undefined);
  }

  return NextResponse.json({
    events,
    schedules: scheduleRows ?? [],
    bot_routines: botRoutines,
    box_awake: boxAwake,
  });
}
