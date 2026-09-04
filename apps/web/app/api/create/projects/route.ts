/**
 * V11 §14.4 projects — the Create surface's owner-facing project list.
 *
 *  - GET  lists the owner's apps with their live/draft pointers, the
 *    recorded versions for each, and the Functions flag. Metadata only:
 *    version digests and sizes, never bundle contents (CR5).
 *  - POST stages a registry draft for a new project with its lane. The Box
 *    workspace skeleton (MC4) is created by the Create session, not here.
 *  - PATCH lets the owner raise (or lower) one project's Create budget, up
 *    to their plan's monthly cap (§9.1). Only the owner — the agent never
 *    sets budgets (§9.7).
 *
 * Store session only — agents reach projects through their own lanes
 * (`/api/miniapps/publish`, later `/api/create/drop|build`), never this route.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { createDraft, ownedApp, PublishError } from "@/lib/miniapps/publish";
import { budgetMeter, clampBudget, createSpendUsd } from "@/lib/create/budget";
import {
  parseRegistryApp,
  REGISTRY_COLUMNS,
  type CreateLane,
  type RegistryApp,
} from "@/lib/miniapps/registry";
import { nestedPathFor } from "@/lib/miniapps/nested";
import { listVersions, type VersionRow } from "@/lib/create/versions";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANES: ReadonlySet<string> = new Set<CreateLane>([
  "drop",
  "vibe",
  "import",
  "push",
]);

function asLane(value: unknown): CreateLane | undefined {
  return typeof value === "string" && LANES.has(value)
    ? (value as CreateLane)
    : undefined;
}

function versionSummary(row: VersionRow) {
  return {
    version: row.version,
    lane: row.lane,
    sha256: row.bundle_sha256,
    bytes: row.bundle_bytes,
    files: row.file_count,
    worker: row.worker_sha256 !== null,
    kit_version: row.kit_version,
    findings: row.findings.length,
    qa_score: row.qa_score,
    created_at: row.created_at,
    published_at: row.published_at,
    retired_at: row.retired_at,
  };
}

function projectSummary(app: RegistryApp, versions: VersionRow[]) {
  const mini = env.miniappOrigin().replace(/\/$/, "");
  return {
    slug: app.slug,
    appname: app.appname,
    name: app.name,
    description: app.description,
    status: app.status,
    visibility: app.visibility,
    lane: app.lane,
    url: `${mini}${nestedPathFor(app.slug)}`,
    live: app.status === "published" ? app.bundle_version : null,
    draft: app.draft_version ?? app.bundle_version,
    functions_enabled: app.functions_enabled,
    kit_version: app.kit_version,
    create_budget_usd: app.create_budget_usd,
    versions: versions.map(versionSummary),
    updated_at: app.updated_at,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("mini_apps")
    .select(REGISTRY_COLUMNS)
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    throw new Error(`projects list failed: ${error.message}`);
  }
  const apps = (data ?? [])
    .map(parseRegistryApp)
    .filter((app): app is RegistryApp => app !== null);
  const projects = await Promise.all(
    apps.map(async (app) =>
      projectSummary(app, await listVersions(supabase, app.id, 20))
    )
  );
  return NextResponse.json({ projects });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    slug?: unknown;
    create_budget_usd?: unknown;
  } | null;
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  const requested = body?.create_budget_usd;
  if (typeof requested !== "number" || !Number.isFinite(requested) || requested < 0) {
    return NextResponse.json({ error: "invalid create_budget_usd" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const app = await ownedApp(supabase, userId, slug);
    const { data: entitlement } = await supabase
      .from("entitlements")
      .select("monthly_cap_usd")
      .eq("user_id", userId)
      .maybeSingle();
    const cap = Number((entitlement as { monthly_cap_usd?: unknown } | null)?.monthly_cap_usd ?? 0);
    const budget = clampBudget(requested, cap);
    const { error } = await supabase
      .from("mini_apps")
      .update({ create_budget_usd: budget })
      .eq("id", app.id)
      .eq("owner_user_id", userId);
    if (error) throw new Error(`budget update failed: ${error.message}`);
    const spent = await createSpendUsd(supabase, userId, app.slug);
    return NextResponse.json({
      ok: true,
      slug: app.slug,
      monthly_cap_usd: cap,
      budget: budgetMeter(budget, spent),
    });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    appname?: unknown;
    name?: unknown;
    description?: unknown;
    lane?: unknown;
  } | null;
  const lane = asLane(body?.lane);
  if (body?.lane !== undefined && !lane) {
    return NextResponse.json({ error: "invalid lane" }, { status: 400 });
  }
  try {
    const app = await createDraft(serviceClient(), userId, {
      appname: typeof body?.appname === "string" ? body.appname : "",
      name: typeof body?.name === "string" ? body.name : "",
      description:
        typeof body?.description === "string" ? body.description : "",
      lane,
    });
    return NextResponse.json({
      ok: true,
      slug: app.slug,
      url: `${env.miniappOrigin().replace(/\/$/, "")}${nestedPathFor(app.slug)}`,
    });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
