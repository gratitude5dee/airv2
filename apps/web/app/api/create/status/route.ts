/**
 * V11 §14.1 `GET /api/create/status?slug=` (or `?app=<appname>`) — what the
 * owner (or the owner's Box) staged and what is live for one app: the live
 * and draft versions with their lint findings, the owner-only preview link,
 * the latest build (state + a content-free log tail), the draft's QA score
 * and the project's Create budget meter (MC4). Owner-scoped (store session
 * or gateway bearer); anyone else gets the same 404 as a missing app.
 * Metadata only — never bundle contents or workspace source (CR5, CR14).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import {
  ownedApp,
  publisherUsername,
  slugFor,
  PublishError,
} from "@/lib/miniapps/publish";
import { nestedPathFor } from "@/lib/miniapps/nested";
import { listVersions, type VersionRow } from "@/lib/create/versions";
import { draftPreviewUrl } from "@/lib/create/preview";
import { getBuild, latestBuild, logTail } from "@/lib/create/build";
import { budgetMeter, createSpendUsd } from "@/lib/create/budget";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const APPNAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const BUILD_ID_RE = /^[0-9a-f-]{36}$/;

function versionDetail(row: VersionRow | undefined) {
  if (!row) return null;
  return {
    version: row.version,
    lane: row.lane,
    bytes: row.bundle_bytes,
    files: row.file_count,
    worker: row.worker_sha256 !== null,
    findings: row.findings,
    qa_score: row.qa_score,
    created_at: row.created_at,
    published_at: row.published_at,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = storeSessionUserId(request) ?? (await boxUserId(supabase, request));
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  let slug = params.get("slug") ?? "";
  const appname = params.get("app") ?? "";
  const buildId = params.get("build") ?? "";
  if (buildId && !BUILD_ID_RE.test(buildId)) {
    return NextResponse.json({ error: "invalid build id" }, { status: 400 });
  }
  try {
    if (!slug && appname) {
      if (!APPNAME_RE.test(appname)) {
        return NextResponse.json({ error: "invalid app name" }, { status: 400 });
      }
      slug = slugFor(await publisherUsername(supabase, userId), appname);
    }
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    const app = await ownedApp(supabase, userId, slug);
    const [versions, build, spent] = await Promise.all([
      listVersions(supabase, app.id),
      buildId ? getBuild(supabase, userId, app.id, buildId) : latestBuild(supabase, app.id),
      createSpendUsd(supabase, userId, app.slug),
    ]);
    const live = app.status === "published" ? app.bundle_version : null;
    const draft = app.draft_version ?? app.bundle_version;
    const draftRow = versions.find((row) => row.version === draft);
    const mini = env.miniappOrigin().replace(/\/$/, "");
    return NextResponse.json({
      slug: app.slug,
      appname: app.appname,
      name: app.name,
      status: app.status,
      visibility: app.visibility,
      lane: app.lane,
      url: `${mini}${nestedPathFor(app.slug)}`,
      preview_url: draft ? draftPreviewUrl(app) : null,
      live: versionDetail(versions.find((row) => row.version === live)),
      draft: versionDetail(draftRow),
      draft_version: draft,
      qa_score: draftRow?.qa_score ?? null,
      build: build
        ? {
            id: build.id,
            status: build.status,
            version: build.version,
            error: build.error,
            findings: build.findings,
            sizes: build.sizes,
            log: logTail(build.log),
            started_at: build.started_at,
            finished_at: build.finished_at,
          }
        : null,
      budget: budgetMeter(app.create_budget_usd, spent),
      versions: versions.map((row) => ({
        version: row.version,
        lane: row.lane,
        findings: row.findings.length,
        qa_score: row.qa_score,
        created_at: row.created_at,
        published_at: row.published_at,
        retired_at: row.retired_at,
      })),
    });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
