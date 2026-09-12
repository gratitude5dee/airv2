/**
 * Canonical order schema + preview-token discipline (docs/trade/plan.md §6.3,
 * T2/T5), ported from Adaam's agent/lib/coinbase-order.ts and rebound to the
 * owner: the principal hash is sha256 over the user's id, and the HMAC key is
 * TRADE_PREVIEW_SIGNING_KEY (defaulting to MINIAPP_SIGNING_KEY) — a dedicated
 * control-plane secret, never the user's Coinbase credential, so rotating an
 * API key can never silently invalidate a pending preview.
 */
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { env } from "../env";

const decimalSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/u, "Use a positive decimal string.")
  .refine(
    (value) => Number.isFinite(Number(value)) && Number(value) > 0,
    "Amount must be a finite number greater than zero.",
  );

const productIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9]{1,20}-[A-Z0-9]{1,20}$/u,
    "Use a product such as BTC-USD or ETH-USDC.",
  );

const orderShape = {
  baseSize: decimalSchema.optional(),
  limitPrice: decimalSchema.optional(),
  productId: productIdSchema,
  quoteSize: decimalSchema.optional(),
  side: z.enum(["BUY", "SELL"]),
  stopDirection: z.enum(["up", "down"]).optional(),
  stopPrice: decimalSchema.optional(),
  type: z.enum(["market", "limit", "stop_limit"]),
} as const;

type OrderShapeValue = z.infer<z.ZodObject<typeof orderShape>>;

function validateOrder(value: OrderShapeValue, ctx: z.RefinementCtx): void {
  if (value.baseSize && value.quoteSize) {
    ctx.addIssue({
      code: "custom",
      message: "Use exactly one size field.",
      path: ["quoteSize"],
    });
  }

  if (value.type === "market") {
    if (value.side === "BUY" && (!value.quoteSize || value.baseSize)) {
      ctx.addIssue({
        code: "custom",
        message:
          "A market BUY requires quoteSize and must not include baseSize.",
        path: ["quoteSize"],
      });
    }
    if (value.side === "SELL" && (!value.baseSize || value.quoteSize)) {
      ctx.addIssue({
        code: "custom",
        message:
          "A market SELL requires baseSize and must not include quoteSize.",
        path: ["baseSize"],
      });
    }
    if (value.limitPrice || value.stopPrice || value.stopDirection) {
      ctx.addIssue({
        code: "custom",
        message: "Market orders cannot include limit or stop fields.",
        path: ["type"],
      });
    }
    return;
  }

  if (!value.baseSize || value.quoteSize) {
    ctx.addIssue({
      code: "custom",
      message: "Limit and stop-limit orders require baseSize only.",
      path: ["baseSize"],
    });
  }
  if (!value.limitPrice) {
    ctx.addIssue({
      code: "custom",
      message: "Limit and stop-limit orders require limitPrice.",
      path: ["limitPrice"],
    });
  }

  if (value.type === "stop_limit") {
    if (!value.stopPrice) {
      ctx.addIssue({
        code: "custom",
        message: "A stop-limit order requires stopPrice.",
        path: ["stopPrice"],
      });
    }
    if (!value.stopDirection) {
      ctx.addIssue({
        code: "custom",
        message: "A stop-limit order requires stopDirection.",
        path: ["stopDirection"],
      });
    }
  } else if (value.stopPrice || value.stopDirection) {
    ctx.addIssue({
      code: "custom",
      message: "A limit order cannot include stop fields.",
      path: ["type"],
    });
  }
}

export const tradeOrderSchema = z
  .object(orderShape)
  .strict()
  .superRefine(validateOrder) as z.ZodType<TradeOrder>;

export interface TradeOrder {
  productId: string;
  side: "BUY" | "SELL";
  type: "market" | "limit" | "stop_limit";
  baseSize?: string | undefined;
  quoteSize?: string | undefined;
  limitPrice?: string | undefined;
  stopPrice?: string | undefined;
  stopDirection?: "up" | "down" | undefined;
}

export const PREVIEW_TOKEN_TTL_MS = 5 * 60_000;

interface PreviewPayload {
  expiresAtMs: number;
  nonce: string;
  order: TradeOrder;
  principalHash: string;
  version: 1;
}

const previewPayloadSchema = z.object({
  expiresAtMs: z.number().int().positive(),
  nonce: z.string().uuid(),
  order: tradeOrderSchema,
  principalHash: z.string().regex(/^[a-f0-9]{64}$/u),
  version: z.literal(1),
});

