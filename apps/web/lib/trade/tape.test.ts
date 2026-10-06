// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

vi.mock("./service", async (importOriginal) => {
  const original = await importOriginal<typeof import("./service")>();
  return {
    ...original,
    venueFor: vi.fn(),
    previewTrade: vi.fn(),
    proposeTrade: vi.fn(),
    getTradeConnection: vi.fn(async () => null),
    portfolioView: vi.fn(),
  };
});
vi.mock("./coinbase", async (importOriginal) => {
  const original = await importOriginal<typeof import("./coinbase")>();
  return {
    ...original,
    coinbasePublicPrice: vi.fn(async () => "100"),
    coinbasePublicCandles: vi.fn(async () => []),
    coinbasePublicChangePct: vi.fn(async () => null),
  };
});
vi.mock("./paper", () => ({
  paperPortfolio: vi.fn(async () => ({
    doc: {
      version: 1,
      cashUsd: 9975,
      positions: { BTC: { qty: 0.25, avgCost: 100 } },
      ledger: [],
    },
    totalUsd: 10000,
  })),
}));
vi.mock("./state", async (importOriginal) => {
  const original = await importOriginal<typeof import("./state")>();
  return {
    ...original,
    readTradeDoc: vi.fn(async (_s: unknown, _u: unknown, _r: string, fb: unknown) => fb),
    mutateTradeDoc: vi.fn(async (_s: unknown, _u: unknown, _r: string, fb: unknown, m: (d: unknown) => unknown) => m(fb)),
  };
});
vi.mock("./watch", () => ({ listWatches: vi.fn(async () => []) }));

import { venueFor, previewTrade, proposeTrade } from "./service";
import { baseAsset, tapeIntent, pendingTapeCard } from "./tape";
import { TradeError } from "./order";

const USER = "user-1";

function fakeVenue(balances: { asset: string; available: string }[]) {
  return {
    balances: vi.fn(async () => balances.map((b) => ({ ...b, hold: "0" }))),
  };
}

function setupVenue(balances: { asset: string; available: string }[]) {
  vi.mocked(venueFor).mockResolvedValue({
    venue: fakeVenue(balances),
    mode: "paper",
    connection: null,
  } as never);
}

describe("baseAsset", () => {
  it("splits the USD quote", () => {
    expect(baseAsset("BTC-USD")).toBe("BTC");
    expect(baseAsset("sol-usd".toUpperCase())).toBe("SOL");
  });
});

