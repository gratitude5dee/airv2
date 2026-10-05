/**
 * Tape — the Bloxwap-style one-screen surface for /trade
 * (docs/trade/tape.md). It maps the thumb-trading interaction onto air's
 * spot-only trust rails: UP = buy a USD stake, DOWN = sell a USD stake's
 * worth of the held asset (never a short). Taps funnel into the same
 * preview → decision → resolve pipeline as the classic ticket; the preview
 * token never leaves the server.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveHostedDecision,
  type HostedDecision,
} from "@/lib/approvals/hosted";
import {
  coinbasePublicCandles,
  coinbasePublicChangePct,
  coinbasePublicPrice,
} from "./coinbase";
import { orderSummary } from "./order";
import { paperPortfolio } from "./paper";
import {
  venueFor,
  portfolioView,
  previewTrade,
  proposeTrade,
  getTradeConnection,
  TradeError,
  type TradeMode,
  type TradeOrderRow,
} from "./service";
import { EMPTY_TAPE_DOC, readTradeDoc, mutateTradeDoc } from "./state";
import { listWatches } from "./watch";

export const TAPE_STAKES_USD = [10, 25, 100] as const;
const TAPE_CANDLE_SECONDS = 90 * 60;
const TAPE_MARKET_MAX = 10;
const TAPE_DEFAULT_MARKETS = ["BTC", "ETH", "SOL"];

export interface TapeMarket {
  productId: string;
  symbol: string;
}

export interface TapePosition {
  asset: string;
  qty: number;
  avgCostUsd: number | null;
  valueUsd: number;
  pnlUsd: number | null;
}

export interface TapePending {
  decisionId: string;
  orderId: string;
  productId: string;
  side: "BUY" | "SELL";
  label: string;
  est: {
    price: string | null;
    fill: string | null;
    fee: string | null;
    total: string | null;
    currency: string | null;
  };
  expiresAt: string | null;
  mode: TradeMode;
  caps: { perOrder: number; daily: number; spentToday: number } | null;
}

export interface TapeState {
  ok: true;
  at: string;
  product: string;
  price: number | null;
  changePct: number | null;
  candles: [number, number][];
  mode: TradeMode;
  connected: boolean;
  equityUsd: number | null;
  cashUsd: number | null;
  position: TapePosition | null;
  pending: TapePending | null;
  stakeUsd: number[];
}

const ORDER_CARD_COLUMNS =
  "id, mode, product_id, side, order_type, base_size, quote_size, decision_id, preview, preview_expires_at, notional_usd, client_order_id, state";

export function baseAsset(productId: string): string {
  return productId.split("-")[0]?.toUpperCase() ?? productId;
}

/* ------------------------------------------------------------ pending */

async function capsFor(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ perOrder: number; daily: number; spentToday: number } | null> {
  const connection = await getTradeConnection(supabase, userId);
  if (!connection || connection.mode !== "live") return null;
  const perOrder = Number(connection.per_order_usd_cap ?? 250);
  const daily = Number(connection.daily_usd_cap ?? 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: todays } = await supabase
    .from("trade_orders")
    .select("notional_usd")
    .eq("user_id", userId)
    .eq("mode", "live")
    .gte("created_at", dayAgo)
    .in("state", ["pending_approval", "submitted", "partially_filled", "filled"]);
  const spentToday = (todays ?? []).reduce(
    (sum, entry) => sum + (Number(entry.notional_usd) || 0),
    0,
  );
  return { perOrder, daily, spentToday };
}

/** The one pending trade approval (T3 guarantees at most one), card-shaped. */
export async function pendingTapeCard(
  supabase: SupabaseClient,
  userId: string,
): Promise<TapePending | null> {
  const { data } = await supabase
    .from("trade_orders")
    .select(ORDER_CARD_COLUMNS)
    .eq("user_id", userId)
    .eq("state", "pending_approval")
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data?.[0] ?? null) as TradeOrderRow | null;
  if (!row || !row.decision_id) return null;
  const estimate =
    ((row.preview ?? {}) as Record<string, unknown>)["estimated"] ?? {};
  const est = estimate as Record<string, unknown>;
  const summary = orderSummary({
    productId: row.product_id,
    side: row.side,
    type: row.order_type,
    ...(row.base_size ? { baseSize: row.base_size } : {}),
    ...(row.quote_size ? { quoteSize: row.quote_size } : {}),
    ...(row.limit_price ? { limitPrice: row.limit_price } : {}),
    ...(row.stop_price ? { stopPrice: row.stop_price } : {}),
  } as Parameters<typeof orderSummary>[0]);
  return {
    decisionId: row.decision_id,
    orderId: row.id,
    productId: row.product_id,
    side: row.side,
    label: summary,
    est: {
      price: (est["estimatedPrice"] as string) ?? null,
      fill: (est["estimatedFill"] as string) ?? null,
      fee: (est["fee"] as string) ?? null,
      total: (est["total"] as string) ?? null,
      currency: (est["currency"] as string) ?? null,
    },
    expiresAt: row.preview_expires_at,
    mode: row.mode,
    caps: row.mode === "live" ? await capsFor(supabase, userId) : null,
  };
}

