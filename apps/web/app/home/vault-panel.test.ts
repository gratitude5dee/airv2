/**
 * V2 client-side card validation: Luhn + brand-from-IIN, the checks the Add
 * card modal runs before any value leaves the browser.
 */
import { describe, expect, it } from "vitest";
import { cardBrand, luhnValid } from "./vault-panel";

describe("luhnValid", () => {
  it("accepts valid test PANs", () => {
    expect(luhnValid("4242424242424242")).toBe(true);
    expect(luhnValid("378282246310005")).toBe(true); // Amex
    expect(luhnValid("5555555555554444")).toBe(true); // Mastercard
    expect(luhnValid("6011111111111117")).toBe(true); // Discover
  });

  it("rejects invalid numbers", () => {
    expect(luhnValid("4242424242424241")).toBe(false);
    expect(luhnValid("1234")).toBe(false);
    expect(luhnValid("")).toBe(false);
    expect(luhnValid("4242 4242 4242 4242")).toBe(false); // digits only
  });
});

describe("cardBrand", () => {
  it("maps IIN ranges to brands", () => {
    expect(cardBrand("4242424242424242")).toBe("Visa");
    expect(cardBrand("378282246310005")).toBe("Amex");
    expect(cardBrand("341111111111111")).toBe("Amex");
    expect(cardBrand("5555555555554444")).toBe("Mastercard");
    expect(cardBrand("2221000000000009")).toBe("Mastercard");
    expect(cardBrand("6011111111111117")).toBe("Discover");
    expect(cardBrand("9999999999999999")).toBeNull();
  });
});
