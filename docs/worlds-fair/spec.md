# spec.md — Air × Crypto World's Fair (executable spec for Devin SWE-2 Max)

Read `ARCHITECTURE.md`, `docs/goal-miniapps-v9.md`, `docs/trade/plan.md`, and
`docs/worlds-fair/README.md` (the analysis — it says *why*; this file says *what*)
before starting. Where this file and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md`
wins and this file is the bug. Cross-cutting constraints keep their existing numbers
(I*, C*, MA*, T*); new invariants here are **WF1–WF9** and are cited from code comments
as `spec.md §WF3` (sessions are W0–W6 and never share the prefix).

Sessions are independent after **W0** and are meant to run in parallel (one Devin
session each). Every session ends with `npm run typecheck && npm run lint &&
npm test -- --run` green in `apps/web`, the migration shadow-applied by `ci.yml`, and
the acceptance tests in §12 for that session passing. Commit messages name the
session; commit subjects are `R-WF-0<n>: …` (§4.4 — the `commit-ids` CI job rejects
`W1: …`).

---

## 0. The outcome

A user texts (or types in `/home`):

```
/trade connect hyperliquid                 → Settings → enter the master address, paste an API-wallet private key (testnet) → ● hyperliquid · testnet
/trade buy $50 of HYPE                     → preview card (HYPE-USDC, IOC at preview px, fee, builder fee, expiry) → Approve → filled receipt
/pay 25 USD to 0x… on tempo memo INV-7     → preview (OUSD, memo, sponsored fee) → Approve → transferWithMemo → explorer link
/pay request 25 USD on tempo memo INV-7    → request card; the finalized TransferWithMemo log flips it to paid, owner texted
/pay request 12 USDC on solana             → hand-built Solana Pay URI + QR with a reference; balance delta at the reference → paid
/pay 12 USDC to <addr> on solana           → preview → Approve → USDC TransferChecked (v0) signed by the user's CDP send account (W3b)
/zec address                               → fresh Unified Address (utest1… on testnet) + ZIP-321 QR from the Box wallet
/zec send 0.1 to utest1… memo rent         → preview → Approve → the Box runs `air-zec exec` with a single-use nonce → txid
/formation                                 → Packet (decide → intake) → Submit → Approve → Stablecorp checkout behind the checkout handoff (the owner pays) → Status tiles → 83(b) on the calendar
```

The `/pay` lines are deterministic canonical forms parsed by `lib/pay/parse.ts` (§4.3) with
no model turn and no Box wake: `/pay <amt> <ASSET> to <addr|@user> on <rail> [memo <text>]`,
`/pay request <amt> <ASSET> on <rail> [memo <text>]`, `/pay <rail> balance`,
`/pay <rail> address`, `/pay help`. Any other `/pay …` text goes to the agent (never an
error); a bare `/pay` is the card. `/zec …` is sugar for `/pay … zcash` (same `PayCommand`,
`rail:'zcash'`, no second parser). `/pay policy …` and standing budgets are **not in the
window** (§15). `/trade connect [coinbase|hyperliquid]` keeps its venue tail.

Mini-apps that charge (`x402_enabled`) answer `402` with an x402 **v1** `accepts` payload
(Base today; a Solana devnet entry after W3b) **and** an **MPP** `WWW-Authenticate: Payment`
challenge (Tempo, W2b) — each entry present only when the publisher has the matching address
(MA6). The agent, meeting a `402` elsewhere, files a `machine_payment` decision; every
charge lands `pending_approval` and executes only in `resolveMachinePayment` (no standing
`pay_policy` auto-pay in this program), and every settled charge is receipted.

**Every mutation of money is a decision the owner resolves.** Reads are free. The agent
stages; the resolver executes; an uncertain submit is terminal (`wallet_transfers.status =
'submit_unknown'`, surfaced as "uncertain"; `trade_orders.state = 'uncertain'`, C23).

What ships by the deadline is §13's slice: W0 → {W1a, W2a} (+ W3a, W5a if a session is
free) → W6 → W2b if time; every docs page carries a visible `Status:` line under its H1
(§10) and unshipped rows sit under "What we document but do not ship yet".

### 0.1 Golden paths (acceptance narratives)

1. **Hyperliquid, paper → testnet (W1a → W1b).** `/trade` with no connection: paper mode
   prices `HYPE-USDC` from HL mainnet `allMids` through the `PublicPrices` seam
   (`lib/trade/prices.ts`, `-USDC` → HL). `/trade buy $50 of HYPE` previews, approves,
   fills on paper. Settings → Connect: enter the master address and paste the private key
   of an API wallet created on Hyperliquid's API page (testnet first); Air seals it,
   verifies it with `userRole`/`extraAgents`, shows the last 4 of the agent address.
   With `TRADE_LIVE_ENABLED=true, HL_LIVE_ENABLED=false`: `/trade live`; the same command
   submits one IOC order (`expiresAfter` = preview expiry) whose cloid derives from the
   preview; a venue rejection comes back as `order_rejected` on the card, never as
   "uncertain"; `/trade orders` shows it from `frontendOpenOrders`/`orderStatus`. The §12
   testnet gate is one $10 IOC buy of whichever USDC spot pair testnet `spotMeta` lists
   (`HYPE-USDC` if present, else `PURR-USDC`) — never hardcode the pair or its index.
2. **Tempo, Moderato (W2a).** `/pay tempo balance` shows OUSD after `client.faucet.fundSync`.
   `/pay 1 USD to 0x… on tempo memo INV-1` → `run_approval` card → `executeTransfer` →
   `tempoRail.submitSend` → `transferWithMemo` via `transferSync({ feePayer: true })`
   through `sponsor.moderato.tempo.xyz` → `✓ Sent 1 OUSD on Tempo Moderato ·
   explore.testnet.tempo.xyz/tx/<hash>`; a receipt whose `Transfer` log never reaches the
   recipient (TIP-403) is `redirected`. `/pay request 1 USD on tempo memo INV-2` → request
   card (the owner-entered `users.tempo_address` + memo + amount printed as text, plus
   QR) → the pay-rails `tick()` sees the finalized `TransferWithMemo` log and marks it
   paid; the owner is texted by `deliverPayEvent`.
3. **MPP + x402 gate (W2b, W3b).** Open Air's own priced mini-app on Moderato with
   `npx mppx <url>` (or the `mppx/client` snippet with `testnet: true`) → the
   `Authorization: Payment` branch (present only when `users.tempo_address` is set)
   settles, the receipt is inserted **before** the session, `x402_receipts` row has
   `protocol='mpp', network='tempo-moderato'`. Open it with an x402 v1 client on Solana
   devnet (`scripts/x402-solana-pay.ts`, `@x402/fetch` + `@x402/svm`) → the `X-PAYMENT`
   branch → `protocol='x402', network='solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'`
   (registry CAIP-2, whatever the v1 wire string says). The Base path and `x402.test.ts`
   are untouched.
4. **Solana Pay (W3a, no CDP).** The owner pastes their own wallet into the Pay card's
   settings (`users.solana_address`). `/pay request 1 USDC on solana` → hand-built
   `solana:` URI + QR with a fresh reference; pay from Phantom on devnet → `tick()` finds
   the signature by reference, checks the recipient's USDC token-balance delta ≥ amount
   (robust to Phantom's guard ix) → `paid` within one cron tick, `tx_ref` = signature.
5. **Zcash testnet (W5a, W5b).** `/zec address` → `utest1…` and a `zcash:` ZIP-321 URI QR.
   Fund it with testnet ZEC (owner pre-seed, §17 — no verified public faucet); `/zec
   balance` shows the shielded balance once the sync timer has caught up; `/zec send 0.01 to
   utest1… memo rent` → approve → `resolveZcashSend` mints a single-use nonce → the Box runs
   `air-zec exec --send <id> --nonce <n>` → txid in chat. Binary-backed beats ship only if
   `air-zec` is baked (W5b); otherwise their rows are documented as "not yet".
6. **Formation (W4, last).** `/formation` → Packet (entity question inline → intake
   checklist) → Submit → `formation_submit` decision → Approve → `resolveFormationSubmit`
   CAS `ready → submitted` and starts a run that opens Stablecorp checkout and files a
   checkout handoff (`POST /api/checkout/handoff` → Checkout card); the owner pays on the
   provider page, the agent never enters a card → Status tiles (Filed → EIN → Bank → Ready)
   → the 83(b) deadline exists on the calendar (`upsertLocalEvent`) with `agent_schedules`
   reminders at 21/7/2 days.

---

## 1. Existing substrate — audit before you write code

Do not rebuild any of this. Extend it.

| Subsystem | Where | What we reuse |
|---|---|---|
| Venue seam | `apps/web/lib/trade/venue.ts` (`TradeVenue`, `TradeVenueError`, `assertTradableSpotProduct`), `service.ts` (`tradeMode`, `venueFor`, `previewTrade`, `proposeTrade`, `resolveTradeOrder`, `resolveTradeCancel`, `reconcileTradeOrders`, `expireTradeApprovals`), `coinbase.ts` (`getTradeConnection` — `.eq(user_id).maybeSingle()`, errors to null; `tradeVenueCredentials`) | **W1** adds `hyperliquidVenue` behind the same interface. `service.ts` does learn a venue: today `venueFor` returns `coinbaseVenue` unconditionally for live and `provider:'coinbase'` is literal in `connectCoinbase`/`disconnectCoinbase`/`setTradeMode`/`updateTradeCaps`/`resolveTradeSettings`. W0/W1: `getTradeConnection` selects the `active = true` row and surfaces errors; `venueFor` switches on `connection.provider`; the five sites take the active row's provider; `previewTrade` stamps `trade_orders.venue`; `resolveTradeOrder`/`resolveTradeCancel`/`reconcileTradeOrders` pick the venue from the row's `venue` (409 `venue_changed` if it differs from the active provider); `createOrder(order, clientOrderId, preview?)` receives the stored preview. |
| Public prices | `coinbase.ts` `coinbasePublicProduct/Products/Price/Candles/ChangePct` (219-295), consumed directly by `paper.ts`, `tape.ts` (`tapeMarkets`, `tapeIntent` — `-USD` only today), `watch.ts` (`addWatch`), `portfolioView` | **W0** adds `lib/trade/prices.ts` (`PublicPrices`: `price/changePct/candles/product/products`, `coinbasePublicPrices`, `publicPricesFor`); **W1a** adds `hyperliquidPublicPrices(network)` on `allMids` + `spotMetaAndAssetCtxs` + `candleSnapshot`. Paper/tape/watch/portfolio resolve products and prices only through the seam. |
| Order canonical form | `lib/trade/order.ts` (`tradeOrderSchema`, product regex `^[A-Z0-9]{1,20}-[A-Z0-9]{1,20}$`, `createPreviewToken`/`verifyPreviewToken`, `PREVIEW_TOKEN_TTL_MS` 5 min, `clientOrderIdForPreview` → uuid) | HL spot pairs map to `HYPE-USDC` (`spotMeta` resolves `HYPE/USDC` → `@n`); the uuid becomes the 16-byte HL `cloid` (`0x` + 32 hex) and is stored as `venue_order_id`. |
| Trade tables | `supabase/migrations/0109_trade_miniapp.sql` (`trade_connections` pk `(user_id, provider)`, `provider` check `'coinbase'`, `secret_sealed`; `trade_orders` with `client_order_id`, `preview`, state machine incl. terminal `uncertain`, `trade_orders_pending_idx` one-pending index) | **W0** (0141) widens `provider`, adds `trade_orders.venue` (backfilled `paper`/`coinbase`, then `not null`, no default) + `venue_meta`, `trade_connections.active` (backfilled `true`, unique partial index). |
| Trade surfaces | `lib/miniapps/apps/trade.tsx` (six tabs: `tape` + the five documented), `lib/trade/tape.ts`, `lib/trade/parse.ts` (`parseTradeCommand`, `TRADE_HELP_LINES`), `lib/trade/imessage.ts` (`deliverTradeApproval`, `runTradeCommand`), `app/api/trade/route.ts`, `app/api/cron/trade` (`requireCron`), `infra/template/skills/trade/SKILL.md` | Unchanged shape. `/trade connect [coinbase|hyperliquid]` lands in `parse.ts` as `{ kind:'mode', mode:'connect', venue? }` (today the tail is dropped); Settings gets a venue picker + paste-the-API-key connect form (W1b); chips/copy name the provider (`hyperliquid · testnet`, `paper · HL prices`). |
| Pay rail | `lib/commerce/paymentRequests.ts` (`createPaymentRequest`, `currency in ('usd','usdc')` → Stripe Checkout / `createTransferRequest`; `approvePaymentRequest`), `lib/wallet/send.ts` (`createTransferRequest` → one `wallet_transfers` row + one `run_approval` decision; `findPendingTransfer` → `executeTransfer` with the CAS `pending → submitting`, `transferIdempotencyKey`, `markSubmitUnknown` + `WalletSubmitUnknownError`, terminal `submit_unknown`), `lib/wallet/read.ts`, `lib/wallet/qr.ts` (`addressQrDataUrl` — encodes any string), `lib/miniapps/apps/pay.tsx` | **W0** adds `lib/pay/rails/index.ts` (`PayRail`, `baseRail` wrapping `sendWalletTokens`, `railFor`) and splits `executeTransfer` after its CAS into `rail.prepare` / `rail.submitSend`; **W2/W3/W5** add `lib/pay/rails/{tempo,solana,zcash}.ts`. A chain **send** is a `wallet_transfers` row + `run_approval` decision resolved by the existing arm — no `payment_requests` row, no `resolvePayment` (it does not exist and is not created). `payment_requests` is the **receive** lane plus Stripe/legacy-USDC payees; 0141 widens `currency` to `('usd','usdc','ousd','zec')` and adds `rail`/`direction`/receive columns. Readers go in `lib/chains/<rail>/read.ts`, called from `lib/wallet/read.ts`. |
| 402 gate | `lib/payments/x402.ts` (`buildPaymentRequirements`, `publisherPayTo`, facilitator = `@coinbase/x402 createFacilitatorConfig` whenever `CDP_API_KEY_ID/SECRET` are set, else `env.x402FacilitatorUrl()`; `x402_receipts` first-insert-wins on `jti`; `x402PaymentGate`; pay page), `lib/miniapps/gates.ts` (visibility → password → x402 → session; its contract is not edited) | **W2b** adds the MPP branch as one call site in `x402.ts` keyed on `Authorization: Payment` (→ `lib/payments/mpp.ts`) vs `X-PAYMENT` (today's path). **W3b** adds Solana as a second **v1** `accepts` entry (`buildSolanaPaymentRequirements`, `payload.network` branch, SVM `jti` = transaction signature) with the installed `x402@1.2.0` — no v2 library swap. W3b also makes the facilitator a pure function of the entry's chain (Base mainnet → CDP; Base Sepolia / solana-devnet → `env.x402FacilitatorUrl()`) with a test that no mainnet entry resolves to `x402.org`. Receipts stay one table (+ `protocol`, `network` = registry CAIP-2). `publisherPayTo` returns `{ base, solana, tempo }` each-or-null; the Base entry never depends on the new columns. |
| Decisions | `decisions` (`0005`; `payload` from `0014`; latest kind list in `0125_otp_requests.sql`; status list incl. `relay_failed` in `0133`), `lib/decisions/resolve.ts` (`resolveDecision` — the resolver if-chain; an unmatched kind falls through to the final conditional `status='pending'` flip and is marked approved **without executing**), `lib/approvals/hosted.ts` (`HOSTED_KINDS`, `loadHostedApproval`, `resolveHostedDecision` — the hosted-link twin; the kind gate is repeated at `app/api/approvals/[id]/route.ts`), `app/api/decisions/route.ts` (thin, validates nothing), `app/approve/[id]/approve-client.tsx` (kind union, line 18), `lib/approvals/token.ts` (`APPROVAL_LINK_TTL_MINUTES = 15`), `app/home/panels/needs-panel.tsx` (label maps 42-77) | New kinds `machine_payment`, `pay_policy` (dormant), `zcash_send`, `formation_submit` land in 0141's `decisions_kind_check` (copied verbatim from 0125 + four). Every kind lands in `resolve.ts` **and** `hosted.ts` (`HOSTED_KINDS` + view + arm) **and** the approve-client union in the same PR as its session, with a test that it resolves through both chains; a kind present in only one silently approves-without-executing or 404s on the link. Chain sends reuse the `run_approval` arm. One pure formatter `lib/approvals/moneyCard.ts` renders every money payload (`<amount> <token> on <network>`). |
| Box auth / commands | `lib/auth/guard.ts` (`requireBoxOrOwner`, `requireCron`, `GuardError`; principals carry no surface or run context), `lib/box/client.ts` (`command(boxId, cmd, timeoutSeconds = 60)` — provider cap 600 s; `readFile`, `writeFile`), `lib/box/shell.ts` (`shellQuote`), `lib/miniapps/store.ts` (`readAppState`/`writeAppState` lease only kanban/todo; `readAppStateFrom`/`writeAppStateTo` under `stateLease.ts withStateLease`) | Box-authenticated routes copy `app/api/trade/route.ts`. **W0** adds `lib/auth/origin.ts requireInteractiveRun` (WF8). Zcash execution uses `command(…, 300)` with a single-use nonce and `shellQuote` on every interpolated argument. |
| Sealed secrets | `lib/crypto/secretbox.ts` (`sealSecret`/`openSecret` under `env.providerVaultKey()`), `lib/providers/keys.ts` (the pattern), `trade_connections.secret_sealed` opened by `tradeVenueCredentials` (coinbase.ts:514-530) | HL agent key (`hyperliquidCredentials`, same shape; agent address in `key_id`, last-4 hint) and the Tempo signer v1 (`user_chain_keys` rail/network/kind, `raw_secp256k1` testnet-only by check) are sealed the same way; last-4 hint only (C18). The Zcash wrap secret is `user_chain_keys` `kind='wrap_secret'` — never a seed. |
| Wallets | `lib/thirdweb/client.ts` (Base, `sendWalletTokens` with idempotency key), `env.walletChainId()`/`walletUsdcAddress()`, `WALLET_CHAIN_ID=8453` | Base stays thirdweb (`baseRail`). Solana: `users.solana_address` is the owner's own wallet (pasted; receive + x402 payTo, never Air-signable — W3a); `users.solana_cdp_address` is the CDP send account (W3b, needs `CDP_WALLET_SECRET`; a pooled operator credential like `THIRDWEB_SECRET_KEY`, bounded per user by the pre-sign assertion). `users.tempo_address` is likewise owner-entered (Pay card's owner-only settings view), EIP-55 checksum-validated (`getAddress`), the Tempo receive address and the MPP recipient read at challenge time — never the sealed signer. Tempo signing = per-user sealed signer (v1, testnet) → access keys later (§15). |
| Mini-app module contract | `lib/miniapps/apps/types.ts`, `index.ts` (`FIRST_PARTY_MODULES`), registry row in `mini_apps`, `lib/miniapps/shell.ts` (`renderShell`/`shellHtml`), `promptBar.ts` (`promptBar(placeholder)`), `cardSends.ts` (`CARD_KINDS`; `lib/admin/deletion.test.ts` enforces the list), `reserved.ts` (`FIRST_PARTY_RESERVED`), `infra/template/skills/open-miniapp/SKILL.md` Kinds table | `/formation` is one module + one registry row (W4's own migration) + `CARD_KINDS`/`FIRST_PARTY_RESERVED`/Kinds-table entries. The SQL card-kind lists (`card_sends`, `miniapp_card_sessions`) are copied from `0122_muse.sql:68-78` + `formation` in 0141 (0109's list lacks freeze/checkout/watch/muse). |
| Calendar spine | `lib/calendar/*` (box `sources.json` → `events.json` / `inbox/`, `store.ts upsertLocalEvent` with stable `local:` ids, `agent_schedules` deliveries, `ics.ts` inspection helpers, `calendar_add` decision for inbox .ics), `app/api/calendar/remind/route.ts` | Formation deadlines are calendar events via `upsertLocalEvent` (idempotent) with one-shot `agent_schedules` reminders; no `calendar_add` round-trip (the owner already approved the submit). |
| Checkout handoff (purchase stop) | `lib/checkout/handoffs.ts`, `POST /api/checkout/handoff`, `checkout_handoffs` (0113), `POST /api/cards/checkout`; `lib/vault/purchase.ts` (`purchase_review`, `resolveActiveTurn`), `api/browser/purchase` | Stablecorp checkout runs behind the **checkout handoff**: the agent pre-types, hands off, the owner pays from the Checkout card. `purchase_review` is the optional vault-card fill only. `resolveActiveTurn` is the pattern WF8's `requireInteractiveRun` extracts. |
| Email inbound | `lib/mail/client.ts` (provider-neutral; AgentMail impl `lib/agentmail/client.ts`, `MAIL_PROVIDER`), `api/inbound/email` → `processInboundEmail` | Formation status from provider emails (domain allowlist in `lib/formation/providers.ts`; parsing is P2). |
| Crons | `apps/web/vercel.json` (`/api/cron/trade` every minute, `sweep`, `schedules`, …; all `requireCron`), `app/api/cron/cron.test.ts` | `/api/cron/pay-rails` (Tempo/Solana/Zcash `tick()` watchers + `expires_at` sweeps) joins at `* * * * *` with `requireCron`, a vercel.json row and a cron.test.ts block. Crons only read, reconcile, expire and notify (WF8). |
| Env manifest | `lib/env.ts` (`REQUIRED_ENV`/`OPTIONAL_ENV`, lazy accessors — pattern `tradeLiveEnabled`, env.ts:407; `x402FacilitatorUrl`, `x402Network`, `cdpApiKeyId/Secret`), `lib/env.test.ts` (fails on any undeclared `process.env` read) | Every new variable is an `OPTIONAL_ENV` row + `env.<name>()` accessor (§4.1, §14); registry and rail modules never read `process.env`. No `X402_SOLANA_NETWORK`. |
| Dependencies | root `viem` 2.39.0 is thirdweb's exact pin (no `viem/tempo`); `@solana/kit` 5.5.1 in the lockfile (cdp-sdk hard dep); `x402@1.2.0` installed (ships SVM); `@coinbase/x402` | **W0** adds `viem@2.57.4` as a direct `apps/web` dependency (`require.resolve('viem/tempo')`, `npm ls viem`); per-session pins in §4.4 (`@nktkas/hyperliquid@0.33.3`, `mppx@0.13.3`, kit-^5 program packages, `@x402/*@2.28.0`, `@coinbase/cdp-sdk@1.57.0`). No `@solana/pay` (peers kit ^6.9). |
| CI gates | `scripts/check-commit-ids.sh` (`commit-ids` job; subjects `R-WF-0<n>:`), `ci.yml` migration shadow-apply + `scripts/apply-migrations.sh` (forward-only, hash-locked), `supabase/tests/rls_all_tables.sql`, `lib/admin/deletion.test.ts`, coverage floors (42% global / 46% `lib/wallet/**`), `expectLog` | §4.4. 0141 enables RLS (no policies) on every new table and declares `on delete cascade|set null` on every `references users(id)`; nobody edits 0141 after it applies. |
| Evals | `evals/agent-suite` (`run.ts`, `lib.ts` — `CATEGORIES`, `DECISION_KINDS`, `k-case-sets.ts`, `messages.jsonl`), `evals/contract` | No trade eval fixture exists (`TRADE_EVAL_FIXTURE` is a plan.md name only). Acceptance = colocated Vitest fixtures; live-box scripted turns are a separate layer (§12). |
| Installed skills | `.agents/skills/{colosseum-resources,solana-dev,pay,agentic-wallet,meteora,arcium,tempo,hyperliquid-trading,hyperliquid-payments,hyperliquid-rust-sdk}` pinned in the root `skills-lock.json`; `.agents/skills/air-worlds-fair` and `.agents/skills/zcash` are repo-authored (not in the lock) | Read `air-worlds-fair` first; it routes Devin (the Box never receives `.agents/skills`) to the rest. Box skills live in `infra/template/skills/<name>/` (§11). |

---

## 2. Non-negotiable constraints

Constraint rows are **WF1–WF9**; code comments cite them as `spec.md §WF3`. Sessions are
W0–W6 (W1a/W1b, …) in §13 and never share the prefix. The non-negotiables in
`.agents/skills/air-worlds-fair` are regenerated from this table with these numbers.

| # | Constraint as it applies here |
|---|---|
| I1–I6, C3/C4/C5/C16/C17/C18/C23, MA1–MA11, T1–T9 | Unchanged and in force. In particular C5: outbound hosts are literal allowlists per rail (§14); no user-supplied URL is ever fetched by a resolver except the `machine_payment` target, which is pinned by the decision and fetched through the one helper that reuses `isPublicAddress`/`resolvesOnlyPublicAddresses` from `lib/kernel/purchases.ts` (https only, DNS re-validated per request, `redirect:'manual'`, Air-host denylist incl. `*.on.ascii.dev`, 10 s, ≤1 MB — §6.5; exempted by name in §14's grep test). |
| **WF1 — Stage → approve → resolver, for every chain.** | No route the Box can call mutates a venue or chain. The only code that signs a chain transaction or an exchange action runs inside the decision resolver arms (`resolveTradeOrder`; the existing `run_approval` wallet arm `findPendingTransfer` → `executeTransfer` in `lib/wallet/send.ts`, which W2/W3 extend by rail through `PayRail.submitSend`; new `resolveMachinePayment`, `resolveZcashSend`) in `lib/decisions/resolve.ts` and `lib/approvals/hosted.ts`, under an owner session or a valid approval-link token; each arm claims its own row by CAS first and the decision's conditional `status='pending'` flip runs last. `resolvePayment` does not exist and is not to be created. The Zcash exception (the Box signs) is bounded by a single-use execution nonce minted by `resolveZcashSend` and the control-plane wrap secret (2-of-2, §9). |
| **WF2 — Testnet first; mainnet is a flag.** | Defaults: Hyperliquid testnet, Tempo Moderato (42431), Solana devnet, Zcash testnet. `HL_LIVE_ENABLED`, `TEMPO_LIVE_ENABLED`, `SOLANA_LIVE_ENABLED`, `ZCASH_LIVE_ENABLED` (all default `false`) gate mainnet per rail, read through `env.<name>()` accessors from `OPTIONAL_ENV` (never `process.env`). Live on HL — testnet or mainnet — still requires `TRADE_LIVE_ENABLED=true` (+ `TRADE_ALLOWLIST` if set) because every `mode='live'` row is gated there; `HL_LIVE_ENABLED` additionally gates `network='mainnet'` on connect. For Tempo, `TEMPO_LIVE_ENABLED` is necessary but not sufficient — a `raw_secp256k1` signer never opens on mainnet (`user_chain_keys` check + `signer.ts` refusal). The approval card always names the network. Receipts read `✓ <action> on <Rail> <network> · <ref>`; `explorerLink(rail, ref)` only where the registry has a verified explorer URL (Tempo `explore[.testnet].tempo.xyz/tx/<hash>`, Base basescan, Solana), the bare ref otherwise; HL receipts show the cloid and link the master address's explorer page. |
| **WF3 — Connected credentials are sealed in the control plane.** | HL agent-wallet key (`trade_connections.secret_sealed`), Tempo signer v1 (`user_chain_keys.secret_sealed`, testnet-only), the Zcash wrap secret: sealed under `PROVIDER_VAULT_KEY`, write-only forms, last-4 hint, rotate = re-enter. CDP credentials are env (`CDP_API_KEY_ID/SECRET`, `CDP_WALLET_SECRET`) and bounded per user by the pre-sign assertion (§7.3). Never the Box, never the browser, never a log. Keys that are the user's alone (Zcash spending key, seed) never leave the Box and never transit a command result; the control plane holds no seed. |
| **WF4 — Every 402 settlement is receipted before access; every agent-paid charge is capped and receipted.** | `x402_receipts` gains `protocol`/`network`; insert first-wins on `jti` (EVM nonce, SVM signature, MPP tx hash or `sha256(credential)`); the paid session is minted after the insert; a 23505 after settlement → 402 "already redeemed", never a session. Agent-side charges land in `machine_payments` as `pending_approval` with their decision (`resolved_by='owner'`; `challenge_fingerprint` re-compared at resolve). `pay_policies` is dormant schema in this program. |
| **WF5 — One pending money approval per user per lane.** | `trade_orders` keeps `trade_orders_pending_idx`. Chain **sends**: `wallet_transfers_pending_rail_idx` on `(user_id, rail) where status in ('pending','submitting','claimed') and rail <> 'base'` plus a 409 at propose naming the pending send. `machine_payments` (0141) and `zcash_sends` (W5's own migration, never 0141) get their own one-pending partial index. `payment_requests` keeps **multiple** pending rows (receive requests stay pending until paid or 24 h expiry, as today) — no one-pending index there. Chained requests decompose; the next leg is sized from a fresh read. |
| **WF6 — Exact, bound, expiring previews everywhere.** | Trade previews keep `TRADE_PREVIEW_SIGNING_KEY` tokens. Pay/machine/zcash previews are server-written rows (`wallet_transfers` with `expires_at = now()+5 min`, `machine_payments`, `zcash_sends`) whose decision `ref` is the row id and whose `payload` is the value-free summary; the resolver re-reads the row and re-validates (balance, caps, product/recipient, expiry — `expired` past `expires_at` is refused before the CAS) before submit; the pay-rails cron sweeps `pending` past `expires_at` → `expired`. "Re-verify before submit" is T4's rule generalized. |
| **WF7 — Caps are the owner's, server-side, per rail.** | `per_order_usd_cap` / `daily_usd_cap` / velocity cap exist for trade (T6); `pay_caps` (per-send, daily, per rail; `lib/pay/caps.ts assertPayCaps` at preview and again in the resolver arm; Zcash caps are ZEC-denominated and any USD pricing fails closed) are theirs too. Raising a pay cap is a `trade_settings` decision with `payload.lane: 'pay'`; `resolveTradeSettings` dispatches on lane; lowering applies immediately as `updateTradeCaps` does (implementation outside the slice — no golden path raises a pay cap). Standing machine-payment budgets (`pay_policies`, Tempo access-key limits) are out of the window (§15). |
| **WF8 — Not from an unattended run.** | WF1/T1 is the money guarantee (nothing moves without the owner's tap). T7 is enforced only by construction today: `requireBoxOrOwner` carries no surface or run context, `/api/trade` and `lib/trade/service.ts` perform no origin check, and crons/watchers (`/api/cron/trade`, `/api/cron/pay-rails`) only read, reconcile, expire and notify and never import a `propose*`/`preview*` function (static test on the route source). W0 adds the heuristic `lib/auth/origin.ts requireInteractiveRun(supabase, principal)`: no-op for owner principals; for box principals, select the newest `agent_runs` row with `user_id`, `ended_at is null`, `hermes_run_id not null`, `started_at > now() − 15 min` (the `resolveActiveTurn` pattern in `lib/vault/purchase.ts`); require `trigger ∈ {'imessage','web','desktop','voice'}` and, for `imessage`, `sender_tier = 0`; anything else (no open row — the production case, since cron/email runs insert their row only after completion — or cron/email/mcp/app/job) throws `GuardError(403,'not_interactive')`. Called after auth in `POST /api/trade {propose,cancel}`, `POST /api/pay {preview|propose|request|machine}`, `POST /api/wallet/zcash {propose}`. It is a heuristic over `agent_runs`, not a per-run token; any auto-executing path stays off until a per-run origin token exists. |
| **WF9 — Not advice, not certain.** | T9 verbatim across rails: "estimated", never "will"/"guaranteed"; no asset ranking; receipts say "uncertain" for `submit_unknown`; formation copy never says "legal advice" and says "reminds you before", never "never miss". |

---

## 3. Non-goals (this program)

- Perpetuals, margin, leverage, or any non-spot product on any venue (T4). HL perps is
  an open decision (§15), not a hidden flag.
- Withdrawals/bridging automated by Air (HL `withdraw3`, Core↔EVM, CCTP). Documented
  as owner steps.
- Issuing tokens: Tempo TIP-20 issuance and Meteora DBC launches (the `/launch` stretch
  is specified in §16 and scheduled as **S1** in §13 only after W3 lands and only if a
  session remains; otherwise unbuilt).
- Standing budgets: `pay_policies` semantics, the `/pay policy …` grammar, the policies
  tab, the Tempo access-key signer (`authorizeSync`) and any Box-callable auto-pay
  branch. Every machine charge is one `machine_payment` card (§15 keeps the v1.1 design).
- An x402 v2 library swap. The gate keeps the v1 wire (`X-PAYMENT`) and adds MPP as a
  header-keyed branch; a v2 `PAYMENT-SIGNATURE` branch only if devnet rehearsal shows the
  facilitator rejects v1 SVM payloads.
- `@solana/pay` (unsatisfiable kit peer) — the URI and reference lookup are hand-rolled.
- Zcash seed export through the control plane (`display-mnemonic`) and Zcash mainnet
  until a Box-resident backup path exists; building `air-zec` on a Box (`cargo build` —
  it ships as a CI-built, sha256-pinned asset, W5b); TIP-1022 virtual addresses.
- Confidential transfers (Token-2022) and Arcium: documented, not built.
- Multi-user/shared wallets, pooled on-chain operator wallets (a shared signing
  credential bounded per user, as CDP's, is not this), platform fee on gates.
- Generating legal documents, a browser-driven name check, or provider-email parsing in
  `/formation` (the last two are P2).

---

## 4. W0 — Chain registry and rail widening (prerequisite, 1 session, serial)

W0 is the only serial session. It lands, in one commit (`R-WF-00: …`), everything a
later session reads: the registry (§4.1), **all of migration `0141`** (§4.2), the
env rows and `viem@2.57.4` pin (§4.1, §4.4), the rail/parser/origin/price seams and
the `executeTransfer` split (§4.3), and the repo conventions every parallel session
inherits (§4.4). After W0 merges, W1a/W2a/W3a/W5a run in parallel on fixture-green
halves (§13). Exit: `cd apps/web && npm run typecheck && npm run lint && npm test --
--run && npm run build && npx vitest run --coverage` green, `0141` shadow-applied by
`ci.yml` with `supabase/tests/rls_all_tables.sql` and `lib/admin/deletion.test.ts`
passing, `npm ls viem` clean.

### 4.1 `apps/web/lib/chains/registry.ts`

```ts
export type RailId = "base" | "solana" | "tempo" | "hyperliquid" | "zcash";
export type Network = "mainnet" | "testnet";
export interface ChainSpec {
  rail: RailId;
  kind: "evm" | "solana" | "hypercore" | "zcash";
  name: string;                 // "Tempo", "Solana", …
  network: Network;
  chainId?: number;             // evm only (8453/84532, 4217/42431, 999/998)
  caip2?: string;               // "eip155:4217", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
  rpc: string; ws?: string;
  explorerTx?: (ref: string) => string;   // only where the table below marks the URL verified (solana: set by W3a, see its row)
  stable: { symbol: string; address: string | null; decimals: number };   // USDC / OUSD / ZEC (native → null)
  liveEnabled: () => boolean;   // env accessor per rail (WF2): env.hlLiveEnabled() … — never process.env
  hosts: readonly string[];     // C5 literal allowlist for this rail (asserted by the §14 fetch-target test)
}
export function chainFor(rail: RailId, network?: Network): ChainSpec;  // testnet unless liveEnabled(); explicit network wins
export function explorerLink(rail: RailId, ref: string): string | null;  // null → callers print the bare ref
```

Values (cross-check `docs/site/*.md` before hardcoding; every URL is a literal in
`hosts`):

| rail | mainnet | testnet | stable | `explorerTx` |
|---|---|---|---|---|
| base | 8453 `eip155:8453`, `https://mainnet.base.org` | 84532 `eip155:84532`, `https://sepolia.base.org` | USDC `env.walletUsdcAddress()` (6 dp); Sepolia `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `https://basescan.org/tx/<hash>` / `https://sepolia.basescan.org/tx/<hash>` (verified) |
| tempo | 4217 `eip155:4217`, `https://rpc.tempo.xyz` (`wss://rpc.tempo.xyz`) | 42431 `eip155:42431`, `https://rpc.moderato.tempo.xyz` (`wss://rpc.moderato.tempo.xyz`) | OUSD `0x20c0000000000000000000006a37da5c996874be` (6 dp, same address on both networks) | `https://explore.tempo.xyz/tx/<hash>` / `https://explore.testnet.tempo.xyz/tx/<hash>` (verified) |
| hyperliquid | `https://api.hyperliquid.xyz` (+ HyperEVM 999 `https://rpc.hyperliquid.xyz/evm`) | `https://api.hyperliquid-testnet.xyz` (+ HyperEVM 998 `https://rpc.hyperliquid-testnet.xyz/evm`) | USDC — resolve by `spotMeta.tokens[].name === "USDC"` at runtime (tokenId `0xeb62eee3685fc4c43992febcd9e75443` on mainnet); never hardcode the index | none — `order` returns no tx hash; receipts show the cloid and link the master address on `https://app.hyperliquid[-testnet].xyz/explorer` (address path unverified) |
| solana | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`, RPC from `SOLANA_RPC_URL` (Helius) | devnet `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`, `SOLANA_RPC_URL_DEVNET` (default `https://api.devnet.solana.com`) | USDC mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (6 dp) / devnet mint `SOLANA_USDC_MINT_DEVNET` (default `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) | `https://explorer.solana.com/tx/<sig>` (`?cluster=devnet`) — [docs, not in the notes]: W0 leaves `explorerTx` unset (bare signature); W3a confirms the URL against one devnet signature at rehearsal and sets it in its own PR, so the §6.2/§17 receipt-line rule (link where the registry has a verified explorer URL — Tempo, Base, Solana — else the bare ref) holds from the first Solana receipt |
| zcash | lightwalletd `ZCASH_LIGHTWALLETD` (default `https://zec.rocks:443`) | `ZCASH_LIGHTWALLETD_TESTNET` (default `https://testnet.zec.rocks:443`) | ZEC (8 dp, native: `address: null`) | none — bare txid (no verified testnet explorer) |

Robinhood Chain (4663 / 46630), Arbitrum One (42161), Nova (42170), Sepolia (421614)
are **documented in `docs/site/evm-chains.md` only**; adding one is a row in this
table, not a session.

**Env manifest (R-ARCH-02).** Every new variable — `HL_LIVE_ENABLED`,
`HL_BUILDER_ADDRESS`, `HL_BUILDER_FEE_TENTHS_BP`, `HL_SLIPPAGE_BPS`,
`TEMPO_LIVE_ENABLED`, `TEMPO_SPONSOR_URL`, `TEMPO_API_KEY`, `MPP_SECRET_KEY`,
`SOLANA_LIVE_ENABLED`, `SOLANA_RPC_URL`, `SOLANA_RPC_URL_DEVNET`,
`SOLANA_USDC_MINT_DEVNET` (default `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`),
`CDP_WALLET_SECRET`, `ZCASH_ENABLED`, `ZCASH_LIVE_ENABLED`, `ZCASH_LIGHTWALLETD`
(default `https://zec.rocks:443`), `ZCASH_LIGHTWALLETD_TESTNET` (default
`https://testnet.zec.rocks:443`), `ZCASH_EXEC_SIGNING_KEY` (required when
`ZCASH_ENABLED`, no fallback), `ZCASH_PER_SEND_CAP_ZEC`, `ZCASH_DAILY_CAP_ZEC` — is a
row in `OPTIONAL_ENV` in `apps/web/lib/env.ts` (alphabetical) with a lazy
`env.<name>()` accessor (pattern `tradeLiveEnabled`, env.ts:407). Registry and rail
modules never read `process.env`; `lib/env.test.ts` (grep guard + manifest coherence)
fails CI otherwise. `zcashExecSigningKey()` returns `string | null` — `/api/wallet/zcash`
refuses 503 `zcash_unconfigured` when `ZCASH_ENABLED` and it is null (the manifest test
forbids a conditionally-throwing optional accessor). Reuse `env.x402FacilitatorUrl()` /
`env.x402Network()`; there is no `X402_SOLANA_NETWORK`. Tests: `chains/registry.test.ts`
(every rail resolves testnet by default; `liveEnabled` flips; `chainFor(rail,'testnet')`
ignores the flag; `explorerLink` is null for hyperliquid/zcash, and for solana until W3a
sets `explorerTx`).

### 4.2 Migration `supabase/migrations/0141_worlds_fair.sql`

W0 lands this file whole. Nobody edits it after it applies (`scripts/apply-migrations.sh`
fails an edited applied file on its recorded hash, and `deploy-migrations` runs on
every main push). Later sessions ship their own forward-only file at the next free
number **at merge time**: W4 → the `mini_apps` formation row + `formation_requests`
(§8), W5 → `zcash_sends` (§9). Every new table gets `enable row level security` and
**no policies** (RLS is row-level and cannot exclude columns; this is the family the
ledgers being extended belong to — `wallet_transfers` 0031, `payment_requests` 0042,
`provider_keys` 0063); `supabase/tests/rls_all_tables.sql` raises otherwise. Every
`references users(id)` declares `on delete cascade|set null`
(`lib/admin/deletion.test.ts`).

```sql
-- 0141_worlds_fair.sql (W0). Forward-only; one commit; never edited after apply.

-- ─── decisions: four new kinds (list verbatim from 0125 + four) ──────────────
-- No later migration re-touches this constraint; W4/W5 add tables, not kinds.
alter table decisions drop constraint if exists decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in ('tier2_contact','email_draft','run_approval','reconnect',
                  'revise','ad_write','spend_ceiling','content_plan',
                  'spend_divergence','calendar_add',
                  'vault_fill','vault_reveal','social_post','purchase_review',
                  'crm_update','miniapp_publish','miniapp_backend',
                  'payment_request','shop_publish',
                  'trade_order','trade_cancel','trade_settings','muse_action',
                  'otp_request',
                  'machine_payment','pay_policy','zcash_send','formation_submit'));

-- ─── card kinds: + 'formation' (lists verbatim from 0122_muse.sql:68-78) ──────
-- W4 adds "formation" to CARD_KINDS (lib/miniapps/cardSends.ts) and
-- FIRST_PARTY_RESERVED (lib/miniapps/reserved.ts); the SQL superset is harmless
-- until then (lib/admin/deletion.test.ts checks CARD_KINDS ⊆ this list).
alter table card_sends drop constraint card_sends_kind_check;
alter table card_sends add constraint card_sends_kind_check check (kind in (
  'computer','calendar','vault','browser','kanban','todo','onboarding','connect','video','image',
  'crm','analytics','inbox','pay','shop','settings','ads','home','persona','feedback','create','app',
  'draw','trade','freeze','checkout','watch','muse','formation'));
alter table miniapp_card_sessions drop constraint miniapp_card_sessions_kind_check;
alter table miniapp_card_sessions add constraint miniapp_card_sessions_kind_check check (kind in (
  'computer','calendar','vault','browser','kanban','todo','onboarding','connect','video','image',
  'crm','analytics','inbox','pay','shop','settings','ads','home','persona','feedback','create','app',
  'draw','trade','freeze','checkout','watch','muse','formation'));

-- ─── users: owner-entered receive / payTo addresses + the W3 send account ─────
-- solana_address / tempo_address are owner-entered (base58 / EIP-55 validated),
-- used for receive requests and the 402 payTo — never an account Air can sign
-- for (MA6). solana_cdp_address is W3's send account (CDP server wallet).
alter table users
  add column solana_address     text,
  add column tempo_address      text,
  add column solana_cdp_address text,
  add column solana_policy_id   text;
create unique index users_solana_address_idx on users (solana_address) where solana_address is not null;
create unique index users_tempo_address_idx on users (tempo_address) where tempo_address is not null;
create unique index users_solana_cdp_address_idx on users (solana_cdp_address) where solana_cdp_address is not null;

-- ─── user_chain_keys: sealed per-user secrets (W2 Tempo raw signer, W5 Zcash
--     wrap secret). sealSecret/openSecret under env.providerVaultKey() (0063). ──
create table user_chain_keys (
  user_id       uuid not null references users(id) on delete cascade,
  rail          text not null check (rail in ('tempo','solana','zcash')),
  network       text not null check (network in ('mainnet','testnet')),
  kind          text not null check (kind in ('raw_secp256k1','access_p256','wrap_secret')),
  address       text,
  secret_sealed text not null,
  key_hint      text,                                   -- last 4, display only (C18)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, rail, network, kind),
  check (kind <> 'raw_secp256k1' or network = 'testnet')   -- a raw signer never exists for mainnet (§6.6)
);
alter table user_chain_keys enable row level security;
-- service-role only: no policies (0063 provider_keys pattern).

-- ─── trade: a second live venue ──────────────────────────────────────────────
alter table trade_connections drop constraint trade_connections_provider_check;
alter table trade_connections add constraint trade_connections_provider_check
  check (provider in ('coinbase','hyperliquid'));
alter table trade_connections
  add column master_address text,                       -- HL: the owner's funded address (state is queried here)
  add column network text not null default 'testnet' check (network in ('mainnet','testnet')),
  add column builder_fee_approved boolean not null default false,
  add column agent_valid_until timestamptz,             -- HL: extraAgents.validUntil when present (W1a stores it; no cron flip)
  add column active boolean not null default false;
update trade_connections set active = true;             -- every existing (single, coinbase) row stays the active one
create unique index trade_connections_active_idx on trade_connections (user_id) where active;

alter table trade_orders
  add column venue text check (venue in ('coinbase','paper','hyperliquid')),
  add column venue_meta jsonb;                           -- {assetId, coin:"@107", cloid, szDecimals, network}
update trade_orders set venue = case when mode = 'paper' then 'paper' else 'coinbase' end;
alter table trade_orders alter column venue set not null;
-- No default: previewTrade writes venue at the insert (service.ts:173) in this same commit.

-- ─── payment_requests: RECEIVE requests + the Stripe / legacy-usdc payee lane ─
-- Several may be pending (today's behavior; pay.tsx renders them all). Chain
-- SENDS never create a payment_requests row (§4.3, §6.2, §7.3). Status stays
-- ('pending','approved','paid','dismissed','expired'). No one-pending index here.
alter table payment_requests drop constraint payment_requests_currency_check;
alter table payment_requests add constraint payment_requests_currency_check
  check (currency in ('usd','usdc','ousd','zec'));
alter table payment_requests
  add column rail text check (rail in ('stripe','base','solana','tempo','zcash')),
  add column network text,                               -- mainnet|testnet
  add column direction text not null default 'send' check (direction in ('send','receive')),
  add column memo_bytes32 text,                          -- tempo: 0x…32 bytes
  add column reference text,                             -- solana pay reference pubkey; zcash: none
  add column receive_address text,                       -- the address / UA shown on the request card
  add column tx_ref text,                                -- chainId:txHash:logIndex | signature | txid
  add column paid_amount text;                           -- what actually landed (atomic string, never a float)
update payment_requests set rail = case when currency = 'usd' then 'stripe' else 'base' end where rail is null;
alter table payment_requests alter column rail set not null;
alter table payment_requests add constraint payment_requests_currency_rail_check
  check ((currency, rail) in (('usd','stripe'),('usdc','base'),('usdc','solana'),('ousd','tempo'),('zec','zcash')));
create unique index payment_requests_tx_ref_idx on payment_requests (tx_ref) where tx_ref is not null;

-- ─── wallet_transfers: the ONE send ledger for every rail ────────────────────
-- Rails write the venue reference (chainId:hash:logIndex | signature | txid)
-- into the existing transaction_id (no tx_ref column), set token_symbol /
-- token_address explicitly (OUSD / USDC+mint / ZEC), keep amount_wei as the
-- atomic-unit string. The C23 terminal is the existing submit_unknown
-- (surfaced as "uncertain") — never write 'uncertain' here.
alter table wallet_transfers
  add column rail text not null default 'base',
  add column network text,                               -- mainnet|testnet
  add column memo text,
  add column request_id uuid references payment_requests(id) on delete set null,
  add column expires_at timestamptz,                     -- createTransferRequest: now()+5 min; cron sweeps pending → expired
  add column rail_meta jsonb;                            -- value-free venue details (mint/ATA, sponsor, fee estimate)
alter table wallet_transfers alter column chain_id drop not null;   -- solana/zcash rows carry no EVM chain id
alter table wallet_transfers add constraint wallet_transfers_chain_id_check
  check ((rail = 'base' and chain_id is not null) or rail <> 'base');
alter table wallet_transfers drop constraint wallet_transfers_status_check;
alter table wallet_transfers add constraint wallet_transfers_status_check
  check (status in ('pending','submitting','submitted','redirected','claimed','confirmed','expired',
                    'denied','failed','submit_unknown'));
create unique index wallet_transfers_tx_idx on wallet_transfers (transaction_id)
  where transaction_id is not null and rail <> 'base';
-- One pending SEND per user per non-base rail (WF5); propose maps 23505 → 409 naming the pending send.
create unique index wallet_transfers_pending_rail_idx on wallet_transfers (user_id, rail)
  where status in ('pending','submitting','claimed') and rail <> 'base';

-- ─── pay caps (WF7; lib/pay/caps.ts) ─────────────────────────────────────────
create table pay_caps (
  user_id          uuid primary key references users(id) on delete cascade,
  per_send_usd_cap numeric(14,2) not null default 250,
  daily_usd_cap    numeric(14,2) not null default 1000,
  updated_at       timestamptz not null default now()
);
alter table pay_caps enable row level security;

-- ─── machine payments (agent as buyer; WF4 — the arm lands in W2b) ───────────
create table machine_payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  decision_id           uuid references decisions(id) on delete set null,
  policy_id             uuid,                            -- dormant: set only when a standing policy pays (post-hackathon, §15)
  protocol              text not null check (protocol in ('x402','mpp')),
  rail                  text not null,                   -- base|solana|tempo
  network               text not null,
  url                   text not null, method text not null default 'GET', realm text,
  amount                text not null, asset text not null, recipient text not null,
  challenge             jsonb not null,                  -- value-bearing: the parsed 402 (service-role only)
  challenge_fingerprint text,                            -- sha256 of the normalized challenge; the resolver's re-fetch must match
  resolved_by           text not null default 'owner' check (resolved_by in ('owner','policy')),
  state                 text not null check (state in ('previewed','pending_approval','paying','paid','denied','expired','failed','uncertain')),
  receipt               jsonb, tx_ref text, error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index machine_payments_pending_idx on machine_payments (user_id) where state = 'pending_approval';
alter table machine_payments enable row level security;

-- ─── pay_policies: schema only — DORMANT for the submission (R10, §15). No
--     route writes it; /pay policy is out of the window. ──────────────────────
create table pay_policies (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  decision_id    uuid references decisions(id) on delete set null,
  hosts          text[] not null,                        -- exact hostnames the policy covers
  rail           text not null, network text not null,
  per_charge_usd numeric(14,2) not null, daily_usd numeric(14,2) not null,
  expires_at     timestamptz not null,
  onchain_ref    text,                                   -- tempo access-key address when enforced on-chain
  status         text not null default 'active' check (status in ('active','revoked','expired')),
  created_at     timestamptz not null default now()
);
alter table pay_policies enable row level security;

-- ─── x402_receipts: protocol + network ───────────────────────────────────────
-- The replay key is the existing jti primary key (first insert wins, 23505 =
-- replay); there is no nonce column. MPP fills the NOT NULL payer_address,
-- amount_usdc (the USD amount) and tx_hash (§6.4). network = the registry caip2
-- of the settling chain (W3b writes solana:EtWT… regardless of the v1 wire
-- string; §6.4 names the Tempo value).
alter table x402_receipts
  add column protocol text not null default 'x402' check (protocol in ('x402','mpp')),
  add column network text;
```

Tests that pin this file: `supabase/tests/rls_all_tables.sql` (CI), a new
`supabase/tests/decision_kinds.sql` (an insert with an unlisted kind is refused by
`decisions_kind_check`), `lib/admin/deletion.test.ts` (card-kind superset, cascade rule,
and a new decisions-kind assertion mirroring the card-kind one), and the shadow apply +
no-op re-apply in `ci.yml`.

### 4.3 Service seams added in W0 (typed; Base arms real, other arms land with their sessions)

**Rails — `lib/pay/rails/index.ts`.** W2/W3/W5 add `lib/pay/rails/{tempo,solana,zcash}.ts`
beside it (a directory, never a `lib/pay/rails.ts` file).

```ts
export type PayRailId = Exclude<RailId, "hyperliquid">;
export interface PayRail {
  id: PayRailId;
  validateAddress(addr: string): boolean;                      // replaces validateSendAddress for non-base rails
  previewSend(supabase, userId, input: SendInput): Promise<SendPreview>;  // address/amount/memo/balance/assertPayCaps/fee — writes nothing
  prepare(supabase, userId, transfer: WalletTransfer): Promise<Prepared>; // AFTER the CAS; a throw releases the claim (nothing reached the chain)
  submitSend(prepared: Prepared): Promise<{ state: "submitted" | "redirected"; txRef: string }>; // any throw → submit_unknown, never released
  request?(supabase, userId, input: RequestInput): Promise<PaymentRequest>;        // receive request (payment_requests, direction='receive')
  watchReceive?(supabase, request: PaymentRequest): Promise<"paid" | "open" | "expired">;
  balance(supabase, userId): Promise<{ symbol: string; display: string; atomic: string }>;
  tick(supabase): Promise<void>;                               // watchers, expiries, reconciliation — read/notify only (WF8)
}
export const baseRail: PayRail;         // wraps today's lib/wallet/send.ts path (below)
export function railFor(rail: PayRailId): PayRail;   // WalletSendError(400, "<rail> isn't available yet") until that session lands
```

`baseRail`: `validateAddress` = the `0x` regex; `previewSend` = `validateSendAddress` +
`parseAssetAmount` + `assertPayCaps`; `prepare` = today's `users.wallet_address` read;
`submitSend` = `sendWalletTokens(from, chainId, to, atomic, tokenAddress,
transferIdempotencyKey(id))` → `{ state: "submitted", txRef: transactionId }`
(a 2xx with no id still throws → `submit_unknown`). Zcash's send path keeps its own
`zcash_sends` row and `zcash_send` kind; `resolveZcashSend` (§9.4) calls
`zcashRail.submitSend` on that row under the same prepare/submit contract.

**The send lane — `lib/wallet/send.ts` (`createTransferRequest` + `executeTransfer`),
no `resolvePayment`.** Every chain send (`/pay <amt> <ASSET> to <addr> on <rail>`, the
Pay form, `POST /api/pay {action:'preview'|'propose'}` in W2a) calls `rail.previewSend`
and then

```ts
createTransferRequest(supabase, userId, {
  rail, network, to, atomic, display, asset, decimals, memo?, feeEstimate,
}): Promise<{ transferId; decisionId }>
```

which writes **one** `wallet_transfers` row (`rail`, `network`, `memo`, `token_symbol`,
`token_address`, `expires_at = now() + 5 min`, `rail_meta`) and **one** `run_approval`
decision whose `ref` is the row id, whose label is `Send <amount> <token> on <network>`
and whose payload is value-free: `{ wallet_send: true, rail, network, token,
amount_display, to_hint, memo_present, fee_estimate_usd?, sponsored?, expires_at }`
(C18 — no full address, no memo text). A 23505 on `wallet_transfers_pending_rail_idx`
throws `WalletSendError(409, …)` naming the pending send. No `payment_requests` row is
created for a send; `payment_requests` is for receive requests and the Stripe /
legacy-usdc payee lane (`approvePaymentRequest` is untouched). The positional
`createTransferRequest(supabase, userId, toRaw, amountRaw, asset)` stays as a thin Base
wrapper (`baseRail.previewSend` → the object form with `rail: 'base'`) so its four
callers (`app/api/wallet/send`, `lib/muse/capabilities.ts`, `masterkey.tsx`,
`paymentRequests.ts`) do not change in W0.

`executeTransfer` keeps its CAS `pending → submitting` (0 rows → 409) and is split after
it into `rail.prepare(transfer)` (a throw releases the claim back to `pending`, as the
wallet-address read does today) and `rail.submitSend(prepared)` (a throw →
`markSubmitUnknown` + `WalletSubmitUnknownError`, never released — C23). It writes the
returned `state` (`submitted` | `redirected`) and `transaction_id = txRef` instead of the
unconditional `'submitted'`, and still returns the txRef. Before the CAS it re-reads the
row and refuses `expired` when `expires_at` has passed; each rail's `prepare` re-checks
balance/caps. `transferIdempotencyKey` applies to thirdweb only — on every other rail the
CAS is the sole guard. The existing `run_approval` arm in `lib/decisions/resolve.ts`
(`findPendingTransfer` → `executeTransfer`, incl. the flip-before-rethrow on
`WalletSubmitUnknownError`) is the executor for every rail; W0 changes nothing in that
arm. Tonight the Pay card's owner-only "To pay" list approves the `run_approval` via
`resolveDecision` (§6.3); the hosted approval link for chain sends
(`isHostedMoneyDecision(kind, payload)` at hosted.ts, resolve.ts:228-234 and
`app/api/approvals/[id]/route.ts`, the wallet arm moved into hosted.ts,
`deliverTradeApproval` generalized into `lib/approvals/deliver.ts`) is P1 after the
slice. Tests: `send.test.ts` (expired refused before the CAS; prepare throw releases;
submit throw terminal; `redirected` written; 23505 → 409; payload is value-free).

**Decision dispatch — two chains, one PR per kind.** `resolveDecision`
(`lib/decisions/resolve.ts`) is an if-chain whose unmatched kinds fall through to the
final conditional `status='pending'` flip; `lib/approvals/hosted.ts` is its hosted-link
twin (`HOSTED_KINDS`, `loadHostedApproval`, `resolveHostedDecision`; the kind gate is
repeated at `app/api/approvals/[id]/route.ts`). Every new kind (`machine_payment`,
`zcash_send`, `formation_submit`; `pay_policy` dormant) lands in resolve.ts **and**
hosted.ts (`HOSTED_KINDS` + view + arm) **and** the `app/approve/[id]/approve-client.tsx`
kind union (line 18) in the same PR as its session, with a test that it resolves through
both chains — a kind present in only one silently approves without executing or 404s on
the link. W0 lands the scaffolding: `MONEY_KINDS = ['machine_payment','pay_policy',
'zcash_send','formation_submit']`; both chains return 501 `kind_not_implemented` for a
`MONEY_KINDS` kind whose arm has not landed (no flip — `resolve.test.ts` +
`hosted.test.ts`); the three live kinds in `HOSTED_KINDS` with a value-free
`loadHostedApproval` view; the approve-client union; `needs-panel.tsx` labels
(`machine_payment: "Agent purchase awaiting approval"`, `zcash_send: "Zcash send
awaiting approval"`, `formation_submit: "Formation packet awaiting submit"`) and CTAs.
One pure formatter `lib/approvals/moneyCard.ts` maps a money payload (`wallet_send`,
`trade_order`, `machine_payment`, `zcash_send`) to `{ headline, rows }` — headline
`<amount> <token> on <network>`, network chip always present (WF2) — and is the only
reader of those payloads in needs-panel / approve-client (React) and pay.tsx / trade.tsx
(HTML strings); needs-panel otherwise shows the label. `moneyCard.test.ts`: never emits a
full address, memo text or signed data.

**`/pay` parser — `lib/pay/parse.ts` (new; nothing to extend).** Deterministic
`parsePayCommand(input): PayCommand | null`, the shape of `lib/trade/parse.ts
parseTradeCommand`:

```ts
export type PayCommand =
  | { kind: "card" }                                         // bare `/pay`
  | { kind: "help" }
  | { kind: "send";    amount: string; asset: string; to: string; rail?: PayRailId; memo?: string }
  | { kind: "request"; amount: string; asset: string; rail?: PayRailId; memo?: string }
  | { kind: "balance"; rail: PayRailId }
  | { kind: "address"; rail: PayRailId; set?: string }       // `set <addr>` = owner-entered receive address (§6.4, §7.4)
  | { kind: "agent";   text: string };                       // any other `/pay …` — never an error
```

Canonical forms: `/pay <amt> <ASSET> to <addr|@user> on <rail> [memo <text>]`,
`/pay request <amt> <ASSET> on <rail> [memo <text>]`, `/pay <rail> balance`,
`/pay <rail> address [set <addr>]`, `/pay help`. Amounts strip thousands commas (`2,500`)
like `WATCH_RE`; `ASSET` upper-cases to `USD|USDC|OUSD|ZEC`; `<rail>` ∈
`base|solana|tempo|zcash` as the bare first token; `/payment` and `/pay\n` → `null`;
bare `/pay` → `{ kind: "card" }` (iMessage: `maybeSendMiniAppLink` has already sent the
card; web: explicit arm). `/zec address|balance|request …|send …` parses into the same
`PayCommand` with `rail: "zcash"` (no second parser; bare `/zec` → `help`). `/pay policy …`
is out of the window (→ `agent`). Asset/rail defaults (USD → Stripe; USDC → base unless
`on solana`; never infer a rail from USD) live in `lib/pay/imessage.ts` and the rails, not
the parser. `/trade connect [coinbase|hyperliquid]` lands in `lib/trade/parse.ts` as
`{ kind: "mode", mode: "connect", venue?: "coinbase" | "hyperliquid" }` (today the tail is
dropped) plus its `TRADE_HELP_LINES` row. Tests: `lib/pay/parse.test.ts` (every arm, false
prefixes, commas, memos > 32 bytes rejected at preview not parse, `/zec` forms),
`lib/trade/parse.test.ts` (connect tail).

**Dispatch — `lib/pay/imessage.ts runPayCommand(supabase, sendText, job, command)`**,
a mirror of `runTradeCommand` (`card`/`agent` → `{ handled: false }`; `job.senderTier !==
0` → the owner-only line; `help` → `PAY_HELP`; `balance`/`address` → `railFor(rail)` reads
as text; `send` → `rail.previewSend` + `createTransferRequest` + the Pay card via
`sendMiniAppCard(…, "pay", "default", { subcaption })` or `mintSignedLink(userId, "pay",
"default")` on web; `request` → `rail.request` + card; an un-landed rail replies
"<rail> isn't available yet"). Wired at `lib/orchestrator/flush.ts` beside
`runTradeCommand` (~917) and at `app/api/chat/route.ts` beside `parseTradeCommand` (~221)
with an explicit `card` arm (`mintSignedLink(userId, "pay", "default")`; the web lane has
no `maybeSendMiniAppLink`). No model turn and no Box wake on a fully specified line;
`agent` falls through to the Hermes run exactly like `/trade buy`. `deliverPayEvent`
(§6.3) lives in the same file (W2a). Tests: `flush.test.ts` (mock `../pay/imessage`,
mirror the `/trade portfolio` burst test), a new `app/api/chat/route.test.ts` case.

**Origin — `lib/auth/origin.ts requireInteractiveRun(supabase, principal)` (WF8).** T7 is
enforced only by construction today (`requireBoxOrOwner` carries no surface or run
context; `/api/trade` performs no origin check; crons only read, reconcile, expire,
notify). W0 adds the heuristic: no-op for `owner` principals; for `box` principals,
select the newest `agent_runs` row with `user_id`, `ended_at is null`, `hermes_run_id not
null`, `started_at > now() − 15 min` (the fail-closed "newest open run" lookup extracted
from `lib/vault/purchase.ts resolveActiveTurn`); require `trigger ∈ {'imessage','web',
'desktop','voice'}` and, for `imessage`, `sender_tier = 0`; anything else — no open row
(the production case: cron/email runs insert their row only after completion), or
`cron|email|mcp|app|job` — throws `GuardError(403, 'not_interactive')`. Called after auth
in `POST /api/trade {propose, cancel}` (W0), `POST /api/pay {preview|propose|request|
machine}` (W2a), `POST /api/wallet/zcash {propose}` (W5a). It is a heuristic over
`agent_runs`, not a per-run token; any auto-executing path stays off until one exists.
Tests: `origin.test.ts` (no open run → 403; open cron/email/mcp/job → 403, defensive;
imessage tier 1 → 403, tier 0 → ok; web/desktop/voice → ok; stale > 15 min → 403; owner →
never consulted) plus a static import-specifier test that `app/api/cron/**/route.ts`
imports no `preview*`/`propose*` specifier.

**Prices — `lib/trade/prices.ts`.** `interface PublicPrices { price(productId);
changePct(productId); candles(productId, seconds); product(productId); products(q,
limit) }` with `coinbasePublicPrices` (wraps coinbase.ts:219-295) and
`publicPricesFor(supabase, userId)` returning it (W1a adds `hyperliquidPublicPrices` and
the provider/quote switch: HL when the active provider is `hyperliquid`, else `-USDC` →
HL, otherwise Coinbase). W0 moves `paperVenue(supabase, userId, prices)`,
`paperPortfolio`, `tape.ts` (`tapeMarkets`, `tapeIntent` validating with the shared
`productIdSchema` regex from `lib/trade/order.ts`, `tapeState`), `watch.ts` (`addWatch`,
`tickWatchlists`) and `portfolioView` onto the seam for product **and** price lookup
(mechanical; behavior unchanged; `tape.test.ts` moves its mock to the seam) so W1a's half
is fixture-green.

**Trade rows — `getTradeConnection` + `previewTrade`.** `getTradeConnection(supabase,
userId)` selects the row where `active = true` (0141 backfills it) and surfaces the query
error instead of discarding it (`maybeSingle` on two provider rows silently fell to paper);
`tradeMode` unchanged. `previewTrade` writes `venue` at the insert (service.ts:173):
`mode === 'paper' ? 'paper' : connection.provider`. `venueFor` still returns
`coinbaseVenue` for live in W0; W1a switches on `connection.provider` (§5.1).

**Caps — `lib/pay/caps.ts assertPayCaps(supabase, userId, usd, rail)`**: the trade
`assertCaps` shape — per-send, daily over `wallet_transfers` + `machine_payments`
(last 24 h, non-terminal-failed rows), velocity 20/h; `pay_caps` row or the defaults.
Zcash caps are ZEC-denominated (`ZCASH_PER_SEND_CAP_ZEC`, `ZCASH_DAILY_CAP_ZEC`); any USD
valuation of ZEC fails closed when no control-plane rate is available (§9.3) — never 0.
`caps.test.ts`.

**Cron — `app/api/cron/pay-rails/route.ts`**, `requireCron` from `lib/auth/guard.ts`, a
`vercel.json` row at `* * * * *` and a block in `app/api/cron/cron.test.ts` (R-TQ-07):
sweeps `wallet_transfers` `pending` past `expires_at` → `expired` and `payment_requests`
`pending` past `expires_at` → `expired`, then calls `railFor(rail).tick()` for each landed
rail (`.catch` per rail; R-PERF-06 duration log). Reads, reconciles, expires, notifies —
never proposes (WF8; the static specifier test above).

**Renderers.** The needs-panel / approve-client entries and `moneyCard.ts` above;
`pay.tsx` gains nothing in W0 beyond compiling against the new `PaymentRequest` columns
(two lists land in W2a, §6.3).

**Dependencies.** `viem@2.57.4` as a direct `apps/web` dependency (§4.4); no other
package in W0.

### 4.4 Repo conventions every session inherits (referenced from every §12/§13 row)

1. **Commit ids.** Subjects start `R-WF-0<n>:` (W0 → `R-WF-00` … W6 → `R-WF-06`).
   `scripts/check-commit-ids.sh` (`ID_PATTERN` `R-[A-Z][A-Z0-9]*-[0-9]+|…`) runs in the
   `commit-ids` CI job on every PR (`if: github.event_name == 'pull_request'`,
   ci.yml:36-38 — a bad subject is caught at the PR, not on a direct push to main), so
   `W1: …` fails there; merge commits and `chore:` commits are the only exemptions
   (check-commit-ids.sh:11-19). Amend (or `chore:`-prefix) this branch's two
   "World's Fair: …" commits before opening its PR.
2. **Env manifest.** Every new variable is an `OPTIONAL_ENV` row + lazy `env.<name>()`
   accessor in `lib/env.ts` (§4.1); modules never read `process.env` (`lib/env.test.ts`).
   Reuse `X402_FACILITATOR_URL` / `X402_NETWORK`; no `X402_SOLANA_NETWORK`.
3. **Pins.** viem is **not** a direct dependency today (the root `viem` 2.39.0 is
   thirdweb's exact pin and has no `viem/tempo`). W0 adds `viem@2.57.4` to
   `apps/web/package.json` — no root `overrides.viem` unless `npm i` ERESOLVEs on mppx's
   `viem >=2.57.1` peer, and then only if typecheck + tests stay green. Acceptance:
   `cd apps/web && node -e "require.resolve('viem/tempo')"` and `npm ls viem`. W1:
   `@nktkas/hyperliquid@0.33.3`. W2: `mppx@0.13.3` (import only `mppx/server` /
   `mppx/client`; zod 4 — never re-export its schema types). W3: `@solana/kit` stays
   5.5.1 (lockfile; cdp-sdk hard dep), `@solana-program/token@0.9.0`,
   `@solana-program/memo@0.10.0`, `@solana-program/compute-budget@0.11.x` (the last kit ^5
   peers), `@coinbase/cdp-sdk@1.57.0`; `@x402/core @x402/evm @x402/svm @x402/fetch@2.28.0`
   are **W3b's acceptance client only** (`scripts/x402-solana-pay.ts`,
   `wrapFetchWithPayment` + `createSvmClient`) — the 402 gate stays on the installed
   `x402@1.2.0` (`apps/web/node_modules/x402`, package-lock.json:593-595; v1 wire,
   `X-PAYMENT`), W3b adds Solana as a second v1 `accepts` entry with it, and the v2
   `PAYMENT-SIGNATURE` branch exists only if devnet rehearsal rejects v1 SVM payloads — no
   v2 library swap (§7.5); **no `@solana/pay`** (peers kit ^6.9 — unsatisfiable; the
   URI + reference lookup is hand-rolled in `lib/pay/solanaPay.ts`, §7.4).
4. **Coverage lanes.** New rail readers go in `lib/chains/<rail>/read.ts` and are called
   from `lib/wallet/read.ts`, never implemented inside `lib/wallet/**` (46% line floor).
   Run `cd apps/web && npx vitest run --coverage` before the PR and keep the floors in
   `vitest.config.ts` (42% global lines / 70% functions; `lib/wallet/**` 46,
   `lib/auth/**` 47, `lib/decisions/**` 46, `lib/approvals/**` 56). Modules that log use
   `expectLog` from `lib/testing/expectLog.ts` (`vitest.setup` fails a test on unclaimed
   console output). Colocated Vitest fixtures (recorded venue/RPC responses) — no network
   under `npm test`.
5. **Crons.** `/api/cron/pay-rails` uses `requireCron` and has a `vercel.json` row plus a
   `cron.test.ts` block (§4.3); `/api/cron/trade` already does (it is not "public, no key").
6. **Box skills.** `infra/template/skills/<name>/SKILL.md` (front-matter `name` = dir) is
   copied automatically by `setup.sh`'s local-skills loop and `sync-box.sh`; never touch
   `base-skills.txt`, `skills-manifest.py` or `BASE_SKILLS`. Read `~/.hermes/.env` with
   `grep | cut` as `trade/SKILL.md` does, never `source`/`eval` (TC-05). One
   `check "skill-<name>" test -f "$HOME_DIR/.hermes/skills/<name>/SKILL.md"` line per skill
   in `verify-box.sh`, including the missing `trade` one.
7. **Evals.** There is no `WF_EVAL_FIXTURE` and no `TRADE_EVAL_FIXTURE` (a plan.md name
   only). Acceptance = colocated fixtures under `npm test`; the agent-suite money cases
   (`evals/agent-suite/messages.jsonl`, after adding a `money` entry to `CATEGORIES` and
   `'trade_order','machine_payment','pay_policy','zcash_send','formation_submit'` to
   `DECISION_KINDS` in `evals/agent-suite/lib.ts` — five kinds, because the list ends at
   `shop_publish` today with no `trade_*` entry, lib.ts:9-28) are a separate live-box layer
   run with `EVAL_ONLY=… npx tsx evals/agent-suite/run.ts` (§12).
8. **Devin routing.** `.agents/skills/air-worlds-fair` (repo-authored, not in the root
   `skills-lock.json`) routes Devin only — the Box never receives `.agents/skills`.
   Regenerate its non-negotiables from §2 with this spec's own numbering: constraints are
   `WF1`–`WF9` (code comments cite `spec.md §WF3`), sessions stay `W0`–`W6`.
9. **Migrations.** `0141` declares `on delete cascade|set null` on every `references
   users(id)`; later sessions never edit it and number their own file at merge time (§4.2).

---

## 5. W1 — Hyperliquid spot venue (1.5 sessions: W1a + W1b)

One venue file behind the existing `TradeVenue` seam, HyperCore **spot only** (§15.1
unchanged). Two halves, both committed as `R-WF-01:` (§4.4). **W1a** is fixture-green
(no network) and runs in parallel with W2a the moment W0 merges. **W1b** needs the
owner's testnet API wallet (§17 pre-seed) and runs after W1a. Invariants in force:
§2 WF1 (the resolver is the only code that signs an exchange action), WF2 (testnet by
default), WF3 (sealed key, last-4 hint), WF6 (the approved preview is the submitted
order), WF8 (no unattended propose), WF9 (estimated, never advice); C23 verbatim
(`uncertain` is terminal, never retried, never reclassified).

| Half | Lands | Depends on |
|---|---|---|
| W1a | `lib/trade/hyperliquid/{client,format,venue}.ts` on recorded fixtures; `hyperliquidCredentials`; `venueFor` switching on `provider`; the `provider:'coinbase'` literal sites parameterized (§5.6); `createOrder(order, clientOrderId, preview?)` with `resolveTradeOrder` passing the stored preview; `trade_orders.venue` bound in the resolver (409 `venue_changed`); `ApiRequestError` → `order_rejected`, transport errors → terminal `uncertain`; `getOrder` status normalization incl. `canceled`/`unknownOid`; `lib/trade/prices.ts` `hyperliquidPublicPrices` + `publicPricesFor` so paper/tape/watch/portfolio price `HYPE-USDC` from `allMids` and `tapeIntent`/`tapeMarkets`/`addWatch` accept `-USDC`; `imessage.ts` connect arm routes by `command.venue`; resolver + `imessage.ts` copy drop the word Coinbase (the `trade.tsx` chips are W1b) | W0 |
| W1b | Settings venue picker + HL connect form (write-only) + `connectHyperliquid`/disconnect + builder-fee state + the `trade.tsx` chips/copy; `agent_valid_until` display (column from 0141, §4.2); tape candles from `candleSnapshot`; `tickWatchlists` on HL; `infra/template/skills/trade/SKILL.md` wording; the §12 testnet gate | W1a + §17 pre-seed |

W0 already landed (read before writing): 0141's `trade_connections` widening
(`provider` check `('coinbase','hyperliquid')`, `master_address`, `network`,
`builder_fee_approved`, `active` backfilled `true` + `trade_connections_active_idx` —
`agent_valid_until` for W1b's display) and `trade_orders.venue`
(backfilled, `not null`, no default) + `venue_meta` (§4.2); `previewTrade` stamping
`venue` at the insert (service.ts:173); `getTradeConnection` selecting `active = true`
and surfacing its query error (R7: the backfill and the `.eq('active', true)` select
land together or Coinbase users drop to paper — **W0 owns this, W1a does not re-own
it**; where §13's contract line lists it under W1a read W0); `lib/trade/prices.ts` with
`coinbasePublicPrices` only; `/trade connect [coinbase|hyperliquid]` as
`{ kind:'mode', mode:'connect', venue? }` in `parse.ts` + `TRADE_HELP_LINES` (§4.3);
`requireInteractiveRun` on `POST /api/trade {propose,cancel}` (§2 WF8); `viem@2.57.4`
as a direct `apps/web` dependency; the `HL_*` rows in `OPTIONAL_ENV` with `env.hl*()`
accessors (§4.4). W1 adds no route: the connect form posts to the trade module's
`action`, approvals resolve through the existing arms.

### 5.1 Files

```
apps/web/lib/trade/hyperliquid/client.ts       W1a  hyperliquidInfo(network) (Info reads, no key) + hyperliquidExchange(agentKey, network)
                                                    exposing exactly `order` and `cancelByCloid` (§5.7); hosts via the SDK's
                                                    `new HttpTransport({ isTestnet: network === "testnet" })` — api.hyperliquid.xyz /
                                                    api.hyperliquid-testnet.xyz, both in the registry's hyperliquid row (C5, §4.1 table),
                                                    asserted equal by the §14 grep test. Never `chainFor('hyperliquid')`: §4.1's one-argument
                                                    form picks the network from the global HL_LIVE_ENABLED, but here the network is per
                                                    connection (§5.2) and paper prices always read mainnet (§5.4)
apps/web/lib/trade/hyperliquid/format.ts       W1a  productId ↔ spot market ("HYPE-USDC" ↔ "HYPE/USDC" ↔ "@n"), TradeProduct from universe+tokens,
                                                    formatPrice/formatSize rules, cloid from uuid, status normalization
apps/web/lib/trade/hyperliquid/venue.ts        W1a  hyperliquidVenue(creds, network): TradeVenue; hyperliquidCredentials(connection)
apps/web/lib/trade/hyperliquid/*.test.ts       W1a  recorded fixtures (spotMetaAndAssetCtxs, spotClearinghouseState, allMids, userFees, orderStatus,
                                                    order ok/resting/ApiRequestError/TransportError, candleSnapshot), no network; client grep test
apps/web/lib/trade/prices.ts                   W1a  + hyperliquidPublicPrices(network), publicPricesFor(supabase, userId)   (seam from W0)
apps/web/lib/trade/venue.ts                    W1a  createOrder(order, clientOrderId, preview?)
apps/web/lib/trade/order.ts                    W1a  export productIdSchema (today a module-private const, order.ts:29-36) for tape.ts
apps/web/lib/trade/service.ts                  W1a  venueFor on provider; provider literal sites; venue bound in resolver; copy; portfolioView via the seam
apps/web/lib/trade/coinbase.ts                 W1a  TradeConnectionRow + getTradeConnection select list gain network/master_address/builder_fee_approved
                                                    (`active` and `agent_valid_until` landed in W0)
apps/web/lib/trade/paper.ts                    W1a  paperVenue(supabase, userId, prices), paperPortfolio(supabase, userId, prices)
apps/web/lib/trade/tape.ts, watch.ts           W1a  product ids from the active quote, reads through the seam; W1b HL candles + watch tick
apps/web/lib/trade/tape.test.ts                W1a  mock moves from ./coinbase (tape.test.ts:16-24) to ./prices
apps/web/lib/trade/imessage.ts                 W1a  connect arm routes by command.venue (settings card, venue in the subcaption); portfolio line names the provider
apps/web/lib/miniapps/apps/trade.tsx           W1b  Settings: venue picker + HL connect form (write-only), builder-fee state; chips/copy drop Coinbase
                                                    (trade.tsx:94, 286, 389-394, 764-765)
infra/template/skills/trade/SKILL.md           W1b  venue-agnostic wording; HYPE-USDC examples; `/trade connect hyperliquid`
docs/site/hyperliquid.md                       W6   Status line, connect row + code block per §10 (spec_correction on the page)
```

Dependencies (§4.4): `@nktkas/hyperliquid@0.33.3` (exact pin; it tracks the live API
surface) + `viem/accounts` (`privateKeyToAccount`) from the `viem@2.57.4` direct
dependency W0 added — viem is **not** otherwise a direct dependency (root `viem`
2.39.0 is thirdweb's pin). `formatPrice`/`formatSize` come from
`@nktkas/hyperliquid/utils`. No Python, no child processes, no `process.env` reads
(`lib/env.test.ts`).

### 5.2 Connection (Settings → Connect → Hyperliquid) — W1b

Form fields (write-only, owner-only, mini origin): **master address** (the funded
account whose state is queried — always the master, never the agent), **API-wallet
private key** (created by the owner on Hyperliquid's API page — mainnet
`https://app.hyperliquid.xyz/API` is confirmed, the testnet `/API` path is [docs,
unverified] — with a name and expiry), **network** (`testnet` default; `mainnet` only
when `env.hlLiveEnabled()` and the user is in `TRADE_ALLOWLIST`). Verify on save, with
the same shape as `connectCoinbase` (verify first, persist `status='error'` + the
venue's words when it fails): `userRole({ user: agentAddress })` must be
`{ role: "agent", data: { user: masterAddress } }`; `extraAgents({ user: master })` must
list the agent; its `validUntil` (ms, nullable) is stored as
`trade_connections.agent_valid_until` when present — the column W1b adds in its own
forward-only migration (§5.1), not 0141. No cron flips anything on expiry: an expired
agent surfaces as `order_rejected` at submit and the Settings chip says "re-approve".
Status chip: `● hyperliquid · testnet · agent …a1b2 · expires 2026-12-30`.

Storage: one `trade_connections` row `provider='hyperliquid'` — `key_id` = agent
address (lowercase; the existing non-null checks hold), `key_id_hint` = last 4,
`secret_sealed` = `sealSecret(agentPrivateKey, env.providerVaultKey())`,
`master_address`, `network`, `active = true`, `mode` by the same `liveAllowed` rule
`connectCoinbase` applies (service.ts:771-773). **Two statements, in this order:**
first `update trade_connections set active = false where user_id = ? and provider <>
'hyperliquid'`, then the upsert on `(user_id, provider)` with `active = true`.
`connectCoinbase` is a single supabase-js `upsert` (service.ts:796-811) and PostgREST
cannot flip another provider's row inside it; with `trade_connections_active_idx`
(partial unique on `(user_id) where active`) the upsert fails 23505 while the Coinbase
row is still active. If the upsert fails after the deactivate, the user has no active
row → `getTradeConnection` returns `null` → paper, and the chip says so (safe side).
`connectCoinbase` mirrors this (deactivate the `hyperliquid` row, then its upsert).
`hyperliquidCredentials(connection)` mirrors `tradeVenueCredentials`
(coinbase.ts:514-530): opens `secret_sealed` with `openSecret`, returns
`{ agentKey, agentAddress: key_id, masterAddress: master_address }`, `null` when the
vault key, `secret_sealed`, `key_id` or `master_address` is missing → `venueFor`
throws `key_unreadable` naming the provider. Disconnect nulls `key_id`/`key_id_hint`/
`secret_sealed` and sets `status='disconnected'`, `mode='paper'` on the provider row
(as `disconnectCoinbase` does, service.ts:860-876) — Air deletes its copy but cannot
revoke the approval; the copy links the API page. Rotate = re-enter.

Network gating: live on HL — **testnet or mainnet** — still requires
`TRADE_LIVE_ENABLED=true` (+ `TRADE_ALLOWLIST` when set) because `resolveTradeOrder`
and `setTradeMode` gate every `mode='live'` row (service.ts:455-471, 884-899;
`env.tradeLiveEnabled()`/`env.tradeAllowlist()`, env.ts:407-415). `HL_LIVE_ENABLED`
additionally gates `network='mainnet'` on connect. The §12 testnet gate therefore runs
with `TRADE_LIVE_ENABLED=true`, `HL_LIVE_ENABLED=false`. `setTradeMode`'s "Connect a
Coinbase key first" (service.ts:900-906) becomes "Connect a venue key first".

§15.2 is **closed**: paste-the-API-key for the submission (the owner creates and
approves the agent in their own wallet; Air never holds the master key). Not v1:
Air-generated agent keypair + wallet-signed `approveAgent` on the mini origin.

**Builder fee (§15.3 closed: ON for testnet).** `HL_BUILDER_ADDRESS` (lowercase; an
Air-controlled testnet address) and `HL_BUILDER_FEE_TENTHS_BP` (default `10` = 1 bp;
`f ≤ 1000`, the spot cap). One ceiling everywhere (here and on the page): the owner
runs `approveBuilderFee({ maxFeeRate: "0.01%", builder })` as a user-signed action in
their own wallet — a §17 pre-seed step, never Air. Settings shows that exact action;
Air polls `maxBuilderFee({ user: master, builder })` and sets `builder_fee_approved`
when it is ≥ `f`. Orders carry `builder: { b, f }` only when approved; otherwise they
go without — never fail an order on a missing builder approval. The builder's funding
minimum is [docs, unverified]; confirm on HL docs before relying on it.

### 5.3 `hyperliquidVenue` ↔ `TradeVenue` — W1a

| `TradeVenue` | Hyperliquid | Notes |
|---|---|---|
| `listProducts(q, limit)` | `spotMetaAndAssetCtxs()` → `universe[]` joined with `tokens[]` (shared `format.ts` builder, also used by `prices.ts`); `productId = "${base}-${quote}"` from token names; `productType: "SPOT"`, `status: "online"`; `price` = ctx `midPx ?? markPx`; `baseIncrement = 10^-szDecimals(base)`, `quoteIncrement` from the price rule, `quoteMinSize = "10"` (exchange min notional, [docs]) | Resolve by **name** from `universe` each call (`@n` vs `PURR/USDC` forms); USDC by `tokens[].name === "USDC"` (tokenId `0xeb62eee3685fc4c43992febcd9e75443` on mainnet), never a hardcoded index; never cache labels across runs (indices differ per network). |
| `getProduct(id)` | same, single | Unknown → `throw new TradeVenueError("No Hyperliquid spot market named HYPE-USDC.", 404, "not_found")` (message, status, code — the code existing venues use). T4 applies (spot only is structural here). |
| `balances()` | `spotClearinghouseState({ user: master })` → `{ asset: coin, available: total − hold, hold }` | Always the **master** address. |
| `previewOrder(o)` | market BUY: `quoteSize` / mid → base size, truncated to `szDecimals`; IOC price = mid × (1 + `env.hlSlippageBps()`/1e4) (default 100 bps) via `formatPrice(…, szDec, "spot")`; market SELL: mirror; limit: `formatPrice(limitPrice)`, `Gtc`; stop-limit (`t.trigger`) is **not** v1 → `throw new TradeVenueError("Stop-limit orders aren't available on Hyperliquid here — use a limit order.", 400, "unsupported_type")` | Preview = `{ estimatedPrice, estimatedFill, fee, slippage: bps, total, currency: "USDC", raw: { assetId, coin, szDecimals, px, sz, tif, network, expiresAtMs, builder? } }`. `fee = Number(feeSchedule.spotCross) × notional` from `userFees({ user: master })` (`spotAdd` for a resting Gtc limit); `builder.f / 1e5 × notional` is a **separate card line**. `expiresAtMs = Date.now() + PREVIEW_TOKEN_TTL_MS` is the **venue's copy of the token TTL**: `TradePreview` carries no `expiresAt` (venue.ts:28-38), and `previewOrder` runs a few ms before `createPreviewToken` mints the token's own `expiresAtMs` (service.ts:168-169), so the copy never outlives the token. `raw` keys are spread top-level into `trade_orders.preview` beside the signed token (service.ts:187), so they must never be named `token` or `estimated`. Reject notional < 10 USDC with the exchange's own words. |
| `createOrder(o, clientOrderId, preview?)` | Requires `preview.raw.{assetId,coin,szDecimals,px,sz,tif,expiresAtMs}` → else `throw new TradeVenueError("This order has no priced preview — ask again.", 400, "bad_preview")`; asserts `10000 ≤ assetId < 100000` and `assetId − 10000 === ` the `universe` index resolved by `coin` on a fresh `spotMeta` (mismatch → the same `bad_preview`, nothing was sent); `exchange.order({ orders: [{ a: assetId, b, p: px, s: sz, r: false, t: { limit: { tif } }, c: cloid }], grouping: "na", builder? })` with `expiresAfter = raw.expiresAtMs` on every order and `cloid = "0x" + clientOrderId.replace(/-/g, "")` | `expiresAfter` is the exchange-side backstop; the authoritative expiry is `verifyPreviewToken` in the resolver before the claim (T2, service.ts:489) — SC 22's `Date.parse(preview.expiresAt)` has no field to read, so the stored `raw.expiresAtMs` (≤ the token's, see `previewOrder`) is what every order carries. The SDK **throws** `ApiRequestError` whenever any `statuses[i]` carries `error` — catch → `throw new TradeVenueError(err.message.slice(0, 300), 400, "order_rejected")` (mirrors coinbase.ts:406-420) → the resolver records `rejected`. Let `TransportError` (incl. `HttpRequestError`, the 10 s default timeout) propagate: the resolver maps every non-`TradeVenueError` to terminal `uncertain` with `error_code: "submit_unknown"`, and a `TradeVenueError` with `status ≥ 500` to `uncertain` under its own `code` (service.ts:544-550); **never return a result on a timeout**. Success: `statuses[0]` `{ filled: { totalSz, avgPx } }` → `{ orderId: cloid, status: "filled", filledSize: totalSz, averagePrice: avgPx, filledValue: totalSz × avgPx, fee: null, raw }`; `{ resting: { oid } }` → `{ orderId: cloid, status: "submitted", … }`. `orderId` MUST be the cloid (stored as `venue_order_id`, service.ts:513; it is what `getOrder`/`cancelOrders` receive and what the receipt line shows, §5.6). The row is recorded `submitted` regardless of `status` (service.ts:507-508); `reconcileTradeOrders` flips it. Nonce = `Date.now()` via the SDK's nonce manager; one `ExchangeClient` per resolver call, no shared mutable state across users. |
| `listOrders(scope, limit)` | `frontendOpenOrders({ user: master })` (open) / `historicalOrders({ user: master })` (recent) → `TradeOrderRecord` with the normalized `status` below; `orderId` = `cloid` when present, else `String(oid)` | `/trade cancel last` and `/trade orders` work unchanged. |
| `getOrder(id)` | `orderStatus({ user: master, oid })` — `id` is a cloid (`0x` + 32 hex) or a numeric oid string; by **cloid** after a submit, so reconciliation never needs the oid | Normalize to what `venueStateToOurs` (service.ts:646-658) understands: `filled → FILLED`; `canceled \| marginCanceled \| *Canceled → CANCELLED`; `rejected \| *Rejected` (`tickRejected`, `minTradeNtlRejected`, `insufficientSpotBalanceRejected`, …) `→ FAILED`; `open \| triggered → OPEN`. `{ status: "unknownOid" }` → `throw new TradeVenueError("Hyperliquid has no order with that id.", 404, "not_found")` so reconcile leaves the row alone. |
| `cancelOrders(ids)` | per id: `orderStatus` → `order.coin` → asset id by name; `cancelByCloid({ cancels: [{ asset, cloid }] })`; `cancelled` = the ids whose `statuses[i] === "success"` | `trade_cancel` decision as today; `resolveTradeCancel` requires the id in `cancelled` (service.ts:625-632). |

Formatting (`format.ts`) is a pure module with tests pinned to the rules: price ≤ 5
significant figures **and** ≤ `8 − szDecimals` decimals (spot), integers always valid;
size truncated to `szDecimals`, never `"0"`; decimal strings with no trailing zeros;
hex lowercase; optional fields omitted, never `null`.

### 5.4 `lib/trade/prices.ts` — the `PublicPrices` seam (paper on HL prices) — W1a

`previewTrade` calls `venue.getProduct` + `assertTradableSpotProduct` **before**
`previewOrder` (service.ts:166-168), and paper's `getProduct`/`listProducts` are
`coinbasePublicProduct(s)` today (paper.ts:88-95) — a price-only seam is not enough; a
paper `HYPE-USDC` 404s at Coinbase before any price is read. So the seam owns product
resolution too:

```ts
export interface PublicPrices {
  price(productId: string): Promise<string | null>;
  changePct(productId: string): Promise<number | null>;
  candles(productId: string, seconds: number): Promise<[number, number][]>;   // [startSec, close][] ascending
  product(productId: string): Promise<TradeProduct>;
  products(query: string, limit: number): Promise<TradeProduct[]>;
}
export const coinbasePublicPrices: PublicPrices;                 // W0: wraps coinbase.ts:219-295
export function hyperliquidPublicPrices(network): PublicPrices;  // W1a: allMids + spotMetaAndAssetCtxs (+ candleSnapshot, W1b), no key
export async function publicPricesFor(supabase, userId): Promise<PublicPrices>;
```

- `hyperliquidPublicPrices` resolves `HYPE-USDC` → `HYPE/USDC` → `@n` from `spotMeta`
  **before** indexing `allMids` (keys are `@n` / `PURR/USDC`, never `BASE-QUOTE`);
  `changePct` from ctx `prevDayPx` vs mid; `product`/`products` share `format.ts` with
  the venue. W1a ships `candles()` as `[]` for HL; W1b fills it (§5.5).
- `publicPricesFor` picks HL when the active connection's `provider` is `hyperliquid`
  (whatever the `mode`), else per product: a `-USDC` pair that mainnet `spotMeta` lists
  → HL, otherwise Coinbase. This deliberately **refines** SC 24's bare `-USDC → HL`
  rule: Coinbase also lists `ETH-USDC`, and a blind quote rule would reprice
  Coinbase/paper-on-Coinbase pairs from HL. The cost is one mainnet `spotMeta` read per
  non-HL lookup — memoize the listing for the request (per `publicPricesFor` call),
  never across runs (§5.3 label rule). Paper prices always come from **mainnet**
  `allMids` regardless of the connection's network.
- Consumers — `paperVenue(supabase, userId, prices)` (today `paperPrice` imports
  `coinbasePublicPrice`, paper.ts:9/70), `paperPortfolio(supabase, userId, prices)`
  (paper.ts:263), `tape.ts`, `watch.ts`, `portfolioView` — use it for **product and
  price** lookup, never `coinbasePublic*` directly (a grep test over `lib/trade/**`
  excluding `coinbase.ts`/`prices.ts`). `tape.test.ts` moves its mock from `./coinbase`
  (tape.test.ts:16-24) to `./prices`.
- Paper rows get `venue='paper'`, `venue_meta.pricedBy: 'hyperliquid' | 'coinbase'`.

### 5.5 Tape + watch — W1a product ids, W1b candles and tick

- `tape.ts` (W1a): product ids come from the active venue's quote — `-USD` for Coinbase
  and paper-on-Coinbase, `-USDC` for Hyperliquid (quote follows the active provider,
  not the mode). `tapeMarkets` builds `${symbol}-${quote}` (today `-USD`, tape.ts:330;
  `TAPE_DEFAULT_MARKETS` stay symbols); `tapeIntent` validates with the shared
  `productIdSchema` regex instead of its own `-USD` regex (tape.ts:362) — W1a first
  **exports** `productIdSchema` from `order.ts` (today a module-private `const`,
  order.ts:29-36; the module's export list has no regex); `tapeState` and the DOWN path
  (tape.ts:230-232, 402) read price, 24h change and candles through `publicPricesFor`.
  Cash stays `USD|USDC|USDT`.
- HL candles (W1b): `candleSnapshot({ coin: spotName, interval: "1m", startTime:
  Date.now() − TAPE_CANDLE_SECONDS * 1000 })` (tape.ts:35 = 90 min) →
  `[Math.floor(c.t / 1000), Number(c.c)]` pairs ascending — the `[startSec, close][]`
  shape `coinbasePublicCandles` returns. **No cache** — fetch per poll with
  `.catch(() => [])`; there is no candle cache today (`snapshot.json` is the 7-day
  portfolio sparkline, and reading a box doc wakes the box).
- `watch.ts`: `addWatch` builds the product id through the seam's quote (today
  `${symbol}-USD`, watch.ts:55) (W1a); `tickWatchlists` calls `publicPricesFor` once per
  awake box and prices each armed product through it (today `coinbasePublicPrice`,
  watch.ts:121) (W1b). Runs on the existing `/api/cron/trade` tick, which is guarded by
  `requireCron` (not "public, no key"); alerts only — the cron never imports a
  `propose*`/`preview*` function (§2 WF8).

### 5.6 `service.ts`: venue selection, resolver, reconciliation — W0 + W1a

- `getTradeConnection(supabase, userId)` (**W0**, R7): selects the row where
  `active = true` (0141 backfills `true`) and surfaces the query error instead of
  discarding it — today `.eq("user_id").maybeSingle()` (coinbase.ts:502-509) errors on
  a second row, returns `null`, and `tradeMode` silently falls to paper. `tradeMode` is
  unchanged. W1a widens the row type/select list (§5.1) and keeps W0's test green; it
  does not re-own the lookup.
- `venueFor` switches on `connection.provider`: `'coinbase'` →
  `coinbaseVenue(await tradeVenueCredentials(connection))`; `'hyperliquid'` →
  `hyperliquidVenue(await hyperliquidCredentials(connection), connection.network)`;
  paper → `paperVenue(supabase, userId, await publicPricesFor(supabase, userId))`.
  `key_unreadable` names the provider (today "Your Coinbase key…", service.ts:128).
- Provider literal sites — SC 20/R11 count five (`service.ts:799, 875, 913, 938, 999`);
  **four** take the active row's `provider` instead of the literal `'coinbase'`:
  `disconnectCoinbase` (:875), `setTradeMode` (:913), `updateTradeCaps` (:938),
  `resolveTradeSettings` (:999) (caps live on the provider row, so a raise applies to
  the active venue). The fifth, `connectCoinbase` (:799), **keeps its literal** — it is
  the upsert that creates the Coinbase row (service.ts:796-811), so a provider
  parameter there is meaningless; instead it gains the §5.2 ordering (deactivate the
  `hyperliquid` row, then upsert with `active = true`). This is a stated deviation from
  SC 20's wording, not an omission. `connectHyperliquid` is its sibling (§5.2).
- `previewTrade` stamps `venue` (`'paper'` | the active provider) and
  `venue_meta.pricedBy` at the insert (service.ts:173) in **W0** (only the Coinbase and
  paper venues exist then, so `pricedBy` is `'coinbase'`); **W1a** fills the HL keys
  `venue_meta.{ assetId, coin, szDecimals, network }` from `preview.raw` when the venue
  is `hyperliquid`, and `pricedBy: 'hyperliquid'` for paper priced from `allMids`.
- `createOrder(order, clientOrderId, preview?)` in `venue.ts:69`; Coinbase and paper
  ignore the third argument. `resolveTradeOrder` (service.ts:506) passes
  `order.preview?.estimated` (as `TradePreview | undefined`) so the approved and the
  submitted HL order are byte-identical (WF6) — today the preview never reaches the
  venue and HL would re-price at submit.
- `resolveTradeOrder` keeps its preflight → token verify (T2) → T4 → caps (T6) → CAS
  claim → one `createOrder` shape; after `venueFor` it refuses
  `TradeError(…, 409, "venue_changed")` when `order.venue !== 'paper'` and differs from
  the active provider, or when a live row's `venue_meta.network` differs from
  `connection.network` — thrown before the claim, so the approval survives.
  `resolveTradeCancel` and `reconcileTradeOrders` bind the same way; rows whose
  `venue` is not the active provider are left untouched (the next sweep after a
  reconnect reconciles them). Copy drops Coinbase: "Placed at the venue" (:536), "The
  venue didn't confirm the order — it's marked uncertain and will NOT be retried"
  (:562), "The venue didn't confirm the cancel" (:628).
- Receipt line (the §17 rule, R4): after a fill the approval card, the `/trade orders`
  line and the iMessage reply end on `✓ <side> <size> <product> on Hyperliquid
  <network> · <cloid>` — the ref is the **cloid** (`venue_order_id`), and the only link
  is the **master address's page on the HyperCore explorer**
  (`https://app.hyperliquid[-testnet].xyz/explorer` is verified, notes §1; the
  `/address/<master>` path is [docs, unverified] — fall back to the explorer root if it
  404s at rehearsal). `order` returns no tx hash, so an HL receipt never carries a tx
  link; `explorerLink` stays reserved for rails with a verified tx URL.
- Reconciliation: after `submitted`, `reconcileTradeOrders` polls `getOrder(cloid)`;
  the normalized status maps to `filled | cancelled | rejected` through
  `venueStateToOurs`. `unknownOid` is a 404 the sweep catches (row untouched). The
  10-minute grace (service.ts:675-691) applies only to rows stuck at `submitting`
  with no venue id → terminal `uncertain` (C23). `uncertain` is terminal: no
  `uncertain → rejected` transition, never resubmitted, never flipped by a sweep.
- `portfolioView` counts `USD|USDC|USDT` as cash (reuse `STABLE`, service.ts:1019;
  today cash reads only `asset === "USD"` so an HL account shows null cash) and prices
  holdings through `publicPricesFor` (quote from the venue, `-USDC` on HL). The
  `/trade portfolio` line (imessage.ts:110) and the chips name the provider:
  `hyperliquid · testnet` / `coinbase · live` / `paper · HL prices`.
- Copy rules (§2 WF9, T9): "estimated", "IOC at …", never "market"; the
  `not_found` product message names the venue.

### 5.7 Key blast radius — by construction (W1a)

- `hyperliquid/client.ts` exposes exactly `order` and `cancelByCloid` from
  `ExchangeClient`, plus Info reads (`spotMeta`, `spotMetaAndAssetCtxs`,
  `spotClearinghouseState`, `allMids`, `candleSnapshot`, `frontendOpenOrders`,
  `historicalOrders`, `orderStatus`, `userRole`, `extraAgents`, `userFees`,
  `maxBuilderFee`). `client.test.ts` greps `lib/trade/hyperliquid/**` and fails on
  any other `ExchangeClient` method name (`usdSend`, `spotSend`, `withdraw3`,
  `sendAsset`, `agentSendAsset`, `usdClassTransfer`, `approveAgent`,
  `approveBuilderFee`, `vaultTransfer`, `createSubAccount`, `subAccountTransfer`,
  `modify`, `batchModify`, `twapOrder`, `scheduleCancel`, `evmUserModify`, …). The
  exchange already forbids an agent key from withdrawing or sending to other
  addresses; Air's own signing code can additionally only produce spot order/cancel
  actions.
- `createOrder` asserts `10000 ≤ assetId < 100000` (spot only — excludes perps
  `< 10000`, HIP-3 dexes `≥ 100000`, HIP-4 outcomes `≥ 100000000`), that
  `assetId − 10000` is the `spotMeta.universe` index resolved by name on a fresh read,
  `t.limit` only (never `t.trigger`), `r: false`, `grouping: "na"`, no `vaultAddress`.
- Every order sets `expiresAfter = raw.expiresAtMs` (per call or `defaultExpiresAfter`
  on the per-call `ExchangeClient`), folded into the L1 hash — the exchange itself
  refuses a submit after the preview's life; the token check in the resolver (T2) is
  the authoritative gate, this is the backstop (§5.3).
- Agent expiry: `agent_valid_until` (0141, §4.2) from
  `extraAgents.validUntil` is display + copy only (chip, "re-approve" hint); no cron
  flips a connection.
- Hosts: `api.hyperliquid.xyz` / `api.hyperliquid-testnet.xyz` via the SDK's
  `isTestnet` switch, equal to the registry's hyperliquid row (C5, §5.1) and asserted
  by the §14 fetch-target grep test. The sealed key never reaches the Box, the browser
  or a log (§2 WF3; `expectLog` for the client module, §4.4).

### 5.8 Acceptance (§12 W1)

- **W1a unit (colocated Vitest, no network):** `format.test.ts` — price/size rules
  incl. 5 sig figs + `8 − szDecimals`, `"0"` refused, cloid from uuid, lowercase,
  `@n`/`PURR/USDC` resolution, USDC by name. `venue.test.ts` on recorded fixtures —
  filled, resting, `order()` rejecting with `ApiRequestError` whose message carries the
  per-order error → `order_rejected` (400), `TransportError` propagates (and the
  resolver test records terminal `uncertain`, `error_code: "submit_unknown"`), missing
  or mismatched preview → `bad_preview`, `expiresAfter === raw.expiresAtMs` on every
  order, `getOrder` normalization on a recorded `orderStatus` fixture (`canceled` →
  CANCELLED, `rejected` → FAILED, `unknownOid` → 404). `client.test.ts` grep guard.
  `prices.test.ts` — `publicPricesFor` picks HL by provider and by a `-USDC` pair that
  `spotMeta` lists (`ETH-USDC` stays Coinbase); `HYPE-USDC` → `@n` before `allMids`.
  `service.test.ts` — `venueFor` switches on `provider`; W0's `getTradeConnection`
  active-row/error test stays green; `createOrder` receives the stored preview; 409
  `venue_changed`; double-approve → one submit (CAS). `imessage.test.ts` — `/trade
  connect hyperliquid` routes to the settings card with the venue in the subcaption.
  `tape.test.ts` on the seam mock; a paper preview of `HYPE-USDC` prices from
  `allMids`. Coverage floors per §4.4.
- **W1b:** Settings picker/connect form (write-only, owner-only; the key never renders
  back; the Coinbase→HL switch deactivates then upserts, no 23505); candles from a recorded
  `candleSnapshot` fixture in the `[startSec, close][]` shape; `tickWatchlists` on an
  HL fixture.
- **Manual gate (W1b, before any HL live)** with `TRADE_LIVE_ENABLED=true`,
  `HL_LIVE_ENABLED=false`, `TRADE_ALLOWLIST=<demo user>`: one $10 IOC buy of
  whichever USDC spot pair testnet `spotMeta` lists (`HYPE-USDC` if present, else
  `PURR-USDC` — never hardcode the pair or its index; testnet `@8` is KORILA/USDC,
  mainnet `@107` is HYPE/USDC) whose receipt line ends on the cloid and links the
  master's explorer page (§5.6); one cancel via each approve surface; one forced
  timeout confirming `uncertain` is terminal (C23); `builderFee` shows on the fill
  (`userFills`) when the §15.3 pre-seed was done. Owner pre-seed in §17 (API wallet,
  testnet drip, `approveAgent` from the master, `approveBuilderFee`).

---

## 6. W2 — Tempo pay rail + machine payments (1 session)

W2 ships exactly four things, on Moderato, in two halves of one session:

| # | Deliverable | Half |
|---|---|---|
| (a) | `transferWithMemo` with `feePayer: true` through the existing `run_approval → executeTransfer` lane via `tempoRail.prepare/submitSend` (§6.2) | **W2a** |
| (b) | the finalized `TransferWithMemo` receive watcher (`tick()`) + `deliverPayEvent` (§6.3) | **W2a** |
| (c) | the MPP method on the 402 gate as one header-keyed branch in `lib/payments/x402.ts` (§6.4) | **W2b** |
| (d) | one per-charge `machine_payment`, always `pending_approval`, demoed against Air's own priced mini-app on Moderato (§6.5) | **W2b** |

W2a also lands `POST /api/pay`, the pay lane's send/request arms calling `tempoRail`
(the parser and dispatch are W0), the sealed v1 signer + faucet, the pay.tsx lists and
the owner-only `tempo_address` settings view; `mppx@0.13.3` is installed in W2a but
`lib/payments/mpp.ts` and `lib/pay/machine.ts` are W2b, started in the same session
only after W2a's acceptance (§6.7) is green. Commit subjects `R-WF-02: …` (§4.4).
**Out of the window:** standing budgets / `pay_policies` semantics (the table lands
dormant in 0141), `/pay policy …`, the policies tab and `client.accessKey.authorizeSync`
— see the ≤6-line entry in §15 (§6.5 ends with a one-line pointer).

### 6.1 Files

```
apps/web/lib/chains/tempo/client.ts     tempoClient(network, account?) → createClient({ chain: tempo|tempoModerato, feeToken: OUSD, transport: withRelay(http(rpc), http(env.tempoSponsorUrl())) }); one client per call, none cached across users
apps/web/lib/chains/tempo/signer.ts     per-user signer: v1 raw secp256k1 sealed in user_chain_keys, testnet-only by construction → v1.1 access key (§6.6)
apps/web/lib/chains/tempo/read.ts       OUSD balance + recent transfers, called from lib/wallet/read.ts (§4.4 coverage lane; never inside lib/wallet/**)
apps/web/lib/pay/rails/tempo.ts         tempoRail: validateAddress / previewSend / prepare / submitSend / request / watchReceive / balance / tick (PayRail, §4.3)
apps/web/lib/pay/imessage.ts            (W0 file) + deliverPayEvent (§6.3)
apps/web/lib/pay/machine.ts             W2b: fetchChallenge() (the SSRF-guarded helper), fileMachinePayment(), resolveMachinePayment()
apps/web/lib/payments/mpp.ts            W2b: Mppx.create + the one charge call; invoked from ONE header-keyed branch in lib/payments/x402.ts
apps/web/app/api/pay/route.ts           requireBoxOrOwner → requireInteractiveRun; GET ?resource=balance|requests ; POST {action: preview|propose|request|machine}
apps/web/lib/miniapps/apps/pay.tsx      'To pay' + 'Getting paid' lists, rail chip, memo field, request QR/address, owner-only settings view (tempo_address)
infra/template/skills/pay-rails/SKILL.md (W2a), infra/template/skills/machine-pay/SKILL.md (W2b)
```

`lib/miniapps/gates.ts` is **not** edited (its header forbids changing the gate
contract); the 402 is composed inside `x402PaymentGate`. `lib/commerce/paymentRequests.ts`
keeps the Stripe/legacy-usdc payee lane; chain sends never pass through it.

Dependencies: `viem@2.57.4` is a direct `apps/web` dependency since W0 (the SDK is the
`viem/tempo` subpath; thirdweb's transitive `viem@2.39.0` lacks it — never dedupe); W2
adds `mppx@0.13.3` (import only `mppx/server` and `mppx/client`; never re-export its
zod 4 schema types); `wagmi` **not** needed (server-only). C5 hosts, from the registry
row only: `rpc.moderato.tempo.xyz`, `rpc.tempo.xyz`, `sponsor.moderato.tempo.xyz`,
`api.tempo.xyz`, `explore.testnet.tempo.xyz`, `explore.tempo.xyz`. Env: `TEMPO_LIVE_ENABLED`,
`TEMPO_SPONSOR_URL`, `TEMPO_API_KEY`, `MPP_SECRET_KEY` are `OPTIONAL_ENV` rows with
`env.<name>()` accessors (§4.4, §14); no module reads `process.env`.

`POST /api/pay` is the rail-aware superset of the Box filing arm
`POST /api/miniapps/commerce {action:'payment_request'}` (usd/usdc), which stays and
keeps delegating to `createPaymentRequest`. `requireInteractiveRun` (WF8, §4) runs after
auth for `preview|propose|request|machine`; `balance|requests` are reads. Update
`infra/template/skills/link-payments/SKILL.md` to point tempo/solana sends at `/api/pay`.

### 6.2 Send (`wallet_transfers.rail = 'tempo'`)

A chain send never creates a `payment_requests` row and never invents a second
resolver: `resolvePayment` does not exist and is not to be created. The row is a
`wallet_transfers` row, the decision is the existing `run_approval`, the executor is
`executeTransfer`.

1. **Stage.** `/pay 25 USD to 0x… on tempo memo INV-7` (deterministic parse → the pay
   lane, W0), the Pay form, or `POST /api/pay {action:'preview'|'propose'}` →
   `tempoRail.previewSend`: `validateAddress` (`getAddress`, EIP-55), amount
   `parseAssetAmount(amount, 6)`, memo ≤ 32 UTF-8 bytes → `toHex(memo, { size: 32 })`
   else 400 "memos are 32 bytes", balance `client.token.getBalance({ account, token: OUSD })`,
   `assertPayCaps` (USD), gas `client.token.transfer.estimateGas(…)` for the **real**
   recipient (a new address ≈ 300k) × `getGasPrice()` → microdollars
   `(gas·price + 10^12 − 1) / 10^12` → `fee_estimate_usd` (shown "estimated", WF9), and
   `sponsored: true` on Moderato (public relay; the sender still signs the transfer).
   `USD on tempo` resolves to OUSD inside the rail — the parser never infers a rail
   from USD (§4.3). Then `createTransferRequest(supabase, userId, { rail:'tempo',
   network, to, atomic, display, asset:'OUSD', decimals: 6, memo?, feeEstimate })` — the
   existing `lib/wallet/send.ts` path, widened in W0 — writes **one** `wallet_transfers`
   row (`rail`, `network`, `memo`, `chain_id = 42431|4217`, `token_address = OUSD`,
   `token_symbol = 'OUSD'`, `amount_wei` = the atomic string, `expires_at = now()+5 min`,
   `rail_meta`) and **one** `run_approval` decision with the value-free payload
   `{ wallet_send: true, rail, network, token, amount_display, to_hint, memo_present,
   fee_estimate_usd?, sponsored?, expires_at }` and label `Send <amount> OUSD on
   <network>`; a 23505 on `wallet_transfers_pending_rail_idx` → `WalletSendError(409)`
   naming the pending send (WF5). The card is rendered by `lib/approvals/moneyCard.ts`
   (headline `<amount> OUSD on Tempo Moderato`) on needs-panel, approve-client and
   pay.tsx alike; `deliverPayEvent` texts the owner the Pay card.
2. **Approve.** The existing `run_approval` arm (`findPendingTransfer → executeTransfer`
   in `lib/decisions/resolve.ts`) runs; tonight the Pay card's owner-only "To pay" list
   approves it via `resolveDecision` (the hosted link for chain sends is P1, §15).
   `executeTransfer` re-reads the row, refuses `expired` past `expires_at` (and
   `expired` is what it writes), keeps its CAS `pending → submitting` (0 rows → 409),
   and is split after the CAS into `rail.prepare(transfer)` — Tempo: open the sealed
   signer (§6.6), re-check balance + caps; any throw releases the claim to `pending` —
   and `rail.submitSend(prepared)` — any throw → `markSubmitUnknown` +
   `WalletSubmitUnknownError`, never released (C23). `submitSend` returns
   `{ state: 'submitted' | 'redirected' | 'failed', txRef }` and `executeTransfer`
   writes that state (plus `resolved_at`) instead of today's unconditional
   `'submitted'`. Base's `baseRail` keeps today's `users.wallet_address` read in
   `prepare` and `sendWalletTokens` in `submitSend`.
3. **Submit.** `tempoRail.submitSend` = `client.token.transferSync({ token: OUSD, to,
   amount, memo, feePayer: true, nonceKey: 'expiring' })` →

   | receipt | `wallet_transfers` | `transaction_id` |
   |---|---|---|
   | `status === 'success'` and a `Transfer` log (`parseEventLogs`, `Abis.tip20`, logs filtered to OUSD) **to our recipient** | `submitted` | `${chainId}:${hash}:${logIndex}` of that log |
   | `status === 'success'`, no matching log (a receive policy sent it to `ReceivePolicyGuard` `0xB10C…`) | `redirected` — surfaced as "delivered to the recipient's guard, not their balance"; never retried | `${chainId}:${hash}` |
   | mined with `status !== 'success'` (reverted — a certain non-delivery) | `failed` (already in `wallet_transfers_status_check`, 0046; surfaced as "the send failed — nothing moved") | `${chainId}:${hash}` |
   | any throw | `submit_unknown` (the existing C23 terminal via `markSubmitUnknown`; surfaced as "uncertain" — never write `uncertain` here) | hash if known |
   | timeout | one `getTransactionReceipt(hash)` lookup: a receipt lands in the rows above, still `null` → `submit_unknown` | hash |

   Expiring nonces (`validBefore ≤ now + 300 s`) mean no nonce bookkeeping. Tempo has no
   provider-side idempotency key — `transferIdempotencyKey` is thirdweb-only — so the
   CAS is the sole double-send guard. Receipt line: `✓ Sent <amount> OUSD on Tempo
   <network> · explorerLink('tempo', hash)` (`explore[.testnet].tempo.xyz/tx/<hash>` is
   a verified explorer URL).
4. **Sweep.** `tempoRail.tick()` on `/api/cron/pay-rails` flips `pending` past
   `expires_at` → `expired` and nothing else on this table (WF8: read, reconcile,
   expire, notify).

`TEMPO_LIVE_ENABLED` is necessary but not sufficient for mainnet: a raw signer never
opens on mainnet (§6.6), so until v1.1 every send is Moderato.

### 6.3 Receive (`/pay request <amt> USD on tempo [memo <text>]`)

Row: `payment_requests` with `direction='receive'`, `currency='ousd'`, `rail='tempo'`,
`network`, `receive_address` = `users.tempo_address` when the owner has entered one
(0141: the owner-entered receive + payTo address, the same one MPP pays to), else —
testnet only — the user's signer address from `user_chain_keys` (what `/pay tempo
address` prints, and what the rehearsal's second funded payer pays into), `reference` =
the memo text (typed, else a generated opaque `INV-<6>`), `memo_bytes32 =
toHex(reference, { size: 32 })`, `expires_at` 24 h.
Status stays on the existing list `pending → paid | expired`; several receive requests
may be pending at once (no one-pending index on `payment_requests`). No decision —
nothing moves (WF1 governs mutations); from the Box (`POST /api/pay {action:'request'}`)
`requireInteractiveRun` still applies.

Card: **always** address + memo + amount as text, plus a QR via a new `qrDataUrl(text)`
beside `addressQrDataUrl` in `lib/wallet/qr.ts` (`qrcode` is already a dependency)
encoding the best-effort EIP-681-style
`ethereum:<OUSD>@<chainId>/transferWithMemo?address=<to>&uint256=<amt>&bytes32=<memo>`
— no Tempo wallet is documented to parse it, so the text is the contract.

`tick()`: for each open request, `client.getContractEvents({ address: OUSD, abi:
Abis.tip20, eventName: 'TransferWithMemo', args: { to, memo }, fromBlock, toBlock:
finalized })` (the memo topic is indexed; `fromBlock` = the finalized head at
`created_at`, re-read with overlap — the unique `tx_ref` index absorbs re-reads) →
match token + recipient + memo + `amount ≥ requested` → one update setting `paid`,
`tx_ref = chainId:hash:logIndex`, `paid_amount`, guarded by `payment_requests_tx_ref_idx`
(23505 = already counted) → `deliverPayEvent`. Past `expires_at` → `expired`. Optional:
Tempo REST `getAddressActivities?type=transfer` as a cheaper poll; the finalized log is
the source of truth either way, and a tx hash or memo match alone never flips `paid`.

Owner line: new `lib/pay/imessage.ts deliverPayEvent(supabase, userId, requestId,
summary, sharedSender?)` copied from `deliverTradeApproval` (`lib/trade/imessage.ts:61-99`):
read `imessage_destinations(space_id, phone)` → `sendMiniAppCard(supabase, spaceId,
phone, userId, 'pay', requestId, { subcaption: summary, summary })` with the
`sender.sendText` fallback; called from `tick()` (`paid` / `expired` on
`payment_requests` only), from the stage step (the Pay card) and from the `run_approval`
resolver right after `executeTransfer` returns — the receipt line, or the `redirected`
notice (§6.2 step 3; `redirected` is a `wallet_transfers` outcome written at approval
time, never by `tick()`). There is no existing pay notifier to reuse.

pay.tsx shows two owner-only lists: **To pay** — pending `wallet_transfers` with
Approve / Deny, both via `resolveDecision(…, 'approve' | 'dismiss')` on the linked
`run_approval` (the existing dismiss arm already calls `denyTransfer` and then closes
the decision, `lib/decisions/resolve.ts`; calling `denyTransfer` directly would leave
the decision pending in Needs-you) — and **Getting paid** — `direction='receive'`
requests with address, memo, QR, amount and `open | paid | expired`; a rail chip
(`tempo · moderato`) and the memo field on the send form.

### 6.4 MPP on the mini-app gate (seller) — W2b

`lib/payments/mpp.ts` — manual `mppx/server` API, one factory so tests inject a fake
the way `setFacilitatorForTests` does:

```ts
const mppx = Mppx.create({ realm: externalOrigin(request), methods: [tempo({
  currency: OUSD, recipient: publisherTempoAddress, testnet: !chainFor("tempo").liveEnabled() })] });
const result = await mppx.charge({ amount: String(app.x402_price_usdc) })(request);  // decimal string in OUSD units; 402 → result.challenge
```

**No `feePayer` on any network** — Air never holds a local fee-payer key an anonymous
402 client could drain; pull-mode clients sign a self-paying TIP-20 transfer that the
server broadcasts. `TEMPO_SPONSOR_URL` is used only for Air's own sends (§6.2).
`MPP_SECRET_KEY` is mppx's challenge-signing secret, not a chain key.

The branch lands in `lib/payments/x402.ts` as **one** call site keyed on header
presence; gate order unchanged (visibility → password → pay → session); no `gate.ts` /
`PaymentMethod` refactor on the critical path:

- `Authorization: Payment …` → `lib/payments/mpp.ts`; `X-PAYMENT` → today's path
  untouched (`x402.test.ts` stays the Base regression oracle).
- neither → one `402` carrying the x402 JSON body (`accepts`: Base today, Solana entry in
  W3b) **and** the MPP `WWW-Authenticate: Payment …` header from `result.challenge`.
  Build the two independently: the existing `accepts: []` early return must not
  suppress MPP when only the Base payTo is missing, and a 402 with `accepts: []` plus
  an MPP challenge is valid.
- `Authorization: Payment …` with `result.status !== 402` ⇒ verified + settled by mppx
  → insert `x402_receipts { jti: tx hash (pull/push) or sha256(credential), app_id,
  payer_address, amount_usdc: Number(app.x402_price_usdc) (the column is USDC-named;
  store the USD amount), tx_hash: reference, protocol:'mpp', network:
  chainFor('tempo').caip2 ('eip155:42431' on Moderato) }` **before** the session; the
  `jti` primary key is the replay guard (23505 after settlement → 402 "already
  redeemed", never a session — WF4) → mint the paid session (`x402:<payer>`) →
  `result.withReceipt(response)` (`Payment-Receipt`).

Publisher payout: `users.tempo_address`, owner-entered on the Pay card's **new**
owner-only settings view (pay.tsx has none today), EIP-55 checksum-validated
(`getAddress`), read at challenge time by `publisherPayTo`, which widens to return
`{ base, solana, tempo }` each-or-null (the Base payTo never depends on the new columns).
No on-chain verification is claimed (`wallet_address` is thirdweb-issued at signup, not
owner-entered — the analogy does not hold). Absent → the MPP method is omitted; never
invent a recipient (MA6). **§15.8 is closed:** option (a); an Air-managed recipient was
rejected under MA6 ("the platform never custodies gate revenue").

Pay page: today's single Air-wallet instruction stays the one primary CTA; the MPP line
(and W3b's Solana line) sit under "Other wallets" only when the publisher has the
matching address.

Demo (§0.1 #3): `npx mppx <mini-app url>` with a Moderato-funded payer and
`testnet: true` on both sides opens a paid session; `npx mppx --inspect <url>` prints the
challenge. The CLI's testnet switch is unverified — fall back to the `mppx/client`
snippet (`Mppx.create({ methods: [tempo({ account })] })` with `testnet: true`) if the
CLI pays mainnet.

### 6.5 The agent as buyer (`machine_payment`) — W2b

Box route `POST /api/pay {action:'machine', url, method, body?}` (`requireBoxOrOwner` →
`requireInteractiveRun`): the control plane fetches the URL **without paying** through
the one fetch helper in `lib/pay/machine.ts`, which reuses `isPublicAddress` /
`resolvesOnlyPublicAddresses` from `lib/kernel/purchases.ts` (already exported — import,
never re-implement; the only new code is the helper itself: manual redirect, denylist,
10 s, ≤ 1 MB): https only; DNS validated immediately before each request;
`redirect:'manual'`, any 3xx = `failed`; denylist `app.wzrd.tech`, `mini.wzrd.tech`,
`*.on.ascii.dev`, the Supabase project host; 10 s timeout; body ≤ 1 MB; the body reaches
the Box via `writeFile` only for the paid request; one colocated test per rejection; the
helper is named in §2's C5 row and exempted in §14's fetch-target grep test. It parses
the challenge (x402 `accepts[]` or MPP `WWW-Authenticate: Payment`), picks the rail Air
can pay (`tempo` for MPP tonight; the `base`/`solana` x402 buyer arms are W3b), normalizes
`{ protocol, rail, network, amount, asset, recipient, realm, url, method }`, stores
`challenge_fingerprint` = sha256 of that tuple, runs `assertPayCaps`, and writes
`machine_payments(previewed → pending_approval)` + a `machine_payment` decision whose
payload is value-free (`{ protocol, rail, network, amount_display, asset, host,
recipient_hint }`). **Every charge lands `pending_approval`.** There is no auto-pay
branch and this route never writes `paying` (WF1/WF8). A second pending charge → 409
(`machine_payments_pending_idx`, WF5).

Resolver `resolveMachinePayment` (the W2b PR adds the two resolver arms — the
`resolve.ts` arm and the `resolveHostedDecision` arm in `hosted.ts` — beside W0's
`HOSTED_KINDS` entry, `loadHostedApproval` view, approve-client union and needs-panel
label, with a test that the kind resolves through both chains): CAS `pending_approval →
paying`; re-fetch the challenge through the same helper — it must match the stored
fingerprint (same amount/asset/recipient/realm) else `expired` with "the price changed"
(WF6); re-check caps; create the credential with `mppx/client` (`Mppx.create({ polyfill:
false, methods: [tempo({ account })] })` → `mppx.createCredential(response, { account })`)
using the user's Tempo signer opened inside the resolver only (§6.6); make the paid
request (`Authorization: <credential>`) through the helper; store the response body in
the Box at `.hermes/miniapps/pay/machine/<id>.json` via `writeFile` (C4 — the body is the
user's content); write `receipt` (`Receipt.fromResponse`), `tx_ref` = its reference,
`resolved_by = 'owner'`, state `paid`; the `machine-pay` skill reads that file. Any
failure after credential creation → `uncertain`, never retried (C23). Deny → `denied`;
the cron expires `pending_approval` rows past `created_at + 15 min` (no `expires_at`
column — 0141 is final as §4.2 spells it; the resolver's fingerprint re-fetch already
rejects a stale price, WF6). Demo target: Air's own priced mini-app on Moderato
(`testnet: true` both sides) — the agent meets the 402, files the card, the owner
approves, the paid body lands in the Box.

Standing budgets / `pay_policies` / `client.accessKey.authorizeSync`: post-hackathon, with
the v1.1 access-key signer — the ≤6-line entry is in §15. Raising a pay cap is a
`trade_settings` decision with `payload.lane:'pay'` (WF7) — no golden path raises one, so
it is implemented outside the slice.

### 6.6 Signer model

- **v1 (W2a, testnet only, by construction):** per-user secp256k1 key generated
  server-side (`generatePrivateKey()`), sealed with `sealSecret` under
  `env.providerVaultKey()` in `user_chain_keys (user_id, rail='tempo',
  network='testnet', kind='raw_secp256k1', address, secret_sealed, key_hint)` — the
  0141 check `kind <> 'raw_secp256k1' or network = 'testnet'` makes a mainnet raw key
  unrepresentable, and `lib/chains/tempo/signer.ts` additionally refuses to open a
  `raw_secp256k1` row whenever `chainFor('tempo').network === 'mainnet'` regardless of
  `TEMPO_LIVE_ENABLED` (unit test). Created lazily on the first `/pay tempo balance` /
  `/pay tempo address`, funded by `client.faucet.fundSync({ account })` on Moderato;
  opened only inside `tempoRail.prepare/submitSend` and `resolveMachinePayment` (WF3:
  never the Box, never the browser, never a log; hint = last 4). This is a custody shape
  Air does not have today (Air holds raw key material) — acceptable on testnet;
  **mainnet is blocked until v1.1** (§15.4).
- **v1.1 (before any mainnet send, not in the window):** the user's **Tempo Wallet**
  (passkey) is the root; Air holds only an **access key** (`kind='access_p256'`) the
  user authorized with limits/expiry/scopes (Tempo's documented agent model).
  Onboarding on the mini origin with the Accounts SDK `Provider.create` +
  `client.accessKey.authorizeSync` signed in the browser; Air stores the access key
  sealed. Air's caps and the on-chain limits are kept equal by the resolver.
- Fee sponsorship on mainnet (§15.9): the public relay is Moderato-only; mainnet needs
  `TEMPO_SPONSOR_URL=https://api.tempo.xyz/rpc/sponsor?key=tempo:sk:…`. Ship sponsored
  sends on Moderato.

### 6.7 Acceptance (§12 W2)

Standard gate §12 + §4.4 (typecheck, lint, `npm test`, build, coverage floors,
`expectLog`, commit `R-WF-02:`). W2-specific:

| Layer | What must pass |
|---|---|
| Unit (colocated, recorded responses, no network) | `pay/rails/tempo.test.ts`: memo encoding (≤ 32 bytes, 33 → 400), fee estimate from recorded gas/price, `submitSend` → `submitted` with `chainId:hash:logIndex`, success-without-log → `redirected`, reverted receipt → `failed`, throw/timeout → `submit_unknown`, `expired` refused before the CAS, `tx_ref` dedupe marks paid once; `chains/tempo/signer.test.ts`: a `raw_secp256k1` row never opens on mainnet; `payments/mpp.test.ts` (W2b, injected `Mppx`): the 402 carries both challenges, receipt before session, 23505 → 402, MPP omitted without `tempo_address`, Base `accepts` unchanged; `pay/machine.test.ts` (W2b): challenge normalization x402/MPP, fingerprint mismatch → `expired`, one case per fetch rejection, every charge → `pending_approval` |
| Resolver / integration | the `run_approval` arm reaches `tempoRail.submitSend` through `executeTransfer`'s CAS (double-approve → one submit, second → 409); `resolveMachinePayment` resolves through both `resolve.ts` and `hosted.ts` and stores the body in the Box; `tick()` flips the mirror request `paid` once |
| Manual gate (Moderato, before any `TEMPO_LIVE_ENABLED`) | faucet → `/pay 1 USD to 0x… on tempo memo INV-1` sponsored → explorer link in chat → the watcher marks `/pay request 1 USD on tempo memo INV-2` paid and texts the owner; W2b: `npx mppx <mini-app url>` opens a paid session with `protocol='mpp'`; `npx mppx --inspect` shows the challenge; one machine charge against Air's own priced app lands as a card and pays on approval |

---

## 7. W3 — Solana pay rail: wallet, Solana Pay, x402 (1 session)

Two halves, built in this order (R13, §13): **W3a** — Solana Pay receive + the Wallet-tab read against an owner-pasted `users.solana_address`; depends on W0 only; no `@coinbase/cdp-sdk`, no `@solana/pay`. **W3b** — Solana as a second v1 `accepts` entry, the x402 buyer arm, the CDP send account and USDC sends as v0 through the `executeTransfer` lane; depends on W0 + W2b. Only the sends and the CDP-backed buyer signer depend on `CDP_WALLET_SECRET`: if it is not provisioned before the session starts, the §7.3 send rows and the §7.5 buyer arm move under "What we document but do not ship yet" (solana.md convention), while the `accepts` entry (seller side: `users.solana_address` + the facilitator, no CDP), its `x402.test.ts` additions and `scripts/x402-solana-pay.ts` (a Circle-faucet devnet keypair, not CDP) still ship. W3a is the visible Solana beat (Phantom scans a QR, the request flips to paid); W3b sits behind it. Nothing in W3 edits `0141` — every column it reads (`users.solana_address` / `solana_cdp_address` / `solana_policy_id`, `payment_requests.direction/rail/network/reference/receive_address/tx_ref/paid_amount`, `wallet_transfers.rail/network/memo/expires_at/rail_meta`, `x402_receipts.protocol/network`) lands in W0 (§4.2). Subsections keep their numbers; each heading names its half.

### 7.1 Files and dependencies

W3a (after W0):

```
apps/web/lib/chains/solana/client.ts        @solana/kit 5.5.1 createSolanaRpc / createSolanaRpcSubscriptions for chainFor("solana"); hosts from the registry (C5)
apps/web/lib/chains/solana/read.ts          SOL lamports + USDC ATA balance + last 10 signatures for one address; called from lib/wallet/read.ts (§4.4 coverage lanes)
apps/web/lib/pay/solanaPay.ts               hand-built Solana Pay transfer-request URI (~40 lines, kit only) + the parser the test round-trips through
apps/web/lib/pay/rails/solana.ts            solanaRail: validateAddress / request / watchReceive / balance / tick ; previewSend / prepare / submitSend refuse until W3b
apps/web/lib/miniapps/apps/pay.tsx          owner-only settings view takes users.solana_address (the W2a view that takes tempo_address); "Getting paid" renders the Solana Pay QR + URI
apps/web/lib/wallet/read.ts                 one import: calls chains/solana/read.ts when users.solana_address is set (no Solana logic inside lib/wallet/**)
```

W3b (after W0 + W2b; `wallet.ts`, the send half of `rails/solana.ts` and the `machine.ts` arm additionally need `CDP_WALLET_SECRET`):

```
apps/web/lib/chains/solana/wallet.ts        per-user CDP send account (@coinbase/cdp-sdk), the pre-sign decompile assertion, the only signing site
apps/web/lib/pay/rails/solana.ts            + previewSend / prepare / submitSend (v0 USDC TransferChecked through executeTransfer, §6.2)
apps/web/lib/payments/x402.ts               second v1 accepts entry (buildSolanaPaymentRequirements), payload.network branch, SVM jti, publisherPayTo widening
apps/web/lib/pay/machine.ts                 x402 buyer arm on Solana inside resolveMachinePayment (W2b owns the resolver; W3b adds the arm)
scripts/x402-solana-pay.ts                  devnet acceptance client (@x402/fetch + @x402/svm, Circle-faucet-funded keypair)
infra/template/skills/pay-rails/SKILL.md    + solana arms (W2 creates the skill)
```

Dependencies (pin exact; §4.4): `@solana/kit` stays **5.5.1** (lockfile; `@coinbase/cdp-sdk` hard-depends on `^5.5.1`, the installed `x402@1.2.0` on `^5`). W3a adds `@solana-program/token@0.9.0` (already hoisted in the lockfile, peer `kit ^5`) as a direct `apps/web` dep — the ATA derivation in `read.ts`; W3a builds no transaction. W3b adds `@solana-program/compute-budget@0.11.0` (hoisted, peer `kit ^5`) and `@solana-program/memo@0.10.0` (peer `kit ^5.0` — the last kit-^5 memo release; used only by the §7.3 send builder and the pre-sign assertion's program allowlist), `@coinbase/cdp-sdk@1.57.0` (in the lockfile today as a transitive of `@coinbase/x402`) and `@x402/core @x402/evm @x402/svm @x402/fetch@2.28.0` as `apps/web` runtime deps — the §7.5 buyer arm in `lib/pay/machine.ts` imports `@x402/svm` and `@x402/fetch`, and `@coinbase/cdp-sdk@1.57.0` peers on `@x402/{core,evm,svm,extensions} ^2.25.0` (if `npm i` asks for `@x402/extensions`, pin it to 2.28.0 too); `scripts/x402-solana-pay.ts` imports the same pins. **No `@solana/pay`** (1.0.26 peers on kit ^6.9 — unsatisfiable beside 5.5.1; its three functions are the ~40 lines in `solanaPay.ts`). **No kit 8** (a second kit major does not type-check against the program packages: `Rpc`/`Address` brands differ per major). **No `@solana/web3.js` v1 in `lib/`** (the Meteora/Squads SDKs belong only in §16's adapter module). The nested `@solana/kit@2.3.0` under the root `node_modules/x402@0.7.0` stays in the tree; never import through it.

C5 hosts (`chainFor("solana").hosts`): W3a `api.devnet.solana.com` and the Helius URL from `SOLANA_RPC_URL`; W3b adds `api.cdp.coinbase.com`, `x402.org` (testnet facilitator) and `api.developer.coinbase.com` (Onramp session tokens, optional, mainnet only). Env (§14, each an `OPTIONAL_ENV` row + lazy `env.*()` accessor, never `process.env`): `SOLANA_LIVE_ENABLED` (`false`), `SOLANA_RPC_URL`, `SOLANA_RPC_URL_DEVNET`, `SOLANA_USDC_MINT_DEVNET` (default `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`); W3b `CDP_WALLET_SECRET` (CDP server wallets need it beside `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET`, which exist). There is no `X402_SOLANA_NETWORK`.

### 7.2 Addresses: two columns, two owners (W3a column; W3b account)

| Column | Who writes it | What it is for |
|---|---|---|
| `users.solana_address` | The owner, pasted into the pay.tsx owner-only settings view (W3a); validated `^[1-9A-HJ-NP-Za-km-z]{32,44}$` and base58-decodes to 32 bytes; `/pay solana address` prints it. | Solana Pay `recipient` (§7.4) and the x402 `payTo` (§7.5). **Never an account Air's secret can sign for (MA6).** Absent → `/pay request … on solana` refuses with "paste your Solana address in Pay → Settings first" and the Solana `accepts` entry is omitted. |
| `users.solana_cdp_address` | `lib/chains/solana/wallet.ts` (W3b), lazily on the first `/pay … on solana` send preview. | The send account. `users.solana_policy_id` holds the optional CDP account-policy id. |

The two were one column in the first draft; they are different custody classes. `/pay solana balance` and the Wallet tab (§7.6) read both, labelled "Receive" and "Send".

**Send account (W3b).** `lib/chains/solana/wallet.ts` is the only file that imports `@coinbase/cdp-sdk` and the only place a Solana transaction is signed. `const cdp = new CdpClient()` reads `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` (`walletSecret`); account `cdp.solana.getOrCreateAccount({ name: userId })` (idempotent — one account per user under a double call), address stored in `users.solana_cdp_address`; devnet funding `cdp.solana.requestFaucet({ address, token: "sol" | "usdc" })` or the Circle faucet for devnet USDC; signing `cdp.solana.signTransaction({ address, transaction: <base64 unsigned wire tx> })` → `{ signedTransaction, signature /* deprecated alias */ }`; optional `cdp.solana.updateAccount({ address, update: { accountPolicy } })` → `users.solana_policy_id`. **These SDK method names and argument shapes are unverified against an installed `.d.ts`** — they are read from the 1.57.0 tarball's `_types/client/solana/solana.d.ts`; the package is not installed in the repo tree (`node_modules/@coinbase/cdp-sdk` is absent — it is in the lockfile only as a transitive of `@coinbase/x402`). Devin: confirm each name and argument shape against the installed `.d.ts` after `npm i`, before writing `wallet.ts`, and correct this paragraph, not the invariants. The key never exists outside CDP; `signMessage` is never called (grep test). `CDP_WALLET_SECRET` is a pooled operator credential, like `THIRDWEB_SECRET_KEY` on Base — §3's "pooled operator keys" non-goal means a shared on-chain wallet, which this is not — and the pre-sign assertion in §7.3 is the per-user, per-row bound. If `CDP_WALLET_SECRET` is absent the rail is read-only (balances, requests) and `previewSend` refuses with "connect a Solana wallet provider" — never a silent fallback to a raw key, never a `user_chain_keys` row for Solana.

**Mainnet funding (optional, `SOLANA_LIVE_ENABLED` only, W3b).** A Coinbase Onramp link the Wallet tab shows: `POST https://api.developer.coinbase.com/onramp/v1/token` with `Authorization: Bearer <generateJwt(...)>` (`@coinbase/cdp-sdk/auth`, CDP secret key — client keys do not work for Onramp REST), body `{ addresses: [{ address: users.solana_address, blockchains: ["solana"] }], assets: ["USDC"], clientIp }` (`clientIp` required — the request's socket IP, not `X-Forwarded-For`); single-use, 5 minutes; hosted URL `https://pay.coinbase.com/buy/select-asset?sessionToken=…&defaultAsset=USDC&defaultNetwork=solana&partnerUserRef=<userId>`. A link, never an automated purchase.

