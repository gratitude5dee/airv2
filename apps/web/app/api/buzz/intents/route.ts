/**
 * Intent pull (buzz.goal.md §MA-Z3). The signer — the `buzz` CLI on the
 * user's Box, or Buzz Desktop — polls outbound with its bearer token and
 * receives the owner's queued, signed, single-use intents. The process that
 * holds `BUZZ_PRIVATE_KEY` builds and signs the actual relay request;
 * content-bearing args arrive in the single `stdin` field, which the signer
 * passes on stdin, never argv. Intents that expired unclaimed are failed and
 * their pending entries in the box document are reconciled on the same poll.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { BUZZ_LANE, claimEnvelopes, laneLink } from "@/lib/miniapps/commandLane";
import { getBuzzDoc, markBuzzPending, putBuzzDoc } from "@/lib/miniapps/buzz/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const supabase = serviceClient();
  const link = token
    ? await laneLink(supabase, BUZZ_LANE, token, "buzz_", "connected")
    : null;
  if (!link) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { envelopes, expiredIds } = await claimEnvelopes(
    supabase,
    BUZZ_LANE,
    link
  );
  for (const expired of expiredIds) {
    const doc = await getBuzzDoc(supabase, link.user_id, expired.resourceId);
    await putBuzzDoc(
      supabase,
      link.user_id,
      expired.resourceId,
      markBuzzPending(doc, expired.id, "failed", "expired unclaimed")
    );
  }
  return NextResponse.json({ intents: envelopes });
}
