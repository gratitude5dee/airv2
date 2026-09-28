/**
 * V3 due-schedule sweeper (Vercel cron, every minute): claims due
 * agent_schedules atomically and fires them through the box + existing
 * channel plumbing. See lib/calendar/sweep.ts for the full choreography.
 */
import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron/auth";
import { serviceClient } from "@/lib/supabase";
import { sweepSchedules } from "@/lib/calendar/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { fired } = await sweepSchedules(supabase);
  return NextResponse.json({ ok: true, fired });
}
