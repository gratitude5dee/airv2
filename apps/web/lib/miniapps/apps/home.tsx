/**
 * Home mini-app — the dashboard as a card-openable launcher. Owner-only hub
 * that lists every published first-party app with a signed one-tap link, so
 * "open the home mini-app" lands a full-screen card instead of a raw
 * app.wzrd.tech/home URL. Links are minted server-side per render (15-minute
 * tokens scoped to this owner), preserving the card `via` marker so target
 * apps keep the lite webview render.
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { publicUrl } from "@/lib/storage/r2";
import { listFirstPartyApps } from "../registry";
import { mintToken } from "../tokens";
import { esc } from "../html";
import { avatarHtml, renderShell, shellHtml, tintHue } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";
import type { RegistryApp } from "../registry";

// App icons come from R2 — widen the shell's theme-derived img-src.
function homeHtml(body: string): NextResponse {
  const response = shellHtml(body);
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  response.headers.set(
    "Content-Security-Policy",
    csp.replace("img-src 'self'", `img-src 'self' ${env.r2PublicBaseUrl()}`)
  );
  return response;
}

function avatar(app: RegistryApp): string {
  return avatarHtml(
    app.name,
    app.slug,
    app.icon_key ? publicUrl(app.icon_key) : null
  );
}

/** Launcher order; anything published but unlisted here sorts after. */
const LAUNCH_ORDER = [
  "onboarding",
  "persona",
  "calendar",
  "todo",
  "kanban",
  "inbox",
  "vault",
  "connect",
  "pay",
  "shop",
  "crm",
  "analytics",
  "ads",
  "video",
  "image",
  "computer",
  "browser",
  "settings",
  "feedback",
] as const;

function rank(slug: string): number {
  const i = (LAUNCH_ORDER as readonly string[]).indexOf(slug);
  return i === -1 ? LAUNCH_ORDER.length : i;
}

export const home: MiniAppModule = {
  async render(ctx: MiniAppContext) {
    const { session, supabase, basePath } = ctx;
    const apps = (await listFirstPartyApps(supabase)).filter(
      (app) => app.status === "published"
    );
    apps.sort((a, b) => rank(a.slug) - rank(b.slug));
    // basePath is `/mini/home` on the main origin, `/home` on the mini host;
    // sibling apps live under the same prefix.
    const prefix = basePath.slice(0, -"/home".length);
    const launchable = apps.filter((app) => app.slug !== "home");
    const href = (slug: string) =>
      `${prefix}/${esc(slug)}?t=${mintToken(session.userId, slug, "default", 15, {
        via: session.via,
      })}`;
    const icons = launchable
      .map(
        (app) =>
          `<a href="${href(app.slug)}">${avatar(app)}<span class="label">${esc(app.name)}</span></a>`
      )
      .join("");
    const featured = launchable.slice(0, 3);
    const feed = featured
      .map(
        (app) =>
          `<a class="approw" href="${href(app.slug)}">${avatar(app)}<span class="meta"><span class="name">${esc(app.name)}</span><span class="desc">${esc(app.description)}</span></span></a><a class="hero" style="--tint:${tintHue(app.slug)}" href="${href(app.slug)}" aria-label="Open ${esc(app.name)}">${avatar(app)}</a>`
      )
      .join("");
    return homeHtml(
      renderShell({
        title: "Home",
        kicker: "Your apps",
        body: `<div class="icongrid">${icons}</div><h2 class="explore">Explore</h2>${feed}`,
        lite: session.via === "card",
      })
    );
  },
};
