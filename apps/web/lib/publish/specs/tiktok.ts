/**
 * TikTok Content Posting constraints (CM3 task 3). Verified 2026-08-10
 * against developers.tiktok.com/doc/content-posting-api. The adapter stays
 * dark behind PUBLISH_TIKTOK until the V4 app review clears.
 *
 * TikTok has NO native scheduling: every "scheduled" TikTok is our cron
 * firing an immediate publish at slot time. That is a reliability
 * requirement on the CM4 worker, not a footnote.
 */
export const TIKTOK_SPEC = {
  maxCaptionChars: 2200,
  minVideoSeconds: 3,
  maxVideoSeconds: 10 * 60,
  /** Content Posting API: per-user daily post cap. */
  dailyCap: 15,
} as const;
