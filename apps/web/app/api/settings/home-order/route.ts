/**
 * Home launcher arrangement (MA0): writes users.miniapp_home_order — the
 * owner's press-and-hold order, shared with the Home mini-app's set_order
 * action (lib/miniapps/apps/home.tsx). Slugs are validated against the
 * published first-party registry, mirroring that action.
 *
 * Callers may arrange only a subset of the saved order (the web rail shows
 * installed apps only, while the mini-app launcher orders all published
 * apps), so the submitted list is merged into the saved one: slugs absent
 * from the submission keep their existing positions.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { mergeHomeOrder, setMiniappHomeOrder } from "@/lib/settings/account";
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
  const [apps, { data: userRow }] = await Promise.all([
    listFirstPartyApps(supabase),
    supabase
      .from("users")
      .select("miniapp_home_order")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const published = new Set(
    apps.filter((app) => app.status === "published").map((app) => app.slug)
  );
  const submitted = body.order
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => published.has(s))
    .slice(0, 64);
  const rawSaved = userRow?.miniapp_home_order;
  const saved = Array.isArray(rawSaved)
    ? rawSaved.filter((s): s is string => typeof s === "string")
    : [];
  const slugs = mergeHomeOrder(saved, submitted).slice(0, 64);
  const ok = await setMiniappHomeOrder(supabase, userId, slugs);
  if (!ok) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
