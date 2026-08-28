/**
 * MA8 #12 payment requests — the generic "agent needs to buy / user needs
 * to pay" surface. The agent (or a mini-app) can only FILE a request: a
 * payment_request decision is the gate, and approval resolves through rails
 * that already carry their own invariants:
 *  - usd  → Stripe Checkout (Link) created directly on the payee merchant's
 *           connected account (no platform custody);
 *  - usdc → the existing wallet transfer lane (its own run_approval executes
 *           the send server-side; no new money-moving code).
 * Paid is webhook-confirmed for fiat; abandoned requests expire.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  createConnectCheckoutSession,
  createConnectPaymentIntent,
  retrieveConnectPaymentIntent,
} from "../payments/stripe";
import { createTransferRequest, validateSendAddress } from "../wallet/send";
import { CommerceError, getMerchant } from "./merchants";

export interface PaymentRequest {
  id: string;
  user_id: string;
  amount_cents: number | null;
  amount_display: string;
  currency: "usd" | "usdc";
  payee: string;
  payee_user_id: string | null;
  memo: string;
  status: "pending" | "approved" | "paid" | "dismissed" | "expired";
  decision_id: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  transfer_id: string | null;
  expires_at: string;
  created_at: string;
}

export const REQUEST_COLUMNS =
  "id, user_id, amount_cents, amount_display, currency, payee, " +
  "payee_user_id, memo, status, decision_id, stripe_session_id, " +
  "stripe_payment_intent_id, transfer_id, expires_at, created_at";

export interface PaymentRequestInput {
  currency: string;
  /** usd: integer cents. usdc: decimal display amount (e.g. "12.50"). */
  amount: unknown;
  /** usd: payee username on this platform. usdc: 0x address. */
  payee: unknown;
  memo?: unknown;
}

/**
 * File the request + its payment_request decision. Nothing moves until the
 * owner approves.
 */
export async function createPaymentRequest(
  supabase: SupabaseClient,
  userId: string,
  input: PaymentRequestInput
): Promise<{ requestId: string; decisionId: string }> {
  const memo =
    typeof input.memo === "string" ? input.memo.trim().slice(0, 500) : "";
  const currency = input.currency === "usdc" ? "usdc" : "usd";
  let amountCents: number | null = null;
  let amountDisplay: string;
  let payee: string;
  let payeeUserId: string | null = null;

  if (currency === "usd") {
    const cents = Number(input.amount);
    if (!Number.isInteger(cents) || cents <= 0 || cents > 100_000_00) {
      throw new CommerceError("amount must be a positive number of cents", 400);
    }
    amountCents = cents;
    amountDisplay = `$${(cents / 100).toFixed(2)}`;
    const username =
      typeof input.payee === "string" ? input.payee.trim().toLowerCase() : "";
    if (!username) throw new CommerceError("payee username required", 400);
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (!user) throw new CommerceError("payee not found", 404);
    payeeUserId = user.id as string;
    const merchant = await getMerchant(supabase, payeeUserId);
    if (!merchant || !merchant.charges_enabled) {
      throw new CommerceError("payee is not set up to accept payments", 409);
    }
    payee = username;
  } else {
    const display = typeof input.amount === "string" ? input.amount.trim() : "";
    if (!/^\d+(\.\d{1,6})?$/.test(display) || Number(display) <= 0) {
      throw new CommerceError("amount must be a positive decimal", 400);
    }
    amountDisplay = display;
    payee = validateSendAddress(
      typeof input.payee === "string" ? input.payee : ""
    );
  }

  const { data: request, error } = await supabase
    .from("payment_requests")
    .insert({
      user_id: userId,
      amount_cents: amountCents,
      amount_display: amountDisplay,
      currency,
      payee,
      payee_user_id: payeeUserId,
      memo,
    })
    .select("id")
    .single();
  if (error || !request) {
    throw new CommerceError("could not record the payment request", 500);
  }
  const label = memo
    ? `Pay ${amountDisplay} ${currency === "usdc" ? "USDC " : ""}to ${payee} — ${memo}`
    : `Pay ${amountDisplay} ${currency === "usdc" ? "USDC " : ""}to ${payee}`;
  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "payment_request",
      ref: request.id,
      label: label.slice(0, 500),
      payload: {
        currency,
        amount_display: amountDisplay,
        payee,
        memo,
      },
    })
    .select("id")
    .single();
  if (decisionError || !decision) {
    await supabase
      .from("payment_requests")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", request.id);
    throw new CommerceError("could not create the approval", 500);
  }
  await supabase
    .from("payment_requests")
    .update({ decision_id: decision.id })
    .eq("id", request.id);
  return {
    requestId: request.id as string,
    decisionId: decision.id as string,
  };
}

