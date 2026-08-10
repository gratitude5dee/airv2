/**
 * Facebook Page publishing constraints (CM3 task 3). Verified 2026-08-10
 * against the Pages API docs (developers.facebook.com/docs/pages-api).
 * Facebook's caption ceiling is effectively the post character limit.
 */
export const FACEBOOK_SPEC = {
  maxCaptionChars: 63206,
  maxMediaItems: 10,
  maxVideoSeconds: 4 * 60 * 60,
  /** No published hard API cap; conservative product cap to stay boring. */
  dailyCap: 25,
} as const;
