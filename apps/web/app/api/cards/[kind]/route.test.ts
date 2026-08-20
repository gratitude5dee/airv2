/**
 * Generic agent card route: kind validation against the registered card
 * kinds, gateway-token auth, owner-destination requirement, per-kind
 * cooldown, and claim release on delivery failure.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const boxRow = { user_id: "owner-1" };
let destRow: { space_id: string; phone: string } | null = {
  space_id: "space-1",
  phone: "+15550001111",
};
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: (table: string) => {
      if (table === "boxes") {
        const chain = {
          select: () => chain,
          eq: (_col: string, token: string) => ({
            maybeSingle: async () => ({
              data: token === "good-token" ? boxRow : null,
            }),
          }),
        };
        return chain;
      }
      if (table === "imessage_destinations") {
        const chain = {
          select: () => chain,
          eq: () => ({ maybeSingle: async () => ({ data: destRow }) }),
        };
        return chain;
      }
      throw new Error(`fake supabase: unexpected table ${table}`);
    },
  }),
}));

const sendMiniAppCard = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("@/lib/miniapps/cards", () => ({
  sendMiniAppCard: (...args: unknown[]) => sendMiniAppCard(...args),
}));

const release = vi.fn(async () => undefined);
const claimCardSend = vi.fn(
  async (
    ..._args: unknown[]
  ): Promise<{ release: () => Promise<void> } | undefined> => ({ release })
);
vi.mock("@/lib/miniapps/cardSends", () => ({
  claimCardSend: (...args: unknown[]) => claimCardSend(...args),
}));

import { POST } from "./route";

function post(kind: string, token?: string): [NextRequest, { params: Promise<{ kind: string }> }] {
  return [
    new NextRequest(`https://air.example/api/cards/${kind}`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
    { params: Promise.resolve({ kind }) },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  destRow = { space_id: "space-1", phone: "+15550001111" };
  claimCardSend.mockResolvedValue({ release });
});

describe("POST /api/cards/[kind]", () => {
  it("rejects unknown kinds before any auth work", async () => {
    const response = await POST(...post("not-an-app", "good-token"));
    expect(response.status).toBe(404);
    expect(claimCardSend).not.toHaveBeenCalled();
  });

  it("401s without a bearer token", async () => {
    const response = await POST(...post("pay"));
    expect(response.status).toBe(401);
  });

  it("401s on a token that matches no box", async () => {
    const response = await POST(...post("pay", "bad-token"));
    expect(response.status).toBe(401);
    expect(sendMiniAppCard).not.toHaveBeenCalled();
  });

  it("409s when the owner has no imessage destination", async () => {
    destRow = null;
    const response = await POST(...post("pay", "good-token"));
    expect(response.status).toBe(409);
    expect(claimCardSend).not.toHaveBeenCalled();
  });

  it("429s while the per-kind cooldown holds", async () => {
    claimCardSend.mockResolvedValue(undefined);
    const response = await POST(...post("todo", "good-token"));
    expect(response.status).toBe(429);
    expect(sendMiniAppCard).not.toHaveBeenCalled();
  });

  it("sends the owner-scoped card for a registered kind", async () => {
    const response = await POST(...post("inbox", "good-token"));
    expect(response.status).toBe(200);
    expect(claimCardSend).toHaveBeenCalledWith(
      expect.anything(),
      "owner-1",
      "inbox"
    );
    expect(sendMiniAppCard).toHaveBeenCalledWith(
      "space-1",
      "+15550001111",
      "owner-1",
      "inbox",
      "default"
    );
  });

  it("sends the ads card (Phase 3: dead kind comes alive)", async () => {
    const response = await POST(...post("ads", "good-token"));
    expect(response.status).toBe(200);
    expect(claimCardSend).toHaveBeenCalledWith(
      expect.anything(),
      "owner-1",
      "ads"
    );
    expect(sendMiniAppCard).toHaveBeenCalledWith(
      "space-1",
      "+15550001111",
      "owner-1",
      "ads",
      "default"
    );
  });

  it("releases the claim and 502s when delivery fails", async () => {
    sendMiniAppCard.mockRejectedValueOnce(new Error("spectrum down"));
    const response = await POST(...post("kanban", "good-token"));
    expect(response.status).toBe(502);
    expect(release).toHaveBeenCalled();
  });
});
