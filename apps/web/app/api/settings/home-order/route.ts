/**
 * Home launcher arrangement (MA0): writes users.miniapp_home_order — the
 * owner's press-and-hold order, shared with the Home mini-app's set_order
 * action (lib/miniapps/apps/home.tsx). Slugs are validated against the
 * published first-party registry, mirroring that action.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { setMiniappHomeOrder } from "@/lib/settings/account";
import { listFirstPartyApps } from "@/lib/miniapps/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    order?: unknown;
  };
  if (!Array.isArray(body.order)) {
    return NextResponse.json({ error: "invalid order" }, { status: 400 });
  }
  const supabase = serviceClient();
  const published = new Set(
    (await listFirstPartyApps(supabase))
      .filter((app) => app.status === "published")
      .map((app) => app.slug)
  );
  const slugs = body.order
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => published.has(s))
    .slice(0, 64);
  const ok = await setMiniappHomeOrder(supabase, userId, slugs);
  if (!ok) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
