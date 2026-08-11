/**
 * CM6: the user's connected ad accounts (metadata only — sealed keys and
 * conversion tokens never leave the server) and the Meta Ads MCP install.
 * POST with {"install":"meta-ads"} registers Meta's official MCP in the
 * user's box; the per-user OAuth handshake then happens agent-side.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { installMetaAdsMcp } from "@/lib/provisioning/connectors";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
import { spendCeilingCents } from "@/lib/ads/spend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const [{ data: accounts }, { data: campaigns }, ceiling] = await Promise.all(
    [
      supabase
        .from("ad_accounts")
        .select("id, provider, account_ref, label, status, created_at")
        .eq("user_id", userId),
      supabase
        .from("ad_campaigns")
        .select(
          "id, account_id, campaign_ref, name, daily_budget_cents, status"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      spendCeilingCents(supabase, userId),
    ]
  );
  return NextResponse.json({
    accounts: accounts ?? [],
    campaigns: campaigns ?? [],
    spend_ceiling_cents: ceiling,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    install?: string;
  };
  if (body.install !== "meta-ads") {
    return NextResponse.json({ error: "unknown install" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    await installMetaAdsMcp(supabase, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "box start limit" }, { status: 429 });
    }
    return NextResponse.json({ error: "install failed" }, { status: 502 });
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