### 7.3 Send (W3b) — one `wallet_transfers` row, one v0 transaction

**Preview.** `/pay 12 USDC to <addr> on solana` (parser §4.3), the Pay form, or the Box via `POST /api/pay {action:"preview"|"propose"}` behind `requireInteractiveRun` (§2 WF8) → `solanaRail.previewSend`: validate the address (`^[1-9A-HJ-NP-Za-km-z]{32,44}$`, 32 bytes), the amount (`parseAssetAmount(amount, 6)` from `lib/wallet/send.ts` — > 6 decimals rejected as today's lane does), balance (`getTokenAccountBalance` of the CDP account's USDC ATA), caps (`assertPayCaps`), recipient ATA existence (`fetchMaybeToken(rpc, findAssociatedTokenPda(to, mint))` — missing → the preview says "creates the recipient's USDC account, +~0.002 SOL rent" and sets `rail_meta.create_ata = true`), SOL for fees (devnet: faucet line; mainnet: "top up" line), fee estimate in USD. Then the existing lane (§6.2): `createTransferRequest(supabase, userId, { rail:"solana", network, to, atomic, display, asset:"USDC", decimals: 6, memo?, feeEstimate })` writes **one** `wallet_transfers` row (`token_symbol='USDC'`, `token_address=<mint>`, `amount_wei` = the atomic string, `chain_id` null, `network`, `memo`, `rail_meta`, `expires_at = now()+5 min`) and **one** `run_approval` decision with the value-free payload `{ wallet_send: true, rail:"solana", network, token:"USDC", amount_display, to_hint, memo_present, fee_estimate_usd, expires_at }`, label `Send 12 USDC on Solana devnet`, rendered by `lib/approvals/moneyCard.ts`. No `payment_requests` row; `resolvePayment` does not exist. A second pending Solana send → 23505 on `wallet_transfers_pending_rail_idx` → `WalletSendError(409)` naming the pending one (§2 WF5).

