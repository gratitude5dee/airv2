/**
 * Trade orchestration (docs/trade/plan.md §5, §7.2). The service layer is
 * where the invariants are enforced — routes and the mini-app never touch a
 * venue directly:
 *   T1  stage, never execute — box-authenticated calls end at a decision row.
 *   T2  exact preview — signed token, user-bound, 5-minute expiry.
 *   T3  one active approval per user.
 *   T4  spot + online re-checked before preview and again before submit.
 *   T5  deterministic client_order_id = sha256(preview token) → idempotent.
 *   T6  per-order + daily notional caps and a velocity cap, server-side.
 *   C23 an ambiguous submit is terminal `uncertain`, never retried.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mintCdpJwt } from "./cdpJwt";
import {
  coinbaseVenue,
  getTradeConnection,
  tradeVenueCredentials,
  type CoinbaseCredentials,
  type TradeConnectionRow,
} from "./coinbase";
import {
  TradeError,
  clientOrderIdForPreview,
  createPreviewToken,
  orderSummary,
  tradeOrderSchema,
  verifyPreviewToken,
  type TradeOrder,
} from "./order";
import { paperVenue } from "./paper";
import {
  assertTradableSpotProduct,
  TradeVenueError,
  type TradeBalance,
  type TradeOrderRecord,
  type TradePreview,
  type TradeVenue,
} from "./venue";
import { sealSecret } from "../crypto/secretbox";
import { env } from "../env";

export { getTradeConnection, TradeError };

export const TRADE_MAX_ORDERS_PER_HOUR = 20;
export const TRADE_LIST_LIMIT = 50;
const DEFAULT_PER_ORDER_CAP = 250;
const DEFAULT_DAILY_CAP = 1000;

export type TradeMode = "paper" | "live";

export interface TradeOrderRow {
  id: string;
  user_id: string;
  mode: TradeMode;
  product_id: string;
  side: "BUY" | "SELL";
  order_type: "market" | "limit" | "stop_limit";
  base_size: string | null;
  quote_size: string | null;
  limit_price: string | null;
  stop_price: string | null;
  stop_direction: string | null;
  client_order_id: string;
  state:
    | "previewed"
    | "pending_approval"
    | "approved"
    | "submitting"
    | "submitted"
    | "partially_filled"
    | "filled"
    | "cancelled"
    | "rejected"
    | "denied"
    | "expired"
    | "uncertain";
  decision_id: string | null;
  venue_order_id: string | null;
  preview: Record<string, unknown> | null;
  preview_expires_at: string | null;
  notional_usd: number | null;
  requested_by: string;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

const ORDER_ROW_COLUMNS =
  "id, user_id, mode, product_id, side, order_type, base_size, quote_size, limit_price, stop_price, stop_direction, client_order_id, state, decision_id, venue_order_id, preview, preview_expires_at, notional_usd, requested_by, error_code, created_at, updated_at";

export function orderFromRow(row: TradeOrderRow): TradeOrder {
  return tradeOrderSchema.parse({
    productId: row.product_id,
    side: row.side,
    type: row.order_type,
    ...(row.base_size ? { baseSize: row.base_size } : {}),
    ...(row.quote_size ? { quoteSize: row.quote_size } : {}),
    ...(row.limit_price ? { limitPrice: row.limit_price } : {}),
    ...(row.stop_price ? { stopPrice: row.stop_price } : {}),
    ...(row.stop_direction ? { stopDirection: row.stop_direction } : {}),
  });
}

/* ------------------------------------------------------------- venue */

export async function tradeMode(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ mode: TradeMode; connection: TradeConnectionRow | null }> {
  const connection = await getTradeConnection(supabase, userId);
  const live =
    connection?.mode === "live" &&
    connection.status === "connected" &&
    !!connection.secret_sealed;
  return { mode: live ? "live" : "paper", connection };
}

export async function venueFor(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ venue: TradeVenue; mode: TradeMode; connection: TradeConnectionRow | null }> {
  const { mode, connection } = await tradeMode(supabase, userId);
  if (mode === "live" && connection) {
    const creds = await tradeVenueCredentials(connection);
    if (!creds) {
      throw new TradeError(
        "Your Coinbase key can't be opened — reconnect it in Trade → Settings.",
        400,
        "key_unreadable",
      );
    }
    return { venue: coinbaseVenue(creds), mode, connection };
  }
  return { venue: paperVenue(supabase, userId), mode, connection };
}