/* --------------------------------------------------------- cost basis */

/**
 * Reconstruct an approximate cost basis for a live holding from our own
 * ledger: replay filled orders oldest→newest, BUY adds qty+cost, SELL
 * reduces at the running average. Returns null when the ledger can't
 * explain the venue's quantity (deposits/trades outside air).
 */
async function livePositionBasis(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
  heldQty: number,
): Promise<number | null> {
  const { data } = await supabase
    .from("trade_orders")
    .select("side, base_size, quote_size, notional_usd, preview, created_at")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("state", "filled")
    .order("created_at", { ascending: true })
    .limit(500);
  let qty = 0;
  let cost = 0;
  for (const row of data ?? []) {
    const est =
      (((row.preview ?? {}) as Record<string, unknown>)["estimated"] ??
        {}) as Record<string, unknown>;
    if (row.side === "BUY") {
      const fillQty =
        Number(est["estimatedFill"]) || Number(row.base_size) || 0;
      const total =
        Number(est["total"]) || Number(row.notional_usd) || fillQty * Number(est["estimatedPrice"]) || 0;
      qty += fillQty;
      cost += total;
    } else {
      const sellQty = Number(row.base_size) || Number(est["estimatedFill"]) || 0;
      if (qty <= 0) continue;
      const avg = cost / qty;
      const closed = Math.min(sellQty, qty);
      qty -= closed;
      cost -= avg * closed;
      if (qty <= 0) {
        qty = 0;
        cost = 0;
      }
    }
  }
  if (qty <= 0 || heldQty <= 0) return null;
  if (Math.abs(qty - heldQty) / heldQty > 0.05) return null;
  return cost / qty;
}

/* -------------------------------------------------------------- state */

/**
 * One poll's worth of tape state. Paper reads the box doc (waking the box,
 * same as every mini-app render); live never touches box state.
 */
export async function tapeState(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
): Promise<TapeState> {
  const asset = baseAsset(productId);
  const { mode } = await venueFor(supabase, userId);
  const [priceRaw, changePct, candles, pending] = await Promise.all([
    coinbasePublicPrice(productId).catch(() => null),
    coinbasePublicChangePct(productId).catch(() => null),
    coinbasePublicCandles(productId, TAPE_CANDLE_SECONDS).catch(() => []),
    pendingTapeCard(supabase, userId).catch(() => null),
  ]);
  const price = priceRaw ? Number(priceRaw) : null;

  let equityUsd: number | null = null;
  let cashUsd: number | null = null;
  let position: TapePosition | null = null;

  if (mode === "paper") {
    const { doc, totalUsd } = await paperPortfolio(supabase, userId);
    cashUsd = doc.cashUsd;
    equityUsd = totalUsd;
    const held = doc.positions[asset];
    if (held && held.qty > 0) {
      const valueUsd = held.qty * (price ?? held.avgCost);
      position = {
        asset,
        qty: held.qty,
        avgCostUsd: held.avgCost,
        valueUsd,
        pnlUsd: price === null ? null : (price - held.avgCost) * held.qty,
      };
    }
  } else {
    const view = await portfolioView(supabase, userId);
    cashUsd = view.cashUsd;
    equityUsd = view.totalUsd;
    const bal = view.balances.find((b) => b.asset === asset);
    const qty = Number(bal?.qty ?? 0);
    if (qty > 0) {
      const avgCostUsd = await livePositionBasis(
        supabase,
        userId,
        productId,
        qty,
      ).catch(() => null);
      const valueUsd = qty * (price ?? Number(bal?.priceUsd ?? 0));
      position = {
        asset,
        qty,
        avgCostUsd,
        valueUsd,
        pnlUsd: avgCostUsd !== null && price !== null ? (price - avgCostUsd) * qty : null,
      };
    }
  }

  return {
    ok: true,
    at: new Date().toISOString(),
    product: productId,
    price,
    changePct,
    candles,
    mode,
    connected: mode === "live",
    equityUsd,
    cashUsd,
    position,
    pending,
    stakeUsd: [...TAPE_STAKES_USD],
  };
}

