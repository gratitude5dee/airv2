# P1-12: computer-relay skill sources entire ~/.hermes/.env

Status: resolved — PR #127

The skill now greps only `OPENAI_BASE_URL` and `OPENAI_API_KEY` out of
`~/.hermes/.env` (same pattern as the air-vault wrapper) instead of
sourcing the whole file into the model-orchestrated shell.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
