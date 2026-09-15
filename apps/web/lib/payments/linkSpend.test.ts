import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const command = vi.hoisted(() => vi.fn());
const checkLinkAuth = vi.hoisted(() => vi.fn());
const ensureBoxAwake = vi.hoisted(() => vi.fn());

vi.mock("../box/client", () => ({ command }));
vi.mock("./linkAuth", () => ({
  LINK_CREDENTIALS_PATH: "/home/user/.hermes/link/credentials.json",
  checkLinkAuth,
}));
vi.mock("../orchestrator/boxes", () => ({ ensureBoxAwake }));

import {
  buildLinkSpendCreateCommand,
  createLinkSpendRequest,
  normalizeLinkSpendResponse,
} from "./linkSpend";

const supabase = {} as SupabaseClient;
const input = {
  idempotencyKey: "checkout-123e4567-e89b-12d3-a456-426614174000",
  amountCents: 48_000,
  currency: "usd",
  merchantName: "Tickets Example",
  merchantUrl: "https://tickets.example/checkout/cart-secret?token=secret",
  context:
    "The owner requested two festival tickets. The checkout total, quantity, merchant, taxes, and fees were reviewed before this request.",
  lineItems: [{ name: "Festival ticket", unitAmountCents: 24_000, quantity: 2 }],
  totals: [{ type: "total" as const, label: "Total", amountCents: 48_000 }],
  method: { type: "card" as const },
  test: true,
};

beforeEach(() => {
  command.mockReset();
  checkLinkAuth.mockReset();
  ensureBoxAwake.mockReset();
  ensureBoxAwake.mockResolvedValue({ boxId: "box-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Link spend request adapter", () => {
  it("builds a human-approval request without leaking the cart capability", () => {
    const built = buildLinkSpendCreateCommand(input);

    expect(built).toContain("spend-request create");
    expect(built).toContain("--requestApproval true");
    expect(built).toContain("--test true");
    expect(built).not.toContain("--approve");
    expect(built).toContain("https://tickets.example/");
    expect(built).not.toContain("cart-secret");
    expect(built).not.toContain("token=secret");
    expect(built).toContain("/home/user/.hermes/link/credentials.json");
  });

  it("requires verified steering markers for non-card methods", () => {
    expect(() => buildLinkSpendCreateCommand({
      ...input,
      method: { type: "link_pay_token", merchantAccountId: "acct_123", markerVerified: false },
    })).toThrow("Link Pay Token capability is not verified");
    expect(() => buildLinkSpendCreateCommand({
      ...input,
      method: { type: "shared_payment_token", challengeVerified: false },
    })).toThrow("MPP challenge is not verified");
  });

  it("stays disabled unless the release gate is explicitly enabled", async () => {
    await expect(createLinkSpendRequest(supabase, "owner-1", input)).rejects.toThrow(
      "Link agent payments are disabled",
    );
    expect(checkLinkAuth).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });

  it("fails closed when pairing grants are missing", async () => {
    vi.stubEnv("LINK_AGENT_PAYMENTS_ENABLED", "true");
    checkLinkAuth.mockResolvedValue({
      authenticated: false,
      session_authenticated: true,
      agent_payment_grant: "unknown",
    });

    await expect(createLinkSpendRequest(supabase, "owner-1", input)).rejects.toThrow(
      "Link agent-payment grant is not verified",
    );
    expect(command).not.toHaveBeenCalled();
  });

  it("returns only normalized status metadata from an approved CLI response", async () => {
    vi.stubEnv("LINK_AGENT_PAYMENTS_ENABLED", "true");
    checkLinkAuth.mockResolvedValue({ authenticated: true });
    command.mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify([{
        id: "spr_12345678",
        status: "approved",
        card: { number: "secret-card-canary" },
        shared_payment_token: "secret-token-canary",
      }]),
    });

    const result = await createLinkSpendRequest(supabase, "owner-1", input);

    expect(result).toEqual({
      id: "spr_12345678",
      status: "approved",
      resolution: null,
    });
    expect(JSON.stringify(result)).not.toContain("secret-card-canary");
    expect(JSON.stringify(result)).not.toContain("secret-token-canary");
    expect(command).toHaveBeenCalledWith(
      "box-1",
      expect.stringContaining("--requestApproval true"),
      55,
    );
  });

  it("normalizes provider spelling and unknown outcomes conservatively", () => {
    expect(normalizeLinkSpendResponse([{ id: "spr_12345678", status: "cancelled" }])).toEqual({
      id: "spr_12345678",
      status: "canceled",
      resolution: null,
    });
    expect(normalizeLinkSpendResponse({
      spend_request: {
        id: "spr_abcdefgh",
        status: "mystery",
        next_action: { resolution: "resume" },
      },
    })).toEqual({
      id: "spr_abcdefgh",
      status: "unknown_outcome",
      resolution: "resume",
    });
  });
});
