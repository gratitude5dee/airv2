/**
 * MA9.2 — Onairos handoff validation (SSRF guard: the apiUrl arrives from a
 * browser), markdown projection across the documented response families, and
 * the USER.md pointer-line invariants (exactly one, fully removable).
 */
import { describe, expect, it } from "vitest";
import {
  addPointerLine,
  contextMarkdown,
  OnairosError,
  removePointerLine,
  USER_MD_POINTER_LINE,
  validateHandoff,
} from "./context";

describe("validateHandoff", () => {
  it("accepts the documented SDK handoff shape", () => {
    const handoff = validateHandoff({
      token: "eyJ.token",
      apiUrl: "https://api2.onairos.uk/inferenceTest/traits",
      authorizedData: { basic: true, personality: true, junk: "no" },
    });
    expect(handoff.token).toBe("eyJ.token");
    expect(handoff.authorizedData).toEqual({ basic: true, personality: true });
  });

  it("rejects missing token/apiUrl", () => {
    expect(() => validateHandoff({})).toThrow(OnairosError);
    expect(() => validateHandoff({ token: "t" })).toThrow(OnairosError);
    expect(() => validateHandoff({ token: "", apiUrl: "https://api2.onairos.uk/x" })).toThrow(
      OnairosError
    );
  });

  it("rejects non-Onairos and non-https apiUrls (SSRF guard)", () => {
    for (const apiUrl of [
      "https://evil.example.com/steal",
      "https://onairos.uk.evil.com/x",
      "https://xonairos.uk/x",
      "http://api2.onairos.uk/x",
      "https://169.254.169.254/latest/meta-data",
      "file:///etc/passwd",
      "not a url",
    ]) {
      expect(() => validateHandoff({ token: "t", apiUrl })).toThrow(
        OnairosError
      );
    }
  });

  it("accepts onairos.uk and onairos.io subdomains", () => {
    for (const apiUrl of [
      "https://api2.onairos.uk/traits",
      "https://api.onairos.io/inference",
      "https://onairos.uk/x",
    ]) {
      expect(validateHandoff({ token: "t", apiUrl }).apiUrl).toBe(apiUrl);
    }
  });
});

describe("contextMarkdown", () => {
  it("renders the traits family", () => {
    const md = contextMarkdown(
      {
        traits: {
          archetype: "Builder",
          user_summary: "Likes shipping.",
          positive_traits: { Curiosity: { score: 91 }, Grit: 80 },
          traits_to_improve: { Patience: { score: 40 } },
        },
        connectedPlatforms: ["youtube", "reddit"],
      },
      "2026-08-19T00:00:00Z"
    );
    expect(md).toContain("Archetype: The Builder");
    expect(md).toContain("Likes shipping.");
    expect(md).toContain("- Curiosity (91/100)");
    expect(md).toContain("- Grit (80/100)");
    expect(md).toContain("- Patience (40/100)");
    expect(md).toContain("Connected platforms: youtube, reddit");
  });

  it("degrades gracefully on an unknown family", () => {
    const md = contextMarkdown({ something: "else" }, "2026-08-19T00:00:00Z");
    expect(md).toContain("imported from Onairos");
    expect(md).toContain("onairos.json");
  });
});

describe("USER.md pointer line", () => {
  it("appends exactly once", () => {
    const once = addPointerLine("I like tea.\n");
    expect(once).toBe(`I like tea.\n${USER_MD_POINTER_LINE}\n`);
    expect(addPointerLine(once)).toBe(once);
  });

  it("handles an empty USER.md", () => {
    expect(addPointerLine("")).toBe(`${USER_MD_POINTER_LINE}\n`);
  });

  it("removes the pointer, leaving no Onairos-derived bytes", () => {
    const withPointer = addPointerLine("Profile.\n");
    const cleaned = removePointerLine(withPointer);
    expect(cleaned).not.toContain("Onairos");
    expect(cleaned).toContain("Profile.");
    expect(removePointerLine("no pointer here\n")).toBe("no pointer here\n");
  });
});
