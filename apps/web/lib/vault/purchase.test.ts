/**
 * V6 offer-the-fill gate (C20): owner-initiated only, never tier-1, one
 * open purchase_review per site, and a decision payload that carries only
 * value-free scope fields (C18). The supabase surface is a thenable
 * chain-stub scripted per table.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeHost,
  proposePurchaseReview,
  resolveActiveTurn,
  resolvePurchaseReview,
  dryRunHosts,
  PurchaseError,
  PURCHASE_OUTCOMES,
} from "./purchase";

beforeAll(() => {
  process.env.MINIAPP_SIGNING_KEY = "test-signing-key";
});

type Row = Record<string, unknown>;
type Script = Record<string, Row[] | Row | null>;

/** Thenable query stub: every chain method returns itself; awaiting yields
 * the scripted rows for the table (maybeSingle/single unwrap the first). */
function fakeSupabase(script: Script, inserts: Record<string, Row[]> = {}) {
  function builder(table: string) {
    let single = false;
    let inserted: Row | null = null;
    const self: Record<string, unknown> = {};
    const chain = (): typeof self => self;
    for (const method of [
      "select",
      "eq",
      "is",
      "not",
      "order",
      "limit",
      "update",
    ]) {
      self[method] = chain;
    }
    self.insert = (row: Row) => {
      inserted = row;
      (inserts[table] ??= []).push(row);
      return self;
    };
    self.maybeSingle = () => {
      single = true;
      return self;
    };
    self.single = () => {
      single = true;
      return self;
    };
    self.then = (
      resolve: (value: { data: unknown; error: null }) => unknown
    ) => {
      if (inserted && table === "decisions") {
        return resolve({ data: { id: "decision-1" }, error: null });
      }
      if (inserted) return resolve({ data: null, error: null });
      const scripted = script[table] ?? null;
      const rows = Array.isArray(scripted)
        ? scripted
        : scripted
          ? [scripted]
          : [];
      return resolve({
        data: single ? (rows[0] ?? null) : rows,
        error: null,
      });
    };
    return self;
  }
  return { from: builder } as unknown as SupabaseClient;
}

const OWNER_FLUSH = {
  hermes_run_id: "run-1",
  chain_started_at: "2026-08-18T08:00:00Z",
  sender_tier: 0,
};
const TIER1_FLUSH = { ...OWNER_FLUSH, sender_tier: 1 };
const CARD = { id: "item-1", kind: "card", name: "Amex", masked: "••••4242" };

describe("normalizeHost", () => {
  it("lowercases and strips www", () => {
    expect(normalizeHost(" WWW.Amazon.com ")).toBe("amazon.com");
  });

  it("rejects non-host garbage", () => {
    for (const bad of ["", "evil.example/../..", "a b.com", "https://x.com"]) {
      expect(() => normalizeHost(bad)).toThrow(PurchaseError);
    }
  });
});

describe("resolveActiveTurn", () => {
  it("treats a tier-0 flush chain as owner-initiated", async () => {
    const supabase = fakeSupabase({ agent_runs: null, flush_jobs: OWNER_FLUSH });
    const turn = await resolveActiveTurn(supabase, "user-1");
    expect(turn).toEqual({ runId: "run-1", ownerInitiated: true });
  });

  it("never treats a tier-1 chain as the owner (C20)", async () => {
    const supabase = fakeSupabase({ agent_runs: null, flush_jobs: TIER1_FLUSH });
    const turn = await resolveActiveTurn(supabase, "user-1");
    expect(turn.ownerInitiated).toBe(false);
  });

  it("fails closed on unknown tier (legacy rows)", async () => {
    const supabase = fakeSupabase({
      agent_runs: null,
      flush_jobs: { ...OWNER_FLUSH, sender_tier: null },
    });
    const turn = await resolveActiveTurn(supabase, "user-1");
    expect(turn.ownerInitiated).toBe(false);
  });

  it("treats an open web run as the owner's composer", async () => {
    const supabase = fakeSupabase({
      agent_runs: { hermes_run_id: "run-2", started_at: "2026-08-18T08:05:00Z" },
      flush_jobs: null,
    });
    const turn = await resolveActiveTurn(supabase, "user-1");
    expect(turn).toEqual({ runId: "run-2", ownerInitiated: true });
  });
});

