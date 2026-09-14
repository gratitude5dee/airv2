import type { SupabaseClient } from "@supabase/supabase-js";

export const FLUSH_CLAIM_LEASE_MS = 5 * 60_000;
const OVERDUE_GRACE_MS = 30_000;

export interface OverdueFlushJob {
  space_id: string;
  user_id: string;
  phone: string;
  run_at: string;
  attempts: number;
  sender_tier: number | null;
}

/**
 * List work whose original after() task died without stealing an active run.
 * claim_flush stamps chain_started_at but does not change run_at, so selecting
 * every overdue row lets the next minute's sweep claim the same job, drain an
 * empty queue, and delete the live worker's scheduling row. A recent claim is
 * therefore leased; a crashed claim becomes eligible again after five minutes.
 */
export async function listClaimableOverdueFlushJobs(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<OverdueFlushJob[]> {
  const overdueBefore = new Date(now.getTime() - OVERDUE_GRACE_MS).toISOString();
  const staleClaimBefore = new Date(
    now.getTime() - FLUSH_CLAIM_LEASE_MS,
  ).toISOString();
  const { data, error } = await supabase
    .from("flush_jobs")
    .select("space_id, user_id, phone, run_at, attempts, sender_tier")
    .lt("run_at", overdueBefore)
    .or(
      `chain_started_at.is.null,chain_started_at.lt.${staleClaimBefore}`,
    )
    .limit(10);
  if (error) {
    throw new Error(`overdue flush read failed: ${error.message}`);
  }
  return (data ?? []) as OverdueFlushJob[];
}
