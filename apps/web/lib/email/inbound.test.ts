import { describe, expect, it } from "vitest";
import { parseAddress, stripQuotedHistory } from "./inbound";

describe("stripQuotedHistory", () => {
  it("keeps a plain body untouched", () => {
    expect(stripQuotedHistory("Hello there\nHow are you?")).toBe(
      "Hello there\nHow are you?"
    );
  });

  it("drops Gmail-style quoted history", () => {
    const input = [
      "Sounds good, see you then!",
      "",
      "On Tue, Aug 4, 2026 at 9:00 AM Alice <alice@example.com> wrote:",
      "> Are we still on for Thursday?",
      "> Let me know.",
    ].join("\n");
    expect(stripQuotedHistory(input)).toBe("Sounds good, see you then!");
  });

  it("drops Outlook original-message blocks", () => {
    const input = [
      "Confirmed.",
      "-----Original Message-----",
      "From: bob@example.com",
      "Subject: meeting",
    ].join("\n");
    expect(stripQuotedHistory(input)).toBe("Confirmed.");
  });

  it("drops bare > quoted lines", () => {
    expect(stripQuotedHistory("Reply here\n> old text\n> more old")).toBe(
      "Reply here"
    );
  });
});

describe("parseAddress", () => {
  it("extracts from display-name form", () => {
    expect(parseAddress("Alice Smith <Alice@Example.com>")).toBe(
      "alice@example.com"
    );
  });

  it("passes through bare addresses", () => {
    expect(parseAddress("bob@example.com")).toBe("bob@example.com");
  });
});
