/**
 * MA8 acceptance + red-team: money amounts are server-derived (order
 * tampering can't move money), charges land only on the merchant's connected
 * account (no-custody by construction), fulfillment is replay-safe,
 * tickets check in exactly once, receipts need the buyer key, the catalog
 * only projects public data and only via an owner-approved decision, and
 * payment requests expire + confirm by webhook.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

/* ------------------------------------------------------- stripe mock */

const connectCalls: { account: string; params: Record<string, unknown> }[] = [];
let connectSessionError: Error | null = null;
let accountAccessible = true;
let createdAccounts = 0;

vi.mock("@/lib/payments/stripe", () => ({
  createConnectAccount: async () => `acct_test_merchant_${++createdAccounts}`,
  createAccountLink: async () => "https://connect.stripe.com/setup/test",
  connectAccountAccessible: async () => accountAccessible,
  isAccountInvalidError: (error: unknown) =>
    (error as { code?: string } | null)?.code === "account_invalid",
  createConnectCheckoutSession: async (
    account: string,
    params: Record<string, unknown>
  ) => {
    if (connectSessionError) throw connectSessionError;
    connectCalls.push({ account, params });
    return {
      id: `cs_test_${connectCalls.length}`,
      url: "https://checkout.stripe.com/c/pay/cs_test",
    };
  },
}));

/* ----------------------------------------------------- box-state mock */

let boxCatalog: unknown = { items: [] };

vi.mock("@/lib/miniapps/store", () => ({
  readAppState: async () => boxCatalog,
}));

/* -------------------------------------------------- wallet-lane mock */

const transferCalls: { to: string; amount: string }[] = [];

vi.mock("@/lib/wallet/send", () => ({
  validateSendAddress: (address: string) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
      throw new Error("invalid address");
    }
    return address.trim();
  },
  createTransferRequest: async (
    _supabase: unknown,
    _userId: string,
    to: string,
    amount: string
  ) => {
    transferCalls.push({ to, amount });
    return { transferId: "transfer-1", decisionId: "decision-wallet-1" };
  },
}));

/* ------------------------------------------------- in-memory supabase */

type Row = Record<string, unknown>;

interface Tables {
  users: Row[];
  merchants: Row[];
  storefront_products: Row[];
  orders: Row[];
  payment_requests: Row[];
  decisions: Row[];
  storefront_events: Row[];
  ad_accounts: Row[];
  ad_conversions: Row[];
  mini_apps: Row[];
}

let tables: Tables;
let nextId = 0;

/** Indexed row access under noUncheckedIndexedAccess. */
function at(rows: Row[], index = 0): Row {
  const row = rows[index];
  if (!row) throw new Error(`missing row ${index}`);
  return row;
}

/** Column defaults the real schema supplies (0042_ma8_commerce.sql). */
const COLUMN_DEFAULTS: Record<string, () => Row> = {
  orders: () => ({
    status: "pending",
    ticket_code: null,
    checked_in_at: null,
    created_at: new Date().toISOString(),
  }),
  payment_requests: () => ({
    status: "pending",
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  }),
  decisions: () => ({ status: "pending" }),
};