**Resolve.** The existing `run_approval` arm in `lib/decisions/resolve.ts` (:426–443 — the only `executeTransfer` call site, with the `WalletSubmitUnknownError` flip-before-rethrow) → `executeTransfer`. `lib/approvals/hosted.ts` has no wallet arm (`HOSTED_KINDS` is `purchase_review`/`payment_request`/`trade_*`); the hosted-link path for chain sends (`isHostedMoneyDecision`, moving the wallet arm into hosted.ts) is P1 after the slice (R8) — tonight pay.tsx's owner-only "To pay" list approves the `run_approval` via `resolveDecision`. Before the CAS the arm re-reads the row, re-checks balance and caps (§2 WF6) and refuses `expired` past `expires_at` — the row is marked `expired`, never re-claimed; the pay-rails cron sweeps `pending` past `expires_at` → `expired`. `executeTransfer` then keeps its CAS `pending → submitting` (0 rows → 409) and is split after it (§6.2):

- `solanaRail.prepare(transfer)`: fetch a fresh blockhash and build the **v0** message:

  ```
  createTransactionMessage({ version: 0 })      // kit 5.5.1: TransactionVersion = 'legacy' | 0. Explicit ComputeBudget ixs are
                                                //  no-ops on tx v1 (budget moves to message.config); CDP/wallet v1 support is unverified.
    feePayer  = users.solana_cdp_address ; lifetime = blockhash
    [ SetComputeUnitLimit,
      SetComputeUnitPrice (≤ 5_000_000 µlamports/CU = 5 lamports/CU),
      CreateAssociatedTokenIdempotent?           — only when rail_meta.create_ata
      TransferChecked(source ATA → findAssociatedTokenPda(to, mint), mint = registry USDC, amount = amount_wei, decimals = 6),
      Memo(wallet_transfers id) ]
  ```

  (`@solana-program/compute-budget`, `@solana-program/token`, `@solana-program/memo`), then `compileTransaction` → `getBase64EncodedWireTransaction`. Any throw here releases the claim back to `pending`. The memo is the `wallet_transfers` id — a send writes no `payment_requests` row, so it is the only id a send has; the user-entered `memo` arg stays on the row (`memo_present` in the payload) and never goes on-chain.
