/**
 * V12 §14.1 `GET /api/create/progress?app=<appname>` (or `?slug=`) — the
 * `{ percent, stage, detail, updated_at }` triple the web Progress pane
 * shows, computed by the control plane from intake / build / QA / test state
 * (§8.2, CR19) — the same read the iMessage relay makes. Owner-scoped (store
 * session or the Box's gateway bearer); anyone else gets the same 404 as a
 * missing app. Metadata only: a percent, a stage word and a rule id or
 * count — never source, plan text or a URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import { ownedApp, publisherUsername, slugFor, PublishError } from "@/lib/miniapps/publish";
import { readProgress } from "@/lib/create/progress";
import { jobView, latestJobForApp } from "@/lib/create/job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const APPNAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = storeSessionUserId(request) ?? (await boxUserId(supabase, request));
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  let slug = params.get("slug") ?? "";
  const appname = params.get("app") ?? "";
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
    const [snapshot, job] = await Promise.all([
      readProgress(supabase, userId, app),
      latestJobForApp(supabase, userId, app.id).catch(() => null),
    ]);
    return NextResponse.json({
      slug: app.slug,
      percent: snapshot.progress.percent,
      stage: snapshot.progress.stage,
      detail: snapshot.progress.detail,
      updated_at: snapshot.updated_at,
      // V13: when a job is running for this app its percent/step are the
      // progress view's source of truth; null on the V12 lane.
      job: job === null ? null : jobView(job),
    });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