function makeSupabase(): SupabaseClient {
  function builder(table: string) {
    const filters: ((row: Row) => boolean)[] = [];
    let patch: Row | null = null;
    let inserted: Row[] | null = null;
    const store = tables as unknown as Record<string, Row[]>;
    const rows = () => (store[table] ??= []);
    const matches = () => rows().filter((row) => filters.every((f) => f(row)));
    const apply = () => {
      if (inserted) {
        for (const row of inserted) {
          rows().push({
            id: `${table}-${++nextId}`,
            ...(COLUMN_DEFAULTS[table]?.() ?? {}),
            ...row,
          });
        }
        return rows().slice(rows().length - inserted.length);
      }
      if (patch) {
        const hit = matches();
        for (const row of hit) Object.assign(row, patch);
        return hit;
      }
      return matches();
    };
    const chain = {
      select: () => chain,
      insert(row: Row | Row[]) {
        inserted = Array.isArray(row) ? row : [row];
        return chain;
      },
      update(values: Row) {
        patch = values;
        return chain;
      },
      upsert(row: Row, options?: { onConflict?: string }) {
        const keys = (options?.onConflict ?? "id").split(",");
        const existing = rows().find((r) => keys.every((k) => r[k] === row[k]));
        if (existing) Object.assign(existing, row);
        else rows().push({ id: `${table}-${++nextId}`, ...row });
        return {
          then(resolve: (result: { error: null }) => void) {
            resolve({ error: null });
          },
        };
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return chain;
      },
      not(column: string, _op: string, value: string) {
        const list = value.replace(/^\(|\)$/g, "").split(",");
        filters.push((row) => !list.includes(String(row[column])));
        return chain;
      },
      is(column: string, value: unknown) {
        filters.push((row) => (row[column] ?? null) === value);
        return chain;
      },
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return chain;
      },
      gte(column: string, value: string) {
        filters.push((row) => String(row[column]) >= value);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      async maybeSingle() {
        return { data: apply()[0] ?? null, error: null };
      },
      async single() {
        const hit = apply();
        return hit.length === 1
          ? { data: hit[0], error: null }
          : { data: null, error: { message: "not exactly one row" } };
      },
      then(resolve: (result: { data: Row[]; error: null }) => void) {
        resolve({ data: apply(), error: null });
      },
    };
    return chain;
  }
  return { from: builder } as unknown as SupabaseClient;
}

import {
  checkInTicket,
  fulfillCheckoutSession,
  hashKey,
  orderForReceipt,
  parseOrder,
  sanitizeRef,
  startCheckout,
} from "./checkout";
import {
  applyCatalogPublish,
  parseStorefrontProduct,
  requestCatalogPublish,
  sanitizeCatalogItem,
} from "./catalog";
import {
  approvePaymentRequest,
  createPaymentRequest,
  markPaymentRequestPaid,
  markPaymentRequestPaidByIntent,
} from "./paymentRequests";
import { startOnboarding, syncAccountFromEvent } from "./merchants";

const MERCHANT = "user-merchant";

function seed(): void {
  nextId = 0;
  connectCalls.length = 0;
  connectSessionError = null;
  accountAccessible = true;
  createdAccounts = 0;
  transferCalls.length = 0;
  boxCatalog = { items: [] };
  tables = {
    users: [
      { id: MERCHANT, username: "casey" },
      { id: "user-payer", username: "payer" },
    ],
    merchants: [
      {
        user_id: MERCHANT,
        stripe_account_id: "acct_casey",
        charges_enabled: true,
        details_submitted: true,
      },
    ],
    storefront_products: [
      {
        id: "prod-tee",
        user_id: MERCHANT,
        product_key: "tee",
        kind: "physical",
        name: "Tour Tee",
        description: "soft",
        image_url: null,
        price_cents: 2500,
        inventory: 3,
        active: true,
        published_at: "2026-08-01T00:00:00Z",
      },
      {
        id: "prod-show",
        user_id: MERCHANT,
        product_key: "show",
        kind: "event_ticket",
        name: "Living Room Show",
        description: "one night",
        image_url: null,
        price_cents: 4000,
        inventory: 10,
        active: true,
        published_at: "2026-08-01T00:00:00Z",
      },
    ],
    orders: [],
    payment_requests: [],
    decisions: [],
    storefront_events: [],
    ad_accounts: [],
    ad_conversions: [],
    mini_apps: [],
  };
}

beforeEach(seed);

describe("selected-row parsers", () => {
  it("rejects malformed order and product rows", () => {
    expect(parseOrder({ id: "order-1", status: "active" })).toBeNull();
    expect(
      parseOrder({
        id: "order-1",
        user_id: "user-1",
        product_id: "product-1",
        quantity: 1,
        amount_cents: 100,
        status: "pending",
        stripe_session_id: null,
        stripe_payment_intent_id: null,
        buyer_key_hash: "hash",
        attribution: null,
        ticket_code: null,
        checked_in_at: null,
        created_at: null,
      })
    ).toBeNull();
    expect(
      parseStorefrontProduct({
        id: "prod-1",
        user_id: MERCHANT,
        product_key: "tee",
        kind: "unknown",
      })
    ).toBeNull();
  });
});

function completedSession(sessionId: string): Stripe.Checkout.Session {
  return {
    id: sessionId,
    payment_intent: "pi_test_1",
  } as unknown as Stripe.Checkout.Session;
}

