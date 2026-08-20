# P1-8: phone numbers stored unnormalized at provision

Status: resolved (PR #128)

Formatted bound_phone breaks owner tier-0 recognition. Fix: normalize once at the provisioning write boundary. lib/provisioning/provision.ts:85,94 vs routing/trust.ts:20-24.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
