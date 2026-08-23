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

  it("lite (card) sessions keep the theme backdrop regardless of choice", () => {
    const html = withStyle(
      { theme: theme("atmosphere"), background: "galaxy" },
      () => renderShell({ title: "T", kicker: "K", body: "", lite: true })
    );
    expect(html).not.toContain("wz-bg");
    expect(html).toContain("<wz-sky");
  });

  it("shellHtml widens script-src for script-less themes with an effect", () => {
    const csp = withStyle(
      { theme: theme("pixel"), background: "silk" },
      () => shellHtml("").headers.get("Content-Security-Policy") ?? ""
    );
    expect(csp).toContain("script-src 'self'");
    const plain = withStyle(
      { theme: theme("pixel"), background: "theme" },
      () => shellHtml("").headers.get("Content-Security-Policy") ?? ""
    );
    expect(plain).not.toContain("script-src");
  });
});