/** Both approval surfaces (Pay page + decisions API) converge here so the
 * Needs-you card can't go stale. */
async function resolveLinkedDecision(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string | null,
  status: "approved" | "dismissed"
): Promise<void> {
  if (!decisionId) return;
  await supabase
    .from("decisions")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", decisionId)
    .eq("user_id", userId)
    .eq("status", "pending");
}

export async function getPaymentRequest(
  supabase: SupabaseClient,
  userId: string,
  requestId: string
): Promise<PaymentRequest | null> {
  const { data } = await supabase
    .from("payment_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as PaymentRequest | null) ?? null;
}

export interface ApproveResult {
  /** usd: the Stripe Checkout (Link) URL to open. */
  checkoutUrl?: string;
  /** usdc: the wallet run_approval decision that executes the send. */
  walletDecisionId?: string;
}

/**
 * Owner approval. usd mints the direct-charge Checkout session on the payee
 * merchant's connected account (payee resolved server-side at request time
 * — never from the approval call). usdc files the existing wallet transfer
 * intent, whose own approval executes the send.
 */
export async function approvePaymentRequest(
  supabase: SupabaseClient,
  userId: string,
  requestId: string,
  returnUrl: string
): Promise<ApproveResult> {
  const request = await getPaymentRequest(supabase, userId, requestId);
  if (!request) throw new CommerceError("payment request not found", 404);
  if (request.status !== "pending") {
    throw new CommerceError("this request was already resolved", 409);
  }
  if (Date.parse(request.expires_at) < Date.now()) {
    await supabase
      .from("payment_requests")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("id", request.id)
      .eq("status", "pending");
    throw new CommerceError("this request has expired", 410);
  }

  if (request.currency === "usd") {
    if (!request.payee_user_id || !request.amount_cents) {
      throw new CommerceError("malformed payment request", 500);
    }
    const merchant = await getMerchant(supabase, request.payee_user_id);
    if (!merchant || !merchant.charges_enabled) {
      throw new CommerceError("payee can no longer accept payments", 409);
    }
    const session = await createConnectCheckoutSession(
      merchant.stripe_account_id,
      {
        amountCents: request.amount_cents,
        productName: request.memo || `Payment to ${request.payee}`,
        successUrl: returnUrl,
        cancelUrl: returnUrl,
        metadata: { payment_request_id: request.id },
      }
    );
    if (!session.url) {
      throw new CommerceError("checkout session has no URL", 502);
    }
    await supabase
      .from("payment_requests")
      .update({ status: "approved", stripe_session_id: session.id })
      .eq("id", request.id)
      .eq("status", "pending");
    await resolveLinkedDecision(supabase, userId, request.decision_id, "approved");
    return { checkoutUrl: session.url };
  }

  const { transferId, decisionId } = await createTransferRequest(
    supabase,
    userId,
    request.payee,
    request.amount_display,
    "usdc"
  );
  await supabase
    .from("payment_requests")
    .update({ status: "approved", transfer_id: transferId })
    .eq("id", request.id)
    .eq("status", "pending");
  await resolveLinkedDecision(supabase, userId, request.decision_id, "approved");
  return { walletDecisionId: decisionId };
}

export interface ExpressIntent {
  clientSecret: string;
  paymentIntentId: string;
  /** The connected account the intent lives on — the browser's Stripe.js
   * must be scoped to it (`Stripe(pk, { stripeAccount })`). Account ids are
   * routing metadata, not secrets. */
  stripeAccount: string;
  amountCents: number;
}

/**
 * The Express Checkout Element's server half: a direct-charge PaymentIntent
 * on the payee merchant's connected account for a still-pending request.
 * Filing the intent does NOT approve the request — the wallet confirmation
 * is the approval tap, and the payment_intent.succeeded webhook flips the
 * request to paid and resolves the decision. An abandoned intent leaves the
 * request pending, so Decline (and the Needs-you card) still work.
 */
export async function createExpressPaymentIntent(
  supabase: SupabaseClient,
  userId: string,
  requestId: string
): Promise<ExpressIntent> {
  const request = await getPaymentRequest(supabase, userId, requestId);
  if (!request) throw new CommerceError("payment request not found", 404);
  if (request.status !== "pending") {
    throw new CommerceError("this request was already resolved", 409);
  }
  if (Date.parse(request.expires_at) < Date.now()) {
    throw new CommerceError("this request has expired", 410);
  }
  if (
    request.currency !== "usd" ||
    !request.payee_user_id ||
    !request.amount_cents
  ) {
    throw new CommerceError("express checkout is fiat-only", 409);
  }
  const merchant = await getMerchant(supabase, request.payee_user_id);
  if (!merchant || !merchant.charges_enabled) {
    throw new CommerceError("payee can no longer accept payments", 409);
  }
  // Double-charge guard: one live intent per request. A stored intent is
  // reused while still confirmable; a succeeded/processing one blocks a
  // second charge outright (the webhook will flip the request to paid);
  // only a dead intent (canceled, or unknown to Stripe) is replaced.
  if (request.stripe_payment_intent_id) {
    const existing = await retrieveConnectPaymentIntent(
      merchant.stripe_account_id,
      request.stripe_payment_intent_id
    );
    if (existing) {
      if (existing.status === "succeeded" || existing.status === "processing") {
        throw new CommerceError("this request was already paid", 409);
      }
      if (existing.status !== "canceled" && existing.clientSecret) {
        return {
          clientSecret: existing.clientSecret,
          paymentIntentId: existing.id,
          stripeAccount: merchant.stripe_account_id,
          amountCents: request.amount_cents,
        };
      }
    }
  }
  const intent = await createConnectPaymentIntent(merchant.stripe_account_id, {
    amountCents: request.amount_cents,
    description: request.memo || `Payment to ${request.payee}`,
    metadata: { payment_request_id: request.id },
  });
  if (!intent.clientSecret) {
    throw new CommerceError("payment intent has no client secret", 502);
  }
  await supabase
    .from("payment_requests")
    .update({ stripe_payment_intent_id: intent.id })
    .eq("id", request.id)
    .eq("status", "pending");
  return {
    clientSecret: intent.clientSecret,
    paymentIntentId: intent.id,
    stripeAccount: merchant.stripe_account_id,
    amountCents: request.amount_cents,
  };
}

export async function dismissPaymentRequest(
  supabase: SupabaseClient,
  userId: string,
  requestId: string
): Promise<void> {
  const request = await getPaymentRequest(supabase, userId, requestId);
  await supabase
    .from("payment_requests")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("user_id", userId)
    .eq("status", "pending");
  if (request) {
    await resolveLinkedDecision(supabase, userId, request.decision_id, "dismissed");
  }
}

/** Webhook confirmation: the fiat leg is paid. Replay-safe by the
 * conditional status update on top of event-id idempotency. */
export async function markPaymentRequestPaid(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<boolean> {
  const { data: flipped } = await supabase
    .from("payment_requests")
    .update({ status: "paid", resolved_at: new Date().toISOString() })
    .eq("stripe_session_id", session.id)
    .eq("status", "approved")
    .select("id");
  return (flipped ?? []).length > 0;
}

/** Webhook confirmation for the Express Checkout lane: the wallet payment
 * succeeded, so the request is paid and its decision resolves — the wallet
 * tap WAS the approval. Replay-safe by the conditional status flip. */
export async function markPaymentRequestPaidByIntent(
  supabase: SupabaseClient,
  intent: Stripe.PaymentIntent
): Promise<boolean> {
  const requestId = intent.metadata?.["payment_request_id"];
  if (!requestId) return false;
  const { data: flipped } = await supabase
    .from("payment_requests")
    .update({ status: "paid", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("stripe_payment_intent_id", intent.id)
    .in("status", ["pending", "approved"])
    .select("user_id, decision_id");
  const row = (flipped ?? [])[0] as
    | { user_id: string; decision_id: string | null }
    | undefined;
  if (!row) return false;
  await resolveLinkedDecision(supabase, row.user_id, row.decision_id, "approved");
  return true;
}

/** Abandoned fiat sessions release their request back to expired. */
export async function expirePaymentRequestSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  await supabase
    .from("payment_requests")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("stripe_session_id", session.id)
    .eq("status", "approved");
}

export async function listPaymentRequests(
  supabase: SupabaseClient,
  userId: string
): Promise<PaymentRequest[]> {
  const { data } = await supabase
    .from("payment_requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as PaymentRequest[] | null) ?? [];
}
