# air 2.0

A personal AI agent with its own phone number, its own inbox, and its own computer — tied to exactly one person.

One user = one Hermes agent inside one Box sandbox, orchestrated by a Next.js control plane on Vercel + one shared Supabase (routing only, never content), iMessage via Photon Spectrum, email via AgentMail, identity/wallet via thirdweb, connectors via Composio.

**Specification of record:** [`goal.md`](goal.md) (executable milestone plan) and [`ARCHITECTURE.md`](ARCHITECTURE.md) (reasoning; tie-breaker where they disagree). Security posture decisions live in [`SECURITY-DECISIONS.md`](SECURITY-DECISIONS.md).

## Layout

```
apps/web/                      Next.js (App Router) — the control plane + UI
  app/api/inbound/email        AgentMail webhook (Svix-verified)
  app/api/inbound/imessage     Spectrum webhook (HMAC-verified)
  app/api/gateway/v1/[...path] OpenAI-compatible inference gateway
  app/api/box/[...path]        allowlisted Hermes dashboard proxy
  lib/box/                     Box SDK wrapper: fork, resume, stop, command, files
  lib/hermes/                  api_server client: runs, sessions, approvals
  lib/routing/                 address → user → box → trust tier
  lib/entitlements/            plan, speed tier, spend caps
supabase/migrations/           versioned, forward-only SQL (applied via Supabase MCP)
infra/template/                everything baked into the Box template (M0)
```

## Conventions

- TypeScript strict; no `any` in `lib/`.
- All Box and Hermes calls go through `lib/box/` and `lib/hermes/`.
- Every webhook handler ships an idempotency test in the same PR.
- Structured logs carry `user_id` and `box_id` on every line touching a box.
- Migrations are forward-only and numbered; never edit an applied migration.

## Commands

```bash
npm install
npm run dev         # Next.js dev server (apps/web)
npm run typecheck
npm run lint
npm run test
```

Environment variables are listed in goal.md §5 — all server-side, none `NEXT_PUBLIC_`.
