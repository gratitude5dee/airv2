import { describe, expect, it } from "vitest";
import { parseCreateCommand, parseMiniAppCommand } from "./imessageCommand";

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

describe("parseCreateCommand (V12 §8.1)", () => {
  it("returns the prompt for `/create <text>`, spanning lines", () => {
    expect(parseCreateCommand("/create a countdown for my tour")).toEqual({
      prompt: "a countdown for my tour",
      url: null,
    });
    expect(parseCreateCommand("  /Create landing page\nfor the show\non Oct 3 ")).toEqual({
      prompt: "landing page\nfor the show\non Oct 3",
      url: null,
    });
  });

  it("leaves a bare `/create` to the card path", () => {
    expect(parseCreateCommand("/create")).toBeNull();
    expect(parseCreateCommand(" /create  ")).toBeNull();
    expect(parseMiniAppCommand("/create")).toBe("create");
    expect(parseMiniAppCommand("/create something")).toBeNull();
  });

  it("does not intercept prose or other commands", () => {
    expect(parseCreateCommand("please /create a thing")).toBeNull();
    expect(parseCreateCommand("/created a thing")).toBeNull();
    expect(parseCreateCommand("/creates")).toBeNull();
    expect(parseCreateCommand("/onboarding")).toBeNull();
  });

  it("lifts a leading GitHub URL into url, with or without a branch", () => {
    expect(
      parseCreateCommand("/create https://github.com/acme/site make it dark")
    ).toEqual({ prompt: "make it dark", url: "https://github.com/acme/site" });
    expect(
      parseCreateCommand("/create https://github.com/acme/site/tree/release/v2/\nkeep the copy")
    ).toEqual({
      prompt: "keep the copy",
      url: "https://github.com/acme/site/tree/release/v2",
    });
    expect(parseCreateCommand("/create https://github.com/acme/site/")).toEqual({
      prompt: "",
      url: "https://github.com/acme/site",
    });
  });

  it("keeps a URL that is not at the head, or not GitHub, inside the prompt", () => {
    expect(parseCreateCommand("/create port https://github.com/acme/site")).toEqual({
      prompt: "port https://github.com/acme/site",
      url: null,
    });
    expect(parseCreateCommand("/create https://gitlab.com/acme/site")).toEqual({
      prompt: "https://gitlab.com/acme/site",
      url: null,
    });
    expect(parseCreateCommand("/create https://github.com/acme")).toEqual({
      prompt: "https://github.com/acme",
      url: null,
    });
  });
});
