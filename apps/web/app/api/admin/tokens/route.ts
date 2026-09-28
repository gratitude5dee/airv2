/**
 * Operator token metering: per-user prompt/completion token volume and gateway
 * cost over a date window, aggregated from the agent_runs receipts the gateway
 * writes (migration 0056 persists the token counts). Metadata only — prompts
 * and completions never reach the control plane (C4).
 *
 * V12 §12: `?group=user|model|family|provider|tier|lane|stage|project`
 * regroups the same receipts (`groups: [...]`, `group`), with
 * `cost_estimated` set when GMI served a list-estimated slug. The `users`
 * rows stay as they were so the existing Tokens tab binds unchanged.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  aggregateGroups,
  asTokensRun,
  isTokensGroup,
  TOKENS_GROUPS,
  TOKENS_RUN_COLUMNS,
  type TokensGroup,
  type TokensRun,
} from "@/lib/admin/tokenGroups";
import { serviceClient } from "@/lib/supabase";
import { guardResponse, requireAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const PAGE = 1000;

function windowDays(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get("days");
  if (!raw) return DEFAULT_WINDOW_DAYS;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
    return null;
  }
  return days;
}

function groupParam(request: NextRequest): TokensGroup | null {
  const raw = request.nextUrl.searchParams.get("group");
  if (!raw) return "user";
  return isTokensGroup(raw) ? raw : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const days = windowDays(request);
  if (days === null) {
    return NextResponse.json(
      { error: `days must be an integer 1-${MAX_WINDOW_DAYS}` },
      { status: 400 }
    );
  }
  const group = groupParam(request);
  if (group === null) {
    return NextResponse.json(
      { error: `group must be one of ${TOKENS_GROUPS.join("|")}` },
      { status: 400 }
    );
  }
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = serviceClient();
  const runs: TokensRun[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("agent_runs")
      .select(TOKENS_RUN_COLUMNS)
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break; // unapplied migration reads as no data, never a 500
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of rows) runs.push(asTokensRun(row));
    if (rows.length < PAGE) break;
  }

  const groups = aggregateGroups(runs, group);
  const users = (group === "user" ? groups : aggregateGroups(runs, "user")).map((entry) => ({
    user_id: entry.key,
    runs: entry.runs,
    prompt_tokens: entry.prompt_tokens,
    completion_tokens: entry.completion_tokens,
    total_tokens: entry.total_tokens,
    cost_usd: entry.cost_usd,
  }));

  return NextResponse.json({
    window_days: days,
    since: sinceIso,
    totals: {
      prompt_tokens: users.reduce((sum, row) => sum + row.prompt_tokens, 0),
      completion_tokens: users.reduce(
        (sum, row) => sum + row.completion_tokens,
        0
      ),
      cost_usd: Number(
        users.reduce((sum, row) => sum + row.cost_usd, 0).toFixed(6)
      ),
    },
    users,
    group,
    groups,
  });
}