describe("checkout: server-derived money (order tampering)", () => {
  it("derives the total from the product row — the client never sends a price", async () => {
    const supabase = makeSupabase();
    const start = await startCheckout(
      supabase,
      MERCHANT,
      "tee",
      "2",
      null,
      "https://mini.wzrd.tech/casey-shop"
    );
    const order = at(tables.orders, 0);
    expect(order["amount_cents"]).toBe(5000); // 2 × 2500, from the row
    expect(order["status"]).toBe("pending");
    expect(start.checkoutUrl).toContain("checkout.stripe.com");
    // Stripe multiplies unit_amount × quantity: the session gets the
    // per-item price so the charge equals the recorded order total.
    expect(connectCalls[0]?.params["amountCents"]).toBe(2500);
    expect(connectCalls[0]?.params["quantity"]).toBe(2);
  });

  it("releases the order and fails gracefully when Stripe is unavailable", async () => {
    const supabase = makeSupabase();
    connectSessionError = new Error("Missing required env var: STRIPE_SECRET_KEY");
    await expect(
      startCheckout(supabase, MERCHANT, "tee", "1", null, "https://x")
    ).rejects.toMatchObject({ status: 502 });
    // No orphan pending row: the order is released back to expired.
    expect(at(tables.orders, 0)["status"]).toBe("expired");
  });

  it("rejects tampered quantities and unknown products", async () => {
    const supabase = makeSupabase();
    await expect(
      startCheckout(supabase, MERCHANT, "tee", "999", null, "https://x")
    ).rejects.toThrow(/quantity/);
    await expect(
      startCheckout(supabase, MERCHANT, "tee", "-1", null, "https://x")
    ).rejects.toThrow(/quantity/);
    await expect(
      startCheckout(supabase, MERCHANT, "tee", "1.5", null, "https://x")
    ).rejects.toThrow(/quantity/);
    await expect(
      startCheckout(supabase, MERCHANT, "not-a-product", "1", null, "https://x")
    ).rejects.toThrow(/not found/);
    expect(tables.orders).toHaveLength(0);
  });

  it("enforces inventory server-side", async () => {
    const supabase = makeSupabase();
    await expect(
      startCheckout(supabase, MERCHANT, "tee", "5", null, "https://x")
    ).rejects.toThrow(/inventory/);
  });

  it("refuses checkout when the merchant cannot take charges", async () => {
    at(tables.merchants, 0)["charges_enabled"] = false;
    const supabase = makeSupabase();
    await expect(
      startCheckout(supabase, MERCHANT, "tee", "1", null, "https://x")
    ).rejects.toThrow(/not accepting payments/);
  });
});

describe("no custody by construction", () => {
  it("creates the charge on the merchant's connected account", async () => {
    const supabase = makeSupabase();
    await startCheckout(supabase, MERCHANT, "tee", "1", null, "https://x");
    expect(connectCalls[0]?.account).toBe("acct_casey");
  });

  it("payment requests also charge the payee's own account", async () => {
    const supabase = makeSupabase();
    const { requestId } = await createPaymentRequest(supabase, "user-payer", {
      currency: "usd",
      amount: 1250,
      payee: "casey",
      memo: "session fee",
    });
    const result = await approvePaymentRequest(
      supabase,
      "user-payer",
      requestId,
      "https://airv2.vercel.app/home"
    );
    expect(result.checkoutUrl).toContain("checkout.stripe.com");
    expect(connectCalls[0]?.account).toBe("acct_casey");
  });
});

