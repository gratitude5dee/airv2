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
  PublishError,
  resolveOwnedAppRef,
} from "@/lib/miniapps/publish";
import {
  promoteToDev,
  ReleaseError,
  renewDev,
  revokeDev,
} from "@/lib/create/release";
import { VERSION_RE } from "@/lib/create/versions";

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
    const ref =
      typeof body.slug === "string" && body.slug !== ""
        ? body.slug
        : typeof body.appname === "string"
          ? body.appname
          : typeof body.app === "string"
            ? body.app
            : "";
    if (!ref || !SLUG_RE.test(ref)) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    // F4 (V13 §9.2): appname wins over the flat slug — a hyphenated name
    // parses as a slug too, so slug-first would shadow the app.
    const app = await resolveOwnedAppRef(supabase, userId, ref);
    if (!app) throw new PublishError("app not found", 404);

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
