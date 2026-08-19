/**
 * crm_update backing tool (MA6 #9), called by the user's own Hermes
 * (gateway-token auth — same pattern as /api/browser/purchase). The agent
 * maintains the box-side CRM from conversations:
 *
 *  - an edit derived from the OWNER's own turn applies immediately, with
 *    agent provenance recorded on the person;
 *  - an edit derived from someone else's message (tier >= 1) is
 *    decision-gated: it files a crm_update decision and touches nothing
 *    until the owner approves (hostile senders get a card, never a write).
 *
 * The tier is resolved server-side from the active turn — the box never
 * self-reports trust.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { armStopAfter } from "@/lib/orchestrator/boxes";
import {
  applyPatchOnBox,
  sanitizePatch,
  type CrmPatch,
} from "@/lib/crm/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function boxUserId(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  return box ? (box.user_id as string) : null;
}

/** The active turn's sender tier, resolved server-side: an open flush chain
 * carries the burst's sender tier; anything else is the owner's own
 * web/voice/desktop composer (tier 0). Unknown legacy rows fail closed. */
async function activeTurnTier(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: flushJob } = await supabase
    .from("flush_jobs")
    .select("sender_tier, chain_started_at")
    .eq("user_id", userId)
    .not("chain_started_at", "is", null)
    .order("chain_started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: openRun } = await supabase
    .from("agent_runs")
    .select("started_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const flushStarted = flushJob?.chain_started_at
    ? Date.parse(String(flushJob.chain_started_at))
    : Number.NEGATIVE_INFINITY;
  const runStarted = openRun?.started_at
    ? Date.parse(String(openRun.started_at))
    : Number.NEGATIVE_INFINITY;
  if (flushJob && flushStarted >= runStarted) {
    return typeof flushJob.sender_tier === "number" ? flushJob.sender_tier : 2;
  }
  return 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const patch: CrmPatch = sanitizePatch(body);
  if (
    !patch.person_id &&
    !patch.name &&
    !patch.notes &&
    !patch.emails?.length &&
    !patch.tags?.length
  ) {
    return NextResponse.json({ error: "empty update" }, { status: 400 });
  }

  const tier = await activeTurnTier(supabase, userId);
  if (tier > 0) {
    // Tier-derived edit: file the decision, write nothing (MA6 #9).
    const summary =
      typeof body.summary === "string" ? body.summary.slice(0, 160) : null;
    const { error } = await supabase.from("decisions").insert({
      user_id: userId,
      kind: "crm_update",
      label: (summary ?? `Update ${patch.name ?? "a contact"} in People`).slice(
        0,
        200
      ),
      payload: patch,
    });
    if (error) {
      return NextResponse.json(
        { error: "could not file the update" },
        { status: 502 }
      );
    }
    return NextResponse.json({ status: "pending_approval" });
  }

  try {
    const person = await applyPatchOnBox(supabase, userId, patch, {
      source: "agent",
      at: new Date().toISOString(),
      note: typeof body.summary === "string" ? body.summary.slice(0, 160) : undefined,
    });
    return NextResponse.json({
      status: "applied",
      person_id: person?.id ?? null,
    });
  } catch {
    return NextResponse.json({ error: "box unavailable" }, { status: 502 });
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