/* ------------------------------------------------------------ preview */

export interface TradePreviewResult {
  tradeOrderId: string;
  order: TradeOrder;
  preview: TradePreview;
  previewToken: string;
  expiresAt: string;
  mode: TradeMode;
  summary: string;
}

export async function previewTrade(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
  requestedBy: string,
): Promise<TradePreviewResult> {
  const parsed = tradeOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw new TradeError(
      parsed.error.issues[0]?.message ?? "That order isn't valid.",
      400,
      "bad_order",
    );
  }
  const order = parsed.data;
  const { venue, mode } = await venueFor(supabase, userId);
  const product = await venue.getProduct(order.productId);
  assertTradableSpotProduct(product);
  const preview = await venue.previewOrder(order);
  const { token, expiresAt } = createPreviewToken(order, userId);
  const clientOrderId = clientOrderIdForPreview(token);

  const { data: row, error } = await supabase
    .from("trade_orders")
    .insert({
      user_id: userId,
      mode,
      product_id: order.productId,
      side: order.side,
      order_type: order.type,
      base_size: order.baseSize ?? null,
      quote_size: order.quoteSize ?? null,
      limit_price: order.limitPrice ?? null,
      stop_price: order.stopPrice ?? null,
      stop_direction: order.stopDirection ?? null,
      client_order_id: clientOrderId,
      state: "previewed",
      preview: { token, ...preview.raw, estimated: preview },
      preview_expires_at: expiresAt,
      notional_usd: previewNotionalUsd(order, preview),
      requested_by: requestedBy,
    })
    .select("id")
    .single();
  if (error || !row) {
    throw new TradeError(
      `Couldn't store the preview — try again. (${error?.message ?? "insert"})`,
      500,
      "store_failed",
    );
  }
  return {
    tradeOrderId: row.id as string,
    order,
    preview,
    previewToken: token,
    expiresAt,
    mode,
    summary: orderSummary(order),
  };
}

/** Notional in quote terms for caps — USD-quoted markets dominate v1. */
function previewNotionalUsd(order: TradeOrder, preview: TradePreview): number | null {
  const total = preview.total ? Number(preview.total) : NaN;
  if (Number.isFinite(total) && total > 0) return total;
  if (order.quoteSize) return Number(order.quoteSize);
  return null;
}

/* ------------------------------------------------------------ propose */

export interface TradeProposeResult {
  tradeOrderId: string;
  decisionId: string;
  summary: string;
  expiresAt: string;
}

