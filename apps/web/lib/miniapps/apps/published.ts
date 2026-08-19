/**
 * MA3 published-bundle module: registry rows with owner_user_id set and a
 * bundle_version dispatch here instead of FIRST_PARTY_MODULES. The bundle is
 * static files on R2 (apps/<slug>/<version>/); index.html is served through
 * the loader under the strict publisher CSP — bundles can talk only to the
 * Apps API on their own origin, embed only in the store and the main app,
 * and never register service workers (rejected at upload; workers also have
 * no worker-src here).
 *
 * The render also mints the Apps API cookie: the session cookie is scoped to
 * /<slug>, which fetch("/api/apps/v1/…") would not carry — so a second
 * HttpOnly cookie carrying the same claims goes out scoped to /api/apps.
 */
import { NextResponse } from "next/server";
import { env } from "../../env";
import { getObject, r2Configured } from "../../storage/r2";
import { mintToken } from "../tokens";
import type { RegistryApp } from "../registry";
import type { MiniAppContext, MiniAppModule } from "./types";

export function publisherCsp(): string {
  return (
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    `img-src 'self' ${env.r2PublicBaseUrl()} data:; connect-src 'self'; ` +
    `form-action 'self'; frame-ancestors 'self' ${env.appOrigin()}`
  );
}

export function apiCookieName(slug: string): string {
  return `mini_api_${slug}`;
}

export const API_COOKIE_PATH = "/api/apps";

function bundleHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": publisherCsp(),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
}

async function render(ctx: MiniAppContext): Promise<NextResponse> {
  const version = ctx.app.bundle_version;
  if (!version) {
    return new NextResponse("not found", { status: 404 });
  }
  if (!r2Configured()) {
    return new NextResponse("app storage unavailable", { status: 503 });
  }
  const object = await getObject(`apps/${ctx.app.slug}/${version}/index.html`);
  if (!object) {
    return new NextResponse("bundle missing", { status: 404 });
  }
  const response = new NextResponse(new Uint8Array(object.body), {
    status: 200,
    headers: {
      ...bundleHeaders(),
      "Content-Type": "text/html; charset=utf-8",
    },
  });
  response.cookies.set(
    apiCookieName(ctx.app.slug),
    mintToken(ctx.session.userId, ctx.app.slug, ctx.session.resourceId, 15, {
      role: ctx.session.role,
      grantId: ctx.session.grantId,
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: API_COOKIE_PATH,
      maxAge: 15 * 60,
    }
  );
  return response;
}

const module_: MiniAppModule = { render };

/**
 * Loader dispatch hook: a row is a published bundle when a publisher owns it
 * and a bundle version exists. First-party rows (owner_user_id null) never
 * match, so FIRST_PARTY_MODULES keeps precedence.
 */
export function publishedModule(app: RegistryApp): MiniAppModule | null {
  return app.owner_user_id && app.bundle_version ? module_ : null;
}

/** Shared by the asset route: serve one bundle file with the strict CSP. */
export async function serveBundleAsset(
  app: RegistryApp,
  path: string,
  contentType: string
): Promise<NextResponse> {
  if (!r2Configured()) {
    return new NextResponse("app storage unavailable", { status: 503 });
  }
  const object = await getObject(`apps/${app.slug}/${app.bundle_version}/${path}`);
  if (!object) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(object.body), {
    status: 200,
    headers: {
      ...bundleHeaders(),
      // Immutable per version: the key embeds bundle_version.
      "Cache-Control": "private, max-age=3600",
      "Content-Type": contentType,
    },
  });
}
