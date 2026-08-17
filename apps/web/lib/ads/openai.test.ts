import { describe, expect, it } from "vitest";
import {
  centsToMicros,
  microsToCents,
  MICROS_PER_CENT,
  OpenAIAdsError,
} from "./openai";

describe("micros/cents boundary", () => {
  it("converts cents to exact micros", () => {
    expect(centsToMicros(0)).toBe(0);
    expect(centsToMicros(1)).toBe(10_000);
    expect(centsToMicros(6)).toBe(60_000);
    expect(centsToMicros(2500)).toBe(25_000_000);
  });

  it("rounds micros to the nearest cent at the boundary", () => {
    expect(microsToCents(59_999)).toBe(6);
    expect(microsToCents(60_000)).toBe(6);
    expect(microsToCents(60_001)).toBe(6);
    expect(microsToCents(54_999)).toBe(5);
    expect(microsToCents(55_000)).toBe(6);
    expect(microsToCents(0)).toBe(0);
    expect(microsToCents(4_999)).toBe(0);
    expect(microsToCents(5_000)).toBe(1);
  });

  it("round-trips whole cents", () => {
    for (const cents of [0, 1, 7, 199, 100_000]) {
      expect(microsToCents(centsToMicros(cents))).toBe(cents);
    }
  });

  it("rejects invalid inputs", () => {
    expect(() => centsToMicros(-1)).toThrow(OpenAIAdsError);
    expect(() => centsToMicros(1.5)).toThrow(OpenAIAdsError);
    expect(() => centsToMicros(Number.NaN)).toThrow(OpenAIAdsError);
    expect(() => microsToCents(-1)).toThrow(OpenAIAdsError);
    expect(() => microsToCents(Number.POSITIVE_INFINITY)).toThrow(
      OpenAIAdsError
    );
    expect(() => microsToCents(Number.NaN)).toThrow(OpenAIAdsError);
  });

  it("keeps the scale constant honest", () => {
    expect(MICROS_PER_CENT).toBe(10_000);
  });
});
