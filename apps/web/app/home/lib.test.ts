import { describe, expect, it } from "vitest";
import {
  isComputerTool,
  isNearBottom,
  nextMessageId,
  replaceLast,
} from "./lib";
import { clearSwrCache, readSwrCache, writeSwrCache } from "./use-swr";

describe("isComputerTool", () => {
  it("matches browser/computer tool prefixes only", () => {
    expect(isComputerTool("browser_navigate")).toBe(true);
    expect(isComputerTool("computer.screenshot")).toBe(true);
    expect(isComputerTool("bash")).toBe(false);
    expect(isComputerTool(undefined)).toBe(false);
  });
});

describe("isNearBottom (D8)", () => {
  it("is true at the exact bottom", () => {
    expect(
      isNearBottom({ scrollTop: 900, scrollHeight: 1000, clientHeight: 100 })
    ).toBe(true);
  });

  it("is true within the stick threshold", () => {
    expect(
      isNearBottom({ scrollTop: 860, scrollHeight: 1000, clientHeight: 100 })
    ).toBe(true);
  });

  it("is false once the user scrolls up past the threshold", () => {
    expect(
      isNearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 100 })
    ).toBe(false);
  });

  it("respects a custom threshold", () => {
    const el = { scrollTop: 700, scrollHeight: 1000, clientHeight: 100 };
    expect(isNearBottom(el, 200)).toBe(true);
    expect(isNearBottom(el, 100)).toBe(false);
  });
});

describe("nextMessageId (D11)", () => {
  it("returns unique ids", () => {
    const a = nextMessageId();
    const b = nextMessageId();
    expect(a).not.toEqual(b);
  });
});

describe("replaceLast (D11)", () => {
  it("replaces the last entry while keeping its id", () => {
    const list = [
      { id: "a", text: "hi" },
      { id: "b", text: "" },
    ];
    const next = replaceLast(list, { text: "streamed" });
    expect(next).toEqual([
      { id: "a", text: "hi" },
      { id: "b", text: "streamed" },
    ]);
    expect(list[1]?.text).toBe(""); // input untouched
  });

  it("is a no-op on an empty list", () => {
    const empty: { id: string; text: string }[] = [];
    expect(replaceLast(empty, { text: "x" })).toEqual([]);
  });
});

describe("swr cache (D6)", () => {
  it("round-trips values and clears on null", () => {
    clearSwrCache();
    expect(readSwrCache("k")).toBeNull();
    writeSwrCache("k", [1, 2, 3]);
    expect(readSwrCache<number[]>("k")).toEqual([1, 2, 3]);
    writeSwrCache("k", null);
    expect(readSwrCache("k")).toBeNull();
  });
});
