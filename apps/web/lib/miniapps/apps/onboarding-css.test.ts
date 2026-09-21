/**
 * The onboarding deck's rules moved out of an inline `<style>` block into
 * public/creator-os/onboarding.css (Stage 3, docs/plans/
 * onboarding-miniapp-upgrade.md) — a static file, not generated from
 * onboarding.tsx, so nothing re-checks its content against the source it
 * came from. These guard the extraction itself: nothing was lost, and no
 * stray template syntax rode along.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(__dirname, "../../../public/creator-os/onboarding.css"),
  "utf8"
);

describe("onboarding.css", () => {
  it("carries no leftover template-literal syntax from the TS extraction", () => {
    expect(css).not.toContain("${");
  });

  it("keeps the cinematic welcome rules the inline block used to carry", () => {
    expect(css).toContain("html.cine-page,body.cine-page{background:#000}");
    expect(css).toContain(
      "@media (orientation:portrait){.cine-film{object-fit:cover;object-position:center}}"
    );
  });

  it("keeps the grain overlay's data: URI inlined, not left as a JS interpolation", () => {
    expect(css).toContain(".grain{");
    expect(css).toContain("background-image:url(\"data:image/svg+xml,");
  });

  it("keeps the Stage 1 button/uploader/stepper rules", () => {
    for (const selector of [
      "button,.btn{",
      "button.quiet,.btn.quiet{",
      ".uploader{",
      ".uploader-icon{",
      ".stepper-head{",
      ".stepper-nav{",
      ".is-busy{",
      ".resume{",
    ]) {
      expect(css).toContain(selector);
    }
  });
});