/* ------------------------------------------------------------- markets */

/** Symbols for the left rail: watched + held + majors, deduped, capped. */
export async function tapeMarkets(
  supabase: SupabaseClient,
  userId: string,
): Promise<TapeMarket[]> {
  const symbols: string[] = [];
  const seen = new Set<string>();
  const push = (symbol: string) => {
    const s = symbol.toUpperCase();
    if (s && !seen.has(s) && symbols.length < TAPE_MARKET_MAX) {
      seen.add(s);
      symbols.push(s);
    }
  };
  for (const item of await listWatches(supabase, userId).catch(() => [])) {
    push(item.symbol);
  }
  const { mode } = await venueFor(supabase, userId);
  if (mode === "paper") {
    const { doc } = await paperPortfolio(supabase, userId).catch(() => ({
      doc: { positions: {} },
      totalUsd: 0,
    }));
    for (const asset of Object.keys(doc.positions)) push(asset);
  } else {
    const view = await portfolioView(supabase, userId).catch(() => null);
    for (const b of view?.balances ?? []) {
      if (!["USD", "USDC", "USDT"].includes(b.asset) && Number(b.qty) > 0) push(b.asset);
    }
  }
  for (const symbol of TAPE_DEFAULT_MARKETS) push(symbol);
  return symbols.map((symbol) => ({ symbol, productId: `${symbol}-USD` }));
}

/* ------------------------------------------------------------- intent */

export type TapeSide = "up" | "down";

function stakeUsd(
  stake: string,
  budgetUsd: number,
): number {
  if (stake === "max") return budgetUsd;
  if (stake === "half") return budgetUsd * 0.5;
  const parsed = Number(stake);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TradeError("Pick a stake — $10, $25, $100, half, or max.", 400, "bad_stake");
  }
  return Math.min(parsed, budgetUsd);
}

/**
 * One tap → preview + propose in a single server hop. The preview token is
 * born and consumed server-side; the browser only ever sees the decision
 * card. A second tap while one is pending (T3) returns the existing card
 * instead of an error.
 */
export async function tapeIntent(
  supabase: SupabaseClient,
  userId: string,
  input: { product?: unknown; side?: unknown; stake?: unknown },
): Promise<{ pending: TapePending }> {
  const productId =
    typeof input.product === "string" && /^[A-Z0-9]{1,12}-USD$/.test(input.product.trim().toUpperCase())
      ? input.product.trim().toUpperCase()
      : "";
  if (!productId) {
    throw new TradeError("Pick a market first.", 400, "bad_product");
  }
  const side = input.side === "up" || input.side === "down" ? input.side : null;
  if (!side) {
    throw new TradeError("Up or down?", 400, "bad_side");
  }
  const stake = typeof input.stake === "string" ? input.stake.trim() : "";
  const asset = baseAsset(productId);
  const { venue } = await venueFor(supabase, userId);
  const balances = await venue.balances();
  const cashUsd = balances
    .filter((b) => ["USD", "USDC", "USDT"].includes(b.asset))
    .reduce((sum, b) => sum + Number(b.available), 0);
  const held = Number(balances.find((b) => b.asset === asset)?.available ?? 0);

  let order: Record<string, unknown>;
  if (side === "up") {
    // Max leaves headroom for the venue fee.
    const budget = stakeUsd(stake, cashUsd) * (stake === "max" ? 0.99 : 1);
    if (budget < 0.01) {
      throw new TradeError(
        cashUsd < 0.01 ? "No cash to buy with." : "That stake is too small.",
        400,
        "bad_stake",
      );
    }
    order = {
      productId,
      side: "BUY",
      type: "market",
      quoteSize: budget.toFixed(2),
    };
  } else {
    if (held <= 0) {
      throw new TradeError(`No ${asset} to sell — down never shorts.`, 400, "flat");
    }
    const price = Number(await coinbasePublicPrice(productId));
    if (!Number.isFinite(price) || price <= 0) {
      throw new TradeError("No quote for that market right now.", 502, "no_price");
    }
    const heldUsd = held * price;
    const sellUsd = Math.min(stakeUsd(stake, heldUsd), heldUsd);
    const qty = Math.min(held, sellUsd / price);
    if (qty * price < 0.01) {
      throw new TradeError("That stake is too small.", 400, "bad_stake");
    }
    order = {
      productId,
      side: "SELL",
      type: "market",
      baseSize: qty.toFixed(8).replace(/\.?0+$/, ""),
    };
  }

  try {
    const preview = await previewTrade(supabase, userId, order, "miniapp:tape");
    await proposeTrade(supabase, userId, {
      order: preview.order,
      previewToken: preview.previewToken,
    });
  } catch (error) {
    // T3: surface the standing approval rather than a bare refusal.
    if (error instanceof TradeError && error.code === "approval_pending") {
      const existing = await pendingTapeCard(supabase, userId);
      if (existing) return { pending: existing };
    }
    throw error;
  }
  const pending = await pendingTapeCard(supabase, userId);
  if (!pending) {
    throw new TradeError("The approval didn't file — try again.", 500, "pending_missing");
  }
  return { pending };
}

