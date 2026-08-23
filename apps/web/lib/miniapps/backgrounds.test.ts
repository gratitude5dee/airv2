import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBackgroundId, DEFAULT_BACKGROUND } from "./backgrounds";
import { userStyle, withStyle } from "./themeContext";
import { renderShell, shellHtml } from "./shell";
import { theme } from "./themes";

function usersClient(row: Record<string, string> | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row }) }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("backgrounds", () => {
  it("validates ids", () => {
    expect(isBackgroundId("galaxy")).toBe(true);
    expect(isBackgroundId("theme")).toBe(true);
    expect(isBackgroundId("lava-lamp")).toBe(false);
  });

  it("userStyle reads both columns and falls back on unknown values", async () => {
    const style = await userStyle(
      usersClient({ miniapp_theme: "pixel", miniapp_background: "galaxy" }),
      "u1"
    );
    expect(style.theme.id).toBe("pixel");
    expect(style.background).toBe("galaxy");
    const fallback = await userStyle(
      usersClient({ miniapp_theme: "pixel", miniapp_background: "nope" }),
      "u1"
    );
    expect(fallback.background).toBe(DEFAULT_BACKGROUND);
  });

  it("renderShell swaps the theme backdrop for the chosen effect mount", () => {
    const html = withStyle(
      { theme: theme("atmosphere"), background: "galaxy" },
      () => renderShell({ title: "T", kicker: "K", body: "<p>hi</p>" })
    );
    expect(html).toContain('id="wz-bg"');
    expect(html).toContain('data-effect="galaxy"');
    expect(html).toContain("/creator-os/bg/bg.js");
    expect(html).not.toContain("<wz-sky");
  });

  it("lite (card) sessions render the chosen effect at 1x (data-lite)", () => {
    const html = withStyle(
      { theme: theme("atmosphere"), background: "galaxy" },
      () => renderShell({ title: "T", kicker: "K", body: "", lite: true })
    );
    expect(html).toContain('id="wz-bg"');
    expect(html).toContain('data-effect="galaxy"');
    expect(html).toContain('data-lite="1"');
    expect(html).toContain("/creator-os/bg/bg.js");
    expect(html).not.toContain("<wz-sky");
  });

  it("full sessions carry no data-lite flag", () => {
    const html = withStyle(
      { theme: theme("atmosphere"), background: "galaxy" },
      () => renderShell({ title: "T", kicker: "K", body: "" })
    );
    expect(html).not.toContain("data-lite");
  });

  it("shellHtml widens script-src only when the bundle is emitted", () => {
    const render = (lite: boolean) =>
      renderShell({ title: "T", kicker: "K", body: "", lite });
    const cspFor = (background: "silk" | "theme", lite: boolean) =>
      withStyle(
        { theme: theme("pixel"), background },
        () =>
          shellHtml(render(lite)).headers.get("Content-Security-Policy") ?? ""
      );
    expect(cspFor("silk", false)).toContain("script-src 'self'");
    expect(cspFor("theme", false)).not.toContain("script-src");
    // Lite card sessions load the bundle too (at 1x), so script-src widens.
    expect(cspFor("silk", true)).toContain("script-src 'self'");
    expect(cspFor("theme", true)).not.toContain("script-src");
  });
});
