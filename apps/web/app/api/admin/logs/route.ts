/**
 * `GET /api/admin/logs` — one merged, pageable event stream for the operator
 * dashboard. Sources today:
 *   - ops_events         (store/mini-app ops counters: opens, publishes,
 *                         drops, builds, releases, rate limits, …)
 *   - miniapp_gate_events(app_opened / gate_challenged / gate_settled with
 *                         the gate that fired: token, guest, password, x402)
 * Filters: `user_id`, `kind`, `source` (ops|gate|all), `app` (registry slug —
 * matches gate rows by join and ops rows by `ref`, which is where mini-app
 * kinds carry the slug), `limit` (≤500), `before` (created_at cursor, ISO).
 * Response: `{ events, next_before? }` newest-first, every row reduced to
 * metadata — kind, slug, user id, ref, bytes, ts (C4/L4: no content).
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { guardResponse, requireAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const SOURCES = new Set(["ops", "gate", "all"]);
const UUID_RE = /^[0-9a-f-]{36}$/i;

interface LogEvent {
  ts: string;
  source: "ops" | "gate";
  kind: string;
  app_slug: string | null;
  user_id: string | null;
  ref: string | null;
  bytes: number | null;
}

interface RawRow {
  created_at: string;
  kind: string;
  user_id: string | null;
  ref: string | null;
  bytes?: number | null;
  app_id?: string;
  mini_apps?: { slug: string } | { slug: string }[] | null;
}

function slugOf(row: RawRow): string | null {
  const rel = row.mini_apps;
  if (Array.isArray(rel)) return rel[0]?.slug ?? null;
  return rel?.slug ?? null;
}

interface LogFilters {
  user_id: string | undefined;
  kind: string | undefined;
  app: string | undefined;
  before: string;
  limit: number;
}

async function opsEvents(
  supabase: SupabaseClient,
  filters: LogFilters
): Promise<LogEvent[]> {
  let query = supabase
    .from("ops_events")
    .select("created_at, kind, user_id, ref, bytes")
    .lt("created_at", filters.before)
    .order("created_at", { ascending: false })
    .limit(filters.limit);
  if (filters.user_id) query = query.eq("user_id", filters.user_id);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.app) query = query.eq("ref", filters.app);
  const { data, error } = await query;
  if (error) throw new Error(`ops_events read failed: ${error.message}`);
  return (data as RawRow[]).map((row) => ({
    ts: row.created_at,
    source: "ops",
    kind: row.kind,
    app_slug: row.ref,
    user_id: row.user_id,
    ref: row.ref,
    bytes: row.bytes ?? null,
  }));
}

async function gateEvents(
  supabase: SupabaseClient,
  filters: LogFilters
): Promise<LogEvent[]> {
  // The slug lives on the joined registry row; !inner makes the eq a filter.
  const select = filters.app
    ? "created_at, kind, user_id, ref, mini_apps!inner(slug)"
    : "created_at, kind, user_id, ref, mini_apps(slug)";
  let query = supabase
    .from("miniapp_gate_events")
    .select(select)
    .lt("created_at", filters.before)
    .order("created_at", { ascending: false })
    .limit(filters.limit);
  if (filters.app) query = query.eq("mini_apps.slug", filters.app);
  if (filters.user_id) query = query.eq("user_id", filters.user_id);
  if (filters.kind) query = query.eq("kind", filters.kind);
  const { data, error } = await query;
  if (error) throw new Error(`miniapp_gate_events read failed: ${error.message}`);
  return (data as RawRow[]).map((row) => ({
    ts: row.created_at,
    source: "gate",
    kind: row.kind,
    app_slug: slugOf(row),
    user_id: row.user_id,
    ref: row.ref,
    bytes: null,
  }));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;

  const params = request.nextUrl.searchParams;
  const userId = params.get("user_id") ?? undefined;
  if (userId && !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "invalid user_id" }, { status: 400 });
  }
  const kind = params.get("kind") ?? undefined;
  const app = params.get("app") ?? undefined;
  const source = params.get("source") ?? "all";
  if (!SOURCES.has(source)) {
    return NextResponse.json({ error: "invalid source" }, { status: 400 });
  }
  const limitRaw = Number(params.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.trunc(limitRaw)), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const before = params.get("before") ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(before))) {
    return NextResponse.json({ error: "invalid before cursor" }, { status: 400 });
  }

  const supabase = serviceClient();
  const filters = { user_id: userId, kind, app, before, limit };
  const wantOps = source === "all" || source === "ops";
  const wantGate = source === "all" || source === "gate";
  const [ops, gate] = await Promise.all([
    wantOps ? opsEvents(supabase, filters) : Promise.resolve([]),
    wantGate ? gateEvents(supabase, filters) : Promise.resolve([]),
  ]);
  const events = [...ops, ...gate]
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
    .slice(0, limit);
  const last = events[events.length - 1];
  return NextResponse.json({
    events,
    ...(events.length === limit && last ? { next_before: last.ts } : {}),
  });
}
