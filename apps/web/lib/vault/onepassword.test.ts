/**
 * 1Password grant keys and item listing: names and ids only, and a key shape
 * the box CLI can re-derive from an `op://` reference.
 */
import { describe, expect, it } from "vitest";
import {
  isOpGrantKey,
  opGrantKey,
  parseOpGrantKey,
  parseOnePasswordLogins,
} from "@/lib/vault/onepassword";

describe("op grant keys", () => {
  it("round-trips and is field-independent", () => {
    const key = opGrantKey("Private", "GitHub");
    expect(key).toBe("op:Private/GitHub");
    expect(parseOpGrantKey(key)).toEqual({ vault: "Private", item: "GitHub" });
    // Same key whether the agent fills username or password.
    expect(opGrantKey("Private", "GitHub")).toBe(key);
  });

  it("rejects anything that is not a well-formed key", () => {
    for (const key of [
      "vault-item-id",
      "op:",
      "op:Private",
      "op:/GitHub",
      "op:Private/",
      "op:Priv/ate/GitHub",
      "op:Private/Git\\Hub",
    ]) {
      expect(isOpGrantKey(key), key).toBe(false);
    }
  });
});

describe("parseOnePasswordLogins", () => {
  it("keeps names/vaults and drops unaddressable entries", () => {
    const stdout = JSON.stringify({
      items: [
        { vault: "Private", item: "GitHub" },
        { vault: "Private", item: "Bank / Joint" },
        { vault: "Private", item: "" },
        { vault: "Private", item: "GitHub" },
        "not-an-object",
      ],
    });
    expect(parseOnePasswordLogins(stdout)).toEqual([
      {
        id: "op:Private/GitHub",
        vault: "Private",
        item: "GitHub",
        ref_prefix: "op://Private/GitHub",
      },
    ]);
  });

  it("keeps names with spaces, which the box CLI can still address", () => {
    const stdout = JSON.stringify({
      items: [{ vault: "Personal Vault", item: "My Bank" }],
    });
    expect(parseOnePasswordLogins(stdout)).toEqual([
      {
        id: "op:Personal Vault/My Bank",
        vault: "Personal Vault",
        item: "My Bank",
        ref_prefix: "op://Personal Vault/My Bank",
      },
    ]);
    expect(isOpGrantKey("op:Personal Vault/My Bank")).toBe(true);
  });

  it("reads as empty when op returns nothing usable", () => {
    expect(parseOnePasswordLogins("")).toEqual([]);
    expect(parseOnePasswordLogins("op: command not found")).toEqual([]);
    expect(parseOnePasswordLogins("{}")).toEqual([]);
    expect(parseOnePasswordLogins("[]")).toEqual([]);
  });
});
