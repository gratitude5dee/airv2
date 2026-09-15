/**
 * Kernel purchase choreography (Phase 2, C29/C30):
 *   propose → verify the purchase object against a backend-derived quote
 *   (never the agent's own numbers) → freeze → purchase_review decision →
 *   owner approve → performOperation authorize → aliases to the box →
 *   fill → submit once → outcome reconciliation (unknown_outcome on
 *   ambiguity — never a retry).
 *
 * What the owner approves is exactly what gets minted: `kernel_purchases.
 * purchase` is the frozen, verified object; the agent can never re-propose.
 * Card aliases are the only digits in the system and only ever travel
 * control-plane → box over TLS after an approval exists.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vaults } from "@onkernel/sdk/resources";
import { safeCheckoutUrl } from "../checkout/handoffs";
import { amountBand } from "../vault/tickets";
import { PurchaseError } from "../vault/purchase";
import { mintApprovalUrl } from "../approvals/token";
import { env } from "../env";
import { KernelError, kernelClient } from "./client";
import {
  AGENTCARD_WALLET_KEY,
  LINK_WALLET_KEY,
  authorizeKernelItem,
  ensureKernelVault,
  getKernelItem,
  kernelItemEvents,
  syncKernelVaultItems,
} from "./vaults";
import { stageKernelAction } from "./actions";

export type KernelPurchaseStatus =
  | "proposed" | "pending_approval" | "authorized" | "ready" | "consumed"
  | "submitted" | "unknown_outcome" | "failed" | "expired" | "declined"
  | "cancelled";

export interface KernelPurchase {
  id: string;
  user_id: string;
  decision_id: string | null;
  kernel_session_id: string | null;
  item_key: string | null;
  purchase: KernelPurchaseObject;
  card_item_id: string | null;
  status: KernelPurchaseStatus;
  submitted_at: string | null;
  outcome: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** The frozen, backend-verified object the owner approves (C29). */
export interface KernelPurchaseObject {
  merchant_name: string;
  merchant_url: string;
  amount_cents: number;
  currency: string;
  line_items?: Array<{ name: string; quantity?: number; unit_amount?: number }>;
  context?: string;
  provider?: "link" | "agentcard";
  payment_method_id?: string;
}

const PURCHASE_COLUMNS =
  "id, user_id, decision_id, kernel_session_id, item_key, purchase, card_item_id, status, submitted_at, outcome, created_at, updated_at";

interface KernelPurchaseRow {
  id: string;
  user_id: string;
  decision_id: string | null;
  kernel_session_id: string | null;
  item_key: string | null;
  purchase: KernelPurchaseObject;
  card_item_id: string | null;
  status: KernelPurchaseStatus;
  submitted_at: string | null;
  outcome: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function hydratePurchase(row: KernelPurchaseRow): KernelPurchase {
  return {
    id: row.id,
    user_id: row.user_id,
    decision_id: row.decision_id,
    kernel_session_id: row.kernel_session_id,
    item_key: row.item_key,
    purchase: row.purchase,
    card_item_id: row.card_item_id,
    status: row.status,
    submitted_at: row.submitted_at,
    outcome: row.outcome ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/* ------------------------------------------------------------------ *
 * Backend quote derivation (C29): the agent proposes; the control plane
 * verifies against the merchant's own page. Stripe payment links carry a
 * structured `line_item_group` / `account_settings` blob; other pages fall
 * back to JSON-LD offers and Open Graph price meta. Nothing the agent
 * claims is trusted.
 * ------------------------------------------------------------------ */

export interface MerchantQuote {
  amount_cents: number;
  currency: string;
  merchant_name: string | null;
  line_items?: KernelPurchaseObject["line_items"];
}

const QUOTE_FETCH_MS = 10_000;
const HTML_MAX_BYTES = 2_000_000;

async function fetchMerchantHtml(url: URL): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(QUOTE_FETCH_MS),
      redirect: "follow",
      headers: {
        "user-agent": "air-shop-quote/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    const text = await response.text();
    return text.slice(0, HTML_MAX_BYTES);
  } catch {
    return null;
  }
}

function cents(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[$,\s]/g, ""))
        : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  // Stripe page blobs are already minor units; HTML prices are major units.
  // Callers pick which interpretation applies.
  return parsed;
}

