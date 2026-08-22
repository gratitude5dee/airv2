/**
 * Home mini-app — the dashboard as a card-openable launcher. Owner-only hub
 * that lists every published first-party app with a signed one-tap link, so
 * "open the home mini-app" lands a full-screen card instead of a raw
 * app.wzrd.tech/home URL. Links are minted server-side per render (15-minute
 * tokens scoped to this owner), preserving the card `via` marker so target
 * apps keep the lite webview render.
 */
import { listFirstPartyApps } from "../registry";
import { mintToken } from "../tokens";
import { esc } from "../html";
import { renderShell, shellHtml } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";

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
    const tiles = apps
      .filter((app) => app.slug !== "home")
      .map((app) => {
        const token = mintToken(session.userId, app.slug, "default", 15, {
          via: session.via,
        });
        return `<a class="tile" href="${prefix}/${esc(app.slug)}?t=${token}"><div class="name">${esc(app.name)}</div><div class="desc">${esc(app.description)}</div></a>`;
      })
      .join("");
    return shellHtml(
      renderShell({
        title: "Home",
        kicker: "Your apps",
        body: `<div class="grid">${tiles}</div>`,
        lite: session.via === "card",
      })
    );
  },
};
