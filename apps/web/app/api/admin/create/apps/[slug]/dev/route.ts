/**
 * V12 §12 `POST /api/admin/create/apps/<slug>/dev` `{ action: "revoke" | "renew" }`
 * — the operator's revoke / renew of one app's dev release (§6.3, CR17).
 * The same `revokeDev` / `renewDev` the owner's `/api/create/release` uses,
 * audited in `admin_audit` (migration 0120). Answers the resulting registry
 * row (metadata only) plus the release receipt.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { recordAdminAudit } from "@/lib/admin/audit";
import { ReleaseError, renewDev, revokeDev, type DevRelease } from "@/lib/create/release";
import { getRegistryApp, type RegistryApp } from "@/lib/miniapps/registry";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ACTIONS = ["revoke", "renew"] as const;
type Action = (typeof ACTIONS)[number];

function appRow(app: RegistryApp) {
  return {
    slug: app.slug,
    status: app.status,
    dev_version: app.dev_version ?? null,
    dev_released_at: app.dev_released_at ?? null,
    dev_expires_at: app.dev_expires_at ?? null,
    updated_at: app.updated_at,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const operator = adminAuthorized(request);
  if (!operator) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await context.params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (!(ACTIONS as readonly unknown[]).includes(action)) {
    return NextResponse.json({ error: "action must be revoke or renew" }, { status: 400 });
  }

  const supabase = serviceClient();
  const app = await getRegistryApp(supabase, slug).catch(() => null);
  if (!app || !app.owner_user_id) {
    return NextResponse.json({ error: "app not found" }, { status: 404 });
  }

  try {
    let dev: DevRelease | null = null;
    let detail: Record<string, string | null>;
    if ((action as Action) === "revoke") {
      const revoked = await revokeDev(supabase, app);
      detail = { version: revoked?.version ?? null };
    } else {
      dev = await renewDev(supabase, app);
      detail = { version: dev.version, expires_at: dev.expires_at };
    }
    await recordAdminAudit(supabase, {
      action: action === "revoke" ? "dev_revoke" : "dev_renew",
      app,
      operator,
      detail,
    });
    console.log(
      JSON.stringify({
        msg: "admin dev action",
        user_id: app.owner_user_id,
        app: app.slug,
        operator,
        action,
        version: detail["version"] ?? null,
      })
    );
    const fresh = (await getRegistryApp(supabase, slug).catch(() => null)) ?? app;
    return NextResponse.json({ action, dev, app: appRow(fresh) });
  } catch (error) {
    if (error instanceof ReleaseError) {
      return NextResponse.json(
        error.reasons.length > 0
          ? { error: error.message, reasons: error.reasons }
          : { error: error.message },
        { status: error.status }
      );
    }
    console.error(
      JSON.stringify({
        msg: "admin dev action failed",
        user_id: app.owner_user_id,
        app: app.slug,
        action,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: "dev release action failed" }, { status: 502 });
  }
}
