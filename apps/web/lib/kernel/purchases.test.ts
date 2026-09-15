/**
 * Kernel purchase choreography tests (C29/C30): the backend-derived quote
 * never trusts the agent's numbers, submit-once never retries, and an
 * ambiguous outcome lands on unknown_outcome rather than a guess.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookup } from "node:dns/promises";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

/* -------------------------------------------------------- fetch mock */

const realFetch = globalThis.fetch;

function mockFetch(html: string | null, type = "text/html") {
  vi.stubGlobal("fetch", async () => {
    if (html === null) throw new Error("network down");
    return new Response(html, {
      status: 200,
      headers: { "content-type": type },
    });
  });
}

/* ----------------------------------------------- vault/kernel mocks */

let itemEvents: Array<{ name: string | null }> = [];
vi.mock("@/lib/kernel/vaults", () => ({
  AGENTCARD_WALLET_KEY: "agentcard-wallet",
  LINK_WALLET_KEY: "link-wallet",
  ensureKernelVault: async () => "vault-1",
  authorizeKernelItem: vi.fn(),
  getKernelItem: async () => ({
    type: "card",
    state: {
      status: "ready",
      aliases: {
        number: "4242424242424242",
        cvc: "123",
        exp_month: 12,
        exp_year: 2030,
      },
    },
  }),
  kernelItemEvents: async () => itemEvents,
  syncKernelVaultItems: async () => [],
}));
vi.mock("@/lib/kernel/actions", () => ({
  stageKernelAction: async () => ({ id: "act-1", url: "https://example.com/act#t=x" }),
}));
vi.mock("@/lib/kernel/client", () => ({
  KernelError: class extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status = 502) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
  kernelClient: vi.fn(),
}));
vi.mock("@/lib/approvals/token", () => ({
  mintApprovalUrl: () => "https://air.example/approve/dec-1?k=tok",
}));
vi.mock("@/lib/env", () => ({
  env: {
    kernelVaultsEnabled: () => true,
    miniappOrigin: () => "https://mini.example",
    appOrigin: () => "https://air.example",
  },
}));

import {
  assertFrozenKernelQuoteCurrent,
  pollKernelPurchase,
  proposeKernelPurchase,
  quoteMerchantUrl,
  reconcileKernelPurchase,
  reportKernelSubmit,
  verifyKernelPurchase,
  resolvesOnlyPublicAddresses,
  isPublicAddress,
} from "./purchases";
import { PurchaseError } from "../vault/purchase";

/* -------------------------------------------- in-memory supabase lite */

type Row = Record<string, unknown>;

function makeSupabase(seed: { purchases?: Row[]; decisions?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    kernel_purchases: [...(seed.purchases ?? [])],
    decisions: [...(seed.decisions ?? [])],
  };
  let nextId = 1;

  function matches(row: Row, filters: Array<[string, unknown]>): boolean {
    return filters.every(([col, val]) => row[col] === val);
  }

  function builder(table: string) {
    const filters: Array<[string, unknown]> = [];
    const negs: Array<[string, unknown]> = [];
    let inList: [string, unknown[]] | null = null;
    const state = { update: null as Row | null, insert: null as Row | null, isDelete: false };

    const query = {
      select: () => query,
      eq: (col: string, val: unknown) => { filters.push([col, val]); return query; },
      in: (col: string, vals: unknown[]) => { inList = [col, vals]; return query; },
      is: (col: string, val: unknown) => { filters.push([col, val]); return query; },
      gt: (col: string, val: unknown) => { negs.push([col, val]); return query; },
      order: () => query,
      limit: () => query,
      insert: (row: Row) => { state.insert = row; return query; },
      update: (row: Row) => { state.update = row; return query; },
      delete: () => { state.isDelete = true; return query; },
      single: async () => query.exec(true),
      maybeSingle: async () => query.exec(true),
      then: (resolve: (v: unknown) => unknown) => query.exec(false).then(resolve),
      exec: async (single: boolean) => {
        const rows = tables[table] ?? [];
        if (state.insert) {
          const row = { id: `id-${nextId++}`, created_at: new Date().toISOString(), ...state.insert };
          rows.push(row);
          return { data: row, error: null };
        }
        if (state.isDelete) {
          for (let i = rows.length - 1; i >= 0; i -= 1) {
            if (matches(rows[i]!, filters)) rows.splice(i, 1);
          }
          return { data: null, error: null };
        }
        if (state.update) {
          const updated: Row[] = [];
          for (const row of rows) {
            if (matches(row, filters) && (!inList || (inList[1] as unknown[]).includes(row[inList[0]]))) {
              Object.assign(row, state.update);
              updated.push(row);
            }
          }
          return { data: single ? (updated[0] ?? null) : updated, error: null };
        }
        const found = rows.filter(
          (row) =>
            matches(row, filters) &&
            (!inList || (inList[1] as unknown[]).includes(row[inList[0]])) &&
            negs.every(([col, val]) => {
              const cur = row[col];
              if (cur == null) return false;
              return String(cur) > String(val);
            })
        );
        return { data: single ? (found[0] ?? null) : found, error: null };
      },
    };
    return query as unknown as {
      select: () => unknown;
      eq: (col: string, val: unknown) => unknown;
      in: (col: string, vals: unknown[]) => unknown;
      is: (col: string, val: unknown) => unknown;
      gt: (col: string, val: unknown) => unknown;
      order: () => unknown;
      limit: () => unknown;
      insert: (row: Row) => unknown;
      update: (row: Row) => unknown;
      delete: () => unknown;
      single: () => Promise<unknown>;
      maybeSingle: () => Promise<unknown>;
    };
  }

  return {
    client: { from: builder } as unknown as SupabaseClient,
    tables,
  };
}