export async function proposeTrade(
  supabase: SupabaseClient,
  userId: string,
  input: { order?: unknown; previewToken?: unknown; note?: unknown },
): Promise<TradeProposeResult> {
  const order = tradeOrderSchema.safeParse(input.order).success
    ? tradeOrderSchema.parse(input.order)
    : null;
  if (!order) {
    throw new TradeError("That order isn't valid.", 400, "bad_order");
  }
  const previewToken =
    typeof input.previewToken === "string" ? input.previewToken : "";
  if (!previewToken) {
    throw new TradeError("Missing the preview token.", 400, "bad_token");
  }
  verifyPreviewToken(previewToken, order, userId); // T2
  const clientOrderId = clientOrderIdForPreview(previewToken);

  const { data: row } = await supabase
    .from("trade_orders")
    .select(ORDER_ROW_COLUMNS)
    .eq("user_id", userId)
    .eq("client_order_id", clientOrderId)
    .maybeSingle();
  if (!row || row.state !== "previewed") {
    throw new TradeError(
      "That preview is already used up — ask for a fresh one.",
      409,
      "preview_consumed",
    );
  }

  // T3: one active approval per user — a second proposal is refused while
  // one is pending (the pending order is named so the reply can say what).
  const { data: pending } = await supabase
    .from("trade_orders")
    .select("id, product_id, side")
    .eq("user_id", userId)
    .eq("state", "pending_approval")
    .limit(1);
  if (pending && pending.length > 0) {
    const other = pending[0]!;
    throw new TradeError(
      `There's already an order waiting on you (${other.side} ${other.product_id}). Approve or deny it first.`,
      409,
      "approval_pending",
    );
  }

  const connection = await getTradeConnection(supabase, userId);
  await assertCaps(supabase, userId, row as TradeOrderRow, connection); // T6

  const expiresAt = row.preview_expires_at as string;
  const order2 = orderFromRow(row as TradeOrderRow);
  const summary = orderSummary(order2);
  const preview = (row.preview ?? {}) as Record<string, unknown>;
  const estimate = (preview["estimated"] ?? {}) as Record<string, unknown>;

  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "trade_order",
      ref: row.id as string,
      label: summary,
      payload: {
        order: order2,
        summary,
        estimated_price: estimate["estimatedPrice"] ?? null,
        estimated_fill: estimate["estimatedFill"] ?? null,
        fee: estimate["fee"] ?? null,
        total: estimate["total"] ?? null,
        currency: estimate["currency"] ?? null,
        mode: row.mode,
        expires_at: expiresAt,
        note: typeof input.note === "string" ? input.note.slice(0, 500) : null,
      },
    })
    .select("id")
    .single();
  if (decisionError || !decision) {
    throw new TradeError(
      `Couldn't file the approval — try again. (${decisionError?.message ?? "insert"})`,
      500,
      "decision_failed",
    );
  }

  const { data: claimed } = await supabase
    .from("trade_orders")
    .update({ state: "pending_approval", decision_id: decision.id as string })
    .eq("id", row.id as string)
    .eq("user_id", userId)
    .eq("state", "previewed")
    .select("id");
  if (!claimed || claimed.length === 0) {
    await supabase.from("decisions").delete().eq("id", decision.id as string);
    throw new TradeError(
      "That preview is already used up — ask for a fresh one.",
      409,
      "preview_consumed",
    );
  }
  return {
    tradeOrderId: row.id as string,
    decisionId: decision.id as string,
    summary,
    expiresAt,
  };
}

