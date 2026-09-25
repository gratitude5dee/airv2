/**
 * V12 §12 `POST /api/admin/create/apps/<slug>/suspend` — the existing
 * fail-closed suspension path (goal-create-v11 §13.3, CR16) exposed for
 * Create apps: the dev Worker goes first (`revokeDev`), then the app origin
 * pointer flips to `suspended` (`suspendOnAppOrigin`), then the registry
 * row — so within one request the app answers 404 on both origins
 * (link.wzrd.tech/<u>/<a> and mini.wzrd.tech/<u>/<a>, whose loader re-reads
 * the row on every load). Idempotent on an already-suspended app. Audited
 * in `admin_audit` (migration 0120). No body is read: an operator's reason
 * is never stored (CR21).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { recordAdminAudit } from "@/lib/admin/audit";
import { ReleaseError, revokeDev } from "@/lib/create/release";
import { removeMirror } from "@/lib/create/mirror";
import { createConfig } from "@/lib/create/config";
import { suspendOnAppOrigin } from "@/lib/functions/deploy";
import {
  getRegistryApp,
  parseRegistryApp,
  REGISTRY_COLUMNS,
  type RegistryApp,
} from "@/lib/miniapps/registry";
import { serviceClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** True when any version of this app has a mirror commit (§10.2). */
async function wasMirrored(supabase: SupabaseClient, app: RegistryApp): Promise<boolean> {
  const { data, error } = await supabase
    .from("miniapp_versions")
    .select("id")
    .eq("app_id", app.id)
    .not("mirrored_at", "is", null)
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

function appRow(app: RegistryApp) {
  return {
    slug: app.slug,
    status: app.status,
    dev_version: app.dev_version ?? null,
    dev_expires_at: app.dev_expires_at ?? null,
    live_version: app.status === "published" ? app.bundle_version : null,
    draft_version: app.draft_version,
    updated_at: app.updated_at,
  };
}

async function flipSuspended(supabase: SupabaseClient, app: RegistryApp): Promise<RegistryApp> {
  const { data, error } = await supabase
    .from("mini_apps")
    .update({ status: "suspended", updated_at: new Date().toISOString() })
    .eq("id", app.id)
    .select(REGISTRY_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`registry suspend failed: ${error.message}`);
  const fresh = data ? parseRegistryApp(data) : null;
  if (!fresh) throw new Error("registry suspend returned no row");
  return fresh;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await context.params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const supabase = serviceClient();
  const app = await getRegistryApp(supabase, slug).catch(() => null);
  if (!app || !app.owner_user_id) {
    return NextResponse.json({ error: "app not found" }, { status: 404 });
  }
  if (app.status === "suspended") {
    return NextResponse.json({ suspended: true, already: true, app: appRow(app) });
  }

  const devVersion = app.dev_version ?? null;
  try {
    // (1) dev Worker + pointer, (2) app-origin manifest, (3) registry row.
    let current = app;
    if (devVersion) {
      await revokeDev(supabase, current);
      current = (await getRegistryApp(supabase, slug).catch(() => null)) ?? {
        ...current,
        dev_version: null,
        dev_released_at: null,
        dev_expires_at: null,
      };
    }
    await suspendOnAppOrigin(supabase, current);
    const fresh = await flipSuspended(supabase, current);
    // §10.2: a suspended app's mirror folder is replaced by a README saying
    // it was removed. The history stays public, which the owner was told in
    // the decision card. A mirror failure never keeps an app live.
    const mirrored = await wasMirrored(supabase, current);
    if (mirrored && createConfig.mirrorEnabled() && createConfig.mirrorInstallationId()) {
      await removeMirror(supabase, fresh).catch((error: unknown) => {
        log.warn("mirror removal failed", {app: current.slug,
            error: error instanceof Error ? error.message : "unknown",});
        return null;
      });
    }
    await recordAdminAudit(supabase, {
      action: "suspend",
      app,
      detail: {
        previous_status: app.status,
        live_version: app.status === "published" ? app.bundle_version : null,
        dev_version: devVersion,
      },
    });
    log.info("admin suspended app", {user_id: app.owner_user_id,
        app: app.slug,
        previous_status: app.status,
        dev_revoked: devVersion !== null,});
    return NextResponse.json({ suspended: true, already: false, app: appRow(fresh) });
  } catch (error) {
    if (error instanceof ReleaseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.name === "AppOriginRefusedError") {
      return NextResponse.json({ error: "app is being deleted" }, { status: 409 });
    }
    log.error("admin suspend failed", {user_id: app.owner_user_id,
        app: app.slug,
        error: error instanceof Error ? error.message : "unknown",});
    return NextResponse.json({ error: "suspend failed" }, { status: 502 });
  }
}
