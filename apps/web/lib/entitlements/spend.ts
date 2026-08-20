/**
 * Monthly spend window handling (review 2026-08 P1-2). The cap in
 * entitlements is a calendar-month cap: spend_period_start anchors the
 * current window, and readers roll the counter forward when the month has
 * moved on — the same roll-on-read pattern automation_rules uses for its
 * daily caps (lib/browser/rules.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SpendRow {
  spend_mtd_usd: number | string;
  spend_period_start: string;
}

/** True when the anchor's UTC calendar month is behind `now`'s. */
export function spendPeriodRolled(periodStart: Date, now: Date): boolean {
  return (
    periodStart.getUTCFullYear() !== now.getUTCFullYear() ||
    periodStart.getUTCMonth() !== now.getUTCMonth()
  );
}

/**
 * Returns the spend that counts against the current month's cap, resetting
 * the row first when the window has rolled. The guarded update (matching the
 * previously-read spend value) makes concurrent rolls serialize — a loser
 * re-reads the row that the winner (or a concurrent add_spend) wrote.
 */
export async function currentPeriodSpend(
  supabase: SupabaseClient,
  userId: string,
  row: SpendRow,
  now: Date = new Date()
): Promise<number> {
  const spend = Number(row.spend_mtd_usd);
  if (!spendPeriodRolled(new Date(row.spend_period_start), now)) {
    return spend;
  }
  const { data: updated } = await supabase
    .from("entitlements")
    .update({ spend_mtd_usd: 0, spend_period_start: now.toISOString() })
    .eq("user_id", userId)
    .eq("spend_mtd_usd", row.spend_mtd_usd)
    .select("user_id");
  if (updated && updated.length > 0) return 0;
  const { data: fresh } = await supabase
    .from("entitlements")
    .select("spend_mtd_usd")
    .eq("user_id", userId)
    .maybeSingle();
  return fresh ? Number(fresh.spend_mtd_usd) : spend;
}
