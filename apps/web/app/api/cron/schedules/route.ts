/**
 * V3 due-schedule sweeper (Vercel cron, every minute): claims due
 * agent_schedules atomically and fires them through the box + existing
 * channel plumbing. See lib/calendar/sweep.ts for the full choreography.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sweepSchedules } from "@/lib/calendar/sweep";
import { guardResponse, requireCron } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;


export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireCron(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const supabase = serviceClient();
  const { fired } = await sweepSchedules(supabase);
  return NextResponse.json({ ok: true, fired });
}
