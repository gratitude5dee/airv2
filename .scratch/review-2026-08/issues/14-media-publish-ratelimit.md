# P1-10: agent media_publish skips rate limit + ops ledger

Status: resolved (PR #128)

Add uploadRateLimited + recordOpsEvent(upload) like apps/v1/media-upload-url. app/api/media/publish/route.ts:81-140.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
