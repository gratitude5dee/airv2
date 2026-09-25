/**
 * CM4 publish worker entrypoint: Vercel cron, CRON_SECRET-authorized. Due
 * slots are grouped per user so a machine start serves every slot in the
 * window (one wake per user, never one per post). The response carries
 * counters only — no box origin, route, or token material.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { publishDueSlots } from "@/lib/publish/worker";
import { guardResponse, requireCron } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;


export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireCron(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const result = await publishDueSlots(serviceClient());
  return NextResponse.json({ ok: true, ...result });
}
