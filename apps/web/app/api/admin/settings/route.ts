/**
 * Operator fleet settings: the `platform_settings` rows the control plane
 * reads. Guarded by ADMIN_API_KEY; never exposed to end users. GET returns
 * each known setting plus its effective value (the value provisioning
 * actually uses — e.g. box_default_provider=tenki only takes effect once
 * TENKI_TEMPLATE_ID holds a snapshot ref); POST writes a setting.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { env } from "@/lib/env";
import { isTenkiSnapshotRef } from "@/lib/box/tenki";
import {
  BOX_DEFAULT_PROVIDER_KEY,
  readPlatformSetting,
  writePlatformSetting,
} from "@/lib/settings/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function effectiveBoxProvider(stored: string | undefined): string {
  if (
    stored === "tenki" &&
    isTenkiSnapshotRef(env.tenkiTemplateId() ?? "")
  ) {
    return "tenki";
  }
  return "ascii";
}

async function settingsPayload(): Promise<NextResponse> {
  const stored = await readPlatformSetting(BOX_DEFAULT_PROVIDER_KEY);
  return NextResponse.json({
    box_default_provider: stored ?? "ascii",
    effective_box_provider: effectiveBoxProvider(stored),
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return settingsPayload();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      box_default_provider?: string;
    };
    const provider = body.box_default_provider;
    if (provider !== "ascii" && provider !== "tenki") {
      return NextResponse.json(
        { error: "box_default_provider must be ascii or tenki" },
        { status: 400 }
      );
    }
    await writePlatformSetting(BOX_DEFAULT_PROVIDER_KEY, provider);
    return settingsPayload();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