describe("fulfillment: webhook-only, replay-safe", () => {
  it("flips pending → paid exactly once and decrements inventory", async () => {
    const supabase = makeSupabase();
    await startCheckout(supabase, MERCHANT, "tee", "2", "cr-1", "https://x");
    const sessionId = at(tables.orders, 0)["stripe_session_id"] as string;
    expect(await fulfillCheckoutSession(supabase, completedSession(sessionId))).toBe(true);
    expect(at(tables.orders, 0)["status"]).toBe("paid");
    expect(at(tables.storefront_products, 0)["inventory"]).toBe(1);
    // Replay: the conditional flip refuses a second effect.
    expect(await fulfillCheckoutSession(supabase, completedSession(sessionId))).toBe(false);
    expect(at(tables.storefront_products, 0)["inventory"]).toBe(1);
  });

  it("mints a ticket for event tickets, none for physical goods", async () => {
    const supabase = makeSupabase();
    await startCheckout(supabase, MERCHANT, "show", "1", null, "https://x");
    await fulfillCheckoutSession(
      supabase,
      completedSession(at(tables.orders, 0)["stripe_session_id"] as string)
    );
    expect(at(tables.orders, 0)["ticket_code"]).toBeTruthy();

    await startCheckout(supabase, MERCHANT, "tee", "1", null, "https://x");
    await fulfillCheckoutSession(
      supabase,
      completedSession(at(tables.orders, 1)["stripe_session_id"] as string)
    );
    expect(at(tables.orders, 1)["ticket_code"] ?? null).toBeNull();
  });

  it("an unknown session fulfills nothing", async () => {
    const supabase = makeSupabase();
    expect(
      await fulfillCheckoutSession(supabase, completedSession("cs_forged"))
    ).toBe(false);
    expect(tables.orders).toHaveLength(0);
  });
});

describe("receipts and tickets", () => {
  it("the receipt requires the buyer key — order id alone is not enough", async () => {
    const supabase = makeSupabase();
    const start = await startCheckout(supabase, MERCHANT, "tee", "1", null, "https://x");
    expect(await orderForReceipt(supabase, start.orderId, "wrong-key")).toBeNull();
    const order = await orderForReceipt(supabase, start.orderId, start.buyerKey);
    expect(order?.id).toBe(start.orderId);
    // Only the hash is stored.
    expect(at(tables.orders, 0)["buyer_key_hash"]).toBe(hashKey(start.buyerKey));
    expect(JSON.stringify(at(tables.orders, 0))).not.toContain(start.buyerKey);
  });

  it("a ticket checks in exactly once, and only for its merchant", async () => {
    const supabase = makeSupabase();
    await startCheckout(supabase, MERCHANT, "show", "1", null, "https://x");
    await fulfillCheckoutSession(
      supabase,
      completedSession(at(tables.orders, 0)["stripe_session_id"] as string)
    );
    const code = at(tables.orders, 0)["ticket_code"] as string;
    expect((await checkInTicket(supabase, "user-payer", code)).ok).toBe(false);
    expect((await checkInTicket(supabase, MERCHANT, code)).ok).toBe(true);
    expect((await checkInTicket(supabase, MERCHANT, code)).ok).toBe(false);
    expect((await checkInTicket(supabase, MERCHANT, "forged-code")).ok).toBe(false);
  });
});

