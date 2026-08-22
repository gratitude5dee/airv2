/**
 * Operator activity time series: run counts, token volume, gateway cost,
 * metered box seconds (agent_runs receipts) and box wake/stop counts
 * (box_state_events power ledger) bucketed by hour (windows <= 2 days) or by
 * day. Optional `user_id` narrows the series to one user for drill-down
 * views. Metadata only — no message content ever reaches the control plane
 * (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 365;
const HOURLY_MAX_DAYS = 2;
const PAGE = 1000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

interface Point {
  ts: string;
  runs: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  box_seconds: number;
  starts: number;
  stops: number;
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
  const userId = request.nextUrl.searchParams.get("user_id");

  const bucketMs = days <= HOURLY_MAX_DAYS ? HOUR_MS : DAY_MS;
  const now = Date.now();
  const since = Math.floor((now - days * DAY_MS) / bucketMs) * bucketMs;
  const sinceIso = new Date(since).toISOString();

  // Pre-seed every bucket in the window so quiet periods chart as zero
  // rather than vanishing from the x axis.
  const points = new Map<number, Point>();
  for (let ts = since; ts <= now; ts += bucketMs) {
    points.set(ts, {
      ts: new Date(ts).toISOString(),
      runs: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost_usd: 0,
      box_seconds: 0,
      starts: 0,
      stops: 0,
    });
  }
  const bucketFor = (iso: string): Point | undefined =>
    points.get(Math.floor(new Date(iso).getTime() / bucketMs) * bucketMs);

  const supabase = serviceClient();
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from("agent_runs")
      .select(
        "user_id, started_at, prompt_tokens, completion_tokens, cost_usd, box_seconds"
      )
      .gte("started_at", sinceIso);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query
      .order("started_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break; // unapplied migration reads as no data, never a 500
    const rows = data ?? [];
    for (const row of rows) {
      const point = bucketFor(row.started_at as string);
      if (!point) continue;
      point.runs += 1;
      point.prompt_tokens += Number(row.prompt_tokens ?? 0);
      point.completion_tokens += Number(row.completion_tokens ?? 0);
      point.cost_usd += Number(row.cost_usd ?? 0);
      point.box_seconds += Number(row.box_seconds ?? 0);
    }
    if (rows.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from("box_state_events")
      .select("user_id, state, created_at")
      .gte("created_at", sinceIso);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break; // series still useful without the power ledger
    const rows = data ?? [];
    for (const row of rows) {
      const point = bucketFor(row.created_at as string);
      if (!point) continue;
      if (String(row.state ?? "") === "stopped") point.stops += 1;
      else point.starts += 1; // 'ready' and the V8 'keepawake' wakes
    }
    if (rows.length < PAGE) break;
  }

  const series = [...points.values()].map((point) => ({
    ...point,
    cost_usd: Number(point.cost_usd.toFixed(6)),
  }));

  return NextResponse.json({
    window_days: days,
    since: sinceIso,
    bucket: bucketMs === HOUR_MS ? "hour" : "day",
    user_id: userId ?? null,
    points: series,
  });
}
