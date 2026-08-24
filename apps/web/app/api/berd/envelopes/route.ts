/**
 * Envelope pull (berd.goal.md §MA-B3). Berd — desktop or Box-hosted — polls
 * outbound with its bearer token and receives the owner's queued, signed,
 * single-use envelopes; nothing here can dial the device. Envelopes that
 * expired unclaimed are failed and their pending entries in the box document
 * are reconciled on the same poll, so the view never shows a queued
 * operation that can no longer run.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { BERD_LANE, claimEnvelopes, laneLink } from "@/lib/miniapps/commandLane";
import { getBerdDoc, markBerdPending, putBerdDoc } from "@/lib/miniapps/berd/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const supabase = serviceClient();
  const link = token
    ? await laneLink(supabase, BERD_LANE, token, "berd_", "paired")
    : null;
  if (!link) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { envelopes, expiredIds } = await claimEnvelopes(
    supabase,
    BERD_LANE,
    link
  );
  for (const expired of expiredIds) {
    const doc = await getBerdDoc(supabase, link.user_id, expired.resourceId);
    await putBerdDoc(
      supabase,
      link.user_id,
      expired.resourceId,
      markBerdPending(doc, expired.id, "failed", "expired unclaimed")
    );
  }
  return NextResponse.json({ envelopes });
}
