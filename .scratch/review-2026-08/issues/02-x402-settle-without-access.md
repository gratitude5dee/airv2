# P0-2: x402 settle at /api/mini/launch burns payment without access

Status: resolved

Middleware never sets x-mini-host on /api/mini/*, so paid cookie is minted Path=/mini/<slug> while app serves at /<slug>; the 301 hop drops it. Fix: explicit external basePath into the gate (or mark /api/mini/* with x-mini-host); launch returns {url} after settlement. lib/payments/x402.ts:341, middleware.ts:76-83, app/api/mini/launch/route.ts:62-65.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.

Comments: Fixed in PR #123 — middleware now marks /api/mini/* with x-mini-host, the x402 gate takes an explicit basePath (cookie Path matches the serving path in both host forms), and a settled launch returns 200 {url} instead of the gate redirect.
