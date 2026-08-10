import { describe, expect, it } from "vitest";
import {
  compileBrand,
  compileThemeYaml,
  lintCopy,
  validateBrandSource,
} from "./compile";
import type { BrandSource } from "./types";

const northwind: BrandSource = {
  name: "northwind",
  label: "Northwind Supply",
  palette: {
    background: "#0b0b0c",
    midground: "#f2ede3",
    foreground: { hex: "#e0553a", alpha: 1.0 },
    warmGlow: "rgba(224, 85, 58, 0.18)",
  },
  typography: {
    fontSans: '"Söhne", system-ui, sans-serif',
    fontDisplay: '"GT Sectra", Georgia, serif',
    baseSize: "15px",
  },
  layout: { radius: "0.25rem", density: "comfortable" },
  assets: {
    logo: "https://cdn.wzrd.tech/b/northwind/logo.svg",
    custom: { lockupDark: "https://cdn.wzrd.tech/b/northwind/lockup-dark.svg" },
  },
  voice: {
    register: "plainspoken, dry, never exclamatory",
    person: "first person plural",
    banned: ["game-changing", "revolutionize", "unlock", "!"],
    readingLevel: 8,
  },
  claims: {
    allowed: ["made in Portland", "10-year warranty"],
    forbidden: ["organic", "medical-grade", "#1"],
    requiresLegal: ["free shipping", "lifetime"],
  },
  imagery: {
    do: ["overcast daylight", "matte surfaces"],
    avoid: ["lens flare", "confetti"],
    talentRelease: "required",
  },
  markets: ["US", "CA"],
};

describe("compileThemeYaml", () => {
  it("emits palette, typography, layout and assets", () => {
    const yaml = compileThemeYaml(northwind);
    expect(yaml).toContain('name: "northwind"');
    expect(yaml).toContain('"background": "#0b0b0c"');
    expect(yaml).toContain('"warmGlow": "rgba(224, 85, 58, 0.18)"');
    expect(yaml).toContain("typography:");
    expect(yaml).toContain('"baseSize": "15px"');
    expect(yaml).toContain('density: "comfortable"');
    expect(yaml).toContain('logo: "https://cdn.wzrd.tech/b/northwind/logo.svg"');
    expect(yaml).toContain('"lockupDark":');
  });

  it("resolves alpha palette colors to rgba", () => {
    const yaml = compileThemeYaml({
      ...northwind,
      palette: { ...northwind.palette, foreground: { hex: "#e0553a", alpha: 0.5 } },
    });
    expect(yaml).toContain('"foreground": "rgba(224, 85, 58, 0.5)"');
  });

  it("expands 3-digit hex colors with alpha", () => {
    const yaml = compileThemeYaml({
      ...northwind,
      palette: { ...northwind.palette, foreground: { hex: "#fff", alpha: 0.5 } },
    });
    expect(yaml).toContain('"foreground": "rgba(255, 255, 255, 0.5)"');
  });

  it("omits empty typography/layout sections", () => {
    const yaml = compileThemeYaml({
      ...northwind,
      typography: {},
      layout: {},
      assets: {},
    });
    expect(yaml).not.toContain("typography:");
    expect(yaml).not.toContain("layout:");
    expect(yaml).not.toContain("assets:");
  });

  it("omits the voice/claims/imagery extensions", () => {
    const yaml = compileThemeYaml(northwind);
    expect(yaml).not.toContain("voice");
    expect(yaml).not.toContain("claims");
    expect(yaml).not.toContain("imagery");
  });
});

describe("compileBrand", () => {
  it("compiles the same source into all three targets", () => {
    const { themeYaml, brandMd, tokensJson } = compileBrand(northwind);
    // One hex, three targets, no third place to edit (CC11).
    expect(themeYaml).toContain("#0b0b0c");
    expect(brandMd).toContain("#0b0b0c");
    expect(JSON.parse(tokensJson).palette.background).toBe("#0b0b0c");
  });

  it("states guardrails as instructions in BRAND.md", () => {
    const { brandMd } = compileBrand(northwind);
    expect(brandMd).toContain("plainspoken, dry, never exclamatory");
    expect(brandMd).toContain('"game-changing"');
    expect(brandMd).toContain("never make: organic; medical-grade; #1");
    expect(brandMd).toContain("legal sign-off before use: free shipping; lifetime");
    expect(brandMd).toContain("talent release");
  });

  it("round-trips extensions into tokens json", () => {
    const tokens = JSON.parse(compileBrand(northwind).tokensJson) as {
      voice: { banned: string[] };
      markets: string[];
    };
    expect(tokens.voice.banned).toContain("revolutionize");
    expect(tokens.markets).toEqual(["US", "CA"]);
  });
});

