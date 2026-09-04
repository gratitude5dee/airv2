/**
 * Operator box usage: per-user box state (from `boxes`), start/stop counts in
 * the window (from the `box_state_events` power ledger), and metered
 * box_seconds from the agent_runs receipts. Each row is labeled with the
 * user's username, verified handles, and provider box id so an operator can
 * identify a specific user's box without cross-referencing /api/admin/users.
 * Fleet position rides along: channel, baseline_version (the template release
 * sync-box.sh last converged the box to), baseline_synced_at, and
 * template_version (the pinned Hermes ref once a release with hermes_ref has
 * been applied). Identity and usage metadata only — no message content, prompts, or memory
 * (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 365;
const PAGE = 1000;

interface UserBox {
  user_id: string;
  username: string | null;
  phone: string | null;
  handles: Array<{ platform: string; address: string }>;
  provider_box_id: string | null;
  state: string | null;
  provider: string | null;
  channel: string | null;
  template_version: string | null;
  baseline_version: string | null;
  baseline_synced_at: string | null;
  last_active_at: string | null;
  stop_after: string | null;
  created_at: string | null;
  starts: number;
  stops: number;
  runs: number;
  box_seconds: number;
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
      { status: 400 },
    );
  }
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = serviceClient();
  const users = new Map<string, UserBox>();
  const forUser = (userId: string): UserBox => {
    let entry = users.get(userId);
    if (!entry) {
      entry = {
        user_id: userId,
        username: null,
        phone: null,
        handles: [],
        provider_box_id: null,
        state: null,
        provider: null,
        channel: null,
        template_version: null,
        baseline_version: null,
        baseline_synced_at: null,
        last_active_at: null,
        stop_after: null,
        created_at: null,
        starts: 0,
        stops: 0,
        runs: 0,
        box_seconds: 0,
      };
      users.set(userId, entry);
    }
    return entry;
  };

  const { data: events } = await supabase
    .from("box_state_events")
    .select("user_id, state")
    .gte("created_at", sinceIso)
    .limit(50_000);

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("boxes")
      .select(
        "user_id, provider, provider_box_id, state, channel, template_version, baseline_version, baseline_synced_at, last_active_at, stop_after, created_at",
      )
      .order("user_id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break;
    const boxes = data ?? [];
    for (const row of boxes) {
      const entry = forUser(row.user_id as string);
      entry.state = (row.state as string | null) ?? null;
      entry.provider = (row.provider as string | null) ?? null;
      entry.provider_box_id = (row.provider_box_id as string | null) ?? null;
      entry.channel = (row.channel as string | null) ?? null;
      entry.template_version = (row.template_version as string | null) ?? null;
      entry.baseline_version = (row.baseline_version as string | null) ?? null;
      entry.baseline_synced_at =
        (row.baseline_synced_at as string | null) ?? null;
      entry.last_active_at = (row.last_active_at as string | null) ?? null;
      entry.stop_after = (row.stop_after as string | null) ?? null;
      entry.created_at = (row.created_at as string | null) ?? null;
    }
    if (boxes.length < PAGE) break;
  }
  for (const row of events ?? []) {
    const entry = forUser(row.user_id as string);
    const state = String(row.state ?? "");
    if (state === "stopped") entry.stops += 1;
    else entry.starts += 1; // 'ready' and the V8 'keepawake' wakes
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("agent_runs")
      .select("user_id, box_seconds")
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break;
    const rows = data ?? [];
    for (const row of rows) {
      const entry = forUser(row.user_id as string);
      entry.runs += 1;
      entry.box_seconds += Number(row.box_seconds ?? 0);
    }
    if (rows.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("users")
      .select("id, username")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break; // usage view still useful without names
    const rows = data ?? [];
    for (const row of rows) {
      const entry = users.get(row.id as string);
      if (entry) entry.username = (row.username as string | null) ?? null;
    }
    if (rows.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("handles")
      .select("user_id, platform, address")
      .not("verified_at", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break; // usage view still useful without handles
    const rows = data ?? [];
    for (const row of rows) {
      const entry = users.get(row.user_id as string);
      if (!entry) continue;
      const platform = row.platform as string;
      const address = row.address as string;
      entry.handles.push({ platform, address });
      if (
        !entry.phone &&
        (platform === "imessage" || platform === "whatsapp")
      ) {
        entry.phone = address;
      }
    }
    if (rows.length < PAGE) break;
  }

  const rows = [...users.values()].sort(
    (a, b) => b.box_seconds - a.box_seconds,
  );
  const states = new Map<string, number>();
  for (const row of rows) {
    const key = row.state ?? "none";
    states.set(key, (states.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    window_days: days,
    since: sinceIso,
    totals: {
      boxes: rows.length,
      by_state: Object.fromEntries(states),
      starts: rows.reduce((sum, row) => sum + row.starts, 0),
      stops: rows.reduce((sum, row) => sum + row.stops, 0),
      box_seconds: rows.reduce((sum, row) => sum + row.box_seconds, 0),
    },
    users: rows,
  });
}
