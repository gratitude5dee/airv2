# P1-3: failed turns leak awake boxes

Status: open

ensureBoxAwake nulls stop_after eagerly; re-arm only on success; sweep never matches NULL. Fix: re-arm in finally; sweep catches ready boxes with NULL stop_after. lib/orchestrator/boxes.ts:157, flush.ts:553, chat/relay.ts:36.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
