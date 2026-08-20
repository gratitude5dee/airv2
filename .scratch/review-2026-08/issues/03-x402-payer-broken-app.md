# P0-3: paying x402 visitors get a broken app

Status: resolved

Synthetic userId x402:<payer> flows into ensureBoxAwake (uuid lookup throws); state GET/action POST 500. Fix: resolve state against the app owner's box for x402/guest sessions (grant-guests already do) or return {state:{}} read-only. app/api/apps/v1/state/route.ts:26-33.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.

Comments: Fixed in PR #123 — stateUserId() resolves x402:<payer> sessions to the app owner's box (grant-guest pattern) for state GET and action POST; ownerless apps get {state:{}} read-only.
