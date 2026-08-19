/**
 * MA8 checkout + orders. The client supplies only (product_key, quantity):
 * the price, currency, merchant account, and total are resolved server-side
 * from the published product row and the merchants table — tampering with
 * hidden fields cannot move money. Charges are created directly on the
 * merchant's connected account (no platform custody, by construction: the
 * only checkout path here is createConnectCheckoutSession).
 *
 * Fulfillment is webhook-only: a signed, idempotent
 * `checkout.session.completed` flips the order pending → paid exactly once.
 */
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { createConnectCheckoutSession } from "../payments/stripe";
import { getPublishedProduct, type StorefrontProduct } from "./catalog";
import { CommerceError, getMerchant } from "./merchants";

export interface Order {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  amount_cents: number;
  status: "pending" | "paid" | "refunded" | "expired";
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  buyer_key_hash: string;
  attribution: string | null;
  ticket_code: string | null;
  checked_in_at: string | null;
  created_at: string;
}

export const ORDER_COLUMNS =
  "id, user_id, product_id, quantity, amount_cents, status, " +
  "stripe_session_id, stripe_payment_intent_id, buyer_key_hash, " +
  "attribution, ticket_code, checked_in_at, created_at";

export function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const REF_RE = /^[a-zA-Z0-9:_.-]{1,128}$/;

export function sanitizeRef(value: unknown): string | null {
  return typeof value === "string" && REF_RE.test(value) ? value : null;
}

/** Best-effort funnel ledger write — never blocks the page. */
export async function logStorefrontEvent(
  supabase: SupabaseClient,
  userId: string,
  kind: "visit" | "product_view" | "checkout_started" | "purchase" | "refund",
  fields: { productId?: string; ref?: string | null; amountCents?: number } = {}
): Promise<void> {
  const { error } = await supabase.from("storefront_events").insert({
    user_id: userId,
    product_id: fields.productId ?? null,
    kind,
    ref: fields.ref ?? null,
    amount_cents: fields.amountCents ?? null,
  });
  if (error) {
    console.error(
      JSON.stringify({ msg: "storefront event insert failed", error: error.message })
    );
  }
}

export interface CheckoutStart {
  orderId: string;
  buyerKey: string;
  checkoutUrl: string;
}

/**
 * Create the order + the direct-charge Checkout session. Everything about
 * the money is server-derived; the returned buyerKey is the anonymous
 * buyer's receipt credential (only its hash is stored).
 */
export async function startCheckout(
  supabase: SupabaseClient,
  merchantUserId: string,
  productKey: string,
  quantityRaw: unknown,
  attribution: string | null,
  storefrontUrl: string
): Promise<CheckoutStart> {
  const quantity = Number(quantityRaw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new CommerceError("quantity must be between 1 and 10", 400);
  }
  const product = await getPublishedProduct(supabase, merchantUserId, productKey);
  if (!product) throw new CommerceError("product not found", 404);
  if (product.inventory !== null && product.inventory < quantity) {
    throw new CommerceError("not enough inventory", 409);
  }
  const merchant = await getMerchant(supabase, merchantUserId);
  if (!merchant || !merchant.charges_enabled) {
    throw new CommerceError("this shop is not accepting payments yet", 409);
  }
  const amountCents = product.price_cents * quantity;
  const buyerKey = randomBytes(16).toString("base64url");
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: merchantUserId,
      product_id: product.id,
      quantity,
      amount_cents: amountCents,
      buyer_key_hash: hashKey(buyerKey),
      attribution,
    })
    .select("id")
    .single();
  if (error || !order) {
    throw new CommerceError("could not create the order", 500);
  }
  const orderId = order.id as string;
  const session = await createConnectCheckoutSession(
    merchant.stripe_account_id,
    {
      amountCents,
      quantity,
      productName: product.name,
      successUrl: `${storefrontUrl}?order=${orderId}&k=${buyerKey}`,
      cancelUrl: storefrontUrl,
      metadata: { order_id: orderId },
    }
  );
  if (!session.url) throw new CommerceError("checkout session has no URL", 502);
  await supabase
    .from("orders")
    .update({ stripe_session_id: session.id })
    .eq("id", orderId);
  await logStorefrontEvent(supabase, merchantUserId, "checkout_started", {
    productId: product.id,
    ref: attribution,
    amountCents,
  });
  return { orderId, buyerKey, checkoutUrl: session.url };
}

/**
 * Record an attributed conversion against the merchant's first active ad
 * account, so storefront purchases land in the existing conversion
 * reporting. Best-effort: no account or no attribution, no row.
 */
