/**
 * Operator activity time series: run counts, token volume, gateway cost,
 * metered box seconds (agent_runs receipts) and box wake/stop counts
 * (box_state_events power ledger) bucketed by hour (windows <= 2 days) or by
 * day. Optional `user_id` narrows the series to one user for drill-down
 * views. Metadata only — no message content ever reaches the control plane
 * (C4).
 *
 * V12 §12: `?series=tokens,cost,builds,dev_releases,publishes` adds the named
 * Create series per bucket — `builds` from create_builds (started_at),
 * `dev_releases` / `publishes` from the ops_events kinds `dev_release` and
 * `publish`. `tokens` and `cost` name columns every point already carries.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { guardResponse, requireAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 365;
const HOURLY_MAX_DAYS = 2;
const PAGE = 1000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const SERIES = ["tokens", "cost", "builds", "dev_releases", "publishes"] as const;
type Series = (typeof SERIES)[number];
const OPS_KIND_SERIES: Record<"dev_release" | "publish", Series> = {
  dev_release: "dev_releases",
  publish: "publishes",
};

interface Point {
  ts: string;
  runs: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  box_seconds: number;
  starts: number;
  stops: number;
  builds?: number;
  dev_releases?: number;
  publishes?: number;
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

/** `?series=` as a set; null when a name is unknown. Absent = none extra. */
function seriesParam(request: NextRequest): Set<Series> | null {
  const raw = request.nextUrl.searchParams.get("series");
  const wanted = new Set<Series>();
  if (!raw) return wanted;
  for (const name of raw.split(",").map((part) => part.trim()).filter(Boolean)) {
    if (!(SERIES as readonly string[]).includes(name)) return null;
    wanted.add(name as Series);
  }
  return wanted;
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
  const series = seriesParam(request);
  if (series === null) {
    return NextResponse.json(
      { error: `series must be a comma list of ${SERIES.join("|")}` },
      { status: 400 }
    );
  }
  const userId = request.nextUrl.searchParams.get("user_id");

  const bucketMs = days <= HOURLY_MAX_DAYS ? HOUR_MS : DAY_MS;
  const now = Date.now();
  const since = Math.floor((now - days * DAY_MS) / bucketMs) * bucketMs;
  const sinceIso = new Date(since).toISOString();

  const wantBuilds = series.has("builds");
  const opsKinds = (Object.keys(OPS_KIND_SERIES) as (keyof typeof OPS_KIND_SERIES)[]).filter(
    (kind) => series.has(OPS_KIND_SERIES[kind])
  );

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
      ...(wantBuilds ? { builds: 0 } : {}),
      ...(series.has("dev_releases") ? { dev_releases: 0 } : {}),
      ...(series.has("publishes") ? { publishes: 0 } : {}),
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

  if (wantBuilds) {
    for (let offset = 0; ; offset += PAGE) {
      let query = supabase
        .from("create_builds")
        .select("user_id, started_at")
        .gte("started_at", sinceIso);
      if (userId) query = query.eq("user_id", userId);
      const { data, error } = await query
        .order("started_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) break; // no build ledger yet reads as zero builds
      const rows = data ?? [];
      for (const row of rows) {
        const point = bucketFor(row.started_at as string);
        if (point) point.builds = (point.builds ?? 0) + 1;
      }
      if (rows.length < PAGE) break;
    }
  }

  if (opsKinds.length > 0) {
    for (let offset = 0; ; offset += PAGE) {
      let query = supabase
        .from("ops_events")
        .select("user_id, kind, created_at")
        .in("kind", opsKinds)
        .gte("created_at", sinceIso);
      if (userId) query = query.eq("user_id", userId);
      const { data, error } = await query
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) break;
      const rows = data ?? [];
      for (const row of rows) {
        const point = bucketFor(row.created_at as string);
        const kind = String(row.kind ?? "");
        if (!point || !(kind in OPS_KIND_SERIES)) continue;
        const field = OPS_KIND_SERIES[kind as keyof typeof OPS_KIND_SERIES];
        if (field === "dev_releases") point.dev_releases = (point.dev_releases ?? 0) + 1;
        if (field === "publishes") point.publishes = (point.publishes ?? 0) + 1;
      }
      if (rows.length < PAGE) break;
    }
  }

  const points_ = [...points.values()].map((point) => ({
    ...point,
    cost_usd: Number(point.cost_usd.toFixed(6)),
  }));

  return NextResponse.json({
    window_days: days,
    since: sinceIso,
    bucket: bucketMs === HOUR_MS ? "hour" : "day",
    user_id: userId ?? null,
    series: [...series],
    points: points_,
  });
}