describe("catalog: owner-approved projection of public data only", () => {
  it("staging files a decision without projecting anything", async () => {
    boxCatalog = {
      items: [
        { key: "zine", kind: "digital", name: "Zine", priceCents: 800 },
      ],
    };
    const supabase = makeSupabase();
    const first = await requestCatalogPublish(supabase, MERCHANT);
    expect(first.staged).toBe(true);
    expect(at(tables.decisions, 0)["kind"]).toBe("shop_publish");
    expect(at(tables.decisions, 0)["status"] ?? "pending").toBe("pending");
    // Restaging reuses the pending decision instead of piling up.
    const second = await requestCatalogPublish(supabase, MERCHANT);
    expect(second.staged).toBe(false);
    expect(tables.decisions).toHaveLength(1);
    // Nothing projected yet.
    expect(
      tables.storefront_products.find((p) => p["product_key"] === "zine")
    ).toBeUndefined();
  });

  it("approval projects sanitized items and deactivates removed ones", async () => {
    boxCatalog = {
      items: [
        { key: "zine", kind: "digital", name: "Zine", priceCents: 800 },
        { key: "bad", kind: "digital", name: "Bad", priceCents: -5 }, // rejected
        {
          key: "leaky",
          kind: "digital",
          name: "Leaky",
          priceCents: 100,
          imageUrl: "https://evil.example/tracking.png", // non-R2: dropped
        },
      ],
    };
    const supabase = makeSupabase();
    const published = await applyCatalogPublish(supabase, MERCHANT);
    expect(published).toBe(2);
    const zine = tables.storefront_products.find((p) => p["product_key"] === "zine");
    expect(zine?.["price_cents"]).toBe(800);
    const leaky = tables.storefront_products.find((p) => p["product_key"] === "leaky");
    expect(leaky?.["image_url"] ?? null).toBeNull();
    // The previously published rows not in the catalog are deactivated.
    expect(
      tables.storefront_products.find((p) => p["product_key"] === "tee")?.["active"]
    ).toBe(false);
  });

  it("sanitizer rejects malformed entries outright", () => {
    expect(sanitizeCatalogItem(null)).toBeNull();
    expect(sanitizeCatalogItem({ key: "UPPER CASE", kind: "digital", name: "x", priceCents: 1 })).toBeNull();
    expect(sanitizeCatalogItem({ key: "ok", kind: "weapon", name: "x", priceCents: 1 })).toBeNull();
    expect(sanitizeCatalogItem({ key: "ok", kind: "digital", name: "", priceCents: 1 })).toBeNull();
    expect(sanitizeCatalogItem({ key: "ok", kind: "digital", name: "x", priceCents: 1.5 })).toBeNull();
    expect(sanitizeCatalogItem({ key: "ok", kind: "digital", name: "x", priceCents: 10 })).not.toBeNull();
  });

  it("accepts snake_case price_cents / image_url aliases; camelCase wins", () => {
    const r2 = "https://media.wzrd.tech/u/casey/media/a.png";
    const snake = sanitizeCatalogItem({
      key: "ok",
      kind: "digital",
      name: "x",
      price_cents: 700,
      image_url: r2,
    });
    expect(snake?.priceCents).toBe(700);
    expect(snake?.imageUrl).toBe(r2);
    const both = sanitizeCatalogItem({
      key: "ok",
      kind: "digital",
      name: "x",
      priceCents: 900,
      price_cents: 700,
      imageUrl: `${r2}?camel`,
      image_url: r2,
    });
    expect(both?.priceCents).toBe(900);
    expect(both?.imageUrl).toBe(`${r2}?camel`);
    // A present-but-null camelCase key still wins: clearing imageUrl must not
    // resurrect a stale image_url, and a null price must not publish.
    const cleared = sanitizeCatalogItem({
      key: "ok",
      kind: "digital",
      name: "x",
      priceCents: 900,
      imageUrl: null,
      image_url: r2,
    });
    expect(cleared?.imageUrl).toBeNull();
    expect(
      sanitizeCatalogItem({
        key: "ok",
        kind: "digital",
        name: "x",
        priceCents: null,
        price_cents: 700,
      })
    ).toBeNull();
    // The alias is subject to the same constraints as the canonical field.
    expect(
      sanitizeCatalogItem({ key: "ok", kind: "digital", name: "x", price_cents: -5 })
    ).toBeNull();
    expect(
      sanitizeCatalogItem({ key: "ok", kind: "digital", name: "x", price_cents: "700" })
    ).toBeNull();
  });
});

/* ------------------------------------------- Zap-staged listing fixture */

/**
 * The catalog entry `commerce.stage_listing` (gratitude5dee/zap) merges into
 * ~/.hermes/miniapps/shop/catalog.json in --live mode. Byte-for-byte the
 * shape the Zap writes; `source` is extra metadata the sanitizer ignores.
 */
function zapListing(overrides: Row = {}): Row {
  return {
    key: "neon-wolf-tee",
    kind: "physical",
    name: "Neon Wolf Tee",
    description: "Generated by the merch-drop Zap.",
    imageUrl: "https://media.wzrd.tech/u/casey/media/abc123-product_art.png",
    priceCents: 3500,
    inventory: 100,
    active: true,
    source: { zap: "merch-drop", runId: "run_xxx", stepId: "listing" },
    ...overrides,
  };
}

function zapTicketListing(): Row {
  return zapListing({
    key: "neon-wolf-live",
    kind: "event_ticket",
    name: "Neon Wolf Live",
    description: "Generated by the event-ticket Zap.",
    inventory: 50,
    source: { zap: "event-ticket", runId: "run_yyy", stepId: "listing" },
  });
}

function productRow(key: string): Row | undefined {
  return tables.storefront_products.find((p) => p["product_key"] === key);
}

