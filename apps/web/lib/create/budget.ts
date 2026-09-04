/**
 * Per-project Create budget (goal-create-v11 §9.1). A Create turn opens an
 * agent_runs row labelled `create:<slug>` and pins the run's model to
 * `create-<tier>:<slug>`; every gateway completion carrying that model is
 * metered under the same label, so the project's spend is a sum over its
 * own usage rows and never a copy of anything the Box holds. The owner
 * raises the budget on PATCH /api/create/projects (up to the monthly cap);
 * the agent cannot.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CREATE_LABEL_PREFIX = "create:";
export const DEFAULT_CREATE_BUDGET_USD = 5;
/** How long after it ends a Create run still attributes gateway usage. */
export const CREATE_RUN_ATTRIBUTION_MINUTES = 30;
/** An open Create run older than this never closed cleanly; it stops counting. */
export const CREATE_RUN_MAX_MINUTES = 60;
/**
 * A run row gets its hermes_run_id seconds after it is opened; one still
 * unlinked after this long belongs to a turn that failed and could not
 * close it. It stops blocking and stops attributing.
 */
export const CREATE_RUN_LINK_GRACE_MINUTES = 2;

export function createRunLabel(slug: string): string {
  return `${CREATE_LABEL_PREFIX}${slug}`;
}

export function slugFromRunLabel(label: string | null | undefined): string | null {
  if (!label || !label.startsWith(CREATE_LABEL_PREFIX)) return null;
  const slug = label.slice(CREATE_LABEL_PREFIX.length);
  return slug ? slug : null;
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export type OpenCreateRun =
  | { id: string; blocked_by: null }
  | { id: null; blocked_by: string };

/**
 * Open the user's Create run row for `slug`, or learn which other project's
 * open run blocks it. At most one Create run is open per owner (a Box works
 * one project at a time); the check and the insert run under a per-user
 * lock in `create_run_open` (0095), which also retires rows that never
 * closed cleanly. Run rows carry a trigger; the metered completion rows
 * sharing the label do not, and a run row is opened before its Hermes run
 * exists (hermes_run_id lands once it does).
 */
export async function openCreateRun(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  trigger: string
): Promise<OpenCreateRun | null> {
  const { data, error } = await supabase.rpc("create_run_open", {
    p_user_id: userId,
    p_trigger: trigger,
    p_label: createRunLabel(slug),
    p_max_minutes: CREATE_RUN_MAX_MINUTES,
    p_link_grace_minutes: CREATE_RUN_LINK_GRACE_MINUTES,
  });
  if (error) return null;
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as {
    id: string | null;
    blocked_by: string | null;
  }[];
  const row = rows[0];
  if (!row) return null;
  if (row.blocked_by) return { id: null, blocked_by: row.blocked_by };
  return row.id ? { id: row.id, blocked_by: null } : null;
}

/**
 * Whether the named project may be charged for a `create-*` gateway call
 * right now: the owner has a Create run for it that is open, or closed
 * within the attribution window (for the trailing completions that land
 * after the terminal event). The project comes from the model the Box
 * requested, so two projects running side by side each meter their own
 * calls; a slug with no such run is refused rather than guessed. An open
 * row still unlinked past the grace period is an orphan, and a closed row
 * that never got a Hermes run has no trailing completions; neither
 * attributes.
 */
export async function createRunAttributable(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<boolean> {
  const { data } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("user_id", userId)
    .eq("label", createRunLabel(slug))
    .not("trigger", "is", null)
    .or(
      `and(ended_at.is.null,started_at.gte.${minutesAgo(CREATE_RUN_MAX_MINUTES)}),` +
        `and(ended_at.gte.${minutesAgo(CREATE_RUN_ATTRIBUTION_MINUTES)},hermes_run_id.not.is.null)`
    )
    .or(`hermes_run_id.not.is.null,started_at.gte.${minutesAgo(CREATE_RUN_LINK_GRACE_MINUTES)}`)
    .limit(1)
    .maybeSingle();
  return data !== null && data !== undefined;
}

/**
 * Transitional (see parseLegacyCreateTier): the one project a project-less
 * `create-<tier>` call can belong to — the owner's sole attributable Create
 * run (open, or closed within the trailing window). Null when there is none
 * or more than one candidate project: an ambiguous legacy call is refused
 * rather than charged to whichever run happens to be newest.
 */
export async function soleAttributableCreateSlug(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("agent_runs")
    .select("label")
    .eq("user_id", userId)
    .like("label", `${CREATE_LABEL_PREFIX}%`)
    .not("trigger", "is", null)
    .or(
      `and(ended_at.is.null,started_at.gte.${minutesAgo(CREATE_RUN_MAX_MINUTES)}),` +
        `and(ended_at.gte.${minutesAgo(CREATE_RUN_ATTRIBUTION_MINUTES)},hermes_run_id.not.is.null)`
    )
    .or(`hermes_run_id.not.is.null,started_at.gte.${minutesAgo(CREATE_RUN_LINK_GRACE_MINUTES)}`)
    .limit(100);
  const slugs = new Set<string>();
  for (const row of (data ?? []) as { label: string | null }[]) {
    const slug = slugFromRunLabel(row.label);
    if (slug) slugs.add(slug);
  }
  return slugs.size === 1 ? [...slugs][0]! : null;
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
