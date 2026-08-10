/**
 * Adapter registry (CM3). TikTok ships dark: the adapter exists and is
 * conformance-tested, but resolves only when PUBLISH_TIKTOK=1 — flip the
 * flag when the V4 Content Posting API review clears.
 */
import type { Platform, PublishAdapter } from "./adapter";
import { instagramAdapter } from "./adapters/instagram";
import { facebookAdapter } from "./adapters/facebook";
import { xAdapter } from "./adapters/x";
import { youtubeAdapter } from "./adapters/youtube";
import { tiktokAdapter } from "./adapters/tiktok";

const ADAPTERS: Record<Platform, PublishAdapter> = {
  instagram: instagramAdapter,
  facebook: facebookAdapter,
  x: xAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter,
};

/** Adapters currently enabled for publishing (dark flags applied). */
export function allAdapters(): PublishAdapter[] {
  return Object.keys(ADAPTERS)
    .map((platform) => adapterFor(platform))
    .filter((adapter): adapter is PublishAdapter => adapter !== null);
}

/** Every adapter including dark ones — for conformance tests only. */
export function allAdaptersIncludingDark(): PublishAdapter[] {
  return Object.values(ADAPTERS);
}

export function adapterFor(platform: string): PublishAdapter | null {
  if (!Object.prototype.hasOwnProperty.call(ADAPTERS, platform)) return null;
  if (platform === "tiktok" && process.env.PUBLISH_TIKTOK !== "1") {
    return null;
  }
  return ADAPTERS[platform as Platform];
}
