/**
 * CM6: inbound conversion postbacks. Auth is the per-account conversion
 * token minted at account registration — never a platform credential. Each
 * event is attributed to a creative ref so it shows up against the right
 * creative in reporting. Each postback carries a client-supplied event_id;
 * a replay of the same (account, event_id) is dropped so retried postbacks
 * never double-count.
 */
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    account_ref?: string;
    creative_ref?: string;
    event?: string;
    event_id?: string;
    value_cents?: number;
    occurred_at?: string;
  };
  if (
    !body.token ||
    !body.account_ref ||
    !body.creative_ref ||
    !body.event ||
    !body.event_id
  ) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const supabase = serviceClient();
  // account_ref is only unique per (user_id, provider), so several rows can
  // share it. The token — unique per account — picks the tenant; a ref match
  // alone never does.
  const { data: candidates } = await supabase
    .from("ad_accounts")
    .select("id, user_id, conversion_token")
    .eq("account_ref", body.account_ref)
    .eq("status", "active")
    .limit(20);
  const account = (candidates ?? []).find((row) =>
    tokenMatches(body.token as string, row.conversion_token as string)
  );
  if (!account) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "bad occurred_at" }, { status: 400 });
  }
  const { error } = await supabase.from("ad_conversions").upsert(
    {
      user_id: account.user_id,
      account_id: account.id,
      event_id: String(body.event_id).slice(0, 128),
      creative_ref: String(body.creative_ref).slice(0, 256),
      event: String(body.event).slice(0, 64),
      value_cents:
        typeof body.value_cents === "number" &&
        Number.isFinite(body.value_cents)
          ? Math.round(body.value_cents)
          : null,
      occurred_at: occurredAt.toISOString(),
    },
    { onConflict: "account_id,event_id", ignoreDuplicates: true }
  );
  if (error) {
    return NextResponse.json({ error: "record failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
