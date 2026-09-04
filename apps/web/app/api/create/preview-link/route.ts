/**
 * V11 §14.1 `POST /api/create/preview-link` — CR13: a fresh owner-only link
 * to the app's draft on the app origin. Callers are the owner (store
 * session, the Preview iframe reloads through it) and the owner's Box
 * (gateway bearer, `air-create qa` drives agent-browser at it). The token is
 * short-lived and bound to the owner's principal; nobody else can mint one
 * and the mini origin never serves a draft (CR9).
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
import { draftPreviewUrl } from "@/lib/create/preview";

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
  } | null;
  try {
    let slug = typeof body?.slug === "string" ? body.slug : "";
    if (!slug && typeof body?.appname === "string") {
      slug = slugFor(await publisherUsername(supabase, userId), validateAppName(body.appname));
    }
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    const app = await ownedApp(supabase, userId, slug);
    const draft = app.draft_version ?? app.bundle_version;
    if (!draft) {
      return NextResponse.json({ error: "no draft to preview" }, { status: 409 });
    }
    const url = draftPreviewUrl(app);
    if (!url) {
      return NextResponse.json({ error: "preview unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, slug: app.slug, version: draft, preview_url: url });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
