/**
 * Structural card validation (C18): shape checks only, and issue strings must
 * never echo a field value.
 */
import { describe, expect, it } from "vitest";
import {
  cardFieldsIssue,
  normalizeExpiryYear,
  paymentCardBrand,
} from "./payment-card";

const COMPLETE = {
  cardholder: "Ada Lovelace",
  number: "4242424242424242",
  expiry_month: "07",
  expiry_year: "2030",
  cvv: "123",
  zip: "94110",
};

describe("cardFieldsIssue", () => {
  it("accepts a complete card", () => {
    expect(cardFieldsIssue(COMPLETE, true)).toBeNull();
  });

  it("requires number, expiration and security code on create", () => {
    for (const missing of ["number", "expiry_month", "expiry_year", "cvv"]) {
      const fields = { ...COMPLETE } as Record<string, string | null>;
      delete fields[missing];
      expect(cardFieldsIssue(fields, true)).toBe(`missing card field: ${missing}`);
    }
  });

  it("does not require a complete card on a patch", () => {
    expect(cardFieldsIssue({ zip: "10001" }, false)).toBeNull();
  });

  it("rejects malformed fields by name only", () => {
    expect(cardFieldsIssue({ ...COMPLETE, cvv: "12" }, true)).toBe(
      "invalid card field: cvv"
    );
    expect(cardFieldsIssue({ ...COMPLETE, expiry_month: "13" }, true)).toBe(
      "invalid card field: expiry_month"
    );
    expect(cardFieldsIssue({ ...COMPLETE, expiry_year: "303" }, true)).toBe(
      "invalid card field: expiry_year"
    );
    expect(cardFieldsIssue({ number: "4242 4242 4242 4242" }, false)).toBe(
      "invalid card field: number"
    );
  });

  it("accepts the two-digit year printed on a card", () => {
    expect(cardFieldsIssue({ ...COMPLETE, expiry_year: "30" }, true)).toBeNull();
    expect(normalizeExpiryYear("30")).toBe("2030");
    expect(normalizeExpiryYear("2030")).toBe("2030");
  });

  it("rejects a PAN that fails the Luhn check", () => {
    expect(cardFieldsIssue({ ...COMPLETE, number: "4242424242424241" }, true)).toBe(
      "card number failed the Luhn check"
    );
  });

  it("never quotes a value in the issue string", () => {
    const issue = cardFieldsIssue({ ...COMPLETE, cvv: "99999" }, true);
    expect(issue).not.toContain("99999");
  });

  it("ignores non-card and cleared fields", () => {
    expect(cardFieldsIssue({ ...COMPLETE, note: "x" }, true)).toBeNull();
    expect(cardFieldsIssue({ zip: null }, false)).toBeNull();
  });
});

describe("paymentCardBrand", () => {
  it("maps IIN ranges", () => {
    expect(paymentCardBrand("4242424242424242")).toBe("Visa");
    expect(paymentCardBrand("378282246310005")).toBe("Amex");
    expect(paymentCardBrand("5555555555554444")).toBe("Mastercard");
    expect(paymentCardBrand("2223003122003222")).toBe("Mastercard");
    expect(paymentCardBrand("6011111111111117")).toBe("Discover");
    expect(paymentCardBrand("9999999999999999")).toBeNull();
  });
});
