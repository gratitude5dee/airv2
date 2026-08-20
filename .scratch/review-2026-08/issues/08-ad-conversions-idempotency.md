# P1-4: ad_conversions has no idempotency key

Status: resolved — fixed in [PR #126](https://github.com/gratitude5dee/airv2/pull/126) (event_id + UNIQUE(account_id, event_id) + on-conflict-do-nothing upsert)

Replayed postbacks inflate conversions/value_cents. Fix: client event_id + UNIQUE(account_id, event_id), upsert. 0014_ads.sql:89, app/api/ads/conversions/route.ts:53.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
