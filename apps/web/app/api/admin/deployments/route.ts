/**
 * V12 §12 `GET /api/admin/deployments` — "what is live where" for the
 * operator dashboard (`gratitude5dee/admin` /deployments): the control
 * plane's own deploy facts (Vercel env), the Kit version, one Dispatcher
 * health probe, the fleet channels, Create app totals and one row per
 * Create app joined with its latest build, its draft/live/dev version rows
 * and its Functions state. `?channel=dev|prod`, `?user_id=`, `?limit=`
 * (default 100, max 500). Metadata only (C4): versions, statuses, counts,
 * hashes and timestamps — never bundle contents, prompts or owner text.
 */
import { NextRequest, NextResponse } from "next/server";
import { hard, latestBuild, type BuildState } from "@/lib/create/build";
import { kitVersion, restrictedConfig } from "@/lib/create/kit";
import { listVersions, type VersionRow } from "@/lib/create/versions";
import { env } from "@/lib/env";
import { listChannels, type Channel } from "@/lib/fleet/channels";
import { loadFunctions, type FunctionsStatus } from "@/lib/functions/backend";
import { appOriginLaneReady } from "@/lib/functions/deploy";
import {
  parseRegistryApp,
  REGISTRY_COLUMNS,
  type CreateLane,
  type MiniAppStatus,
  type MiniAppVisibility,
  type RegistryApp,
} from "@/lib/miniapps/registry";
import { serviceClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardResponse, requireAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = 1000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const JOIN_CONCURRENCY = 8;
const VERSIONS_PER_APP = 50;
const DISPATCHER_TIMEOUT_MS = 2_000;
const EXPIRING_SOON_MS = 7 * 86_400_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Channel_ = "dev" | "prod";

interface DeploymentRow {
  slug: string;
  username: string | null;
  appname: string | null;
  lane: CreateLane | null;
  status: MiniAppStatus;
  visibility: MiniAppVisibility;
  listed: boolean;
  dev_version: string | null;
  dev_expires_at: string | null;
  live_version: string | null;
  draft_version: string | null;
  last_build: { status: BuildState; finished_at: string | null; findings_hard: number } | null;
  qa_score: number | null;
  tests: { passed: number; total: number } | null;
  worker_sha256_prefix: string | null;
  functions_status: FunctionsStatus;
  mirrored_at: string | null;
}

function devLive(app: RegistryApp, now: number): boolean {
  if (!app.dev_version || !app.dev_expires_at) return false;
  const expires = new Date(app.dev_expires_at).getTime();
  return Number.isFinite(expires) && expires > now;
}

function prodLive(app: RegistryApp): boolean {
  return app.status === "published" && app.bundle_version !== null;
}

function channelParam(request: NextRequest): Channel_ | null | undefined {
  const raw = request.nextUrl.searchParams.get("channel");
  if (!raw) return null;
  return raw === "dev" || raw === "prod" ? raw : undefined;
}

function limitParam(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get("limit");
  if (!raw) return DEFAULT_LIMIT;
  const limit = Number(raw);
  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}

/** Every Create app (lane set), newest change first; optionally one owner's. */
async function listCreateApps(
  supabase: SupabaseClient,
  userId: string | null
): Promise<RegistryApp[]> {
  const apps: RegistryApp[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase.from("mini_apps").select(REGISTRY_COLUMNS).not("lane", "is", null);
    if (userId) query = query.eq("owner_user_id", userId);
    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) break; // an unapplied column reads as no apps, never a 500
    const rows = data ?? [];
    for (const row of rows) {
      const app = parseRegistryApp(row);
      if (app) apps.push(app);
    }
    if (rows.length < PAGE) break;
  }
  return apps;
}

async function dispatcherStatus(): Promise<{ healthy: boolean | null; checked_at: string | null }> {
  if (!appOriginLaneReady()) return { healthy: null, checked_at: null };
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(env.cfDispatchHealthUrl(), {
      method: "GET",
      signal: AbortSignal.timeout(DISPATCHER_TIMEOUT_MS),
    });
    return { healthy: response.ok, checked_at: checkedAt };
  } catch {
    return { healthy: false, checked_at: checkedAt };
  }
}

