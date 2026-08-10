/**
 * X (Twitter) posting constraints (CM3 task 3). Verified 2026-08-10 against
 * the X API v2 docs (docs.x.com). 280 weighted chars for standard accounts;
 * up to 4 images or 1 video per post.
 */
export const X_SPEC = {
  maxCaptionChars: 280,
  maxImages: 4,
  maxVideos: 1,
  maxVideoSeconds: 140,
  /** API v2 app+user rate posture; product-level cap per account per 24h. */
  dailyCap: 100,
} as const;
