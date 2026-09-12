/**
 * Paper venue (docs/trade/plan.md §0.2): simulated fills booked into the
 * box document `paper.json` at live public prices, behind the identical
 * preview → approve → submit path as the Coinbase venue. Paper mode is the
 * product's rehearsal surface and the eval fixture — same code, different
 * `TradeVenue` behind it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { coinbasePublicPrice } from "./coinbase";
import { canonicalOrder, type TradeOrder } from "./order";
import {
  EMPTY_PAPER_DOC,
  normalizePaperDoc,
  readTradeDoc,
  mutateTradeDoc,
  type TradePaperDoc,
  type TradePaperFill,
} from "./state";
import {
  TradeVenueError,
  type TradeBalance,
  type TradeFillResult,
  type TradePreview,
  type TradeVenue,
} from "./venue";

/** Simulated taker fee — deliberately honest, mid-band. */
const PAPER_FEE_RATE = 0.006;
const DP = 8;

function round(value: number, dp = DP): number {
  return Number(value.toFixed(dp));
}

function dec(value: number, dp = DP): string {
  return String(round(value, dp));
}

function estimateFill(order: TradeOrder, price: number): TradePreview {
  const quote = order.productId.split("-")[1] ?? "USD";
  const base = order.productId.split("-")[0] ?? "";
  if (order.type === "market" && order.side === "BUY") {
    const spend = Number(order.quoteSize);
    return {
      estimatedPrice: dec(price),
      estimatedFill: dec(spend / price),
      fee: dec(spend * PAPER_FEE_RATE),
      slippage: "0",
      total: dec(spend),
      currency: quote,
      raw: { paper: true, price: dec(price), product: order.productId },
    };
  }
  const qty = Number(order.baseSize);
  const limit = order.limitPrice ? Number(order.limitPrice) : price;
  const effective = order.side === "SELL" ? Math.max(limit, price) : Math.min(limit, price);
  const value = qty * effective;
  return {
    estimatedPrice: dec(effective),
    estimatedFill: order.side === "SELL" ? `${dec(qty)} ${base}` : dec(qty),
    fee: dec(value * PAPER_FEE_RATE),
    slippage: "0",
    total: dec(value),
    currency: quote,
    raw: { paper: true, price: dec(effective), product: order.productId },
  };
}

async function paperPrice(productId: string): Promise<number> {
  const price = await coinbasePublicPrice(productId);
  const parsed = price ? Number(price) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TradeVenueError(
      `No live price for ${productId} right now.`,
      502,
      "no_price",
    );
  }
  return parsed;
}

