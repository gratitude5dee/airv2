/**
 * MA8 acceptance + red-team: money amounts are server-derived (order
 * tampering can't move money), charges land only on the merchant's connected
 * account (no-custody by construction), fulfillment is replay-safe,
 * tickets check in exactly once, receipts need the buyer key, the catalog
 * only projects public data and only via an owner-approved decision, and
 * payment requests expire + confirm by webhook.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

/* ------------------------------------------------------- stripe mock */

const connectCalls: { account: string; params: Record<string, unknown> }[] = [];

vi.mock("@/lib/payments/stripe", () => ({
  createConnectAccount: async () => "acct_test_merchant",
  createAccountLink: async () => "https://connect.stripe.com/setup/test",
  createConnectCheckoutSession: async (
    account: string,
    params: Record<string, unknown>
  ) => {
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
  orders: () => ({ status: "pending", ticket_code: null, checked_in_at: null }),
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
      not(column: string, op: string, value: string) {
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
  sanitizeRef,
  startCheckout,
} from "./checkout";
import {
  applyCatalogPublish,
  requestCatalogPublish,
  sanitizeCatalogItem,
} from "./catalog";
import {
  approvePaymentRequest,
  createPaymentRequest,
  markPaymentRequestPaid,
} from "./paymentRequests";
import { startOnboarding, syncAccountFromEvent } from "./merchants";

const MERCHANT = "user-merchant";

function seed(): void {
  nextId = 0;
  connectCalls.length = 0;
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
    expect(order.amount_cents).toBe(5000); // 2 × 2500, from the row
    expect(order.status).toBe("pending");
    expect(start.checkoutUrl).toContain("checkout.stripe.com");
    // The Stripe session amount is the same server-derived figure.
    expect(connectCalls[0]?.params.amountCents).toBe(5000);
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
    at(tables.merchants, 0).charges_enabled = false;
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
    const sessionId = at(tables.orders, 0).stripe_session_id as string;
    expect(await fulfillCheckoutSession(supabase, completedSession(sessionId))).toBe(true);
    expect(at(tables.orders, 0).status).toBe("paid");
    expect(at(tables.storefront_products, 0).inventory).toBe(1);
    // Replay: the conditional flip refuses a second effect.
    expect(await fulfillCheckoutSession(supabase, completedSession(sessionId))).toBe(false);
    expect(at(tables.storefront_products, 0).inventory).toBe(1);
  });

  it("mints a ticket for event tickets, none for physical goods", async () => {
    const supabase = makeSupabase();
    await startCheckout(supabase, MERCHANT, "show", "1", null, "https://x");
    await fulfillCheckoutSession(
      supabase,
      completedSession(at(tables.orders, 0).stripe_session_id as string)
    );
    expect(at(tables.orders, 0).ticket_code).toBeTruthy();

    await startCheckout(supabase, MERCHANT, "tee", "1", null, "https://x");
    await fulfillCheckoutSession(
      supabase,
      completedSession(at(tables.orders, 1).stripe_session_id as string)
    );
    expect(at(tables.orders, 1).ticket_code ?? null).toBeNull();
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
    expect(at(tables.orders, 0).buyer_key_hash).toBe(hashKey(start.buyerKey));
    expect(JSON.stringify(at(tables.orders, 0))).not.toContain(start.buyerKey);
  });

  it("a ticket checks in exactly once, and only for its merchant", async () => {
    const supabase = makeSupabase();
    await startCheckout(supabase, MERCHANT, "show", "1", null, "https://x");
    await fulfillCheckoutSession(
      supabase,
      completedSession(at(tables.orders, 0).stripe_session_id as string)
    );
    const code = at(tables.orders, 0).ticket_code as string;
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
    expect(at(tables.decisions, 0).kind).toBe("shop_publish");
    expect(at(tables.decisions, 0).status ?? "pending").toBe("pending");
    // Restaging reuses the pending decision instead of piling up.
    const second = await requestCatalogPublish(supabase, MERCHANT);
    expect(second.staged).toBe(false);
    expect(tables.decisions).toHaveLength(1);
    // Nothing projected yet.
    expect(
      tables.storefront_products.find((p) => p.product_key === "zine")
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
    const zine = tables.storefront_products.find((p) => p.product_key === "zine");
    expect(zine?.price_cents).toBe(800);
    const leaky = tables.storefront_products.find((p) => p.product_key === "leaky");
    expect(leaky?.image_url ?? null).toBeNull();
    // The previously published rows not in the catalog are deactivated.
    expect(
      tables.storefront_products.find((p) => p.product_key === "tee")?.active
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
});

describe("payment requests: decision-gated, expiring, webhook-confirmed", () => {
  it("filing creates the pending request + its decision — nothing moves", async () => {
    const supabase = makeSupabase();
    await createPaymentRequest(supabase, "user-payer", {
      currency: "usd",
      amount: 500,
      payee: "casey",
    });
    expect(at(tables.payment_requests, 0).status).toBe("pending");
    expect(at(tables.decisions, 0).kind).toBe("payment_request");
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
    at(tables.merchants, 0).charges_enabled = false;
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
    at(tables.payment_requests, 0).expires_at = "2000-01-01T00:00:00Z";
    await expect(
      approvePaymentRequest(supabase, "user-payer", requestId, "https://x")
    ).rejects.toThrow(/expired/);
    expect(at(tables.payment_requests, 0).status).toBe("expired");
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
    const sessionId = at(tables.payment_requests, 0).stripe_session_id as string;
    expect(
      await markPaymentRequestPaid(supabase, completedSession(sessionId))
    ).toBe(true);
    expect(at(tables.payment_requests, 0).status).toBe("paid");
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
    expect(at(tables.merchants, 0).charges_enabled).toBe(true);
    const row = tables.mini_apps.find((app) => app.slug === "casey-shop");
    expect(row?.owner_user_id).toBe(MERCHANT);
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
