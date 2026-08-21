import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_IDS,
  THEMES,
  isThemeId,
  theme,
  themeCsp,
  tokenBlock,
} from "./themes";

describe("theme tokens", () => {
  it("every theme fills every token in the contract", () => {
    const names = Object.keys(THEMES[DEFAULT_THEME].tokens);
    for (const id of THEME_IDS) {
      const tokens = THEMES[id].tokens;
      expect(Object.keys(tokens).sort()).toEqual(names.sort());
      for (const value of Object.values(tokens)) {
        expect(value.trim()).not.toBe("");
      }
    }
  });

  it("emits every token as a custom property", () => {
    const block = tokenBlock(THEMES.pixel.tokens);
    expect(block.startsWith(":root{")).toBe(true);
    expect(block).toContain("--on-ink:#101012");
    expect(block).toContain("--text-shadow:none");
  });

  it("rejects unknown theme ids", () => {
    expect(isThemeId("atmosphere")).toBe(true);
    expect(isThemeId("liquid-glass")).toBe(false);
  });
});

describe("themeCsp", () => {
  it("allows the data: grain image only for themes that draw grain", () => {
    expect(themeCsp(theme("atmosphere"))).toContain("img-src 'self' data:");
    expect(themeCsp(theme("pixel"))).toContain("img-src 'self'");
    expect(themeCsp(theme("pixel"))).not.toContain("data:");
  });

  it("widens script-src and font-src only for the assets a theme uses", () => {
    const atmosphere = themeCsp(theme("atmosphere"));
    expect(atmosphere).toContain("script-src 'self'");
    expect(atmosphere).toContain("font-src https://fonts.gstatic.com");
    const pixel = themeCsp(theme("pixel"));
    expect(pixel).not.toContain("script-src");
    expect(pixel).not.toContain("font-src");
    expect(pixel).toContain("style-src 'unsafe-inline'");
  });

  it("starts from a default-deny baseline", () => {
    for (const id of THEME_IDS) {
      expect(themeCsp(theme(id)).startsWith("default-src 'none'")).toBe(true);
    }
  });
});