export function paperVenue(supabase: SupabaseClient, userId: string): TradeVenue {
  const load = () =>
    readTradeDoc(supabase, userId, "paper", EMPTY_PAPER_DOC).then(normalizePaperDoc);

  return {
    // Paper keeps the same product gating as live (T4 still applies).
    async getProduct(productId) {
      const { coinbasePublicProduct } = await import("./coinbase");
      return coinbasePublicProduct(productId);
    },
    async listProducts(query, limit) {
      const { coinbasePublicProducts } = await import("./coinbase");
      return coinbasePublicProducts(query, limit);
    },

    async balances(): Promise<TradeBalance[]> {
      const doc = await load();
      const rows: TradeBalance[] = [
        { asset: "USD", available: dec(doc.cashUsd), hold: "0" },
      ];
      for (const [asset, position] of Object.entries(doc.positions)) {
        rows.push({ asset, available: dec(position.qty), hold: "0" });
      }
      return rows;
    },

    async previewOrder(order) {
      // Paper fills the whole quantity at one price — modelling open limit or
      // untriggered stop orders needs a pending-order state machine, so v1
      // paper is honestly market-only.
      if (order.type !== "market") {
        throw new TradeVenueError(
          "Paper trading is market orders only — limit and stop-limit need a connected Coinbase key.",
          400,
          "paper_market_only",
        );
      }
      return estimateFill(order, await paperPrice(order.productId));
    },

    async createOrder(order, clientOrderId): Promise<TradeFillResult> {
      const canonical = canonicalOrder(order);
      if (canonical.type !== "market") {
        throw new TradeVenueError(
          "Paper trading is market orders only.",
          400,
          "paper_market_only",
        );
      }
      const price = await paperPrice(canonical.productId);
      const base = canonical.productId.split("-")[0] ?? "";
      const preview = estimateFill(canonical, price);
      const effectivePrice = Number(preview.estimatedPrice ?? price);
      const qty =
        canonical.side === "BUY" && canonical.type === "market"
          ? Number(canonical.quoteSize) / effectivePrice
          : Number(canonical.baseSize);
      const valueUsd = qty * effectivePrice;
      const feeUsd = valueUsd * PAPER_FEE_RATE;

      // A mutable holder — the fill is assigned inside the lease callback,
      // which TypeScript can't see, so a plain `let` would narrow to never.
      const result: { fill: TradePaperFill | null } = { fill: null };
      await mutateTradeDoc(supabase, userId, "paper", EMPTY_PAPER_DOC, (docIn) => {
        const doc = normalizePaperDoc(docIn);
        if (canonical.side === "BUY") {
          const cost = valueUsd + feeUsd;
          if (cost > doc.cashUsd + 1e-9) {
            throw new TradeVenueError(
              `Not enough paper USD — need ${dec(cost)}, have ${dec(doc.cashUsd)}.`,
              400,
              "insufficient_funds",
            );
          }
          doc.cashUsd = round(doc.cashUsd - cost, 2);
          const position = doc.positions[base] ?? { qty: 0, avgCost: 0 };
          const totalQty = position.qty + qty;
          position.avgCost =
            totalQty > 0
              ? (position.qty * position.avgCost + qty * effectivePrice) / totalQty
              : 0;
          position.qty = round(totalQty);
          doc.positions[base] = position;
        } else {
          const position = doc.positions[base];
          if (!position || position.qty + 1e-9 < qty) {
            throw new TradeVenueError(
              `Not enough paper ${base} — have ${position ? dec(position.qty) : "0"}.`,
              400,
              "insufficient_funds",
            );
          }
          position.qty = round(position.qty - qty);
          if (position.qty <= 0) delete doc.positions[base];
          doc.cashUsd = round(doc.cashUsd + valueUsd - feeUsd, 2);
        }
        result.fill = {
          at: new Date().toISOString(),
          orderId: clientOrderId,
          productId: canonical.productId,
          side: canonical.side,
          qty: dec(qty),
          price: dec(effectivePrice),
          valueUsd: dec(valueUsd, 2),
          feeUsd: dec(feeUsd, 2),
        };
        doc.ledger.push(result.fill);
        return doc;
      });
      const fillRow = result.fill;
      return {
        orderId: fillRow?.orderId ?? clientOrderId,
        status: "filled",
        filledSize: fillRow?.qty ?? dec(qty),
        filledValue: fillRow?.valueUsd ?? dec(valueUsd, 2),
        averagePrice: fillRow?.price ?? dec(effectivePrice),
        fee: fillRow?.feeUsd ?? dec(feeUsd, 2),
        raw: { paper: true, orderId: clientOrderId },
      };
    },

    async listOrders(_scope, limit) {
      const doc = await load();
      const rows = [...doc.ledger].reverse().slice(0, Math.min(limit, COINBASE_LIST_MAX));
      return rows.map((fill) => ({
        orderId: fill.orderId,
        productId: fill.productId,
        side: fill.side,
        type: "market",
        status: "FILLED",
        sizeLabel:
          fill.side === "BUY" ? `${fill.valueUsd} USD` : `${fill.qty} ${fill.productId.split("-")[0]}`,
        filledValue: fill.valueUsd,
        filledSize: fill.qty,
        averagePrice: fill.price,
        fee: fill.feeUsd,
        createdAt: fill.at,
      }));
    },

    async getOrder(orderId) {
      const doc = await load();
      const fill = doc.ledger.find((row) => row.orderId === orderId);
      if (!fill) {
        throw new TradeVenueError("No such paper order.", 404, "not_found");
      }
      return {
        orderId: fill.orderId,
        productId: fill.productId,
        side: fill.side,
        type: "market",
        status: "FILLED",
        sizeLabel:
          fill.side === "BUY" ? `${fill.valueUsd} USD` : `${fill.qty} ${fill.productId.split("-")[0]}`,
        filledValue: fill.valueUsd,
        filledSize: fill.qty,
        averagePrice: fill.price,
        fee: fill.feeUsd,
        createdAt: fill.at,
      };
    },

    async cancelOrders() {
      // Paper market orders fill synchronously — nothing stays open to cancel.
      return { cancelled: [] };
    },
  };
}

const COINBASE_LIST_MAX = 200;

/** Rebuilt for the Portfolio tab and the iMessage `/trade portfolio` line. */
export async function paperPortfolio(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ doc: TradePaperDoc; totalUsd: number }> {
  const doc = normalizePaperDoc(
    await readTradeDoc(supabase, userId, "paper", EMPTY_PAPER_DOC),
  );
  let totalUsd = doc.cashUsd;
  for (const [asset, position] of Object.entries(doc.positions)) {
    const price = await coinbasePublicPrice(`${asset}-USD`).catch(() => null);
    totalUsd += position.qty * (price ? Number(price) : position.avgCost);
  }
  return { doc, totalUsd };
}
