import { describe, expect, it } from "vitest";
import { isReservedWord, RESERVED_WORDS } from "./reserved";
import {
  parseGateSettingsRow,
  PublishError,
  slugFor,
  validateAppName,
} from "./publish";
import { parseRegistryApp } from "./registry";

describe("reserved words (both directions)", () => {
  it("reserves platform routes and first-party slugs", () => {
    for (const word of ["admin", "api", "store", "publish", "vault", "todo"]) {
      expect(isReservedWord(word)).toBe(true);
    }
  });
  it("is case-insensitive", () => {
    expect(isReservedWord("Admin")).toBe(true);
    expect(isReservedWord("STORE")).toBe(true);
  });
  it("allows ordinary names", () => {
    expect(isReservedWord("notes")).toBe(false);
    expect(isReservedWord("recipes")).toBe(false);
  });
  it("keeps the list non-empty and lowercase", () => {
    expect(RESERVED_WORDS.size).toBeGreaterThan(10);
    for (const word of RESERVED_WORDS) {
      expect(word).toBe(word.toLowerCase());
    }
  });
});

describe("validateAppName", () => {
  it("rejects reserved app names (app-name direction)", () => {
    expect(() => validateAppName("admin")).toThrowError(PublishError);
    expect(() => validateAppName("vault")).toThrowError(/reserved/);
  });
  it("rejects malformed names", () => {
    for (const bad of [
      "",
      "-lead",
      "trail-",
      "has space",
      "dots.dots",
      "a".repeat(33),
      "../etc",
    ]) {
      expect(() => validateAppName(bad)).toThrowError(PublishError);
    }
  });
  it("normalizes and accepts valid names", () => {
    expect(validateAppName(" Notes ".toLowerCase().trim())).toBe("notes");
    expect(validateAppName("my-app-2")).toBe("my-app-2");
  });
});

describe("published slug shape", () => {
  it("is always <username>-<appname>", () => {
    expect(slugFor("alice", "todo")).toBe("alice-todo");
  });
  it("can never equal a bare reserved word", () => {
    // Usernames are non-empty, so the slug always carries a hyphenated
    // prefix — a bare reserved word like "store" is unreachable.
    for (const word of RESERVED_WORDS) {
      expect(slugFor("alice", word === "" ? "x" : "app")).not.toBe(word);
    }
  });
});

describe("parseRegistryApp", () => {
  const valid = {
    id: "app-1",
    slug: "alice-notes",
    kind: "render",
    owner_user_id: "user-1",
    name: "Notes",
    description: "A notes app",
    icon_key: null,
    publisher_username: "alice",
    publisher_wallet: null,
    agent_identity: null,
    visibility: "public",
    access: "single",
    password_hash: null,
    x402_enabled: false,
    x402_price_usdc: null,
    plugin_signin_enabled: false,
    status: "published",
    bundle_version: "v1",
    listed_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  };

  it("accepts a complete selected row", () => {
    expect(parseRegistryApp(valid)).toEqual(valid);
  });

  it("coerces numeric prices returned as strings", () => {
    expect(
      parseRegistryApp({ ...valid, x402_price_usdc: "0.500000" })
    ).toMatchObject({ x402_price_usdc: 0.5 });
  });

  it("rejects rows with a drifted domain field", () => {
    expect(parseRegistryApp({ ...valid, status: "active" })).toBeNull();
    expect(parseRegistryApp({ ...valid, x402_enabled: "false" })).toBeNull();
  });
});

describe("parseGateSettingsRow", () => {
  it("coerces numeric prices returned as strings", () => {
    expect(
      parseGateSettingsRow({
        id: "app-1",
        owner_user_id: "user-1",
        x402_enabled: true,
        x402_price_usdc: "0.500000",
      })
    ).toEqual({
      id: "app-1",
      owner_user_id: "user-1",
      x402_enabled: true,
      x402_price_usdc: 0.5,
    });
  });

  it("rejects empty numeric strings", () => {
    expect(
      parseGateSettingsRow({
        id: "app-1",
        owner_user_id: "user-1",
        x402_enabled: false,
        x402_price_usdc: "  ",
      })
    ).toBeNull();
  });
});