describe("Zap-staged listings (commerce.stage_listing)", () => {
  beforeEach(() => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.wzrd.tech");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("staging never projects: one pending shop_publish decision, no product row", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    const first = await requestCatalogPublish(supabase, MERCHANT);
    expect(first.staged).toBe(true);
    expect(tables.decisions).toHaveLength(1);
    expect(at(tables.decisions, 0)["kind"]).toBe("shop_publish");
    expect(at(tables.decisions, 0)["status"]).toBe("pending");
    expect(productRow("neon-wolf-tee")).toBeUndefined();
    // A second Zap run restages into the same pending decision.
    boxCatalog = { items: [zapListing({ priceCents: 3600 })] };
    const second = await requestCatalogPublish(supabase, MERCHANT);
    expect(second.staged).toBe(false);
    expect(second.decisionId).toBe(first.decisionId);
    expect(tables.decisions).toHaveLength(1);
    expect(productRow("neon-wolf-tee")).toBeUndefined();
  });

  it("approval projects the staged listing with an R2 image and no source metadata", async () => {
    boxCatalog = { items: [zapListing(), zapTicketListing()] };
    const supabase = makeSupabase();
    expect(await applyCatalogPublish(supabase, MERCHANT)).toBe(2);
    const tee = productRow("neon-wolf-tee");
    expect(tee).toMatchObject({
      user_id: MERCHANT,
      kind: "physical",
      name: "Neon Wolf Tee",
      description: "Generated by the merch-drop Zap.",
      image_url: "https://media.wzrd.tech/u/casey/media/abc123-product_art.png",
      price_cents: 3500,
      inventory: 100,
      active: true,
    });
    expect(tee).not.toHaveProperty("source");
    expect(tee).not.toHaveProperty("priceCents");
    expect(tee).not.toHaveProperty("imageUrl");
    expect(JSON.stringify(tee)).not.toContain("run_xxx");
    const show = productRow("neon-wolf-live");
    expect(show?.["kind"]).toBe("event_ticket");
    expect(show?.["inventory"]).toBe(50);
  });

  it("approval drops a non-R2 image URL the Zap left behind", async () => {
    boxCatalog = {
      items: [
        zapListing({
          imageUrl: "https://fal.media/files/abc/product_art.png",
        }),
      ],
    };
    const supabase = makeSupabase();
    await applyCatalogPublish(supabase, MERCHANT);
    const tee = productRow("neon-wolf-tee");
    expect(tee?.["price_cents"]).toBe(3500);
    expect(tee?.["image_url"]).toBeNull();
  });

  it("prices are server-derived from the projected row", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    await requestCatalogPublish(supabase, MERCHANT);
    await applyCatalogPublish(supabase, MERCHANT);
    // startCheckout has no price parameter: the client can only name a
    // product key and a quantity.
    await startCheckout(
      supabase,
      MERCHANT,
      "neon-wolf-tee",
      "2",
      null,
      "https://mini.wzrd.tech/casey-shop"
    );
    const order = at(tables.orders, 0);
    expect(order["amount_cents"]).toBe(7000); // 2 × 3500, from the row
    expect(order["product_id"]).toBe(productRow("neon-wolf-tee")?.["id"]);
    expect(connectCalls[0]?.account).toBe("acct_casey");
    expect(connectCalls[0]?.params["amountCents"]).toBe(3500);
    expect(connectCalls[0]?.params["quantity"]).toBe(2);
  });

  it("an event_ticket Zap yields a ticket_code on fulfillment", async () => {
    boxCatalog = { items: [zapTicketListing()] };
    const supabase = makeSupabase();
    await requestCatalogPublish(supabase, MERCHANT);
    await applyCatalogPublish(supabase, MERCHANT);
    await startCheckout(supabase, MERCHANT, "neon-wolf-live", "1", null, "https://x");
    const order = at(tables.orders, 0);
    expect(order["amount_cents"]).toBe(3500);
    expect(order["ticket_code"]).toBeNull();
    expect(
      await fulfillCheckoutSession(
        supabase,
        completedSession(order["stripe_session_id"] as string)
      )
    ).toBe(true);
    expect(order["status"]).toBe("paid");
    const code = order["ticket_code"];
    expect(typeof code).toBe("string");
    expect((code as string).length).toBeGreaterThan(0);
    expect(productRow("neon-wolf-live")?.["inventory"]).toBe(49);
    expect((await checkInTicket(supabase, MERCHANT, code as string)).ok).toBe(true);
    expect((await checkInTicket(supabase, MERCHANT, code as string)).ok).toBe(false);
  });

  it("nothing charges without owner approval", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    await requestCatalogPublish(supabase, MERCHANT);
    expect(at(tables.decisions, 0)["status"]).toBe("pending");
    await expect(
      startCheckout(supabase, MERCHANT, "neon-wolf-tee", "1", null, "https://x")
    ).rejects.toThrow(/not found/);
    expect(connectCalls).toHaveLength(0);
    expect(tables.orders).toHaveLength(0);
    expect(productRow("neon-wolf-tee")).toBeUndefined();
  });
});