async function recordConversion(
  supabase: SupabaseClient,
  userId: string,
  creativeRef: string,
  event: string,
  valueCents: number
): Promise<void> {
  const { data: account } = await supabase
    .from("ad_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!account) return;
  await supabase.from("ad_conversions").insert({
    user_id: userId,
    account_id: account.id,
    creative_ref: creativeRef,
    event,
    value_cents: valueCents,
  });
}

/**
 * `checkout.session.completed`: flip the order pending → paid exactly once
 * (the conditional update is the replay guard on top of event-id
 * idempotency), decrement inventory, mint the ticket for event tickets, and
 * write the funnel/conversion rows. Payment-request sessions resolve in
 * paymentRequests.ts — this only handles orders.
 */
export async function fulfillCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<boolean> {
  const { data: found } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (!found) return false;
  const order = found as unknown as Order;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const { data: flipped } = await supabase
    .from("orders")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntent,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  if (!flipped || flipped.length === 0) return false;

  const { data: productRow } = await supabase
    .from("storefront_products")
    .select("id, kind, inventory")
    .eq("id", order.product_id)
    .maybeSingle();
  if (productRow && typeof productRow.inventory === "number") {
    await supabase
      .from("storefront_products")
      .update({
        inventory: Math.max(0, productRow.inventory - order.quantity),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productRow.id);
  }
  if (productRow?.kind === "event_ticket") {
    await supabase
      .from("orders")
      .update({ ticket_code: randomBytes(16).toString("base64url") })
      .eq("id", order.id);
  }
  await logStorefrontEvent(supabase, order.user_id, "purchase", {
    productId: order.product_id,
    ref: order.attribution,
    amountCents: order.amount_cents,
  });
  if (order.attribution) {
    await recordConversion(
      supabase,
      order.user_id,
      order.attribution,
      "storefront_purchase",
      order.amount_cents
    );
  }
  return true;
}

/** `checkout.session.expired`: abandoned checkouts release their order. */
export async function expireCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  await supabase
    .from("orders")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending");
}

/**
 * `charge.refunded`: refunds happen in the merchant's Stripe — here they
 * only reconcile the receipt (paid → refunded) and the funnel ledger.
 */
export async function reconcileRefund(
  supabase: SupabaseClient,
  charge: Stripe.Charge
): Promise<void> {
  const paymentIntent =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);
  if (!paymentIntent) return;
  const { data: flipped } = await supabase
    .from("orders")
    .update({ status: "refunded", resolved_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", paymentIntent)
    .eq("status", "paid")
    .select("id, user_id, product_id, amount_cents, attribution");
  for (const order of flipped ?? []) {
    await logStorefrontEvent(supabase, order.user_id as string, "refund", {
      productId: order.product_id as string,
      ref: (order.attribution as string | null) ?? null,
      amountCents: order.amount_cents as number,
    });
  }
}

/** Receipt lookup for the anonymous buyer: order id + buyer key. */
export async function orderForReceipt(
  supabase: SupabaseClient,
  orderId: string,
  buyerKey: string
): Promise<(Order & { product: StorefrontProduct | null }) | null> {
  const { data } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  if (!data) return null;
  const order = data as unknown as Order;
  if (order.buyer_key_hash !== hashKey(buyerKey)) return null;
  const { data: product } = await supabase
    .from("storefront_products")
    .select(
      "id, user_id, product_key, kind, name, description, image_url, price_cents, inventory, active"
    )
    .eq("id", order.product_id)
    .maybeSingle();
  return { ...order, product: (product as StorefrontProduct | null) ?? null };
}

/**
 * Event check-in (owner session only — the loader's guest-action gate keeps
 * guests out): a ticket code checks in exactly once.
 */
export async function checkInTicket(
  supabase: SupabaseClient,
  merchantUserId: string,
  ticketCode: string
): Promise<{ ok: boolean; message: string }> {
  const code = ticketCode.trim();
  if (!code) return { ok: false, message: "enter a ticket code" };
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, checked_in_at")
    .eq("user_id", merchantUserId)
    .eq("ticket_code", code)
    .maybeSingle();
  if (!order || order.status !== "paid") {
    return { ok: false, message: "ticket not found" };
  }
  const { data: flipped } = await supabase
    .from("orders")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("user_id", merchantUserId)
    .is("checked_in_at", null)
    .select("id");
  if (!flipped || flipped.length === 0) {
    return { ok: false, message: "already checked in" };
  }
  return { ok: true, message: "checked in" };
}

/** Recent orders for the merchant view. */
export async function listOrders(
  supabase: SupabaseClient,
  userId: string
): Promise<Order[]> {
  const { data } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as Order[] | null) ?? [];
}
