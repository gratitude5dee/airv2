/**
 * Trade cron (every minute, Vercel crons): expires stale previews and
 * pending approvals, reconciles open live orders against Coinbase, and
 * ticks armed watch items on already-awake boxes (plan §9 row 3 / §5.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  expireTradeApprovals,
  reconcileTradeOrders,
} from "@/lib/trade/service";
import { tickWatchlists } from "@/lib/trade/watch";
import { guardResponse, requireCron } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;


export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireCron(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const supabase = serviceClient();
  const expired = await expireTradeApprovals(supabase).catch(() => -1);

  // Reconcile open live orders — distinct owners only.
  const { data: openRows } = await supabase
    .from("trade_orders")
    .select("user_id")
    .in("state", ["submitted", "partially_filled"])
    .eq("mode", "live");
  const owners = [...new Set((openRows ?? []).map((r) => r.user_id as string))];
  let synced = 0;
  for (const owner of owners.slice(0, 100)) {
    synced += await reconcileTradeOrders(supabase, owner).catch(() => 0);
  }

  const fired = await tickWatchlists(supabase).catch(() => -1);
  return NextResponse.json({ ok: true, expired, synced, fired });
}
