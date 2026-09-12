import { describe, expect, it, vi } from "vitest";

vi.stubEnv("TRADE_PREVIEW_SIGNING_KEY", "test-signing-key");
import {
  canonicalOrder,
  clientOrderIdForPreview,
  createPreviewToken,
  orderSummary,
  tradeOrderSchema,
  verifyPreviewToken,
  TradeError,
} from "./order";

const USER = "11111111-2222-4333-8444-555555555555";

const marketBuy = {
  productId: "BTC-USD",
  side: "BUY",
  type: "market",
  quoteSize: "50",
} as const;

describe("tradeOrderSchema", () => {
  it("accepts a market buy sized in quote dollars", () => {
    const parsed = tradeOrderSchema.parse(marketBuy);
    expect(parsed.productId).toBe("BTC-USD");
    expect(parsed.quoteSize).toBe("50");
  });

  it("rejects bad shapes", () => {
    // Market buy in base units — must be quoteSize.
    expect(() =>
      tradeOrderSchema.parse({ ...marketBuy, quoteSize: undefined, baseSize: "0.001" }),
    ).toThrow();
    // Both size fields.
    expect(() =>
      tradeOrderSchema.parse({ ...marketBuy, baseSize: "1" }),
    ).toThrow();
    // Limit without a price.
    expect(() =>
      tradeOrderSchema.parse({
        productId: "ETH-USD",
        side: "SELL",
        type: "limit",
        baseSize: "1",
      }),
    ).toThrow();
    // Unknown keys are strict-rejected.
    expect(() =>
      tradeOrderSchema.parse({ ...marketBuy, leverage: "10" }),
    ).toThrow();
    // Junk product id.
    expect(() =>
      tradeOrderSchema.parse({ ...marketBuy, productId: "bitcoin" }),
    ).toThrow();
  });

  it("accepts a well-formed stop-limit sell", () => {
    const parsed = tradeOrderSchema.parse({
      productId: "SOL-USD",
      side: "SELL",
      type: "stop_limit",
      baseSize: "2",
      limitPrice: "140",
      stopPrice: "150",
      stopDirection: "down",
    });
    expect(parsed.stopDirection).toBe("down");
  });
});

describe("preview token (T2)", () => {
  it("round-trips the exact order", () => {
    const order = tradeOrderSchema.parse(marketBuy);
    const { token } = createPreviewToken(order, USER);
    expect(() => verifyPreviewToken(token, order, USER)).not.toThrow();
  });

  it("rejects a changed order (order_changed)", () => {
    const order = tradeOrderSchema.parse(marketBuy);
    const { token } = createPreviewToken(order, USER);
    const tampered = tradeOrderSchema.parse({ ...marketBuy, quoteSize: "51" });
    try {
      verifyPreviewToken(token, tampered, USER);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(TradeError);
      expect((error as TradeError).code).toBe("order_changed");
    }
  });

  it("rejects the wrong principal", () => {
    const order = tradeOrderSchema.parse(marketBuy);
    const { token } = createPreviewToken(order, USER);
    try {
      verifyPreviewToken(token, order, "99999999-9999-4999-8999-999999999999");
      expect.unreachable();
    } catch (error) {
      expect((error as TradeError).code).toBe("wrong_principal");
    }
  });

  it("rejects a mangled signature", () => {
    const order = tradeOrderSchema.parse(marketBuy);
    const { token } = createPreviewToken(order, USER);
    const bad = `${token.slice(0, -4)}AAAA`;
    try {
      verifyPreviewToken(bad, order, USER);
      expect.unreachable();
    } catch (error) {
      expect((error as TradeError).code).toBe("bad_token");
    }
  });
});

describe("clientOrderIdForPreview (T5)", () => {
  it("is deterministic per token and UUID-shaped", () => {
    const order = tradeOrderSchema.parse(marketBuy);
    const { token } = createPreviewToken(order, USER);
    const a = clientOrderIdForPreview(token);
    const b = clientOrderIdForPreview(token);
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("orderSummary", () => {
  it("renders the canonical one-liner", () => {
    expect(orderSummary(tradeOrderSchema.parse(marketBuy))).toBe(
      "Buy 50 USD of BTC",
    );
    expect(
      orderSummary(
        tradeOrderSchema.parse({
          productId: "ETH-USD",
          side: "SELL",
          type: "market",
          baseSize: "0.5",
        }),
      ),
    ).toBe("Sell 0.5 ETH");
    expect(
      orderSummary(
        tradeOrderSchema.parse({
          productId: "SOL-USD",
          side: "BUY",
          type: "limit",
          baseSize: "10",
          limitPrice: "120",
        }),
      ),
    ).toBe("Buy 10 SOL @ 120 USD limit");
  });
});

describe("canonicalOrder", () => {
  it("strips absent optional fields so equality is exact", () => {
    const order = tradeOrderSchema.parse(marketBuy);
    expect(Object.keys(canonicalOrder(order)).sort()).toEqual([
      "productId",
      "quoteSize",
      "side",
      "type",
    ]);
  });
});
