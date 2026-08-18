/**
 * Box power-state transitions (V8): value-free ready/stopped edges recorded
 * at the moments the control plane changes a box's state, feeding the Screen
 * tab's history sparkline. Best-effort — power flow never fails on telemetry.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type BoxStateEvent = "ready" | "stopped";

/**
 * A keep-awake schedule fire receipt: 'ready' rows are written for every
 * genuine wake, so ops needs a distinct marker to count keep-awake
 * consumption without conflating message-driven wakes or double-counting
 * cron fires. Best-effort, like the state edges.
 */
export async function recordKeepAwakeFire(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("box_state_events")
    .insert({ user_id: userId, state: "keepawake" });
  if (error) {
    console.error(
      JSON.stringify({
        msg: "keepawake fire event insert failed",
        user_id: userId,
        error: error.message,
      })
    );
  }
}

export async function recordBoxStateEvent(
  supabase: SupabaseClient,
  userId: string,
  state: BoxStateEvent
): Promise<void> {
  const { error } = await supabase
    .from("box_state_events")
    .insert({ user_id: userId, state });
  if (error) {
    console.error(
      JSON.stringify({
        msg: "box state event insert failed",
        user_id: userId,
        state,
        error: error.message,
      })
    );
  }
}

export interface BoxStateRow {
  state: BoxStateEvent;
  created_at: string;
}

export async function listBoxStateEvents(
  supabase: SupabaseClient,
  userId: string,
  hours = 48
): Promise<BoxStateRow[]> {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data } = await supabase
    .from("box_state_events")
    .select("state, created_at")
    .eq("user_id", userId)
    .in("state", ["ready", "stopped"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(500);
  return (data as BoxStateRow[] | null) ?? [];
}
