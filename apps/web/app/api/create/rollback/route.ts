/**
 * V11 §13.2 rollback — always the owner, always from an owner surface. Moves
 * the live pointer to an earlier version of the same app and re-deploys the
 * live Worker from that version's immutable R2 artifacts in one step, so
 * mini_apps.bundle_version and the app-origin manifest never disagree.
 * Agents cannot reach this route (it requires a store session, not an agent
 * token); rollbacks are rate-limited and logged like publishes (CR16).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { ownedApp, PublishError } from "@/lib/miniapps/publish";
import { rollbackTo, VERSION_RE, VersionError } from "@/lib/create/versions";
import { rollbackRateLimited } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    slug?: unknown;
    version?: unknown;
  } | null;
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const version = typeof body?.version === "string" ? body.version : "";
  if (!VERSION_RE.test(version)) {
    return NextResponse.json({ error: "invalid version" }, { status: 400 });
  }
  const supabase = serviceClient();
  if (await rollbackRateLimited(supabase, userId)) {
    return NextResponse.json({ error: "too many rollbacks" }, { status: 429 });
  }
  try {
    const app = await ownedApp(supabase, userId, slug);
    const target = await rollbackTo(supabase, app, version);
    return NextResponse.json({
      ok: true,
      slug: app.slug,
      version: target.version,
      previous: app.bundle_version,
    });
  } catch (error) {
    if (error instanceof PublishError || error instanceof VersionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
