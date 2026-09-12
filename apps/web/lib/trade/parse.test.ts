import { describe, expect, it } from "vitest";
import { parseTradeCommand } from "./parse";

describe("parseTradeCommand", () => {
  it("ignores non-trade input", () => {
    expect(parseTradeCommand("hello")).toBeNull();
    expect(parseTradeCommand("/draw something")).toBeNull();
    expect(parseTradeCommand("trade portfolio")).toBeNull();
  });

  it("bare /trade opens the card arm", () => {
    expect(parseTradeCommand("/trade")).toEqual({ kind: "card" });
    expect(parseTradeCommand("  /TRADE  ")).toEqual({ kind: "card" });
  });

  it("parses deterministic arms", () => {
    expect(parseTradeCommand("/trade help")).toEqual({ kind: "help" });
    expect(parseTradeCommand("/trade portfolio")).toEqual({ kind: "portfolio" });
    expect(parseTradeCommand("/trade paper")).toEqual({
      kind: "mode",
      mode: "paper",
    });
    expect(parseTradeCommand("/trade live")).toEqual({
      kind: "mode",
      mode: "live",
    });
    expect(parseTradeCommand("/trade connect")).toEqual({
      kind: "mode",
      mode: "connect",
    });
    expect(parseTradeCommand("/trade orders")).toEqual({
      kind: "orders",
      scope: "recent",
    });
    expect(parseTradeCommand("/trade orders open")).toEqual({
      kind: "orders",
      scope: "open",
    });
    expect(parseTradeCommand("/trade cancel last")).toEqual({
      kind: "cancel",
      ref: "last",
    });
    expect(parseTradeCommand("/trade unwatch SOL")).toEqual({
      kind: "unwatch",
      symbol: "SOL",
    });
  });

  it("parses watch arms in both spellings", () => {
    expect(parseTradeCommand("/trade watch SOL > 200")).toEqual({
      kind: "watch",
      symbol: "SOL",
      op: ">",
      price: "200",
    });
    expect(parseTradeCommand("/trade watch $sol below 45.5")).toEqual({
      kind: "watch",
      symbol: "SOL",
      op: "<",
      price: "45.5",
    });
    expect(parseTradeCommand("/trade watch btc above 100,000")).toEqual({
      kind: "watch",
      symbol: "BTC",
      op: ">",
      price: "100000",
    });
  });

  it("routes freeform text to the agent arm", () => {
    expect(parseTradeCommand("/trade buy $50 of BTC")).toEqual({
      kind: "agent",
      text: "buy $50 of BTC",
    });
    expect(parseTradeCommand("/trade what is my portfolio doing")).toEqual({
      kind: "agent",
      text: "what is my portfolio doing",
    });
    // Malformed watch still becomes an agent turn, not an error.
    expect(parseTradeCommand("/trade watch bananas")).toEqual({
      kind: "agent",
      text: "watch bananas",
    });
  });
});
