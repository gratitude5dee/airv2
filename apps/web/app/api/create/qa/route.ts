/**
 * V11 §9.6 `POST /api/create/qa` — the Box posts the Preview QA report for a
 * draft version it just drove with agent-browser; the owner's surface may
 * post one too (store session). The control plane never runs the browser:
 * it validates the content-free report (lib/create/qa.ts), scores it, stamps
 * `qa_score` on the version row and logs `create.qa`. Screenshots and any
 * page text stay in the Box.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import {
  ownedApp,
  publisherUsername,
  slugFor,
  validateAppName,
  PublishError,
} from "@/lib/miniapps/publish";
import { QaError, QaReportSchema, recordQaScore } from "@/lib/create/qa";
import { qaRateLimited, recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = storeSessionUserId(request) ?? (await boxUserId(supabase, request));
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    slug?: unknown;
    appname?: unknown;
    report?: unknown;
  } | null;
  const parsed = QaReportSchema.safeParse(body?.report);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid qa report" }, { status: 400 });
  }
  try {
    let slug = typeof body?.slug === "string" ? body.slug : "";
    if (!slug && typeof body?.appname === "string") {
      slug = slugFor(await publisherUsername(supabase, userId), validateAppName(body.appname));
    }
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    if (await qaRateLimited(supabase, userId)) {
      await recordOpsEvent(supabase, "rate_limited", userId, "create.qa");
      return NextResponse.json({ error: "too many qa runs" }, { status: 429 });
    }
    const app = await ownedApp(supabase, userId, slug);
    const { summary } = await recordQaScore(supabase, app.id, parsed.data);
    await recordOpsEvent(supabase, "create.qa", userId, app.slug);
    return NextResponse.json({
      ok: true,
      slug: app.slug,
      version: parsed.data.version,
      qa_score: summary.score,
      failed: summary.failed,
    });
  } catch (error) {
    if (error instanceof PublishError || error instanceof QaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
