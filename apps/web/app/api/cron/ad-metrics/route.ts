/**
 * M14 task 6 entrypoint: hourly, CRON_SECRET-authorized. Pulls OpenAI
 * insights control-plane-side and enqueues box-side Meta reporting runs
 * (dedicated 'ads-reporting' Hermes session, cooldown via
 * ad_metrics_daily.fetched_at). Counters only in the response.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { enqueueMetaReporting, ingestOpenAiMetrics } from "@/lib/ads/metrics";
import { guardResponse, requireCron } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;


export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireCron(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const supabase = serviceClient();
  const openai = await ingestOpenAiMetrics(supabase);
  const meta = await enqueueMetaReporting(supabase);
  return NextResponse.json({ ok: true, openai, meta });
}
