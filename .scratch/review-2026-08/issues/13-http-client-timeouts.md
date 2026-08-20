# P1-9: no timeouts on box/Hermes/provider HTTP clients

Status: resolved — https://github.com/gratitude5dee/airv2/pull/129

Hung upstream pins a function to maxDuration. Fix: AbortSignal.timeout in shared fetch helpers (creative lane is the template). lib/box/client.ts:83, hermes/client.ts:62, agentmail, composio, thirdweb.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
