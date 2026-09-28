/**
 * CM6 ceiling sweep entrypoint: Vercel cron, CRON_SECRET-authorized. A user
 * whose committed 30-day exposure exceeds their control-plane ceiling gets
 * their campaigns paused and a 'spend_ceiling' decision raised within this
 * sweep. Counters only in the response.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sweepSpendCeilings } from "@/lib/ads/sweep";
import { guardResponse, requireCron } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;


export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireCron(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const result = await sweepSpendCeilings(serviceClient());
  return NextResponse.json({ ok: true, ...result });
}
