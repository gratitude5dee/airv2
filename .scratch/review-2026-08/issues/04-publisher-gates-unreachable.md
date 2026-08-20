# P0-4: publisher monetization is unreachable

Status: open

No code path writes x402_enabled/x402_price_usdc/password_hash/plugin_signin_enabled/access. Fix: owner-scoped PATCH on /api/mini/publish + four form controls on the publish page (hashPassword exists in gates.ts). lib/miniapps/publish.ts:91-106.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