describe("proposePurchaseReview", () => {
  const input = {
    host: "amazon.com",
    itemId: "item-1",
    summary: "2x coffee filters — $18.40 total",
    amountUsd: 18.4,
  };

  it("rejects a tier-1 initiated turn with owner_only", async () => {
    const supabase = fakeSupabase({
      agent_runs: null,
      flush_jobs: TIER1_FLUSH,
      vault_items: CARD,
    });
    await expect(
      proposePurchaseReview(supabase, "user-1", input)
    ).rejects.toMatchObject({ code: "owner_only" });
  });

  it("rejects when the item is not a vault card", async () => {
    const supabase = fakeSupabase({
      agent_runs: null,
      flush_jobs: OWNER_FLUSH,
      vault_items: null,
    });
    await expect(
      proposePurchaseReview(supabase, "user-1", input)
    ).rejects.toMatchObject({ code: "no_card" });
  });

  it("allows at most one open review per site", async () => {
    const supabase = fakeSupabase({
      agent_runs: null,
      flush_jobs: OWNER_FLUSH,
      vault_items: CARD,
      decisions: [{ id: "d0", payload: { host: "amazon.com" } }],
    });
    await expect(
      proposePurchaseReview(supabase, "user-1", input)
    ).rejects.toMatchObject({ code: "review_open", status: 409 });
  });

  it("a different site's open review does not block", async () => {
    const inserts: Record<string, Row[]> = {};
    const supabase = fakeSupabase(
      {
        agent_runs: null,
        flush_jobs: OWNER_FLUSH,
        vault_items: CARD,
        decisions: [{ id: "d0", payload: { host: "ticketmaster.com" } }],
      },
      inserts
    );
    const result = await proposePurchaseReview(supabase, "user-1", input);
    expect(result.decisionId).toBe("decision-1");
    expect(result.amountBand).toBe("under $25");
  });

  it("files a value-free payload and a fill_requested receipt", async () => {
    const inserts: Record<string, Row[]> = {};
    const supabase = fakeSupabase(
      {
        agent_runs: null,
        flush_jobs: OWNER_FLUSH,
        vault_items: CARD,
        decisions: [],
      },
      inserts
    );
    await proposePurchaseReview(supabase, "user-1", input);

    const [event] = inserts.vault_events ?? [];
    expect(event?.action).toBe("fill_requested");
    expect(event?.item_id).toBe("item-1");

    const [decision] = inserts.decisions ?? [];
    expect(decision?.kind).toBe("purchase_review");
    const payload = decision?.payload as Row;
    expect(Object.keys(payload).sort()).toEqual([
      "amount_band",
      "card_masked",
      "card_name",
      "host",
      "item_id",
      "summary",
    ]);
    expect(payload.amount_band).toBe("under $25");
    // No card value ever lands in the decision row (C18).
    expect(JSON.stringify(decision)).not.toMatch(/\b\d{13,19}\b/);
  });
});

describe("resolvePurchaseReview deny path", () => {
  it("writes fill_denied without a box (the owner can always say no)", async () => {
    const inserts: Record<string, Row[]> = {};
    const supabase = fakeSupabase({}, inserts);
    await resolvePurchaseReview(
      supabase,
      "user-1",
      {
        id: "d1",
        ref: "run-1",
        payload: { host: "amazon.com", item_id: "item-1" },
      },
      false,
      null
    );
    const [event] = inserts.vault_events ?? [];
    expect(event?.action).toBe("fill_denied");
    expect(event?.item_id).toBe("item-1");
  });
});

describe("outcomes and dry-run hosts", () => {
  it("outcome vocabulary is exactly the two spec values", () => {
    expect([...PURCHASE_OUTCOMES]).toEqual([
      "purchase_completed",
      "purchase_abandoned",
    ]);
  });

  it("parses SHOPPING_DRY_RUN_HOSTS", () => {
    process.env.SHOPPING_DRY_RUN_HOSTS = " www.Staging.Shop.example, ,test.example ";
    expect(dryRunHosts()).toEqual(["staging.shop.example", "test.example"]);
    delete process.env.SHOPPING_DRY_RUN_HOSTS;
  });
});