function extractStripeLinkQuote(html: string): MerchantQuote | null {
  // buy.stripe.com and Checkout pages embed a `line_item_group` blob.
  const groupMatch = html.match(/"line_item_group"\s*:\s*\{[^}]*"total"\s*:\s*(\d+)[^}]*"currency"\s*:\s*"([a-z]{3})"/i)
    ?? html.match(/"total"\s*:\s*(\d+)[^}]{0,200}"currency"\s*:\s*"([a-z]{3})"/i);
  if (!groupMatch) return null;
  const amount = Number(groupMatch[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const nameMatch = html.match(/"display_name"\s*:\s*"([^"\\]{1,200})"/i);
  const lineItems: KernelPurchaseObject["line_items"] = [];
  for (const match of html.matchAll(/"item_name"\s*:\s*"([^"\\]{1,200})"[^}]{0,400}?"unit_amount"\s*:\s*(\d+)/gi)) {
    lineItems.push({
      name: match[1] ?? "item",
      unit_amount: Number(match[2]),
    });
    if (lineItems.length >= 10) break;
  }
  return {
    amount_cents: amount,
    currency: groupMatch[2]?.toLowerCase() ?? "usd",
    merchant_name: nameMatch?.[1] ?? null,
    line_items: lineItems.length > 0 ? lineItems : undefined,
  };
}

function extractJsonLdQuote(html: string): MerchantQuote | null {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1] ?? "");
    } catch {
      continue;
    }
    const quote = findOffer(parsed);
    if (quote) return quote;
  }
  return null;
}

function findOffer(node: unknown): MerchantQuote | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findOffer(entry);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const offers = obj["offers"];
  if (offers) {
    const offer = findOfferInOffers(offers);
    if (offer) {
      const name =
        typeof obj["name"] === "string" ? (obj["name"] as string) : null;
      return { ...offer, merchant_name: offer.merchant_name ?? name };
    }
  }
  if (typeof type === "string" && type.toLowerCase().includes("offer")) {
    return offerFromObject(obj);
  }
  if (obj["price"] !== undefined && type) {
    return offerFromObject(obj);
  }
  for (const key of ["@graph", "itemListElement", "mainEntity"]) {
    const nested = findOffer(obj[key]);
    if (nested) return nested;
  }
  return null;
}

function findOfferInOffers(offers: unknown): MerchantQuote | null {
  const list = Array.isArray(offers) ? offers : [offers];
  for (const offer of list) {
    if (!offer || typeof offer !== "object") continue;
    const found = offerFromObject(offer as Record<string, unknown>);
    if (found) return found;
  }
  return null;
}

function offerFromObject(obj: Record<string, unknown>): MerchantQuote | null {
  const rawPrice = obj["price"] ?? obj["lowPrice"] ?? obj["amount"];
  const price = cents(rawPrice);
  const currency =
    typeof obj["priceCurrency"] === "string"
      ? obj["priceCurrency"].toLowerCase()
      : typeof obj["currency"] === "string"
        ? obj["currency"].toLowerCase()
        : null;
  if (price === null || !currency) return null;
  return {
    amount_cents: Math.round(price * 100),
    currency,
    merchant_name: null,
  };
}

function extractOpenGraphQuote(html: string): MerchantQuote | null {
  const meta = (names: string[]): string | null => {
    for (const name of names) {
      const match = html.match(
        new RegExp(
          `<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]+content=["']([^"']+)["']`,
          "i"
        )
      ) ?? html.match(
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${name}["']`,
          "i"
        )
      );
      if (match?.[1]) return match[1];
    }
    return null;
  };
  const amount = meta([
    "og:price:amount",
    "product:price:amount",
    "twitter:price:amount",
    "price",
  ]);
  const currency = meta([
    "og:price:currency",
    "product:price:currency",
    "priceCurrency",
  ]);
  const price = cents(amount);
  if (price === null || !currency) return null;
  return {
    amount_cents: Math.round(price * 100),
    currency: currency.toLowerCase(),
    merchant_name: meta(["og:site_name", "og:title"]),
  };
}

/** Fetch a merchant page and derive a quote deterministically. Null when no
 * recognizable price structure exists — callers must not fall back to the
 * agent's proposal in that case. */
