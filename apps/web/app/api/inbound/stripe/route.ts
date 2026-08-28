/**
 * Stripe webhook → verify signature (raw body, before any DB write) →
 * dedupe by event.id → dispatch → 200. A redelivered event acknowledges
 * without reprocessing; a bad signature rejects before any write — the same
 * discipline as every other inbound webhook (goal.md §MA2.3).
 *
 * MA8 dispatch (each handler is also replay-safe on its own via conditional
 * status flips, so at-least-once delivery still has exactly-once effects):
 *  - account.updated            → merchant capability sync
 *  - checkout.session.completed → order fulfillment / payment_request paid
 *  - checkout.session.expired   → abandoned checkout release
 *  - charge.refunded            → order reconciliation
 *  - payment_intent.succeeded   → express-checkout payment_request paid
 * A handler failure releases the event-id claim and returns 500 so Stripe
 * redelivers.
 */
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { recordStripeEvent, verifyStripeSignature } from "@/lib/payments/stripe";
import { syncAccountFromEvent } from "@/lib/commerce/merchants";
import {
  expireCheckoutSession,
  fulfillCheckoutSession,
  reconcileRefund,
} from "@/lib/commerce/checkout";
import {
  expirePaymentRequestSession,
  markPaymentRequestPaid,
  markPaymentRequestPaidByIntent,
} from "@/lib/commerce/paymentRequests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dispatch(
  supabase: SupabaseClient,
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case "account.updated":
      await syncAccountFromEvent(supabase, event.data.object);
      return;
    case "checkout.session.completed": {
      const session = event.data.object;
      const fulfilled = await fulfillCheckoutSession(supabase, session);
      if (!fulfilled) await markPaymentRequestPaid(supabase, session);
      return;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      await expireCheckoutSession(supabase, session);
      await expirePaymentRequestSession(supabase, session);
      return;
    }
    case "payment_intent.succeeded":
      await markPaymentRequestPaidByIntent(supabase, event.data.object);
      return;
    case "charge.refunded":
      await reconcileRefund(supabase, event.data.object);
      return;
    default:
      return;
  }
}

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

  try {
    await dispatch(supabase, event);
  } catch (error) {
    // Release the id claim so Stripe's redelivery can retry the effect.
    await supabase.from("stripe_events").delete().eq("event_id", event.id);
    console.error(
      JSON.stringify({
        msg: "stripe event dispatch failed",
        id: event.id,
        type: event.type,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }

  console.log(
    JSON.stringify({ msg: "stripe event", id: event.id, type: event.type })
  );
  return NextResponse.json({ ok: true });
}
