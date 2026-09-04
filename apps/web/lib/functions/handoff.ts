/**
 * V11 §11.3 mini → app-origin hand-off. After the ordered gate chain has
 * approved a session on the mini origin, a published version that was
 * deployed as a Worker is not rendered here: the loader mints a 60-second
 * app token and 303s to `<slug>.apps.wzrd.tech/__air/enter?t=…`, where the
 * Dispatcher exchanges it for a __Host- cookie. Versions that predate the
 * lane (no worker digest) keep the legacy R2 render on the mini origin.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getVersion } from "../create/versions";
import { env } from "../env";
import type { MiniSession } from "../miniapps/gates";
import { appOriginHost } from "../miniapps/nested";
import type { RegistryApp } from "../miniapps/registry";
import { appOriginLaneReady } from "./deploy";
import { appPrincipal, guestPrincipal, type Principal } from "./identity";
import { mintAppToken, type AppRole } from "./tokens";

export const ENTER_PATH = "/__air/enter";

export function appOriginUrl(slug: string): URL {
  return new URL(`https://${appOriginHost(slug, env.appsOriginSuffix())}/`);
}

/** True when the app's live version runs on its own origin. */
export async function servedOnAppOrigin(
  supabase: SupabaseClient,
  app: RegistryApp
): Promise<boolean> {
  if (!appOriginLaneReady() || !app.bundle_version || !app.owner_user_id) {
    return false;
  }
  const version = await getVersion(supabase, app.id, app.bundle_version);
  return version?.worker_sha256 !== null && version?.worker_sha256 !== undefined;
}

export function appRoleFor(session: MiniSession): AppRole {
  return session.role === "guest" ? "guest" : "owner";
}

/**
 * A guest session carries the granting owner's user id (the grant is what
 * admitted it), so its principal is derived from the grant, never from that id.
 */
export function principalFor(app: RegistryApp, session: MiniSession): Principal | null {
  if (session.role === "guest") {
    return session.grantId ? guestPrincipal(session.grantId, app.id) : null;
  }
  return appPrincipal(session.userId, app.id);
}

/** The hand-off URL for an approved session, or null when the lane is off. */
export function handoffUrl(app: RegistryApp, session: MiniSession): URL | null {
  const principal = principalFor(app, session);
  if (!principal) return null;
  const token = mintAppToken({
    app: app.slug,
    principal,
    role: appRoleFor(session),
    resource: session.resourceId,
  });
  if (!token) return null;
  const url = appOriginUrl(app.slug);
  url.pathname = ENTER_PATH;
  url.searchParams.set("t", token);
  return url;
}
