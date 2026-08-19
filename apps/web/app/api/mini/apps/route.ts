/**
 * /home Apps tab data (MA0, main origin): the first-party registry plus the
 * owner's install state. Metadata only — launching still goes through
 * /api/mini/link's owner-scoped token mint.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { listFirstPartyApps } from "@/lib/miniapps/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const [apps, { data: installs }] = await Promise.all([
    listFirstPartyApps(supabase),
    supabase.from("miniapp_installs").select("app_id").eq("user_id", userId),
  ]);
  const installed = new Set((installs ?? []).map((row) => row.app_id));
  return NextResponse.json({
    apps: apps.map((app) => ({
      slug: app.slug,
      name: app.name,
      description: app.description,
      icon_key: app.icon_key,
      status: app.status,
      installed: installed.has(app.id),
    })),
  });
}
