/**
 * The sweeper's stop path: claim the box's idle stop, then stop it through
 * the provider — never with force (C6). A claim is released when the stop
 * is refused so the worker can resume indexing on a box that stays up.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { stop } from "@/lib/box/client";
import { recordBoxStateEvent } from "@/lib/box/events";
import { claimIdleStop, releaseIdleStop, type DeferReason } from "@/lib/orchestrator/indexIdle";
import type { SweepableBox } from "@/lib/orchestrator/sweep";

export interface IdleStopReport {
  stopped: number;
  /** Total deferrals, kept for existing dashboards; `deferred` breaks it down. */
  indexingDeferred: number;
  deferred: Record<DeferReason, number>;
  /** Stops taken under an exclusive claim (new ovctl). */
  claimed: number;
  /** Stops on old boxes: read-only idle probe, or no idle command at all. */
  legacyProbe: number;
  legacyStop: number;
  /** Claims released after a refused provider stop; the remainder expire by TTL. */
  released: number;
  releaseFailed: number;
}

export function overdueMs(box: SweepableBox, now: Date): number {
  const since = box.stop_after ?? box.last_active_at;
  const sinceMs = since ? Date.parse(since) : Number.NaN;
  return Number.isNaN(sinceMs) ? 0 : Math.max(0, now.getTime() - sinceMs);
}

export async function stopIdleBoxes(
  supabase: SupabaseClient,
  boxes: SweepableBox[],
  now: Date
): Promise<IdleStopReport> {
  const nowIso = now.toISOString();
  const report: IdleStopReport = {
    stopped: 0,
    indexingDeferred: 0,
    deferred: { pending: 0, grace: 0, busy: 0, claimed: 0, probe_failed: 0, legacy_grace: 0 },
    claimed: 0,
    legacyProbe: 0,
    legacyStop: 0,
    released: 0,
    releaseFailed: 0,
  };
  for (const box of boxes) {
    const decision = await claimIdleStop(box.provider_box_id, overdueMs(box, now));
    if (decision.kind === "deferred") {
      report.indexingDeferred += 1;
      report.deferred[decision.reason] += 1;
      if (decision.reason === "probe_failed") {
        console.error(
          JSON.stringify({
            msg: "sweeper idle probe failed",
            box_id: box.provider_box_id,
            user_id: box.user_id,
          })
        );
      }
      continue;
    }
    try {
      // last_active_at also starts the stale-transition clock, so an
      // interrupted stop is reconciled 30 minutes after the attempt.
      await supabase
        .from("boxes")
        .update({ state: "stopping", last_active_at: nowIso })
        .eq("provider_box_id", box.provider_box_id);
      await stop(box.provider_box_id);
      await supabase
        .from("boxes")
        .update({ state: "stopped", stop_after: null })
        .eq("provider_box_id", box.provider_box_id);
      await recordBoxStateEvent(supabase, box.user_id, "stopped");
      report.stopped += 1;
      if (decision.kind === "claimed") report.claimed += 1;
      else if (decision.kind === "legacy_probe") report.legacyProbe += 1;
      else report.legacyStop += 1;
    } catch (error) {
      // A refused stop means the snapshot is failing — leave the box
      // running and visible as ready so the next sweep retries (C6).
      if (decision.kind === "claimed") {
        if (await releaseIdleStop(box.provider_box_id, decision.token)) report.released += 1;
        else report.releaseFailed += 1;
      }
      await supabase
        .from("boxes")
        .update({ state: "ready" })
        .eq("provider_box_id", box.provider_box_id);
      console.error(
        JSON.stringify({
          msg: "sweeper stop failed",
          box_id: box.provider_box_id,
          user_id: box.user_id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
  return report;
}
