/**
 * Request-scoped theme resolution. The loader route resolves the session
 * owner's saved theme once and runs the module inside `withTheme`; every
 * `renderShell`/`shellHtml` call in that request then defaults to it without
 * each of the ~25 renderer modules threading a theme parameter through.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_THEME, isThemeId, theme, type Theme } from "./themes";

const store = new AsyncLocalStorage<Theme>();

export function withTheme<T>(current: Theme, fn: () => T): T {
  return store.run(current, fn);
}

/** The request's resolved theme, or the default outside `withTheme`. */
export function activeTheme(): Theme {
  return store.getStore() ?? theme(DEFAULT_THEME);
}

/** The saved theme for a user (guests see the app owner's choice). */
export async function userTheme(
  supabase: SupabaseClient,
  userId: string
): Promise<Theme> {
  const { data } = await supabase
    .from("users")
    .select("miniapp_theme")
    .eq("id", userId)
    .maybeSingle();
  const id = String(data?.miniapp_theme ?? "");
  return theme(isThemeId(id) ? id : DEFAULT_THEME);
}
