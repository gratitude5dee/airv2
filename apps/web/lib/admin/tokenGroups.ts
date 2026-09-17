/**
 * V12 §12 — grouping the gateway's `agent_runs` receipts for the admin
 * Tokens page (`GET /api/admin/tokens?group=`). Every key is metadata the
 * receipt already carries: the user id, the served slug, the family, the
 * upstream provider, the speed tier, the Create lane (`create:*` labels vs
 * chat), the Create stage (§7.3) and the Create project (`create:<slug>`).
 * No prompt or completion text is ever part of a receipt (C4).
 */
import {
  isEstimatedPrice,
  isModelFamily,
  providerForFamily,
} from "../entitlements/models";

export const TOKENS_GROUPS = [
  "user",
  "model",
  "family",
  "provider",
  "tier",
  "lane",
  "stage",
  "project",
] as const;
export type TokensGroup = (typeof TOKENS_GROUPS)[number];

export function isTokensGroup(value: unknown): value is TokensGroup {
  return (
    typeof value === "string" && (TOKENS_GROUPS as readonly string[]).includes(value)
  );
}

/** The receipt columns the grouping reads (all metadata). */
export const TOKENS_RUN_COLUMNS =
  "user_id, prompt_tokens, completion_tokens, cost_usd, model, model_family, " +
  "speed_tier, label, create_stage";

export interface TokensRun {
  user_id: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | string | null;
  model: string | null;
  model_family: string | null;
  speed_tier: string | null;
  label: string | null;
  create_stage: string | null;
}

export interface TokensGroupRow {
  key: string;
  runs: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_estimated: boolean;
}

export const CREATE_LABEL_PREFIX = "create:";
export const UNKNOWN_KEY = "unknown";
export const CHAT_KEY = "chat";

export function asTokensRun(row: Record<string, unknown>): TokensRun {
  const str = (value: unknown): string | null =>
    typeof value === "string" && value !== "" ? value : null;
  const num = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    user_id: String(row["user_id"] ?? ""),
    prompt_tokens: num(row["prompt_tokens"]),
    completion_tokens: num(row["completion_tokens"]),
    cost_usd: num(row["cost_usd"]),
    model: str(row["model"]),
    model_family: str(row["model_family"]),
    speed_tier: str(row["speed_tier"]),
    label: str(row["label"]),
    create_stage: str(row["create_stage"]),
  };
}

function isCreateLabel(label: string | null): label is string {
  return label !== null && label.startsWith(CREATE_LABEL_PREFIX);
}

/** The bucket a receipt falls into for `group`. */
export function groupKeyFor(run: TokensRun, group: TokensGroup): string {
  switch (group) {
    case "user":
      return run.user_id || UNKNOWN_KEY;
    case "model":
      return run.model ?? UNKNOWN_KEY;
    case "family":
      return run.model_family ?? UNKNOWN_KEY;
    case "provider":
      return run.model_family !== null && isModelFamily(run.model_family)
        ? providerForFamily(run.model_family)
        : UNKNOWN_KEY;
    case "tier":
      return run.speed_tier ?? UNKNOWN_KEY;
    case "lane":
      return isCreateLabel(run.label) ? "create" : CHAT_KEY;
    case "stage":
      return run.create_stage ?? "none";
    case "project":
      // `create:<slug>` is the project; everything else is chat spend.
      return isCreateLabel(run.label) ? run.label : CHAT_KEY;
    default: {
      const never: never = group;
      return never;
    }
  }
}

/**
 * A receipt's cost is an estimate when GMI served a catalog slug whose
 * price is still the OpenAI list (Astra, Luna on GMI). The same slug served
 * by OpenAI is priced by the metered tier table and is not flagged.
 */
export function runCostEstimated(run: TokensRun): boolean {
  return run.model_family === "gmi" && run.model !== null && isEstimatedPrice(run.model);
}

/** Aggregate receipts into groups, largest total first. */
export function aggregateGroups(
  runs: Iterable<TokensRun>,
  group: TokensGroup
): TokensGroupRow[] {
  const groups = new Map<string, TokensGroupRow>();
  for (const run of runs) {
    const key = groupKeyFor(run, group);
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        key,
        runs: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        cost_estimated: false,
      };
      groups.set(key, entry);
    }
    entry.runs += 1;
    entry.prompt_tokens += run.prompt_tokens ?? 0;
    entry.completion_tokens += run.completion_tokens ?? 0;
    entry.cost_usd += Number(run.cost_usd ?? 0);
    if (runCostEstimated(run)) entry.cost_estimated = true;
  }
  const rows = [...groups.values()].map((entry) => ({
    ...entry,
    total_tokens: entry.prompt_tokens + entry.completion_tokens,
    cost_usd: Number(entry.cost_usd.toFixed(6)),
  }));
  rows.sort((a, b) => b.total_tokens - a.total_tokens || a.key.localeCompare(b.key));
  return rows;
}
