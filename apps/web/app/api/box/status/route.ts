/**
 * Box power state for the dashboard (M10). DB-backed and cheap enough to
 * poll; returns lifecycle fields only — never provider box IDs, hosted URLs,
 * or tokens (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatusRow {
  state: string;
  stop_after: string | null;
  last_active_at: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data } = await supabase
    .from("boxes")
    .select("state, stop_after, last_active_at")
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const row = data as StatusRow;
  return NextResponse.json({
    state: row.state,
    stop_after: row.stop_after,
    last_active_at: row.last_active_at,
  });
}
