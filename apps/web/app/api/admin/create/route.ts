/**
 * V12 §12 `GET /api/admin/create` — the Create funnel for the operator
 * dashboard (`gratitude5dee/admin` /create). Aggregates create_intakes by
 * stage, the stage-to-stage medians from the intake timestamps, builds by
 * status and first hard rule (create_builds), the QA distribution and the
 * tests ratio (miniapp_versions), the mirror tally and the template
 * breakdown, over `?days=` (default 30). Every input is metadata (CR21):
 * stages, timestamps, statuses, rule ids, scores and counts.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import {
  asBuildMeta,
  asIntakeMeta,
  asVersionMeta,
  buildsFrom,
  byTemplateFrom,
  funnelFrom,
  mediansFrom,
  mirrorFrom,
  qaFrom,
  testsFrom,
  type BuildMeta,
  type IntakeMeta,
  type VersionMeta,
} from "@/lib/admin/createOps";
import { serviceClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const PAGE = 1000;

const INTAKE_COLUMNS =
  "stage, template, opened_at, confirmed_at, dev_ready_at, production_at, mirror_error, updated_at";
const BUILD_COLUMNS = "status, findings, started_at";
const VERSION_COLUMNS = "qa_score, tests_total, tests_passed, mirrored_at, created_at";

function windowDays(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get("days");
  if (!raw) return DEFAULT_WINDOW_DAYS;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
    return null;
  }
  return days;
}

/** Page one table's metadata rows since `sinceIso`; a read error reads as no rows. */
async function pageSince<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  sinceColumn: string,
  sinceIso: string,
  adapt: (row: Record<string, unknown>) => T,
  equals: Record<string, string> = {}
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase.from(table).select(columns).gte(sinceColumn, sinceIso);
    for (const [column, value] of Object.entries(equals)) query = query.eq(column, value);
    const { data, error } = await query
      .order(sinceColumn, { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break; // unapplied migration reads as no data, never a 500
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of rows) out.push(adapt(row));
    if (rows.length < PAGE) break;
  }
  return out;
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

  // Intakes touched in the window (any stage move bumps updated_at), builds
  // started in it, versions recorded in it.
  const [intakes, builds, versions, budgetHits] = await Promise.all([
    pageSince<IntakeMeta>(supabase, "create_intakes", INTAKE_COLUMNS, "updated_at", sinceIso, asIntakeMeta),
    pageSince<BuildMeta>(supabase, "create_builds", BUILD_COLUMNS, "started_at", sinceIso, asBuildMeta),
    pageSince<VersionMeta>(supabase, "miniapp_versions", VERSION_COLUMNS, "created_at", sinceIso, asVersionMeta),
    pageSince<true>(
      supabase,
      "ops_events",
      "id, created_at",
      "created_at",
      sinceIso,
      () => true,
      { kind: "rate_limited", ref: "create_budget" }
    ),
  ]);

  return NextResponse.json({
    window_days: days,
    funnel: funnelFrom(intakes),
    medians_s: mediansFrom(intakes),
    builds: buildsFrom(builds),
    qa: qaFrom(versions),
    tests: testsFrom(versions),
    // The relay (lib/create/progress.ts) records no ops_events kinds yet;
    // these read zero until it does (see docs/platform.md §Operations).
    progress_relay: { cards_updated: 0, text_fallbacks: 0, update_failures: 0 },
    mirror: mirrorFrom(versions, intakes),
    budget_exhausted: budgetHits.length,
    by_template: byTemplateFrom(intakes),
  });
}
