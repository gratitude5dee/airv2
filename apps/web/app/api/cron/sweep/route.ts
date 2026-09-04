/**
 * Cron sweeper (goal.md M2 task 4):
 *  - stop boxes idle past stop_after — never with force (C6);
 *  - fire flush jobs whose invocation died before draining;
 *  - 48h TTL on transient transport rows (inbound_events, batch_queue);
 *  - release abandoned presign reservations so their pre-charged bytes
 *    don't leak storage quota (MA4);
 *  - retire mini-app versions past retention (V11 §13.1): superseded live
 *    versions after 30 days, unpublished drafts beyond the newest five.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase";
import { getBox, stop } from "@/lib/box/client";
import { claimFlush, runFlush } from "@/lib/orchestrator/flush";
import { findSweepableBoxes } from "@/lib/orchestrator/sweep";
import { recordBoxStateEvent } from "@/lib/box/events";
import { sweepAbandonedUploads } from "@/lib/storage/confirm";
import { runSyncJobs } from "@/lib/fleet/sync";
import { sweepUnfiledDrafts } from "@/lib/email/draftSweep";
import { sweepVersions } from "@/lib/create/versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

function authorized(request: NextRequest): boolean {
  const secret = process.env["CRON_SECRET"] ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

interface OverdueJob {
  space_id: string;
  user_id: string;
  phone: string;
  run_at: string;
  attempts: number;
  sender_tier: number | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const nowIso = new Date().toISOString();

  const idleBoxes = await findSweepableBoxes(supabase, new Date());
  let stopped = 0;
  for (const box of idleBoxes) {
    try {
      // last_active_at also starts the stale-transition clock below, so an
      // interrupted stop is reconciled 30 minutes after the attempt.
      await supabase
        .from("boxes")
        .update({ state: "stopping", last_active_at: nowIso })
        .eq("provider_box_id", box.provider_box_id);
      await stop(box.provider_box_id);
      await supabase
        .from("boxes")
        .update({ state: "stopped", stop_after: null })
        .eq("provider_box_id", box.provider_box_id);
      await recordBoxStateEvent(supabase, box.user_id, "stopped");
      stopped += 1;
    } catch (error) {
      // A refused stop means the snapshot is failing — leave the box
      // running and visible as ready so the next sweep retries (C6).
      await supabase
        .from("boxes")
        .update({ state: "ready" })
        .eq("provider_box_id", box.provider_box_id);
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

  // Reconcile rows parked in a transitional state by an interrupted wake or
  // stop (function timeout between the "starting"/"stopping" write and the
  // terminal write): after 30 minutes, persist the provider's real state so
  // the user gets power controls back and a running box re-enters the sweep.
  const staleBefore = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: staleBoxes } = await supabase
    .from("boxes")
    .select("provider_box_id, user_id")
    .in("state", ["starting", "stopping"])
    .lt("last_active_at", staleBefore);
  let reconciled = 0;
  for (const box of (staleBoxes ?? []) as { provider_box_id: string; user_id: string }[]) {
    try {
      const current = await getBox(box.provider_box_id).catch(() => null);
      const running =
        current && (current.state === "ready" || current.state === "idle");
      await supabase
        .from("boxes")
        .update(
          running
            ? { state: "ready", stop_after: nowIso }
            : { state: "stopped", stop_after: null }
        )
        .eq("provider_box_id", box.provider_box_id);
      reconciled += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "sweeper reconcile failed",
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
    .select("space_id, user_id, phone, run_at, attempts, sender_tier")
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
          senderTier: job.sender_tier,
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

  let uploadsReleased = 0;
  try {
    uploadsReleased = await sweepAbandonedUploads(supabase);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "sweeper upload release failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }

  // Fleet sync: one wave of the active release-sync job per sweep tick,
  // keeping box resumes well under the platform's start-rate ceiling.
  let fleet = { synced: 0, failed: 0, deferred: 0 };
  try {
    fleet = await runSyncJobs(supabase);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "sweeper fleet sync failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }

  // C10 backstop: file an email_draft review for any recent box-created
  // draft the agent forgot to submit for review.
  let draftsFiled = 0;
  try {
    draftsFiled = await sweepUnfiledDrafts(supabase);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "sweeper draft review failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }

  let versionsRetired = 0;
  try {
    versionsRetired = await sweepVersions(supabase);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "sweeper version retention failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }

  const ttlCutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
  await supabase.from("inbound_events").delete().lt("received_at", ttlCutoff);
  await supabase.from("batch_queue").delete().lt("received_at", ttlCutoff);
  await supabase
    .from("carried_messages")
    .delete()
    .lt("received_at", ttlCutoff);

  return NextResponse.json({
    ok: true,
    stopped,
    reconciled,
    flushed,
    uploadsReleased,
    fleet,
    draftsFiled,
    versionsRetired,
  });
}
