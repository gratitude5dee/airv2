/**
 * cal.com webhook → verify (per-account sealed secret) → resolve → dedupe →
 * 200 → nudge the box sync. The webhook body's content is never stored
 * control-plane-side (C4): we ack and tell the box to pull bookings itself
 * through its cal.com source. Bad signature rejects before any DB write;
 * a replay dedupes on inbound_events and produces no second nudge (C8).
 */
import { after, NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { openSecret } from "@/lib/crypto/secretbox";
import { dedupeInboundEvent } from "@/lib/routing/inbound";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { nudgeSync } from "@/lib/calendar/store";
import {
  calcomDedupeKey,
  isStale,
  verifyCalcomSignature,
  type CalcomEnvelope,
} from "@/lib/calendar/calcom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const accountId = request.nextUrl.searchParams.get("account") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(accountId)) {
    return NextResponse.json({ error: "unknown account" }, { status: 404 });
  }
  const rawBody = await request.text();

  const supabase = serviceClient();
  const { data: account } = await supabase
    .from("calendar_accounts")
    .select("id, user_id, webhook_secret_sealed, status")
    .eq("id", accountId)
    .eq("provider", "calcom")
    .maybeSingle();
  if (
    !account ||
    account.status === "revoked" ||
    !account.webhook_secret_sealed
  ) {
    return NextResponse.json({ error: "unknown account" }, { status: 404 });
  }

  // 1. Verify — before any DB write.
  const sealKey = env.boxDashboardAuthKey();
  if (!sealKey) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  let secret: string;
  try {
    secret = openSecret(account.webhook_secret_sealed as string, sealKey);
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (
    !verifyCalcomSignature(
      rawBody,
      request.headers.get("x-cal-signature-256"),
      secret
    )
  ) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let envelope: CalcomEnvelope;
  try {
    envelope = JSON.parse(rawBody) as CalcomEnvelope;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // 2. Freshness: acknowledge but ignore stale replays.
  if (isStale(envelope.createdAt)) {
    return NextResponse.json({ ok: true, stale: true });
  }

  // 3. Dedupe: content-free key only — never the body (C4).
  const userId = account.user_id as string;
  const { alreadySeen } = await dedupeInboundEvent(
    supabase,
    {
      webhookId: `calcom:${accountId}`,
      messageId: calcomDedupeKey(envelope),
    },
    userId
  );
  if (alreadySeen) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 4. Ack, then work (C8): the nudge runs after the response is sent.
  after(async () => {
    try {
      const box = await ensureBoxAwake(supabase, userId);
      await nudgeSync(box.target, box.boxId);
      await armStopAfter(supabase, userId).catch(() => undefined);
      await supabase
        .from("calendar_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", accountId);
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "calcom sync nudge failed",
          user_id: userId,
          account_id: accountId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  });

  return NextResponse.json({ ok: true });
}
