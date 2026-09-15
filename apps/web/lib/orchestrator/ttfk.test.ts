import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACK_REACTION,
  deterministicAcknowledgementAnswer,
  deterministicArithmeticAnswer,
  FINALIZING_AT_MS,
  hasExplicitResponseLane,
  initialHoldingReply,
  INITIAL_REPLY_SLA_MS,
  isContextDependentFollowup,
  isFastInitialQuestion,
  progressFallback,
  PROGRESS_ONE_AT_MS,
  PROGRESS_TWO_AT_MS,
  REACTION_SLA_MS,
  shouldStartProgressTimeline,
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
    // These depend on the existing conversation or fresh external data.
    // A history-free quick completion must never consume them as final.
    expect(isFastInitialQuestion("Any update?")).toBe(false);
    expect(isFastInitialQuestion("What's going on today?")).toBe(false);
    expect(isFastInitialQuestion("What's going on tomorrow?")).toBe(false);
    expect(isFastInitialQuestion("What's on my calendar today?")).toBe(false);
  });

  it("keeps ambiguous follow-ups on the contextual agent path", () => {
    for (const body of [
      "Yee",
      "yes",
      "I meant yes",
      "go ahead",
      "ok",
      "sounds good",
      "the blue one",
      "same size",
      "do that",
      "no",
      "never mind",
    ]) {
      expect(isContextDependentFollowup(body), body).toBe(true);
      expect(isFastInitialQuestion(body), body).toBe(false);
    }
    expect(isContextDependentFollowup("capital of France?")).toBe(false);
    expect(isContextDependentFollowup("what is 9 times 7?")).toBe(false);
  });

  it("answers standalone acknowledgements without starting another agent run", () => {
    expect(deterministicAcknowledgementAnswer("Ok let me know")).toBe("Will do.");
    expect(deterministicAcknowledgementAnswer("Okay, keep me posted.")).toBe("Will do.");
    expect(deterministicAcknowledgementAnswer("Thanks")).toBe("You’re welcome.");
    expect(deterministicAcknowledgementAnswer("Any update?")).toBeNull();
    expect(deterministicAcknowledgementAnswer("Ok plan the trip")).toBeNull();
  });

  it("does not restart the canned progress clock for conversational follow-ups", () => {
    expect(shouldStartProgressTimeline("Any update?")).toBe(false);
    expect(shouldStartProgressTimeline("Ok let me know")).toBe(false);
    expect(shouldStartProgressTimeline("Yee")).toBe(false);
    expect(shouldStartProgressTimeline("I meant yes")).toBe(false);
    expect(shouldStartProgressTimeline("What's going on today?")).toBe(true);
    expect(shouldStartProgressTimeline("Plan a ten-day trip")).toBe(true);
    expect(shouldStartProgressTimeline("/zap make this move")).toBe(false);
    expect(
      shouldStartProgressTimeline("[attachment:abc]\n/zap make this move")
    ).toBe(false);
  });

  it("recognizes response-lane commands after Spectrum attachment markers", () => {
    expect(hasExplicitResponseLane("/zap make this move")).toBe(true);
    expect(
      hasExplicitResponseLane("[attachment:abc]\n/zap make this move")
    ).toBe(true);
    expect(hasExplicitResponseLane("[attachment:abc]\n/draw hq a fox")).toBe(
      true
    );
    expect(hasExplicitResponseLane("see docs//zap")).toBe(false);
    expect(hasExplicitResponseLane("ordinary prose")).toBe(false);
  });

  it("chooses a stable, task-aware holding line", () => {
    expect(initialHoldingReply("find deals for Portola Fest")).toContain("options");
    expect(initialHoldingReply("[attachment:abc]")).toContain("looking");
    expect(initialHoldingReply("[attachment:abc]\n/zap make this move")).toContain(
      "making"
    );
    expect(initialHoldingReply("/freeze")).toContain("Opening");
    expect(initialHoldingReply("analyze this architecture")).toContain("carefully");
  });

  it("sends one truthful fallback update at 20 seconds when generation is late", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue(undefined);
    const generate = vi.fn(() => new Promise<string | null>(() => undefined));
    const timeline = startProgressTimeline({
      receivedAtMs: Date.now(),
      send,
      generate,
    });

    await vi.advanceTimersByTimeAsync(PROGRESS_TWO_AT_MS - 1);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenLastCalledWith(progressFallback("progress-two"));
    await vi.advanceTimersByTimeAsync(FINALIZING_AT_MS - PROGRESS_TWO_AT_MS);
    expect(send).toHaveBeenCalledTimes(1);
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

    await vi.advanceTimersByTimeAsync(PROGRESS_TWO_AT_MS - 1);
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
