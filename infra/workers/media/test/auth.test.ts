import { describe, expect, it } from "vitest";
import { bearerMatches, instanceName } from "../src/auth";

describe("bearerMatches", () => {
  it("accepts only the configured token", async () => {
    expect(await bearerMatches("Bearer s3cret", "s3cret")).toBe(true);
    expect(await bearerMatches("Bearer wrong", "s3cret")).toBe(false);
    expect(await bearerMatches("s3cret", "s3cret")).toBe(false);
    expect(await bearerMatches(null, "s3cret")).toBe(false);
  });

  it("rejects everyone when no token is configured", async () => {
    expect(await bearerMatches("Bearer ", undefined)).toBe(false);
    expect(await bearerMatches("Bearer ", "")).toBe(false);
  });
});

describe("instanceName", () => {
  it("spreads across the configured instance count", () => {
    expect(instanceName("4", () => 0)).toBe("media-0");
    expect(instanceName("4", () => 0.99)).toBe("media-3");
  });

  it("falls back to one instance on a bad count", () => {
    expect(instanceName(undefined, () => 0.99)).toBe("media-0");
    expect(instanceName("nope", () => 0.99)).toBe("media-0");
  });
});
