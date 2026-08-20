# P1-5: abandoned presigns permanently leak storage quota

Status: resolved — fixed in [PR #126](https://github.com/gratitude5dee/airv2/pull/126) (cron sweep releases stale pending_uploads and refunds charge)

Presign pre-charges bytes_used; promised sweeper never built. Fix: sweep pending_uploads older than presign TTL in existing cron; addUsage(-charged). lib/storage/confirm.ts:27, app/api/media/upload-url/route.ts:86.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
