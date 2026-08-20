# P1-12: computer-relay skill sources entire ~/.hermes/.env

Status: open

Pulls all secrets incl. AIR_VAULT_KEY into the model-orchestrated shell. Fix: grep the two needed vars like the vault wrapper. infra/template/skills/computer-relay/SKILL.md:24.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
