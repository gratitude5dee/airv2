/**
 * YouTube upload constraints (CM3 task 3). Verified 2026-08-10 against the
 * YouTube Data API v3 docs (developers.google.com/youtube/v3/docs/videos).
 * Title ≤ 100 chars, description ≤ 5000 bytes, no angle brackets in either.
 */
export const YOUTUBE_SPEC = {
  maxTitleChars: 100,
  maxDescriptionChars: 5000,
  /** Unverified accounts: 15 minutes. Treat as the floor. */
  maxVideoSeconds: 15 * 60,
  /** API quota (10k units/day, 1600/upload) bounds uploads to ~6/day. */
  dailyCap: 6,
} as const;