- **Pre-sign assertion** in `wallet.ts`, before anything reaches CDP: `decompileTransactionMessage` the compiled message and assert — program ids ⊆ {ComputeBudget, AssociatedToken, Token, Memo} (no top-level System instruction); exactly one `TransferChecked`, with `mint` = registry USDC, `amount` = the row's `amount_wei`, destination = `findAssociatedTokenPda(to, mint)`; memo = the `wallet_transfers` id; CU price ≤ the cap; fee payer = the user's CDP address. One colocated test per clause. This assertion is what turns a pooled signing credential into a per-user, per-row authorization.
- `solanaRail.submitSend(prepared)`: `cdp.solana.signTransaction` → decode → `sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signedTx, { commitment: "confirmed" })` (from `@solana/kit`; rpc/rpcSubscriptions from `client.ts`) → `{ state: "submitted", txRef: signature }`; `executeTransfer` writes `status='submitted'`, `transaction_id = signature`. A timeout after send → one `getSignatureStatuses([signature])` lookup; confirmed → `submitted`; still unknown → throw → `markSubmitUnknown` + `WalletSubmitUnknownError`: the row is terminal **`submit_unknown`** (C23; surfaced to the user as "uncertain"), never released, never retried. `tick()` may promote `submitted → confirmed` at `finalized` (the state exists in 0141; optional). Every `getTransaction` lookup passes `maxSupportedTransactionVersion: 0`.

