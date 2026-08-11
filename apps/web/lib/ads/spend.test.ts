import { describe, expect, it } from "vitest";
import { ceilingAllows, exposure30dCents } from "./spend";
import { requestedExposureCents } from "./approvals";

describe("exposure math", () => {
  it("projects a daily budget over 30 days", () => {
    expect(exposure30dCents(500)).toBe(15000);
  });

  it("a campaign create carries its full 30-day exposure", () => {
    expect(requestedExposureCents("create_campaign", 1000, undefined)).toBe(
      30000
    );
  });

  it("a budget change commits only the increase; a cut commits nothing", () => {
    expect(requestedExposureCents("update_budget", 1500, undefined, 1000)).toBe(
      15000
    );
    expect(requestedExposureCents("update_budget", 500, undefined, 1000)).toBe(
      0
    );
  });

  it("a pause commits nothing; a resume recommits the budget", () => {
    expect(requestedExposureCents("set_status", 1000, "paused")).toBe(0);
    expect(requestedExposureCents("set_status", 1000, "active")).toBe(30000);
  });
});

describe("ceilingAllows", () => {
  it("allows a write that fits under the ceiling", () => {
    expect(ceilingAllows(100000, 30000, 30000).allowed).toBe(true);
  });

  it("refuses a write that would breach the ceiling", () => {
    expect(ceilingAllows(100000, 90000, 30000).allowed).toBe(false);
  });

  it("fails closed with no configured ceiling", () => {
    expect(ceilingAllows(0, 0, 1).allowed).toBe(false);
  });

  it("counts existing commitments, not just the new write", () => {
    const check = ceilingAllows(50000, 45000, 10000);
    expect(check.allowed).toBe(false);
    expect(check.committedCents).toBe(45000);
    expect(check.requestedCents).toBe(10000);
  });
});
