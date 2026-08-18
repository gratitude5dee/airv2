/**
 * V3 due-schedule sweeper (Vercel cron, every minute): claims due
 * agent_schedules atomically and fires them through the box + existing
 * channel plumbing. See lib/calendar/sweep.ts for the full choreography.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase";
import { sweepSchedules } from "@/lib/calendar/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { fired } = await sweepSchedules(supabase);
  return NextResponse.json({ ok: true, fired });
}
