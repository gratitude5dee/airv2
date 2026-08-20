# P0-2: x402 settle at /api/mini/launch burns payment without access

Status: open

Middleware never sets x-mini-host on /api/mini/*, so paid cookie is minted Path=/mini/<slug> while app serves at /<slug>; the 301 hop drops it. Fix: explicit external basePath into the gate (or mark /api/mini/* with x-mini-host); launch returns {url} after settlement. lib/payments/x402.ts:341, middleware.ts:76-83, app/api/mini/launch/route.ts:62-65.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
