/**
 * M8 export: one query per table plus a pointer to the box snapshot. The
 * archive is routing/metadata only — durable content lives in the box
 * filesystem and is exported by pulling a box snapshot (returned as a
 * reference, not streamed here).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const USER_TABLES = [
  "users",
  "handles",
  "senders",
  "agent_addresses",
  "entitlements",
  "provisioning",
  "inbound_events",
  "connections",
  "agent_runs",
  "decisions",
  "miniapp_redemptions",
] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const archive: Record<string, unknown> = {};

  for (const table of USER_TABLES) {
    const column = table === "users" ? "id" : "user_id";
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(column, userId);
    archive[table] = error ? { error: error.message } : (data ?? []);
  }

  const { data: line } = await supabase
    .from("lines")
    .select("phone, mode, role, assigned_at")
    .eq("assigned_user_id", userId);
  archive.lines = line ?? [];

  // Secret columns are never exported.
  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id, state, stop_after, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  archive.box = box
    ? {
        ...box,
        snapshot_note:
          "durable agent data lives in this box's filesystem; pull a box snapshot to complete the export",
      }
    : null;

  return NextResponse.json({ user_id: userId, exported_at: new Date().toISOString(), archive });
}
