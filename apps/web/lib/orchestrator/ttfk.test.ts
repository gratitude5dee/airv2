import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACK_REACTION,
  deterministicArithmeticAnswer,
  FINALIZING_AT_MS,
  initialHoldingReply,
  INITIAL_REPLY_SLA_MS,
  isFastInitialQuestion,
  progressFallback,
  PROGRESS_ONE_AT_MS,
  PROGRESS_TWO_AT_MS,
  REACTION_SLA_MS,
  startProgressTimeline,
} from "./ttfk";

afterEach(() => vi.useRealTimers());

describe("TTFK policy", () => {
  it("answers bounded arithmetic without a model or unsafe evaluation", () => {
    expect(deterministicArithmeticAnswer("what is 9 × 7?")).toBe("63");
    expect(deterministicArithmeticAnswer("calculate (12 + 3) / 5")).toBe("3");
    expect(deterministicArithmeticAnswer("0.1 + 0.2")).toBe("0.3");
    expect(deterministicArithmeticAnswer("process.exit(1)")).toBeNull();
    expect(deterministicArithmeticAnswer("1 / 0")).toBeNull();
  });

  it("sets explicit reaction, initial-reply, and visible-progress deadlines", () => {
    expect(ACK_REACTION).toBe("👀");
    expect(REACTION_SLA_MS).toBe(1_000);
    expect(INITIAL_REPLY_SLA_MS).toBe(5_000);
    expect(PROGRESS_ONE_AT_MS).toBe(10_000);
    expect(PROGRESS_TWO_AT_MS).toBe(20_000);
    expect(FINALIZING_AT_MS).toBe(35_000);
  });

  it("only sends a fast model first reply for bounded plain-language work", () => {
    expect(isFastInitialQuestion("what is 9 times 7?")).toBe(true);
    expect(isFastInitialQuestion("find deals for Portola Fest")).toBe(false);
    expect(isFastInitialQuestion("/freeze")).toBe(false);
    expect(isFastInitialQuestion("[attachment:abc]")).toBe(false);
  });

  it("chooses a stable, task-aware holding line", () => {
    expect(initialHoldingReply("find deals for Portola Fest")).toContain("options");
    expect(initialHoldingReply("[attachment:abc]")).toContain("looking");
    expect(initialHoldingReply("/freeze")).toContain("Opening");
    expect(initialHoldingReply("analyze this architecture")).toContain("carefully");
  });

  it("uses fallback progress text exactly at the deadlines when GLM is late", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue(undefined);
    const generate = vi.fn(() => new Promise<string | null>(() => undefined));
    const timeline = startProgressTimeline({
      receivedAtMs: Date.now(),
      send,
      generate,
    });

    await vi.advanceTimersByTimeAsync(PROGRESS_ONE_AT_MS);
    expect(send).toHaveBeenLastCalledWith(progressFallback("progress-one"));
    await vi.advanceTimersByTimeAsync(PROGRESS_TWO_AT_MS - PROGRESS_ONE_AT_MS);
    expect(send).toHaveBeenLastCalledWith(progressFallback("progress-two"));
    timeline.stop();
  });

  it("prepares GLM status early but delivers it only at its deadline", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue(undefined);
    const timeline = startProgressTimeline({
      receivedAtMs: Date.now(),
      send,
      generate: vi.fn().mockResolvedValue("I’m checking the details now."),
    });

    await vi.advanceTimersByTimeAsync(PROGRESS_ONE_AT_MS - 1);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenLastCalledWith("I’m checking the details now.");
    timeline.stop();
  });

  it("cancels all pending status bubbles once the actual reply starts", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue(undefined);
    const timeline = startProgressTimeline({
      receivedAtMs: Date.now(),
      send,
      generate: vi.fn().mockResolvedValue("I’m checking the details now."),
    });
    timeline.stop();
    await vi.advanceTimersByTimeAsync(FINALIZING_AT_MS + 1_000);
    expect(send).not.toHaveBeenCalled();
  });
});
