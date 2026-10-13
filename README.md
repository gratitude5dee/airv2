# Air

**Your personal guardian: a private AI agent with its own phone number, inbox, computer, and wallet, tied to exactly one person.**

Air lives in your iMessage. You text it like a trusted assistant, and it does the work: it triages and drafts your email, manages your calendar, drives a browser on its own cloud computer, makes images and video, runs your storefront, and moves money. Instead of walls of text, it answers with **interactive just-in-time UI and mini-apps**: a payment card, a trading tape, an approval, or a full app appears in the conversation exactly when you need it, and gets out of the way when you don't.

Air is built for **creators and entrepreneurs, from 18 to 70**, who are growing their creative work and managing their cash flow without a team: the musician getting paid after a show, the designer invoicing an overseas client, the first-time founder turning a side project into a company.

Status: private beta.

## Why a personal guardian

An agent that can read your email and spend your money is only useful if it can never be turned against you. Air's protections live in the architecture, not in a prompt:

- **One person, one agent, one computer.** Every user's agent runs on its own isolated computer (a Box). No agent state ever touches another user's storage.
- **Your content stays yours.** The shared database holds routing (phone numbers, box ids), never your messages, memory, or documents. Every account is designed to be exported or deleted with one query and one snapshot.
- **Nothing moves without your tap.** The agent can prepare a payment, trade, purchase, or publish, but only an exact, expiring preview that you approve ever executes. Caps are yours, one approval is pending at a time, and a payment the network did not confirm is never retried.
- **Keys stay out of reach.** Exchange and provider keys you connect are sealed in the control plane and never reach the agent, its computer, or your browser. The agent's email key can only draft, and vault secrets are never shown on reduced-trust surfaces.
- **Everything it reads is untrusted.** Email, messages, web pages, and calendar invites are treated as attacker-controlled input, backed by a prompt-injection red-team suite.
- **The agent dials out; nothing dials in** except Air's authenticated control plane.

## What it does

| You say | Air does |
|---|---|
| "Draft a reply to the brand deal email and hold Thursday afternoon" | Drafts the reply for your approval and proposes the calendar hold |
| `/imagine three cover options for the new single` | Generates the images in its creative studio |
| "Turn the tour poster into a $25 listing" | Stages a storefront listing you approve; buyers pay through Stripe Connect |
| "Order 20 blank tees in size M, cheapest option" | Shops in its own browser and stops before checkout so you place the order |
| `/trade buy $50 of BTC` | Previews the exact order, waits for your Approve, then fills it (paper mode with $10,000 simulated until you connect Coinbase) |
| `/inbox`, `/calendar`, `/vault`, `/shop`, `/pay`, `/trade` | Opens the matching mini-app right in the thread |

Approvals arrive as an iMessage card, in the **Needs you** panel at `app.wzrd.tech/home`, or as a short-lived approval link. Mini-apps run on their own origin at `mini.wzrd.tech`, including an app store where creators publish apps and can charge per open with x402, paid straight to their own wallet.

## Crypto World's Fair: one approval card, many chains

Every chain is one more rail behind the same approval card. Everything new runs testnet-first.

| Chain | What it does for a creator or founder | Status |
|---|---|---|
| **Base** | Every user has a wallet on Base. The agent stages USDC payments, and creators paywall mini-apps for fans with x402, settled to their own wallet. | Live |
| **Tempo** | Get paid in stablecoins with the invoice number in the transfer memo and fees sponsored, so there is no gas token to manage. Mini-apps can charge AI agents per request with MPP machine payments. | Next ([page](docs/site/tempo.md)) |
| **Solana** | Show a Solana Pay QR at a gig or merch table; Air marks the sale paid when the transfer confirms. Mini-apps add a Solana x402 option. | Next ([page](docs/site/solana.md)) |
| **Hyperliquid** | Spot trading in `/trade` through an API wallet that can trade but never withdraw. Every order is previewed, capped, and approved by you. Air never gives advice. | Next ([page](docs/site/hyperliquid.md)) |
| **Zcash** | A shielded wallet on your own Box keeps income and savings private. The agent can propose a send; only your approval releases it. | Next ([page](docs/site/zcash.md)) |
| **Company formation** | `/formation` takes you from "LLC or C-Corp?" to a US company and bank account through Stablecorp, stops so you pay at checkout, and reminds you before the 83(b) deadline. | Next ([page](docs/site/formation.md)) |

"Next" means fully specified and testnet-first, not yet merged. The plan of record:

- [`docs/worlds-fair/README.md`](docs/worlds-fair/README.md): why each track, and the options we rejected
- [`docs/worlds-fair/spec.md`](docs/worlds-fair/spec.md): the executable spec (sessions W0 to W6, migrations, acceptance tests)
- [`docs/worlds-fair/recommendations.md`](docs/worlds-fair/recommendations.md): the verified review behind the spec
- [`docs/site/`](docs/site/index.md): public pages for `air.wzrd.tech/docs`, each with a visible status line

## How it works

One user = one Hermes agent inside one Box, orchestrated by a Next.js control plane on Vercel and one shared Supabase (routing only, never content).

