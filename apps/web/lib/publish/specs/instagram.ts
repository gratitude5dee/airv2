/**
 * Instagram content-publishing constraints, expressed as data (CM3 task 3).
 * Verified 2026-08-10 against the Instagram Platform docs
 * (developers.facebook.com/docs/instagram-platform/content-publishing).
 * These numbers change — re-verify on drift, and turn every real platform
 * rejection into a conformance fixture.
 */
export const INSTAGRAM_SPEC = {
  /** Feed image aspect ratio must be within [4:5, 1.91:1]. */
  minAspect: 4 / 5,
  maxAspect: 1.91,
  maxCaptionChars: 2200,
  maxHashtags: 30,
  /** A carousel holds 2–10 items and counts as one post. */
  maxCarouselItems: 10,
  /** Reels: 3s–15min (API upload). */
  minVideoSeconds: 3,
  maxVideoSeconds: 15 * 60,
  /** Content Publishing API: 25 posts per account per rolling 24h. */
  dailyCap: 25,
} as const;
