/**
 * Vault mutation body schemas: unknown keys, bad kinds and malformed cards are
 * rejected at the edge, before anything reaches the box.
 */
import { describe, expect, it } from "vitest";
import {
  vaultCreateBodySchema,
  vaultDeleteBodySchema,
  vaultRevealBodySchema,
  vaultUpdateBodySchema,
} from "./schema";

const CARD = {
  number: "4242424242424242",
  expiry_month: "07",
  expiry_year: "2030",
  cvv: "123",
};

describe("vaultCreateBodySchema", () => {
  it("accepts a login and a complete card", () => {
    expect(
      vaultCreateBodySchema.safeParse({
        item: { kind: "login", name: "Mail", fields: { password: "p" } },
      }).success
    ).toBe(true);
    expect(
      vaultCreateBodySchema.safeParse({
        item: { kind: "card", name: "Amex", fields: CARD },
      }).success
    ).toBe(true);
  });

  it("rejects unknown kinds, unknown keys and missing names", () => {
    for (const item of [
      { kind: "wallet", name: "x" },
      { kind: "note", name: "x", extra: 1 },
      { kind: "note", name: "  " },
    ]) {
      expect(vaultCreateBodySchema.safeParse({ item }).success).toBe(false);
    }
    expect(
      vaultCreateBodySchema.safeParse({ item: { kind: "note", name: "n" }, x: 1 })
        .success
    ).toBe(false);
  });

  it("rejects an incomplete or malformed card", () => {
    expect(
      vaultCreateBodySchema.safeParse({
        item: { kind: "card", name: "c", fields: { number: CARD.number } },
      }).success
    ).toBe(false);
    expect(
      vaultCreateBodySchema.safeParse({
        item: { kind: "card", name: "c", fields: { ...CARD, cvv: "1" } },
      }).success
    ).toBe(false);
  });

  it("rejects malformed field and env var names", () => {
    expect(
      vaultCreateBodySchema.safeParse({
        item: { kind: "note", name: "n", fields: { "Bad Name": "v" } },
      }).success
    ).toBe(false);
    expect(
      vaultCreateBodySchema.safeParse({
        item: { kind: "api_key", name: "k", env_var: "lower-case" },
      }).success
    ).toBe(false);
    expect(
      vaultCreateBodySchema.safeParse({
        item: { kind: "api_key", name: "k", env_var: "OPENAI_API_KEY" },
      }).success
    ).toBe(true);
  });
});

describe("vaultUpdateBodySchema", () => {
  it("accepts a partial card patch and a field deletion", () => {
    expect(
      vaultUpdateBodySchema.safeParse({
        id: "itm_1",
        item: { kind: "card", fields: { cvv: "456" } },
      }).success
    ).toBe(true);
    expect(
      vaultUpdateBodySchema.safeParse({
        id: "itm_1",
        item: { fields: { password: null } },
      }).success
    ).toBe(true);
  });

  it("rejects an empty patch, a bad id and a malformed card field", () => {
    expect(
      vaultUpdateBodySchema.safeParse({ id: "itm_1", item: {} }).success
    ).toBe(false);
    expect(
      vaultUpdateBodySchema.safeParse({ id: "../x", item: { name: "n" } }).success
    ).toBe(false);
    expect(
      vaultUpdateBodySchema.safeParse({
        id: "itm_1",
        item: { kind: "card", fields: { expiry_year: "30" } },
      }).success
    ).toBe(false);
  });
});

describe("id and reveal bodies", () => {
  it("constrain ids and reveal field names", () => {
    expect(vaultDeleteBodySchema.safeParse({ id: "itm_1" }).success).toBe(true);
    expect(vaultDeleteBodySchema.safeParse({ id: "" }).success).toBe(false);
    expect(vaultRevealBodySchema.safeParse({ field: "password" }).success).toBe(
      true
    );
    expect(vaultRevealBodySchema.safeParse({ field: "Pass word" }).success).toBe(
      false
    );
  });
});