| Plane | What it is |
|---|---|
| Channels | iMessage via Photon Spectrum, email via AgentMail, and web chat, as parallel clients over one session per user |
| Control plane | Next.js on Vercel: routing, trust tiers, approvals, the inference gateway, the mini-app loader and gates |
| The Box | The agent's own Linux computer: Hermes, browser, vault, files, and skills |
| Shared state | Supabase for routing and ledgers only |
| Identity and money | thirdweb wallets on Base, Stripe Connect, x402 via the Coinbase Developer Platform facilitator, connectors via Composio |

## Docs

- **Start here:** [`docs/platform.md`](docs/platform.md): how the deployed system fits together (lifecycle, channels, gateway, Daytona sandboxes, security).
- **Specification of record:** [`goal.md`](goal.md) (executable milestone plan) and [`ARCHITECTURE.md`](ARCHITECTURE.md) (reasoning; tie-breaker where they disagree). Security posture decisions live in [`SECURITY-DECISIONS.md`](SECURITY-DECISIONS.md).
- **Commerce:** [`docs/commerce-zaps.md`](docs/commerce-zaps.md): how a Zap stages a storefront listing that the owner approves and a buyer pays for through Stripe Connect.
- **Trade:** [`docs/trade/plan.md`](docs/trade/plan.md) (the approval-gated trading rails, T1 to T9) and [`docs/trade/tape.md`](docs/trade/tape.md) (the one-screen surface).
- **Create:** [`docs/goal-create-v11.md`](docs/goal-create-v11.md) (lanes, Build Service, Kit, Functions) and [`docs/goal-create-v12.md`](docs/goal-create-v12.md) (the `/create` conversation, from intake to production on `mini.wzrd.tech`). The operator-side plan lives in `gratitude5dee/admin` → `goal.md`.
- **Crypto World's Fair:** [`docs/worlds-fair/`](docs/worlds-fair/README.md).

## Layout

```
apps/web/                      Next.js (App Router): the control plane + UI
  app/home/                    the dashboard: Chat, Needs you, History, People,
                               Skills, Wallet, Computer (Screen/Browser), Connectors,
                               Calendar, Vault, Bots, Ads
  app/mini/[app]/              mini-apps (single-use token exchange)
  app/api/inbound/email        AgentMail webhook (Svix-verified)
  app/api/inbound/imessage     Spectrum webhook (HMAC-verified)
  app/api/inbound/calcom       cal.com webhook (per-account sealed secret)
  app/api/gateway/v1/[...path] OpenAI-compatible inference gateway
  app/api/box/[...path]        allowlisted Hermes dashboard proxy (exact paths, C5)
  lib/box/                     Box SDK wrapper: fork, resume, stop, command, files
  lib/hermes/                  api_server client: runs, sessions, approvals
  lib/routing/                 address → user → box → trust tier
  lib/entitlements/            plan, speed tier, spend caps (tier → model mapping)
  lib/provisioning/            user/box/email/connector provisioning
  lib/miniapps/                mini-app registry, loader, gates, cards, box state
  lib/trade/                   /trade: venues (Coinbase, paper), previews, tape
  lib/wallet/, lib/payments/   Base wallet sends, x402 gate, Stripe
  lib/vault/                   vault metadata mirror, fill tickets, log scrubber (C18)
  lib/calendar/                calendar spine: sources, schedules, sweeper, ICS
  lib/bots/                    bot roster, rooms, per-profile provisioning (V7)
  lib/security/                C18 sweep harness + injection red-team suite (V8)
supabase/migrations/           versioned, forward-only SQL; single apply path
                               is scripts/apply-migrations.sh. ci.yml shadow-
                               applies it to scratch Postgres on every PR, and
                               the deploy-migrations job applies it to prod
                               behind the production environment approval
infra/template/                everything baked into the Box template (M0):
                               Hermes + systemd units, dashboard SPA, base skills,
                               browser runtime, Daytona CLI + MCP, C24 platform gen
.agents/skills/                developer agent skills, pinned in skills-lock.json
                               (Colosseum, Solana, Tempo, Hyperliquid, Zcash, …)
scripts/                       operator runbooks (C18 production sweep)
docs/                          platform guide, plans, specs, public docs pages
```

## Channels

iMessage (Photon Spectrum) and web chat are parallel clients over one shared
Hermes session per user; email (AgentMail) is thread-scoped. The agent's
computer is its Box; Daytona MCP tools give it ephemeral throwaway sandboxes
on top. Details in [`docs/platform.md`](docs/platform.md).

## Conventions

- TypeScript strict; no `any` in `lib/`.
- All Box and Hermes calls go through `lib/box/` and `lib/hermes/`.
- Every money action is a decision the owner resolves; side effects run only in the decision resolver.
- Inbound webhooks carry replay/dedupe tests (`inbound/imessage`, `inbound/calcom`, `inbound/email`); a new webhook handler ships an idempotency test in the same PR.
- Structured logs carry `user_id` and `box_id` on every line touching a box.
- Migrations are forward-only and numbered; never edit an applied migration.
- Commit subjects name a finding id (`R-XXX-01: …`) or start with `chore:`; the `commit-ids` CI job enforces it.

## Commands

```bash
npm install
npm run dev         # Next.js dev server (apps/web)
npm run typecheck
npm run lint
npm run test
```

Environment variables are listed in goal.md §5 and declared in `apps/web/lib/env.ts`: all server-side, none `NEXT_PUBLIC_`.
