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
/** Runs before each catalog.json read (interleaving hook; may throw). */
let beforeCatalogRead: (() => void | Promise<void>) | null = null;

vi.mock("@/lib/miniapps/store", () => ({
  readAppState: async () => {
    await beforeCatalogRead?.();
    return boxCatalog;
  },
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
/** Fails the next `update` on `decisions` (simulates a lost DB write). */
let decisionUpdateError: { message: string } | null = null;
/** Runs before each `update` on `decisions` is applied (interleaving hook). */
let beforeDecisionUpdate: (() => void | Promise<void>) | null = null;
/** Runs before each `insert` on `decisions` is applied (interleaving hook). */
let beforeDecisionInsert: (() => void) | null = null;
/** Fails the next lookup on `decisions` (simulates a failed read). */
let decisionLookupError: { message: string } | null = null;

/** jsonb canonical form: key order does not matter, whitespace does not exist. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** PostgREST `eq`: a JSON-column filter value is text that Postgres casts to jsonb. */
function filterEquals(stored: unknown, wanted: unknown): boolean {
  if (stored !== null && typeof stored === "object" && typeof wanted === "string") {
    try {
      return canonicalJson(stored) === canonicalJson(JSON.parse(wanted));
    } catch {
      return false;
    }
  }
  return stored === wanted;
}

/** Partial unique indexes the real schema has (0079_one_pending_shop_publish.sql). */
function uniqueViolation(table: string, row: Row, rows: Row[]): boolean {
  if (table !== "decisions") return false;
  if (row["kind"] !== "shop_publish" || row["status"] !== "pending") return false;
  return rows.some(
    (r) =>
      r["user_id"] === row["user_id"] &&
      r["kind"] === "shop_publish" &&
      r["status"] === "pending"
  );
}

/** Column read with PostgREST JSON path support (`payload->>note`). */
function column(row: Row, path: string): unknown {
  const [head, ...keys] = path.split("->>");
  let value: unknown = head ? row[head] : undefined;
  for (const key of keys) {
    value =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)[key]
        : undefined;
  }
  return value ?? null;
}

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
    const apply = async () => {
      if (inserted) {
        if (table === "decisions") beforeDecisionInsert?.();
        const full = inserted.map((row) => ({
          id: `${table}-${++nextId}`,
          ...(COLUMN_DEFAULTS[table]?.() ?? {}),
          ...row,
        }));
        for (const row of full) {
          if (uniqueViolation(table, row, rows())) {
            throw Object.assign(new Error("duplicate key value"), {
              code: "23505",
            });
          }
          rows().push(row);
        }
        return rows().slice(rows().length - inserted.length);
      }
      if (patch) {
        if (table === "decisions") await beforeDecisionUpdate?.();
        const hit = matches();
        for (const row of hit) {
          const others = rows().filter((r) => r !== row);
          if (uniqueViolation(table, { ...row, ...patch }, others)) {
            throw Object.assign(new Error("duplicate key value"), {
              code: "23505",
            });
          }
        }
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
      eq(path: string, value: unknown) {
        filters.push((row) => filterEquals(column(row, path), value));
        return chain;
      },
      not(column: string, _op: string, value: string) {
        const list = value.replace(/^\(|\)$/g, "").split(",");
        filters.push((row) => !list.includes(String(row[column])));
        return chain;
      },
      is(path: string, value: unknown) {
        filters.push((row) => column(row, path) === value);
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
        if (table === "decisions" && decisionLookupError) {
          const error = decisionLookupError;
          decisionLookupError = null;
          return { data: null, error };
        }
        const hit = await apply();
        return hit.length > 1
          ? { data: null, error: { code: "PGRST116", message: "more than one row" } }
          : { data: hit[0] ?? null, error: null };
      },
      async single() {
        let hit: Row[];
        try {
          hit = await apply();
        } catch (error) {
          const { code, message } = error as { code?: string; message: string };
          return { data: null, error: { code, message } };
        }
        return hit.length === 1
          ? { data: hit[0], error: null }
          : { data: null, error: { message: "not exactly one row" } };
      },
      then(
        resolve: (result: {
          data: Row[] | null;
          error: { message: string } | null;
        }) => void
      ) {
        if (patch && table === "decisions" && decisionUpdateError) {
          const error = decisionUpdateError;
          decisionUpdateError = null;
          resolve({ data: null, error });
          return;
        }
        apply().then(
          (data) => resolve({ data, error: null }),
          (error) => resolve({ data: null, error: error as { message: string } })
        );
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
  approveCatalogPublish,
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
  decisionUpdateError = null;
  beforeDecisionUpdate = null;
  beforeDecisionInsert = null;
  beforeCatalogRead = null;
  decisionLookupError = null;
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

function completedSession(
  sessionId: string,
  settled?: { amountTotal?: number; currency?: string }
): Stripe.Checkout.Session {
  return {
    id: sessionId,
    payment_intent: "pi_test_1",
    ...(settled?.amountTotal !== undefined ? { amount_total: settled.amountTotal } : {}),
    ...(settled?.currency !== undefined ? { currency: settled.currency } : {}),
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

  it("keys the Stripe session create on the order id so a retry cannot mint a second session", async () => {
    const supabase = makeSupabase();
    const start = await startCheckout(supabase, MERCHANT, "tee", "1", null, "https://x");
    expect(connectCalls[0]?.params["idempotencyKey"]).toBe(`checkout-${start.orderId}`);
  });

  it("refuses to fulfill when the settled total or currency disagrees with the order", async () => {
    const supabase = makeSupabase();
    await startCheckout(supabase, MERCHANT, "tee", "2", null, "https://x");
    const sessionId = at(tables.orders, 0)["stripe_session_id"] as string;
    const expected = at(tables.orders, 0)["amount_cents"] as number;

    expect(
      await fulfillCheckoutSession(
        supabase,
        completedSession(sessionId, { amountTotal: expected - 1, currency: "usd" })
      )
    ).toBe(false);
    expect(
      await fulfillCheckoutSession(
        supabase,
        completedSession(sessionId, { amountTotal: expected, currency: "eur" })
      )
    ).toBe(false);
    expect(at(tables.orders, 0)["status"]).toBe("pending");
    expect(at(tables.storefront_products, 0)["inventory"]).toBe(3);

    expect(
      await fulfillCheckoutSession(
        supabase,
        completedSession(sessionId, { amountTotal: expected, currency: "usd" })
      )
    ).toBe(true);
    expect(at(tables.orders, 0)["status"]).toBe("paid");
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

  it("the agent's staging note reaches the owner's shop_publish decision", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    const first = await requestCatalogPublish(supabase, MERCHANT, {
      note: "  copy says ticket;\n tee title carries the buyer's words  ",
    });
    expect(first.staged).toBe(true);
    expect(at(tables.decisions, 0)["payload"]).toEqual({
      note: "copy says ticket; tee title carries the buyer's words",
      stagings: 1,
    });
    // Restaging while pending appends its reason rather than replacing it,
    // and an identical reason is not repeated.
    await requestCatalogPublish(supabase, MERCHANT, {
      note: "copy says ticket; tee title carries the buyer's words",
    });
    const second = await requestCatalogPublish(supabase, MERCHANT, {
      note: "poster swapped for the final artwork",
    });
    expect(second.staged).toBe(false);
    expect(tables.decisions).toHaveLength(1);
    expect(at(tables.decisions, 0)["payload"]).toEqual({
      note:
        "copy says ticket; tee title carries the buyer's words\n" +
        "poster swapped for the final artwork",
      stagings: 3,
    });
    // A staging with no usable note leaves the notes alone but still counts.
    await requestCatalogPublish(supabase, MERCHANT, { note: 42 });
    await requestCatalogPublish(supabase, MERCHANT);
    expect(at(tables.decisions, 0)["payload"]).toEqual({
      note:
        "copy says ticket; tee title carries the buyer's words\n" +
        "poster swapped for the final artwork",
      stagings: 5,
    });
    expect(productRow("neon-wolf-tee")).toBeUndefined();
  });

  it("a staging note is bounded and never a new decision without one", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    const first = await requestCatalogPublish(supabase, MERCHANT, {
      note: "x".repeat(2000),
    });
    expect(first.staged).toBe(true);
    const payload = at(tables.decisions, 0)["payload"] as { note: string };
    expect(payload.note).toHaveLength(500);
    const bare = await requestCatalogPublish(supabase, "user-other", {
      note: "",
    });
    expect(bare.staged).toBe(true);
    expect(at(tables.decisions, 1)["payload"]).toEqual({ stagings: 1 });
  });

  it("a failed note update is an error, not a silent 'reused'", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    await requestCatalogPublish(supabase, MERCHANT, { note: "first" });
    decisionUpdateError = { message: "connection reset" };
    await expect(
      requestCatalogPublish(supabase, MERCHANT, { note: "second" })
    ).rejects.toMatchObject({ status: 500 });
    expect(at(tables.decisions, 0)["payload"]).toEqual({
      note: "first",
      stagings: 1,
    });
    expect(tables.decisions).toHaveLength(1);
  });

  it("concurrent restagings keep both notes on the single pending decision", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    await requestCatalogPublish(supabase, MERCHANT, { note: "first" });
    // Interleave: while A is between its read and its update, B lands its
    // own note. A's conditional update must miss and re-read, not clobber B.
    let interleaved = false;
    beforeDecisionUpdate = () => {
      if (interleaved) return;
      interleaved = true;
      const decision = at(tables.decisions, 0);
      decision["payload"] = { note: "first\nfrom B", stagings: 2 };
    };
    const result = await requestCatalogPublish(supabase, MERCHANT, {
      note: "from A",
    });
    beforeDecisionUpdate = null;
    expect(result.staged).toBe(false);
    expect(tables.decisions).toHaveLength(1);
    expect(at(tables.decisions, 0)["payload"]).toEqual({
      note: "first\nfrom B\nfrom A",
      stagings: 3,
    });
  });

  it("concurrent first stagings file one decision: the loser merges into the winner", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    // Interleave: A sees no pending decision; before A's insert lands, B files
    // one. The partial unique index rejects A's insert and A merges its note.
    let interleaved = false;
    beforeDecisionInsert = () => {
      if (interleaved) return;
      interleaved = true;
      tables.decisions.push({
        id: "decisions-B",
        user_id: MERCHANT,
        kind: "shop_publish",
        status: "pending",
        payload: { note: "from B" },
      });
    };
    const result = await requestCatalogPublish(supabase, MERCHANT, {
      note: "from A",
    });
    expect(result).toEqual({ decisionId: "decisions-B", staged: false });
    expect(tables.decisions).toHaveLength(1);
    expect(at(tables.decisions, 0)["payload"]).toEqual({
      note: "from B\nfrom A",
      stagings: 1,
    });
    // An approval completed in between still allows a fresh pending decision.
    at(tables.decisions, 0)["status"] = "approved";
    const fresh = await requestCatalogPublish(supabase, MERCHANT, {
      note: "again",
    });
    expect(fresh.staged).toBe(true);
    expect(tables.decisions).toHaveLength(2);
  });

  it("an approval that lands between the lookup and 'reused' files a fresh decision instead", async () => {
    boxCatalog = { items: [zapListing({ key: "zine", name: "Zine" })] };
    const supabase = makeSupabase();
    await requestCatalogPublish(supabase, MERCHANT, { note: "first" });
    // Interleave: the owner approves (projecting the catalog as it was before
    // this staging) after our lookup saw the row pending but before we would
    // have reported it reused. Both the no-note and the duplicate-note paths
    // must notice and stage a new decision, or the new listing never gets an
    // approval card.
    for (const note of [undefined, "first"]) {
      const before = tables.decisions.length;
      let interleaved = false;
      beforeDecisionUpdate = () => {
        if (interleaved) return;
        interleaved = true;
        const pending = tables.decisions.find(
          (row) => row["status"] === "pending"
        );
        if (!pending) throw new Error("expected a pending decision");
        pending["status"] = "approved";
        pending["resolved_at"] = "2026-01-01T00:00:00.000Z";
      };
      const result = await requestCatalogPublish(supabase, MERCHANT, { note });
      beforeDecisionUpdate = null;
      expect(result.staged).toBe(true);
      expect(tables.decisions).toHaveLength(before + 1);
      const fresh = tables.decisions.find((row) => row["id"] === result.decisionId);
      expect(fresh?.["status"]).toBe("pending");
      expect(fresh?.["payload"]).toEqual(
        note ? { note, stagings: 1 } : { stagings: 1 }
      );
      expect(
        tables.decisions.filter((row) => row["status"] === "pending")
      ).toHaveLength(1);
    }
    // The resolved rows were left untouched by the missed confirmations.
    expect(
      tables.decisions.filter((row) => row["status"] === "approved")
    ).toHaveLength(2);
    expect(at(tables.decisions, 0)["payload"]).toEqual({
      note: "first",
      stagings: 1,
    });
  });

  it("a malformed stored note is replaced, not a wedge that blocks every later staging", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    for (const malformed of [42, true, { nested: 1 }, ["a"], null]) {
      tables.decisions = [
        {
          id: "decisions-legacy",
          user_id: MERCHANT,
          kind: "shop_publish",
          status: "pending",
          payload: { note: malformed, extra: "kept" },
        },
      ];
      const result = await requestCatalogPublish(supabase, MERCHANT, {
        note: "readable",
      });
      expect(result).toEqual({ decisionId: "decisions-legacy", staged: false });
      expect(at(tables.decisions, 0)["payload"]).toEqual({
        note: "readable",
        extra: "kept",
        stagings: 1,
      });
    }
    // A pending decision with no payload at all gets one.
    tables.decisions = [
      {
        id: "decisions-bare",
        user_id: MERCHANT,
        kind: "shop_publish",
        status: "pending",
        payload: null,
      },
    ];
    await requestCatalogPublish(supabase, MERCHANT, { note: "readable" });
    expect(at(tables.decisions, 0)["payload"]).toEqual({
      note: "readable",
      stagings: 1,
    });
    // A pre-0079 row that was never counted starts counting from here; a
    // garbage count is replaced rather than trusted.
    for (const garbage of [-4, 1.5, "7", Number.MAX_VALUE]) {
      tables.decisions = [
        {
          id: "decisions-legacy",
          user_id: MERCHANT,
          kind: "shop_publish",
          status: "pending",
          payload: { stagings: garbage },
        },
      ];
      await requestCatalogPublish(supabase, MERCHANT);
      expect(at(tables.decisions, 0)["payload"]).toEqual({ stagings: 1 });
    }
  });

  it("a failed pending lookup is an error, never another approval", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    await requestCatalogPublish(supabase, MERCHANT, { note: "first" });
    decisionLookupError = { message: "connection reset" };
    await expect(
      requestCatalogPublish(supabase, MERCHANT, { note: "second" })
    ).rejects.toMatchObject({ status: 500 });
    expect(tables.decisions).toHaveLength(1);
    // Legacy duplicates (pre-0079) make maybeSingle return an error too:
    // surface it rather than adding a third card.
    tables.decisions.push({
      id: "decisions-dup",
      user_id: MERCHANT,
      kind: "shop_publish",
      status: "pending",
      payload: {},
    });
    await expect(
      requestCatalogPublish(supabase, MERCHANT, { note: "third" })
    ).rejects.toMatchObject({ status: 500 });
    expect(tables.decisions).toHaveLength(2);
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

  it("owner approval claims the pending decision and projects the catalog", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    const { decisionId } = await requestCatalogPublish(supabase, MERCHANT, {
      note: "first",
    });
    const decision = at(tables.decisions, 0);
    beforeCatalogRead = () => {
      // The claim is already down before catalog.json is read.
      expect(decision["status"]).toBe("approved");
    };
    const approval = await approveCatalogPublish(supabase, MERCHANT, {
      id: decisionId,
    });
    expect(approval).toEqual({ outcome: "approved", published: 1 });
    expect(decision["status"]).toBe("approved");
    expect(decision["resolved_at"]).toEqual(expect.any(String));
    expect(productRow("neon-wolf-tee")?.["active"]).toBe(true);
    // A staging that arrives after the claim files a fresh card.
    const next = await requestCatalogPublish(supabase, MERCHANT);
    expect(next.staged).toBe(true);
    expect(tables.decisions).toHaveLength(2);
  });

  it("a staging that lands after the claim gets its own card; one before it is projected", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    const { decisionId } = await requestCatalogPublish(supabase, MERCHANT, {
      note: "tee",
    });
    const decision = at(tables.decisions, 0);
    // Before the claim: a Zap run adds the zine and confirms into the pending
    // row. The projection reads catalog.json after the claim, so it is covered.
    let staged = false;
    beforeDecisionUpdate = async () => {
      if (staged) return;
      staged = true;
      boxCatalog = {
        items: [zapListing(), zapListing({ key: "zine", name: "Zine" })],
      };
      const restaged = await requestCatalogPublish(supabase, MERCHANT, {
        note: "zine",
      });
      expect(restaged).toEqual({ decisionId, staged: false });
    };
    // After the claim, while the projection is reading: another run adds a
    // poster. It cannot ride this decision any more, so it files a new one.
    let late: { decisionId: string; staged: boolean } | null = null;
    beforeCatalogRead = async () => {
      expect(decision["status"]).toBe("approved");
      late = await requestCatalogPublish(supabase, MERCHANT, { note: "poster" });
    };
    const approval = await approveCatalogPublish(supabase, MERCHANT, {
      id: decisionId,
    });
    beforeDecisionUpdate = null;
    beforeCatalogRead = null;
    expect(approval).toEqual({ outcome: "approved", published: 2 });
    expect(decision["payload"]).toEqual({ note: "tee\nzine", stagings: 2 });
    expect(productRow("zine")?.["active"]).toBe(true);
    expect(late).toEqual({ decisionId: expect.any(String), staged: true });
    expect(late!.decisionId).not.toBe(decisionId);
    const fresh = at(tables.decisions, 1);
    expect(fresh["status"]).toBe("pending");
    expect(fresh["payload"]).toEqual({ note: "poster", stagings: 1 });
  });

  it("a dismissal that wins the race publishes nothing", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    const { decisionId } = await requestCatalogPublish(supabase, MERCHANT);
    const decision = at(tables.decisions, 0);
    let reads = 0;
    beforeCatalogRead = () => {
      reads += 1;
    };
    beforeDecisionUpdate = () => {
      decision["status"] = "dismissed";
      decision["resolved_at"] = "2026-01-01T00:00:00.000Z";
    };
    const approval = await approveCatalogPublish(supabase, MERCHANT, {
      id: decisionId,
    });
    beforeDecisionUpdate = null;
    expect(approval).toEqual({ outcome: "resolved" });
    expect(reads).toBe(0);
    expect(productRow("neon-wolf-tee")).toBeUndefined();
    expect(productRow("tee")?.["active"]).toBe(true);
    expect(decision["status"]).toBe("dismissed");
    expect(decision["resolved_at"]).toBe("2026-01-01T00:00:00.000Z");
    // A failed claim is an error, never a projection.
    const { decisionId: again } = await requestCatalogPublish(supabase, MERCHANT);
    decisionUpdateError = { message: "connection reset" };
    await expect(
      approveCatalogPublish(supabase, MERCHANT, { id: again })
    ).rejects.toMatchObject({ status: 500 });
    expect(reads).toBe(0);
    expect(at(tables.decisions, 1)["status"]).toBe("pending");
  });

  it("a projection that fails hands the card back to Needs You", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    const { decisionId } = await requestCatalogPublish(supabase, MERCHANT, {
      note: "tee",
    });
    const decision = at(tables.decisions, 0);
    beforeCatalogRead = () => {
      throw new Error("box unreachable");
    };
    await expect(
      approveCatalogPublish(supabase, MERCHANT, { id: decisionId })
    ).rejects.toThrow("box unreachable");
    expect(decision["status"]).toBe("pending");
    expect(decision["resolved_at"]).toBeNull();
    expect(decision["payload"]).toEqual({ note: "tee", stagings: 1 });
    expect(productRow("neon-wolf-tee")).toBeUndefined();
    expect(productRow("tee")?.["active"]).toBe(true);
    // Retry succeeds against the same card.
    beforeCatalogRead = null;
    const approval = await approveCatalogPublish(supabase, MERCHANT, {
      id: decisionId,
    });
    expect(approval).toEqual({ outcome: "approved", published: 1 });
    expect(tables.decisions).toHaveLength(1);
  });

  it("a failed projection does not undo the claim when a newer card already exists", async () => {
    boxCatalog = { items: [zapListing()] };
    const supabase = makeSupabase();
    const { decisionId } = await requestCatalogPublish(supabase, MERCHANT);
    const decision = at(tables.decisions, 0);
    beforeCatalogRead = async () => {
      // A staging after the claim filed the next card, then the box died.
      const late = await requestCatalogPublish(supabase, MERCHANT, {
        note: "poster",
      });
      expect(late.staged).toBe(true);
      throw new Error("box unreachable");
    };
    await expect(
      approveCatalogPublish(supabase, MERCHANT, { id: decisionId })
    ).rejects.toThrow("box unreachable");
    // The unique index refuses a second pending row; the newer card is the retry.
    expect(decision["status"]).toBe("approved");
    expect(
      tables.decisions.filter((row) => row["status"] === "pending")
    ).toHaveLength(1);
    expect(productRow("neon-wolf-tee")).toBeUndefined();
    expect(productRow("tee")?.["active"]).toBe(true);
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