async function rowFor(supabase: SupabaseClient, app: RegistryApp): Promise<DeploymentRow> {
  const [build, versions, functions] = await Promise.all([
    latestBuild(supabase, app.id).catch(() => null),
    listVersions(supabase, app.id, VERSIONS_PER_APP).catch((): VersionRow[] => []),
    loadFunctions(supabase, app.id).catch(() => null),
  ]);
  const byVersion = new Map(versions.map((row) => [row.version, row]));
  const live = app.status === "published" && app.bundle_version ? byVersion.get(app.bundle_version) : undefined;
  const draft = app.draft_version ? byVersion.get(app.draft_version) : undefined;
  const dev = app.dev_version ? byVersion.get(app.dev_version) : undefined;
  // The row the operator is looking at: the draft in progress, else the dev
  // release, else the live version, else the newest recorded version.
  const focus = draft ?? dev ?? live ?? versions[0];
  const worker = live?.worker_sha256 ?? focus?.worker_sha256 ?? null;
  const mirrored = versions.find((row) => row.mirrored_at)?.mirrored_at ?? null;
  const testsTotal = focus?.tests_total ?? null;
  return {
    slug: app.slug,
    username: app.publisher_username,
    appname: app.appname,
    lane: app.lane,
    status: app.status,
    visibility: app.visibility,
    listed: app.listed_at !== null,
    dev_version: app.dev_version ?? null,
    dev_expires_at: app.dev_expires_at ?? null,
    live_version: app.status === "published" ? app.bundle_version : null,
    draft_version: app.draft_version,
    last_build: build
      ? { status: build.status, finished_at: build.finished_at, findings_hard: hard(build.findings).length }
      : null,
    qa_score: focus?.qa_score ?? null,
    tests: testsTotal === null ? null : { passed: focus?.tests_passed ?? 0, total: testsTotal },
    worker_sha256_prefix: worker ? worker.slice(0, 7) : null,
    functions_status: functions?.status ?? "disabled",
    mirrored_at: mirrored,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const channel = channelParam(request);
  if (channel === undefined) {
    return NextResponse.json({ error: "channel must be dev or prod" }, { status: 400 });
  }
  const limit = limitParam(request);
  if (limit === null) {
    return NextResponse.json({ error: `limit must be an integer 1-${MAX_LIMIT}` }, { status: 400 });
  }
  const userId = request.nextUrl.searchParams.get("user_id");
  if (userId && !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "user_id must be a uuid" }, { status: 400 });
  }

  const supabase = serviceClient();
  const now = Date.now();
  const [apps, channels, dispatcher] = await Promise.all([
    listCreateApps(supabase, userId),
    listChannels(supabase).catch((): Channel[] => []),
    dispatcherStatus(),
  ]);

  const totals = { total: apps.length, dev_live: 0, prod_live: 0, drafts_only: 0, expiring_7d: 0 };
  for (const app of apps) {
    const dev = devLive(app, now);
    const prod = prodLive(app);
    if (dev) totals.dev_live += 1;
    if (prod) totals.prod_live += 1;
    if (!dev && !prod) totals.drafts_only += 1;
    if (dev && new Date(app.dev_expires_at!).getTime() - now <= EXPIRING_SOON_MS) {
      totals.expiring_7d += 1;
    }
  }

  const selected = apps
    .filter((app) =>
      channel === "dev" ? app.dev_version !== null : channel === "prod" ? prodLive(app) : true
    )
    .slice(0, limit);
  const rows: DeploymentRow[] = [];
  for (let start = 0; start < selected.length; start += JOIN_CONCURRENCY) {
    const chunk = selected.slice(start, start + JOIN_CONCURRENCY);
    rows.push(...(await Promise.all(chunk.map((app) => rowFor(supabase, app)))));
  }

  return NextResponse.json({
    control_plane: {
      git_sha: process.env["VERCEL_GIT_COMMIT_SHA"] ?? null,
      deployed_at: process.env["VERCEL_DEPLOYMENT_CREATED_AT"] ?? null,
      region: process.env["VERCEL_REGION"] ?? null,
    },
    kit: { version: kitVersion(), restricted_version: restrictedConfig()?.version ?? null },
    dispatcher,
    channels,
    apps: totals,
    rows,
  });
}
