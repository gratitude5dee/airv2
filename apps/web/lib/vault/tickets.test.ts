/**
 * V6 fill tickets (C20/C18): the mini-app token discipline applied to card
 * fills — HMAC round trip, tamper/expiry/scope rejection, single-use
 * redemption, TTL cap, and the closed decision-kind vocabulary staying in
 * lockstep across migration + Needs-you renderer + iMessage card renderer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  amountBand,
  mintFillTicket,
  redeemFillTicket,
  verifyFillTicket,
  MAX_TTL_MINUTES,
  type FillTicketClaims,
} from "./tickets";

beforeAll(() => {
  process.env.MINIAPP_SIGNING_KEY = "test-signing-key";
});

describe("amountBand", () => {
  it("bands amounts without ever carrying the exact figure", () => {
    expect(amountBand(10)).toBe("under $25");
    expect(amountBand(25)).toBe("$25–$100");
    expect(amountBand(99.99)).toBe("$25–$100");
    expect(amountBand(100)).toBe("$100–$500");
    expect(amountBand(1999)).toBe("$500–$2,000");
    expect(amountBand(5000)).toBe("over $2,000");
    expect(amountBand(Number.NaN)).toBe("unknown amount");
    expect(amountBand(-1)).toBe("unknown amount");
  });
});

describe("fill tickets", () => {
  it("round-trips scoped claims", () => {
    const { token, claims } = mintFillTicket(
      "user-1",
      "item-1",
      "www.Amazon.com",
      "$25–$100"
    );
    expect(claims.host).toBe("amazon.com");
    const verified = verifyFillTicket(token, "user-1");
    expect(verified?.itemId).toBe("item-1");
    expect(verified?.host).toBe("amazon.com");
    expect(verified?.amountBand).toBe("$25–$100");
    expect(verified?.jti).toBe(claims.jti);
  });

  it("caps the TTL at 10 minutes even when asked for more", () => {
    const { claims } = mintFillTicket(
      "user-1",
      "item-1",
      "amazon.com",
      "under $25",
      60
    );
    const now = Math.floor(Date.now() / 1000);
    expect(claims.exp).toBeLessThanOrEqual(now + MAX_TTL_MINUTES * 60);
  });

  it("rejects a tampered payload", () => {
    const { token } = mintFillTicket("user-1", "item-1", "amazon.com", "b");
    const dot = token.lastIndexOf(".");
    const claims = JSON.parse(
      Buffer.from(token.slice(0, dot), "base64url").toString("utf8")
    ) as FillTicketClaims;
    claims.host = "evil.example";
    const forged = `${Buffer.from(JSON.stringify(claims)).toString("base64url")}${token.slice(dot)}`;
    expect(verifyFillTicket(forged, "user-1")).toBeNull();
  });

  it("rejects another user's ticket", () => {
    const { token } = mintFillTicket("user-1", "item-1", "amazon.com", "b");
    expect(verifyFillTicket(token, "user-2")).toBeNull();
  });

  it("rejects an expired ticket", () => {
    const { token } = mintFillTicket(
      "user-1",
      "item-1",
      "amazon.com",
      "b",
      -1
    );
    expect(verifyFillTicket(token, "user-1")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyFillTicket("", "user-1")).toBeNull();
    expect(verifyFillTicket("not-a-ticket", "user-1")).toBeNull();
  });
});

type InsertResult = { error: { code: string; message: string } | null };

function fakeLedger(results: InsertResult[]): {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<InsertResult>;
  };
  rows: Record<string, unknown>[];
} {
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        expect(table).toBe("fill_ticket_redemptions");
        rows.push(row);
        return results.shift() ?? { error: null };
      },
    }),
  };
}

describe("redemption ledger", () => {
  const claims: FillTicketClaims = {
    use: "fill_ticket",
    userId: "user-1",
    itemId: "item-1",
    host: "amazon.com",
    amountBand: "$25–$100",
    jti: "jti-1",
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  it("first redemption wins, replay is rejected", async () => {
    const ledger = fakeLedger([
      { error: null },
      { error: { code: "23505", message: "duplicate key" } },
    ]);
    const supabase = ledger as unknown as Parameters<
      typeof redeemFillTicket
    >[0];
    expect(await redeemFillTicket(supabase, claims)).toBe(true);
    expect(await redeemFillTicket(supabase, claims)).toBe(false);
  });

  it("stores only value-free scope columns", async () => {
    const ledger = fakeLedger([{ error: null }]);
    const supabase = ledger as unknown as Parameters<
      typeof redeemFillTicket
    >[0];
    await redeemFillTicket(supabase, claims);
    expect(Object.keys(ledger.rows[0]!).sort()).toEqual([
      "amount_band",
      "host",
      "item_id",
      "jti",
      "user_id",
    ]);
  });

  it("surfaces unexpected database errors", async () => {
    const ledger = fakeLedger([
      { error: { code: "57014", message: "canceled" } },
    ]);
    const supabase = ledger as unknown as Parameters<
      typeof redeemFillTicket
    >[0];
    await expect(redeemFillTicket(supabase, claims)).rejects.toThrow(
      "redemption failed"
    );
  });
});

describe("purchase_review closed vocabulary", () => {
  // Decision kinds move together: migration check constraint, the web
  // Needs-you renderer, and the iMessage vault card renderer must all know
  // the kind, or the surface silently drops the owner's approval.
  const root = join(__dirname, "..", "..");

  it("is in the decisions kind check constraint", () => {
    const migration = readFileSync(
      join(root, "..", "..", "supabase", "migrations", "0026_browser_social.sql"),
      "utf8"
    );
    expect(migration).toContain("'purchase_review'");
  });

  it("is rendered by the web Needs-you surface", () => {
    const page = readFileSync(join(root, "app", "home", "page.tsx"), "utf8");
    expect(page).toContain('"purchase_review"');
  });

  it("is rendered by the iMessage mini-app surface", () => {
    const mini = readFileSync(
      join(root, "app", "mini", "[app]", "route.ts"),
      "utf8"
    );
    expect(mini).toContain("purchase_review");
  });
});
