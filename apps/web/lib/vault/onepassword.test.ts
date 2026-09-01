/**
 * 1Password grant keys and item listing: opaque item ids are the identity
 * (so duplicate titles stay distinct); vault/title strings are labels only.
 */
import { describe, expect, it } from "vitest";
import {
  isOpGrantKey,
  opGrantKey,
  parseOpGrantKey,
  parseOnePasswordLogins,
} from "@/lib/vault/onepassword";

const VAULT_ID = "v".repeat(25) + "1";
const ITEM_ID = "i".repeat(25) + "1";
const ITEM_ID_2 = "i".repeat(25) + "2";

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ITEM_ID,
    vault: "Private",
    item: "GitHub",
    ref_prefix: `op://${VAULT_ID}/${ITEM_ID}`,
    ...overrides,
  };
}

describe("op grant keys", () => {
  it("round-trips and is field-independent", () => {
    const key = opGrantKey(ITEM_ID);
    expect(key).toBe(`op:${ITEM_ID}`);
    expect(parseOpGrantKey(key)).toEqual({ itemId: ITEM_ID });
    // Same key whether the agent fills username or password.
    expect(opGrantKey(ITEM_ID)).toBe(key);
  });

  it("rejects anything that is not a well-formed id key", () => {
    for (const key of [
      "vault-item-id",
      "op:",
      `op:${ITEM_ID.slice(1)}`, // too short
      `op:${ITEM_ID}x`, // too long
      `op:${ITEM_ID.toUpperCase()}`,
      // The retired name-derived shapes must no longer be grantable.
      "op:Private/GitHub",
      "op:Personal Vault/My Bank",
    ]) {
      expect(isOpGrantKey(key), key).toBe(false);
    }
  });
});

describe("parseOnePasswordLogins", () => {
  it("keys on the item id and keeps names as labels", () => {
    const stdout = JSON.stringify({
      items: [entry(), "not-an-object"],
    });
    expect(parseOnePasswordLogins(stdout)).toEqual([
      {
        id: `op:${ITEM_ID}`,
        vault: "Private",
        item: "GitHub",
        ref_prefix: `op://${VAULT_ID}/${ITEM_ID}`,
      },
    ]);
  });

  it("keeps duplicate titles distinct by id", () => {
    const stdout = JSON.stringify({
      items: [
        entry(),
        entry({ id: ITEM_ID_2, ref_prefix: `op://${VAULT_ID}/${ITEM_ID_2}` }),
      ],
    });
    const items = parseOnePasswordLogins(stdout);
    expect(items.map((item) => item.id)).toEqual([
      `op:${ITEM_ID}`,
      `op:${ITEM_ID_2}`,
    ]);
    expect(items.map((item) => item.item)).toEqual(["GitHub", "GitHub"]);
  });

  it("keeps labels with spaces or slashes — they never enter the key", () => {
    const stdout = JSON.stringify({
      items: [entry({ vault: "Personal Vault", item: "Bank / Joint" })],
    });
    expect(parseOnePasswordLogins(stdout)).toEqual([
      {
        id: `op:${ITEM_ID}`,
        vault: "Personal Vault",
        item: "Bank / Joint",
        ref_prefix: `op://${VAULT_ID}/${ITEM_ID}`,
      },
    ]);
  });

  it("drops entries without a valid id-form reference", () => {
    for (const bad of [
      entry({ id: "short" }),
      entry({ id: undefined }),
      entry({ ref_prefix: "op://Private/GitHub" }), // name-form ref
      entry({ ref_prefix: `op://${VAULT_ID}/${ITEM_ID_2}` }), // id mismatch
      entry({ item: "" }),
      entry({ vault: "" }),
    ]) {
      expect(
        parseOnePasswordLogins(JSON.stringify({ items: [bad] })),
        JSON.stringify(bad)
      ).toEqual([]);
    }
  });

  it("reads as empty when op returns nothing usable", () => {
    expect(parseOnePasswordLogins("")).toEqual([]);
    expect(parseOnePasswordLogins("op: command not found")).toEqual([]);
    expect(parseOnePasswordLogins("{}")).toEqual([]);
    expect(parseOnePasswordLogins("[]")).toEqual([]);
  });
});