describe("lintCopy", () => {
  it("flags banned voice terms with the offending term named", () => {
    const violations = lintCopy(
      "This game-changing bottle will revolutionize hydration",
      northwind
    );
    expect(violations).toContainEqual({
      kind: "voice.banned",
      term: "game-changing",
    });
    expect(violations).toContainEqual({
      kind: "voice.banned",
      term: "revolutionize",
    });
  });

  it("flags forbidden claims so they cannot reach an approval card", () => {
    const violations = lintCopy("100% organic cotton", northwind);
    expect(violations).toContainEqual({
      kind: "claims.forbidden",
      term: "organic",
    });
  });

  it("flags claims that require legal review", () => {
    expect(lintCopy("Free shipping on all orders", northwind)).toContainEqual({
      kind: "claims.requiresLegal",
      term: "free shipping",
    });
  });

  it("matches punctuation bans literally", () => {
    expect(lintCopy("Big news!", northwind)).toContainEqual({
      kind: "voice.banned",
      term: "!",
    });
  });

  it("does not flag substrings of larger words", () => {
    // "unlock" banned; "unlockable" is a different word.
    expect(
      lintCopy("The unlockable tier ships later", northwind).filter(
        (v) => v.term === "unlock"
      )
    ).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(lintCopy("ORGANIC materials", northwind)).toContainEqual({
      kind: "claims.forbidden",
      term: "organic",
    });
  });

  it("passes clean copy", () => {
    expect(
      lintCopy("Made in Portland. Ten years, guaranteed.", northwind)
    ).toEqual([]);
  });
});

describe("validateBrandSource", () => {
  it("accepts a valid source", () => {
    expect(validateBrandSource(northwind).name).toBe("northwind");
  });

  it("rejects a non-slug name", () => {
    expect(() =>
      validateBrandSource({ ...northwind, name: "North Wind!" })
    ).toThrow(/slug/);
  });

  it("rejects a missing palette role", () => {
    const { foreground: _unused, ...rest } = northwind.palette;
    expect(() =>
      validateBrandSource({ ...northwind, palette: rest })
    ).toThrow(/foreground/);
  });

  it("rejects non-string palette values", () => {
    expect(() =>
      validateBrandSource({
        ...northwind,
        palette: { ...northwind.palette, background: 42 },
      })
    ).toThrow(/background/);
  });

  it("rejects palette and asset keys that could restructure the YAML", () => {
    expect(() =>
      validateBrandSource({
        ...northwind,
        palette: { ...northwind.palette, "evil:\n  injected": "#fff" },
      })
    ).toThrow(/token name/);
    expect(() =>
      validateBrandSource({
        ...northwind,
        assets: { custom: { "bad key": "https://example.com/x.svg" } },
      })
    ).toThrow(/token name/);
  });

  it("rejects non-array list fields", () => {
    expect(() =>
      validateBrandSource({ ...northwind, markets: "US" })
    ).toThrow(/markets/);
    expect(() =>
      validateBrandSource({
        ...northwind,
        voice: { banned: "revolutionize" },
      })
    ).toThrow(/voice.banned/);
  });

  it("rejects non-object section fields and bad typography keys", () => {
    expect(() =>
      validateBrandSource({ ...northwind, typography: "Inter" })
    ).toThrow(/typography/);
    expect(() =>
      validateBrandSource({
        ...northwind,
        typography: { "evil:\n  raw": "x" },
      })
    ).toThrow(/token name/);
  });

  it("rejects non-https asset and font URLs", () => {
    expect(() =>
      validateBrandSource({
        ...northwind,
        assets: { logo: "javascript:alert(1)" },
      })
    ).toThrow(/https/);
    expect(() =>
      validateBrandSource({
        ...northwind,
        assets: { custom: { mark: "http://169.254.169.254/x" } },
      })
    ).toThrow(/https/);
    expect(() =>
      validateBrandSource({
        ...northwind,
        typography: { fontUrl: "data:text/css,body{}" },
      })
    ).toThrow(/https/);
  });

  it("rejects an unknown layout density", () => {
    expect(() =>
      validateBrandSource({
        ...northwind,
        layout: { density: "cozy\nraw: injected" },
      })
    ).toThrow(/density/);
  });
});
