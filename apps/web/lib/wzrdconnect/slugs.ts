/**
 * WZRD Connect naming glue (R-CONN-01): the connections mirror keeps the
 * canonical toolkit slug the rest of airv2 knows (googlecalendar, tiktok,
 * twitter… — same slugs the Composio rows carry so meta/health maps stay
 * correct), and the open-connector service id lives behind this map. The
 * two differ only where upstream named the service something else.
 */

/** canonical toolkit slug → open-connector service id. */
const TOOLKIT_TO_WZRD_SERVICE: Record<string, string> = {
  tiktok: "tiktok_business",
};

/** open-connector service id → canonical toolkit slug. */
const WZRD_SERVICE_TO_TOOLKIT: Record<string, string> = {
  tiktok_business: "tiktok",
};

export function wzrdServiceFor(toolkit: string): string {
  return TOOLKIT_TO_WZRD_SERVICE[toolkit] ?? toolkit;
}

export function toolkitForWzrdService(service: string): string {
  return WZRD_SERVICE_TO_TOOLKIT[service] ?? service;
}

/**
 * Deterministic per-user connection alias (`air-<userId>`): satisfies the
 * worker's alias syntax and lets the box proxy name the user's connection
 * without a DB lookup.
 */
export function wzrdConnectionAlias(userId: string): string {
  return `air-${userId}`;
}

/**
 * The toolkits the Connect grid offers on WZRD Connect — the surface airv2
 * actually wires (publish platforms, calendar/mail, brand sources, dev
 * tools), in display order. Missing from upstream's catalog: `facebook`
 * has no provider at all, so it is deliberately absent rather than a
 * button that always fails.
 */
export const WZRD_CONNECT_TOOLKITS = [
  "googlecalendar",
  "gmail",
  "instagram",
  "twitter",
  "youtube",
  "tiktok",
  "linkedin",
  "shopify",
  "github",
  "slack",
  "notion",
  "airtable",
] as const;

/**
 * Composio tool slug → WZRD Connect action id. Only the publish pipeline's
 * slugs belong here — the box agent discovers the full catalog itself via
 * search_actions. Slugs with no equivalent action (no facebook provider,
 * no tiktok publish action, the instagram container/step API) stay out:
 * execution reports them as unsupported instead of silently mis-mapping.
 */
export const WZRD_ACTION_FOR_SLUG: Record<string, string> = {
  INSTAGRAM_CREATE_POST: "instagram.publish_media",
  INSTAGRAM_GET_POST_INSIGHTS: "instagram.get_media_insights",
  TWITTER_CREATION_OF_A_POST: "twitter.creation_of_a_post",
  YOUTUBE_UPLOAD_VIDEO: "youtube.upload_video_from_url",
};
