/**
 * V13 §12 `GET /api/admin/create/jobs` — the Create page's job ops:
 * deployments (states + live dev links), the newest stuck/failed jobs for
 * the failures table, token usage over `create:<slug>` receipts by stage
 * and project, and the skill-version histogram plus upgrade count
 * (skill-use). `?days=` window, default 30. Metadata only (CR21).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { asJobMeta, jobsFrom, type JobMeta } from "@/lib/admin/createOps";
import {
  aggregateGroups,
  asTokensRun,
  TOKENS_RUN_COLUMNS,
  type TokensRun,
} from "@/lib/admin/tokenGroups";
import { CREATE_LABEL_PREFIX } from "@/lib/create/budget";
import { serviceClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const PAGE = 1000;

const JOB_COLUMNS =
  "id, app_id, kind, state, step, percent, round, error_rule, skill_ver, " +
  "dev_url, created_at, finished_at";

function windowDays(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get("days");
  if (!raw) return DEFAULT_WINDOW_DAYS;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
    return null;
  }
  return days;
}

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
    if (error) break;
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

  const [jobRows, receipts, upgrades] = await Promise.all([
    pageSince<JobMeta>(supabase, "create_jobs", JOB_COLUMNS, "created_at", sinceIso, asJobMeta),
    pageSince<TokensRun>(
      supabase,
      "agent_runs",
      TOKENS_RUN_COLUMNS,
      "started_at",
      sinceIso,
      asTokensRun
    ),
    pageSince<true>(
      supabase,
      "ops_events",
      "id",
      "created_at",
      sinceIso,
      () => true,
      { kind: "create.skill_upgrade" }
    ),
  ]);

  const createReceipts = receipts.filter(
    (run) => run.label !== null && run.label.startsWith(CREATE_LABEL_PREFIX)
  );
  const jobs = jobsFrom(jobRows);

  return NextResponse.json({
    window_days: days,
    jobs,
    token_usage: {
      by_stage: aggregateGroups(createReceipts, "stage"),
      by_project: aggregateGroups(createReceipts, "project").slice(0, 20),
    },
    skill_use: {
      upgrades_queued: upgrades.length,
      by_skill_ver: jobs.by_skill_ver,
    },
  });
}