The blockhash (~60–90 s) is fetched in `prepare`, so its expiry is a submit-time failure, never a preview-time one; `expires_at` (5 min, swept by the pay-rails cron) bounds the approval. Receipt line `✓ Sent 12 USDC on Solana devnet · explorerLink("solana", signature)`.

### 7.4 Receive (W3a) — Solana Pay transfer requests

`/pay request 12 USDC on solana [memo …]` (parser §4.3), the Pay form, or the Box via `POST /api/pay {action:"request"}` behind `requireInteractiveRun` (§2 WF8) → `solanaRail.request`:

1. `reference = (await generateKeyPairSigner()).address` (kit; async; fresh per request, never reused; stored on the row).
2. One `payment_requests` row: `direction='receive'`, `currency='usdc'`, `rail='solana'`, `network = chainFor("solana").network`, `receive_address = users.solana_address`, `reference`, `memo` = the request id (short, opaque: `INV-<6>`), `amount_display`, `amount_cents` (USDC cents, for the listing), `payee='external'` (not-null column with Stripe-lane semantics); the column's 24 h `expires_at` default applies. No decision — a receive request moves no money; several may be pending (§4.2, no one-pending index here).
3. The URI, built by hand in `lib/pay/solanaPay.ts` to the Solana Pay spec (v1.1):

   ```
   solana:<recipient>?amount=12&spl-token=<mint>&reference=<ref>&label=Air&message=Request%20INV-7&memo=<request id>
   ```

   `recipient` is the wallet address (never an ATA — the wallet derives it from `spl-token`); `amount` in user units with ≤ 6 decimals (more is malformed); `label`/`message`/`memo` URL-encoded UTF-8; wallets append `reference` as a read-only non-signer account on the transfer and write `memo` on-chain. Transaction-request links (`solana:https://…`) are **not** v1.
