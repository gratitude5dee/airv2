import { describe, expect, it } from "vitest";
import { AdminFakeDb } from "@/lib/admin/testing/fakeDb";
import { normalizeAddress, resolveTrustTier } from "./trust";

describe("normalizeAddress", () => {
  it("strips phone formatting down to digits and a leading + (P1-8)", () => {
    expect(normalizeAddress("imessage", "+1 (415) 555-0123")).toBe(
      "+14155550123"
    );
    expect(normalizeAddress("imessage", "415.555.0123")).toBe("4155550123");
    expect(normalizeAddress("imessage", "+14155550123")).toBe("+14155550123");
  });

  it("lowercases email addresses", () => {
    expect(normalizeAddress("email", "Alice@Example.COM")).toBe(
      "alice@example.com"
    );
  });
});

describe("resolveTrustTier", () => {
  const user = "user-1";

  it("returns 0 when the address is one of the user's own handles", async () => {
    const db = new AdminFakeDb();
    db.rows("handles").push({
      user_id: user,
      platform: "imessage",
      address: "+14155550123",
    });
    const tier = await resolveTrustTier(
      db.client(),
      user,
      "imessage",
      "+1 (415) 555-0123"
    );
    expect(tier).toBe(0);
  });

  it("returns the sender row's tier for a known sender", async () => {
    const db = new AdminFakeDb();
    db.rows("senders").push({
      user_id: user,
      platform: "imessage",
      address: "+14155550123",
      trust_tier: 1,
    });
    const tier = await resolveTrustTier(
      db.client(),
      user,
      "imessage",
      "+14155550123"
    );
    expect(tier).toBe(1);
  });

  it("inserts an unknown sender at tier 2 and returns 2", async () => {
    const db = new AdminFakeDb();
    const tier = await resolveTrustTier(
      db.client(),
      user,
      "email",
      "Stranger@Example.com"
    );
    expect(tier).toBe(2);
    expect(db.rows("senders")).toEqual([
      expect.objectContaining({
        user_id: user,
        platform: "email",
        address: "stranger@example.com",
        trust_tier: 2,
      }),
    ]);
  });

  it("fails closed when the senders insert errors — never tier 0", async () => {
    const db = new AdminFakeDb();
    db.errors["senders"] = { message: "relation does not exist" };
    await expect(
      resolveTrustTier(db.client(), user, "imessage", "+14155550123")
    ).rejects.toThrow("senders insert failed");
  });

  it("treats a unique-violation race (23505) as tier 2", async () => {
    const db = new AdminFakeDb();
    db.errors["senders"] = {
      message: "duplicate key value violates unique constraint",
      code: "23505",
    };
    const tier = await resolveTrustTier(
      db.client(),
      user,
      "imessage",
      "+14155550123"
    );
    expect(tier).toBe(2);
  });
});
