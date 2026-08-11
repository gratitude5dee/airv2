/**
 * Ad placement creative specs, expressed as data (CM5 task 1): one object
 * per placement, each with a citation and a `verified_on` date. The Google
 * specs are the reference implementation of the shape — the strictest
 * published set — even though the Google Ads *adapter* is out of scope.
 * Placement specs move; `staleSpecs` flags anything unverified for 90 days
 * so a wrong constant can't silently produce creative rejected at review.
 */

export interface SpecText {
  max: number;
  maxChars: number;
}

export interface CreativeSpec {
  id: string;
  /** Where the numbers come from — a doc URL, never memory. */
  citation: string;
  /** ISO date the constants were last checked against the citation. */
  verified_on: string;
  images?: { max?: number; ratios?: string[]; sizes?: string[] };
  logos?: { max?: number; ratios?: string[] };
  videos?: {
    max?: number;
    minSeconds?: number;
    maxSeconds?: number;
    orientations?: string[];
  };
  text?: {
    headlines?: SpecText;
    longHeadlines?: SpecText;
    descriptions?: SpecText;
  };
}

export const GOOGLE_PMAX_ASSET_GROUP: CreativeSpec = {
  id: "google.pmax.asset_group",
  citation:
    "https://support.google.com/google-ads/answer/10724817 (PMax asset requirements)",
  verified_on: "2026-08-10",
  images: { max: 20, ratios: ["1.91:1", "1:1", "4:5"] },
  logos: { max: 5, ratios: ["1:1", "4:1"] },
  videos: { max: 5, minSeconds: 10, orientations: ["16:9", "9:16", "1:1"] },
  text: {
    headlines: { max: 15, maxChars: 30 },
    longHeadlines: { max: 5, maxChars: 90 },
    descriptions: { max: 5, maxChars: 90 },
  },
};

export const GOOGLE_DEMAND_GEN: CreativeSpec = {
  id: "google.demandgen",
  citation:
    "https://support.google.com/google-ads/answer/13695777 (Demand Gen asset specs)",
  verified_on: "2026-08-10",
  images: { sizes: ["1200x628", "1200x1200", "960x1200"] },
  videos: { orientations: ["16:9", "9:16", "1:1"], minSeconds: 6, maxSeconds: 30 },
  text: {
    headlines: { max: 5, maxChars: 40 },
    descriptions: { max: 5, maxChars: 90 },
  },
};

/** Meta feed/reels single-media placements. Pulled from Meta's published
 * spec sheet, not memory — re-verify against the Marketing API's ad
 * creative metadata when the Meta lane goes live (CM5 task 1 note). */
export const META_FEED: CreativeSpec = {
  id: "meta.feed",
  citation: "https://www.facebook.com/business/ads-guide/image (Meta ads guide)",
  verified_on: "2026-08-10",
  images: { max: 10, ratios: ["1:1", "4:5", "1.91:1"] },
  videos: { max: 1, minSeconds: 1, orientations: ["1:1", "4:5", "16:9"] },
  text: {
    headlines: { max: 1, maxChars: 27 },
    descriptions: { max: 1, maxChars: 125 },
  },
};

export const META_REELS: CreativeSpec = {
  id: "meta.reels",
  citation:
    "https://www.facebook.com/business/ads-guide/video (Meta ads guide, Reels)",
  verified_on: "2026-08-10",
  videos: { max: 1, minSeconds: 4, maxSeconds: 90, orientations: ["9:16"] },
  text: {
    headlines: { max: 1, maxChars: 40 },
    descriptions: { max: 1, maxChars: 72 },
  },
};

/** ChatGPT Ads image placement (Advertiser API `files` upload). */
export const OPENAI_ADS_IMAGE: CreativeSpec = {
  id: "openai.ads.image",
  citation: "https://developers.openai.com/ads/api-overview (Ads API files)",
  verified_on: "2026-08-10",
  images: { max: 10, ratios: ["1:1", "1.91:1"] },
  text: {
    headlines: { max: 5, maxChars: 40 },
    descriptions: { max: 5, maxChars: 120 },
  },
};

export const AD_SPECS: Record<string, CreativeSpec> = Object.fromEntries(
  [
    GOOGLE_PMAX_ASSET_GROUP,
    GOOGLE_DEMAND_GEN,
    META_FEED,
    META_REELS,
    OPENAI_ADS_IMAGE,
  ].map((spec) => [spec.id, spec])
);

export const SPEC_STALE_AFTER_DAYS = 90;

/** Specs whose constants haven't been re-verified inside the window. */
export function staleSpecs(now: Date = new Date()): CreativeSpec[] {
  const cutoff = now.getTime() - SPEC_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return Object.values(AD_SPECS).filter(
    (spec) => new Date(`${spec.verified_on}T00:00:00Z`).getTime() < cutoff
  );
}
