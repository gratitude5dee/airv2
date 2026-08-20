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

## The dashboard — eight tabs plus wave surfaces

`/home` is the owner's cockpit. Tab order is binding (V8):

1. **Chat** — web twin of the iMessage thread: streaming runs, file/photo
   upload into the box's `~/.hermes/inbox/` (references only in the prompt;
   raw bytes never touch Postgres), stop button (`POST /v1/runs/{id}/stop`),
   slash palette (`/imagine` `/animate` `/zap`), validated `@bot` mentions,
   per-message copy.
2. **Needs you** — the decision queue, grouped by kind with counts, a
   detail drawer showing the full safe payload, batch-approve for same-kind
   tier-1 email drafts, and 30 days of resolved history. Decision kinds are
   a closed vocabulary; every side-effecting path has a decision row.
3. **History** — read-only transcripts per session (exact allowlist entry
   `/api/box/api/sessions/{id}/messages`), title search, channel chips
   (`imessage`/`web`/`schedule`/`bot`), session delete.
4. **People** — sender roster with per-sender run counts (from
   `agent_runs`), tier promotion/demotion, block (mirrored to AgentMail
   Lists), recently-promoted audit line. Tier 0 is unassignable.
5. **Skills** — hub search/install/uninstall, hub-vs-installed update
   detection with an update action, per-skill detail sheet, suggested row
   seeded from the wave skills (`vault-use`, `social-engage`,
   `shopping-checkout`, `calendar-native`). All skill commands execute in
   the user's box server-side.
6. **Wallet** — balance + activity via thirdweb (Insight is intentionally
   degraded: native balance only), and a send flow that mints a
   `run_approval` decision — never sends from the composer; execution is
   server-side thirdweb after approval, ENS display-only.
7. **Computer** — **Screen** (the desktop stream iframe, keep-awake
   scheduling as `agent_schedules` rows with `deliver: 'none'`,
   server-fetched screenshot thumbnail, power-state sparkline from
   `box_state_events`) and **Browser** (the same desktop stream, scoped to
   the agent-driven headed browser — see SECURITY-DECISIONS).
8. **Connectors** — Composio toolkit cards with health, `used by` hints,
   and disconnect (Composio revoke + `connections.status='revoked'`).

Plus the wave surfaces: **Calendar** (spine below), **Vault** (metadata
mirror of the box-side encrypted store), **Bots** (below), **Ads**.

## Calendar — the V3 split

The calendar spine is split in two, on purpose:

- **Sources → moments → slots (content pipeline):** calendar providers
  (Google via Composio, cal.com via webhook, ICS by approval) feed
  `calendar_moments`; the sweeper turns moments into proposed content
  slots. This is read-side: nothing here can touch the box.
- **Schedules (execution pipeline):** `agent_schedules` rows fire via the
  cron sweeper — each fire wakes the box and runs a prompt, with receipts
  in `agent_runs` (`trigger: 'cron'`). `deliver: 'none'` rows (V8
  keep-awake) wake silently with no message delivery.

Inbound calendar content is hostile (I5): ICS from tier-2 senders is never
materialized — it becomes a `tier2_contact` decision; script-shaped fields
are sanitized before any render or box hand-off.

## Bots — topology (V7)

Bots are additional Hermes profiles **inside the owner's existing box** —
not new boxes, not new users. One `bots` row per profile (per-profile
`api_server_key` sealed server-side), `rooms`/`room_members` model group
chats, and bot-sourced `agent_schedules` rows (`source: 'bots'`) give them
recurring work. Bot chat turns run inside the box (C4), so the control
plane sees receipts and roster metadata, not turn content. Delegation to a
bot from an untrusted sender is decision-gated like every other
side-effect.

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
(`infra/template/setup.sh`) so every new user's box gets it — but the
template carries no credential. Provisioning mints a per-user child key
(scoped to `write:sandboxes`/`delete:sandboxes`) with a server-side
Daytona manager key and writes it into the box's `~/.hermes/.env`
(`lib/provisioning/daytona.ts`); deletion revokes it. When the manager
key is not configured, no key is injected and the sandbox lane stays
disabled.

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

- `GET /api/admin/ops` — start-rate, line health, spend overview, plus the
  V8 wave counters: schedule fires, fill-ticket mints/redemptions,
  per-user social actions/day, bot counts.
- Cron sweeper (`/api/cron/sweep`) stops idle boxes past `stop_after`,
  fires due `agent_schedules`, and advances the content pipeline.
- Structured logs carry `user_id`/`box_id` on every box-touching line and
  never include message content.

### Thresholds (V8)

| Metric | Budget | Alarm |
| --- | --- | --- |
| Box starts (platform) | 600/hr, 1,500/day | 70% of either ceiling |
| Schedule fires + keep-awake wakes | 1/3 of the 1,500/day start budget (500/day) | 70% of the share (350/day) |
| Social actions per user | sum of that user's `automation_rules.daily_cap` (default 25/rule) | 70% of the summed cap |
| Line volume | 5,000 messages/day/line | 70% |
| Line dormancy | ~2-month carrier deactivation | 50 days idle |
| Fill tickets | no hard cap — single-use, ≤10 min TTL each | reported for anomaly review (mints ≫ redemptions means approvals are not converting) |
| Bot runs | no separate cap — bot schedule fires count inside the schedule share | roster + fires reported |

Rationale for the schedule share: the V3 sweeper and V8 keep-awake are the
only polling-shaped box-start consumers; capping their slice at a third of
the daily ceiling pages ops on schedule growth long before message-driven
wakes are starved. The two counters are disjoint by construction: cron
fires come from `agent_runs` receipts (`trigger='cron'`), keep-awake fires
from the dedicated `'keepawake'` receipts the sweeper's keep-awake branch
writes to `box_state_events` — not from `'ready'` rows, which every wake
(message, chat, cron, upload) records.
