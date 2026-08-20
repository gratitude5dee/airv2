# P1-7: default tier→model map stale; reasoning_effort pinned

Status: resolved (PR #128)

Defaults gpt-4o-mini/gpt-4o/o3 vs documented gpt-5.6-*; gateway pins reasoning_effort:none which 4o rejects. Fix defaults or gate injection on model family. lib/entitlements/models.ts:9, gateway route:176,187.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
