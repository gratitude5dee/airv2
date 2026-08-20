# P1-13: SSE terminal detection can miss a chunk-split run.completed

Status: open

web/desktop/bot streams substring-match undelimited chunks; buffer + frame-split like hermesDeltas. lib/chat/relay.ts:78, lib/bots/chat.ts:108.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
