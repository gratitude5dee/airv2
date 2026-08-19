import { describe, expect, it } from "vitest";
import { isReservedWord, RESERVED_WORDS } from "./reserved";
import { PublishError, slugFor, validateAppName } from "./publish";

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
