/**
 * Hosted approval surface (app.wzrd.tech/approve/<decision>): the shared
 * resolution + sanitized view for the two payment decision kinds, so the
 * Needs-you queue (/api/decisions) and the hosted page resolve through the
 * SAME rails and can never disagree:
 *  - purchase_review → resolvePurchaseReview (approve mints + delivers the
 *    single-use fill ticket; Link selection mints no ticket; deny writes
 *    the receipt) — the C20 invariants live there, not here.
 *  - payment_request → approvePaymentRequest (usd: direct-charge Stripe
 *    Checkout on the payee's connected account; usdc: wallet transfer
 *    intent) / dismissPaymentRequest.
 * The view is value-free (C18): amount band, masked card, host, memo —
 * never card values or credentials.
 */
import type { NextResponse } from "next/server";
import { NextResponse as Response } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { resolvePurchaseReview, PurchaseError } from "../vault/purchase";
import {
  approvePaymentRequest,
  dismissPaymentRequest,
  getPaymentRequest,
  type ApproveResult,
} from "../commerce/paymentRequests";
import { CommerceError, getMerchant } from "../commerce/merchants";
import { updateMiniAppCard } from "../miniapps/cards";
import { env } from "../env";

export const HOSTED_KINDS = ["purchase_review", "payment_request"] as const;

export interface HostedDecision {
  id: string;
  kind: string;
  ref: string | null;
  status: string;
  label?: string | null;
  payload: unknown;
  created_at?: string;
}

export interface HostedApprovalView {
  id: string;
  kind: "purchase_review" | "payment_request";
  status: string;
  label: string | null;
  agent: string | null;
  /** Countdown target: the payment request's expiry, or the deep link's. */
  expires_at: string | null;
  purchase?: {
    host: string;
    summary: string;
    amount_band: string;
    card_name: string;
    card_masked: string | null;
    link_supported: boolean;
  };
  payment?: {
    amount_display: string;
    amount_cents: number | null;
    currency: string;
    payee: string;
    memo: string;
    request_status: string;
  };
  /** Present when the Express Checkout Element can mount (fiat request,
   * payee still chargeable, publishable key configured). */
  express?: {
    publishable_key: string;
    stripe_account: string;
    amount_cents: number;
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Load the sanitized, value-free view the hosted page renders. */
export async function loadHostedApproval(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
  tokenExp: number | null
): Promise<HostedApprovalView | null> {
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, kind, ref, status, label, payload, created_at")
    .eq("id", decisionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (
    !decision ||
    !(HOSTED_KINDS as readonly string[]).includes(decision.kind as string)
  ) {
    return null;
  }
  const { data: user } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  const view: HostedApprovalView = {
    id: decision.id as string,
    kind: decision.kind as HostedApprovalView["kind"],
    status: decision.status as string,
    label: (decision.label as string | null) ?? null,
    agent: (user?.username as string | null) ?? null,
    expires_at: tokenExp ? new Date(tokenExp * 1000).toISOString() : null,
  };
  const payload = (decision.payload ?? {}) as Record<string, unknown>;

  if (decision.kind === "purchase_review") {
    view.purchase = {
      host: str(payload["host"]),
      summary: str(payload["summary"]),
      amount_band: str(payload["amount_band"]),
      card_name: str(payload["card_name"]),
      card_masked:
        typeof payload["card_masked"] === "string"
          ? payload["card_masked"]
          : null,
      link_supported: payload["link_supported"] === true,
    };
    return view;
  }

  const request = decision.ref
    ? await getPaymentRequest(supabase, userId, decision.ref as string)
    : null;
  view.payment = {
    amount_display: request?.amount_display ?? str(payload["amount_display"]),
    amount_cents: request?.amount_cents ?? null,
    currency: request?.currency ?? str(payload["currency"]),
    payee: request?.payee ?? str(payload["payee"]),
    memo: request?.memo ?? str(payload["memo"]),
    request_status: request?.status ?? "pending",
  };
  if (request?.expires_at) view.expires_at = request.expires_at;

  const publishableKey = env.stripePublishableKey();
  if (
    publishableKey &&
    request &&
    request.status === "pending" &&
    request.currency === "usd" &&
    request.payee_user_id &&
    request.amount_cents &&
    Date.parse(request.expires_at) > Date.now()
  ) {
    const merchant = await getMerchant(supabase, request.payee_user_id).catch(
      () => null
    );
    if (merchant?.charges_enabled) {
      view.express = {
        publishable_key: publishableKey,
        stripe_account: merchant.stripe_account_id,
        amount_cents: request.amount_cents,
      };
    }
  }
  return view;
}

/**
 * Resolve a hosted payment decision — extracted from /api/decisions so both
 * surfaces share one code path. Flips the decision row itself (approve /
 * dismiss) and refreshes the vault iMessage card, exactly as the queue did.
 * Throws PurchaseError / CommerceError for the caller to map.
 */
export async function resolveHostedDecision(
  supabase: SupabaseClient,
  userId: string,
  decision: HostedDecision,
  action: "approve" | "dismiss",
  method: "fill" | "link" = "fill"
): Promise<ApproveResult> {
  let result: ApproveResult = {};

  if (decision.kind === "purchase_review") {
    // V6 (C20): approving mints + redeems the single-use fill ticket,
    // delivers it to the box, and resumes the paused run; denying writes
    // the fill_denied receipt and resumes the run with approved=false.
    // Denying (and Link selection, which mints no ticket) must resolve even
    // while the box is start-limited — their run resumes are best-effort.
    try {
      const box =
        action === "approve" && method !== "link"
          ? await ensureBoxAwake(supabase, userId)
          : await ensureBoxAwake(supabase, userId).catch(() => null);
      await resolvePurchaseReview(
        supabase,
        userId,
        decision,
        action === "approve",
        box,
        method
      );
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  } else if (decision.kind === "payment_request" && decision.ref) {
    // MA8 #12: approval resolves through rails with their own invariants —
    // fiat mints a Stripe Checkout (Link) session on the payee's connected
    // account (the result carries the URL to open); USDC files the existing
    // wallet transfer intent whose own approval executes the send.
    if (action === "approve") {
      result = await approvePaymentRequest(
        supabase,
        userId,
        decision.ref,
        `${env.appOrigin()}/home`
      );
    } else {
      await dismissPaymentRequest(supabase, userId, decision.ref);
    }
  }

  await supabase
    .from("decisions")
    .update({
      status: action === "approve" ? "approved" : "dismissed",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", decision.id)
    .eq("user_id", userId);
  if (decision.kind === "purchase_review") {
    await updateMiniAppCard(supabase, userId, "vault", "default");
  }
  return result;
}

/** Map a resolution failure to the same HTTP shape /api/decisions used. */
export function hostedErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PurchaseError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status }
    );
  }
  if (error instanceof CommerceError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