function purchaseRow(overrides: Row = {}): Row {
  return {
    id: "p-1",
    user_id: "u-1",
    kernel_session_id: null,
    purchase: {
      merchant_name: "Example Store",
      merchant_url: "https://example.com/checkout",
      amount_cents: 4299,
      currency: "usd",
      provider: "link",
      context:
        "The owner requested this exact purchase; the merchant, item, quantity, currency, and final checkout total were verified before approval.",
    },
    status: "ready",
    item_key: "card-abc",
    decision_id: "dec-1",
    submitted_at: null,
    outcome: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */

beforeEach(() => {
  itemEvents = [];
});
afterEach(() => {
  vi.stubGlobal("fetch", realFetch);
  vi.restoreAllMocks();
});

describe("quoteMerchantUrl", () => {
  it("accepts a hostname only when DNS resolves exclusively to public addresses", async () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    await expect(lookup("example.com", { all: true })).resolves.toEqual([
      { address: "93.184.216.34", family: 4 },
    ]);
    await expect(resolvesOnlyPublicAddresses("example.com")).resolves.toBe(true);
  });
  it("extracts a Stripe checkout blob", async () => {
    mockFetch(`<html>{"line_item_group":{"total":4299,"currency":"usd"},
      "display_name":"Example Store","item_name":"Beans","unit_amount":4299}</html>`);
    const quote = await quoteMerchantUrl("https://buy.stripe.com/test");
    expect(quote?.amount_cents).toBe(4299);
    expect(quote?.currency).toBe("usd");
    expect(quote?.merchant_name).toBe("Example Store");
    expect(quote?.line_items?.[0]?.name).toBe("Beans");
  });

  it("extracts a JSON-LD offer", async () => {
    mockFetch(`<html><script type="application/ld+json">
      {"@type":"Product","name":"Widget","offers":{"@type":"Offer","price":"12.99","priceCurrency":"USD"}}
      </script></html>`);
    const quote = await quoteMerchantUrl("https://example.com/p/widget");
    expect(quote?.amount_cents).toBe(1299);
    expect(quote?.currency).toBe("usd");
    expect(quote?.merchant_name).toBe("Widget");
  });

  it("extracts OpenGraph price meta", async () => {
    mockFetch(`<html><head>
      <meta property="og:price:amount" content="42.99"/>
      <meta property="og:price:currency" content="USD"/>
      <meta property="og:site_name" content="OG Shop"/></head></html>`);
    const quote = await quoteMerchantUrl("https://example.com/p/thing");
    expect(quote?.amount_cents).toBe(4299);
    expect(quote?.merchant_name).toBe("OG Shop");
  });

  it("returns null when nothing verifiable exists — never guesses", async () => {
    mockFetch(`<html><body>some checkout with no price structure</body></html>`);
    expect(await quoteMerchantUrl("https://example.com/checkout")).toBeNull();
  });

  it("returns null on non-HTML and unreachable pages", async () => {
    mockFetch("{}", "application/json");
    expect(await quoteMerchantUrl("https://example.com/api")).toBeNull();
    mockFetch(null);
    expect(await quoteMerchantUrl("https://example.com/down")).toBeNull();
  });
});

describe("verifyKernelPurchase", () => {
  const context =
    "The owner requested this exact purchase; the merchant, item, quantity, currency, and final checkout total were verified before approval.";
  const proposal = {
    merchant_url: "https://buy.stripe.com/test",
    amount_cents: 4299,
    currency: "usd",
    context,
  };

  it("accepts a proposal matching the verified quote", async () => {
    mockFetch(`{"line_item_group":{"total":4299,"currency":"usd"},"display_name":"Store"}`);
    const verified = await verifyKernelPurchase(proposal);
    expect(verified.amount_cents).toBe(4299);
    expect(verified.currency).toBe("usd");
    expect(verified.provider).toBe("link");
    expect(verified.context).toBe(context);
  });

  it("rejects an unverifiable page with kernel_quote_unverified (422)", async () => {
    mockFetch(`<html>no price</html>`);
    await expect(verifyKernelPurchase(proposal)).rejects.toMatchObject({
      code: "kernel_quote_unverified",
    });
  });

  it("rejects a price >2% off the verified quote", async () => {
    mockFetch(`{"line_item_group":{"total":5000,"currency":"usd"}}`);
    await expect(verifyKernelPurchase(proposal)).rejects.toMatchObject({
      code: "kernel_quote_mismatch",
    });
  });

  it("rejects a currency mismatch", async () => {
    mockFetch(`{"line_item_group":{"total":4299,"currency":"eur"}}`);
    await expect(verifyKernelPurchase(proposal)).rejects.toMatchObject({
      code: "kernel_quote_mismatch",
    });
  });

  it("rejects a non-public merchant URL", async () => {
    await expect(
      verifyKernelPurchase({ ...proposal, merchant_url: "file:///etc/passwd" })
    ).rejects.toMatchObject({ code: "kernel_purchase_invalid" });
  });

  it("rejects short Link context and unsupported AgentCard ordering", async () => {
    mockFetch(`{"line_item_group":{"total":4299,"currency":"usd"}}`);
    await expect(
      verifyKernelPurchase({ ...proposal, context: "buy this" })
    ).rejects.toMatchObject({ code: "kernel_context_required" });
    await expect(
      verifyKernelPurchase({ ...proposal, provider: "agentcard" })
    ).rejects.toMatchObject({ code: "kernel_agentcard_not_ready" });
  });
});

describe("assertFrozenKernelQuoteCurrent", () => {
  const frozen = purchaseRow()["purchase"] as Parameters<
    typeof assertFrozenKernelQuoteCurrent
  >[0];

  it("accepts only the exact approved amount and currency", async () => {
    mockFetch(`<script type="application/ld+json">
      {"@type":"Offer","price":"42.99","priceCurrency":"USD"}</script>`);
    await expect(assertFrozenKernelQuoteCurrent(frozen)).resolves.toBeUndefined();
  });

  it("fails closed when the post-approval cart changes", async () => {
    mockFetch(`<script type="application/ld+json">
      {"@type":"Offer","price":"52.99","priceCurrency":"USD"}</script>`);
    await expect(assertFrozenKernelQuoteCurrent(frozen)).rejects.toMatchObject({
      code: "kernel_cart_changed",
    });
  });
});

describe("proposeKernelPurchase", () => {
  const context =
    "The owner requested this exact purchase; the merchant, item, quantity, currency, and final checkout total were verified before approval.";
  const proposal = {
    merchant_url: "https://example.com/checkout",
    amount_cents: 4299,
    currency: "usd",
    context,
  };

  it("freezes the verified object into a purchase_review decision", async () => {
    mockFetch(`<script type="application/ld+json">
      {"@type":"Offer","price":"42.99","priceCurrency":"USD"}</script>`);
    const { client, tables } = makeSupabase();
    const result = await proposeKernelPurchase(client, "u-1", { purchase: proposal });
    expect(result.decisionId).toMatch(/^id-/);
    const decision = tables["decisions"]![0]!;
    expect(decision["kind"]).toBe("purchase_review");
    expect((decision["payload"] as Row)["kernel_purchase_id"]).toBe(result.purchaseId);
    expect((decision["payload"] as Row)["lane"]).toBe("kernel");
    const purchase = tables["kernel_purchases"]![0]!;
    expect(purchase["status"]).toBe("pending_approval");
  });

  it("returns the live open review for the same host instead of duplicating", async () => {
    mockFetch(`<script type="application/ld+json">
      {"@type":"Offer","price":"42.99","priceCurrency":"USD"}</script>`);
    const existing = purchaseRow({ status: "pending_approval" });
    const { client, tables } = makeSupabase({ purchases: [existing] });
    const result = await proposeKernelPurchase(client, "u-1", { purchase: proposal });
    expect(result.purchaseId).toBe("p-1");
    expect(result.decisionId).toBe("dec-1");
    expect(tables["kernel_purchases"]).toHaveLength(1);
    expect(tables["decisions"]).toHaveLength(0);
  });
});

describe("submit-once (C30)", () => {
  it("delivers aliases only to the poll that atomically claims ready", async () => {
    const { client } = makeSupabase({
      purchases: [purchaseRow({ status: "authorized" })],
      decisions: [{ id: "dec-1", user_id: "u-1", status: "approved" }],
    });
    const first = await pollKernelPurchase(client, "u-1", "p-1");
    expect(first.status).toBe("ready");
    expect(first.aliases).toBeDefined();

    const second = await pollKernelPurchase(client, "u-1", "p-1");
    expect(second.status).toBe("ready");
    expect(second.aliases).toBeUndefined();
  });

  it("transitions ready → submitted exactly once", async () => {
    const { client } = makeSupabase({ purchases: [purchaseRow()] });
    const submitted = await reportKernelSubmit(client, "u-1", "p-1");
    expect(submitted.status).toBe("submitted");
    await expect(reportKernelSubmit(client, "u-1", "p-1")).rejects.toMatchObject({
      code: "already_submitted",
    });
  });

  it("refuses submit before authorization", async () => {
    const { client } = makeSupabase({
      purchases: [purchaseRow({ status: "proposed" })],
    });
    await expect(reportKernelSubmit(client, "u-1", "p-1")).rejects.toMatchObject({
      code: "kernel_not_ready",
    });
  });

  it("refuses an authorized row until the alias-delivery poll claims ready", async () => {
    const { client } = makeSupabase({
      purchases: [purchaseRow({ status: "authorized" })],
    });
    await expect(reportKernelSubmit(client, "u-1", "p-1")).rejects.toMatchObject({
      code: "kernel_not_ready",
    });
  });
});

describe("reconcileKernelPurchase", () => {
  it("maps consumed events to consumed", async () => {
    itemEvents = [{ name: "card.consumed" }, { name: "charge.completed" }];
    const { client } = makeSupabase({
      purchases: [purchaseRow({ status: "submitted", submitted_at: "t" })],
    });
    const out = await reconcileKernelPurchase(client, "u-1", "p-1");
    expect(out.status).toBe("consumed");
  });

  it("maps declined events to declined", async () => {
    itemEvents = [{ name: "card.declined" }];
    const { client } = makeSupabase({
      purchases: [purchaseRow({ status: "submitted", submitted_at: "t" })],
    });
    const out = await reconcileKernelPurchase(client, "u-1", "p-1");
    expect(out.status).toBe("declined");
  });

  it("lands on unknown_outcome when submitted with inconclusive events — never a retry", async () => {
    itemEvents = [{ name: "card.viewed" }];
    const { client } = makeSupabase({
      purchases: [purchaseRow({ status: "submitted", submitted_at: "t" })],
    });
    const out = await reconcileKernelPurchase(client, "u-1", "p-1");
    expect(out.status).toBe("unknown_outcome");
  });
});

describe("PurchaseError contract", () => {
  it("throws typed errors, not bare strings", () => {
    const err = new PurchaseError("kernel_test", "msg", 409);
    expect(err.code).toBe("kernel_test");
    expect(err.status).toBe(409);
  });
});
