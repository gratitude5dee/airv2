# air 2.0 — Platform Guide

A personal AI agent with its own phone number, its own inbox, and its own
computer — tied to exactly one person. This page is the operator/developer
overview of how the deployed system fits together. The specification of
record remains [`goal.md`](../goal.md) and [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## The shape of the system

```
                 ┌──────────────────────────────────────────────┐
                 │  Vercel — Next.js control plane (apps/web)   │
 iMessage ──────▶│  /api/inbound/imessage   (Spectrum webhook)  │
 email ─────────▶│  /api/inbound/email      (AgentMail webhook) │
 browser ───────▶│  /login /home /@handle   (thirdweb OTP auth) │
                 │  /api/gateway/v1/*       (inference gateway) │
                 └──────────────┬───────────────────────────────┘
                                │ routing/metadata only
                    ┌───────────▼───────────┐
                    │  Supabase (one, shared)│  users, boxes, lines,
                    │  never message content │  handles, senders, runs
                    └───────────┬───────────┘
                                │ one row → one box
              ┌─────────────────▼──────────────────┐
              │  ascii.dev Box — per-user Ubuntu VM │
              │  Hermes agent + durable ~/.hermes   │
              │  MCP: AgentMail (draft-only),       │
              │       Composio (per-user session),  │
              │       Daytona (throwaway sandboxes) │
              └─────────────────────────────────────┘
```

**Invariant I1:** one user → one Hermes agent → one Box → one durable
filesystem. Supabase answers "whose computer is this message for?" — it never
stores durable message content or agent memory; those live in `~/.hermes` on
the user's Box.

## User lifecycle

1. **Provision** — operator invite (`/api/admin/provision`) or self-serve
   signup after OTP verification. The template Box (M0) is forked; the fork
   gets a fresh `API_SERVER_KEY`, a per-box `GATEWAY_TOKEN`, and its gateway
   base URL rewritten to production.
2. **Identity** — thirdweb phone OTP creates/attaches a wallet; the phone
   becomes the user's verified iMessage handle.
3. **Line** — a Photon/Spectrum iMessage line is bound in `lines`
   (dedicated where available; the shared line routes by sender handle).
4. **Email** — setting a username provisions an AgentMail pod + inbox; the
   Box receives a draft-only key (it structurally cannot send — C10).
5. **Steady state** — the Box stops after an idle window (`stop_after`,
   swept by cron) and cold-resumes transparently on the next message.
6. **Deletion/export** — `/api/admin/delete` releases the line, inbox, and
   Box; `/api/admin/export` hands the user their data.

## Channels — parallel clients over one conversation

Web chat and iMessage are two clients of the same Hermes session
(`air-main`), so history and context are shared; each run is tagged
`{ channel: "web" | "imessage" }`. Email runs thread-scoped sessions
(`email:<thread_id>`). New channels (WhatsApp, etc.) plug in as adapters
that resolve to the same user and pass the same session key.

Every webhook follows the same discipline: **verify** the signature →
**resolve** (line → user, falling back to sender handle on the shared line)
→ **dedupe** by message id → **ack** 200 → process async. Inbound iMessages
get a read receipt and typing indicator while the agent works; replies
stream back through Spectrum. Unknown senders are trust-tier gated: no run,
no reply — a "Needs you" decision for the owner instead.

## Inference gateway

Boxes never hold provider keys (C2). Hermes speaks OpenAI-compatible chat
to `/api/gateway/v1/*` with its per-box `GATEWAY_TOKEN`; the gateway:

- resolves the box → user → entitlement (speed tier + spend cap),
- maps the tier to a real model server-side (`fast`/`balanced` →
  `gpt-5.6-luna`, `deep` → `gpt-5.6-terra`; the box only ever sees tier
  names),
- injects OpenAI `service_tier: "fast"` and normalizes GPT-5.6 params
  (`max_tokens` → `max_completion_tokens`; tool-bearing calls pin
  `reasoning_effort: "none"` per OpenAI's chat-completions restriction),
- streams SSE through, meters usage into `agent_runs`, and enforces caps.

## The Box is the computer; Daytona is the scratchpad

Each Box is a full Ubuntu VM — Hermes' terminal and file tools operate on
it directly and everything persists on the user's durable filesystem.

For risky or experimental code the agent additionally has **Daytona** MCP
tools (installed via `hermes mcp add daytona --command daytona --args mcp
start`): create an ephemeral cloud sandbox, execute code, pull results,
destroy it. The Daytona CLI is baked into the template
(`infra/template/setup.sh`) so every new user's box gets it.

> Beta caveat: boxes currently share one Daytona org key, so sandboxes are
> not isolated between users. Move to per-user keys before opening signup.

## Security posture (short form)

Full rationale in [`SECURITY-DECISIONS.md`](../SECURITY-DECISIONS.md).

- Provider keys (OpenAI, AgentMail org, Composio, thirdweb, Box API) live
  in Vercel env only — never in a Box, never in the browser.
- The browser sees no Box hosted URLs or tokens; the dashboard talks to an
  allowlisted server-side proxy (`/api/box/[...path]`).
- The Box's only credentials are scoped to itself: its gateway token and a
  draft-only AgentMail key.
- Supabase is routing/metadata only; RLS denies anonymous access.
- Migrations are forward-only; box stops never use `force: true`.

## Operations

- `GET /api/admin/ops` — start-rate, line health, spend overview.
- Cron sweeper (`/api/cron/sweep`) stops idle boxes past `stop_after`.
- Structured logs carry `user_id`/`box_id` on every box-touching line and
  never include message content.
