/**
 * Held-delivery replay (plan §5C). During a pause, inbound deliveries that
 * already acknowledged their provider land in delivery_receipts as 'held'
 * rather than running against a fenced box. When work resumes — activation
 * on the new side or a cancelled migration's reopen — these replay with
 * their original identity:
 *
 *   schedule_occurrence: reset agent_schedules.next_run_at to the occurrence
 *     so the ordinary sweep fires it; claim_schedule treats 'held' as the
 *     sanctioned replay, not a duplicate.
 *   email: re-run processInboundEmail against the durable message reference
 *     (result_ref carries inbox/message ids — routing metadata only, I2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { processInboundEmail } from "../email/inbound";

interface HeldReceipt {
  user_id: string;
  kind: string;
  stable_id: string;
  result_ref: Record<string, unknown> | null;
}

export async function replayHeldReceipts(
  supabase: SupabaseClient,
  userId: string
): Promise<{ replayed: number; failed: number }> {
  const { data, error } = await supabase
    .from("delivery_receipts")
    .select("user_id, kind, stable_id, result_ref")
    .eq("user_id", userId)
    .eq("state", "held")
    .limit(50);
  if (error) {
    console.error(
      JSON.stringify({
        msg: "held receipt load failed",
        user_id: userId,
        error: error.message,
      })
    );
    return { replayed: 0, failed: 1 };
  }
  let replayed = 0;
  let failed = 0;
  for (const receipt of (data ?? []) as HeldReceipt[]) {
    try {
      if (receipt.kind === "schedule_occurrence") {
        // stable_id is `${scheduleId}@${occurrenceIso}` — pointing the
        // schedule back at the occurrence makes the next sweep's claim the
        // replay of this exact firing.
        const [scheduleId, occurrence] = receipt.stable_id.split("@");
        if (!scheduleId || !occurrence) throw new Error("bad stable_id");
        const { error: resetError } = await supabase
          .from("agent_schedules")
          .update({ next_run_at: occurrence })
          .eq("id", scheduleId)
          .eq("user_id", userId)
          .eq("status", "active");
        if (resetError) throw new Error(resetError.message);
      } else if (receipt.kind === "email") {
        const ref = receipt.result_ref as {
          inbox_id?: string;
          message_id?: string;
        } | null;
        if (!ref?.inbox_id || !ref.message_id) throw new Error("bad result_ref");
        await processInboundEmail(supabase, userId, ref.inbox_id, ref.message_id);
      } else {
        // Unknown held kinds stay held for an operator to inspect.
        continue;
      }
      const { error: completeError } = await supabase
        .from("delivery_receipts")
        .update({ state: "completed", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("kind", receipt.kind)
        .eq("stable_id", receipt.stable_id)
        .eq("state", "held");
      if (completeError) throw new Error(completeError.message);
      replayed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          msg: "held receipt replay failed",
          user_id: userId,
          kind: receipt.kind,
          stable_id: receipt.stable_id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
  return { replayed, failed };
}

/**
 * Record a delivery that acknowledged its provider but could not run because
 * admission was closed. Upsert so a retried webhook lands on the same row.
 */
export async function holdReceipt(
  supabase: SupabaseClient,
  userId: string,
  kind: "email",
  stableId: string,
  resultRef: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("delivery_receipts").upsert(
    {
      user_id: userId,
      kind,
      stable_id: stableId,
      state: "held",
      result_ref: resultRef,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind,stable_id" }
  );
  if (error) {
    console.error(
      JSON.stringify({
        msg: "held receipt write failed",
        user_id: userId,
        kind,
        stable_id: stableId,
        error: error.message,
      })
    );
  }
}
