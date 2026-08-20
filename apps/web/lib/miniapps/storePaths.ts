/**
 * Store surfaces render on two hosts (hybrid, goal.md §4.2): the sandboxed
 * mini origin (store home at /, detail at /store/<slug>) and the main origin
 * (canonical pages at /mini and /mini/<slug>). Middleware marks mini-origin
 * requests with x-mini-host; pages resolve their links and form targets
 * through this helper so both hosts render working navigation. Sign-in and
 * publishing stay on the mini origin — the main origin never mints store
 * sessions.
 */
import { headers } from "next/headers";
import { env } from "../env";

export interface StorePaths {
  /** Store home path on the current host. */
  home: string;
  /** App detail path on the current host. */
  detail: (slug: string) => string;
  /** Store sign-in URL (always the mini origin's login). */
  login: string;
  /** Publisher console URL (always the mini origin's publish). */
  publish: string;
}

export async function storePaths(): Promise<StorePaths> {
  const onMini = (await headers()).get("x-mini-host") === "1";
  if (onMini) {
    return {
      home: "/",
      detail: (slug) => `/store/${slug}`,
      login: "/login",
      publish: "/publish",
    };
  }
  const mini = env.miniappOrigin().replace(/\/$/, "");
  return {
    home: "/mini",
    detail: (slug) => `/mini/${slug}`,
    login: `${mini}/login`,
    publish: `${mini}/publish`,
  };
}

export { canonicalDetailUrl, canonicalStoreHome } from "./discovery";
