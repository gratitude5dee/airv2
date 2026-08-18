/**
 * V5 social engagement gates, called by the user's own Hermes (gateway-token
 * auth, same pattern as /api/cards/computer). Two actions:
 *  - claim: spend one unit of a standing rule's daily cap before a like/
 *    reaction. The counter lives in Postgres so box restarts can't reset it;
 *    refusals (rule off, cap reached, quiet hours) come back as plain JSON
 *    the agent can read aloud (C22).
 *  - propose: file a `social_post` decision with the exact text + target for
 *    a comment/reply/post, referencing the paused Hermes run. The owner's
 *    approve/dismiss in Needs-you resumes the run via /v1/runs/{id}/approval.
 * Public posting has no third path: it is a standing rule or an approval.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { claimRuleUnit, RULE_PLATFORMS } from "@/lib/browser/rules";
import { allAdapters } from "@/lib/publish/registry";

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

/** Which platforms have an API adapter — the agent checks this FIRST (§V5:
 * API over browser; the browser path is only for uncovered actions). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    adapter_platforms: allAdapters().map((adapter) => adapter.platform),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    platform?: unknown;
    target?: unknown;
    text?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const platform = typeof body?.platform === "string" ? body.platform : "";
  const target = typeof body?.target === "string" ? body.target.trim() : "";
  if (!(RULE_PLATFORMS as readonly string[]).includes(platform) || !target) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (action === "claim") {
    const result = await claimRuleUnit(
      supabase,
      userId,
      "social-engage",
      platform,
      target
    );
    return NextResponse.json(result, { status: result.allowed ? 200 : 403 });
  }

  if (action === "propose") {
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 5000) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    // The paused run is resolved server-side (the control plane created it and
    // holds hermes_run_id in agent_runs) — the box never names which run gets
    // resumed. One box == one Hermes, so the newest open run is the caller.
    const { data: activeRun } = await supabase
      .from("agent_runs")
      .select("hermes_run_id")
      .eq("user_id", userId)
      .is("ended_at", null)
      .not("hermes_run_id", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const runId = activeRun ? (activeRun.hermes_run_id as string) : null;
    const { data: decision, error } = await supabase
      .from("decisions")
      .insert({
        user_id: userId,
        kind: "social_post",
        platform,
        ref: runId,
        label: `Post on ${platform}`,
        // The approval card shows the owner EXACTLY what will be posted and
        // where — the full text and the precise target (§V5).
        payload: { platform, target, text },
      })
      .select("id")
      .single();
    if (error || !decision) {
      return NextResponse.json({ error: "decision failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, decision_id: decision.id });
  }

  return NextResponse.json({ error: "invalid request" }, { status: 400 });
}
