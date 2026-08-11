/**
 * CM6 ceiling sweep entrypoint: Vercel cron, CRON_SECRET-authorized. A user
 * whose committed 30-day exposure exceeds their control-plane ceiling gets
 * their campaigns paused and a 'spend_ceiling' decision raised within this
 * sweep. Counters only in the response.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase";
import { sweepSpendCeilings } from "@/lib/ads/sweep";

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
  const result = await sweepSpendCeilings(serviceClient());
  return NextResponse.json({ ok: true, ...result });
}