describe("tapeIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(previewTrade).mockResolvedValue({
      order: {},
      previewToken: "tok",
    } as never);
    vi.mocked(proposeTrade).mockResolvedValue({
      tradeOrderId: "o1",
      decisionId: "d1",
      summary: "Buy",
      expiresAt: "",
    } as never);
  });

  it("UP maps to a market BUY sized in quote dollars", async () => {
    const db = new FakeSupabase();
    db.rows("trade_orders").push({
      id: "o1",
      user_id: USER,
      mode: "paper",
      product_id: "BTC-USD",
      side: "BUY",
      order_type: "market",
      quote_size: "25",
      decision_id: "dec-1",
      preview: { estimated: {} },
      preview_expires_at: "2099-01-01T00:00:00.000Z",
      state: "pending_approval",
      created_at: "2026-10-05T00:00:00.000Z",
    });
    setupVenue([{ asset: "USD", available: "10000" }]);
    await tapeIntent(db.client(), USER, {
      product: "BTC-USD",
      side: "up",
      stake: "25",
    });
    expect(vi.mocked(previewTrade).mock.calls[0]![2]).toMatchObject({
      productId: "BTC-USD",
      side: "BUY",
      type: "market",
      quoteSize: "25.00",
    });
  });

  it("DOWN maps to a market SELL capped at the held quantity — never a short", async () => {
    const db = new FakeSupabase();
    db.rows("trade_orders").push({
      id: "o1",
      user_id: USER,
      mode: "paper",
      product_id: "BTC-USD",
      side: "BUY",
      order_type: "market",
      quote_size: "25",
      decision_id: "dec-1",
      preview: { estimated: {} },
      preview_expires_at: "2099-01-01T00:00:00.000Z",
      state: "pending_approval",
      created_at: "2026-10-05T00:00:00.000Z",
    });
    setupVenue([
      { asset: "USD", available: "9000" },
      { asset: "BTC", available: "0.1" }, // $10 at price 100
    ]);
    await tapeIntent(db.client(), USER, {
      product: "BTC-USD",
      side: "down",
      stake: "25",
    });
    const order = vi.mocked(previewTrade).mock.calls[0]![2] as Record<string, unknown>;
    expect(order["side"]).toBe("SELL");
    expect(order["type"]).toBe("market");
    expect(Number(order["baseSize"])).toBeLessThanOrEqual(0.1);
    expect(Number(order["baseSize"])).toBeCloseTo(0.1, 6); // capped at held
  });

  it("DOWN when flat refuses — down never shorts", async () => {
    const db = new FakeSupabase();
    setupVenue([{ asset: "USD", available: "10000" }]);
    await expect(
      tapeIntent(db.client(), USER, {
        product: "BTC-USD",
        side: "down",
        stake: "25",
      }),
    ).rejects.toMatchObject({ code: "flat" });
    expect(previewTrade).not.toHaveBeenCalled();
  });

  it("returns the standing approval instead of erroring on T3", async () => {
    const db = new FakeSupabase();
    db.rows("trade_orders").push(
      {
        id: "o1",
        user_id: USER,
        mode: "paper",
        product_id: "BTC-USD",
        side: "BUY",
        order_type: "market",
        quote_size: "25",
        decision_id: "dec-1",
        preview: { estimated: { estimatedPrice: "100", estimatedFill: "0.25", fee: "0.15", total: "25.15", currency: "USD" } },
        preview_expires_at: "2099-01-01T00:00:00.000Z",
        state: "pending_approval",
        created_at: "2026-10-05T00:00:00.000Z",
      },
    );
    setupVenue([{ asset: "USD", available: "10000" }]);
    vi.mocked(proposeTrade).mockRejectedValue(
      new TradeError("already pending", 409, "approval_pending"),
    );
    const result = await tapeIntent(db.client(), USER, {
      product: "BTC-USD",
      side: "up",
      stake: "10",
    });
    expect(result.pending.decisionId).toBe("dec-1");
    expect(result.pending.est.total).toBe("25.15");
  });
});

describe("pendingTapeCard", () => {
  it("maps the pending trade_orders row into a card", async () => {
    const db = new FakeSupabase();
    db.rows("trade_orders").push(
      {
        id: "o9",
        user_id: USER,
        mode: "paper",
        product_id: "ETH-USD",
        side: "SELL",
        order_type: "market",
        base_size: "0.5",
        decision_id: "dec-9",
        preview: { estimated: { estimatedPrice: "3000" } },
        preview_expires_at: null,
        state: "pending_approval",
        created_at: "2026-10-05T00:00:00.000Z",
      },
      {
        id: "o2",
        user_id: "someone-else",
        mode: "paper",
        product_id: "BTC-USD",
        side: "BUY",
        order_type: "market",
        quote_size: "10",
        decision_id: "dec-other",
        preview: {},
        state: "pending_approval",
        created_at: "2026-10-05T00:00:00.000Z",
      },
    );
    const card = await pendingTapeCard(db.client(), USER);
    expect(card?.decisionId).toBe("dec-9");
    expect(card?.label).toContain("Sell");
    expect(card?.est.price).toBe("3000");
  });

  it("is null when nothing is pending", async () => {
    const db = new FakeSupabase();
    expect(await pendingTapeCard(db.client(), USER)).toBeNull();
  });
});
