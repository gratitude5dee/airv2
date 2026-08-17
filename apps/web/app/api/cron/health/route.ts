/**
 * CM8 health/reconciliation entrypoint: Vercel cron, CRON_SECRET-authorized.
 * Probes connections for slots firing inside the horizon (raising 'reconnect'
 * before a scheduled publish can fail) and, on the first run of each day,
 * reconciles platform-reported ad spend against the mirrored budgets.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase";
import { probeConnectionHealth } from "@/lib/publish/health";
import { reconcileSpend } from "@/lib/ads/reconcile";
import { creativePreflight } from "@/lib/creative/preflight";

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
  const health = await probeConnectionHealth(supabase);
  // Spend reconciliation is daily-grained (spend_reports upserts by date),
  // so running it on every hourly tick is idempotent — the day's row just
  // converges on the latest platform-reported figure.
  const reconcile = await reconcileSpend(supabase);
  // M16: read-only creative provider preflight. Skips when keys are absent;
  // never creates generation jobs, never logs provider bodies or secrets.
  const creative = await creativePreflight();
  return NextResponse.json({ ok: true, health, reconcile, creative });
}
