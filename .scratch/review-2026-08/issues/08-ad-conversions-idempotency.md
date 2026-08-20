# P1-4: ad_conversions has no idempotency key

Status: open

Replayed postbacks inflate conversions/value_cents. Fix: client event_id + UNIQUE(account_id, event_id), upsert. 0014_ads.sql:89, app/api/ads/conversions/route.ts:53.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
