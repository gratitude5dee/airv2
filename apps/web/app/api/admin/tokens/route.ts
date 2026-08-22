/**
 * Operator token metering: per-user prompt/completion token volume and gateway
 * cost over a date window, aggregated from the agent_runs receipts the gateway
 * writes (migration 0056 persists the token counts). Metadata only — prompts
 * and completions never reach the control plane (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const PAGE = 1000;

interface UserTokens {
  user_id: string;
  runs: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

function windowDays(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get("days");
  if (!raw) return DEFAULT_WINDOW_DAYS;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
    return null;
  }
  return days;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const days = windowDays(request);
  if (days === null) {
    return NextResponse.json(
      { error: `days must be an integer 1-${MAX_WINDOW_DAYS}` },
      { status: 400 }
    );
  }
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = serviceClient();
  const users = new Map<string, UserTokens>();
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("agent_runs")
      .select("user_id, prompt_tokens, completion_tokens, cost_usd")
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break; // unapplied migration reads as no data, never a 500
    const rows = data ?? [];
    for (const row of rows) {
      const userId = row.user_id as string;
      let entry = users.get(userId);
      if (!entry) {
        entry = {
          user_id: userId,
          runs: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost_usd: 0,
        };
        users.set(userId, entry);
      }
      entry.runs += 1;
      entry.prompt_tokens += Number(row.prompt_tokens ?? 0);
      entry.completion_tokens += Number(row.completion_tokens ?? 0);
      entry.cost_usd += Number(row.cost_usd ?? 0);
    }
    if (rows.length < PAGE) break;
  }

  const rows = [...users.values()].map((entry) => ({
    ...entry,
    total_tokens: entry.prompt_tokens + entry.completion_tokens,
    cost_usd: Number(entry.cost_usd.toFixed(6)),
  }));
  rows.sort((a, b) => b.total_tokens - a.total_tokens);

  return NextResponse.json({
    window_days: days,
    since: sinceIso,
    totals: {
      prompt_tokens: rows.reduce((sum, row) => sum + row.prompt_tokens, 0),
      completion_tokens: rows.reduce(
        (sum, row) => sum + row.completion_tokens,
        0
      ),
      cost_usd: Number(
        rows.reduce((sum, row) => sum + row.cost_usd, 0).toFixed(6)
      ),
    },
    users: rows,
  });
}
