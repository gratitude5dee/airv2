# Wave 2: generic agent card route POST /api/cards/[kind]

Status: resolved — generic `POST /api/cards/[kind]` (all 16 registered kinds, same gateway-token auth + owner destination + per-kind cooldown as the computer/browser routes) landed in the "mount dark features" PR (devin/1787241959-mount-dark-features). Phase 3 added the 17th kind: `ads` (dead kind #11 comes alive with the ads mini-app port).

claimCardSend supports all 16 kinds; 12 have no send path. Feature idea 4 in 02-miniapps-review.md.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
