/**
 * CM6 CC0 gate, request side. POST proposes an ad write — it never executes
 * here; it lands in the "Needs you" queue as an 'ad_write' decision. GET
 * lists the user's writes so a client (or the box, via its owner's session)
 * can poll a write's gate state before invoking a platform write tool.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import {
  requestAdWrite,
  AdWriteError,
  type AdWriteKind,
} from "@/lib/ads/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_KINDS: AdWriteKind[] = [
  "create_campaign",
  "update_budget",
  "set_status",
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("ad_writes")
    .select(
      "id, account_id, kind, campaign_ref, status, daily_budget_cents, exposure_30d_cents, error, created_at, resolved_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ writes: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    account_id?: string;
    kind?: string;
    campaign_ref?: string;
    campaign_name?: string;
    daily_budget_cents?: number;
    status?: string;
    args?: Record<string, unknown>;
  };
  if (!body.account_id || typeof body.account_id !== "string") {
    return NextResponse.json({ error: "account_id required" }, { status: 400 });
  }
  if (!WRITE_KINDS.includes(body.kind as AdWriteKind)) {
    return NextResponse.json({ error: "unknown write kind" }, { status: 400 });
  }
  if (
    body.status !== undefined &&
    body.status !== "active" &&
    body.status !== "paused"
  ) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const result = await requestAdWrite(supabase, userId, {
      accountId: body.account_id,
      kind: body.kind as AdWriteKind,
      campaignRef: body.campaign_ref,
      campaignName: body.campaign_name,
      dailyBudgetCents: body.daily_budget_cents,
      status: body.status as "active" | "paused" | undefined,
      args: body.args,
    });
    return NextResponse.json(
      { write_id: result.writeId, decision_id: result.decisionId, status: "pending" },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof AdWriteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