export function canonicalOrder(order: TradeOrder): TradeOrder {
  return {
    productId: order.productId,
    side: order.side,
    type: order.type,
    ...(order.quoteSize ? { quoteSize: order.quoteSize } : {}),
    ...(order.baseSize ? { baseSize: order.baseSize } : {}),
    ...(order.limitPrice ? { limitPrice: order.limitPrice } : {}),
    ...(order.stopPrice ? { stopPrice: order.stopPrice } : {}),
    ...(order.stopDirection ? { stopDirection: order.stopDirection } : {}),
  };
}

function sign(encoded: string): Buffer {
  return createHmac("sha256", env.tradePreviewSigningKey())
    .update("air-trade-order-preview")
    .update(encoded)
    .digest();
}

function principalHash(userId: string): string {
  return createHash("sha256")
    .update("air-trade-principal")
    .update(userId)
    .digest("hex");
}

export function createPreviewToken(
  order: TradeOrder,
  userId: string,
): { expiresAt: string; token: string } {
  const expiresAtMs = Date.now() + PREVIEW_TOKEN_TTL_MS;
  const payload: PreviewPayload = {
    expiresAtMs,
    nonce: randomUUID(),
    order: canonicalOrder(order),
    principalHash: principalHash(userId),
    version: 1,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded).toString("base64url");
  return {
    expiresAt: new Date(expiresAtMs).toISOString(),
    token: `${encoded}.${signature}`,
  };
}

export function verifyPreviewToken(
  token: string,
  order: TradeOrder,
  userId: string,
): void {
  const [encoded, suppliedSignature, ...extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra.length > 0) {
    throw new TradeError("The order preview token is malformed.", 400, "bad_token");
  }

  const expectedSignature = sign(encoded);
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (
    supplied.length !== expectedSignature.length ||
    !timingSafeEqual(supplied, expectedSignature)
  ) {
    throw new TradeError("The order preview token is invalid.", 400, "bad_token");
  }

  let payload: PreviewPayload;
  try {
    payload = previewPayloadSchema.parse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
  } catch {
    throw new TradeError("The order preview token is invalid.", 400, "bad_token");
  }

  if (payload.expiresAtMs < Date.now()) {
    throw new TradeError(
      "That preview expired. Ask again and I'll price it fresh.",
      410,
      "preview_expired",
    );
  }
  if (payload.expiresAtMs > Date.now() + 2 * PREVIEW_TOKEN_TTL_MS) {
    throw new TradeError("The order preview expiry is invalid.", 400, "bad_token");
  }
  if (payload.principalHash !== principalHash(userId)) {
    throw new TradeError(
      "The order preview belongs to a different account.",
      403,
      "wrong_principal",
    );
  }
  if (
    JSON.stringify(canonicalOrder(payload.order)) !==
    JSON.stringify(canonicalOrder(order))
  ) {
    throw new TradeError(
      "The order changed after preview. Request a fresh preview for the exact order.",
      409,
      "order_changed",
    );
  }
}

/** T5: deterministic client_order_id — same preview token, same id, so a
 *  resolver retry can never create a second order at the venue. */
export function clientOrderIdForPreview(token: string): string {
  const bytes = createHash("sha256")
    .update("air-trade-order")
    .update(token)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export class TradeError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 400, code = "trade_error") {
    super(message);
    this.name = "TradeError";
    this.status = status;
    this.code = code;
  }
}

/** The one-line receipt the approval card and the agent both show (T2:
 *  every card renders from the canonical order, never from free text). */
export function orderSummary(order: TradeOrder): string {
  const product = order.productId;
  const base = product.split("-")[0] ?? product;
  const quote = product.split("-")[1] ?? "";
  if (order.type === "market") {
    return order.side === "BUY"
      ? `Buy ${order.quoteSize} ${quote} of ${base}`
      : `Sell ${order.baseSize} ${base}`;
  }
  const side = order.side === "BUY" ? "Buy" : "Sell";
  if (order.type === "limit") {
    return `${side} ${order.baseSize} ${base} @ ${order.limitPrice} ${quote} limit`;
  }
  const dir = order.stopDirection === "up" ? "above" : "below";
  return `${side} ${order.baseSize} ${base} @ ${order.limitPrice} ${quote} limit, stop ${dir} ${order.stopPrice}`;
}
