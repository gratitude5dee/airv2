/**
 * The venue seam (docs/trade/plan.md §7.1): `coinbaseVenue` talks to the
 * user's own Advanced Trade portfolio, `paperVenue` books simulated fills
 * against the box document and public prices. Both share every line of the
 * preview → approve → submit path; only the venue differs.
 */
import type { TradeOrder } from "./order";

export interface TradeProduct {
  productId: string;
  displayName: string;
  productType: string;
  status: string;
  baseCurrencyId: string;
  quoteCurrencyId: string;
  price: string | null;
  baseIncrement: string | null;
  quoteIncrement: string | null;
  quoteMinSize: string | null;
}

export interface TradeBalance {
  asset: string;
  available: string;
  hold: string;
}

export interface TradePreview {
  /** Raw provider preview response (or the paper estimate) — stored on the
   * trade_orders row so the approval card renders exactly what was priced. */
  estimatedPrice: string | null;
  estimatedFill: string | null;
  fee: string | null;
  slippage: string | null;
  total: string | null;
  currency: string | null;
  raw: Record<string, unknown>;
}

export interface TradeOrderRecord {
  orderId: string;
  productId: string;
  side: "BUY" | "SELL";
  type: string;
  status: string;
  sizeLabel: string;
  filledValue: string | null;
  filledSize: string | null;
  averagePrice: string | null;
  fee: string | null;
  createdAt: string | null;
}

export interface TradeFillResult {
  orderId: string;
  status: string;
  filledSize: string | null;
  filledValue: string | null;
  averagePrice: string | null;
  fee: string | null;
  raw: Record<string, unknown>;
}

export interface TradeVenue {
  getProduct(productId: string): Promise<TradeProduct>;
  listProducts(query: string, limit: number): Promise<TradeProduct[]>;
  balances(): Promise<TradeBalance[]>;
  previewOrder(order: TradeOrder): Promise<TradePreview>;
  createOrder(order: TradeOrder, clientOrderId: string): Promise<TradeFillResult>;
  listOrders(scope: "open" | "recent", limit: number): Promise<TradeOrderRecord[]>;
  getOrder(orderId: string): Promise<TradeOrderRecord>;
  cancelOrders(orderIds: string[]): Promise<{ cancelled: string[] }>;
}

/** T4: a tradable product is spot and online — anything else refuses before
 *  the preview call, and again before submit. */
export function assertTradableSpotProduct(product: TradeProduct): void {
  const type = (product.productType ?? "").toUpperCase();
  if (type && type !== "SPOT") {
    throw new TradeVenueError("Only spot products can be traded here.", 400, "not_spot");
  }
  const status = (product.status ?? "").toUpperCase();
  if (status && status !== "ONLINE") {
    throw new TradeVenueError("That product is not trading right now.", 400, "offline");
  }
}

export class TradeVenueError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 502, code = "venue_error") {
    super(message);
    this.name = "TradeVenueError";
    this.status = status;
    this.code = code;
  }
}
