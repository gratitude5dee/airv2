/**
 * M14 task 6 entrypoint: hourly, CRON_SECRET-authorized. Pulls OpenAI
 * insights control-plane-side and enqueues box-side Meta reporting runs
 * (dedicated 'ads-reporting' Hermes session, cooldown via
 * ad_metrics_daily.fetched_at). Counters only in the response.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase";
import { enqueueMetaReporting, ingestOpenAiMetrics } from "@/lib/ads/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const tokenBytes = Buffer.from(token);
  const secretBytes = Buffer.from(secret);
  if (tokenBytes.length !== secretBytes.length) return false;
  return timingSafeEqual(tokenBytes, secretBytes);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const openai = await ingestOpenAiMetrics(supabase);
  const meta = await enqueueMetaReporting(supabase);
  return NextResponse.json({ ok: true, openai, meta });
}
