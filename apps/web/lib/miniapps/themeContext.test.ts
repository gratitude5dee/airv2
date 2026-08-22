import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { activeTheme, userTheme, withTheme } from "./themeContext";
import { DEFAULT_THEME, theme } from "./themes";
import { renderShell } from "./shell";

function usersClient(miniappTheme: string | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: miniappTheme === null ? null : { miniapp_theme: miniappTheme },
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("themeContext", () => {
  it("defaults to the default theme outside withTheme", () => {
    expect(activeTheme().id).toBe(DEFAULT_THEME);
  });

  it("scopes the active theme to the callback, including async work", async () => {
    const result = await withTheme(theme("pixel"), async () => {
      await Promise.resolve();
      return activeTheme().id;
    });
    expect(result).toBe("pixel");
    expect(activeTheme().id).toBe(DEFAULT_THEME);
  });

  it("renderShell picks up the request theme without an explicit option", async () => {
    const html = await withTheme(theme("pixel"), async () =>
      renderShell({ title: "T", kicker: "K", body: "<p>hi</p>" })
    );
    expect(html).not.toContain("<wz-sky");
    expect(html).toContain("Inter");
  });

  it("userTheme reads the saved id and falls back on unknown values", async () => {
    expect((await userTheme(usersClient("pixel"), "u1")).id).toBe("pixel");
    expect((await userTheme(usersClient("liquid-glass"), "u1")).id).toBe(
      DEFAULT_THEME
    );
    expect((await userTheme(usersClient(null), "u1")).id).toBe(DEFAULT_THEME);
  });
});
