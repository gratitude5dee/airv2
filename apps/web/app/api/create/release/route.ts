/**
 * V12 §14.1 `POST /api/create/release` — the owner (store session) or the
 * owner's Box (gateway bearer) moves one app's dev channel (§6.3, CR17):
 *   { app | appname | slug, channel: "dev", action: "promote" | "renew" | "revoke", version? }
 * `promote` defaults to the draft version and is refused with
 * 409 { error: "not_ready", reasons } when CR22 does not hold. Anyone else
 * gets the same 404 as a missing app. Metadata in, metadata out — the
 * response names a version, a URL and an expiry, never content.
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
import {
  promoteToDev,
  ReleaseError,
  renewDev,
  revokeDev,
} from "@/lib/create/release";
import { VERSION_RE } from "@/lib/create/versions";
import { splitPublishedSlug } from "@/lib/miniapps/nested";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ACTIONS = new Set(["promote", "renew", "revoke"]);

interface ReleaseBody {
  app?: unknown;
  appname?: unknown;
  slug?: unknown;
  channel?: unknown;
  action?: unknown;
  version?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = storeSessionUserId(request) ?? (await boxUserId(supabase, request));
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as ReleaseBody | null;
  if (!body || body.channel !== "dev") {
    return NextResponse.json({ error: "invalid channel" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  if (body.version !== undefined && (typeof body.version !== "string" || !VERSION_RE.test(body.version))) {
    return NextResponse.json({ error: "invalid version" }, { status: 400 });
  }
  try {
    let slug = typeof body.slug === "string" ? body.slug : "";
    const appname =
      typeof body.appname === "string" ? body.appname : typeof body.app === "string" ? body.app : "";
    if (!slug && appname) {
      // `app` may be the flat `<u>-<a>` slug (the Box's `air-create release`)
      // or a bare appname (the owner's surface); both resolve to the owner's row.
      slug = splitPublishedSlug(appname)
        ? appname
        : slugFor(await publisherUsername(supabase, userId), validateAppName(appname));
    }
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    const app = await ownedApp(supabase, userId, slug);

    if (action === "revoke") {
      const revoked = await revokeDev(supabase, app);
      return NextResponse.json({
        channel: "dev",
        version: revoked?.version ?? null,
        url: null,
        expires_at: null,
      });
    }
    if (action === "renew") {
      return NextResponse.json(await renewDev(supabase, app));
    }
    const version =
      typeof body.version === "string" ? body.version : app.draft_version ?? app.bundle_version;
    if (!version) {
      return NextResponse.json({ error: "no version to promote" }, { status: 400 });
    }
    return NextResponse.json(await promoteToDev(supabase, app, version));
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ReleaseError) {
      return NextResponse.json(
        error.reasons.length > 0
          ? { error: error.message, reasons: error.reasons }
          : { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
