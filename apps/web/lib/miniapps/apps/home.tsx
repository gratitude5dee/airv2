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
import { setMiniappHomeOrder } from "@/lib/settings/account";
import { externalOrigin } from "../gates";
import { listFirstPartyApps } from "../registry";
import { timedFetch } from "../timing";
import { mintToken } from "../tokens";
import { esc, forbidden, withBaseHeaders } from "../html";
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

function rank(slug: string, saved: string[]): number {
  // The user's press-and-hold arrangement wins; LAUNCH_ORDER seeds the rest.
  const savedIndex = saved.indexOf(slug);
  if (savedIndex !== -1) return savedIndex;
  const i = (LAUNCH_ORDER as readonly string[]).indexOf(slug);
  return saved.length + (i === -1 ? LAUNCH_ORDER.length : i);
}

async function savedOrder(
  ctx: MiniAppContext
): Promise<string[]> {
  const { data } = await ctx.supabase
    .from("users")
    .select("miniapp_home_order")
    .eq("id", ctx.session.userId)
    .maybeSingle();
  const raw = data?.miniapp_home_order;
  return Array.isArray(raw) ? raw.filter((s) => typeof s === "string") : [];
}

export const home: MiniAppModule = {
  async render(ctx: MiniAppContext) {
    const { session, supabase, basePath } = ctx;
    const [allApps, saved] = await timedFetch("home", "registry+order", () =>
      Promise.all([listFirstPartyApps(supabase), savedOrder(ctx)])
    );
    const apps = allApps.filter((app) => app.status === "published");
    apps.sort((a, b) => rank(a.slug, saved) - rank(b.slug, saved));
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
          `<a href="${href(app.slug)}" data-slug="${esc(app.slug)}" aria-label="Open ${esc(app.name)}">${avatar(app)}<span class="label">${esc(app.name)}</span></a>`
      )
      .join("");
    // Press-and-hold rearrange posts through this hidden form (ui.js).
    const orderForm = `<form id="order-form" method="post" hidden><input type="hidden" name="action" value="set_order"><input type="hidden" name="order" value=""></form>`;
    const featured = launchable.slice(0, 3);
    const feed = featured
      .map(
        (app) =>
          `<a class="approw" href="${href(app.slug)}">${avatar(app)}<span class="meta"><span class="name">${esc(app.name)}</span><span class="desc">${esc(app.description)}</span></span></a><a class="hero spot" style="--tint:${tintHue(app.slug)}" href="${href(app.slug)}" aria-label="Open ${esc(app.name)}">${avatar(app)}</a>`
      )
      .join("");
    return homeHtml(
      renderShell({
        title: "Home",
        kicker: "Your apps",
        body: `<div class="icongrid" data-reorder>${icons}</div>${orderForm}<h2 class="explore grad-text">Explore</h2>${feed}<p class="muted" style="width:min(100%,36rem);text-align:center">Press and hold an icon to rearrange your apps.</p><script src="/creator-os/ui.js" defer></script>`,
        lite: session.via === "card",
      })
    );
  },

  async action(ctx: MiniAppContext, form: FormData) {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    if (String(form.get("action") ?? "") !== "set_order") {
      return forbidden("unknown action");
    }
    const published = new Set(
      (await listFirstPartyApps(ctx.supabase))
        .filter((app) => app.status === "published")
        .map((app) => app.slug)
    );
    const slugs = String(form.get("order") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => published.has(s))
      .slice(0, 64);
    await setMiniappHomeOrder(ctx.supabase, ctx.session.userId, slugs);
    return withBaseHeaders(
      NextResponse.redirect(
        new URL(ctx.basePath, externalOrigin(ctx.request)),
        303
      )
    );
  },
};
