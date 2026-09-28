/**
 * Hosted approval route: signed-link or session auth, value-free view,
 * pending-only resolution through the shared rails, and the failure shapes
 * (expired link → 401, already resolved → 409, foreign decision → 404).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";

interface DecisionRow {
  id: string;
  user_id: string;
  kind: string;
  ref: string | null;
  status: string;
  label: string | null;
  payload: Record<string, unknown>;
}

const db = new FakeSupabase();
let decisionRow: DecisionRow | null = null;

const seedDecision = (row: DecisionRow | null) => {
  decisionRow = row;
  db.tables["decisions"] = row ? [{ ...row }] : [];
};

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.client(),
}));

let sessionUser: string | undefined;
vi.mock("@/lib/auth/user", () => ({
  sessionUserId: () => sessionUser,
}));

const resolvePurchaseReview = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("@/lib/vault/purchase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault/purchase")>();
  return {
    ...actual,
    resolvePurchaseReview: (...args: unknown[]) =>
      resolvePurchaseReview(...args),
  };
});

vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ target: "box-1" })),
  armStopAfter: vi.fn(async () => undefined),
}));

vi.mock("@/lib/miniapps/cards", () => ({
  updateMiniAppCard: vi.fn(async () => undefined),
}));

vi.mock("@/lib/commerce/paymentRequests", () => ({
  approvePaymentRequest: vi.fn(async () => ({ checkoutUrl: "https://s" })),
  dismissPaymentRequest: vi.fn(async () => undefined),
  getPaymentRequest: vi.fn(async () => null),
}));

import { mintApprovalToken } from "@/lib/approvals/token";
import { GET, POST } from "./route";

function getReq(id: string, token?: string) {
  const url = `https://app.wzrd.tech/api/approvals/${id}${token ? `?k=${token}` : ""}`;
  return [
    new NextRequest(url),
    { params: Promise.resolve({ id }) },
  ] as const;
}

function postReq(id: string, body: Record<string, unknown>) {
  return [
    new NextRequest(`https://app.wzrd.tech/api/approvals/${id}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionUser = undefined;
  db.reset();
  db.tables["users"] = [{ id: "user-1", username: "instinct" }];
  seedDecision({
    id: "dec-1",
    user_id: "user-1",
    kind: "purchase_review",
    ref: null,
    status: "pending",
    label: "Approve payment",
    payload: {
      host: "target.com",
      summary: "Pasta night groceries - Target cart (21 items)",
      amount_band: "$100–$500",
      card_name: "Visa Card",
      card_masked: "•••• 3321",
      link_supported: true,
    },
  });
});

describe("GET /api/approvals/[id]", () => {
  it("returns the value-free view for a valid signed link", async () => {
    const token = mintApprovalToken("user-1", "dec-1");
    const response = await GET(...getReq("dec-1", token));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body["kind"]).toBe("purchase_review");
    expect(body["agent"]).toBe("instinct");
    const purchase = body["purchase"] as Record<string, unknown>;
    expect(purchase["host"]).toBe("target.com");
    expect(purchase["amount_band"]).toBe("$100–$500");
    expect(purchase["card_masked"]).toBe("•••• 3321");
    // Value-free: nothing card-shaped beyond the masked tail.
    expect(JSON.stringify(body)).not.toMatch(/\d{12}/);
  });

  it("401s an expired link", async () => {
    const token = mintApprovalToken("user-1", "dec-1", -1);
    const response = await GET(...getReq("dec-1", token));
    expect(response.status).toBe(401);
  });

  it("401s with no link and no session", async () => {
    const response = await GET(...getReq("dec-1"));
    expect(response.status).toBe(401);
  });

  it("falls back to the owner's session", async () => {
    sessionUser = "user-1";
    const response = await GET(...getReq("dec-1"));
    expect(response.status).toBe(200);
  });

  it("404s a token minted for a different decision", async () => {
    const token = mintApprovalToken("user-1", "dec-2");
    const response = await GET(...getReq("dec-1", token));
    expect(response.status).toBe(401);
  });

  it("404s another user's decision even with a valid-shape token", async () => {
    const token = mintApprovalToken("user-2", "dec-1");
    const response = await GET(...getReq("dec-1", token));
    expect(response.status).toBe(404);
  });

  it("404s non-hosted decision kinds", async () => {
    decisionRow!.kind = "email_draft";
    seedDecision(decisionRow);
    const token = mintApprovalToken("user-1", "dec-1");
    const response = await GET(...getReq("dec-1", token));
    expect(response.status).toBe(404);
  });
});

describe("POST /api/approvals/[id]", () => {
  it("approves a pending purchase review through the shared rails", async () => {
    const token = mintApprovalToken("user-1", "dec-1");
    const response = await POST(
      ...postReq("dec-1", { action: "approve", k: token })
    );
    expect(response.status).toBe(200);
    expect(resolvePurchaseReview).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({ id: "dec-1" }),
      true,
      expect.anything(),
      "fill"
    );
    expect(db.updates.some((u) => u.table === "decisions" && u.patch["status"] === "approved")).toBe(true);
  });

  it("declines without needing the box awake", async () => {
    const token = mintApprovalToken("user-1", "dec-1");
    const response = await POST(
      ...postReq("dec-1", { action: "dismiss", k: token })
    );
    expect(response.status).toBe(200);
    expect(resolvePurchaseReview).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.anything(),
      false,
      expect.anything(),
      "fill"
    );
    expect(db.updates.some((u) => u.table === "decisions" && u.patch["status"] === "dismissed")).toBe(true);
  });

  it("409s an already-resolved decision", async () => {
    decisionRow!.status = "approved";
    seedDecision(decisionRow);
    const token = mintApprovalToken("user-1", "dec-1");
    const response = await POST(
      ...postReq("dec-1", { action: "approve", k: token })
    );
    expect(response.status).toBe(409);
    expect(resolvePurchaseReview).not.toHaveBeenCalled();
  });

  it("400s an unknown action", async () => {
    const token = mintApprovalToken("user-1", "dec-1");
    const response = await POST(
      ...postReq("dec-1", { action: "explode", k: token })
    );
    expect(response.status).toBe(400);
  });

  it("401s without auth", async () => {
    const response = await POST(...postReq("dec-1", { action: "approve" }));
    expect(response.status).toBe(401);
    expect(resolvePurchaseReview).not.toHaveBeenCalled();
  });

  it("returns the checkout URL when approving a payment request", async () => {
    seedDecision({
      id: "dec-2",
      user_id: "user-1",
      kind: "payment_request",
      ref: "req-1",
      status: "pending",
      label: null,
      payload: {},
    });
    const token = mintApprovalToken("user-1", "dec-2");
    const response = await POST(
      ...postReq("dec-2", { action: "approve", k: token })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { checkoutUrl?: string };
    expect(body.checkoutUrl).toBe("https://s");
  });
});
