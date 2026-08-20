import { describe, expect, it } from "vitest";
import { normalizeAddress } from "./trust";

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
