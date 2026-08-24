import { describe, expect, it } from "vitest";
import { parseMiniAppCommand } from "./imessageCommand";

describe("parseMiniAppCommand", () => {
  it("accepts an exact slash command and normalizes aliases", () => {
    expect(parseMiniAppCommand(" /Onboarding ")).toBe("onboarding");
    expect(parseMiniAppCommand("/image-editor")).toBe("image");
    expect(parseMiniAppCommand("/to-do")).toBe("todo");
  });

  it("does not intercept prose or multi-message bursts", () => {
    expect(parseMiniAppCommand("open /onboarding")).toBeNull();
    expect(parseMiniAppCommand("/onboarding please")).toBeNull();
    expect(parseMiniAppCommand("hello\n/onboarding")).toBeNull();
  });
});