4. The card shows the URI as a link, the QR (`lib/wallet/qr.ts` — server SVG; `addressQrDataUrl` encodes any string, or W2a's `qrDataUrl` alias), the address and the amount as text. pay.tsx "Getting paid" lists it as `open | paid | expired`.

**Watcher** — `solanaRail.tick()` from `/api/cron/pay-rails` (`requireCron`) for every open Solana receive row:

```ts
const sigs = await rpc.getSignaturesForAddress(reference, { limit: 1 }).send();       // at most one tx ever carries this reference
const tx = await rpc.getTransaction(sigs[0].signature,
  { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send();
// paid iff tx.meta.err === null and
//   (post − pre) token balance for { owner: recipient, mint: USDC } ≥ requested atomic amount
//   (meta.postTokenBalances / preTokenBalances, uiTokenAmount.amount as bigint)
```

Balance delta, not instruction matching: Phantom injects a Lighthouse guard instruction and wallets add compute-budget / create-ATA instructions, so the transfer is never "instruction 0". Match → `status='paid'`, `tx_ref = signature`, `paid_amount` (atomic string) in one update guarded by the unique `tx_ref` index (a second tick on the same signature is a 23505 → no-op) → `deliverPayEvent` (`lib/pay/imessage.ts`, W2a) texts the owner `✓ Received 12 USDC on Solana devnet · explorerLink("solana", signature)`. Past `expires_at` → `expired`. `tick()` reads, reconciles, expires and notifies only (§2 WF8).

### 7.5 x402 on Solana (W3b, after W2b) — gate + buyer

No protocol-v2 library swap in the window (R12). The gate keeps the v1 wire (`X-PAYMENT` / `X-PAYMENT-RESPONSE`, `x402Version: 1`); W2b's MPP branch is the one call site keyed on `Authorization: Payment`; W3b adds Solana as a **second v1 `accepts` entry** with the installed `x402@1.2.0`, which already ships SVM support (its own deps: `@solana/kit ^5`, `@solana-program/token`, `compute-budget`, `token-2022`):

- `buildSolanaPaymentRequirements(app, payTo, resource)` beside `buildPaymentRequirements` (today's builder rejects non-`0x` assets): `scheme:"exact"`, `network:"solana-devnet"` (`"solana"` when `chainFor("solana").liveEnabled()`) — the v1 wire string —, `asset` = registry USDC mint, `maxAmountRequired` = `x402_price_usdc × 10⁶` as a string, `payTo = users.solana_address`, `maxTimeoutSeconds: 60`, `extra.feePayer` from the facilitator's `supported()` kinds. `publisherPayTo` (x402.ts:115-128) selects `wallet_address, solana_address, tempo_address` and returns `{ base, solana, tempo }` each-or-null; the Base `payTo` never depends on the new columns; the Solana entry is omitted when `solana_address` is null (MA6), and the existing `accepts: []` early return fires only when every entry is absent.
- A `payload.network` branch selects the requirement matching the header (today the gate compares against its single requirement). `paymentNonce` gains an SVM arm: for a `solana*` payload the `jti` is the transaction signature taken from `payload.transaction` (decode with kit's `getTransactionDecoder`; the payer's signature — the facilitator's fee-payer slot is unsigned on the wire; confirm the exact shape at devnet rehearsal); today's `authorization.nonce` stays the EVM key. There is no nonce column — `x402_receipts.jti` is the replay key.
- Receipt `x402_receipts { jti, app_id, payer_address, amount_usdc, tx_hash = settlement.transaction, protocol:'x402', network: chainFor("solana").caip2 }` — `network` stores the registry CAIP-2 (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` on devnet, `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` live) regardless of the wire string, so one representation per column — inserted **before** the paid session is minted (§2 WF4); 23505 after settlement → 402 "payment already redeemed", never a session.
- Facilitator = a pure function of the entry's chain: Base mainnet → CDP `createFacilitatorConfig`; Base Sepolia and `solana-devnet` → `env.x402FacilitatorUrl()` (`https://x402.org/facilitator`, testnet-only); Solana mainnet → the CDP facilitator. A test asserts that no mainnet entry resolves to `x402.org` (fix the comment at env.ts:720).
- The Base path and `x402.test.ts` stay untouched as the regression oracle. The v2 `PAYMENT-SIGNATURE` branch is added **only** if devnet rehearsal shows the hosted facilitator rejects v1 SVM payloads (open question, §15). Pay page: today's single Air-wallet instruction stays the primary CTA; Solana appears under "Other wallets" only when the publisher has a `solana_address`. MA11's red-team list is the gate for this change.

Buyer (§6.5 `resolveMachinePayment`, x402 arm). W2b owns the resolver, the fetch helper with the `lib/kernel/purchases.ts` SSRF guards, and `pending_approval`-only filing (every charge is a `machine_payment` decision; no standing budgets in the window); W3b adds the Solana arm: `createSvmClient({ signer: toClientSvmSigner(<CDP-backed signer from wallet.ts>) })` + `wrapFetchWithPayment(fetch, client)` (`@x402/svm`, `@x402/fetch` — `apps/web` deps, §7.1) with an `onBeforePaymentCreation` hook that asserts the selected requirement equals the stored challenge (amount, asset, payTo, network) — any drift aborts with "price changed" and the row goes `expired`. The CDP-backed signer runs the same decompile assertion as §7.3 with the challenge's payTo/amount/mint in place of a `wallet_transfers` row; without `CDP_WALLET_SECRET` the arm refuses like `previewSend` (§7.2). Default-asset price strings (`"$0.01"`) resolve to USDC on Solana devnet and mainnet. A failure after signing → `uncertain` (the `machine_payments` terminal), never retried.

### 7.6 Wallet tab (W3a read; W3b adds the send block)

`lib/chains/solana/read.ts`, called from `lib/wallet/read.ts` and never implemented inside `lib/wallet/**` (§4.4: 46% line floor there, 42% global): for one address, SOL lamports (`getBalance`), USDC ATA balance (`getTokenAccountBalance` of `findAssociatedTokenPda(address, mint)`), last 10 signatures (`getSignaturesForAddress`) → a second block in the Wallet panel with the network chip, "Receive · <solana_address>" (W3a) and, once W3b lands, "Send · <solana_cdp_address>". `/pay solana balance` renders the same read as text (no card). The Onramp link appears only when `SOLANA_LIVE_ENABLED`.

### 7.7 Acceptance (§12 W3)

W3a — colocated Vitest on recorded fixtures, then devnet:

- `pay/solanaPay.test.ts`: the URI encodes every field and URL-encodes label/message/memo; the reference round-trips through the parser; an amount with > 6 decimals is rejected; `recipient` is never an ATA.
- `rails/solana.test.ts` (receive) on recorded `getSignaturesForAddress` / `getTransaction` JSON: a Phantom-shaped transaction (guard ix + compute-budget + create-ATA + transfer) marks the request `paid` once by balance delta; a duplicate signature is a no-op (23505); `meta.err !== null` is ignored; a short payment stays open; past `expires_at` → `expired`; `users.solana_address` null → the request is refused.
- `chains/solana/read.test.ts` on recorded RPC JSON; pay.tsx settings view rejects a malformed address; `/pay solana address` prints it.
- **Devnet gate (the beat):** `/pay request 1 USDC on solana` → QR; pay it from Phantom on devnet (Circle-faucet USDC) → the request flips to `paid` within one `pay-rails` cron tick and the owner is texted.

W3b — after W2b:

- `payments/x402.test.ts` additions (no CDP needed), existing cases untouched: the 402 body carries both `accepts` entries, and only the Base one when `solana_address` is null; a v1 `X-PAYMENT` for Base still settles; a Solana v1 payload settles only through the injected facilitator, and the receipt (`network` = CAIP-2) exists before the session cookie; a replayed signature → 402; no mainnet entry resolves to `x402.org`.
- **Devnet gate (seller side, no CDP):** `scripts/x402-solana-pay.ts` (`wrapFetchWithPayment(fetch, createSvmClient({ signer: toClientSvmSigner(keypair) }))` with a Circle-faucet-funded devnet keypair; if the v2 client will not speak the v1 wire, register `ExactSvmSchemeV1` from `@x402/svm/v1` on the same client — 2.28.0 ships it and `createSvmClient` registers the v1 network names; `x402-fetch@1.2.0` (deps `x402 ^1.2.0`) is the last resort) opens a priced mini-app on devnet and `x402_receipts` shows `protocol='x402', network='solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'`. `npx awal x402 pay` settles USDC on Base only — a Base-entry regression check, not a Solana test.
- With `CDP_WALLET_SECRET` provisioned — `chains/solana/wallet.test.ts`: the decompile assertion rejects, one case each — a top-level System ix, a second `TransferChecked`, wrong mint, amount ≠ `amount_wei`, destination ≠ the recipient's ATA, missing or mismatched memo, CU price above the cap, wrong fee payer; `signMessage` is never referenced (grep); sends refuse without `CDP_WALLET_SECRET`.
- `rails/solana.test.ts` (send): an ATA-missing preview adds the create instruction and the rent line; `createTransferRequest` writes `rail='solana'`, `chain_id` null, `expires_at`; a second pending send → 409; a row past `expires_at` is refused before the CAS and marked `expired`; a `prepare` throw releases the claim; a `submitSend` throw or an unknown signature → `submit_unknown`, never `pending` again; the compiled message is `version: 0`.
- **Devnet gate (send, CDP):** `/pay 1 USDC to <addr> on solana` approves from pay.tsx's "To pay" list and lands as a v0 transaction whose memo is the `wallet_transfers` id.

---

## 8. W4 — `/formation` mini-app (1 session)

Runs **last** in the order (§13): it depends only on W0 — `0141` (the `formation`
card kind and the `formation_submit` decision kind) plus the view-only
`formation_submit` entries in `HOSTED_KINDS`, the approve-client kind union and the
needs-panel labels (§8.4) — and touches no chain. Commit subjects `R-WF-04:` (§4.4).
Everything the owner types stays in the Box (C4); the control plane keeps one
value-free status row per request. Constraints cited below are §2 WF1/WF6/WF8/WF9
plus C4/C5/MA10/T9.

### 8.1 Registry + module

- **Migration — W4's own forward-only file**, numbered at merge time
  (`supabase/migrations/<next>_formation.sql`); W4 never edits `0141` (which already
  carries `'formation'` in `card_sends_kind_check` / `miniapp_card_sessions_kind_check`
  and `'formation_submit'` in `decisions_kind_check`). Contents, in order:
  1. `mini_apps` row (the `0113_checkout_handoffs.sql:34-38` upsert pattern):
     `('formation', '/mini/formation', 'render', '{formation:manage}', null, 'Formation',
     'Form a US company with your agent — Stablecorp handoff, EIN and 83(b) tracking.',
     'private', 'single', 'published') on conflict (slug) do update …`.
  2. `create table formation_requests (id uuid primary key default gen_random_uuid(),
     user_id uuid not null references users(id) on delete cascade, decision_id uuid
     references decisions(id) on delete set null, stage text not null check (stage in
     ('ready','submitted','filed','ein','bank','ready_to_operate','denied')), provider
     text not null default 'stablecorp', package text check (package in ('llc','ccorp')),
     price_usd numeric(14,2), run_id text, handoff_id uuid, submitted_at timestamptz,
     created_at timestamptz not null default now(), updated_at timestamptz not null
     default now()); create unique index formation_requests_open_idx on
     formation_requests (user_id) where stage in ('ready','submitted'); alter table
     formation_requests enable row level security;` — no policies (service role only;
     `supabase/tests/rls_all_tables.sql`), **no packet content, ever**.
  3. `alter table agent_schedules drop constraint agent_schedules_source_check; alter
     table agent_schedules add constraint agent_schedules_source_check check (source in
     ('calendar','chat','bots','computer','muse','formation'));` (copy
     `0122_muse.sql:45-47` + one value) so the 83(b) reminders in §8.5 can carry
     `source='formation'`.
- **Module** `apps/web/lib/miniapps/apps/formation.tsx` exporting
  `formation: MiniAppModule` (the `trade.tsx:516` shape). `render`/`action` return
  `forbidden` unless `ctx.session.role === "owner"`; no `guestActions`; no
  `publicAccess`; `renderShell`/`shellHtml` from `lib/miniapps/shell.ts`. Render
  `promptBar("Ask about your packet…")` (placeholder only — `promptBar` takes nothing
  else) and handle `action === "prompt"` with `runPrompt(ctx, text)`, catching
  `StartLimitError` exactly as `trade.tsx:592-600` does. Run metadata is derived by
  `runPrompt` itself (`{ app: ctx.app.slug, resource: ctx.session.resourceId,
  surface: "miniapp" }`); the session `resourceId` is `default` (cards and
  `/formation` mint it that way); `packet`/`status`/`actions` are state-document
  resource names, not session resources.
- **Registration (all in the same PR):** `formation` in `FIRST_PARTY_MODULES`
  (`lib/miniapps/apps/index.ts` — a row without a module does not load), `"formation"`
  in `CARD_KINDS` (`lib/miniapps/cardSends.ts`; `lib/admin/deletion.test.ts` fails when
  the final constraint and the list disagree), `"formation"` in `FIRST_PARTY_RESERVED`
  (`lib/miniapps/reserved.ts`), and a row in the Kinds table of
  `infra/template/skills/open-miniapp/SKILL.md` (`formation` | forming a company,
  LLC / C-Corp, EIN, 83(b)) so the agent may emit `[card: formation]`. `/formation`
  typed in iMessage is a mini-app **slug** (`parseMiniAppCommand` → card), not a
  command: no parser arm, no `ALIASES` entry, no model turn.
- **Helper lane** `apps/web/lib/formation/` with colocated Vitest:
  `packet.ts` (types, zod schema, `completeness(packet)` — the only writer of
  `completeness.missing`), `decide.ts` (`recommend(answers)` → entity + reasons),
  `providers.ts` (`PROVIDERS.stablecorp = { checkoutUrl: "https://mystablecorp.xyz/",
  packages: { llc, ccorp } with `priceUsd` + `pricedAt`, mailDomains:
  ["mystablecorp.xyz", "mystablecorp.com"] }`, `isProviderSender(from)`). `checkoutUrl`
  is the **homepage** — the only verified URL: the site was not fetchable from the
  sandbox, there is no public API and the checkout path is unknown, so the agent
  navigates from the homepage to the chosen package's checkout page and *that* page's
  URL becomes the handoff's `merchant_url` (`safeCheckoutUrl`,
  `lib/checkout/handoffs.ts:136-154`, accepts both). `packages.*.priceUsd`/`pricedAt`
  are the ~Jan 2026 marketing snapshot from `docs/site/formation.md:58-61` (LLC from
  $999, C-Corp from $1,199), not a live quote. Then `store.ts` (the Box documents,
  below), `status.ts` (`submitFormation`, `resolveFormationSubmit`, stage CAS),
  `deadlines.ts` (`computeDeadlines`, `syncDeadlines`). Goal file beside the module:
  `apps/web/lib/miniapps/apps/formation.goal.md` (the `berd.goal.md` convention).
- **Box documents (C4)** under `.hermes/miniapps/formation/`: `packet.json`,
  `status.json`, `actions.json` (append-only, MA10) and `documents/<slug>.<ext>`.
  Reads for render go through `readAppState(supabase, userId, "formation", <resource>)`.
  **Every mutation of `packet.json`/`status.json` runs under `withStateLease(supabase,
  userId, "formation", <resource>, { attempts: 3 }, (boxId, renew) => …)` with
  `readAppStateFrom` → mutate → `renew()` → `writeAppStateTo`** — the `mutateTradeDoc`
  pattern in `lib/trade/state.ts:125-142` (`mutateDoc` in `lib/miniapps/store.ts` is
  private and `writeAppState` leases only kanban/todo). Leases are per `(app, resource)`
  (`miniapp_state_lease(p_app, p_resource)`, `lib/miniapps/stateLease.ts:94-121`), so
  the `status` lease never serializes a `packet` write; when one step needs both, the
  order is always **`packet` (outer) → `status` (nested)**. `actions.json` is written
  only by `appendActionLogEntry(supabase, userId, "formation", { action, payload, role,
  at })` (newest 200 kept); `StateBusyError` surfaces as "try again".
- **Two lanes, one store.** `POST /api/formation` (`requireBoxOrOwner`) and the
  module's `action()` both call `lib/formation/store.ts`:

  | Action | Lane | Effect |
  |---|---|---|
  | `decide` | both | answers → `recommend()` → `packet.decision` (+ `reasons`, `answeredAt`); an override sets `entity` with `reasons: ["owner override"]`; subject to the packet freeze |
  | `packet-set` | both | zod-validated field writes; recomputes `completeness.missing`; `status.stage deciding → intake`; subject to the packet freeze |
  | `name-check-set` | both | owner-entered `{ state, available, checkedAt }` (optional; no browser task — P2); subject to the packet freeze |
  | `submit` | module only (owner session) | `submitFormation`: requires `completeness.missing = []` and `decision.entity`; computes `packet_sha256` under the `packet` lease; upserts the open `formation_requests` row at `ready` (23505 on `formation_requests_open_idx` → reuse the open `ready` row; `submitted` → 409 `already_submitted`), dismisses any pending `formation_submit` decision for it, inserts the decision row directly (`{ user_id, kind: "formation_submit", ref: <row id>, label, payload }`, the `lib/trade/service.ts:290` shape — `createDecision` in `lib/routing/trust.ts` is typed for four kinds only) |
  | `status-set` | both | forward-only stage `submitted → filed → ein → bank → ready_to_operate` (`denied` from any, owner only) — CAS on `formation_requests.stage`, then the mirror + `filedAt`/`einAt`/`bankAt`/`readyAt` in `status.json`; the Box lane may pass `evidence: { from }` and the entry is tagged `source: "provider_email"` only when `isProviderSender(from)` |
  | `issuance-set` | both | writes `status.issuanceDate` (`YYYY-MM-DD`) and runs `syncDeadlines` (§8.5) |
  | `document-add` | both | records `{ kind, path, addedAt }`; `path` must be under `.hermes/miniapps/formation/documents/` (no `..`, ≤ 200 chars) |
  | `prompt` | module only | `runPrompt(ctx, text)` |

  **Packet freeze.** `decide`, `packet-set` and `name-check-set` run under the `packet`
  lease and, inside it, read the user's latest `formation_requests` row: once that row
  is past `ready` (`submitted` or later) the write is refused with 409 `packet_frozen`
  — the packet has been submitted and the Box reads `packet.json` during the run. A
  `ready` row (pending decision, or dismissed) does **not** freeze: an edit there is
  caught by the WF6 hash check at approve (§8.4, 409 `packet_changed`) and the owner
  re-submits, which dismisses the stale decision and inserts a fresh one.
  Every action appends one `actions.json` entry with `role` (`owner` | `box`). The
  Box lane never creates the decision, so WF8 needs no `requireInteractiveRun` here.
- **Box skill** `infra/template/skills/formation/SKILL.md` (front-matter `name:
  formation`): how the agent asks the three questions and fills the packet through
  `POST /api/formation` (box bearer, `BASE` derived with `grep|cut` from
  `~/.hermes/.env` as `trade/SKILL.md:25-29` does — never `source`), what it must never
  do (pay, enter a card, promise legal outcomes, invent prices), how it reports, and
  the provider-mail rule in §8.5. It is installed by `setup.sh`'s local-skills loop
  (`infra/template/setup.sh:331-334`) — **no `base-skills.txt`, `skills-manifest.py` or
  `BASE_SKILLS` entry** (hub identifiers only). Add `check "skill-formation" test -f
  "$HOME_DIR/.hermes/skills/formation/SKILL.md"` to `infra/template/verify-box.sh`
  beside the five existing skill checks.
- **Env:** `FORMATION_HACKATHON_PERKS` as an `OPTIONAL_ENV` row + lazy
  `env.formationHackathonPerks()` in `lib/env.ts` (§4.4), which returns
  `process.env["FORMATION_HACKATHON_PERKS"] === "1"` — `1` is the only truthy spelling
  (the `STRIPE_LINK_ENABLED`/`PUBLISH_TIKTOK` pattern at `lib/env.ts:858-864`);
  `docs/site/formation.md:66-67` "when the hackathon flag is set" means exactly this.
  The module never reads `process.env`.

### 8.2 Packet (`packet.json`, version 1)

```ts
interface Address { line1: string; line2?: string; city: string; region: string; postalCode: string; country: string }

interface FormationPacket {
  version: 1;
  decision: { entity: "wyoming_llc" | "delaware_ccorp" | null; reasons: string[]; answeredAt?: string;
              answers: { foundersResidency: "us" | "non_us" | "mixed" | null; raising: boolean | null;
                         options: boolean | null; tokenTreasury: boolean | null } };
  company: { name: string; alternates: string[];
             nameCheck?: { state: string; available: boolean | null; checkedAt: string } };   // owner-entered, optional
  founders: Array<{ name: string; email: string; residency: string; equityPct: number; role: string }>;
  addresses: { principal: Address; mailing?: Address };
  registeredAgent: "provider" | { name: string; address: Address };
  needs: { ein: boolean; bank: boolean; invoicing: boolean; eightyThreeB: boolean };
  provider: { id: "stablecorp"; package: "llc" | "ccorp"; priceUsd: number | null; quotedAt: string | null }; // snapshot from providers.ts (~Jan 2026 marketing prices, not a live quote)
  completeness: { missing: string[] };                     // computed by packet.ts, never hand-edited
}

type DocumentKind = "certificate" | "ein_letter" | "bylaws" | "operating_agreement" | "rspa" | "cap_table" | "other";

interface FormationStatus {
  version: 1;
  stage: "deciding" | "intake" | "ready" | "submitted" | "filed" | "ein" | "bank" | "ready_to_operate" | "denied";
                                     // Box-only until `ready`; from `ready` on, a mirror of formation_requests.stage
  requestId?: string;                // formation_requests.id once staged
  submittedAt?: string; filedAt?: string; einAt?: string; bankAt?: string; readyAt?: string;
  issuanceDate?: string;             // YYYY-MM-DD, owner- or agent-entered
  deadlines: Array<{ kind: "83b" | "annual"; dueAt: string;
                     eventId: string;            // local:<16hex> from upsertLocalEvent, reused on re-runs
                     reminderIds?: string[] }>;  // agent_schedules ids (83b only), replaced on re-runs
  documents: Array<{ kind: DocumentKind; path: string; addedAt: string }>;   // Box files, not vault items
}
```

Documents are **Box files** (`.hermes/miniapps/formation/documents/<slug>.<ext>`);
`vault_items.kind` is `login | card | api_key | note | identity`, so only secret-like
values — the EIN — go to the vault, through the existing `vault_fill` path as `note`
or `identity` (agent-staged, owner-approved). The `formation_submit` decision
`payload` is value-free (WF6): `{ provider: "stablecorp", package, price_usd, entity,
state, founders_count, needs: { ein, bank, eightyThreeB }, perks: boolean,
packet_sha256 }` where `packet_sha256` hashes the canonical (sorted-key) packet JSON;
`label` = `Submit formation packet to Stablecorp (<package label>, $<price>)`. No name,
address or email ever reaches `decisions`, `formation_requests` or `checkout_handoffs`.

### 8.3 Screens (three, no modals)

| Screen | Shows | Actions |
|---|---|---|
| **Packet** | Until `packet.decision.entity` is set: the three questions inline (residency, raising/options, token treasury) → recommendation card with reasons from Stablecorp's LLC-vs-C-Corp guidance + "Override". Then: checklist of fields with ✓/○, the optional owner-entered name-check result ("enter the result if you checked the registry"), equity bar, missing list | `decide`, `packet-set`, `name-check-set` |
| **Submit** | The exact packet + provider package + quoted price ("Stablecorp's current pricing; confirm at checkout", `pricedAt` shown — the §8.1 snapshot) + disclosure ("Stablecorp is the provider; Air stores, reminds, and stops before payment") → **Approve handoff**. Perks line only behind `FORMATION_HACKATHON_PERKS=1` (`env.formationHackathonPerks()`): names the four Colosseum perks (30% off incorporation, priority EIN, priority banking KYB, a free 30-minute setup call) and says "mention Crypto World's Fair at checkout" — **no perk code exists**. EIN note: the EIN is the critical path (an SS-4 by fax for founders without an SSN typically takes one to four weeks without a priority channel) and a bank account cannot open before the EIN letter exists | `submit` → `formation_submit` decision (`ref` = `formation_requests.id`, payload per §8.2); disabled while `completeness.missing ≠ []` |
| **Status** | Tiles Filed → EIN → Bank → Ready (owner taps; the agent can update them when a provider email arrives); the open checkout handoff, if any, as "Open checkout" (a signed link minted with `mintSignedLink(userId, "checkout", handoff.id)` from `lib/miniapps/cards.ts`, found by `checkout_handoffs.task_id = formation_requests.run_id` and written back to `handoff_id`); deadline countdowns; documents list (kind + filename; files open from the Box, not through the control plane); one **Money** line: "Invoices and payouts run through `/pay` — USD via Stripe Link (payee entered on the card), USDC on Base or Solana, Tempo with memo = invoice number; Squads Altitude for multi-party treasury approval" | `status-set`, `issuance-set`, `document-add` |

The Decide and Money tabs are gone (the `decide` action stays). A user forms a company
once and comes back for the Status line.

### 8.4 Decision → handoff

`resolveFormationSubmit(supabase, userId, decisionRef, action: "approve" | "dismiss")`
in `lib/formation/status.ts`, wired in the same PR into **both** resolver chains. The
view-only entries — `"formation_submit"` in `HOSTED_KINDS`
(`lib/approvals/hosted.ts:37-43`), the `app/approve/[id]/approve-client.tsx:16` kind
union and the `app/home/panels/needs-panel.tsx:40-58` label maps ("Formation packet
awaiting approval" / "Submit to provider") — land with **W0** (tonight's slice), so W4
does not edit those lines (two sessions on the same five lines conflict at merge) and
adds them only if W0 merged without them. W4 adds: the `resolveHostedDecision` arm in
`hosted.ts`, the `formation_submit` entry in the `lib/decisions/resolve.ts` kind list
(~228) that delegates to hosted, the `loadHostedApproval` view fields for the kind
(`view.formation = { provider, package, price_usd, entity, state, perks }`, read from
the value-free payload), and a test that the kind resolves through both chains (a kind
present in only one silently approves without executing). Approve:

1. Load the `formation_requests` row by `ref` + `user_id`; require `stage = 'ready'`
   (else 409 `stage_changed`).
2. **CAS** `ready → submitted` (`.eq("stage", "ready")`, sets `submitted_at`,
   `decision_id`); zero rows → 409 (a double approve starts one run, not two).
3. Under the **`packet` lease (outer)** with the **`status` lease nested** (the §8.1
   order): re-read `packet.json`, require `sha256(canonical packet) ===
   payload.packet_sha256` (WF6 re-verify; mismatch → 409 `packet_changed`), mirror
   `stage: "submitted"` + `submittedAt` into `status.json`. The `status` lease alone
   would not serialize this against a concurrent `packet-set` (leases are per
   resource); the `packet` lease does, and because step 2 already moved the row to
   `submitted`, every `packet-set` that acquires the `packet` lease after this point is
   refused by the §8.1 freeze — the hash is stable from here through the run start.
4. Start a MAIN_SESSION run exactly as `runPrompt` does (the resolver has no
   `MiniAppContext`, so `lib/formation/status.ts` replicates the body of
   `lib/miniapps/promptBar.ts:30-45` — `runPrompt` is `:23-46`):
   `ensureBoxAwake(supabase, userId)` → `createRun(box.target, { input, sessionId:
   MAIN_SESSION, metadata: { app: "formation", resource: "submit", surface: "miniapp" } })`
   → `agent_runs` insert `{ user_id, hermes_run_id: run.run_id, trigger: "web" }` →
   `armStopAfter(supabase, userId)`; write `run.run_id` to `formation_requests.run_id`.
   `input` is a fixed template from `status.ts` naming the packet path, the package and
   `PROVIDERS.stablecorp.checkoutUrl` — it carries no packet content (the Box reads
   `packet.json` itself).
5. Any throw after step 2 reverts `submitted → ready` (`.eq("stage", "submitted")`),
   mirrors `ready` back into `status.json` if step 3 had written `submitted` (same
   lease pair), and rethrows, so the approve surface shows the error and the owner can
   approve again.

The run (formation skill + `shopping-checkout` choreography, Kernel browser first via
`kernel-browser`) opens `PROVIDERS.stablecorp.checkoutUrl` (the homepage — no checkout
URL is known, §8.1), navigates to the chosen package's checkout page, pre-types the
packet fields, then calls `POST /api/checkout/handoff` (`lib/checkout/handoffs.ts`,
`checkout_handoffs` from `0113`; `task_id` = the run id, so a retry returns the same
handoff; `merchant_url` = the checkout page the agent reached, `item_summary` = the
package label only, `amount_cents`, `currency: "usd"`, `blocker: "Pay on the provider
page"`) and then `POST /api/cards/checkout { resource_id: <handoff_id> }`
(`app/api/cards/[kind]/route.ts`) to deliver the Checkout card explicitly — card
markers are delivered only on iMessage-triggered runs, and this run was started by
the resolver. The owner pays on the merchant page from the Checkout card or from the
Status screen's "Open checkout" link; the agent never enters a card, nothing is stored
for the provider. An owner with no `imessage_destinations` row cannot receive a
handoff at all (the POST 409s): the agent then reports the checkout URL in its reply
and the Status screen says so. `purchase_review` (`lib/vault/purchase.ts`,
`api/browser/purchase`) is the optional vault-card fill and applies only if the owner
separately asks for a vault card to be filled; it is not the stop.

Dismiss/deny: the decision is dismissed and the row stays `ready` (the CAS runs only
on approve) — "deny restores `ready`" in §12 W4 is this. The resolver's only side
effects are the stage flip, the mirror and the run; the money step is the owner's
click on the provider page.

### 8.5 Deadlines, documents, provider email

- **Deadlines** (`lib/formation/deadlines.ts`). `computeDeadlines(entity, issuanceDate)`
  is pure and tested: **83(b)** due `issuanceDate + 30 days`; **annual compliance** for
  the state (Delaware: March 1 franchise tax + annual report; Wyoming: first day of
  the formation anniversary month). `syncDeadlines` runs on `issuance-set` under the
  `status` lease (the Box is already awake — `withStateLease` hands over `boxId`):
  each deadline is written with `upsertLocalEvent(boxId, { id: existing?.eventId,
  title, starts_at: dueAt, all_day: true })` (`lib/calendar/store.ts:306-333`,
  `sync.py upsert`), the returned `local:<16hex>` id stored in
  `status.deadlines[].eventId` and passed back on re-runs (idempotent). **No
  `calendar_add` decision and no .ics synthesis** — `calendar_add` exists only for
  inbox invites and `lib/calendar/ics.ts` has no builder; the owner approved the
  submit, the events land directly.
- **Reminders** at 21/7/2 days before the 83(b) deadline = three one-shot
  `agent_schedules` rows, mirroring `app/api/calendar/remind/route.ts`: prompt text in
  a Box file (`writeFile(boxId, ".hermes/schedules/<id>.md", …)` — the deadline date
  lives only there, C4), row `{ id, user_id, name: "Formation reminder", cron:
  <one-shot local parts of fireAt>, timezone, prompt_ref, deliver: "imessage", source:
  "formation", status: "active", one_shot: true, next_run_at: fireAt }`; fire times
  already past are skipped; `timezone` comes from the `issuance-set` form (the Status
  screen posts the browser's zone), default `UTC`. Ids go to
  `status.deadlines[].reminderIds`; a re-run deletes those rows and prompt files first
  (idempotent). The sweeper (`lib/calendar/sweep.ts`) fires a one-shot once and
  deletes the row and the prompt.
- **Documents.** The agent saves provider attachments to
  `.hermes/miniapps/formation/documents/<slug>.<ext>` with its own tools and records
  each with `document-add`; the Status screen lists them. The EIN goes to the vault
  through `vault_fill` (`note`/`identity`), owner-approved. No document bytes and no
  email body enter Postgres (C4).
- **Provider email.** Inbound mail is provider-neutral: `api/inbound/email` →
  `processInboundEmail` (`lib/email/inbound.ts`), AgentMail or wzrdmail per
  `MAIL_PROVIDER`; callers import `lib/mail/client.ts`, never a provider module. There
  is no sender-domain hook in `inbound.ts`; the formation SKILL.md tells the agent to
  treat mail from `@mystablecorp.xyz` / `@mystablecorp.com` as provider status (the
  allowlist is `PROVIDERS.stablecorp.mailDomains` in `lib/formation/providers.ts`,
  mirrored in the skill text), to post `status-set` with `evidence: { from }` (only an
  allowlisted `from` is recorded as `provider_email`), and to save attachments to the
  documents folder. Parsing is the agent's reading of the thread, not a control-plane
  parser (P2).

### 8.6 Copy rules

Never "we will form", "guaranteed", "legal advice", "never miss" (WF9/T9). Prices are
"Stablecorp's current pricing; confirm at checkout" with `pricedAt` shown. The 83(b)
copy names the IRS deadline plainly and says "reminds you before the 83(b) deadline".
The perks line names the perks and says "mention Crypto World's Fair at checkout"; no
code is shown until Stablecorp confirms one. The disclosure on Submit names Stablecorp
as the provider and Air's role (store, remind, stop before payment).

### 8.7 Acceptance (§12 W4)

- **Unit (colocated Vitest, no network):** `formation/packet.test.ts` (zod; `completeness`
  is the only writer of `missing`; a hand-edited `missing` is recomputed),
  `decide.test.ts` (the three questions → recommendation matrix: `non_us` and not
  raising → `wyoming_llc`; raising or options → `delaware_ccorp`; token treasury alone
  changes nothing; override keeps `reasons`), `deadlines.test.ts` (83(b) = +30 d;
  annual per state; three reminders at 21/7/2 d with past fire times skipped; re-run
  reuses `eventId` and replaces `reminderIds`; `source: "formation"`),
  `status.test.ts` (double approve → one CAS and one run; packet hash mismatch → 409 and
  `ready`; run start failure reverts to `ready` and the mirror; dismiss leaves `ready`;
  stage transitions forward-only), `apps/formation*.test.ts` (guest → forbidden; `submit`
  refused while `completeness.missing ≠ []`; `packet-set` refused with `packet_frozen`
  once the row is `submitted`; decision payload, `formation_requests` and the handoff
  `item_summary` contain no packet strings; perks line only with
  `FORMATION_HACKATHON_PERKS=1`; `promptBar` rendered for owners), a resolver-chain
  test that `formation_submit` resolves through both `resolve.ts` and `hosted.ts` and
  appears in the approve-client union and needs-panel labels, `lib/admin/deletion.test.ts`
  green with `formation` in `CARD_KINDS`, the reserved-word test for the slug.
- **Resolver / integration:** `formation_submit` CAS; the run is created with
  `metadata.resource = "submit"` and an `agent_runs` row with `trigger = "web"`; the
  checkout handoff is created by the run with `task_id` = run id; deny restores
  `ready`.
- **Manual gate:** one real walk from Stablecorp's homepage to the package's checkout
  page with the handoff engaged and **no payment**: the Checkout card arrives, the
  Status screen links the same handoff, the blocker reads "Pay on the provider page";
  tap a tile; set an issuance date → one event per deadline in the Box calendar and
  three `agent_schedules` rows.
- **Exit:** the §12 standard gate (typecheck, lint, test, build, coverage floors,
  shadow-applied migration); `verify-box.sh` passes `skill-formation`; commit
  `R-WF-04:`; `docs/site/formation.md`'s `Status:` line flips from `planned` only when
  this session merges (§10).

### 8.8 Deferred (P2, after the window)

- Browser-use name check on the state registry (today: owner-entered `nameCheck`).
- Provider-email parsing that proposes `status-set` from the thread (today: the agent
  reads and posts; tiles are also owner-tappable).
- A deterministic `/formation status` lane (`/formation` stays a slug; no parser arm).
- Document download through the control plane (today: files open from the Box).
- A perk code on the Submit screen once Stablecorp confirms one; a provider picker
  (§15 #6) — Stablecorp-only in this program.

---

## 9. W5 — Zcash shielded wallet in the Box (1–1.5 sessions)

Two halves (§13). **W5a** is the control-plane half: fixture-green with no Rust
toolchain, behind an injectable `ZecBinary` seam whose test fake replays recorded
`air-zec` JSON. **W5b** is the `air-zec` crate, built by a GitHub Actions `rust` job
and shipped as a sha256-pinned release asset — after the hackathon, or by a human with
a Box. `zcash_sends` ships in W5's own forward-only migration, never in `0141` (which
already carries the `zcash_send` decision kind and `user_chain_keys`).

### 9.1 Shape

The wallet lives **in the user's Box** as one Rust binary `air-zec` on the
Ironwood-era `librustzcash` stack — `zcash_client_backend` 0.24 (features
`lightwalletd-tonic-tls-webpki-roots`, `orchard`), `zcash_client_sqlite` 0.22,
`zcash_proofs` 0.30 `bundled-prover`, `zcash_keys` 0.16, `zcash_address` 0.13,
`zip321` 0.9, `tonic` 0.14 — released versions only, never `-pre` from git. It
mirrors `zcash/zcash-devtool`'s `wallet init / sync / balance / list-addresses /
propose / send / pay` (the walkthrough is the reference; its binary is not
production). The control plane never holds a seed or spending key. The agent can read
and stage; only a **single-use execution nonce** minted by the decision resolver lets
`air-zec exec` spend.

**The trust boundary, honestly.** The Box account `user` (hermes-gateway.service
`User=user`; `TENKI_BOX_USER`) runs the agent **and** every control-plane `command()`
(tenki.ts `userCommand` → `sudo -H -u user bash …`; ascii is the same layout), and
holds passwordless sudo that must stay (setup.sh, sync-box.sh and
`lib/box/tailscale.ts` run `sudo` at runtime). A Unix split (`zcash` system user) is
therefore defense in depth, never the boundary, and there is no `zcash.sudoers` file.
The boundary is a **2-of-2**:

- Box half: the `age` identity at `/home/user/.air-zec/identity` (owner
  `zcash:zcash`, 0700, inside the per-minute `/home/user` snapshot), encrypted under
  a key derived from a per-user **wrap secret** and a Box-local salt.
- Control-plane half: that wrap secret — generated by the control plane, sealed with
  `sealSecret` under `env.providerVaultKey()` in `user_chain_keys (rail='zcash',
  network, kind='wrap_secret')`, never written to the Box at rest, released only in
  the HTTPS response body of `POST /api/wallet/zcash/exec-claim` after the owner
  approved one specific send (and once, at wallet creation, by its init-only twin
  `init-claim`, §9.3) — never on argv, in a file, or in a command result.
  `air-zec` zeroizes it after signing.

A root-capable compromised agent can stage a send (the owner sees a card), can read
the wrapped identity (useless alone), and could reach the key only inside the window
of an owner-approved send; the control plane holds the wrap secret — one half of the
2-of-2 — never a seed. That is the claim zcash.md makes — nothing stronger.

```
agent (`user` account) ── sudo -u zcash air-zec balance|address|request|propose|sync ──▶ wallet db ──▶ POST /api/wallet/zcash (stage)
owner taps Approve ──▶ resolveZcashSend mints nonce ──▶ box command: sudo -u zcash air-zec exec --send <id> --nonce <n> --api <origin>
                                                   └─▶ air-zec claims at POST /api/wallet/zcash/exec-claim {sendId, nonce}  (atomic, once)
                                                        ◀─ HTTPS body {wrap_secret, result_token}
                                                   └─▶ unwraps identity → re-proposes → proves + signs → send_transaction (lightwalletd) ──▶ txid ──▶ POST …/exec-result
```

### 9.2 Files

```
infra/template/air-zec/                      Rust crate (Cargo.lock pinned) — W5b. Built by the `rust` job in .github/workflows/ci.yml (pinned rustup toolchain; `cargo build --release --locked`; `cargo test`), published as a release asset with its sha256. Never `cargo build` on a Box (commands cap at 600 s, lib/fleet/sync.ts).
infra/template/air-zec/src/{main.rs,wallet.rs,sync.rs,request.rs,exec.rs}
infra/template/setup.sh                      `useradd --system --no-create-home --shell /usr/sbin/nologin zcash`; download + `sha256sum -c` the pinned asset (the OP_SHA256 pattern, setup.sh:234-237) → `sudo install -m 755 … /usr/local/bin/air-zec`; `install -d -o zcash -g zcash -m 0700 /home/user/.air-zec`; `install -d -o zcash -g user -m 0750 /home/user/.hermes/miniapps/zcash`; enable + start the sync timer at bake (a Tenki fork never boots). sync-box.sh mirrors the download + verify for existing boxes.
infra/template/air-zec-sync.{service,timer}  User=zcash, Type=oneshot, OnBootSec=30s, OnUnitActiveSec=2min; ExecStartPre=+/bin/sh -c 'chown -R zcash:zcash /home/user/.air-zec; chown -R zcash:user /home/user/.hermes/miniapps/zcash' (the hermes-gateway.service `+/bin/sh -c` pattern: hydration root-owns /home/user after resume). The snapshot directory stays `zcash:user` 0750 so `user` — the agent and the control plane's `readFile` (`LC_ALL=C cat` run as `user`) — can read it; a `zcash:zcash` chown there would make every read EACCES → `BoxApiError(500)`. Both units count in ci.yml's `systemd-analyze verify` step — bump its label.
infra/template/verify-box.sh                 check "air-zec" command -v air-zec · check "skill-zcash" test -f "$HOME_DIR/.hermes/skills/zcash/SKILL.md" · check "unit-air-zec-sync" systemctl is-active --quiet air-zec-sync.timer
infra/template/skills/zcash/SKILL.md         agent-facing skill (no send command); copied by setup.sh's local-skills loop — nothing in base-skills.txt
apps/web/lib/chains/zcash/client.ts          `ZecBinary` seam: `interface ZecBinary { run(boxId, args: string[], timeoutSeconds): Promise<CommandResult> }`. The real one builds `sudo -u zcash air-zec <sub> …` with `shellQuote` on every argument and calls `box.command(boxId, cmd, 300)`; every subcommand prints exactly one JSON object on stdout; the test fake replays `__fixtures__/*.json`.
apps/web/lib/chains/zcash/nonce.ts           exec-nonce HMAC over `ZCASH_EXEC_SIGNING_KEY` (required when `ZCASH_ENABLED`, no fallback — it gates spending), separate `exec` / `init` HMAC domains, result token, 2-min expiry
apps/web/lib/chains/zcash/read.ts            balance / addresses / height from snapshot.json via `readFile` — display only; called from `lib/wallet/read.ts`
apps/web/lib/pay/rails/zcash.ts              zcashRail: validateAddress, balance (snapshot), request (ZIP-321), previewSend (propose + caps), submitSend (exec via nonce), tick (list-tx reconcile, expiries)
apps/web/app/api/wallet/zcash/route.ts       box/owner (`requireBoxOrOwner`, the trade route pattern): resource=balance|address|requests ; action=request|propose (propose: `requireInteractiveRun`, WF8)
apps/web/app/api/wallet/zcash/exec-claim/route.ts   nonce-only auth (§9.4); a gateway-token-only call is 401
apps/web/app/api/wallet/zcash/init-claim/route.ts   exec-claim's init-only twin (§9.3): nonce-only auth, `{userId, nonce}` → `{wrap_secret}`; single use via the `user_chain_keys` primary-key insert
apps/web/app/api/wallet/zcash/exec-result/route.ts  result-token auth; accepted once
apps/web/lib/miniapps/apps/pay.tsx + /home Wallet panel   "ZEC" block: shielded balance, newest UA + QR (`addressQrDataUrl(uri)`, `lib/wallet/qr.ts`), requests, sends; the owner approves a `zcash_send` from the "To pay" list via `resolveDecision`
supabase/migrations/<next free number at merge>_zcash_sends.sql   W5's own file (§9.5); nobody edits 0141
```

`.agents/skills/zcash` already exists; W5 updates it when the exec contract changes.
`/zec address|balance|request …|send …` parses in W0's `lib/pay/parse.ts` into the same
`PayCommand` with `rail:'zcash'` (no second parser — `/zec` is sugar for `/pay … zcash`)
and dispatches through `runPayCommand` → `zcashRail`.

### 9.3 Wallet lifecycle (in the Box)

- **Init** (provisioning step when `ZCASH_ENABLED`, or the first `/zec address`;
  owner-interactive, never from a cron): the control plane mints an init nonce
  (`nonce.ts` `init` domain, bound to the user id, 2 min) and runs `sudo -u zcash
  air-zec init --network test|main --server
  https://testnet.zec.rocks:443|https://zec.rocks:443 --nonce <n> --api <origin>`
  (the `--server` string comes from the §14 `ZCASH_LIGHTWALLETD[_TESTNET]`
  accessors `env.zcashLightwalletdTestnet()` / `env.zcashLightwalletd()`, the origin
  from `env.appOrigin()`; the rail never reads `process.env` — `lib/env.test.ts`;
  `--network` follows WF2 and `ZCASH_LIVE_ENABLED`). The binary claims at `POST
  /api/wallet/zcash/init-claim {userId, nonce}` — `exec-claim`'s init-only twin (same
  `nonce.ts`, same nonce-only auth and 401s, no send row): the control plane
  generates a 32-byte wrap secret and **inserts** the sealed
  `user_chain_keys (user_id,'zcash',network,'wrap_secret')` row — the primary key is
  the single-use flip (a second claim is 23505 → 409) — and returns `{wrap_secret}`
  in the response body. `air-zec` generates the 24-word seed, encrypts it to a fresh
  `age` identity, stores the identity under HKDF(wrap_secret, `/home/user/.air-zec/salt`),
  zeroizes, sets birthday = current chain height (short first sync), writes
  `wallet.sqlite` + `blocks/` under `/home/user/.air-zec/` (zcash:zcash 0700) and
  prints `{address, birthday}` to stdout; the control plane writes the first UA to
  `user_chain_keys.address`. Re-init is allowed only while `address` is null and the
  Box has no identity file; a row with `address` set is never replaced. **No
  `display-mnemonic` in v1**: `readFile` is itself `command()`, so the seed would
  transit a command result and a browser (C18). zcash.md says seed export is not
  available yet; mainnet waits for a backup path that stays on the Box (§15.7).
- **Sync**: `air-zec-sync.timer` runs `air-zec sync` every 2 minutes while the Box is
  awake (`update_chain_tip → suggest_scan_ranges → scan_cached_blocks → enhance`) and
  writes a value-free status (`height`, `synced_at`), the balance summary and
  `addresses[]` to `/home/user/.hermes/miniapps/zcash/snapshot.json` **atomically**
  (tmp + `mv`) in the directory setup.sh pre-created (`install -d -o zcash -g user
  -m 0750`). The unit's `ExecStartPre=+/bin/sh -c 'chown -R zcash:zcash
  /home/user/.air-zec; chown -R zcash:user /home/user/.hermes/miniapps/zcash'`
  re-asserts exactly those owners after a root-owned hydration — the snapshot
  directory is never chowned `zcash:zcash`, so `user` (agent; control plane via
  `readFile`, an unprivileged `cat` as `user`) can read it. The control plane never
  takes the miniapp state lease for it, and **no agent-writable file feeds money
  logic** — the snapshot is for display only. Ironwood (NU6.3, mainnet since
  2026-07-28) is handled by the crate wave; UAs are encoded by the pinned library
  (check the pinned `zcash_client_sqlite` release — main encodes Rev 0 where
  representable since 2026-10-06); the parser accepts `u1`/`utest1` and Rev 2 `zu`/`tu`
  with expiry metadata; the spec never hand-rolls pool selection (ZIP 326 forbids
  sending to other wallets' legacy Orchard receivers — the library enforces it).
- **Addresses**: `air-zec address --new` → a fresh UA (`utest1…` on testnet, `u1…` on
  mainnet) appended to `snapshot.json.addresses[]`; the agent shows the newest.
- **Requests** (ZIP-321): `/zec request 1.5 memo "October rent"` (= `/pay request
  1.5 ZEC on zcash memo "…"`) → `air-zec request --amount 1.5 --memo … --label Air`
  → `zcash:utest1…?amount=1.5&memo=<base64url, no padding>&label=Air`; the control
  plane renders the QR (`addressQrDataUrl(uri)`, `lib/wallet/qr.ts` — it encodes any
  string, so it gets the ZIP-321 URI) and files
  `payment_requests (currency='zec', rail='zcash', direction='receive',
  receive_address=UA)` — several may be pending, as today. `tick()` flips `paid`
  (`tx_ref = txid`, `paid_amount`) **only** from `air-zec list-tx --since <height>`
  output executed by the control plane via `command()`, matched on UA + amount
  (+ memo when present), then texts the owner via `deliverPayEvent` (W2a; stubbed in
  W5a's fixtures until merged — W5a runs in parallel with W2a). `tick()` runs only
  for users with a pending `zec` request or an in-flight send, and only on a Box
  whose `getBox` state is `ready` or `idle` (a `stopped`/`stopping` Box is skipped,
  never resumed; `BoxState` in `lib/box/types.ts` has no `running`).
- **Arguments**: every interpolated `air-zec` argument (`--to`, `--memo`, `--value`,
  `--amount`, `--label`) goes through `lib/box/shell.ts shellQuote`; memo ≤ 512 bytes,
  no control characters (test); `command(boxId, cmd, 300)` — never the 60 s default.

### 9.4 Send: stage → approve → exec

1. `/zec send 0.1 to utest1… memo "rent"` (= `/pay 0.1 ZEC to utest1… on zcash memo
   "rent"`, the Pay form, or the agent via `POST /api/wallet/zcash {action:'propose',
   to, amount, memo}` — interactive origin only, WF8) → `zcashRail.previewSend` runs
   `sudo -u zcash air-zec propose --to … --value <zatoshis> --memo …` in the Box:
   validates the address (`ZcashAddress::try_from_encoded`, rejects transparent-only
   + memo), computes a **ZIP-317 proposal** (`propose_transfer` with
   `GreedyInputSelector` and `MultiOutputChangeStrategy`), returns `{ fee_zatoshis,
   total, proposal_hash, spendable, anchor_height }` — no key is touched. **Caps fail
   closed** (WF7): `ZCASH_PER_SEND_CAP_ZEC` / `ZCASH_DAILY_CAP_ZEC` (daily summed over
   `zcash_sends` in `claimed|submitted|confirmed`) always; the owner's `pay_caps` USD
   caps (`assertPayCaps`) at a rate the **control plane** fetched from one
   C5-allowlisted rate host that W5a adds to the registry's zcash `hosts` (≤ 15 min
   cache; candidate `api.coinbase.com` `/v2/prices/ZEC-USD/spot` — today that host
   appears only as the brokerage target in `lib/trade/service.ts`, not in any
   registry `hosts` list, and no §14 row names it). On mainnet no rate → refuse with
   "can't price ZEC right now"; on testnet the USD leg is skipped (testnet ZEC has
   no price). Never a Box-supplied rate, never 0 when unknown. A pending send → 409
   naming it (WF5). Row `zcash_sends (previewed → pending_approval, expires_at =
   now()+5 min)` + `zcash_send` decision with `ref` = row id and the value-free
   payload `{ rail:'zcash', network, token:'ZEC', amount_display, to_hint (first 20 +
   last 6), memo_present, fee_estimate_zec, expires_at }`, rendered by
   `lib/approvals/moneyCard.ts` (`0.1 ZEC on Zcash testnet`) (WF6).
2. Approve → `resolveZcashSend`. W0's 0141 carries the kind (and the
   `HOSTED_KINDS`/`loadHostedApproval` view entry); W5a lands the `zcash_send` arm in
   `lib/decisions/resolve.ts` and `lib/approvals/hosted.ts` (`resolveHostedDecision`
   arm) in one PR (W0 already added the `approve-client.tsx` kind-union entry and the
   needs-panel label), with a test that it resolves through both chains. It re-reads the row, refuses `expired` past
   `expires_at`, CAS `pending_approval → executing` (0 rows → 409), mints `nonce =
   HMAC(ZCASH_EXEC_SIGNING_KEY, 'exec' ‖ sendId ‖ proposal_hash ‖ exp(2 min))`, and
   calls `zcashRail.submitSend` → `sudo -u zcash air-zec exec --send <id> --nonce
   <nonce> --api <origin>` through the `ZecBinary` seam (300 s). The Zcash lane keeps
   its own row and CAS because the memo and the key never leave the Box: it is the one
   chain send that does not ride `wallet_transfers`/`executeTransfer`, and it reuses
   that lane's vocabulary (`submit_unknown` terminal, `expires_at` sweep, 409 on a
   pending send).
3. `air-zec exec` **first** calls `POST /api/wallet/zcash/exec-claim {sendId,
   nonce}`. Authentication is the HMAC nonce **alone** — a control-plane-minted,
   2-minute, single-use capability bound to the send; a `zcash`-uid process cannot
   read the gateway token in `~/.hermes/.env` and never tries. The route resolves
   user and box from the row (no `tryBoxPrincipal`), verifies HMAC + expiry,
   atomically flips `executing → claimed` (second claim 409; gateway-token-only,
   forged or expired nonce 401 — never 403), stores `sha256(result_token)` and
   `claimed_at` on the row, and returns `{wrap_secret, result_token}` in the HTTPS
   response body — never logged (`expectLog`). Only then does the binary unwrap the
   identity, re-propose, assert the proposal hash is unchanged (else `exec-result
   {state:'expired'}` and no signature), `create_proposed_transactions` with the
   bundled prover and `OvkPolicy::Sender`, zeroize the wrap secret, and
   `send_transaction` to lightwalletd. It posts `exec-result {sendId, result_token,
   state:'submitted', txid}` (accepted once; 401 on a bad token) and prints the same
   JSON to stdout; `submitSend` returns `{state:'submitted', txRef: txid}` from
   whichever arrives first → row `submitted`. `tick()` reads the mined height from
   the control-plane-executed `list-tx` → `confirmed` after 1 confirmation (testnet)
   / 3 (mainnet).
4. Broadcast ambiguity — the command exits 124, the transport drops, or no
   `exec-result` arrives within 5 minutes of `claimed_at` — → `submit_unknown`
   (surfaced as "uncertain"), terminal, never re-executed; the next `list-tx` shows
   the txid or not and the owner is told. A failure before the claim (proposal drift,
   refused nonce) → `failed` with `error_code`; a used nonce is never reusable.
5. Deny / expiry (`expires_at`, swept by `/api/cron/pay-rails`) → `denied` / `expired`;
   the nonce is never minted.

### 9.5 Tables

W5's own forward-only migration, numbered at merge time. The `zcash_send` kind and
`user_chain_keys (kind='wrap_secret')` already come from `0141`.

```sql
create table zcash_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  decision_id uuid references decisions(id) on delete set null,
  network text not null check (network in ('mainnet','testnet')),
  to_address text not null, amount_zat bigint not null, memo_present boolean not null default false,
  fee_zat bigint, proposal_hash text not null,
  state text not null check (state in ('previewed','pending_approval','executing','claimed','submitted','confirmed','denied','expired','failed','submit_unknown')),
  txid text, error_code text,
  result_token_hash text, claimed_at timestamptz, expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index zcash_sends_pending_idx on zcash_sends (user_id) where state in ('pending_approval','executing','claimed');
create unique index zcash_sends_txid_idx on zcash_sends (txid) where txid is not null;
alter table zcash_sends enable row level security;   -- service-role only, no policies (the 0141 pattern)
-- value-bearing memo text never leaves the Box; Postgres stores memo_present only (C4/C18).
```

### 9.6 Why this is the trust boundary

- Spending needs both halves: the wrapped identity (Box, `zcash:zcash` 0700, in the
  snapshot) and the wrap secret (control plane, sealed, released only by `exec-claim`
  after an owner-approved send). Neither side alone can spend — the control plane
  never holds a seed or spending key; the Box never holds the wrap secret at rest.
- The agent (`user`, root-capable) can run `propose` (read-only + proposal). `exec`
  without a claimable nonce exits before touching the key; the nonce exists only after
  the owner's tap; a second claim is refused.
- What a compromised agent **can** do: stage a send (the owner sees a card), read the
  wrapped identity (useless), and — only during the window of an approved send,
  between claim and zeroize — reach the unwrapped key inside the `air-zec` process.
  That window is bounded to the one send the owner approved; it is not zero. No
  sudoers rule, Unix user or file mode changes that, and the spec claims nothing more.
- This is WF1's stage → approve → resolver with the signer on the owner's own
  machine, bounded by the nonce: T1 for a chain whose stack cannot live in a
  serverless control plane.

### 9.7 Acceptance (§12 W5)

- **Control plane (W5a; `npm test`, no Rust)**: `chains/zcash/nonce.test.ts` (HMAC,
  `exec` vs `init` domain separation, send-id / user-id binding, expiry, single
  claim); `chains/zcash/client.test.ts` (`ZecBinary` fake replays recorded `air-zec`
  JSON; every argument shellQuoted — a memo containing `'` and `$(…)` round-trips as
  data; timeout 300 passed through); `rails/zcash.test.ts` (state machine;
  `submit_unknown` terminal on exit 124 / dropped transport / no exec-result; `paid`
  only from `list-tx`, never from `snapshot.json`; ZEC caps; USD caps refuse without
  a rate on mainnet and skip on testnet; 409 on a pending send; `expired` sweep;
  `tick()` skips a Box whose state is not `ready`/`idle` without resuming it;
  `deliverPayEvent` mocked); route tests: `exec-claim` (409 on second claim, 401 on
  a gateway-token-only call, 401 on an expired or forged nonce, body carries
  `wrap_secret` and nothing is logged), `init-claim` (409 on a second claim via the
  `user_chain_keys` primary-key insert, 401 on a bad nonce), `exec-result` (401 on a
  bad `result_token`, accepted once); `resolve.test.ts` + `hosted.test.ts`
  (`zcash_send` dispatches through both chains); `pay/parse.test.ts` (`/zec
  address|balance|request|send` → `PayCommand { rail:'zcash' }`). Fixtures under
  `lib/chains/zcash/__fixtures__/` are recorded from the crate once it exists; until
  then they are hand-written to the one-JSON-object-per-command contract in §9.2.
- **Rust (W5b; the `rust` CI job)**: `cargo test` in `infra/template/air-zec` —
  ZIP-321 grammar (memo base64url without padding; transparent + memo rejected;
  unknown `req-` rejected); proposal hash determinism; `exec` refuses without a claim;
  `exec` refuses on proposal drift; the wrap-secret buffer is zeroized after signing;
  `exec` never reads `~/.hermes/.env`.
- **Testnet gate (owner; needs the baked binary)**, beats ordered by ZEC needed: init
  → `/zec address` (`utest1…` + `zcash:` QR) → `/zec request 0.01` → a forced
  `air-zec exec` without a claimable nonce exits before the key (zero ZEC) → fund from
  a testnet faucet, `/zec balance` after sync → the request paid from another testnet
  wallet flips to `paid` within one cron tick → `/zec send 0.005 to utest1…` approve →
  txid on a testnet explorer; a second `exec` with the same nonce is refused. If
  `air-zec` is not baked by submission, every binary-backed `/zec` row moves under
  "What we document but do not ship yet" in zcash.md (the solana.md heading) and the
  page's Status line says `planned`.
- **Mainnet** stays off for the submission; §15.7 holds the gate (a Box-resident seed
  backup path, the rate host allowlisted with fail-closed caps verified on testnet,
  the 3-confirmation policy, `ZCASH_LIVE_ENABLED` reviewed).

---

## 10. W6 — Docs and skills (½ session, runs alongside everything)

- `docs/site/index.md` (slug `/docs/worlds-fair`), `solana.md`, `tempo.md`,
  `hyperliquid.md`, `zcash.md`, `formation.md`, `evm-chains.md` are the source of truth
  for `air.wzrd.tech/docs/<slug>` (slug from each file's front-matter). The operator
  mirrors them to the docs site (Mintlify) exactly as `docs/muse-connector.md` is
  mirrored to `/docs/muse`; a page is "done" when the public URL matches the repo file
  byte-for-byte modulo front-matter.
- **Status line.** Until a rail's session lands, its page carries a visible
  `Status: shipped | testnet | planned` line directly under the H1 — body text, not
  front-matter (the mirror strips front-matter). At the submission pass (§17):
  `evm-chains` → `shipped`; `hyperliquid`/`tempo` → `testnet` once W1a/W2a merged,
  else `planned`; `solana`/`zcash`/`formation` → `planned` unless W3a/W5a merged, and
  even then only their landed rows change. Every unshipped row moves under a
  `## What we document but do not ship yet` section (the `solana.md` convention; add
  the section to `tempo.md`, `zcash.md`, `hyperliquid.md`, `formation.md`).
- Each page carries the commands a judge can type, the invariants, the network table,
  and the official links from the Colosseum corpus; nothing on a page describes
  unshipped behavior as live — update the page in the same PR as the feature. Copy
  rules on pages: "reminds you before", never "never miss"; no "guaranteed", no
  "we will" (WF9); one read spelling everywhere — `/pay <rail> balance`,
  `/pay <rail> address` (`solana.md` `/wallet solana` → `/pay solana balance`);
  `zcash.md`/`index.md` keep `/zec …` with one line "shorthand for `/pay … zcash`".
  Optional per page: a short "For judges" block — the primitive in the corpus's own
  name, the network chip, the three commands, the sponsor touched,
  `[video timestamp: TBD]`.
- Page-specific corrections this pass: `hyperliquid.md` connect row + code block
  rewritten to v1 (paste the API-wallet key + master address; `privateKeyToAccount` +
  `userRole`/`extraAgents` check; the Air-generated-key snippet under "Later"), the
  blast-radius line "cannot withdraw or send to other addresses; Air's own signing code
  can only produce spot order/cancel actions" (the wrapper exposes exactly `order` +
  `cancelByCloid` under a grep test, asserts the `assetId` range, sets `expiresAfter`),
  and Disconnect copy "Air deletes its copy but cannot revoke the approval" linking the
  API page; `tempo.md` Wallet paragraph (per-user sealed secp256k1 key, testnet-only,
  mainnet gated on the access-key model) and the standing-budget sentences marked
  "next"; `zcash.md` custody text per §9 (`air-zec`, no sudoers claim, seed export "not
  yet"); `solana.md` transaction v0 + hand-built Solana Pay snippet, "Phantom (a Solana
  track sponsor)", and lines 23/78 (charges paid "under a standing budget") reworded to
  "next, after access keys"; `formation.md` name check "optional — enter the result if
  you checked the registry", perks named + "mention Crypto World's Fair at checkout"
  (no code exists), line 92 `/pay request 2,500 USD from acme@example.com` →
  `/pay request 2,500 USD` "Stripe Link checkout (payee entered on the card)" (the
  `from …` tail is not a canonical form and would fail the §17.6 fenced-command
  check), "documents are kept in your Box's formation folder; the EIN goes in your
  Vault", tiles "tap them; your agent can update them when a provider email arrives";
  `index.md:23` / `formation.md:18` "reminds you before the 83(b) deadline".
- There is no docs lint. The W6 gate is the manual pre-submission check in §17.6;
  `scripts/check-docs-site.sh` + a vitest `docs-site.test.ts` (every fenced `/trade`,
  `/pay`, `/zec` line matches a merged parser; relative links resolve) are P1 after
  W0's `lib/pay/parse.ts` exists.
- `.agents/skills/air-worlds-fair` routes **Devin only** (the Box never receives
  `.agents/skills`); regenerate its non-negotiables from §2 with the spec's own
  numbering (WF1–WF9). `.agents/skills/zcash` is repo-authored, not in the lock; the
  installed sponsor skills are pinned in the root `skills-lock.json`.
- Box skills landing in `infra/template/skills/<name>/SKILL.md`: `trade` (updated),
  `pay-rails`, `machine-pay`, `zcash`, `formation`. To add one: create the directory
  with a `SKILL.md` whose front-matter `name:` equals the directory name; `setup.sh`
  ("Bake local skills" loop) and `sync-box.sh` step 1 copy every `skills/*/` dir
  automatically — do **not** edit `base-skills.txt`, `skills-manifest.py` or
  `BASE_SKILLS` in `lib/skills/hub.ts` (hub-skill identifiers). Read env as data
  (`OPENAI_BASE_URL="$(grep -m1 '^OPENAI_BASE_URL=' ~/.hermes/.env | cut -d= -f2-)"`,
  as `trade/SKILL.md` does), never `source`/`.`/`eval` it —
  `apps/web/lib/security/templateSkillEnv.test.ts` (TC-05) fails otherwise. Add one
  line per skill (including the existing `trade`) to `infra/template/verify-box.sh`
  after the `skill-kernel-browser` check:
  `check "skill-<name>" test -f "$HOME_DIR/.hermes/skills/<name>/SKILL.md"`.
- Commits: `R-WF-06: …` (§12).

---

## 11. Box skills — contract

All five skills follow `infra/template/skills/trade/SKILL.md`: derive `BASE` from
`OPENAI_BASE_URL` read with `grep|cut` (TC-05), authenticate with the gateway token,
**stage only**, tell the owner the card is waiting, stop. Hard rules every skill
repeats verbatim:

1. Never present a preview as executed.
2. One approval at a time per lane; a second request is refused with the pending one named.
3. An uncertain result (`submit_unknown`) is terminal; report it, never retry.
4. Reads are free; anything that moves value is a decision.
5. Name the network on every line ("on Tempo testnet", "on Hyperliquid testnet").
6. Never `source`/`eval` `~/.hermes/.env`; read it as data.
7. Every agent-paid charge lands `pending_approval`; there is no standing budget and
   no auto-pay branch in this window (§15.10).

| Skill | Calls | Notes |
|---|---|---|
| `trade` (updated) | `GET/POST /api/trade` as today; `/trade connect [coinbase\|hyperliquid]` | Copy names the venue, never "Coinbase" by default; chips and portfolio strings come from the active connection's `provider` |
| `pay-rails` | `GET /api/pay?resource=balance\|requests`; `POST /api/pay {action: preview\|propose\|request}` (`requireBoxOrOwner` + `requireInteractiveRun`) | Canonical lines `/pay <amount> <token> to <addr> on <rail> [memo …]`, `/pay request …`, `/pay <rail> balance`, `/pay <rail> address`, `/pay help`; W3a adds the owner-only arm `/pay solana address set <addr>` (base58 `^[1-9A-HJ-NP-Za-km-z]{32,44}$`, writes `users.solana_address`) to the same parser; `/zec …` is sugar for `/pay … zcash`; anything else goes to the agent (`{kind:'agent'}`). `link-payments/SKILL.md` is updated to point tempo/solana sends at `/api/pay`; `POST /api/miniapps/commerce {action:'payment_request'}` (usd/usdc) stays |
| `machine-pay` | `POST /api/pay {action:'machine', url, method, body?}` | The control plane probes the URL through the SSRF-guarded helper (§6.5; reuses `isPublicAddress`/`resolvesOnlyPublicAddresses` from `lib/kernel/purchases.ts`) and writes `previewed → pending_approval` + one `machine_payment` decision; the skill never pays, never retries a 402 itself; the paid body arrives in the Box via `writeFile` after `resolveMachinePayment` |
| `zcash` | `air-zec balance\|address\|request\|propose\|sync` (the timer's command) and `POST /api/wallet/zcash {propose}` | The agent has **no** send command. `air-zec exec` is the same binary's exec subcommand, runnable only with a single-use nonce minted by `resolveZcashSend` (§9.4); the wrap secret arrives in the `exec-claim` HTTPS response, never on argv or a file. Honest statement (§9.6): a root-capable compromised agent can stage (the owner sees a card) and could only reach the key during an owner-approved send |
| `formation` | `GET/POST /api/formation` (`requireBoxOrOwner` — the skill calls it with the gateway token; only the mini-app render is owner-only), `[card: formation]` | The route and the module's `action()` share `lib/formation/store.ts`; name check via a MAIN_SESSION run; provider mail treated as status only from the `lib/formation/providers.ts` allowlist; documents saved under `.hermes/miniapps/formation/documents/`; never "legal advice" |

verify-box: one `check "skill-<name>"` line per skill (incl. `trade`); W5b adds
`check "air-zec" command -v air-zec` and
`check "unit-air-zec-sync" systemctl is-active --quiet air-zec-sync.timer`.

---

## 12. Verification

Standard per session: `cd apps/web && npm run typecheck && npm run lint && npm test
-- --run && npm run build`, then `npx vitest run --coverage` before the PR (42% global
line floor; `lib/wallet/**` 46% — new rail readers go in `lib/chains/<rail>/read.ts`
and are called from `lib/wallet/read.ts`, never implemented inside `lib/wallet/**`;
`lib/decisions/**` 46, `lib/approvals/**` 56). Modules that log use `expectLog`
(`vitest.setup` fails on unexpected console output). `lib/env.test.ts` (grep guard +
manifest coherence) fails any `process.env` read outside `lib/env.ts` (§14).

- **Commit ids.** Subjects start `R-WF-0<n>:` (W0 → `R-WF-00`, W1a/W1b → `R-WF-01`,
  W2a/W2b → `R-WF-02`, W3a/W3b → `R-WF-03`, W4 → `R-WF-04`, W5a/W5b → `R-WF-05`,
  W6 → `R-WF-06`). `scripts/check-commit-ids.sh` (`ID_PATTERN`
  `R-[A-Z][A-Z0-9]*-[0-9]+|…`) runs in the `commit-ids` CI job on every PR over
  every commit in `${BASE_REF}..HEAD`, so `W1: …` fails there. Amend or
  `chore:`-prefix this branch's **three** "World's Fair: …" commits (`5656db4`,
  `05786c4`, `21754b1`) before opening its PR — one unamended subject fails the job.
- **Migrations.** The `migrations` job runs `scripts/apply-migrations.sh` against a
  scratch Postgres, re-runs it expecting `Done: 0 migration`, runs
  `supabase/tests/*.sql` (`rls_all_tables.sql` must see RLS on every new table), and
  `scripts/test-apply-migrations.sh` fails an edited applied file — nobody edits
  `0141` after it applies; later sessions ship their own forward-only file (§13).
  Every new `references users(id)` declares `on delete cascade|set null`
  (`lib/admin/deletion.test.ts`). `deploy-migrations` is **not** automatic: it runs
  only on a main push that touched `supabase/migrations/` (the `migration-diff` job),
  after `metering`/`migrations`/`web` are green, and under `environment: production`,
  which waits for a required reviewer to approve the environment deployment in the
  Actions run (R-P0-5). Applying `0141` to production is therefore a human step
  right after the W0 merge (§13, §17.1 item 8).
- **Cron.** `/api/cron/pay-rails` uses `requireCron` from `lib/auth/guard.ts`, gets a
  row in `apps/web/vercel.json` and a block in `app/api/cron/cron.test.ts` (R-TQ-07).
- **Box.** `verify-box.sh` sees the new `skill-<name>` lines (§11); TC-05 passes.
- **Decision kinds.** Every new kind (`machine_payment`, `zcash_send`,
  `formation_submit`; `pay_policy` dormant) lands in `resolve.ts`, `hosted.ts`
  (`HOSTED_KINDS` + the `loadHostedApproval` view + a `resolveHostedDecision` arm) and
  the approve-client union in the same PR as its arm, with a test that it resolves
  through BOTH chains — W2b (`machine_payment`), W4 (`formation_submit`), W5a
  (`zcash_send`). A kind in one chain only silently flips without executing or 404s
  on the hosted link.
- **Acceptance** = colocated Vitest fixtures (recorded venue/RPC responses, no
  network) under `npm test`. Live-box scripted turns are a separate, non-`npm test`
  layer: two cases per shipped rail (approval, denial) appended to
  `evals/agent-suite/messages.jsonl` after adding a `money` entry to `CATEGORIES`
  and `'trade_order','machine_payment','pay_policy','zcash_send','formation_submit'`
  to `DECISION_KINDS` in `evals/agent-suite/lib.ts`; run with
  `EVAL_ONLY=WF-HL-01,… npx tsx evals/agent-suite/run.ts` then `score.ts`.
  Balance-language and chained-decomposition cases are reserved P2 ids
  (`WF-<RAIL>-03/04`). No trade eval fixture exists (`TRADE_EVAL_FIXTURE` is a
  plan.md name only); there is no `WF_EVAL_FIXTURE`.

| Session | Unit (colocated Vitest, no network) | Resolver / integration | Manual gate before any `*_LIVE_ENABLED` |
|---|---|---|---|
| W0 | `chains/registry.test.ts` (every rail resolves testnet by default; `liveEnabled` flips only via `env.*` accessors; `explorerTx` only where verified); `pay/parse.test.ts` (every canonical arm; `/payment` and `/pay\n` not matched; comma amounts; memos > 32 bytes refused; `{kind:'agent'}` fallback; `/zec …` → `rail:'zcash'`; no `/pay policy`; the `/pay solana address set <addr>` arm and its case are added by W3a); `pay/imessage.test.ts` + `flush.test.ts` + `chat/route.test.ts` (owner-only dispatch at both sites); `pay/caps.test.ts`; `pay/rails/index.test.ts` (`railFor`, `baseRail` wraps `sendWalletTokens`); `wallet/send.test.ts` (`createTransferRequest` new args + `expires_at` + 409 on 23505; `prepare` throw releases the claim; `submitSend` throw → `submit_unknown`, never released; `expired` past `expires_at` refused before the CAS); `auth/origin.test.ts` (no open run → 403; open cron/email/mcp/job → 403; imessage tier 1 → 403, tier 0 → ok; web/desktop/voice → ok; stale > 15 min → 403; owner → never consulted) + a static import-specifier test that cron routes import no `preview*`/`propose*`; `trade/prices.test.ts` (`coinbasePublicPrices` wraps coinbase.ts; `publicPricesFor` quote rule with the HL impl stubbed); `trade/parse.test.ts` connect venue tail; `env.test.ts`; `cron.test.ts` pay-rails block; `lib/decisions/resolve.test.ts` (an unhandled kind is left untouched, no flip); `lib/admin/deletion.test.ts` decisions-kind assertion mirroring the card-kind one; SQL test in `supabase/tests/` that a row with an unlisted kind is refused by `decisions_kind_check`; `node -e "require.resolve('viem/tempo')"` + `npm ls viem` | `previewTrade` writes `trade_orders.venue`; `getTradeConnection` selects `active = true` and surfaces errors; `requireInteractiveRun` retrofitted into `POST /api/trade {propose,cancel}`; needs-panel labels + approve-client union + `HOSTED_KINDS` entries for the new kinds compile (view only — each session's arm adds the "dispatches in BOTH chains" test with the arm) | — |
| W1a | `hyperliquid/format.test.ts` (price/size rules incl. 5-sig-fig + `8−szDecimals`, `"0"` refused, cloid from uuid, lowercase); `venue.test.ts` on recorded `spotMetaAndAssetCtxs`/`spotClearinghouseState`/`order`/`orderStatus` fixtures: `order()` rejecting with `ApiRequestError` whose message carries the per-order error → `TradeVenueError(400,'order_rejected')`; `{filled}` → `{orderId: cloid, status:'filled'}`; `{resting}` → `submitted`; `TransportError` propagates (never a result on timeout); `getOrder` normalization; `unknownOid` → 404 `not_found`; `bad_preview` without `preview.raw`; `assetId` range assertion (`10000 ≤ assetId < 100000`, `assetId − 10000` = `spotMeta.universe` index); every order sets `expiresAfter`; grep test that `hyperliquid/client.ts` exposes only `order` + `cancelByCloid` + Info reads; `service.test.ts`: `venueFor` switches on `provider`, `hyperliquidCredentials` opens `secret_sealed`; `prices.test.ts`: `hyperliquidPublicPrices` resolves `HYPE` → `HYPE/USDC` → `@n` before indexing `allMids`, `publicPricesFor` picks HL for `-USDC`/active HL; paper on `allMids`; `tape.test.ts` mock moved to the seam | double-approve → one submit; resolver binds to `trade_orders.venue` (409 `venue_changed`); `orderStatus(cloid)` reconciliation on a recorded fixture; `unknownOid` leaves the row alone; `uncertain` stays terminal (C23) | — (fixture-green only; the testnet gate is W1b's) |
| W1b | Settings venue picker/connect form tests (write-only key, last-4 hint, `userRole`/`extraAgents` check on a fixture); `tape.test.ts` candles via `candleSnapshot` 1m/90 min, no cache; `watch.test.ts` `-USDC` accepted | `/trade connect hyperliquid` → sealed row with `provider='hyperliquid'`, `active=true` | Testnet with `TRADE_LIVE_ENABLED=true`, `HL_LIVE_ENABLED=false`, `TRADE_ALLOWLIST=<demo user>`: one $10 IOC buy of whichever USDC spot pair testnet `spotMeta` lists (`HYPE-USDC` if present, else `PURR-USDC`) — never hardcode the pair or its index; one cancel via each approve surface; one forced timeout → `uncertain`; `builderFee` on the fill if §15.3 is on |
| W2a | `chains/tempo/signer.test.ts` (a `raw_secp256k1` row refuses to open whenever `chainFor('tempo').network === 'mainnet'`, regardless of `TEMPO_LIVE_ENABLED`); `pay/rails/tempo.test.ts` (memo encoding ≤ 32 bytes, fee estimate, `sponsored` flag, receive-policy check → `redirected`, `transaction_id` = `chainId:hash:logIndex`, `tx_ref` dedupe, watcher matches token+to+memo+amount ≥ requested on recorded `getContractEvents`); `pay/imessage.test.ts` `deliverPayEvent`; `app/api/pay/route.test.ts` (GET `balance\|requests`; `requireInteractiveRun` called after auth for `preview\|propose\|request\|machine`); `user_chain_keys` sealed signer + faucet path on a fake client | `executeTransfer` CAS → `tempoRail.prepare` → `submitSend` returns `{state:'submitted'\|'redirected', txRef}` and the row records it; throw after the CAS → `submit_unknown`; `tick()` marks the mirror request paid exactly once; pay.tsx "To pay" Approve → `resolveDecision` on the `run_approval`; "Getting paid" list renders address + memo + amount as text (no wallet is documented to parse the EIP-681 URI) | Moderato: faucet → `/pay 1 USD to 0x… on tempo memo INV-1` sponsored → receipt line with `explore.testnet.tempo.xyz/tx/<hash>` → watcher flips the mirror request to paid, owner texted |
| W2b | `payments/mpp.test.ts` with an injected `Mppx` (`Mppx.create` without `feePayer`; `charge({ amount: String(app.x402_price_usdc) })`; 402 carries both challenges; `x402_receipts` row inserted **before** the session; 23505 after settlement → 402 "already redeemed", never a session; method omitted when `users.tempo_address` is absent; the Base `accepts` entry never depends on the new columns; one call site in `x402.ts` keyed on `Authorization: Payment` vs `X-PAYMENT`; `lib/miniapps/gates.ts` untouched); `pay/machine.test.ts` (challenge normalization x402/MPP → `challenge_fingerprint`; every machine charge lands `pending_approval`; price-changed → `expired`; one test per fetch rejection: http, private/loopback IP, DNS resolving private, 3xx with `redirect:'manual'`, Air-host denylist incl. `*.on.ascii.dev`, > 1 MB, > 10 s) | `machine_payment` dispatches in BOTH chains (`resolve.ts` + `hosted.ts`: `HOSTED_KINDS` + `loadHostedApproval` view + `resolveHostedDecision` arm + approve-client union), mirroring the W4/W5a rows; `resolveMachinePayment` re-fetches, compares the challenge fingerprint, stores the body in the Box via `writeFile`; the human page renders exactly one primary CTA | Moderato: `npx mppx <mini-app url>` (or the `mppx/client` snippet with `testnet: true` if the CLI has no testnet payer) against Air's own priced mini-app opens a paid session; `npx mppx --inspect` shows the challenge; `x402_receipts.protocol='mpp'` |
| W3a | `pay/solanaPay.test.ts` (hand-built `solana:<recipient>?amount=&spl-token=&reference=&label=&message=&memo=`; amount ≤ 6 decimals; URL-encoding; `reference = (await generateKeyPairSigner()).address`); `pay/rails/solana.test.ts` watcher on recorded `getSignaturesForAddress`/`getTransaction` (`maxSupportedTransactionVersion: 0`; `meta.err !== null` ignored; post − pre token balance for `{owner: recipient, mint: USDC}` ≥ amount, robust to Phantom's guard ix; dedupe on the unique `tx_ref`; 24 h expiry); `chains/solana/read.test.ts`; `users.solana_address` regex `^[1-9A-HJ-NP-Za-km-z]{32,44}$` on the owner-only settings write and on the `/pay solana address set <addr>` arm (added to `lib/pay/parse.ts` + `parse.test.ts` here; owner-only via the `senderTier !== 0` gate, never a model turn) | `tick()` flips the request to `paid` once; Wallet tab reads through `lib/wallet/read.ts` → `lib/chains/solana/read.ts` | Devnet: `/pay request 1 USDC on solana` → QR → Phantom (devnet) pays → `paid` within one cron tick |
| W3b | `x402.test.ts` untouched as the regression oracle; new `x402.solana.test.ts`: `buildSolanaPaymentRequirements` (`network:'solana-devnet'` on the v1 wire, devnet mint, `payTo = users.solana_address`, `extra.feePayer` from `useFacilitator().supported()`, `maxTimeoutSeconds: 60`); `payload.network` branch with `jti` = SVM signature; receipt `network` = registry CAIP-2; facilitator is a pure function of the entry's chain and no mainnet entry resolves to `x402.org`; `publisherPayTo` returns `{ base, solana, tempo }` each-or-null; `chains/solana/wallet.test.ts` pre-sign assertion at the single signing site (program allowlist; exactly one `TransferChecked` to the staged ATA/mint/amount; memo = request id; no top-level System ix; never `signMessage`); without `CDP_WALLET_SECRET` the rail is read-only (no raw-key fallback) | `executeTransfer` → `solanaRail.submitSend` (v0 tx, `sendAndConfirmTransactionFactory`, `confirmed`); timeout → one `getSignatureStatuses` → `submit_unknown`; MA11's red-team list is the gate | Devnet: `scripts/x402-solana-pay.ts` (`@x402/fetch` + `@x402/svm`, Circle-faucet-funded keypair) opens a priced mini-app; receipt row `protocol='x402'`, `network='solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'`; add the v2 `PAYMENT-SIGNATURE` branch only if the hosted facilitator rejects v1 SVM payloads |
| W4 | `formation/packet.test.ts` (completeness, zod); `decide.test.ts` (the three questions → recommendation matrix); `deadlines.test.ts` (83(b) = +30 d; `upsertLocalEvent` idempotent on stable `local:` ids; 21/7/2-day reminders as one-shot `agent_schedules`); `status.test.ts` (CAS `ready → submitted`; deny restores `ready`; `status.json` mirrored under `withStateLease`); `apps/formation*.test.ts` (owner-only render; `POST /api/formation` under `requireBoxOrOwner` sharing `lib/formation/store.ts` with `action()`; forbidden actions; submit requires `completeness.missing = []`; `promptBar` → `runPrompt` with `StartLimitError` handled; the perks line only when `FORMATION_HACKATHON_PERKS=1`) | `formation_submit` dispatches in BOTH chains (`resolve.ts` + `hosted.ts`); a checkout handoff is created by the run (`POST /api/checkout/handoff`, `task_id` = run id) and delivered with `POST /api/cards/checkout`; deny restores `ready` | A real walk to Stablecorp's checkout with the handoff engaged (no payment); the Status screen links the open handoff for a web-only owner |
| W5a | Control-plane half behind an injectable `ZecBinary` seam over `box.command(boxId, cmd, 300)` whose test fake replays recorded `air-zec` JSON — no Rust in CI: `chains/zcash/nonce.test.ts` (single-use, 2 min, bound to the send id); `pay/rails/zcash.test.ts` (`shellQuote` on every interpolated argument; memo ≤ 512 bytes, no control characters; caps ZEC-denominated and fail closed — no "0 when unknown"; `paid` only from control-plane-executed `list-tx`; `--server https://testnet.zec.rocks:443`); route tests for `exec-claim` (409 on a second claim; 401 for a gateway-token-only call; `{wrap_secret}` only in the HTTPS response body) and `exec-result`; `zcash_sends` state machine (terminal unknown state as §9.5 lists it) | `resolveZcashSend` dispatches in BOTH chains; `executing → claimed` is atomic | — (recorded JSON only) |
| W5b | `cargo build --release --locked` + `cargo test` in the GitHub Actions `rust` job (pinned rustup toolchain); the sha256-pinned release asset is downloaded and verified by `setup.sh`/`sync-box.sh` (the `OP_SHA256` pattern); `systemd-analyze verify` on `air-zec-sync.{service,timer}`; verify-box `air-zec`, `skill-zcash`, `unit-air-zec-sync` lines | — | Testnet, beats ordered by ZEC needed: `init` → `address --new` (`utest1…`) → ZIP-321 request → `exec` refusal without a claimable nonce → `propose` card → the real send after faucet ZEC and sync; `confirmed` after 1 confirmation |
| W6 | — | — | Manual pre-submission check — the list lives in §17.6: relative links resolve; no "never miss"/"guaranteed"/"we will"; every fenced `/trade`, `/pay`, `/zec` line on a page matches a parser that has merged (`/formation` is a slug, not a command); every page has its `Status:` line and a "not yet" section where needed; public URLs resolve and match the repo files modulo front-matter |

---

## 13. Sessions and ordering

W0 is the only serial step. It lands **all** of migration `0141` (the four decision
kinds, the `formation` card kind, `users.solana_address/tempo_address/
solana_cdp_address/solana_policy_id`, `user_chain_keys` with `network`/`kind`,
`wallet_transfers` widening, `payment_requests` currency `('usd','usdc','ousd','zec')`
+ `rail`/`direction`/receive columns, `trade_orders.venue` + `trade_connections.active`
backfilled, `x402_receipts` protocol/network, `machine_payments`, `pay_policies`
dormant, `pay_caps`, RLS on every new table), the chain registry,
`lib/pay/rails/index.ts` (`PayRail`, `baseRail`, `railFor`) and the
`executeTransfer` prepare/submit split, `lib/pay/parse.ts` + `lib/pay/imessage.ts`
wired at `flush.ts` and `chat/route.ts`, `lib/auth/origin.ts requireInteractiveRun`,
the `lib/trade/prices.ts` seam (Coinbase impl only), `OPTIONAL_ENV` rows + accessors,
`viem@2.57.4` as a direct dep, the pay-rails cron, and the view-only panel entries
(labels, approve-client union, `HOSTED_KINDS`). Later sessions ship their own
forward-only migration at the next free number at merge time (W4: `mini_apps`
formation row + `formation_requests`; W5: `zcash_sends`) and never edit `0141`. Each
session adds its own renderer/resolver arms — in both dispatch chains (§12) — in the
same PR as its decision kind.

| # | Session | Depends on | Est. | Lands |
|---|---|---|---|---|
| W0 | Registry, migration `0141`, rail seams + prepare/submit split, `/pay` parser + dispatch, `requireInteractiveRun`, prices seam, env rows, viem pin, cron, panel labels | — | 1 | prerequisite for all |
| W1a | Hyperliquid client/format/venue on recorded fixtures; `venueFor` on `provider` (W0 landed the `getTradeConnection` active lookup); `hyperliquidPublicPrices` + `publicPricesFor`; paper on `allMids`; `createOrder(order, cloid, preview)`; copy drops "Coinbase" | W0 | 1 | paper `/trade` on HL prices; venue fixture-green |
| W1b | Settings venue picker/connect form; tape candles; watch `-USDC`; the §12 testnet gate | W1a | ½ | `/trade` live on HL testnet |
| W2a | Tempo client/signer/rail: send + memo + sponsor, receive watcher, `tick()`; `POST /api/pay`; `deliverPayEvent`; pay.tsx "To pay"/"Getting paid" lists + owner-only `tempo_address` settings | W0 | 1 | `/pay … on tempo`, `/pay request … on tempo` on Moderato |
| W2b | MPP method as one header-keyed branch in `x402.ts` (`lib/payments/mpp.ts`); one per-charge `machine_payment` (`pending_approval` only; SSRF-guarded fetch; both-chains dispatch) | W2a acceptance | ½ | MPP gate; agent buyer against Air's own priced mini-app |
| W3a | Solana Pay receive on a hand-rolled URI + balance-delta watcher against owner-pasted `users.solana_address` (kit 5.5.1, no `@solana/pay`, no CDP); `/pay solana address set <addr>` parser arm; Wallet-tab read | W0 | ½ | `/pay request … on solana` on devnet |
| W3b | Solana v1 `accepts` entry with the installed `x402@1.2.0`; x402 buyer arm; CDP sends as v0 with the pre-sign assertion (only if `CDP_WALLET_SECRET` is provisioned before the session) | W0 + W2b (+ CDP wallet) | ½–1 | Solana `accepts`; `/pay … on solana` sends |
| W4 | `/formation`: three screens, `formation_requests` in its own migration, `resolveFormationSubmit` → checkout handoff, `store.ts`/`actionLog.ts` primitives, `upsertLocalEvent` deadlines | W0 (scheduled last) | 1 | the mini-app end to end (no chain) |
| W5a | Control-plane Zcash half behind a `ZecBinary` seam on recorded `air-zec` JSON: `lib/chains/zcash/{client,nonce}.ts`, `lib/pay/rails/zcash.ts`, `/api/wallet/zcash` + `exec-claim`/`exec-result`, `.agents/skills/zcash`, box skill | W0 | 1 | `/zec` surface green on fixtures |
| W5b | The `air-zec` crate via a GitHub Actions `rust` job + sha256-pinned asset; sync unit; verify-box lines | W5a + a human with a Box | 1 | `/zec` on testnet (after the hackathon) |
| W6 | Docs + skills | W0 | ½ | `docs/site/*.md` and `.agents/skills/{air-worlds-fair,zcash}` are drafted; the five Box skills and verify-box lines are not; the submission pass (§17) runs last |
| S1 | `/launch` (Meteora DBC, devnet, entitlement) | W3b, only if a session remains | 1 | stretch |

After W0 merges, W1a / W2a / W3a / W5a run in parallel on fixture-green halves. W1
and W2 go first because `/trade` and `/pay` already exist end to end and each needs
exactly one new venue/rail file to show the whole loop on a track's native primitive.
W3b waits for W2b (the x402 buyer arm reuses the machine-payment lane) and a CDP
wallet; W4 goes last; W5b is off the critical path. If `air-zec` is not baked by
submission, every binary-backed `/zec` row moves under "What we document but do not
ship yet" in `zcash.md`. Open question: if Zcash or Solana do not carry the larger
pool (unverified from the corpus), the "if a session is free" slot flips to W4.

**Submission slice tonight (PDT, deadline 11:59pm 2026-10-12):**

| When | What |
|---|---|
| 13:25–13:45 | Owner pre-seed in lead-time order (§17.1): HL testnet API wallet + drip + agent approval (+ builder if §15.3); Vercel env `TRADE_LIVE_ENABLED=true`, `HL_LIVE_ENABLED=false`, `TRADE_ALLOWLIST=<demo user>`; Tempo payer keys + `client.faucet.fundSync` on Moderato for two accounts; Phantom (devnet) on a phone + paste `users.solana_address`; decide §15.3 |
| 13:45–14:30 | Text pass: the spec corrections in order (§4.2 SQL, §2, §4.3/§4.4, §5, §6, §7, §8, §9/§11/§0.1, §10–§15, §17), README §9 slice + §4/§6/§10, docs pages; amend the **three** "World's Fair: …" commit subjects (`5656db4`, `05786c4`, `21754b1`) to `R-WF-06: …` (or `chore:`-prefix them — `check-commit-ids.sh` scans all of `${BASE_REF}..HEAD`); open the PR |
| 14:30–17:00 | W0 (one session, serial). Exit: typecheck, lint, test, build, coverage floors, migrations job green, commit `R-WF-00:`. After the merge the owner approves the `production` environment deployment in the Actions run so `deploy-migrations` applies `0141` before any manual gate runs against the deployed app (§12 Migrations, §17.1 item 8) |
| 17:00–21:30 | W1a ∥ W2a; a third session, if free, takes W3a or W5a |
| 21:30–22:30 | W2b in the Tempo session only if W2a's acceptance passed by ~21:00; otherwise the MPP rows move under "not yet" |
| 22:00–23:00 | W6 submission pass (§17): `Status:` lines, "not yet" sections, manual check (§17.6), blurbs, rehearsal, video |
| 23:00–23:45 | Freeze: merge only green PRs (`commit-ids`, `web`, `migrations`, `coverage`); confirm `deploy-migrations` applied `0141` to production without error (the run waits for the `production` environment approval — a human step, not automatic); confirm the docs mirror matches the repo files modulo front-matter; submit blurbs + video; leave W1b/W2b-remainder/W3b/W4/W5b exactly where they stand, labelled `planned` |

---

## 14. Environment and credentials (all server-side, none `NEXT_PUBLIC_`)

Every new variable is a row in `OPTIONAL_ENV` in `apps/web/lib/env.ts` (alphabetical)
with a lazy `env.<name>()` accessor (pattern `tradeLiveEnabled`, env.ts:407); the
registry and rail modules never read `process.env` — `lib/env.test.ts` (grep guard +
manifest coherence) fails CI otherwise. Reuse `env.x402FacilitatorUrl()` /
`env.x402Network()`; there is **no** `X402_SOLANA_NETWORK` (the Solana `accepts`
network is the registry CAIP-2 on the wire mapping; `X402_NETWORK` stays the v1
string for the Base entry). Adding a variable is therefore an env.ts change plus a
Vercel setting, never a Vercel setting alone.

| Variable | Session | Notes |
|---|---|---|
| `TRADE_LIVE_ENABLED` (exists, `false`), `TRADE_ALLOWLIST` (exists) | W1b gate | Still gate every `mode='live'` row, HL testnet included (`resolveTradeOrder`/`setTradeMode`); the testnet rehearsal runs with `TRADE_LIVE_ENABLED=true`, `HL_LIVE_ENABLED=false` |
| `HL_LIVE_ENABLED` (`false`), `HL_BUILDER_ADDRESS`, `HL_BUILDER_FEE_TENTHS_BP` (`10`), `HL_SLIPPAGE_BPS` (`100`) | W1 | `HL_LIVE_ENABLED` additionally gates `network='mainnet'` on connect; the builder must be approved per user from the master; keep `f ≤ 1000` (spot cap); builder funding minimum unverified (§15.3) |
| `TEMPO_LIVE_ENABLED` (`false`), `TEMPO_SPONSOR_URL` (`https://sponsor.moderato.tempo.xyz`; mainnet `https://api.tempo.xyz/rpc/sponsor?key=…`), `TEMPO_API_KEY` (optional, `tempo:sk:…`) | W2a | `TEMPO_SPONSOR_URL` is used only for Air's own sends; the gate has no fee payer. For Tempo, `TEMPO_LIVE_ENABLED` is necessary but not sufficient — a raw signer never opens on mainnet (§15.4) |
| `MPP_SECRET_KEY` | W2b | mppx's challenge-signing secret, not a chain key |
| `SOLANA_RPC_URL` (Helius, mainnet), `SOLANA_RPC_URL_DEVNET`, `SOLANA_USDC_MINT_DEVNET` (default `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) | W3a | Read + watcher only |
| `SOLANA_LIVE_ENABLED` (`false`), `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET` (exist), `CDP_WALLET_SECRET` | W3b | CDP server wallets need the wallet secret in addition to the API key; without it the rail is read-only — never a raw-key fallback |
| `X402_FACILITATOR_URL` (exists; default `https://x402.org/facilitator`), `X402_NETWORK` (exists: `base`) | W3b | Facilitator is a pure function of the entry's chain: Base mainnet → CDP `createFacilitatorConfig`; Base Sepolia / solana-devnet → `env.x402FacilitatorUrl()`; a test asserts no mainnet entry resolves to `x402.org` (fix the comment at env.ts:720) |
| `FORMATION_HACKATHON_PERKS` (`false`; `=1` shows the line) | W4 | Perks line on the Submit screen naming the four Colosseum perks + "mention Crypto World's Fair at checkout" (no perk code exists); read through `env.formationHackathonPerks()`, never `process.env`, or `lib/env.test.ts` fails W4's first CI run |
| `ZCASH_ENABLED` (`false`; provisions the Box wallet at all), `ZCASH_LIVE_ENABLED` (`false`), `ZCASH_LIGHTWALLETD` (default `https://zec.rocks:443`), `ZCASH_LIGHTWALLETD_TESTNET` (default `https://testnet.zec.rocks:443`), `ZCASH_EXEC_SIGNING_KEY` (required when `ZCASH_ENABLED`, no fallback), `ZCASH_PER_SEND_CAP_ZEC`, `ZCASH_DAILY_CAP_ZEC` | W5a | The exec-nonce HMAC key is control-plane only; caps are ZEC-denominated and fail closed |
| `LAUNCH_SEED_KEY` | S1 only | Deterministic config/baseMint keypair derivation (§16); not added before S1 is scheduled |
| `PROVIDER_VAULT_KEY`, `MINIAPP_SIGNING_KEY`, `TRADE_PREVIEW_SIGNING_KEY`, `CRON_SECRET` | exist | unchanged |

**Pins (§4.4).** W0: `viem@2.57.4` as a direct `apps/web` dependency (root `viem`
2.39.0 is thirdweb's exact pin and has no `viem/tempo`; no root override unless
`npm i` ERESOLVEs on mppx's `viem >=2.57.1` peer, and then only with typecheck +
tests green; acceptance `cd apps/web && node -e "require.resolve('viem/tempo')"` +
`npm ls viem`). W1: `@nktkas/hyperliquid@0.33.3`. W2: `mppx@0.13.3` (zod 4 — import
only `mppx/server`/`mppx/client`; never re-export its schema types). W3: `@solana/kit`
stays 5.5.1 (lockfile, cdp-sdk hard dep), `@solana-program/token@0.9.0`,
`@solana-program/memo@0.10.0`, `@solana-program/compute-budget@0.11.x` (last kit ^5
peers), `@x402/core @x402/evm @x402/svm @x402/fetch@2.28.0` (scripts/client only),
`@coinbase/cdp-sdk@1.57.0`; **no** `@solana/pay` (peers kit ^6.9 — unsatisfiable).
S1 only: `@meteora-ag/dynamic-bonding-curve-sdk@1.5.13` + `@solana/web3.js` v1 inside
`lib/launch/dbc.ts`.

C5 host allowlists live in `lib/chains/registry.ts` per rail and are asserted by a
test that greps `fetch(` targets in the rail modules; the machine-payment fetch helper
(§6.5, reusing `isPublicAddress`/`resolvesOnlyPublicAddresses` from
`lib/kernel/purchases.ts`) is the one named exemption.

---

## 15. Open decisions (need the owner)

1. **Hyperliquid perps.** Spot-only (recommended) vs. owner-opt-in perps with isolated
   margin, a per-position cap as a `trade_settings` decision, and liquidation price on
   the card. Not in any session until decided.
2. **HL connection shape — closed: paste-the-API-key** for the submission (matches
   Coinbase BYOK; the key is created on `app.hyperliquid-testnet.xyz/API`, sealed
   server-side, verified with `userRole`/`extraAgents`). Post-submission: Air-generated
   agent keypair + wallet-signed `approveAgent` on the mini origin, with the paste form
   behind `HL_BYOK_PASTE_ENABLED` (not a §14 row until that work is scheduled).
3. **Builder code — closed: builder ON for testnet.** `HL_BUILDER_ADDRESS` = an
   Air-controlled testnet address; approving Air's builder fee from the demo master is
   a §17 pre-seed step so the fill shows `builderFee` (the builder's funding minimum is
   [docs, unverified]; confirm on HL docs — README's "≥100 USDC" is unsourced).
4. **Tempo signer custody.** v1 sealed secp256k1 key on testnet is acceptable for the
   submission and is testnet-only **by construction** (`lib/chains/tempo/signer.ts`
   refuses a `raw_secp256k1` row on mainnet regardless of `TEMPO_LIVE_ENABLED`);
   **mainnet waits for the access-key model (v1.1)**. Confirm.
5. **Solana wallet provider.** CDP server wallet (recommended) vs. thirdweb. W3a is
   CDP-free; W3b sends ship only if `CDP_WALLET_SECRET` is provisioned before the
   session and the SDK names are confirmed against
   `node_modules/@coinbase/cdp-sdk/*.d.ts` — otherwise the rail stays read-only.
6. **Formation provider surface.** Stablecorp-only handoff (recommended) vs. a picker.
   No perk code exists (the Submit screen says "mention Crypto World's Fair" behind
   `FORMATION_HACKATHON_PERKS`, §14); the checkout path is unknown, so the agent
   navigates from the homepage; prices are a marketing snapshot.
7. **Zcash mainnet — testnet-only for the submission (recommended).** `ZCASH_LIVE_ENABLED`
   stays `false` until all of: (a) a seed backup path that stays on the Box (no
   `display-mnemonic` through the control plane — seed export is "not yet");
   (b) the wrap-secret mechanics landed and tested end to end (`user_chain_keys`
   kind=`wrap_secret`, `exec-claim` 2-of-2, zeroize after signing); (c) ZEC caps
   enforced and any USD cap priced from one C5-allowlisted host with a ≤ 15-min cache
   that fails closed ("can't price ZEC right now"); (d) `confirmed` after 3
   confirmations; (e) the pinned `zcash_client_sqlite` UA encoding revision verified
   (Rev 0 vs Rev 2 — the parser accepts both HRPs meanwhile); (f) `https://zec.rocks:443`
   on the C5 allowlist and the `air-zec` release asset sha256-pinned by the `rust` job
   (W5b); (g) the owner sets `ZCASH_PER_SEND_CAP_ZEC`/`ZCASH_DAILY_CAP_ZEC`.
8. **MPP recipient — closed: option (a).** `users.tempo_address`, owner-entered on the
   Pay card's owner-only settings view, EIP-55 checksum-validated (`getAddress`), read
   at challenge time; the method is omitted when absent. Option (b) (Air-managed
   per-user address from the sealed signer) is rejected under MA6 ("the platform never
   custodies gate revenue").
9. **Fee sponsorship on mainnet.** The public relay is Moderato-only; mainnet needs
   `TEMPO_SPONSOR_URL=https://api.tempo.xyz/rpc/sponsor?key=tempo:sk:…`. Ship
   sponsored sends on Moderato.
10. **Standing budgets (post-hackathon design, ≤ 6 lines).** They return with the v1.1
    access-key signer: minted from the first `machine_payment` card; evaluated via
    `evaluateDelegatedApproval` in `lib/payments/approvalPolicy.ts` with stub
    provider/category fields; executed only by `resolveMachinePayment` with
    `resolved_by='policy'`; hard ceilings ≤ $1/charge, ≤ $10/day, ≤ 7 d, exact hostname;
    entitlement-gated off. On Tempo, additionally on-chain via
    `client.accessKey.authorizeSync({ accessKey, expiry, limits:[{ token: OUSD, limit, period: 86400 }], scopes:[{ address: OUSD, selector:'transferWithMemo(address,uint256,bytes32)' }] })`.
    `pay_policies` stays dormant schema until then.

---

## 16. Stretch — `/launch` (Meteora DBC, devnet, entitlement-gated)

Scheduled as S1 in §13 only after W3b lands and only if a session remains. Migration
`<next>_launch_miniapp.sql` (stretch only): `entitlements.launch_enabled boolean not
null default false` (the shape of `phone_entitled`; no self-serve path), `decisions.kind`
+ `'launch_pool'`, `mini_apps` row `launch` (private/single), `CardKind` + `'launch'`;
`launch` joins `FIRST_PARTY_MODULES`; render and every `app/api/launch/*` handler 404
when `launch_enabled` is false. `apps/web/lib/miniapps/apps/launch.tsx` + `lib/launch/`:
`lib/launch/dbc.ts` is the single module allowed to import `@solana/web3.js` v1 +
`@meteora-ag/dynamic-bonding-curve-sdk@1.5.13` (the §7.1 exception), taking and
returning base58 strings and serialized transactions only; its `Connection` uses the
registry devnet host; `lib/launch/*` always resolves `chainFor('solana','testnet')` and
ignores `SOLANA_LIVE_ENABLED`. Config = {quote mint USDC, total supply + decimals,
migration target DAMM v2, curve percentages, creator fee share, locked vesting (needs
`createLocker` before migration)}; pool = {name, symbol, metadata `uri` from
`lib/assets/pipeline.ts`}; the `launch_pool` decision shows every field. The resolver
derives the config and baseMint keypairs from
`hmac_sha256(LAUNCH_SEED_KEY, previewId + ':config' | ':mint')` (`LAUNCH_SEED_KEY`
control-plane only, §14), checks `client.state.getPoolConfig`/`getPoolByBaseMint`
before each submit and treats an existing account as done, `partialSign`s with those
keypairs, hands the partially-signed legacy tx to CDP to sign as payer/poolCreator
(verify cdp-sdk accepts a partially-signed tx first), submits `createConfig` then
`createPool`; an unknown outcome is terminal (C23). Reads only: `swapQuote` and
`client.state.*`; `client.pool.swap` is a trade and out of scope; migration is
Meteora's keepers. Program id `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` (mainnet
and devnet). Devnet only until reviewed.

---

## 17. Demo and submission

Deadline **11:59pm PDT, 2026-10-12**; only in-window work is judged, so sessions
commit as they go. (Prize pools and the deadline come from memory — the corpus fetch
failed from the sandbox; confirm both on the hackathon page before treating the §13
ordering as final.)

### 17.1 Owner pre-seed (start now, lead-time order; no Devin session can do these)

1. **Hyperliquid** (needs a mainnet-funded address for the drip): create the testnet
   API wallet at `https://app.hyperliquid-testnet.xyz/API`, note the master address,
   request the drip at `https://app.hyperliquid-testnet.xyz/drip` (mock USDC), approve
   the agent from the master; if §15.3 stays "on", approve Air's builder fee
   (`approveBuilderFee`) from the demo master. Keep the agent key for the Settings
   paste (W1b).
2. **Vercel env** on the staging/prod project: `TRADE_LIVE_ENABLED=true`,
   `HL_LIVE_ENABLED=false`, `TRADE_ALLOWLIST=<demo user id>`; `MPP_SECRET_KEY` if W2b
   is attempted; leave every other `*_LIVE_ENABLED` unset.
3. **Zcash** (longest lead time: sync, and no verified public testnet faucet): source
   testnet ZEC in advance and `init` the Box wallet early so sync finishes — only
   relevant if W5a + W5b ship; otherwise skip.
4. **Tempo**: create the demo payer keys; `client.faucet.fundSync` on Moderato for two
   accounts — the user's signer and a second funded payer for the mirror request and
   the MPP client (`testnet: true` both sides).
5. **Solana**: install Phantom on a phone, switch it to devnet, paste the owner's
   address into `users.solana_address` (owner-only settings view or
   `/pay solana address set <addr>` — the W3a parser arm, §11); devnet SOL via airdrop
   and devnet USDC from the Circle faucet (`https://faucet.circle.com`).
6. **Formation**: one Stablecorp checkout walk with the handoff engaged (no payment) —
   only if W4 ships.
7. Decide §15.3 (builder on testnet) before W1a starts.
8. **After W0 merges**: approve the `production` environment deployment in the GitHub
   Actions run so `deploy-migrations` applies `0141` (it only runs when a main push
   touched `supabase/migrations/`, and the `production` environment holds the job for
   a required reviewer, R-P0-5). Nothing later reaches production without this click;
   do it before any manual gate runs against the deployed app.

### 17.2 Shot list (one shot per shipped rail, ~35 s, network chip visible, ending on the receipt line)

| # | Shot | Only if |
|---|---|---|
| 1 | `/trade buy $50 of HYPE` with no connection → paper preview on HL `allMids` → Approve → paper fill | W1a |
| 2 | Connect the testnet API wallet in Settings → `/trade live` → the same command → one $10 IOC on the USDC pair testnet `spotMeta` lists → fill with the cloid; `builderFee` on the fill if §15.3 | W1b |
| 3 | `/pay 1 USD to 0x… on tempo memo INV-1` → preview (OUSD, memo, sponsored) → Approve → `transferWithMemo` → receipt line with the explorer link | W2a |
| 4 | `/pay request 1 USD on tempo memo INV-2` → request card (address + memo + amount) → the second payer sends → the watcher flips it to paid, owner texted | W2a |
| 5 | `npx mppx <mini-app url>` (or the `mppx/client` snippet with `testnet: true`) → paid session; `x402_receipts.protocol='mpp'` | W2b |
| 6 | `/pay request 1 USDC on solana` → QR → Phantom (devnet) → paid within one cron tick | W3a |
| 7 | `/zec address` → `utest1…` + ZIP-321 QR; `/zec send` → `exec` refusal without a nonce, then the propose card | W5a (+ W5b for the send) |
| 8 | `/formation` → packet → Approve → Checkout card on the Stablecorp page | W4 |
| 9 | Close on the docs page with its `Status:` line | always |

The last frame of the video is a receipt line. Rehearse shots 1, 3 and 4 before
recording; record once, with the network chip visible in every frame.

### 17.3 Receipt line rule (W2a; every rail)

`✓ <action> on <Rail> <network> · <ref>`, e.g. `✓ Sent 1 OUSD on Tempo Moderato ·
0xab…12`. `explorerTx` is attached only where the registry carries a verified explorer
URL: Tempo `https://explore.tempo.xyz/tx/<hash>` /
`https://explore.testnet.tempo.xyz/tx/<hash>`; Base `basescan.org` /
`sepolia.basescan.org`; Solana as the registry's devnet row records it. Otherwise the
bare ref. Hyperliquid has no tx hash from `order`: receipts show the cloid and link the
master address's page under `https://app.hyperliquid-testnet.xyz/explorer`. Zcash
shows the bare txid (no verified testnet explorer).

### 17.4 Per-track blurb rule

One blurb per track, ≤ 120 words, written at the W6 pass: the native primitive in the
corpus's own name (HyperCore spot order through an API wallet + builder code; TIP-20
`transferWithMemo` with sponsored fees + MPP; Solana Pay transfer request + x402 on
SVM; shielded Unified Address + ZIP-321; Stablecorp handoff), the one invariant ("one
approval card, many chains"), the network (testnet), the three commands,
`air.wzrd.tech/docs/<slug>`, the sponsor touched, `[video timestamp: TBD]`. No
"guaranteed", "never miss" or "we will"; nothing claimed that did not merge inside the
window.

### 17.5 Status line rule (W6)

Directly under each page's H1, as body text: `Status: shipped` (`evm-chains`),
`Status: testnet` (`hyperliquid`, `tempo` once W1a/W2a merged), `Status: planned`
(`solana`, `zcash`, `formation` unless W3a/W5a merged — and then only their landed
rows). Every unshipped row sits under "What we document but do not ship yet". The
manual check (§17.6) runs after the lines are set.

### 17.6 Manual pre-submission check (W6; the §12 W6 gate — there is no docs lint)

Run once per page, after the `Status:` lines are set and before the docs mirror:

1. **Links.** Every relative link (`/docs/<slug>`, in-page anchors) resolves to a page
   or heading that exists in `docs/site/`.
2. **Phrases.** No "never miss", "guaranteed", "we will" anywhere (WF9); the deadline
   sentences read "reminds you before".
3. **Commands.** Every fenced `/trade`, `/pay`, `/zec` line matches a parser that has
   merged (`lib/trade/parse.ts`; `lib/pay/parse.ts`, which also parses `/zec …`) in
   one of the canonical spellings of §11 — `/pay <rail> balance`, `/pay <rail>
   address`, no `from …` tails, no `/pay policy`. `/formation` is a slug, not a
   command, and is exempt. A line whose parser has not merged moves under "What we
   document but do not ship yet".
4. **Status.** Every page has its `Status:` line directly under the H1 (§17.5) and a
   "What we document but do not ship yet" section wherever a row is unshipped.
5. **Mirror.** Every `air.wzrd.tech/docs/<slug>` resolves and matches the repo file
   byte-for-byte modulo front-matter.

`scripts/check-docs-site.sh` + a vitest `docs-site.test.ts` automate items 1 and 3 as
P1 after W0's `lib/pay/parse.ts` exists (§10).

### 17.7 Freeze and submit (23:00–23:45 PDT)

Merge only green PRs (`commit-ids`, `web`, `migrations`, `coverage`); confirm
`deploy-migrations` applied `0141` to production without error — the job runs only on
a main push that touched `supabase/migrations/` and waits for the `production`
environment approval (§17.1 item 8), so an unapproved run means `0141` is **not** in
production; confirm every mirrored page matches its repo file modulo front-matter;
submit the blurbs and the video; leave W1b / W2b-remainder / W3b / W4 / W5b exactly
where they stand with their pages labelled `planned`.

### 17.8 Still unverified (resolve at rehearsal, never hardcode)

Whether `HYPE/USDC` is listed on HL testnet (`spotMeta` decides the pair); the
builder's funding minimum; whether `npx mppx` has a testnet payer (fall back to the
`mppx/client` snippet); whether the hosted `x402.org` facilitator accepts v1 SVM
payloads (W3b); a public Zcash testnet faucet; Stablecorp's checkout path and any
perk code.
