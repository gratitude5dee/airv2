/**
 * Power-state history (V8 Computer ▸ Screen): the last 48h of ready/stopped
 * transitions plus the current state, feeding the sparkline. Value-free —
 * timestamps and states only.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { listBoxStateEvents } from "@/lib/box/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const [{ data: box }, events] = await Promise.all([
    supabase.from("boxes").select("state").eq("user_id", userId).maybeSingle(),
    listBoxStateEvents(supabase, userId),
  ]);
  return NextResponse.json(
    {
      current_state: (box as { state: string } | null)?.state ?? null,
      events,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
