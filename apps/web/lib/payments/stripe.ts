/**
 * MA2.3 Stripe wrapper — the only module allowed to touch the stripe SDK.
 * Platform-account client, webhook signature verification, event-id
 * idempotency (stripe_events, first-insert-wins) and a Checkout-session
 * helper (Link surfaces automatically on Checkout).
 */
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  if (!client) {
    client = new Stripe(env.stripeSecretKey());
  }
  return client;
}

/** Verify a webhook payload's Stripe-Signature header; null on any failure. */
export function verifyStripeSignature(
  rawBody: string,
  signature: string
): Stripe.Event | null {
  try {
    return stripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      env.stripeWebhookSecret()
    );
  } catch {
    return null;
  }
}

/**
 * Idempotency by event.id — the same discipline as every other inbound
 * webhook. Returns false when the event was already recorded (a redelivery
 * must be acknowledged without reprocessing).
 */
export async function recordStripeEvent(
  supabase: SupabaseClient,
  event: Stripe.Event
): Promise<boolean> {
  const { error } = await supabase.from("stripe_events").insert({
    event_id: event.id,
    event_type: event.type,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`stripe event record failed: ${error.message}`);
}

export interface CheckoutParams {
  /** Amount in USD cents. */
  amountCents: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  /** Attributed back on the webhook (e.g. user_id, app slug). */
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
}

/**
 * One-off USD Checkout session. Link (and other wallets) surface
 * automatically on Stripe Checkout — no extra configuration here.
 */
export async function createCheckoutSession(
  params: CheckoutParams
): Promise<CheckoutSession> {
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: params.amountCents,
          product_data: { name: params.productName },
        },
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata ?? {},
  });
  return { id: session.id, url: session.url };
}

/* ------------------------------------------------------- Connect (MA8) */

/**
 * Stripe Connect Standard account for a storefront merchant. Standard
 * accounts hold their own balance and relationship with Stripe — the
 * platform never custodies merchant funds (goal.md MA8).
 */
export async function createConnectAccount(): Promise<string> {
  const account = await stripeClient().accounts.create({ type: "standard" });
  return account.id;
}

/** Hosted onboarding link for a Standard account. */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<string> {
  const link = await stripeClient().accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export interface ConnectCheckoutParams extends CheckoutParams {
  quantity?: number;
}

/**
 * Direct-charge Checkout session created ON the merchant's connected
 * account (the `stripeAccount` request option): the merchant is the payee
 * of record, the funds settle to their own Stripe balance, and the platform
 * is never in the money path. Link surfaces automatically on Checkout. The
 * session expires after 30 minutes so abandoned checkouts release.
 */
export async function createConnectCheckoutSession(
  stripeAccount: string,
  params: ConnectCheckoutParams
): Promise<CheckoutSession> {
  const session = await stripeClient().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: params.quantity ?? 1,
          price_data: {
            currency: "usd",
            unit_amount: params.amountCents,
            product_data: { name: params.productName },
          },
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata ?? {},
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    { stripeAccount }
  );
  return { id: session.id, url: session.url };
}
