/**
 * Request-scoped style resolution. The loader route resolves the session
 * owner's saved theme + backdrop once and runs the module inside `withStyle`;
 * every `renderShell`/`shellHtml` call in that request then defaults to it
 * without each of the ~25 renderer modules threading parameters through.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_THEME, isThemeId, theme, type Theme } from "./themes";
import {
  DEFAULT_BACKGROUND,
  isBackgroundId,
  type BackgroundId,
} from "./backgrounds";

export interface MiniStyle {
  readonly theme: Theme;
  readonly background: BackgroundId;
  /** Signed link back to the Home mini-app for this session's owner —
   *  the shell's wordmark becomes a tappable home button when set. */
  readonly homeHref?: string | undefined;
}

const store = new AsyncLocalStorage<MiniStyle>();

export function withStyle<T>(current: MiniStyle, fn: () => T): T {
  return store.run(current, fn);
}

export function withTheme<T>(current: Theme, fn: () => T): T {
  return withStyle({ theme: current, background: DEFAULT_BACKGROUND }, fn);
}

/** The request's resolved theme, or the default outside `withStyle`. */
export function activeTheme(): Theme {
  return store.getStore()?.theme ?? theme(DEFAULT_THEME);
}

/** The request's resolved backdrop, or the theme's own outside `withStyle`. */
export function activeBackground(): BackgroundId {
  return store.getStore()?.background ?? DEFAULT_BACKGROUND;
}

/** The request's Home link for the shell wordmark, when one was minted. */
export function activeHomeHref(): string | undefined {
  return store.getStore()?.homeHref;
}

/**
 * The columns of the `users` row every mini-app request needs: the style the
 * shell renders in, plus the handle renderers show. One row, one read.
 */
export interface MiniUserProfile {
  username: string | null;
  miniappTheme: string | null;
  miniappBackground: string | null;
}

const profiles = new AsyncLocalStorage<Map<string, Promise<MiniUserProfile>>>();

/**
 * Memoize the `users` row for the duration of one request. The loader
 * resolves the style before the renderer runs, so without this an app that
 * also needs `username` (onboarding) would read the same row twice.
 */
export function withProfileCache<T>(fn: () => T): T {
  return profiles.run(new Map(), fn);
}

async function readProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<MiniUserProfile> {
  const { data } = await supabase
    .from("users")
    .select("username, miniapp_theme, miniapp_background")
    .eq("id", userId)
    .maybeSingle();
  return {
    username: (data?.username as string | null) ?? null,
    miniappTheme: (data?.miniapp_theme as string | null) ?? null,
    miniappBackground: (data?.miniapp_background as string | null) ?? null,
  };
}

/** The user's profile row, shared with anything else in this request. */
export function userProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<MiniUserProfile> {
  const cache = profiles.getStore();
  if (!cache) return readProfile(supabase, userId);
  const hit = cache.get(userId);
  if (hit) return hit;
  const pending = readProfile(supabase, userId);
  cache.set(userId, pending);
  return pending;
}

export function styleFromProfile(profile: MiniUserProfile): MiniStyle {
  const id = String(profile.miniappTheme ?? "");
  const background = String(profile.miniappBackground ?? "");
  return {
    theme: theme(isThemeId(id) ? id : DEFAULT_THEME),
    background: isBackgroundId(background) ? background : DEFAULT_BACKGROUND,
  };
}

/** The saved style for a user (guests see the app owner's choice). */
export async function userStyle(
  supabase: SupabaseClient,
  userId: string
): Promise<MiniStyle> {
  return styleFromProfile(await userProfile(supabase, userId));
}

/** The saved theme for a user (guests see the app owner's choice). */
export async function userTheme(
  supabase: SupabaseClient,
  userId: string
): Promise<Theme> {
  return (await userStyle(supabase, userId)).theme;
}
