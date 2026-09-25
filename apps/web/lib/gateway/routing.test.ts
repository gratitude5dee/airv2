import { afterEach, describe, expect, it } from "vitest";
import {
  gatewayModelFamilyOverride,
  gmiFastToolContinuation,
  gmiRoutineTurn,
  isRuntimeBearer,
  isTimeoutError,
  openingUserTurnText,
} from "./routing";

describe("openingUserTurnText", () => {
  it("returns the string content of the last user message", () => {
    expect(
      openingUserTurnText({ messages: [{ role: "user", content: "hi" }] }),
    ).toBe("hi");
  });

  it("joins text parts and trims", () => {
    expect(
      openingUserTurnText({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "  hello " },
              { type: "image_url", url: "x" },
              { type: "text", text: "world" },
            ],
          },
        ],
      }),
    // A non-text part still occupies a line.
    ).toBe("hello \n\nworld");
  });

  it("returns null when the last message is not a user turn", () => {
    expect(
      openingUserTurnText({
        messages: [
          { role: "user", content: "hi" },
          { role: "tool", content: "result" },
        ],
      }),
    ).toBeNull();
  });

  it("returns null for empty or missing messages", () => {
    expect(openingUserTurnText({ messages: [] })).toBeNull();
    expect(openingUserTurnText({})).toBeNull();
  });
});

describe("gmiRoutineTurn", () => {
  afterEach(() => {
    delete process.env.GMI_ROUTINE_FAST;
  });

  it("classifies a short plain ask as routine", () => {
    expect(
      gmiRoutineTurn({
        messages: [{ role: "user", content: "draft an email to sam" }],
      }),
    ).toBe(true);
  });

  it("keeps deep cues on the entitled tier", () => {
    expect(
      gmiRoutineTurn({
        messages: [{ role: "user", content: "research the EV market" }],
      }),
    ).toBe(false);
  });

  it("keeps money and publish cues on the entitled tier", () => {
    for (const text of [
      "send $50 to mom",
      "wire the deposit today",
      "publish this post",
    ]) {
      expect(
        gmiRoutineTurn({ messages: [{ role: "user", content: text }] }),
      ).toBe(false);
    }
  });

  it("rejects turns over the length cap", () => {
    expect(
      gmiRoutineTurn({
        messages: [{ role: "user", content: "x".repeat(281) }],
      }),
    ).toBe(false);
  });

  it("honors the GMI_ROUTINE_FAST=off kill switch", () => {
    process.env.GMI_ROUTINE_FAST = "off";
    expect(
      gmiRoutineTurn({
        messages: [{ role: "user", content: "check the weather" }],
      }),
    ).toBe(false);
  });
});

describe("gmiFastToolContinuation", () => {
  it("continues tool turns on the fast lane when no user cue is risky", () => {
    expect(
      gmiFastToolContinuation({
        messages: [
          { role: "user", content: "check my email" },
          { role: "assistant", content: "calling the tool" },
          { role: "tool", content: "3 unread" },
        ],
      }),
    ).toBe(true);
  });

  it("keeps risk-laden conversations on the entitled model", () => {
    expect(
      gmiFastToolContinuation({
        messages: [
          { role: "user", content: "refund my order" },
          { role: "tool", content: "..." },
        ],
      }),
    ).toBe(false);
  });

  it("returns false when the last message is not a tool result", () => {
    expect(
      gmiFastToolContinuation({
        messages: [{ role: "user", content: "hi" }],
      }),
    ).toBe(false);
  });
});

describe("gatewayModelFamilyOverride", () => {
  afterEach(() => {
    delete process.env.GATEWAY_MODEL_FAMILY_OVERRIDE;
  });

  it("returns the family when the override names a known one", () => {
    process.env.GATEWAY_MODEL_FAMILY_OVERRIDE = "gmi";
    expect(gatewayModelFamilyOverride()).toBe("gmi");
  });

  it("returns null for unset or unknown values", () => {
    expect(gatewayModelFamilyOverride()).toBeNull();
    process.env.GATEWAY_MODEL_FAMILY_OVERRIDE = "not-a-family";
    expect(gatewayModelFamilyOverride()).toBeNull();
  });
});

describe("isRuntimeBearer", () => {
  it("recognizes the art_ prefix", () => {
    expect(isRuntimeBearer("art_abc123")).toBe(true);
    expect(isRuntimeBearer("sk-abc123")).toBe(false);
  });
});

describe("isTimeoutError", () => {
  it("matches timeout names and messages", () => {
    expect(
      isTimeoutError(new DOMException("slow", "TimeoutError")),
    ).toBe(true);
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(isTimeoutError(abort)).toBe(true);
    expect(isTimeoutError(new Error("request timed out"))).toBe(true);
    expect(isTimeoutError(new Error("connection refused"))).toBe(false);
    expect(isTimeoutError("timeout")).toBe(false);
  });
});