export async function quoteMerchantUrl(rawUrl: string): Promise<MerchantQuote | null> {
  const url = safeCheckoutUrl(rawUrl);
  if (!url) return null;
  const html = await fetchMerchantHtml(url);
  if (!html) return null;
  if (url.hostname.endsWith("stripe.com") || url.hostname === "buy.stripe.com") {
    const stripe = extractStripeLinkQuote(html);
    if (stripe) return stripe;
  }
  return extractJsonLdQuote(html) ?? extractOpenGraphQuote(html);
}

/** The verified purchase object, or a thrown PurchaseError explaining why
 * verification failed. NEVER returns the agent's proposed numbers. */
export async function verifyKernelPurchase(
  proposal: Record<string, unknown>
): Promise<KernelPurchaseObject> {
  const merchantUrl =
    typeof proposal["merchant_url"] === "string" ? proposal["merchant_url"] : "";
  const url = safeCheckoutUrl(merchantUrl);
  if (!url) {
    throw new PurchaseError(
      "kernel_purchase_invalid",
      "merchant_url must be a public HTTPS page",
      400
    );
  }
  const proposedAmount =
    typeof proposal["amount_cents"] === "number" ? proposal["amount_cents"] : NaN;
  const proposedCurrency =
    typeof proposal["currency"] === "string"
      ? proposal["currency"].toLowerCase()
      : "";
  const quote = await quoteMerchantUrl(merchantUrl);
  if (!quote) {
    throw new PurchaseError(
      "kernel_quote_unverified",
      "could not verify the checkout amount from the merchant page — have the human confirm the price",
      422
    );
  }
  if (
    !Number.isSafeInteger(proposedAmount) ||
    Math.abs(proposedAmount - quote.amount_cents) > Math.max(1, Math.round(quote.amount_cents * 0.02))
  ) {
    throw new PurchaseError(
      "kernel_quote_mismatch",
      "the proposed amount does not match the merchant's current quote — restart the purchase",
      409
    );
  }
  if (proposedCurrency && proposedCurrency !== quote.currency) {
    throw new PurchaseError(
      "kernel_quote_mismatch",
      "the proposed currency does not match the merchant's quote",
      409
    );
  }
  const provider =
    proposal["provider"] === "agentcard" ? "agentcard" : "link";
  const context =
    typeof proposal["context"] === "string"
      ? proposal["context"].slice(0, 200)
      : null;
  const paymentMethodId =
    typeof proposal["payment_method_id"] === "string" &&
    proposal["payment_method_id"].trim()
      ? proposal["payment_method_id"]
      : null;
  return {
    merchant_name:
      typeof proposal["merchant_name"] === "string" &&
      proposal["merchant_name"].trim()
        ? proposal["merchant_name"].trim().slice(0, 120)
        : quote.merchant_name ?? url.hostname,
    merchant_url: url.toString(),
    amount_cents: quote.amount_cents,
    currency: quote.currency,
    ...(quote.line_items ? { line_items: quote.line_items } : {}),
    ...(context ? { context } : {}),
    provider,
    ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
  };
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

export async function getKernelPurchase(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<KernelPurchase | null> {
  const { data, error } = await supabase
    .from("kernel_purchases")
    .select(PURCHASE_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new KernelError("kernel_store_error", "could not read the purchase", 500);
  }
  return data ? hydratePurchase(data as KernelPurchaseRow) : null;
}

/**
 * Stage the verified purchase + file the purchase_review decision. The
 * decision's payload carries `kernel_purchase_id` so the hosted approval
 * rails can resolve into the Kernel lane.
 */
export async function proposeKernelPurchase(
  supabase: SupabaseClient,
  userId: string,
  input: {
    kernel_session_id?: string | null;
    task_id?: string | null;
    purchase: Record<string, unknown>;
  }
): Promise<{ purchaseId: string; decisionId: string; amountBand: string; approvalUrl: string }> {
  const purchase = await verifyKernelPurchase(input.purchase ?? {});
  const host = new URL(purchase.merchant_url).hostname;
  const band = amountBand(purchase.amount_cents / 100);

  // One open review per (user, host): a second proposal on the same site
  // returns the live one, mirroring the vault lane's rule.
  const { data: openRows, error: openError } = await supabase
    .from("kernel_purchases")
    .select(PURCHASE_COLUMNS)
    .eq("user_id", userId)
    .in("status", ["proposed", "pending_approval", "authorized", "ready"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (openError) {
    throw new KernelError("kernel_store_error", "could not read purchases", 500);
  }
  for (const row of openRows ?? []) {
    const existing = hydratePurchase(row as KernelPurchaseRow);
    const existingPurchase = existing.purchase;
    if (
      existingPurchase &&
      new URL(existingPurchase.merchant_url).hostname === host &&
      existing.decision_id
    ) {
      return {
        purchaseId: existing.id,
        decisionId: existing.decision_id,
        amountBand: band,
        approvalUrl: mintApprovalUrl(userId, existing.decision_id),
      };
    }
  }

  const { data: purchaseRow, error: insertError } = await supabase
    .from("kernel_purchases")
    .insert({
      user_id: userId,
      kernel_session_id: input.kernel_session_id ?? null,
      purchase,
      status: "proposed",
    })
    .select(PURCHASE_COLUMNS)
    .single();
  if (insertError || !purchaseRow) {
    throw new KernelError("kernel_store_error", "could not stage the purchase", 500);
  }
  const staged = hydratePurchase(purchaseRow as KernelPurchaseRow);

  const payload = {
    lane: "kernel",
    kernel_purchase_id: staged.id,
    host,
    summary:
      typeof input.purchase["context"] === "string"
        ? input.purchase["context"].slice(0, 200)
        : `${purchase.merchant_name} checkout`,
    amount_band: band,
    amount_cents: purchase.amount_cents,
    currency: purchase.currency,
    card_name:
      purchase.provider === "agentcard" ? "AgentCard" : "Link virtual card",
    card_masked: null,
    link_supported: false,
  };
  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "purchase_review",
      ref: staged.id,
      label: `Approve ${purchase.merchant_name} purchase (${band})`,
      payload,
    })
    .select("id")
    .single();
  if (decisionError || !decision) {
    await supabase
      .from("kernel_purchases")
      .delete()
      .eq("id", staged.id)
      .eq("user_id", userId);
    throw new KernelError("kernel_store_error", "could not file the review", 500);
  }
  const { error: linkError } = await supabase
    .from("kernel_purchases")
    .update({ decision_id: decision.id as string, status: "pending_approval" })
    .eq("id", staged.id)
    .eq("user_id", userId)
    .eq("status", "proposed");
  if (linkError) {
    throw new KernelError("kernel_store_error", "could not link the review", 500);
  }
  return {
    purchaseId: staged.id,
    decisionId: decision.id as string,
    amountBand: band,
    approvalUrl: mintApprovalUrl(userId, decision.id as string),
  };
}

/**
 * Owner-approved mint: create the per-purchase card item against the frozen
 * object and authorize it. Provider actions (spend_approval, ceremonies)
 * surface to the owner through the action presenter, never to the box.
 * Called from the hosted approval rails — never box-reachable directly.
 */
export async function resolveKernelPurchase(
  supabase: SupabaseClient,
  userId: string,
  purchaseId: string,
  approve: boolean
): Promise<{ state: "authorized" | "action_required" | "cancelled" | "deferred"; actionUrl?: string | null }> {
  const purchase = await getKernelPurchase(supabase, userId, purchaseId);
  if (!purchase) {
    throw new PurchaseError("not_found", "purchase review not found", 404);
  }
  if (!approve) {
    await supabase
      .from("kernel_purchases")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", purchase.id)
      .eq("user_id", userId)
      .in("status", ["proposed", "pending_approval"]);
    return { state: "cancelled" };
  }
  if (!["pending_approval", "proposed"].includes(purchase.status)) {
    return { state: "deferred" };
  }
  if (!env.kernelVaultsEnabled()) {
    throw new PurchaseError(
      "kernel_vaults_disabled",
      "Kernel card payments are not enabled",
      403
    );
  }
  const vault = await ensureKernelVault(supabase, userId);
  const frozen = purchase.purchase;
  const provider = frozen.provider ?? "link";
  const cardKey = `card-${purchase.id.slice(0, 8)}`;

  // Pick a funding method for Link cards: the owner-chosen one when given,
  // else the wallet's default/eligible method via expansion.
  let paymentMethodId = frozen.payment_method_id ?? null;
  let actionUrl: string | null = null;
  if (provider === "link" && !paymentMethodId) {
    const wallet = await getKernelItem(supabase, userId, vault, LINK_WALLET_KEY, [
      "payment_methods",
    ]);
    const methods =
      wallet.type === "wallet"
        ? (wallet.expanded?.payment_methods ?? [])
        : [];
    const eligible = methods.filter(
      (m) => m.capabilities?.single_use_card?.eligible !== false
    );
    const picked = eligible.find((m) => m.is_default) ?? eligible[0];
    if (!picked) {
      throw new PurchaseError(
        "kernel_no_payment_method",
        "no Link payment method is enrolled yet — enroll one first",
        409
      );
    }
    paymentMethodId = picked.id;
  }

  const spec: Vaults.CardVaultItemSpec =
    provider === "agentcard"
      ? {
          provider: "agentcard",
          wallet: AGENTCARD_WALLET_KEY,
          merchant: frozen.merchant_name.slice(0, 120),
          amount: frozen.amount_cents,
          currency: frozen.currency,
        }
      : {
          provider: "link",
          wallet: LINK_WALLET_KEY,
          payment_method_id: paymentMethodId as string,
          amount: frozen.amount_cents,
          currency: frozen.currency,
          merchant_name: frozen.merchant_name,
          merchant_url: frozen.merchant_url,
          context: frozen.context ?? "airv2 purchase",
          line_items: (frozen.line_items ?? []).map((item) => ({
            name: item.name,
            quantity: item.quantity ?? 1,
            ...(item.unit_amount !== undefined
              ? { unit_amount: item.unit_amount }
              : {}),
          })),
        };

  let item: Vaults.VaultItem;
  try {
    item = await kernelClient(vault.project_id).vaults.items.upsert(cardKey, {
      id_or_name: vault.vault_id,
      spec,
      type: "card",
    });
  } catch {
    throw new PurchaseError(
      "kernel_card_failed",
      "could not mint the purchase card — try again",
      502
    );
  }
  await supabase
    .from("kernel_purchases")
    .update({
      card_item_id: item.id,
      item_key: cardKey,
      status: "authorized",
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchase.id)
    .eq("user_id", userId);

  // Provider action? (Link card enrollment, spend approval, push approval.)
  // Stage it for the owner — the box must never see this URL.
  if (item.action) {
    const staged = await stageKernelAction(
      supabase,
      userId,
      item.action,
      cardKey
    );
    actionUrl = staged.url;
    return { state: "action_required", actionUrl };
  }

  const cardItem = await authorizeKernelItem(supabase, userId, vault, cardKey);
  const state =
    cardItem.type === "card" ? (cardItem.state as { status?: string }).status : null;
  const nextStatus: KernelPurchaseStatus =
    state === "ready" ? "ready" : state === "consumed" ? "consumed" : "authorized";
  await supabase
    .from("kernel_purchases")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", purchase.id)
    .eq("user_id", userId);
  return { state: nextStatus === "ready" ? "authorized" : "deferred" };
}

/**
 * Box-facing poll: what the agent may learn after an approval exists. Card
 * aliases are the only sensitive payload, gated to `ready` + un-submitted —
 * once `submit` lands the aliases are never served again (C30).
 */
export async function pollKernelPurchase(
  supabase: SupabaseClient,
  userId: string,
  purchaseId: string
): Promise<{
  status: KernelPurchaseStatus;
  decision_status: string | null;
  aliases?: Vaults.VaultCardAliases;
  action_required?: boolean;
}> {
  const purchase = await getKernelPurchase(supabase, userId, purchaseId);
  if (!purchase) {
    throw new PurchaseError("not_found", "purchase not found", 404);
  }
  let decisionStatus: string | null = null;
  if (purchase.decision_id) {
    const { data: decision } = await supabase
      .from("decisions")
      .select("status")
      .eq("id", purchase.decision_id)
      .eq("user_id", userId)
      .maybeSingle();
    decisionStatus = (decision?.status as string | null) ?? null;
  }
  const result: {
    status: KernelPurchaseStatus;
    decision_status: string | null;
    aliases?: Vaults.VaultCardAliases;
    action_required?: boolean;
  } = { status: purchase.status, decision_status: decisionStatus };

  if (purchase.status === "authorized" && purchase.item_key) {
    const vault = await ensureKernelVault(supabase, userId);
    try {
      const item = await getKernelItem(supabase, userId, vault, purchase.item_key);
      const state = item.type === "card" ? item.state : null;
      const status = (state as { status?: string } | null)?.status;
      if (item.action) {
        result.action_required = true;
      } else if (status === "ready") {
        const aliases = (state as { aliases?: Vaults.VaultCardAliases } | null)?.aliases;
        if (aliases && !purchase.submitted_at) {
          result.status = "ready";
          result.aliases = aliases;
        }
      } else if (status === "consumed") {
        result.status = "consumed";
      } else if (status === "declined" || status === "expired") {
        result.status = status;
      }
    } catch {
      // A transient Kernel read must not strand the purchase as failed —
      // keep the stored status and let the box poll again.
    }
  }
  return result;
}

/** Submit-once (C30): the box reports the submit happened exactly once. */
export async function reportKernelSubmit(
  supabase: SupabaseClient,
  userId: string,
  purchaseId: string
): Promise<KernelPurchase> {
  const purchase = await getKernelPurchase(supabase, userId, purchaseId);
  if (!purchase) throw new PurchaseError("not_found", "purchase not found", 404);
  if (purchase.submitted_at) {
    throw new PurchaseError(
      "already_submitted",
      "this purchase was already submitted — never re-submit",
      409
    );
  }
  if (!["ready", "authorized"].includes(purchase.status)) {
    throw new PurchaseError(
      "kernel_not_ready",
      "no authorized card is ready to fill",
      409
    );
  }
  const { data, error } = await supabase
    .from("kernel_purchases")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchase.id)
    .eq("user_id", userId)
    .is("submitted_at", null)
    .select(PURCHASE_COLUMNS)
    .maybeSingle();
  if (error || !data) {
    throw new PurchaseError(
      "already_submitted",
      "this purchase was already submitted",
      409
    );
  }
  return hydratePurchase(data as KernelPurchaseRow);
}

/**
 * Outcome reconciliation: vault item events are the evidence. Ambiguity is
 * always `unknown_outcome` — the product shows uncertainty rather than
 * guessing or retrying.
 */
export async function reconcileKernelPurchase(
  supabase: SupabaseClient,
  userId: string,
  purchaseId: string
): Promise<{ status: KernelPurchaseStatus; events: number }> {
  const purchase = await getKernelPurchase(supabase, userId, purchaseId);
  if (!purchase) throw new PurchaseError("not_found", "purchase not found", 404);
  const vault = await ensureKernelVault(supabase, userId);
  if (!purchase.item_key) {
    return { status: purchase.status, events: 0 };
  }
  const events = await kernelItemEvents(vault, purchase.item_key);
  const names = events.map((e) => e.name ?? "");
  const state = names.join(" ");
  let status: KernelPurchaseStatus = purchase.status;
  if (/consumed|charged|captured|completed|approved/i.test(state)) {
    status = "consumed";
  } else if (/declined|denied|rejected|failed/i.test(state)) {
    status = "declined";
  } else if (/expired/i.test(state)) {
    status = "expired";
  } else if (purchase.submitted_at) {
    // Submitted but nothing conclusive — unknown, never retry.
    status = "unknown_outcome";
  }
  await supabase
    .from("kernel_purchases")
    .update({
      status,
      outcome: { events: names.slice(0, 20) },
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchase.id)
    .eq("user_id", userId);
  return { status, events: events.length };
}

/** Pull any pending provider action into an owner-deliverable presenter link
 * (used by the watch app and shop surface). */
export async function stagePendingKernelAction(
  supabase: SupabaseClient,
  userId: string,
  vaultId: string,
  itemKey: string
): Promise<{ url: string | null }> {
  const { data } = await supabase
    .from("kernel_vaults")
    .select("user_id, project_id, vault_id, vault_name, created_at, updated_at")
    .eq("user_id", userId)
    .eq("vault_id", vaultId)
    .maybeSingle();
  if (!data) return { url: null };
  const item = await getKernelItem(
    supabase,
    userId,
    data as Awaited<ReturnType<typeof ensureKernelVault>>,
    itemKey
  );
  if (!item.action) return { url: null };
  const staged = await stageKernelAction(supabase, userId, item.action, itemKey);
  return { url: staged.url };
}

/** Sync the wallet masks on a shop page load (best-effort, never throws). */
export async function syncVaultQuietly(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    const { data } = await supabase
      .from("kernel_vaults")
      .select("user_id, project_id, vault_id, vault_name, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return;
    await syncKernelVaultItems(
      supabase,
      userId,
      data as Awaited<ReturnType<typeof ensureKernelVault>>
    );
  } catch {
    /* vault sync is best-effort on render */
  }
}
