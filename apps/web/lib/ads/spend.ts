/**
 * CM6 spend math. The control-plane ceiling is a *commitment* ceiling: the
 * sum of active campaigns' daily budgets projected over 30 days, plus the
 * write being proposed, must fit under it. It is independent of platform
 * limits and fails closed — no configured ceiling means no spend.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const EXPOSURE_WINDOW_DAYS = 30;

export function exposure30dCents(dailyBudgetCents: number): number {
  return dailyBudgetCents * EXPOSURE_WINDOW_DAYS;
}

export interface CeilingCheck {
  allowed: boolean;
  ceilingCents: number;
  committedCents: number;
  requestedCents: number;
}

/** Pure decision: does the requested 30-day exposure fit under the ceiling
 * once existing commitments are counted? */
export function ceilingAllows(
  ceilingCents: number,
  committedCents: number,
  requestedCents: number
): CeilingCheck {
  return {
    allowed:
      ceilingCents > 0 && committedCents + requestedCents <= ceilingCents,
    ceilingCents,
    committedCents,
    requestedCents,
  };
}

export async function spendCeilingCents(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("ad_settings")
    .select("spend_ceiling_cents")
    .eq("user_id", userId)
    .maybeSingle();
  return Number(data?.spend_ceiling_cents ?? 0);
}

/** 30-day exposure already committed by active campaigns. */
export async function committedExposureCents(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("ad_campaigns")
    .select("daily_budget_cents")
    .eq("user_id", userId)
    .eq("status", "active");
  const daily = (data ?? []).reduce(
    (sum, row) => sum + Number(row.daily_budget_cents ?? 0),
    0
  );
  return exposure30dCents(daily);
}
