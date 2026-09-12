/**
 * Coinbase Advanced Trade REST venue (docs/trade/plan.md §7.1). Direct REST
 * instead of Adaam's CLI-as-MCP child: ~9 endpoints behind zod schemas, each
 * request signed with a fresh 120s CDP JWT. Public market endpoints under
 * /market/ need no key, so paper mode and the watchlist work for users who
 * never connect. C5: the only outbound hosts are api.coinbase.com here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mintCdpJwt } from "./cdpJwt";
import type { TradeOrder } from "./order";
import {
  TradeVenueError,
  type TradeBalance,
  type TradeOrderRecord,
  type TradeProduct,
  type TradeVenue,
} from "./venue";
import { env } from "../env";
import { openSecret } from "../crypto/secretbox";

const HOST = "api.coinbase.com";
const BASE = `https://${HOST}/api/v3/brokerage`;
const REQUEST_TIMEOUT_MS = 15_000;
export const COINBASE_MAX_PAGE_ITEMS = 200;

function num(value: unknown): string | null {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/* ----------------------------------------------------------- transport */

async function publicGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = (await response.text().catch(() => "")).slice(0, 200);
      throw new TradeVenueError(
        `Coinbase market data failed (${response.status}): ${text}`,
        response.status >= 500 ? 502 : response.status,
        "coinbase_http",
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof TradeVenueError) throw error;
    throw new TradeVenueError(
      "Couldn't reach Coinbase market data — try again.",
      502,
      "coinbase_unreachable",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function authedFetch<T>(input: {
  keyId: string;
  keySecret: string;
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown> | undefined;
}): Promise<T> {
  const jwt = mintCdpJwt({
    keyId: input.keyId,
    keySecret: input.keySecret,
    method: input.method,
    host: HOST,
    path: `/api/v3/brokerage${input.path}`,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${input.path}`, {
      method: input.method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${jwt}`,
        "content-type": "application/json",
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    let json: unknown = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
    if (!response.ok) {
      const parsed = record(json);
      const message =
        str(parsed["message"]) ||
        str(record(parsed["error_response"])["message"]) ||
        `Coinbase request failed (${response.status})`;
      throw new TradeVenueError(
        message.slice(0, 300),
        response.status === 401 || response.status === 403 ? 403 : 502,
        "coinbase_http",
      );
    }
    return json as T;
  } catch (error) {
    if (error instanceof TradeVenueError) throw error;
    throw new TradeVenueError(
      "Couldn't reach Coinbase — try again.",
      502,
      "coinbase_unreachable",
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------ shapes */

function toProduct(raw: unknown): TradeProduct | null {
  const row = record(raw);
  const productId = str(row["product_id"]);
  if (!productId) return null;
  return {
    productId,
    displayName: str(row["display_name"]) || str(row["base_name"]) || productId,
    productType: str(row["product_type"]) || "SPOT",
    status: str(row["status"]),
    baseCurrencyId: str(row["base_currency_id"]) || productId.split("-")[0] || "",
    quoteCurrencyId: str(row["quote_currency_id"]) || productId.split("-")[1] || "",
    price: num(row["price"]),
    baseIncrement: num(row["base_increment"]),
    quoteIncrement: num(row["quote_increment"]),
    quoteMinSize: num(row["quote_min_size"]),
  };
}

function orderConfiguration(order: TradeOrder): Record<string, unknown> {
  if (order.type === "market") {
    return {
      market_market_ioc: order.side === "BUY"
        ? { quote_size: order.quoteSize }
        : { base_size: order.baseSize },
    };
  }
  if (order.type === "limit") {
    return {
      limit_limit_gtc: {
        base_size: order.baseSize,
        limit_price: order.limitPrice,
        post_only: false,
      },
    };
  }
  return {
    stop_limit_stop_limit_gtc: {
      base_size: order.baseSize,
      limit_price: order.limitPrice,
      stop_price: order.stopPrice,
      stop_direction:
        order.stopDirection === "up"
          ? "STOP_DIRECTION_STOP_UP"
          : "STOP_DIRECTION_STOP_DOWN",
    },
  };
}

function toOrderRecord(raw: unknown): TradeOrderRecord | null {
  const row = record(raw);
  const orderId = str(row["order_id"]);
  if (!orderId) return null;
  const config = record(row["order_configuration"]);
  const market = record(config["market_market_ioc"]);
  const limit = record(config["limit_limit_gtc"]);
  const stopLimit = record(config["stop_limit_stop_limit_gtc"]);
  const sizeLabel =
    (market["quote_size"] ? `${market["quote_size"]} quote` : "") ||
    (market["base_size"] ? `${market["base_size"]} base` : "") ||
    (limit["base_size"] ? `${limit["base_size"]} @ ${str(limit["limit_price"])}` : "") ||
    (stopLimit["base_size"]
      ? `${stopLimit["base_size"]} @ ${str(stopLimit["limit_price"])}`
      : "");
  const type = market["quote_size"] || market["base_size"]
    ? "market"
    : stopLimit["stop_price"]
      ? "stop_limit"
      : "limit";
  return {
    orderId,
    productId: str(row["product_id"]),
    side: (str(row["side"]) || "BUY") as "BUY" | "SELL",
    type,
    status: str(row["status"]) || "unknown",
    sizeLabel: sizeLabel || "—",
    filledValue: num(row["filled_value"]),
    filledSize: num(row["filled_size"]),
    averagePrice: num(row["average_filled_price"]),
    fee: num(row["total_fees"]) ?? num(row["fee"]),
    createdAt: str(row["created_time"]) || null,
  };
}

/* --------------------------------------------------- public (no key) */

export async function coinbasePublicProduct(
  productId: string,
): Promise<TradeProduct> {
  const data = await publicGet<Record<string, unknown>>(
    `/market/products/${encodeURIComponent(productId)}`,
  );
  const product = toProduct(data);
  if (!product) {
    throw new TradeVenueError(`No Coinbase product named ${productId}.`, 404, "not_found");
  }
  return product;
}

export async function coinbasePublicProducts(
  query: string,
  limit = 25,
): Promise<TradeProduct[]> {
  const capped = Math.min(Math.max(1, limit), COINBASE_MAX_PAGE_ITEMS);
  const data = await publicGet<Record<string, unknown>>(
    `/market/products?limit=${capped}&product_type=SPOT`,
  );
  const products = (Array.isArray(data["products"]) ? data["products"] : [])
    .map(toProduct)
    .filter((p): p is TradeProduct => p !== null);
  if (!query) return products;
  const q = query.trim().toUpperCase();
  return products.filter(
    (p) =>
      p.productId.includes(q) ||
      p.baseCurrencyId.includes(q) ||
      p.displayName.toUpperCase().includes(q),
  );
}

/** Unauthenticated last-trade price for one product (watchlist + paper fills). */
export async function coinbasePublicPrice(productId: string): Promise<string | null> {
  const data = await publicGet<Record<string, unknown>>(
    `/market/products/${encodeURIComponent(productId)}/ticker`,
  );
  const trades = Array.isArray(data["trades"]) ? data["trades"] : [];
  const first = record(trades[0]);
  return num(first["price"]) ?? num(record(data)["price"]);
}

/* ----------------------------------------------------- venue (BYO key) */

export interface CoinbaseCredentials {
  keyId: string;
  keySecret: string;
  portfolioUuid: string | null;
}

export function coinbaseVenue(creds: CoinbaseCredentials): TradeVenue {
  const call = <T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> =>
    authedFetch<T>({
      keyId: creds.keyId,
      keySecret: creds.keySecret,
      method,
      path,
      body,
    });

  return {
    async getProduct(productId) {
      const data = await call<Record<string, unknown>>(
        "GET",
        `/products/${encodeURIComponent(productId)}`,
      );
      const product = toProduct(data);
      if (!product) {
        throw new TradeVenueError(`No Coinbase product named ${productId}.`, 404, "not_found");
      }
      return product;
    },

    async listProducts(query, limit) {
      const capped = Math.min(Math.max(1, limit), COINBASE_MAX_PAGE_ITEMS);
      const data = await call<Record<string, unknown>>(
        "GET",
        `/products?limit=${capped}&product_type=SPOT`,
      );
      const products = (Array.isArray(data["products"]) ? data["products"] : [])
        .map(toProduct)
        .filter((p): p is TradeProduct => p !== null);
      if (!query) return products;
      const q = query.trim().toUpperCase();
      return products.filter(
        (p) =>
          p.productId.includes(q) ||
          p.baseCurrencyId.includes(q) ||
          p.displayName.toUpperCase().includes(q),
      );
    },

    async balances() {
      const data = await call<Record<string, unknown>>(
        "GET",
        `/accounts?limit=${COINBASE_MAX_PAGE_ITEMS}`,
      );
      const rows = (Array.isArray(data["accounts"]) ? data["accounts"] : [])
        .map(record)
        .filter(
          (account) =>
            !creds.portfolioUuid ||
            str(account["retail_portfolio_id"]) === creds.portfolioUuid ||
            !creds.portfolioUuid,
        );
      const scoped = creds.portfolioUuid
        ? rows.filter(
            (account) =>
              str(account["retail_portfolio_id"]) === creds.portfolioUuid,
          )
        : rows;
      const source = scoped.length > 0 ? scoped : rows;
      return source
        .map((account): TradeBalance => {
          const available = record(account["available_balance"]);
          const hold = record(account["hold"]);
          return {
            asset: str(available["currency"]) || str(account["currency"]),
            available: num(available["value"]) ?? "0",
            hold: num(hold["value"]) ?? "0",
          };
        })
        .filter((balance) => balance.asset !== "");
    },

    async previewOrder(order) {
      const data = await call<Record<string, unknown>>("POST", "/orders/preview", {
        product_id: order.productId,
        side: order.side,
        order_configuration: orderConfiguration(order),
      });
      const error = str(data["error"]);
      if (error) {
        throw new TradeVenueError(`Coinbase preview failed: ${error}`, 400, "preview_failed");
      }
      return {
        estimatedPrice: num(data["estimated_price"]) ?? num(data["average_filled_price"]),
        estimatedFill:
          num(data["estimated_quantity"]) ?? num(data["estimated_size"]),
        fee: num(data["commission_total"]) ?? num(data["estimated_fee"]),
        slippage: num(data["slippage"]),
        total: num(data["order_total"]) ?? num(data["estimated_total"]),
        currency: order.side === "BUY" ? order.productId.split("-")[1] ?? "USD" : order.productId.split("-")[0] ?? "",
        raw: data,
      };
    },

    async createOrder(order, clientOrderId) {
      const data = await call<Record<string, unknown>>("POST", "/orders", {
        client_order_id: clientOrderId,
        product_id: order.productId,
        side: order.side,
        order_configuration: orderConfiguration(order),
      });
      const success = data["success"] === true;
      if (!success) {
        const errorResponse = record(data["error_response"]);
        const message =
          str(errorResponse["message"]) ||
          str(data["failure_reason"]) ||
          "Coinbase rejected the order.";
        throw new TradeVenueError(message.slice(0, 300), 400, "order_rejected");
      }
      const successResponse = record(data["success_response"]);
      return {
        orderId: str(successResponse["order_id"]) || str(data["order_id"]),
        status: "submitted",
        filledSize: null,
        filledValue: null,
        averagePrice: null,
        fee: null,
        raw: data,
      };
    },

    async listOrders(scope, limit) {
      const capped = Math.min(Math.max(1, limit), COINBASE_MAX_PAGE_ITEMS);
      const params =
        scope === "open"
          ? `limit=${capped}&order_status=OPEN`
          : `limit=${capped}`;
      const data = await call<Record<string, unknown>>(
        "GET",
        `/orders/historical/batch?${params}`,
      );
      return (Array.isArray(data["orders"]) ? data["orders"] : [])
        .map(toOrderRecord)
        .filter((order): order is TradeOrderRecord => order !== null);
    },

    async getOrder(orderId) {
      const data = await call<Record<string, unknown>>(
        "GET",
        `/orders/historical/${encodeURIComponent(orderId)}`,
      );
      const order = toOrderRecord(record(data["order"]));
      if (!order) {
        throw new TradeVenueError("Coinbase returned no such order.", 404, "not_found");
      }
      return order;
    },

    async cancelOrders(orderIds) {
      const data = await call<Record<string, unknown>>(
        "POST",
        "/orders/batch_cancel",
        { order_ids: orderIds.slice(0, COINBASE_MAX_PAGE_ITEMS) },
      );
      const results = Array.isArray(data["results"]) ? data["results"] : [];
      return {
        cancelled: results
          .map((entry) => record(entry))
          .filter((entry) => entry["success"] === true)
          .map((entry) => str(entry["order_id"]))
          .filter(Boolean),
      };
    },
  };
}

/* ---------------------------------------------- connection credentials */

export interface TradeConnectionRow {
  user_id: string;
  provider: string;
  key_id: string | null;
  key_id_hint: string | null;
  secret_sealed: string | null;
  portfolio_uuid: string | null;
  portfolio_name: string | null;
  mode: "paper" | "live";
  status: "disconnected" | "connected" | "error";
  per_order_usd_cap: number;
  daily_usd_cap: number;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getTradeConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<TradeConnectionRow | null> {
  const { data } = await supabase
    .from("trade_connections")
    .select(
      "user_id, provider, key_id, key_id_hint, secret_sealed, portfolio_uuid, portfolio_name, mode, status, per_order_usd_cap, daily_usd_cap, last_verified_at, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as TradeConnectionRow | null) ?? null;
}

/** Opens the sealed key server-side (C18). Never returned to a caller that
 *  can reach a browser or a box — only venue code. */
export async function tradeVenueCredentials(
  connection: TradeConnectionRow,
): Promise<CoinbaseCredentials | null> {
  const vaultKey = env.providerVaultKey();
  if (!vaultKey || !connection.secret_sealed || !connection.key_id) return null;
  let keySecret: string;
  try {
    keySecret = openSecret(connection.secret_sealed, vaultKey);
  } catch {
    return null;
  }
  return {
    keyId: connection.key_id,
    keySecret,
    portfolioUuid: connection.portfolio_uuid,
  };
}
