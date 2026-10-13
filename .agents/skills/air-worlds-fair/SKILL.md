---
name: air-worlds-fair
description: Router for Air's Crypto World's Fair work (Solana, Tempo, Hyperliquid, Zcash, company formation). Use when adding a chain venue or pay rail to Air, extending /trade or /pay, building the /formation or /zec surfaces, or writing the air.wzrd.tech/docs track pages. Points at the right installed sponsor skill and the Air seams that must be reused.
---

# Air × Crypto World's Fair

Program of record: `docs/worlds-fair/README.md` (analysis) and
`docs/worlds-fair/spec.md` (the executable spec). Public docs pages:
`docs/site/*.md`. Read those before touching code; where they and
`ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins.

## The seams you extend (never bypass)

| Seam | File | Rule |
|---|---|---|
| Trading venue | `apps/web/lib/trade/venue.ts` (`TradeVenue`), `service.ts` (`venueFor`) | A chain is a venue. Preview → `trade_order` decision → resolver submits. Spot only (T4). |
| Pay rail | `apps/web/lib/commerce/paymentRequests.ts`, `apps/web/lib/wallet/send.ts` | A chain is a `currency` row. Approval executes server-side once; `WalletSubmitUnknownError` is terminal (C23). |
| Pay gate (402) | `apps/web/lib/payments/x402.ts`, `apps/web/lib/miniapps/gates.ts` | Settle with the facilitator before any body exists (MA5); receipt first-insert-wins (MA9); payTo = publisher's verified address (MA6). |
| Box documents | `apps/web/lib/miniapps/store.ts`, `stateLease.ts` | User content lives in the Box under `.hermes/miniapps/<app>/` (C4). |
| Mini-app module | `apps/web/lib/miniapps/apps/types.ts`, `index.ts`, migration row in `mini_apps` | Server HTML, owner gate inside the module, no client storage (C17). |
| Decisions | `apps/web/app/api/decisions/route.ts`, `apps/web/lib/approvals/hosted.ts` | New money kinds are arms of the same switch; side effects only in the resolver under the conditional `pending` flip. |
| Box skills | `infra/template/skills/<name>/SKILL.md` | The agent calls `${OPENAI_BASE_URL%/api/gateway/v1}/api/...` with its gateway token; it never holds a venue key. |

## Which installed skill to load

| Track / topic | Skill (already in `.agents/skills`) | Install line (pinned in `skills-lock.json`) |
|---|---|---|
| Colosseum resource corpus, sponsor offers | `colosseum-resources` | `npx skills add ColosseumOrg/colosseum-resources` |
| Solana programs, Kit clients, testing | `solana-dev` | `npx skills add solana-foundation/solana-dev-skill` |
| Solana x402 / MPP buyer CLI (PAY.SH) | `pay` | `npx skills add solana-foundation/pay` |
| Coinbase agentic wallets (SOL/USDC, EVM) | `agentic-wallet` | `npx skills add coinbase/agentic-wallet-skills` |
| Meteora DBC launches | `meteora` | `npx skills add MeteoraAg/meteora-invent` |
| Arcium confidential compute | `arcium` | `npx skills add arcium-hq/agent-skills` |
| Solana Mobile / Seeker | `solana-mobile`, `solana-mobile-wallet`, … | `npx skills add solana-mobile/solana-mobile-skills` |
| Tempo (TIP-20, MPP, SDK, node) | `tempo` | `npx skills add https://github.com/tempoxyz/agent-skills --skill tempo` |
| Hyperliquid trading / payments / Rust SDK | `hyperliquid-trading`, `hyperliquid-payments`, `hyperliquid-rust-sdk` | `npx skills add infinitefield/hypersdk` |
| Zcash shielded wallet in the Box | `zcash` (this repo, `.agents/skills/zcash`) | — |

Repos with no skill but worth reading: `nktkas/hyperliquid` (TypeScript SDK the
Hyperliquid venue uses), `solana-foundation/create-solana-dapp`,
`zcash/zcash-devtool` (`doc/walkthrough.md`), `MeteoraAg/dynamic-bonding-curve-sdk`,
`coinbase/x402`, `base/docs`, `tempoxyz/docs`.

## Non-negotiables (from `spec.md §2`, cite as `spec.md §WF<n>`; sessions are W0–W6 and never share the prefix)

- WF1 Stage → approve → resolver, for every chain. No Box-callable route mutates a venue or chain; the only code that signs runs inside the decision resolver after the conditional `pending` flip. Zcash's Box-side `exec` is bounded by a control-plane wrap secret plus a single-use nonce (2-of-2).
- WF2 Testnet first; mainnet is a flag (`HL_LIVE_ENABLED`, `TEMPO_LIVE_ENABLED`, `SOLANA_LIVE_ENABLED`, `ZCASH_LIVE_ENABLED`, all default false). The approval card always names the network.
- WF3 Connected credentials are sealed in the control plane (`trade_connections.secret_sealed`, `user_chain_keys.secret_sealed`); write-only forms, last-4 hint, rotate = re-enter. Keys that are the user's alone (the Zcash identity) never leave the Box. A raw Tempo signer is testnet-only by construction.
- WF4 Every 402 settlement is receipted before access (`x402_receipts` first-insert-wins on `jti`, then the paid session); every agent-paid charge is a `machine_payment` decision, pending_approval only, and receipted.
- WF5 One pending money approval per user per lane: `trade_orders_pending_idx`; `wallet_transfers_pending_rail_idx` for non-base chain sends; `machine_payments_pending_idx`; `zcash_sends_pending_idx`. A second request is a 409 naming the pending one.
- WF6 Exact, bound, expiring previews everywhere: trade preview tokens; server-written rows with `expires_at` whose `decision.ref` is the row id; the resolver re-reads and re-validates before submit.
- WF7 Caps are the owner's, server-side, per rail (`pay_caps`, `lib/pay/caps.ts`); raising a cap is a `trade_settings` decision with `payload.lane`. Standing machine-payment budgets are out of this program.
- WF8 Not from an unattended run: `lib/auth/origin.ts requireInteractiveRun` (fail-closed heuristic over `agent_runs`) on every propose route; crons only read, reconcile, expire, notify.
- WF9 Not advice, not certain: "estimated", never "will"/"guaranteed"; receipts say "uncertain" for `submit_unknown`; formation copy never says "legal advice".

## Program conventions you must follow

- Commit subjects `R-WF-0<n>: …` (the `commit-ids` CI job rejects anything else on a PR).
- Every new env var is an `OPTIONAL_ENV` row + lazy `env.<name>()` accessor in `apps/web/lib/env.ts`; modules never read `process.env`.
- Pins: `viem@2.57.4` as a direct `apps/web` dependency (W0), `@nktkas/hyperliquid@0.33.3` (W1), `mppx@0.13.3` (W2), `@solana/kit` 5.5.x + kit-^5 program packages, no `@solana/pay` (W3).
- Every chain send rides `createTransferRequest` → `run_approval` → `executeTransfer` via `PayRail.submitSend`; there is no `resolvePayment`.
- `/pay` canonical forms: `/pay <amt> <ASSET> to <addr|@user> on <rail> [memo <text>]`, `/pay request <amt> <ASSET> on <rail> [memo <text>]`, `/pay <rail> balance`, `/pay <rail> address`, `/pay help`; anything else goes to the agent; `/zec …` is sugar for `/pay … zcash`.
- Docs pages carry a visible `Status:` line under the H1; unshipped rows live under "What we document but do not ship yet".
- The verified review and its ranked changes: `docs/worlds-fair/recommendations.md`.
