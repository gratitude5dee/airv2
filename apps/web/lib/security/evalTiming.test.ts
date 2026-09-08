import { describe, expect, it } from "vitest";
import { CaseTiming } from "../../../../evals/agent-suite/timing";

describe("WEB-24 eval timing", () => {
  it("excludes reconciliation and keeps the first delta across later output", () => {
    let now = 0;
    const timer = new CaseTiming(() => now);
    now = 300;
    timer.delta("");
    now = 1000;
    timer.delta("First");
    now = 2000;
    timer.delta("Second");
    now = 4000;
    timer.stop();
    now += 20_000;
    timer.stop();
    expect(timer.snapshot()).toEqual({ agent_ms: 4000, ttft_ms: 1000 });
  });
  it("does not invent TTFT for failed or buffered responses", () => {
    let now = 10;
    const timer = new CaseTiming(() => now);
    now = 20;
    timer.stop();
    timer.delta("too late");
    expect(timer.snapshot()).toEqual({ agent_ms: 10, ttft_ms: null });
  });
  it("refuses an unfinished measurement", () => {
    expect(() => new CaseTiming().snapshot()).toThrow("has not stopped");
  });
});