describe("payment requests: decision-gated, expiring, webhook-confirmed", () => {
  it("filing creates the pending request + its decision — nothing moves", async () => {
    const supabase = makeSupabase();
    await createPaymentRequest(supabase, "user-payer", {
      currency: "usd",
      amount: 500,
      payee: "casey",
    });
    expect(at(tables.payment_requests, 0)["status"]).toBe("pending");
    expect(at(tables.decisions, 0)["kind"]).toBe("payment_request");
    expect(connectCalls).toHaveLength(0);
    expect(transferCalls).toHaveLength(0);
  });

  it("rejects bad amounts and unknown or non-merchant payees", async () => {
    const supabase = makeSupabase();
    await expect(
      createPaymentRequest(supabase, "user-payer", { currency: "usd", amount: -5, payee: "casey" })
    ).rejects.toThrow(/amount/);
    await expect(
      createPaymentRequest(supabase, "user-payer", { currency: "usd", amount: 12.5, payee: "casey" })
    ).rejects.toThrow(/amount/);
    await expect(
      createPaymentRequest(supabase, "user-payer", { currency: "usd", amount: 500, payee: "nobody" })
    ).rejects.toThrow(/not found/);
    at(tables.merchants, 0)["charges_enabled"] = false;
    await expect(
      createPaymentRequest(supabase, "user-payer", { currency: "usd", amount: 500, payee: "casey" })
    ).rejects.toThrow(/not set up/);
  });

  it("an expired request refuses approval and flips to expired", async () => {
    const supabase = makeSupabase();
    const { requestId } = await createPaymentRequest(supabase, "user-payer", {
      currency: "usd",
      amount: 500,
      payee: "casey",
    });
    at(tables.payment_requests, 0)["expires_at"] = "2000-01-01T00:00:00Z";
    await expect(
      approvePaymentRequest(supabase, "user-payer", requestId, "https://x")
    ).rejects.toThrow(/expired/);
    expect(at(tables.payment_requests, 0)["status"]).toBe("expired");
    expect(connectCalls).toHaveLength(0);
  });

  it("paid is webhook-confirmed and replay-safe", async () => {
    const supabase = makeSupabase();
    const { requestId } = await createPaymentRequest(supabase, "user-payer", {
      currency: "usd",
      amount: 500,
      payee: "casey",
    });
    await approvePaymentRequest(supabase, "user-payer", requestId, "https://x");
    const sessionId = at(tables.payment_requests, 0)["stripe_session_id"] as string;
    expect(
      await markPaymentRequestPaid(supabase, completedSession(sessionId))
    ).toBe(true);
    expect(at(tables.payment_requests, 0)["status"]).toBe("paid");
    expect(
      await markPaymentRequestPaid(supabase, completedSession(sessionId))
    ).toBe(false);
  });

  it("usdc requests route into the wallet approval lane, not Stripe", async () => {
    const supabase = makeSupabase();
    const { requestId } = await createPaymentRequest(supabase, "user-payer", {
      currency: "usdc",
      amount: "12.50",
      payee: "0x1111111111111111111111111111111111111111",
    });
    const result = await approvePaymentRequest(
      supabase,
      "user-payer",
      requestId,
      "https://x"
    );
    expect(result.walletDecisionId).toBe("decision-wallet-1");
    expect(transferCalls[0]).toEqual({
      to: "0x1111111111111111111111111111111111111111",
      amount: "12.50",
    });
    expect(connectCalls).toHaveLength(0);
  });

  it("an account_invalid rejection flags the merchant and fails with 409", async () => {
    const supabase = makeSupabase();
    const { requestId } = await createPaymentRequest(supabase, "user-payer", {
      currency: "usd",
      amount: 500,
      payee: "casey",
    });
    connectSessionError = Object.assign(new Error("account invalid"), {
      code: "account_invalid",
    });
    await expect(
      approvePaymentRequest(supabase, "user-payer", requestId, "https://x")
    ).rejects.toMatchObject({ status: 409 });
    // The merchant is flagged so later requests fail fast until re-onboarded.
    expect(at(tables.merchants, 0)["charges_enabled"]).toBe(false);
  });

  it("the paid webhook resolves the decision by ref when decision_id is missing", async () => {
    const supabase = makeSupabase();
    const { requestId } = await createPaymentRequest(supabase, "user-payer", {
      currency: "usd",
      amount: 500,
      payee: "casey",
    });
    // Simulate a lost decision_id backfill.
    at(tables.payment_requests, 0)["decision_id"] = null;
    at(tables.payment_requests, 0)["stripe_payment_intent_id"] = "pi_test_1";
    expect(
      await markPaymentRequestPaidByIntent(supabase, {
        id: "pi_test_1",
        metadata: { payment_request_id: requestId },
      } as unknown as Stripe.PaymentIntent)
    ).toBe(true);
    expect(at(tables.payment_requests, 0)["status"]).toBe("paid");
    expect(at(tables.decisions, 0)["status"]).toBe("approved");
  });

  it("approving someone else's request fails", async () => {
    const supabase = makeSupabase();
    const { requestId } = await createPaymentRequest(supabase, "user-payer", {
      currency: "usd",
      amount: 500,
      payee: "casey",
    });
    await expect(
      approvePaymentRequest(supabase, MERCHANT, requestId, "https://x")
    ).rejects.toThrow(/not found/);
  });
});

