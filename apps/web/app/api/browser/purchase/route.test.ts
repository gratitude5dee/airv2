/**
 * R-TQ-06: V6 shopping gates — gateway-token auth, the offer-the-fill
 * propose lane (owner-initiated, one open review per site, amount stored
 * as a band only), the redemption-gated audit report, and outcomes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const responses: Record<string, { data: unknown; error: unknown }[]> = {};
  function next(table: string, terminal: string) {
    return (
      responses[`${table}:${terminal}`]?.shift() ??
      responses[`${table}:always`]?.[0] ?? { data: null, error: null }
    );
  }
  function chain(table: string): Record<string, (...args: unknown[]) => unknown> {
    const ops: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "is",
      "not",
      "gt",
      "gte",
      "lt",
      "lte",
      "order",
      "limit",
    ]) {
      ops[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return ops;
      };
    }
    for (const terminal of ["single", "maybeSingle"]) {
      ops[terminal] = async () => next(table, terminal);
    }
    // Awaiting a chain without a terminal resolves {data:[],error:null}
    // unless the test queued rows under `<table>:rows`.
    ops["then"] = ((resolve: (v: unknown) => unknown) =>
      Promise.resolve(next(table, "rows")).then(resolve)) as (
      ...args: unknown[]
    ) => unknown;
    return ops;
  }
  return { calls, responses, client: { from: (t: string) => chain(t) } };
});

const appendVaultEvent = vi.hoisted(() => vi.fn(async () => undefined));
const reconcileMirror = vi.hoisted(() => vi.fn(async () => [] as unknown[]));
const mintApprovalUrl = vi.hoisted(() => vi.fn(() => "https://app.example/approve/tok"));
const sendMiniAppCard = vi.hoisted(() => vi.fn(async () => undefined));
const claimCardSend = vi.hoisted(() => vi.fn(async () => null));
const hostSupportsLink = vi.hoisted(() => vi.fn(async () => false));

vi.mock("@/lib/supabase", () => ({ serviceClient: () => state.client }));
vi.mock("@/lib/vault/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault/client")>();
  return { ...actual, appendVaultEvent, reconcileMirror };
});
vi.mock("@/lib/approvals/token", () => ({ mintApprovalUrl }));
vi.mock("@/lib/miniapps/cards", () => ({ sendMiniAppCard }));
vi.mock("@/lib/miniapps/cardSends", () => ({ claimCardSend }));
vi.mock("@/lib/payments/link", () => ({ hostSupportsLink }));
vi.mock("@/lib/box/client", () => ({
  command: vi.fn(async () => ({ exitCode: 0 })),
  writeFile: vi.fn(async () => undefined),
}));
vi.mock("@/lib/hermes/client", () => ({
  approveRun: vi.fn(async () => undefined),
}));

import { GET, POST } from "./route";

const CARD_ID = "card.1";
const DECISION_ID = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-09-25T12:00:00.000Z";

function authed(body?: unknown): NextRequest {
  return new NextRequest("https://app.example/api/browser/purchase", {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: "Bearer gw-token",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function ownerRun(): void {
  state.responses["agent_runs:maybeSingle"] = [
    { data: { hermes_run_id: "run.1", started_at: NOW }, error: null },
  ];
}

function propose(body: Record<string, unknown>): Promise<Response> {
  return POST(authed({ action: "propose", ...body }));
}

beforeEach(() => {
  vi.clearAllMocks();
  state.calls.length = 0;
  for (const key of Object.keys(state.responses)) delete state.responses[key];
  state.responses["boxes:always"] = [
    { data: { user_id: "user-1", provider_box_id: "box-1" }, error: null },
  ];
  state.responses["flush_jobs:always"] = [{ data: null, error: null }];
  state.responses["agent_runs:always"] = [{ data: null, error: null }];
  state.responses["decisions:single"] = [{ data: { id: DECISION_ID }, error: null }];
});

describe("POST /api/browser/purchase", () => {
  it("rejects callers without a box token", async () => {
    const anon = new NextRequest("https://app.example/api/browser/purchase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "propose" }),
    });
    expect((await POST(anon)).status).toBe(401);
    // Unknown token — no boxes row.
    state.responses["boxes:always"] = [{ data: null, error: null }];
    expect((await propose({ host: "x.com", item_id: "i", summary: "s" })).status).toBe(401);
  });

  it("rejects propose for a host the owner never initiated (no open run)", async () => {
    // Neither agent_runs nor flush_jobs has a live row → not owner-initiated.
    const response = await propose({
      host: "shop.example.com",
      item_id: CARD_ID,
      summary: "Black shoes",
      amount_usd: 79,
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "owner_only" });
    expect(state.calls.some((c) => c.method === "insert")).toBe(false);
  });

  it("rejects propose for a card that is not in the vault", async () => {
    ownerRun();
    const response = await propose({
      host: "shop.example.com",
      item_id: "card.missing",
      summary: "Black shoes",
      amount_usd: 79,
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "no_card" });
  });

  it("files the purchase_review decision with banded (never exact) amount", async () => {
    ownerRun();
    state.responses["vault_items:always"] = [
      { data: { id: CARD_ID, kind: "card", name: "Visa", masked: "•••• 4242" }, error: null },
    ];
    state.responses["decisions:rows"] = [{ data: [], error: null }];
    const response = await propose({
      host: "www.Shop.Example.com",
      item_id: CARD_ID,
      summary: "Black shoes",
      amount_usd: 79,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, decision_id: DECISION_ID });

    const insert = state.calls.find(
      (c) => c.table === "decisions" && c.method === "insert"
    );
    expect(insert?.args[0]).toMatchObject({
      user_id: "user-1",
      kind: "purchase_review",
      ref: "run.1",
    });
    const payload = (insert?.args[0] as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({
      host: "shop.example.com",
      item_id: CARD_ID,
      card_name: "Visa",
      card_masked: "•••• 4242",
    });
    expect(payload["amount_band"]).not.toContain("79");
    expect(mintApprovalUrl).toHaveBeenCalledWith("user-1", DECISION_ID);
    expect(appendVaultEvent).toHaveBeenCalledWith(
      state.client,
      "user-1",
      "fill_requested",
      CARD_ID,
      expect.stringContaining("shop.example.com:")
    );
  });

  it("a tampered amount never carries a figure — band collapses to 'unknown amount'", async () => {
    ownerRun();
    state.responses["vault_items:always"] = [
      { data: { id: CARD_ID, kind: "card", name: "Visa", masked: null }, error: null },
    ];
    state.responses["decisions:rows"] = [{ data: [], error: null }];
    const response = await propose({
      host: "shop.example.com",
      item_id: CARD_ID,
      summary: "s",
      amount_usd: "4999.00", // string, not a number — the tampered case
    });
    expect(response.status).toBe(200);
    const insert = state.calls.find(
      (c) => c.table === "decisions" && c.method === "insert"
    );
    expect(
      (insert?.args[0] as { payload: Record<string, unknown> }).payload["amount_band"]
    ).toBe("unknown amount");
  });

  it("rejects a second open review for the same site", async () => {
    ownerRun();
    state.responses["vault_items:always"] = [
      { data: { id: CARD_ID, kind: "card", name: "Visa", masked: null }, error: null },
    ];
    state.responses["decisions:rows"] = [
      { data: [{ id: "d-open", payload: { host: "shop.example.com" } }], error: null },
    ];
    const response = await propose({
      host: "shop.example.com",
      item_id: CARD_ID,
      summary: "s",
      amount_usd: 10,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "review_open" });
  });

  it("report lines are 403 without an owner-redeemed fill ticket", async () => {
    const response = await POST(
      authed({
        action: "report",
        item_id: CARD_ID,
        host: "shop.example.com",
        field_groups: ["number"],
      })
    );
    expect(response.status).toBe(403);
    expect(appendVaultEvent).not.toHaveBeenCalled();
  });

  it("report writes one deduped value-free audit line per group", async () => {
    state.responses["fill_ticket_redemptions:always"] = [
      { data: { jti: "jti-1", redeemed_at: NOW }, error: null },
    ];
    state.responses["vault_events:rows"] = [
      { data: [{ context: "number@shop.example.com" }], error: null },
    ];
    const response = await POST(
      authed({
        action: "report",
        item_id: CARD_ID,
        host: "shop.example.com",
        field_groups: ["number", "cvv", "not-a-group"],
      })
    );
    expect(response.status).toBe(200);
    // "number" already reported for this redemption → only "cvv" lands;
    // "not-a-group" is filtered out before it could ever be written.
    expect(appendVaultEvent).toHaveBeenCalledTimes(1);
    expect(appendVaultEvent).toHaveBeenCalledWith(
      state.client,
      "user-1",
      "fill_approved",
      CARD_ID,
      "cvv@shop.example.com"
    );
  });

  it("records a purchase outcome on the active run", async () => {
    ownerRun();
    state.responses["agent_runs:rows"] = [{ data: [{ id: "r1" }], error: null }];
    const response = await POST(
      authed({ action: "outcome", outcome: "purchase_completed" })
    );
    expect(response.status).toBe(200);
    expect(
      state.calls.some(
        (c) =>
          c.table === "agent_runs" &&
          c.method === "update" &&
          (c.args[0] as { outcome?: string }).outcome === "purchase_completed"
      )
    ).toBe(true);
  });
});

describe("GET /api/browser/purchase", () => {
  it("returns card metadata plus open review hosts", async () => {
    state.responses["vault_items:rows"] = [
      {
        data: [
          { id: CARD_ID, name: "Visa", masked: "•••• 4242" },
          { id: "card.2", name: "Amex", masked: null },
        ],
        error: null,
      },
    ];
    state.responses["decisions:rows"] = [
      { data: [{ payload: { host: "open.example.com" } }, { payload: {} }], error: null },
    ];
    reconcileMirror.mockResolvedValue([
      { id: CARD_ID, kind: "card", name: "Visa", masked: "•••• 4242" },
    ]);
    const response = await GET(authed());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cards: [{ id: CARD_ID, name: "Visa", masked: "•••• 4242" }],
      open_review_hosts: ["open.example.com"],
    });
    expect(reconcileMirror).toHaveBeenCalledWith(state.client, "box-1", "user-1", [
      CARD_ID,
      "card.2",
    ]);
  });

  it("rejects callers without a box token", async () => {
    state.responses["boxes:always"] = [{ data: null, error: null }];
    expect((await GET(authed())).status).toBe(401);
  });
});
