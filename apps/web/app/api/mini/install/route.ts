/**
 * Install / uninstall a mini-app onto the owner's /home Apps tab (MA0).
 * An install row is a pin — it grants nothing; access is always the token.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { getRegistryApp } from "@/lib/miniapps/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    app?: string;
    action?: string;
  };
  const supabase = serviceClient();
  const app = await getRegistryApp(supabase, body.app ?? "");
  if (!app) {
    return NextResponse.json({ error: "unknown app" }, { status: 400 });
  }
  if (body.action === "uninstall") {
    await supabase
      .from("miniapp_installs")
      .delete()
      .eq("user_id", userId)
      .eq("app_id", app.id);
    return NextResponse.json({ ok: true, installed: false });
  }
  const { error } = await supabase
    .from("miniapp_installs")
    .upsert({ user_id: userId, app_id: app.id });
  if (error) {
    return NextResponse.json({ error: "install failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, installed: true });
}