describe("merchant onboarding", () => {
  it("creates the connected account once and reuses it", async () => {
    tables.merchants = [];
    const supabase = makeSupabase();
    const url1 = await startOnboarding(supabase, MERCHANT, "https://r", "https://r");
    expect(url1).toContain("connect.stripe.com");
    expect(tables.merchants).toHaveLength(1);
    await startOnboarding(supabase, MERCHANT, "https://r", "https://r");
    expect(tables.merchants).toHaveLength(1);
  });

  it("re-mints the connected account when the stored one is unreachable", async () => {
    accountAccessible = false;
    const supabase = makeSupabase();
    const url = await startOnboarding(supabase, MERCHANT, "https://r", "https://r");
    expect(url).toContain("connect.stripe.com");
    expect(tables.merchants).toHaveLength(1);
    const merchant = at(tables.merchants, 0);
    expect(merchant["stripe_account_id"]).toBe("acct_test_merchant_1");
    expect(merchant["charges_enabled"]).toBe(false);
    expect(merchant["details_submitted"]).toBe(false);
  });

  it("capability flags flow only from account.updated and provision the storefront", async () => {
    tables.merchants = [
      {
        user_id: MERCHANT,
        stripe_account_id: "acct_casey",
        charges_enabled: false,
        details_submitted: false,
      },
    ];
    const supabase = makeSupabase();
    await syncAccountFromEvent(supabase, {
      id: "acct_casey",
      charges_enabled: true,
      details_submitted: true,
    } as unknown as Stripe.Account);
    expect(at(tables.merchants, 0)["charges_enabled"]).toBe(true);
    const row = tables.mini_apps.find((app) => app["slug"] === "casey-shop");
    expect(row?.["owner_user_id"]).toBe(MERCHANT);
    // A forged account id updates nothing.
    await syncAccountFromEvent(supabase, {
      id: "acct_forged",
      charges_enabled: true,
    } as unknown as Stripe.Account);
    expect(tables.merchants).toHaveLength(1);
  });
});

describe("attribution refs", () => {
  it("sanitizes campaign refs to a safe charset", () => {
    expect(sanitizeRef("cr-1")).toBe("cr-1");
    expect(sanitizeRef("utm:launch_2026")).toBe("utm:launch_2026");
    expect(sanitizeRef("<script>")).toBeNull();
    expect(sanitizeRef("a".repeat(200))).toBeNull();
    expect(sanitizeRef(42)).toBeNull();
  });
});