/* ------------------------------------------------------------ resolve */

export async function tapeResolve(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
  choice: "approve" | "dismiss",
): Promise<{ state: string; detail: string; pnlUsd: number | null }> {
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, kind, ref, status, label, payload")
    .eq("id", decisionId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (!decision || decision.kind !== "trade_order") {
    throw new TradeError("That approval is no longer pending.", 404, "not_pending");
  }
  const payload = (decision.payload ?? {}) as Record<string, unknown>;
  const mode = payload["mode"] === "live" ? "live" : "paper";
  const order = (payload["order"] ?? {}) as Record<string, unknown>;
  const productId = typeof order["productId"] === "string" ? order["productId"] : "";
  const side = order["side"];

  // Snapshot cost basis before the fill so a closing sell can report
  // realized P&L (paper fills synchronously, so the ledger has the fill
  // by the time resolve returns).
  let avgCostBefore: number | null = null;
  let clientOrderId: string | null = null;
  if (mode === "paper" && side === "SELL" && choice === "approve") {
    const { data: row } = await supabase
      .from("trade_orders")
      .select("client_order_id")
      .eq("id", decision.ref)
      .eq("user_id", userId)
      .maybeSingle();
    clientOrderId = (row?.client_order_id as string) ?? null;
    const { doc } = await paperPortfolio(supabase, userId);
    avgCostBefore = doc.positions[baseAsset(productId)]?.avgCost ?? null;
  }

  const outcome = await resolveHostedDecision(
    supabase,
    userId,
    decision as HostedDecision,
    choice,
  );
  const trade = (outcome as { trade?: { state: string; detail: string } }).trade;
  const state = trade?.state ?? "done";
  const detail = trade?.detail ?? decision.label ?? "Done.";

  let pnlUsd: number | null = null;
  if (choice === "approve" && state === "filled" && mode === "paper" && side === "SELL") {
    const { doc } = await paperPortfolio(supabase, userId);
    const fill = clientOrderId
      ? [...doc.ledger].reverse().find((f) => f.orderId === clientOrderId)
      : null;
    if (fill && avgCostBefore !== null) {
      pnlUsd =
        Number(fill.qty) * (Number(fill.price) - avgCostBefore) - Number(fill.feeUsd);
    }
  }
  return { state, detail, pnlUsd };
}

/* ------------------------------------------------------------ welcome */

export async function tapeWelcomed(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const doc = await readTradeDoc(
    supabase,
    userId,
    "tape",
    EMPTY_TAPE_DOC,
  ).catch(() => EMPTY_TAPE_DOC);
  return typeof doc.welcomedAt === "string" && doc.welcomedAt.length > 0;
}

export async function tapeMarkWelcomed(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await mutateTradeDoc(supabase, userId, "tape", EMPTY_TAPE_DOC, (doc) => {
    if (doc.welcomedAt) return false;
    return { version: 1 as const, welcomedAt: new Date().toISOString() };
  }).catch(() => EMPTY_TAPE_DOC);
}
