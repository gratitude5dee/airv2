/**
 * Per-project Create budget (goal-create-v11 §9.1). A Create turn opens an
 * agent_runs row labelled `create:<slug>`; every gateway completion served
 * on a `create-<tier>` model while that run is open is metered under the
 * same label, so the project's spend is a sum over its own usage rows and
 * never a copy of anything the Box holds. The owner raises the budget on
 * PATCH /api/create/projects (up to the monthly cap); the agent cannot.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CREATE_LABEL_PREFIX = "create:";
export const DEFAULT_CREATE_BUDGET_USD = 5;
/** How long after its last turn a Create run still attributes gateway usage. */
export const CREATE_RUN_ATTRIBUTION_MINUTES = 30;

export function createRunLabel(slug: string): string {
  return `${CREATE_LABEL_PREFIX}${slug}`;
}

export function slugFromRunLabel(label: string | null | undefined): string | null {
  if (!label || !label.startsWith(CREATE_LABEL_PREFIX)) return null;
  const slug = label.slice(CREATE_LABEL_PREFIX.length);
  return slug ? slug : null;
}

/**
 * The project a `create-*` gateway call belongs to: the user's most recent
 * Create run that is still open (or closed within the attribution window,
 * for the trailing completions that land after the terminal event).
 */
export async function activeCreateSlug(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const since = new Date(
    Date.now() - CREATE_RUN_ATTRIBUTION_MINUTES * 60_000
  ).toISOString();
  const { data } = await supabase
    .from("agent_runs")
    .select("label, ended_at, started_at")
    .eq("user_id", userId)
    .like("label", `${CREATE_LABEL_PREFIX}%`)
    .not("hermes_run_id", "is", null)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { label: string | null } | null;
  return slugFromRunLabel(row?.label);
}

export interface BudgetMeter {
  budget_usd: number;
  spent_usd: number;
  remaining_usd: number;
}

/** Sum of metered gateway completions attributed to the project. */
export async function createSpendUsd(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<number> {
  const { data } = await supabase
    .from("agent_runs")
    .select("cost_usd")
    .eq("user_id", userId)
    .eq("label", createRunLabel(slug))
    .eq("outcome", "gateway_completion");
  const rows = (data ?? []) as { cost_usd: number | string | null }[];
  let total = 0;
  for (const row of rows) total += Number(row.cost_usd ?? 0);
  return Math.round(total * 1_000_000) / 1_000_000;
}

export function budgetMeter(budgetUsd: number, spentUsd: number): BudgetMeter {
  const budget = Number.isFinite(budgetUsd) ? Math.max(0, budgetUsd) : 0;
  const spent = Number.isFinite(spentUsd) ? Math.max(0, spentUsd) : 0;
  return {
    budget_usd: budget,
    spent_usd: spent,
    remaining_usd: Math.max(0, Math.round((budget - spent) * 100) / 100),
  };
}

export async function projectBudget(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<BudgetMeter | null> {
  const { data } = await supabase
    .from("mini_apps")
    .select("create_budget_usd")
    .eq("slug", slug)
    .eq("owner_user_id", userId)
    .maybeSingle();
  const row = data as { create_budget_usd: number | string | null } | null;
  if (!row) return null;
  const spent = await createSpendUsd(supabase, userId, slug);
  return budgetMeter(
    Number(row.create_budget_usd ?? DEFAULT_CREATE_BUDGET_USD),
    spent
  );
}

/** True when the project's Create budget is exhausted (gateway 429). */
export function budgetExhausted(meter: BudgetMeter): boolean {
  return meter.spent_usd >= meter.budget_usd;
}

/**
 * The owner's new budget, validated against the plan: non-negative, two
 * decimals, and never above the monthly cap (the cap is the real ceiling).
 */
export function clampBudget(requested: number, monthlyCapUsd: number): number {
  if (!Number.isFinite(requested) || requested < 0) {
    throw new RangeError("budget must be a non-negative number");
  }
  const cap = Number.isFinite(monthlyCapUsd) ? Math.max(0, monthlyCapUsd) : 0;
  return Math.round(Math.min(requested, cap) * 100) / 100;
}
