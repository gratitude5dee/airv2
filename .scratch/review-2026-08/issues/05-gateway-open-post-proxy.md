# P1-1: gateway forwards any POST subpath with the platform key

Status: open

Only chat-completion SSE is metered; a compromised box can drive unmetered spend on /v1/responses, /v1/embeddings, etc. Fix: allowlist POST paths exactly like the GET arm (404 otherwise). app/api/gateway/v1/[...path]/route.ts:206.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