/** T6 — caps apply to live orders only; paper is fake money. */
async function assertCaps(
  supabase: SupabaseClient,
  userId: string,
  row: TradeOrderRow,
  connection: TradeConnectionRow | null,
): Promise<void> {
  if (row.mode !== "live") return;
  const perOrder = Number(connection?.per_order_usd_cap ?? DEFAULT_PER_ORDER_CAP);
  const daily = Number(connection?.daily_usd_cap ?? DEFAULT_DAILY_CAP);
  const notional = row.notional_usd ?? 0;
  if (notional > perOrder) {
    throw new TradeError(
      `Over your per-order cap ($${perOrder}). Raise it in Trade → Settings.`,
      400,
      "over_order_cap",
    );
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: todays } = await supabase
    .from("trade_orders")
    .select("notional_usd")
    .eq("user_id", userId)
    .eq("mode", "live")
    .gte("created_at", dayAgo)
    .in("state", ["pending_approval", "submitted", "partially_filled", "filled"]);
  const spent = (todays ?? []).reduce(
    (sum, entry) => sum + (Number(entry.notional_usd) || 0),
    0,
  );
  if (spent + notional > daily) {
    throw new TradeError(
      `Over your daily cap ($${daily}). Raise it in Trade → Settings.`,
      400,
      "over_daily_cap",
    );
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("trade_orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= TRADE_MAX_ORDERS_PER_HOUR) {
    throw new TradeError(
      "Too many orders in the last hour — take a breath and try again.",
      429,
      "velocity_cap",
    );
  }
}

/* ------------------------------------------------------------ resolve */

/**
 * The decision-resolver arm for trade_order (T1): this is the ONLY place a
 * venue mutation runs. Called from /api/decisions and /api/approvals/[id]
 * after the caller has verified owner auth + pending status.
 */
export async function resolveTradeOrder(
  supabase: SupabaseClient,
  userId: string,
  decisionRef: string,
  action: "approve" | "dismiss",
): Promise<{ state: string; detail: string }> {
  const { data: row } = await supabase
    .from("trade_orders")
    .select(ORDER_ROW_COLUMNS)
    .eq("id", decisionRef)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) {
    throw new TradeError("That order no longer exists.", 404, "not_found");
  }
  const order = row as TradeOrderRow;
  if (action === "dismiss") {
    // CAS so a concurrent approve wins: a losing dismiss reports what the
    // order actually did rather than claiming a denial that never happened.
    const { data: denied } = await supabase
      .from("trade_orders")
      .update({ state: "denied" })
      .eq("id", order.id)
      .eq("state", "pending_approval")
      .select("id");
    if (!denied || denied.length === 0) {
      const { data: current } = await supabase
        .from("trade_orders")
        .select("state")
        .eq("id", order.id)
        .maybeSingle();
      const actual = (current?.state as string | undefined) ?? order.state;
      if (actual === "pending_approval") {
        return { state: "pending", detail: "Still waiting on you." };
      }
      return {
        state: actual,
        detail: `This approval was already answered — the order is ${actual}.`,
      };
    }
    return { state: "denied", detail: orderSummary(orderFromRow(order)) };
  }
  if (order.state !== "pending_approval") {
    throw new TradeError(
      order.state === "uncertain"
        ? "This order's status is uncertain — check Orders before trying again (it's never resubmitted)."
        : `This order already left the approval stage (${order.state}).`,
      409,
      "not_pending",
    );
  }

  // Deterministic preflight BEFORE the claim: a thrown check must leave the
  // order at pending_approval (the approval survives), not strand it at
  // submitting where nothing can recover it.
  if (order.mode === "live") {
    if (!env.tradeLiveEnabled()) {
      throw new TradeError(
        "Live trading isn't enabled on this deployment — switch to paper in Settings.",
        403,
        "live_disabled",
      );
    }
    const allowlist = env.tradeAllowlist();
    if (allowlist.length > 0 && !allowlist.includes(userId)) {
      throw new TradeError(
        "Live trading isn't open for your account yet.",
        403,
        "not_allowlisted",
      );
    }
  }

  const { venue } = await venueFor(supabase, userId);
  const orderSpec = orderFromRow(order);
  const preview = (order.preview ?? {}) as Record<string, unknown>;
  const token = typeof preview["token"] === "string" ? preview["token"] : "";
  // T2 at execution time: the signed preview must still match exactly — and
  // an order with no token can never reach the venue at all.
  if (!token) {
    throw new TradeError(
      "That order is missing its signed preview — ask for a fresh one.",
      400,
      "bad_token",
    );
  }
  verifyPreviewToken(token, orderSpec, userId);
  assertTradableSpotProduct(await venue.getProduct(orderSpec.productId)); // T4
  const connection = await getTradeConnection(supabase, userId);
  await assertCaps(supabase, userId, order, connection); // T6, again

  // Claim: pending_approval→submitting. The conditional update is the
  // single-flip gate (double-taps can't both pass), run immediately before
  // the one potentially-mutating call.
  const { data: claimed } = await supabase
    .from("trade_orders")
    .update({ state: "submitting" })
    .eq("id", order.id)
    .eq("user_id", userId)
    .eq("state", "pending_approval")
    .select("id");
  if (!claimed || claimed.length === 0) {
    throw new TradeError("This order is already being submitted.", 409, "not_pending");
  }

  try {
    const result = await venue.createOrder(orderSpec, order.client_order_id);
    const live = order.mode === "live";
    const next = live ? "submitted" : "filled";
    const { data: recorded, error: recordError } = await supabase
      .from("trade_orders")
      .update({
        state: next,
        venue_order_id: result.orderId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("user_id", userId)
      .select("id");
    if (recordError || !recorded || recorded.length === 0) {
      // The venue confirmed an order id but the ledger didn't record it. The
      // order exists at Coinbase under our client_order_id — mark it
      // uncertain (never a silent success) and persist the venue id so a
      // repair path can find it.
      await supabase
        .from("trade_orders")
        .update({
          state: "uncertain",
          error_code: "record_failed",
          venue_order_id: result.orderId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("user_id", userId);
      return {
        state: "uncertain",
        detail: `Placed at Coinbase${result.orderId ? ` as ${result.orderId}` : ""} but the ledger couldn't record it — check Orders before touching it again.`,
      };
    }
    return { state: next, detail: orderSummary(orderSpec) };
  } catch (error) {
    // C23: a venue rejection ("insufficient funds", "product offline") is a
    // clean no-fill — rejected is terminal. A transport/5xx failure after the
    // request may have sent is `uncertain` — never resubmitted.
    const venueError = error instanceof TradeVenueError;
    const terminal = venueError && error.status < 500 ? "rejected" : "uncertain";
    await supabase
      .from("trade_orders")
      .update({
        state: terminal,
        error_code: venueError ? error.code : "submit_unknown",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("user_id", userId);
    if (terminal === "rejected") {
      return {
        state: "rejected",
        detail: error instanceof Error ? error.message : "The venue rejected it.",
      };
    }
    throw new TradeError(
      "Coinbase didn't confirm the order — it's marked uncertain and will NOT be retried. Check Orders.",
      502,
      "uncertain",
    );
  }
}

/* ------------------------------------------------------------- cancel */

/** File the trade_cancel approval for one venue order id. */
export async function proposeTradeCancel(
  supabase: SupabaseClient,
  userId: string,
  orderRef: string,
): Promise<{ decisionId: string; label: string }> {
  const { venue } = await venueFor(supabase, userId);
  let orderId = orderRef.trim();
  let label = `Cancel order ${orderId.slice(0, 8)}…`;
  if (orderId === "last" || !orderId) {
    const open = await venue.listOrders("open", 1);
    if (open.length === 0) {
      throw new TradeError("No open orders to cancel.", 400, "nothing_open");
    }
    orderId = open[0]!.orderId;
    label = `Cancel ${open[0]!.side} ${open[0]!.productId} ${open[0]!.sizeLabel}`;
  } else {
    const venueOrder = await venue.getOrder(orderId).catch(() => null);
    if (venueOrder) {
      label = `Cancel ${venueOrder.side} ${venueOrder.productId} ${venueOrder.sizeLabel}`;
      orderId = venueOrder.orderId;
    }
  }

  const { data: decision, error } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "trade_cancel",
      ref: orderId,
      label,
      payload: { order_id: orderId },
    })
    .select("id")
    .single();
  if (error || !decision) {
    throw new TradeError(
      `Couldn't file the cancel approval. (${error?.message ?? "insert"})`,
      500,
      "decision_failed",
    );
  }
  return { decisionId: decision.id as string, label };
}

/** The resolver arm for trade_cancel — approve → venue cancel. */
export async function resolveTradeCancel(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  action: "approve" | "dismiss",
): Promise<{ state: string; detail: string }> {
  if (action === "dismiss") return { state: "kept", detail: orderId };
  const { venue } = await venueFor(supabase, userId);
  const result = await venue.cancelOrders([orderId]);
  if (!result.cancelled.includes(orderId)) {
    throw new TradeError(
      "Coinbase didn't confirm the cancel — check Orders.",
      502,
      "cancel_unconfirmed",
    );
  }
  await supabase
    .from("trade_orders")
    .update({ state: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("venue_order_id", orderId);
  return { state: "cancelled", detail: orderId };
}

/* ------------------------------------------------------- reconciliation */

const LIVE_OPEN_STATES = ["submitted", "partially_filled", "submitting"] as const;
const SUBMITTING_STALE_MS = 10 * 60 * 1000;

function venueStateToOurs(status: string): TradeOrderRow["state"] {
  switch (status) {
    case "FILLED":
      return "filled";
    case "CANCELLED":
      return "cancelled";
    case "EXPIRED":
    case "FAILED":
      return "rejected";
    default:
      return "submitted";
  }
}

/** `submitted` → real state, read from Coinbase by order id. */
export async function reconcileTradeOrders(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data: rows } = await supabase
    .from("trade_orders")
    .select(ORDER_ROW_COLUMNS)
    .eq("user_id", userId)
    .in("state", [...LIVE_OPEN_STATES]);
  const open = (rows ?? []) as TradeOrderRow[];
  if (open.length === 0) return 0;
  const { venue } = await venueFor(supabase, userId);
  let synced = 0;
  for (const order of open) {
    if (!order.venue_order_id) {
      // Stuck at `submitting` with no venue id: the submit's outcome is
      // unknown — after a grace period it's terminal uncertain (C23), never
      // resubmitted.
      if (Date.now() - Date.parse(order.updated_at) > SUBMITTING_STALE_MS) {
        await supabase
          .from("trade_orders")
          .update({
            state: "uncertain",
            error_code: "submit_outcome_unknown",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);
        synced += 1;
      }
      continue;
    }
    try {
      const venueOrder = await venue.getOrder(order.venue_order_id);
      const next = venueStateToOurs(venueOrder.status.toUpperCase());
      if (next !== order.state) {
        await supabase
          .from("trade_orders")
          .update({ state: next, updated_at: new Date().toISOString() })
          .eq("id", order.id);
        synced += 1;
      }
    } catch {
      // A reconciliation miss never changes state — next sweep retries.
    }
  }
  return synced;
}

/* -------------------------------------------------------- expiry sweep */

export async function expireTradeApprovals(supabase: SupabaseClient): Promise<number> {
  const now = new Date().toISOString();
  const { data: stale } = await supabase
    .from("trade_orders")
    .select("id, decision_id")
    .in("state", ["previewed", "pending_approval"])
    .lt("preview_expires_at", now);
  let expired = 0;
  for (const row of stale ?? []) {
    const { data: updated } = await supabase
      .from("trade_orders")
      .update({ state: "expired", updated_at: now })
      .eq("id", row.id)
      .in("state", ["previewed", "pending_approval"])
      .select("id");
    if (!updated || updated.length === 0) continue;
    expired += 1;
    if (row.decision_id) {
      await supabase
        .from("decisions")
        .update({ status: "dismissed", resolved_at: now })
        .eq("id", row.decision_id)
        .eq("status", "pending");
    }
  }
  return expired;
}

/* ------------------------------------------------------ connection mgmt */

export interface ConnectResult {
  portfolioName: string | null;
  mode: TradeMode;
}

export async function connectCoinbase(
  supabase: SupabaseClient,
  userId: string,
  input: { keyId?: unknown; keySecret?: unknown; portfolioUuid?: unknown },
): Promise<ConnectResult> {
  const vaultKey = env.providerVaultKey();
  if (!vaultKey) {
    throw new TradeError(
      "Personal keys aren't enabled on this deployment.",
      503,
      "vault_disabled",
    );
  }
  const keyId = typeof input.keyId === "string" ? input.keyId.trim() : "";
  const keySecret = typeof input.keySecret === "string" ? input.keySecret.trim() : "";
  const portfolioUuid =
    typeof input.portfolioUuid === "string" && input.portfolioUuid.trim()
      ? input.portfolioUuid.trim()
      : null;
  if (keyId.length < 4 || keyId.length > 512 || /\s/.test(keyId)) {
    throw new TradeError("That doesn't look like a Coinbase key ID.", 400, "bad_key");
  }
  if (keySecret.length < 16 || keySecret.length > 8192) {
    throw new TradeError("That doesn't look like a Coinbase key secret.", 400, "bad_key");
  }
  const allowlist = env.tradeAllowlist();
  const liveAllowed =
    env.tradeLiveEnabled() && (allowlist.length === 0 || allowlist.includes(userId));

  // Verify against the live API before persisting — a key that can't read
  // accounts is saved as status='error' so the UI says so plainly.
  const creds: CoinbaseCredentials = { keyId, keySecret, portfolioUuid };
  let portfolioName: string | null = null;
  let status: TradeConnectionRow["status"] = "connected";
  let verifyError: string | null = null;
  try {
    await coinbaseVenue(creds).balances();
    if (portfolioUuid) {
      const portfolios = await listCoinbasePortfolios(creds);
      portfolioName =
        portfolios.find((p) => p.uuid === portfolioUuid)?.name ?? null;
      if (!portfolioName) {
        throw new TradeVenueError("That portfolio isn't on this key.", 400, "bad_portfolio");
      }
    }
  } catch (error) {
    status = "error";
    verifyError = error instanceof Error ? error.message.slice(0, 300) : "verify failed";
  }

  const { error } = await supabase.from("trade_connections").upsert(
    {
      user_id: userId,
      provider: "coinbase",
      key_id: keyId,
      key_id_hint: keyId.slice(-4),
      secret_sealed: sealSecret(keySecret, vaultKey),
      portfolio_uuid: portfolioUuid,
      portfolio_name: portfolioName,
      mode: status === "connected" && liveAllowed ? "live" : "paper",
      status,
      last_verified_at: status === "connected" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) {
    throw new TradeError(`Couldn't save the connection. (${error.message})`, 500, "store_failed");
  }
  if (status === "connected" && !liveAllowed) {
    return { portfolioName, mode: "paper" };
  }
  if (status !== "connected") {
    throw new TradeError(
      `Saved the key but Coinbase didn't accept it: ${verifyError ?? "verify failed"}`,
      400,
      "verify_failed",
    );
  }
  return { portfolioName, mode: "live" };
}

async function listCoinbasePortfolios(
  creds: CoinbaseCredentials,
): Promise<{ uuid: string; name: string }[]> {
  const data = await fetch(
    "https://api.coinbase.com/api/v3/brokerage/portfolios",
    {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${mintCdpJwt({
          keyId: creds.keyId,
          keySecret: creds.keySecret,
          method: "GET",
          host: "api.coinbase.com",
          path: "/api/v3/brokerage/portfolios",
        })}`,
      },
    },
  ).then((r) => r.json().catch(() => ({})));
  const rows = Array.isArray((data as Record<string, unknown>)["portfolios"])
    ? ((data as Record<string, unknown>)["portfolios"] as unknown[])
    : [];
  return rows
    .map((row) => {
      const p = row as Record<string, unknown>;
      return {
        uuid: typeof p["uuid"] === "string" ? p["uuid"] : "",
        name: typeof p["name"] === "string" ? p["name"] : "",
      };
    })
    .filter((p) => p.uuid);
}

export async function disconnectCoinbase(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase
    .from("trade_connections")
    .update({
      key_id: null,
      key_id_hint: null,
      secret_sealed: null,
      mode: "paper",
      status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "coinbase");
}

export async function setTradeMode(
  supabase: SupabaseClient,
  userId: string,
  mode: TradeMode,
): Promise<TradeConnectionRow | null> {
  const connection = await getTradeConnection(supabase, userId);
  if (mode === "live") {
    if (!env.tradeLiveEnabled()) {
      throw new TradeError(
        "Live trading isn't enabled on this deployment — stay in paper.",
        403,
        "live_disabled",
      );
    }
    const allowlist = env.tradeAllowlist();
    if (allowlist.length > 0 && !allowlist.includes(userId)) {
      throw new TradeError(
        "Live trading isn't open for your account yet.",
        403,
        "not_allowlisted",
      );
    }
    if (!connection || connection.status !== "connected") {
      throw new TradeError(
        "Connect a Coinbase key first — Trade → Settings.",
        400,
        "not_connected",
      );
    }
  }
  if (!connection) return null;
  await supabase
    .from("trade_connections")
    .update({ mode, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", "coinbase");
  return { ...connection, mode };
}

/** Cap changes: lower applies now; raise files a trade_settings approval. */
export async function updateTradeCaps(
  supabase: SupabaseClient,
  userId: string,
  input: { perOrderUsdCap?: unknown; dailyUsdCap?: unknown },
): Promise<{ applied: boolean; decisionId: string | null }> {
  const connection = await getTradeConnection(supabase, userId);
  const currentOrder = Number(connection?.per_order_usd_cap ?? DEFAULT_PER_ORDER_CAP);
  const currentDaily = Number(connection?.daily_usd_cap ?? DEFAULT_DAILY_CAP);
  const nextOrder =
    typeof input.perOrderUsdCap === "number" && Number.isFinite(input.perOrderUsdCap)
      ? Math.min(Math.max(1, input.perOrderUsdCap), 100_000)
      : currentOrder;
  const nextDaily =
    typeof input.dailyUsdCap === "number" && Number.isFinite(input.dailyUsdCap)
      ? Math.min(Math.max(nextOrder, input.dailyUsdCap), 1_000_000)
      : currentDaily;
  if (nextOrder <= currentOrder && nextDaily <= currentDaily) {
    await supabase.from("trade_connections").upsert(
      {
        user_id: userId,
        provider: "coinbase",
        per_order_usd_cap: nextOrder,
        daily_usd_cap: nextDaily,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
    return { applied: true, decisionId: null };
  }
  const { data: decision, error } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "trade_settings",
      ref: "caps",
      label: `Raise caps to $${nextOrder}/order · $${nextDaily}/day`,
      payload: { per_order_usd_cap: nextOrder, daily_usd_cap: nextDaily },
    })
    .select("id")
    .single();
  if (error || !decision) {
    throw new TradeError(
      `Couldn't file the settings approval. (${error?.message ?? "insert"})`,
      500,
      "decision_failed",
    );
  }
  return { applied: false, decisionId: decision.id as string };
}

/** Resolver arm for trade_settings — approve applies the stored caps. */
export async function resolveTradeSettings(
  supabase: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>,
  action: "approve" | "dismiss",
): Promise<void> {
  if (action !== "approve") return;
  const perOrder = Number(payload["per_order_usd_cap"]);
  const daily = Number(payload["daily_usd_cap"]);
  // The approval's payload is data, not authority — re-validate the same
  // bounds updateTradeCaps enforces so a malformed decision can't install
  // negative or absurd caps.
  if (
    !Number.isFinite(perOrder) ||
    !Number.isFinite(daily) ||
    perOrder < 1 ||
    daily < 1 ||
    perOrder > 100_000 ||
    daily > 1_000_000 ||
    perOrder > daily
  ) {
    throw new TradeError(
      "Those cap values don't look right — set them again in Settings.",
      400,
      "bad_caps",
    );
  }
  await supabase.from("trade_connections").upsert(
    {
      user_id: userId,
      provider: "coinbase",
      per_order_usd_cap: perOrder,
      daily_usd_cap: daily,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
}

/* ----------------------------------------------------------- portfolio */

export interface PortfolioView {
  mode: TradeMode;
  connected: boolean;
  portfolioName: string | null;
  totalUsd: number | null;
  cashUsd: number | null;
  balances: { asset: string; qty: string; priceUsd: string | null; valueUsd: number | null }[];
}

const STABLE = new Set(["USD", "USDC", "USDT"]);

export async function portfolioView(
  supabase: SupabaseClient,
  userId: string,
): Promise<PortfolioView> {
  const { venue, mode, connection } = await venueFor(supabase, userId);
  const balances = await venue.balances();
  const { coinbasePublicPrice } = await import("./coinbase");
  const holdings = await Promise.all(
    balances
      .filter((b) => Number(b.available) > 0 || Number(b.hold) > 0)
      .map(async (balance) => {
        const qty = balance.available;
        let priceUsd: string | null = null;
        let valueUsd: number | null = null;
        if (STABLE.has(balance.asset)) {
          priceUsd = "1";
          valueUsd = Number(qty) + Number(balance.hold);
        } else {
          priceUsd = await coinbasePublicPrice(`${balance.asset}-USD`).catch(
            () => null,
          );
          valueUsd = priceUsd
            ? (Number(qty) + Number(balance.hold)) * Number(priceUsd)
            : null;
        }
        return { asset: balance.asset, qty, priceUsd, valueUsd };
      }),
  );
  const cash = holdings.find((h) => h.asset === "USD");
  const sum = holdings.reduce((acc, h) => acc + (h.valueUsd ?? 0), 0);
  const totalUsd = holdings.some((h) => h.valueUsd === null) && sum === 0
    ? null
    : sum;
  return {
    mode,
    connected: connection?.status === "connected",
    portfolioName: connection?.portfolio_name ?? null,
    totalUsd,
    cashUsd: cash ? Number(cash.qty) : null,
    balances: holdings,
  };
}

export async function listTradeOrders(
  supabase: SupabaseClient,
  userId: string,
  scope: "open" | "recent",
): Promise<TradeOrderRecord[]> {
  const { venue } = await venueFor(supabase, userId);
  return venue.listOrders(scope, TRADE_LIST_LIMIT);
}

export type { TradeBalance };
