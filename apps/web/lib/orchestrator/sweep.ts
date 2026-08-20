/**
 * Idle-box selection for the cron sweeper. Two populations stop:
 *  - boxes whose armed stop_after deadline has passed;
 *  - running boxes with a NULL stop_after gone stale — ensureBoxAwake clears
 *    the deadline for the duration of a turn, so a turn whose re-arm never
 *    landed (function death, lost DB write) would otherwise stay awake with
 *    no deadline forever.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How long a running box may sit with a NULL stop_after before the sweeper
 * treats it as leaked. Comfortably above the longest function turn
 * (maxDuration 800s), so an in-flight run is never stopped underneath.
 */
export const NULL_DEADLINE_GRACE_MS = 30 * 60_000;

export interface SweepableBox {
  provider_box_id: string;
  user_id: string;
}

export async function findSweepableBoxes(
  supabase: SupabaseClient,
  now: Date
): Promise<SweepableBox[]> {
  const nowIso = now.toISOString();
  const { data: overdue } = await supabase
    .from("boxes")
    .select("provider_box_id, user_id")
    .lt("stop_after", nowIso)
    .in("state", ["ready", "idle"]);
  const staleIso = new Date(now.getTime() - NULL_DEADLINE_GRACE_MS).toISOString();
  const { data: leaked } = await supabase
    .from("boxes")
    .select("provider_box_id, user_id")
    .is("stop_after", null)
    .in("state", ["ready", "idle"])
    .lt("last_active_at", staleIso);
  const seen = new Set<string>();
  const result: SweepableBox[] = [];
  for (const box of [
    ...((overdue ?? []) as SweepableBox[]),
    ...((leaked ?? []) as SweepableBox[]),
  ]) {
    if (seen.has(box.provider_box_id)) continue;
    seen.add(box.provider_box_id);
    result.push(box);
  }
  return result;
}
