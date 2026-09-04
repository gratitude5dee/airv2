/**
 * V11 §8.2 step 7 / CR13: the owner-only preview of a draft. The mini
 * origin's loader only admits published apps, so a draft is previewed on the
 * app origin — a 60-second app token carrying `draft: true` for the owner's
 * principal, which the Dispatcher exchanges for a __Host- cookie and then
 * routes to `<slug>-draft`. Anyone else gets the manifest's 404. Null when
 * the app-origin lane is unconfigured (nothing serves drafts then).
 */
import { ENTER_PATH, appOriginUrl } from "../functions/handoff";
import { appPrincipal } from "../functions/identity";
import { appOriginLaneReady } from "../functions/deploy";
import { mintAppToken } from "../functions/tokens";
import type { RegistryApp } from "../miniapps/registry";

export function draftPreviewUrl(app: RegistryApp): string | null {
  if (!appOriginLaneReady() || !app.owner_user_id) return null;
  const token = mintAppToken({
    app: app.slug,
    principal: appPrincipal(app.owner_user_id, app.id),
    role: "owner",
    resource: app.slug,
    draft: true,
  });
  if (!token) return null;
  const url = appOriginUrl(app.slug);
  url.pathname = ENTER_PATH;
  url.searchParams.set("t", token);
  return url.toString();
}
