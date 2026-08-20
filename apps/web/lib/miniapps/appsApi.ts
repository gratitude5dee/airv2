/**
 * MA3 Apps API session resolution. Published bundles authenticate with the
 * HttpOnly mini_api_<slug> cookie the loader minted at render (path-scoped
 * to /api/apps — the app-view cookie's path /<slug> never reaches here). The
 * cookie carries the same signed claims as the session cookie: userId,
 * resourceId, role, grantId. The slug comes from the cookie name and must
 * verify against the claims (the path is a routing hint, never authz — MA2).
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyToken } from "./tokens";
import { getRegistryApp, type RegistryApp } from "./registry";
import type { MiniSession } from "./gates";
import { publishedModule } from "./apps/published";
import { getObject } from "../storage/r2";

const API_COOKIE_PREFIX = "mini_api_";

export interface AppsApiSession {
  app: RegistryApp;
  session: MiniSession;
}

/**
 * Resolve the calling app + session. When multiple app cookies are present
 * the bundle disambiguates with an X-App-Slug header; otherwise exactly one
 * valid cookie must exist.
 */
export async function appsApiSession(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<AppsApiSession | null> {
  const headerSlug = request.headers.get("x-app-slug")?.toLowerCase().trim();
  const candidates: { slug: string; value: string }[] = [];
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith(API_COOKIE_PREFIX)) continue;
    const slug = cookie.name.slice(API_COOKIE_PREFIX.length);
    if (headerSlug && slug !== headerSlug) continue;
    candidates.push({ slug, value: cookie.value });
  }
  for (const candidate of candidates) {
    const claims = verifyToken(candidate.value, candidate.slug);
    if (!claims) continue;
    const app = await getRegistryApp(supabase, candidate.slug);
    if (!app || !publishedModule(app)) continue;
    if (app.status !== "published") continue;
    return {
      app,
      session: {
        userId: claims.userId,
        resourceId: claims.resourceId,
        role: claims.role ?? "owner",
        grantId: claims.grantId,
      },
    };
  }
  return null;
}

/**
 * The box user whose filesystem holds the app's state (MA3, C4). Grant-guest
 * sessions already carry the owner's user id in their claims; x402 paid
 * sessions carry a synthetic "x402:<payer>" principal that maps to no box,
 * so their state resolves against the app owner's box instead. Null when no
 * box-backed user exists for the session.
 */
export function stateUserId(auth: AppsApiSession): string | null {
  if (auth.session.userId.startsWith("x402:")) {
    return auth.app.owner_user_id;
  }
  return auth.session.userId;
}

export interface BundleManifest {
  actions: string[];
  guestActions: string[];
}

/**
 * Optional manifest.json in the bundle declares the typed actions the app
 * accepts (and which are guest-safe). No manifest = no actions.
 */
export async function bundleManifest(app: RegistryApp): Promise<BundleManifest> {
  const empty: BundleManifest = { actions: [], guestActions: [] };
  if (!app.bundle_version) return empty;
  try {
    const object = await getObject(
      `apps/${app.slug}/${app.bundle_version}/manifest.json`
    );
    if (!object) return empty;
    const parsed = JSON.parse(object.body.toString("utf8")) as {
      actions?: unknown;
      guestActions?: unknown;
    };
    const strings = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    return {
      actions: strings(parsed.actions),
      guestActions: strings(parsed.guestActions),
    };
  } catch {
    return empty;
  }
}
