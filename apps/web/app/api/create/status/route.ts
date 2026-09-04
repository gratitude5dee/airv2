/**
 * V11 §14.1 `GET /api/create/status?slug=` — what the owner (or the owner's
 * Box) staged and what is live for one app: the live and draft versions with
 * their lint findings, plus the owner-only preview link. Owner-scoped
 * (store session or gateway bearer); anyone else gets the same 404 as a
 * missing app. Metadata only — never bundle contents (CR5).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import { ownedApp, PublishError } from "@/lib/miniapps/publish";
import { nestedPathFor } from "@/lib/miniapps/nested";
import { listVersions, type VersionRow } from "@/lib/create/versions";
import { draftPreviewUrl } from "@/lib/create/preview";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function versionDetail(row: VersionRow | undefined) {
  if (!row) return null;
  return {
    version: row.version,
    lane: row.lane,
    bytes: row.bundle_bytes,
    files: row.file_count,
    worker: row.worker_sha256 !== null,
    findings: row.findings,
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
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  try {
    const app = await ownedApp(supabase, userId, slug);
    const versions = await listVersions(supabase, app.id);
    const live = app.status === "published" ? app.bundle_version : null;
    const draft = app.draft_version ?? app.bundle_version;
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
      draft: versionDetail(versions.find((row) => row.version === draft)),
      versions: versions.map((row) => ({
        version: row.version,
        lane: row.lane,
        findings: row.findings.length,
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
