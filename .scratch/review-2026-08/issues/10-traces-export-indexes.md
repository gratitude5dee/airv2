# P1-6: missing indexes on traces-export hot path

Status: open

decisions (user_id, created_at) and miniapp_gate_events (user_id, created_at) indexes missing → per-user full scans. lib/traces/receipts.ts:132,145.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
