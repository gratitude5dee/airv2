import type { SupabaseClient } from "@supabase/supabase-js";
import { currentPeriodSpend } from "../entitlements/spend";
import { env } from "../env";

export type MuseRunSpendVerdict =
  | { ok: true }
  | { ok: false; code: "budget_exhausted" | "account_suspended" | "spend_unavailable" };

/**
 * Reserve admission headroom for a Muse-triggered run. Cost is still written
 * by the inference gateway into agent_runs; this deliberately records no
 * prompt or result. We use the per-call ceiling as conservative headroom so
 * an in-flight relay loop cannot over-admit an owner's monthly allowance.
 */
export async function checkMuseRunSpend(
  supabase: SupabaseClient,
  userId: string,
): Promise<MuseRunSpendVerdict> {
  const { data: entitlement, error: entitlementError } = await supabase
    .from("entitlements")
    .select("monthly_cap_usd, spend_mtd_usd, spend_period_start, suspended_reason")
    .eq("user_id", userId)
    .maybeSingle();
  if (entitlementError) return { ok: false, code: "spend_unavailable" };
  if (!entitlement || entitlement.suspended_reason) return { ok: false, code: "account_suspended" };
  const monthly = await currentPeriodSpend(supabase, userId, {
    spend_mtd_usd: entitlement.spend_mtd_usd as number | string,
    spend_period_start: String(entitlement.spend_period_start),
  });
  const perCall = env.museRunMaxUsd();
  if (monthly + perCall > Number(entitlement.monthly_cap_usd)) return { ok: false, code: "budget_exhausted" };

  // UTC is intentionally an upper-bound daily window until Air has a
  // profile-level timezone. Counting a few extra runs is safe; allowing an
  // extra one would not be.
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data: runs, error: runsError } = await supabase
    .from("agent_runs")
    .select("cost_usd")
    .eq("user_id", userId)
    .eq("trigger", "mcp")
    .like("label", "muse:%")
    .gte("started_at", start.toISOString());
  if (runsError) return { ok: false, code: "spend_unavailable" };
  const used = (runs ?? []).reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);
  return used + perCall > env.museRunDailyUsd()
    ? { ok: false, code: "budget_exhausted" }
    : { ok: true };
}
