/**
 * Cron sweeper (goal.md M2 task 4):
 *  - stop boxes idle past stop_after — never with force (C6);
 *  - fire flush jobs whose invocation died before draining;
 *  - 48h TTL on transient transport rows (inbound_events, batch_queue).
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase";
import { stop } from "@/lib/box/client";
import { claimFlush, runFlush } from "@/lib/orchestrator/flush";

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

interface SweepableBox {
  provider_box_id: string;
  user_id: string;
}

interface OverdueJob {
  space_id: string;
  user_id: string;
  phone: string;
  run_at: string;
  attempts: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const nowIso = new Date().toISOString();

  const { data: idleBoxes } = await supabase
    .from("boxes")
    .select("provider_box_id, user_id")
    .lt("stop_after", nowIso)
    .in("state", ["ready", "idle"]);
  let stopped = 0;
  for (const box of (idleBoxes ?? []) as SweepableBox[]) {
    try {
      await stop(box.provider_box_id);
      await supabase
        .from("boxes")
        .update({ state: "stopped", stop_after: null })
        .eq("provider_box_id", box.provider_box_id);
      stopped += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "sweeper stop failed",
          box_id: box.provider_box_id,
          user_id: box.user_id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // Flush jobs overdue by more than a debounce window: their after() task
  // died. Claim and run them here.
  const overdueBefore = new Date(Date.now() - 30_000).toISOString();
  const { data: overdue } = await supabase
    .from("flush_jobs")
    .select("space_id, user_id, phone, run_at, attempts")
    .lt("run_at", overdueBefore)
    .limit(10);
  let flushed = 0;
  for (const job of (overdue ?? []) as OverdueJob[]) {
    const claim = await claimFlush(supabase, job.space_id, job.run_at);
    if (!claim) continue;
    try {
      await runFlush(
        supabase,
        {
          spaceId: job.space_id,
          userId: job.user_id,
          phone: job.phone,
          attempts: job.attempts,
        },
        claim.chainStartedAt
      );
      flushed += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "sweeper flush failed",
          space_id: job.space_id,
          user_id: job.user_id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  const ttlCutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
  await supabase.from("inbound_events").delete().lt("received_at", ttlCutoff);
  await supabase.from("batch_queue").delete().lt("received_at", ttlCutoff);
  await supabase
    .from("carried_messages")
    .delete()
    .lt("received_at", ttlCutoff);

  return NextResponse.json({ ok: true, stopped, flushed });
}
