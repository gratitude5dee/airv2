/**
 * Stripe webhook → verify signature (raw body, before any DB write) →
 * dedupe by event.id → 200. A redelivered event acknowledges without
 * reprocessing; a bad signature rejects before any write — the same
 * discipline as every other inbound webhook (goal.md §MA2.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { recordStripeEvent, verifyStripeSignature } from "@/lib/payments/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }
  const rawBody = await request.text();
  const event = verifyStripeSignature(rawBody, signature);
  if (!event) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const supabase = serviceClient();
  const fresh = await recordStripeEvent(supabase, event);
  if (!fresh) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  console.log(
    JSON.stringify({ msg: "stripe event", id: event.id, type: event.type })
  );
  return NextResponse.json({ ok: true });
}
