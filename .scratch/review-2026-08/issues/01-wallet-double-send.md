# P0-1: wallet transfer can double-send

Status: open

No idempotency key on approved transfers; submit-throw resets submitting→pending so re-approval can broadcast twice. Fix: idempotency key derived from transfer.id sent to thirdweb; treat submit-throw as terminal-unknown, never reset to pending. lib/wallet/send.ts:231, lib/thirdweb/client.ts:53.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
