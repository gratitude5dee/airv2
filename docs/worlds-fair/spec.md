# spec.md — Air × Crypto World's Fair (executable spec for Devin SWE-2 Max)

Read `ARCHITECTURE.md`, `docs/goal-miniapps-v9.md`, `docs/trade/plan.md`, and
`docs/worlds-fair/README.md` (the analysis — it says *why*; this file says *what*)
before starting. Where this file and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md`
wins and this file is the bug. Cross-cutting constraints keep their existing numbers
(I*, C*, MA*, T*); new invariants here are **W1–W9** and are cited from code comments
as `spec.md §W3`.

Sessions are independent after **W0** and are meant to run in parallel (one Devin
session each). Every session ends with `npm run typecheck && npm run lint &&
npm test -- --run` green in `apps/web`, the migration shadow-applied by `ci.yml`, and
the acceptance tests in §12 for that session passing. Commit messages name the
session (`W1: …`).

---

## 0. The outcome

A user texts (or types in `/home`):

```
/trade connect hyperliquid              → Settings → paste an API-wallet key (testnet) → ● hyperliquid · live
/trade buy $50 of HYPE                  → preview card (HYPE/USDC, IOC at preview px, fee, builder fee, expiry) → Approve → filled receipt
/pay 25 USD to 0x… on tempo memo INV-7  → preview (OUSD, memo, sponsored fee) → Approve → transferWithMemo → explorer link
/pay request 25 USD on tempo memo INV-7 → request card; finalized Transfer log flips it to paid, owner texted
/pay request 12 USDC on solana          → Solana Pay URI + QR with a reference; confirmed by reference → paid
/pay 12 USDC to <addr> on solana        → preview → Approve → USDC-SPL transfer from the user's CDP Solana account
/zec address                            → fresh Unified Address + ZIP-321 QR from the Box wallet
/zec send 0.1 to u1… memo "rent"        → preview → Approve → Box executes with a single-use nonce → txid
/formation                              → entity decision → intake → packet → approve handoff → Stablecorp checkout (purchase stop) → EIN/bank tiles → 83(b) on the calendar
```

Mini-apps that charge (`x402_enabled`) answer `402` with **both** an x402 `accepts`
payload (Base **and** Solana entries) and an **MPP** `WWW-Authenticate: Payment`
challenge (Tempo). The agent, meeting a `402` elsewhere, files a `machine_payment`
decision (or pays under a standing `pay_policy`), and every charge is receipted.

**Every mutation of money is a decision the owner resolves.** Reads are free. The
agent stages; the resolver executes; an uncertain submit is terminal.

### 0.1 Golden paths (acceptance narratives)

1. **Hyperliquid, paper → testnet.** `/trade` with no connection: paper mode prices
   `HYPE-USDC` from HL `allMids`. `/trade buy $50 of HYPE` previews, approves, fills on
   paper. Connect a testnet API wallet in Settings; `/trade live`; the same command
   submits one IOC order with a cloid derived from the preview; `/trade orders` shows
   it from `frontendOpenOrders`/`orderStatus`.
2. **Tempo, Moderato.** `/pay tempo balance` shows OUSD after the faucet. `/pay 1 USD
   to 0x… on tempo memo INV-1` → approve → `transferWithMemo`, fee sponsored by
   `sponsor.moderato.tempo.xyz`. `/pay request 1 USD on tempo memo INV-2` → the
   watcher sees the finalized `TransferWithMemo` log and marks it paid.
3. **MPP + x402 gate.** Open a priced mini-app with `npx mppx <url>` → paid session;
   `x402_receipts` row has `protocol='mpp'`. Open it with an x402 client on Solana
   devnet → `protocol='x402', network='solana-devnet'`.
4. **Solana Pay.** `/pay request 1 USDC on solana` → QR; pay from Phantom (devnet) →
   the reference watcher marks it paid within one cron tick.
5. **Zcash testnet.** `/zec address` → `u1…` and a `zcash:` URI QR. Fund it from a
   faucet; `/zec balance` shows shielded balance after sync; `/zec send 0.01 to u1…`
   → approve → the Box's `zcash-exec` spends with the nonce; txid in chat.
6. **Formation.** `/formation` → recommendation → intake → packet complete →
   `formation_submit` decision → Approve → Stablecorp checkout opens in the Box
   browser with the purchase stop → tiles → 83(b) reminders exist in the calendar.

---

## 1. Existing substrate — audit before you write code

Do not rebuild any of this. Extend it.

| Subsystem | Where | What we reuse |
|---|---|---|
| Venue seam | `apps/web/lib/trade/venue.ts` (`TradeVenue`, `assertTradableSpotProduct`), `service.ts` (`venueFor`, `previewTrade`, `proposeTrade`, `resolveTradeOrder`, `reconcileTradeOrders`, `expireTradeApprovals`) | **W1** adds `hyperliquidVenue` behind the same interface; nothing in `service.ts` learns a venue name except `venueFor`. |
| Order canonical form | `lib/trade/order.ts` (`tradeOrderSchema`, product regex `^[A-Z0-9]{1,20}-[A-Z0-9]{1,20}$`, `createPreviewToken`/`verifyPreviewToken`, `clientOrderIdForPreview` → uuid) | HL spot pairs map to `HYPE-USDC`; the uuid becomes the 16-byte HL `cloid` (`0x` + 32 hex). |
| Trade tables | `supabase/migrations/0109_trade_miniapp.sql` (`trade_connections` pk `(user_id, provider)`, `provider` check `'coinbase'`; `trade_orders` with `client_order_id`, `preview`, state machine, one-pending index) | **W0** widens `provider`, adds `trade_orders.venue` + `venue_meta`, `trade_connections.active`. |
| Trade surfaces | `lib/miniapps/apps/trade.tsx` (tabs incl. `tape`), `lib/trade/tape.ts`, `lib/trade/parse.ts`, `lib/trade/imessage.ts` (`deliverTradeApproval`), `app/api/trade/route.ts`, `app/api/cron/trade`, `infra/template/skills/trade/SKILL.md` | Unchanged shape; `/trade connect <venue>` gains a venue arg; Settings gets a venue picker. |
| Pay rail | `lib/commerce/paymentRequests.ts` (`currency in ('usd','usdc')` → Stripe Checkout / `createTransferRequest`), `lib/wallet/send.ts` (`run_approval` decision, `WalletSubmitUnknownError`, `transferIdempotencyKey`), `lib/wallet/read.ts`, `lib/wallet/qr.ts`, `lib/miniapps/apps/pay.tsx` | **W0** widens `currency`; **W2/W3/W5** add `tempo`, `usdc_sol`, `zec` arms that file the same decisions and execute in the same resolver. |
| 402 gate | `lib/payments/x402.ts` (`buildPaymentRequirements`, facilitator via `@coinbase/x402` with `CDP_API_KEY_ID/SECRET`, `x402_receipts` first-insert-wins, pay page), `lib/miniapps/gates.ts` (visibility → password → x402 → session) | **W2** adds the MPP challenge beside the x402 `accepts`; **W3** adds a Solana `accepts` entry. Receipts stay one table. |
| Decisions | `decisions` (`0005` + widenings; latest kinds in `0109`), `app/api/decisions/route.ts`, `lib/approvals/hosted.ts`, `app/approve/[id]`, `lib/approvals/token.ts` (15-min HMAC link), `app/home/panels/needs-panel.tsx` | New kinds `machine_payment`, `pay_policy`, `zcash_send`, `formation_submit`; each is one arm of the existing switch; side effects only in the resolver. |
| Box auth / commands | `lib/auth/guard.ts` (`requireBoxOrOwner`), `lib/box/client.ts` (`command`, `readFile`, `writeFile`), `lib/miniapps/store.ts` (`readAppState`/`writeAppState`), `stateLease.ts` | Box-authenticated routes copy `app/api/trade/route.ts`; Zcash execution uses `command` with a nonce. |
| Sealed secrets | `lib/providers/keys.ts`, `lib/crypto/secretbox.ts` (`sealSecret`/`openSecret` under `PROVIDER_VAULT_KEY`), `trade_connections.secret_sealed` | HL agent key and the Tempo signer (v1) are sealed the same way; last-4 hint only (C18). |
| Wallets | `lib/thirdweb/client.ts` (Base, `sendWalletTokens` with idempotency key), `env.walletChainId()`/`walletUsdcAddress()`, `WALLET_CHAIN_ID=8453` | Base stays thirdweb. Solana = CDP server wallet (W3). Tempo = sealed signer → Tempo access key (W2). |
| Mini-app module contract | `lib/miniapps/apps/types.ts`, `index.ts` (`FIRST_PARTY_MODULES`), registry row in `mini_apps`, `renderShell`/`shellHtml`, `promptBar` | `/formation` is one module + one registry row + `CardKind` widening (same as `trade` in `0109`). |
| Calendar spine | `lib/calendar/*` (sources → moments → slots, `agent_schedules`, ICS approval) | Formation deadlines (83(b), annual compliance) are calendar moments. |
| Browser-use with purchase stop | `lib/browser/*`, `api/browser/purchase`, `lib/vault/purchase.ts` (`purchase_review`) | Stablecorp checkout runs behind the existing stop; the human clicks Pay. |
| Email inbound | `lib/agentmail/client.ts`, `api/inbound/email` | Formation status from provider emails. |
| Crons | `apps/web/vercel.json` (`/api/cron/trade` every minute, `sweep`, `schedules`) | `/api/cron/pay-rails` (Tempo/Solana/Zcash watchers + expiries) joins at `* * * * *`. |
| Evals | `evals/agent-suite`, `evals/contract`, `TRADE_EVAL_FIXTURE` paper fixture | New scripted turns per rail (§12). |
| Installed skills | `.agents/skills/{colosseum-resources,solana-dev,pay,agentic-wallet,meteora,arcium,tempo,hyperliquid-trading,hyperliquid-payments,hyperliquid-rust-sdk,air-worlds-fair,…}` pinned in `skills-lock.json` | Read `air-worlds-fair` first; it routes to the rest. |

---

## 2. Non-negotiable constraints

| # | Constraint as it applies here |
|---|---|
| I1–I6, C3/C4/C5/C16/C17/C18/C23, MA1–MA10, T1–T9 | Unchanged and in force. In particular C5: outbound hosts are literal allowlists per rail (§14); no user-supplied URL is ever fetched by a resolver except the `machine_payment` target, which is pinned by the decision. |
| **W1 — Stage → approve → resolver, for every chain.** | No route the Box can call mutates a venue or chain. The only code that signs a chain transaction or an exchange action runs inside the decision resolver (`resolveTradeOrder`, `resolvePayment`, `resolveMachinePayment`, `resolveZcashSend`) under an owner session or a valid approval-link token, after the conditional `status='pending'` flip. The Zcash exception (the Box signs) is bounded by a single-use execution nonce minted by that same resolver (§9). |
| **W2 — Testnet first; mainnet is a flag.** | Defaults: Hyperliquid testnet, Tempo Moderato (42431), Solana devnet, Zcash testnet. `HL_LIVE_ENABLED`, `TEMPO_LIVE_ENABLED`, `SOLANA_LIVE_ENABLED`, `ZCASH_LIVE_ENABLED` (all default `false`) gate mainnet per rail, and `TRADE_ALLOWLIST`-style per-user allowlists apply. The approval card always names the network. |
| **W3 — Connected credentials are sealed in the control plane.** | HL agent-wallet key, Tempo signer (v1), CDP key: `secret_sealed` under `PROVIDER_VAULT_KEY`, write-only forms, last-4 hint, rotate = re-enter. Never the Box, never the browser, never a log. Keys that are the user's alone (Zcash spending key) never leave the Box. |
| **W4 — Every 402 settlement is receipted before access; every agent-paid charge is capped and receipted.** | `x402_receipts` gains `protocol`/`network`; insert first-wins on the payment nonce/credential hash; the paid session is minted after the insert. Agent-side charges land in `machine_payments` with the decision or policy that authorized them. |
| **W5 — One pending money approval per user per lane.** | `trade_orders` keeps its partial unique index; `payment_requests`, `machine_payments`, `zcash_sends` get the same `one_pending_per_user` partial index. Chained requests decompose; the next leg is sized from a fresh read. |
| **W6 — Exact, bound, expiring previews everywhere.** | Trade previews keep `TRADE_PREVIEW_SIGNING_KEY` tokens. Pay/machine/zcash previews are stored rows whose decision `ref` is the row id and whose `payload` is the value-free summary; the resolver re-reads the row and re-validates (balance, caps, product/recipient) before submit — "re-verify before submit" is T4's rule generalized. |
| **W7 — Caps are the owner's, server-side, per rail.** | `per_order_usd_cap` / `daily_usd_cap` / velocity cap exist for trade; `pay_caps` (per-send, daily, per-rail) and `pay_policies` (standing machine-payment budgets with host allowlist + expiry) are theirs too. Raising any cap is a `trade_settings` / `pay_policy` decision. On Tempo the policy is additionally enforced on-chain as an access-key limit when the access-key path is used. |
| **W8 — Not from an unattended run.** | Routes that create money decisions require an interactive origin (`surface ∈ {imessage, web, miniapp}`) — T7 verbatim. Watchers and crons only *read*, *reconcile*, *expire*, and *notify*. |
| **W9 — Not advice, not certain.** | T9 verbatim across rails: "estimated", never "will"/"guaranteed"; no asset ranking; formation copy never says "legal advice". |

---

## 3. Non-goals (this program)

- Perpetuals, margin, leverage, or any non-spot product on any venue (T4). HL perps is
  an open decision (§15), not a hidden flag.
- Withdrawals/bridging automated by Air (HL `withdraw3`, Core↔EVM, CCTP). Documented
  as owner steps.
- Issuing tokens: Tempo TIP-20 issuance and Meteora DBC launches (the `/launch`
  stretch is specified in §16 but not in any numbered session).
- Confidential transfers (Token-2022) and Arcium: documented, not built.
- Multi-user/shared wallets, pooled operator keys, platform fee on gates.
- Generating legal documents in `/formation`.

---

## 4. W0 — Chain registry and rail widening (prerequisite, ½ session)

### 4.1 `apps/web/lib/chains/registry.ts`

```ts
export type RailId = "base" | "solana" | "tempo" | "hyperliquid" | "zcash";
export interface ChainSpec {
  rail: RailId;
  kind: "evm" | "solana" | "hypercore" | "zcash";
  name: string;                 // "Tempo", "Solana", …
  network: "mainnet" | "testnet";
  chainId?: number;             // evm only (8453/84532, 4217/42431, 999/998)
  caip2?: string;               // "eip155:4217", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
  rpc: string; ws?: string; explorerTx: (hash: string) => string;
  stable: { symbol: string; address: string; decimals: number };   // USDC / OUSD / …
  liveEnabled: () => boolean;   // env flag per rail (W2)
  hosts: readonly string[];     // C5 literal allowlist for this rail
}
export function chainFor(rail: RailId): ChainSpec;        // picks testnet unless liveEnabled()
export function explorerLink(rail: RailId, hash: string): string;
```

Values (verify against the docs pages in `docs/site/*.md` before hardcoding):

| rail | mainnet | testnet | stable |
|---|---|---|---|
| base | 8453, `https://mainnet.base.org` | 84532, `https://sepolia.base.org` | USDC (`env.walletUsdcAddress()`) |
| tempo | 4217, `https://rpc.tempo.xyz` | 42431, `https://rpc.moderato.tempo.xyz` | OUSD `0x20c0000000000000000000006a37da5c996874be` (6 dp) |
| hyperliquid | `https://api.hyperliquid.xyz` (+ EVM 999 `https://rpc.hyperliquid.xyz/evm`) | `https://api.hyperliquid-testnet.xyz` (+ EVM 998) | USDC (spot token index 0) |
| solana | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`, RPC from `SOLANA_RPC_URL` (Helius) | devnet `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`, `https://api.devnet.solana.com` | USDC mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (mainnet) / devnet mint from `SOLANA_USDC_MINT_DEVNET` |
| zcash | lightwalletd mainnet from `ZCASH_LIGHTWALLETD` (zec.rocks) | testnet lightwalletd (`-n test`) | ZEC (8 dp) |

Robinhood Chain (4663 / 46630), Arbitrum One (42161), Nova (42170), Sepolia (421614)
are **documented in `docs/site/evm-chains.md` only**; adding one is a row in this
table, not a session.

### 4.2 Migration `supabase/migrations/0141_worlds_fair.sql`

```sql
-- trade: a second live venue
alter table trade_connections drop constraint trade_connections_provider_check;
alter table trade_connections add constraint trade_connections_provider_check
  check (provider in ('coinbase','hyperliquid'));
alter table trade_connections
  add column master_address text,                       -- HL: the owner's funded address (state is queried here)
  add column network text not null default 'testnet' check (network in ('mainnet','testnet')),
  add column builder_fee_approved boolean not null default false,
  add column active boolean not null default false;
create unique index trade_connections_active_idx on trade_connections (user_id) where active;

alter table trade_orders
  add column venue text not null default 'coinbase' check (venue in ('coinbase','paper','hyperliquid')),
  add column venue_meta jsonb;                           -- {assetId, coin:"@107", cloid, szDecimals, network}

-- pay rails
alter table payment_requests drop constraint payment_requests_currency_check;
alter table payment_requests add constraint payment_requests_currency_check
  check (currency in ('usd','usdc','usdc_sol','tempo','zec'));
alter table payment_requests
  add column rail text,                                  -- base|solana|tempo|zcash (null = legacy usd/usdc)
  add column network text,                               -- mainnet|testnet
  add column memo_bytes32 text,                          -- tempo: 0x…32 bytes
  add column reference text,                             -- solana pay reference pubkey; zcash: none
  add column receive_address text,                       -- the address shown on the request card
  add column tx_ref text,                                -- chainId:txHash:logIndex | signature | txid
  add column paid_amount text;                           -- what actually landed (never floats)
create unique index payment_requests_tx_ref_idx on payment_requests (tx_ref) where tx_ref is not null;

alter table wallet_transfers
  add column rail text not null default 'base',
  add column network text,
  add column memo text,
  add column tx_ref text,
  add column request_id uuid references payment_requests(id) on delete set null;

create table pay_caps (
  user_id          uuid primary key references users(id) on delete cascade,
  per_send_usd_cap numeric(14,2) not null default 250,
  daily_usd_cap    numeric(14,2) not null default 1000,
  updated_at       timestamptz not null default now()
);

-- machine payments (agent as buyer)
create table machine_payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  decision_id   uuid references decisions(id) on delete set null,
  policy_id     uuid,                                     -- set when paid under a standing policy
  protocol      text not null check (protocol in ('x402','mpp')),
  rail          text not null,                            -- base|solana|tempo
  network       text not null,
  url           text not null, method text not null default 'GET', realm text,
  amount        text not null, asset text not null, recipient text not null,
  challenge     jsonb not null,                           -- value-bearing: the parsed 402 (RLS owner-only)
  state         text not null check (state in ('previewed','pending_approval','paying','paid','denied','expired','failed','uncertain')),
  receipt       jsonb, tx_ref text, error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index machine_payments_pending_idx on machine_payments (user_id) where state = 'pending_approval';

create table pay_policies (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  decision_id    uuid references decisions(id) on delete set null,
  hosts          text[] not null,                         -- exact hostnames the policy covers
  rail           text not null, network text not null,
  per_charge_usd numeric(14,2) not null, daily_usd numeric(14,2) not null,
  expires_at     timestamptz not null,
  onchain_ref    text,                                    -- tempo access-key address when enforced on-chain
  status         text not null default 'active' check (status in ('active','revoked','expired')),
  created_at     timestamptz not null default now()
);

alter table x402_receipts
  add column protocol text not null default 'x402' check (protocol in ('x402','mpp')),
  add column network text;

-- zcash + formation + new decision kinds (tables in §9 / §8)
alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check
  check (kind in (/* existing list from 0109 … */,
                  'machine_payment','pay_policy','zcash_send','formation_submit'));
-- card kinds: + 'formation' in card_sends / miniapp_card_sessions checks (copy the 0109 pattern)
-- mini_apps row: ('formation','/mini/formation','render','{formation:manage}', …, 'private','single','published')
```

RLS mirrors `trade_orders`/`provider_keys`: owner `select` on everything except
sealed columns and `challenge`/`preview` value-bearing JSON (service-role only).

### 4.3 Service seams added in W0 (empty arms, typed)

- `lib/pay/rails.ts`: `interface PayRail { id: RailId; previewSend(...); submitSend(...); watchReceive(...); balance(...) }` with `baseRail` (wraps today's `createTransferRequest` path) so later sessions add `tempoRail`, `solanaRail`, `zcashRail` without touching `paymentRequests.ts` again beyond the `currency → rail` switch.
- `lib/pay/caps.ts`: `assertPayCaps(supabase, userId, usd)` — the trade `assertCaps` shape (per-send, daily over `wallet_transfers`+`machine_payments`, velocity 20/h).
- `lib/pay/parse.ts`: `/pay` grammar extension: `/pay <amt> <ASSET> to <addr|@user> on <rail> [memo <text>]`, `/pay request <amt> <ASSET> on <rail> [memo <text>]`, `/pay <rail> balance`, `/pay policy …`, `/zec …`. Pure; colocated tests. (`/trade connect <venue>` lands in `lib/trade/parse.ts`.)
- `app/api/cron/pay-rails/route.ts` registered in `vercel.json` at `* * * * *`: calls each rail's `tick()` (watchers, expiries, reconciliation) under the shared cron auth.
- Needs-you panel + `app/approve/[id]` renderers for the four new kinds (value-free, C18).

---

## 5. W1 — Hyperliquid spot venue (1 session)

### 5.1 Files

```
apps/web/lib/trade/hyperliquid/venue.ts        hyperliquidVenue(creds, network): TradeVenue
apps/web/lib/trade/hyperliquid/client.ts       thin wrappers over @nktkas/hyperliquid Info/Exchange clients (C5 hosts)
apps/web/lib/trade/hyperliquid/format.ts       product ↔ spot market resolution, price/size formatting, cloid
apps/web/lib/trade/hyperliquid/*.test.ts       recorded fixtures (spotMeta, spotClearinghouseState, order responses), no network
apps/web/lib/trade/service.ts                  venueFor(): active live connection → coinbase | hyperliquid
apps/web/lib/trade/parse.ts                    /trade connect [coinbase|hyperliquid]
apps/web/lib/miniapps/apps/trade.tsx           Settings: venue picker + HL connect form (write-only), builder-fee state
apps/web/lib/trade/tape.ts                     candles from candleSnapshot when the venue is HL (paper included)
apps/web/lib/trade/watch.ts                    HL symbols priced from allMids
infra/template/skills/trade/SKILL.md           venue-agnostic wording; mentions HYPE-USDC etc.
```

Dependency: `@nktkas/hyperliquid` (pin an exact version; it tracks the live API
surface) + `viem/accounts` (already present through thirdweb/x402 deps — confirm,
otherwise pin). No Python, no child processes.

### 5.2 Connection (Settings → Connect → Hyperliquid)

Form fields (write-only, owner-only, mini origin): **master address** (the funded
account whose state is queried), **API-wallet private key** (generated on
`https://app.hyperliquid[-testnet].xyz/API` with a name and expiry; sealed on arrival,
hint = last 4 of the derived agent address), **network** (`testnet` default; `mainnet`
only when `HL_LIVE_ENABLED` and the user is in `TRADE_ALLOWLIST`). Verify on save:
`userRole(agentAddress)` must be `{ role: "agent", data: { user: masterAddress } }`;
`extraAgents(master)` must list it with a future `validUntil`. Status chip:
`● hyperliquid · testnet · agent …a1b2 · expires 2026-12-30`. Disconnect shreds the
sealed key. Rotate = re-enter.

Not v1: Air-generated agent key + in-browser `approveAgent` from the user's wallet
(needs a wallet-connect surface on the mini origin; §15).

**Builder fee.** `HL_BUILDER_ADDRESS` (lowercase) and `HL_BUILDER_FEE_TENTHS_BP`
(default `10` = 1 bp). Settings shows "Approve Air's builder fee (max 0.05%)" with the
exact user-signed action the owner performs in their own wallet; Air polls
`maxBuilderFee({ user: master, builder })` and sets `builder_fee_approved`. Orders
carry `builder` only when approved; otherwise they go without (never fail an order
on a missing builder approval).

### 5.3 `hyperliquidVenue` ↔ `TradeVenue`

| `TradeVenue` | Hyperliquid | Notes |
|---|---|---|
| `listProducts(q, limit)` | `spotMetaAndAssetCtxs()` → `universe[]` joined with `tokens[]`; `productId = "${base}-${quote}"` from token names; `productType: "SPOT"`, `status: "online"`; `price` = ctx `midPx ?? markPx`; `baseIncrement = 10^-szDecimals(base)`, `quoteIncrement` from the price rule, `quoteMinSize` = `"10"` (exchange min notional) | Resolve by **name** from `universe` each call (`@107` vs `PURR/USDC` forms); never cache labels across runs (indices differ per network). |
| `getProduct(id)` | same, single | Unknown → `TradeVenueError(404, "unknown_product")`. T4 applies (spot only is structural here). |
| `balances()` | `spotClearinghouseState({ user: master })` → `{ asset: coin, available: total − hold, hold }` | Always the **master** address (never the agent). |
| `previewOrder(o)` | market BUY: `quoteSize` / mid → base size, truncated to `szDecimals`; IOC price = mid × (1 + `HL_SLIPPAGE_BPS`/1e4) (default 100 bps) formatted with `formatPrice(…, szDec, "spot")`; market SELL: mirror; limit: `formatPrice(limitPrice)`, `Gtc`; stop-limit: `t.trigger` is **not** supported in v1 → `TradeVenueError(400, "unsupported_type")` | Preview = `{ estimatedPrice, estimatedFill, fee: taker fee from userFees() × notional, slippage: bps, total, currency: "USDC", raw: { assetId, coin, szDecimals, px, sz, tif, builder } }` — the raw block is what `createOrder` replays, so the approved order and the submitted order are byte-identical. Reject notional < 10 USDC with the exchange's own words. |
| `createOrder(o, clientOrderId)` | `exchange.order({ orders: [{ a, b, p, s, r: false, t: { limit: { tif } }, c: cloid }], grouping: "na", builder? })` with `cloid = "0x" + uuid.replace(/-/g,"")`; inspect `statuses[0]`: `{filled}` → `filled`, `{resting}` → `submitted`, `{error}` → `rejected` with the message; transport timeout → **`uncertain`** (C23) | Nonce = `Date.now()` via the SDK's nonce manager; one `ExchangeClient` per resolver call, no shared mutable state across users. |
| `listOrders(scope)` | `frontendOpenOrders({ user: master })` (open) / `historicalOrders` (recent) → `TradeOrderRecord` | |
| `getOrder(id)` | `orderStatus({ user: master, oid: cloid })` — by **cloid**, so reconciliation after a timeout never needs the oid | `unknownOid` after the grace period → `uncertain` stays; never resubmit. |
| `cancelOrders(ids)` | `cancelByCloid({ cancels: [{ asset, cloid }] })` | `trade_cancel` decision as today. |

Formatting is a pure module with tests pinned to the rules: price ≤ 5 significant
figures **and** ≤ `8 − szDecimals` decimals (spot), integers always valid; size
truncated to `szDecimals`, never `"0"`; decimal strings with no trailing zeros; hex
lowercase; optional fields omitted, never `null`.

### 5.4 Paper mode on HL prices

`paperVenue` already books fills at live public prices via `coinbasePublicPrice`. Add
a `PublicPrices` seam: `hyperliquidPublicPrice(productId)` from `allMids` (no key) and
pick it when the product is an HL-only pair (`HYPE-USDC`, `PURR-USDC`) or the user's
active provider is `hyperliquid`. Paper rows get `venue='paper'`, `venue_meta.pricedBy`.

### 5.5 Tape + watch

- `tape.ts`: `candleSnapshot({ coin, interval: "1h", startTime: now − 7d })` → the
  existing close-line series; cache in `snapshot.json` like today.
- `watch.ts`: symbols resolvable on HL are priced from `allMids` on the existing
  `/api/cron/trade` tick (public, no key); alerts only (T7).

### 5.6 Resolver and reconciliation

`resolveTradeOrder` is untouched except that `venueFor` may return the HL venue. After
`submitted`, `reconcileTradeOrders` polls `getOrder(cloid)` → `filled | cancelled |
rejected`; the 10-minute grace rule for `uncertain` stays. Copy rules (T9) apply:
"estimated", "IOC at …", never "market".

### 5.7 Acceptance (§12 W1)

---

## 6. W2 — Tempo pay rail + machine payments (1 session)

### 6.1 Files

```
apps/web/lib/chains/tempo/client.ts     createClient({ chain: tempo|tempoModerato, feeToken: OUSD, transport: withRelay(http(rpc), http(sponsor)) })
apps/web/lib/chains/tempo/signer.ts     per-user signer: v1 sealed secp256k1 (provider_keys style) → v1.1 access key (6.5)
apps/web/lib/pay/rails/tempo.ts         tempoRail: previewSend / submitSend / watchReceive / balance / tick
apps/web/lib/payments/mpp.ts            MPP challenge + verify/settle for the gate (mppx/server, manual API)
apps/web/lib/pay/machine.ts             agent-as-buyer: inspect402(), fileMachinePayment(), resolveMachinePayment(), policies
apps/web/app/api/pay/route.ts           box/owner: resource=balance|requests|policies ; action=preview|propose|request|machine|policy
apps/web/lib/miniapps/gates.ts          402 response composes x402 accepts + MPP WWW-Authenticate
apps/web/lib/miniapps/apps/pay.tsx      rail chip, memo field, request QR/address, policies tab
infra/template/skills/pay-rails/SKILL.md, infra/template/skills/machine-pay/SKILL.md
```

Dependencies: `viem` (already present), `mppx` (pin), `wagmi` **not** needed
(server-only). C5 hosts: `rpc.moderato.tempo.xyz`, `rpc.tempo.xyz`,
`sponsor.moderato.tempo.xyz`, `api.tempo.xyz`, `explore.testnet.tempo.xyz`,
`explore.tempo.xyz`.

### 6.2 Send (`payment_requests.currency = 'tempo'`)

1. `/pay 25 USD to 0x… on tempo memo INV-7` (or the Pay mini-app form, or the agent via
   `POST /api/pay {action:"preview"}`) → `tempoRail.previewSend`: validate address,
   amount (`parseUnits(amount, 6)`), memo (≤ 32 UTF-8 bytes → `toHex(memo, {size: 32})`,
   else 400 with "memos are 32 bytes"), balance (`client.token.getBalance({ token: OUSD })`),
   caps (`assertPayCaps`), gas (`client.token.transfer.estimateGas` for the real
   recipient — new addresses ≈ 300k) → fee estimate in USD → row `payment_requests`
   (`rail='tempo'`, `network`, `memo_bytes32`, `status='pending'`) + `wallet_transfers`
   row (`rail='tempo'`) + `payment_request` decision (existing kind) whose payload is
   `{ rail, network, token:"OUSD", amount_display, to, memo, fee_estimate_usd, sponsored: true }`.
2. Approve → `resolvePayment` (the existing `approvePaymentRequest` arm, extended by
   rail): CAS `pending → submitting`; re-check balance + caps; `client.token.transferSync({
   token: OUSD, to, amount, memo, feePayer: true, nonceKey: "expiring" })`; on receipt
   `status === "success"` → `submitted` with `tx_ref = "${chainId}:${hash}:${logIndex}"`
   of the `Transfer` log to **our recipient** (a receive policy can redirect — if no
   matching log, state `redirected` → surfaced as "delivered to the recipient's guard,
   not their balance" and never retried); timeout → look up the hash once; still unknown
   → **`uncertain`** (C23, `WalletSubmitUnknownError` semantics). Receipt line with
   `explorerLink("tempo", hash)`.
3. `expiring` nonces mean no nonce bookkeeping; the resolver never sends two
   transactions for one request (`transferIdempotencyKey(transferId)` is recorded on
   the row before the send; a second resolve finds `submitting` and stops).

### 6.3 Receive (`/pay request … on tempo`)

Row with `receive_address` = the user's Tempo address, `memo_bytes32` = request id
(short, opaque: `INV-<6>`), `expires_at` 24 h. Card shows address + memo + amount and a
QR of `ethereum:<OUSD>@<chainId>/transferWithMemo?address=<to>&uint256=<amt>&bytes32=<memo>`
(EIP-681-style; wallets that cannot parse it still see the address/memo text).
`tick()`: for each open request, `client.getContractEvents({ address: OUSD, abi:
Abis.tip20, eventName: "TransferWithMemo", args: { to, memo }, fromBlock })` on
finalized blocks → match token + recipient + `amount ≥ requested` → set `paid`,
`tx_ref`, `paid_amount` in one update guarded by the unique `tx_ref` index (dedupe) →
owner line via the existing `deliverTradeApproval`-style sender (reuse the pay
mini-app's notifier). Optional: Tempo REST `getAddressActivities?type=transfer` as a
cheaper poll; the finalized log is the source of truth either way.

### 6.4 MPP on the mini-app gate (seller)

`lib/payments/mpp.ts` — manual `mppx/server` API:

```ts
const mppx = Mppx.create({ realm: externalOrigin(request), methods: [tempo({
  currency: OUSD, recipient: publisherTempoAddress, testnet: !chainFor("tempo").liveEnabled(),
  feePayer: sponsorAccountOrUndefined })] });
const result = await mppx.charge({ amount: priceUsd })(request);   // 402 → result.challenge
```

Gate order unchanged (visibility → password → **pay** → session). The pay gate:
- GET without credentials → one `402` carrying **both** the x402 JSON body (`accepts`:
  Base + Solana entries, §7) **and** the MPP `WWW-Authenticate: Payment …` header;
  the human pay page lists all three.
- `Authorization: Payment …` → `result.status !== 402` ⇒ verified+settled by mppx
  (pull mode broadcasts the client's signed TIP-20 transfer; Air may sponsor fees) →
  insert `x402_receipts` (`protocol='mpp'`, `network`, nonce = credential hash /
  tx hash, first-insert-wins) → mint paid session → `result.withReceipt(response)`.
- `X-PAYMENT` → today's x402 path.
Publisher payout: `users.tempo_address` (verified like `wallet_address`) — if absent,
the MPP challenge is omitted and only x402 is offered (never invent a recipient, MA6).

### 6.5 The agent as buyer (`machine_payment` + `pay_policy`)

Box route `POST /api/pay {action:"machine", url, method, body?}` (interactive origin,
W8): the control plane fetches the URL **without paying**, parses the challenge
(x402 `accepts[]` or MPP `WWW-Authenticate: Payment`), picks the cheapest rail Air can
pay (`tempo` for MPP; `base`/`solana` for x402), normalizes to
`{ protocol, rail, network, amount, asset, recipient, realm, url }`, writes
`machine_payments(previewed)` → if an active `pay_policy` covers `host`, amount ≤
`per_charge_usd` and daily headroom → `paying` immediately (W7 standing approval);
else `pending_approval` + `machine_payment` decision. Resolver `resolveMachinePayment`:
re-fetch the challenge (it must match the stored one: same amount/asset/recipient,
else `expired` with "the price changed"), create the credential (`mppx/client`
`createCredential` with the user's Tempo signer; x402 via the CDP wallet client), make
the paid request, store the response body in the Box at
`.hermes/miniapps/pay/machine/<id>.json` (C4; the body is the user's content), write
`receipt`/`tx_ref`, state `paid`; the box skill reads that file. Failures after
credential creation → `uncertain`, never retried.

`pay_policy`: `/pay policy allow api.example.com up to $0.50 per call, $5/day, 7 days`
→ decision → `pay_policies` row. On Tempo, when the user's signer is an access key
(v1.1), the resolver also calls `client.accessKey.authorizeSync({ limits: [{ token:
OUSD, limit, period: 86400 }], scopes: [{ address: OUSD, selector:
"transferWithMemo(address,uint256,bytes32)" }], expiry })` so the budget is enforced
on-chain too; revoke on `/pay policy revoke` (permanent on Tempo — say so on the card).

### 6.6 Signer model

- **v1 (this session, testnet):** per-user secp256k1 key generated server-side,
  sealed in `provider_keys`-style storage (`user_chain_keys(user_id, rail,
  address, secret_sealed, hint)`), opened only in the resolver, funded by the faucet
  (`client.faucet.fundSync({ account })` on Moderato). This is a custody shape Air does
  not have today (Air holds raw key material) — acceptable on testnet; **mainnet is
  blocked until v1.1** (§15).
- **v1.1 (before `TEMPO_LIVE_ENABLED`):** the user's **Tempo Wallet** (passkey) is the
  root; Air holds only an **access key** the user authorized with limits/expiry/scopes
  (Tempo's documented agent model). Onboarding on the mini origin with the Accounts SDK
  `Provider.create` + `client.accessKey.authorizeSync` signed in the browser; Air stores
  the access key sealed. Air's caps and the on-chain limits are kept equal by the
  resolver.

### 6.7 Acceptance (§12 W2)

---

## 7. W3 — Solana pay rail: wallet, Solana Pay, x402 (1 session)

### 7.1 Files

```
apps/web/lib/chains/solana/client.ts        @solana/kit rpc (createSolanaRpc / createSolanaRpcSubscriptions) per network; C5 hosts
apps/web/lib/chains/solana/wallet.ts        per-user Solana account via CDP server wallets (@coinbase/cdp-sdk); never a raw key in Air
apps/web/lib/pay/rails/solana.ts            solanaRail: previewSend / submitSend / request (Solana Pay) / watchReceive / balance / tick
apps/web/lib/pay/solanaPay.ts               encodeURL / findReference / validateTransfer wrappers (@solana/pay 1.x, Kit-based)
apps/web/lib/payments/x402.ts               protocol v2 upgrade (@x402/core, @x402/evm, @x402/svm) with v1 header compatibility; Solana accepts entry
apps/web/lib/pay/machine.ts                 x402 buyer arm on Solana (createSvmClient + wrapFetchWithPayment) — same resolver as §6.5
apps/web/lib/miniapps/apps/pay.tsx          "on solana" rail chip; request card renders the Solana Pay QR
apps/web/lib/wallet/read.ts                 Solana balances (SOL + USDC ATA) in the Wallet tab (value-free projection)
infra/template/skills/pay-rails/SKILL.md    + solana arms
```

Dependencies (pin exact): `@solana/kit` 8.x, `@solana-program/token`, `@solana-program/memo`,
`@solana/pay` 1.0.x, `@x402/core` `@x402/evm` `@x402/svm` `@x402/fetch` 2.x,
`@coinbase/cdp-sdk`. **No `@solana/web3.js` v1 in `lib/`** (the Meteora/Squads SDKs
are v1 and belong only in the §16 stretch behind an adapter module).

C5 hosts: `api.devnet.solana.com`, the Helius mainnet URL from `SOLANA_RPC_URL`,
`api.cdp.coinbase.com`, `x402.org` (testnet facilitator), `api.developer.coinbase.com`
(onramp session tokens, optional).

### 7.2 Wallet (CDP server wallet, Solana account)

One Solana account per user, created lazily on first `/pay … on solana` or `/wallet
solana` through `@coinbase/cdp-sdk` (`cdp.solana.createAccount({ name: userId })`,
address stored in `users.solana_address`); the key never exists outside CDP. Signing
happens only in the resolver: build the transaction with Kit, hand the serialized
message to CDP to sign, submit with Kit. Devnet funding: `cdp.solana.requestFaucet`
(SOL + devnet USDC where available) or the Circle faucet for devnet USDC
(`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). Mainnet funding: CDP Onramp session
token (`POST https://api.developer.coinbase.com/onramp/v1/token`, `blockchains:
["solana"]`, 5-minute single-use token, hosted URL `https://pay.coinbase.com/buy/
select-asset?sessionToken=…&defaultNetwork=solana`) — a link the Wallet tab shows,
never an automated purchase.

If `CDP_WALLET_SECRET` is absent the rail is read-only (balances, requests) and sends
refuse with "connect a Solana wallet provider" — never a silent fallback to a raw key.

### 7.3 Send (`payment_requests.currency = 'usdc_sol'`)

Preview: validate base58 address (`^[1-9A-HJ-NP-Za-km-z]{32,44}$`), amount
(`parseUnits(amount, 6)` as bigint), balance (`getTokenAccountBalance` of the user's
USDC ATA), caps (`assertPayCaps`), recipient ATA existence (if missing, the preview
says "creates the recipient's USDC account, +~0.002 SOL rent" and includes the
create-ATA instruction), SOL for fees (devnet airdrop / mainnet "top up" line). Row +
`payment_request` decision with payload `{ rail:"solana", network, token:"USDC",
amount_display, to, memo? }`.

Resolve: CAS `pending → submitting`; rebuild `[SetComputeUnitLimit,
SetComputeUnitPrice(≤ 5 lamports/CU), (CreateATA)?, TransferChecked(USDC, 6), Memo(request id)]`
as a **v1** transaction (`createTransactionMessage({ version: 1 })`), sign via CDP,
`sendAndConfirmTransaction` at `confirmed`; `tx_ref = signature`; state `submitted`
→ `tick()` promotes to `paid` at `finalized`. A timeout after send → look the
signature up once (`getSignatureStatuses`); still unknown → **`uncertain`** (C23).
The blockhash lifetime (~60–90 s) is the natural expiry: a resolve after it fails
closed with "preview expired, ask again".

### 7.4 Receive — Solana Pay transfer requests

`/pay request 12 USDC on solana [memo …]` → `reference = generateKeyPairSigner().address`
(stored on the row), URI from `@solana/pay`:

```ts
encodeURL({ recipient: address(users.solana_address), amount: 12, splToken: address(USDC_MINT),
            reference, label: "Air", message: "Request INV-7", memo: requestId });
// solana:<recipient>?amount=12&spl-token=<mint>&reference=<ref>&label=Air&message=…&memo=…
```

QR via the existing `lib/wallet/qr.ts` (server SVG; `createQR` from `@solana/pay` is
browser-only and is not used). The card shows the URI, the QR, and the address.
`tick()`: `findReference(rpc, reference, { finality: "confirmed" })` →
`validateTransfer(rpc, signature, { recipient, amount, splToken, reference })` →
`paid` with `tx_ref = signature`, `paid_amount`; dedupe on the unique `tx_ref` index.
Expire at 24 h. Transaction-request links (`solana:https://…`) are **not** v1.

### 7.5 x402 on Solana (gate + buyer)

- Upgrade `lib/payments/x402.ts` to protocol v2: `x402ResourceServer(new
  HTTPFacilitatorClient({ url }))` registered for `eip155:*` (`ExactEvmScheme`) **and**
  `solana:*` (`ExactSvmScheme`); build `accepts` from the registry: Base entry as today
  (payTo = `users.wallet_address`) + Solana entry (`network:
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"` on devnet / mainnet CAIP-2, `asset` = USDC
  mint, `payTo = users.solana_address`, `maxTimeoutSeconds: 60`, `extra.feePayer` from
  the facilitator). Omit the Solana entry when the publisher has no Solana address
  (MA6). Keep accepting v1 `X-PAYMENT` for existing clients during the window; respond
  with v2 `PAYMENT-REQUIRED` / `PAYMENT-RESPONSE` headers plus the v1 JSON body.
  Facilitator: `https://x402.org/facilitator` on devnet/Sepolia; mainnet = the CDP
  facilitator (`https://api.cdp.coinbase.com/platform/v2/x402`, existing CDP keys).
  Receipt: `x402_receipts(protocol='x402', network=<caip2>)` keyed on the payment
  signature / tx, first-insert-wins, before the paid session (W4).
- Buyer (§6.5 `resolveMachinePayment`, x402 arm): `createSvmClient({ signer:
  toClientSvmSigner(cdpBackedSigner) })` + `wrapFetchWithPayment(fetch, client)` with an
  `onBeforePaymentCreation` hook that asserts the selected requirement equals the
  stored challenge (amount, asset, payTo, network) — any drift aborts with
  "price changed". Default-asset price strings (`"$0.01"`) resolve to USDC on Solana.

### 7.6 Wallet tab

`lib/wallet/read.ts` gains a Solana summary (SOL lamports, USDC ATA balance, last 10
signatures via `getSignaturesForAddress`) rendered as a second block in the Wallet
panel with the network chip; the Onramp link appears when `SOLANA_LIVE_ENABLED`.

### 7.7 Acceptance (§12 W3)

- `pay/solanaPay.test.ts`: URI encodes every field; reference round-trips; amount
  with > 6 decimals is rejected.
- `rails/solana.test.ts` on recorded RPC fixtures: ATA-missing preview adds the
  create instruction; `uncertain` on unknown signature; `tick()` marks a request paid
  once (duplicate `findReference` hit is a no-op).
- `payments/x402.test.ts`: 402 body carries both `accepts` entries; a v1 `X-PAYMENT`
  for Base still settles; a Solana `PAYMENT-SIGNATURE` settles only through the
  injected facilitator and writes the receipt before the session.
- Devnet gate: `/pay request 1 USDC on solana` paid from Phantom devnet flips to
  `paid`; `/pay 1 USDC to <addr> on solana` approves and lands; `npx awal x402 pay`
  (or the `x402-template` client) opens a priced mini-app on devnet.

---

## 8. W4 — `/formation` mini-app (1 session)

### 8.1 Registry + module

- `supabase/migrations/0141_worlds_fair.sql`: `mini_apps` row `slug='formation'`,
  `route='/mini/formation'`, `kind='render'`, `visibility='private'`,
  `access='single'`, `status='published'`, `scopes='{formation:manage}'`;
  `CardKind` + `miniapp_card_sessions` + `card_sends` checks gain `'formation'`;
  `decisions.kind` gains `'formation_submit'`.
- `apps/web/lib/miniapps/apps/formation.tsx` exporting `formation: MiniAppModule`;
  `render`/`action` return `forbidden` unless `ctx.session.role === "owner"`; no
  `guestActions`; `renderShell`/`shellHtml`; prompt bar enabled with
  `{ app: "formation", resource: "packet" }`.
- Helper lane `apps/web/lib/formation/` (`packet.ts` types + zod, `decide.ts`,
  `providers.ts`, `deadlines.ts`, `status.ts`), colocated tests, `formation.goal.md`.
- Box documents (C4, `withStateLease`): `.hermes/miniapps/formation/packet.json`,
  `status.json`, `actions.json` (append-only, MA10).
- Box skill `infra/template/skills/formation/SKILL.md`: how the agent fills the packet
  through `POST /api/formation` (box auth), what it must never do (pay, promise legal
  outcomes), and how it reports.

### 8.2 Packet (`packet.json`, version 1)

```ts
interface FormationPacket {
  version: 1;
  decision: { entity: "wyoming_llc" | "delaware_ccorp" | null; reasons: string[]; answeredAt?: string;
              answers: { foundersResidency: "us" | "non_us" | "mixed" | null; raising: boolean | null;
                         options: boolean | null; tokenTreasury: boolean | null } };
  company: { name: string; alternates: string[]; nameCheck?: { state: string; available: boolean | null; checkedAt: string } };
  founders: Array<{ name: string; email: string; residency: string; equityPct: number; role: string }>;
  addresses: { principal: Address; mailing?: Address };
  registeredAgent: "provider" | { name: string; address: Address };
  needs: { ein: boolean; bank: boolean; invoicing: boolean; eightyThreeB: boolean };
  provider: { id: "stablecorp"; package: "llc" | "ccorp"; priceUsd: number | null; quotedAt: string | null };
  completeness: { missing: string[] };                     // computed, never hand-edited
}
```

`status.json`: `{ version: 1, stage: "deciding" | "intake" | "ready" | "submitted" |
"filed" | "ein" | "bank" | "ready_to_operate", submittedAt?, filedAt?, einAt?,
bankAt?, issuanceDate?, deadlines: [{ kind: "83b" | "annual", dueAt, calendarMomentId }],
documents: [{ kind, vaultItemId, addedAt }] }`.

### 8.3 Screens (one screen each, no modals)

| Tab | Shows | Actions |
|---|---|---|
| **Decide** | Three questions (residency, raising/options, token treasury) → recommendation card with reasons from Stablecorp's LLC-vs-C-Corp guidance; "Override" | `decide` (writes `packet.decision`) |
| **Packet** | Checklist of fields with ✓/○, name-check result, equity bar, missing list | `packet-set` (field writes, zod-validated), `name-check` (files a Box browser task on the state registry; result written by the agent) |
| **Submit** | The exact packet + provider package + quoted price + disclosure ("Stablecorp is the provider; Air stores, reminds, and stops before payment") → **Approve handoff** | `submit` → `formation_submit` decision (`ref` = status row id; payload value-free summary) |
| **Status** | Tiles Filed → EIN → Bank → Ready; deadlines with countdowns; documents list | `status-set` (owner taps), `deadline-add` |
| **Money** | Links into `/pay` (USD Stripe, USDC Base/Solana, Tempo with memo = invoice), Squads Altitude note | — |

### 8.4 Decision → handoff

`resolveFormationSubmit(action="approve")`: CAS `stage ready → submitted`; create a
Box browser task that opens `https://mystablecorp.xyz/` checkout for the chosen
package with the packet fields pre-typed by the agent (`browser-use` skill) **under
the existing purchase stop** (`purchase_review`): the agent fills forms, the human
clicks Pay. No credentials, no card data, nothing stored for the provider. The
resolver's only side effects are the stage flip and the task; the money step is the
existing rail. Deny → `ready`.

### 8.5 Deadlines and documents

- When the owner sets `issuanceDate` (or the agent parses it from the provider email),
  `deadlines.ts` creates calendar moments: **83(b)** due `issuanceDate + 30 days` with
  reminders at 21/7/2 days (`agent_schedules` deliveries on the user's line), and the
  annual compliance date for the state. Moments are created through the calendar
  spine's normal approval (`calendar_add`) so the owner sees them land.
- Provider emails (AgentMail inbound) are matched by sender domain and the agent
  updates `status.json` + files documents into the vault with the existing
  `vault_fill` path. No email body is stored in Postgres (C4).

### 8.6 Copy rules

Never "we will form", "guaranteed", "legal advice". Prices are "Stablecorp's current
pricing; confirm at checkout". The 83(b) copy names the IRS deadline plainly.

### 8.7 Acceptance (§12 W4)

---

## 9. W5 — Zcash shielded wallet in the Box (1–1.5 sessions)

### 9.1 Shape

The wallet lives **in the user's Box**, under a dedicated system user, with a thin
Rust binary `air-zec` built on the Ironwood-era `librustzcash` stack
(`zcash_client_backend ≥ 0.24`, `zcash_client_sqlite ≥ 0.22`, `zcash_proofs`
`bundled-prover`, `zip321`, `tonic` with `lightwalletd-tonic-tls-webpki-roots`),
mirroring `zcash/zcash-devtool`'s `wallet init / sync / balance / list-addresses /
propose / send / pay` commands (the walkthrough is the reference; its binary is not
production). The control plane never sees a seed or spending key. The agent can read
and stage; only a **single-use execution nonce** minted by the decision resolver lets
`air-zec exec` spend.

```
agent (hermes user) ── air-zec balance|address|request|propose ──▶ wallet db (ro view) ──▶ POST /api/wallet/zcash (stage)
owner taps Approve ──▶ resolver mints nonce ──▶ box command: sudo -u zcash air-zec exec --send <id> --nonce <n>
                                                   └─▶ air-zec claims the nonce at POST /api/wallet/zcash/exec-claim (atomic, once)
                                                   └─▶ builds + proves + signs + broadcasts via lightwalletd ──▶ txid ──▶ POST …/exec-result
```

### 9.2 Files

```
infra/template/air-zec/                      Rust crate (Cargo.lock pinned); built at template bake (setup.sh), installed to /usr/local/bin/air-zec
infra/template/air-zec/src/{main.rs,wallet.rs,sync.rs,request.rs,exec.rs}
infra/template/zcash.sudoers                 hermes may run `air-zec {balance,address,request,propose,sync}` as zcash; `exec` only from the control-plane command path
infra/template/skills/zcash/SKILL.md         agent-facing skill (no send command)
apps/web/lib/chains/zcash/{client.ts,nonce.ts}   control-plane side: box command wrappers, exec-nonce HMAC (ZCASH_EXEC_SIGNING_KEY)
apps/web/lib/pay/rails/zcash.ts              zcashRail: balance (from Box doc), request (ZIP-321), previewSend (stage), submitSend (exec via nonce), tick (reconcile)
apps/web/app/api/wallet/zcash/route.ts       box/owner: resource=balance|address|requests ; action=request|propose ; exec-claim ; exec-result
apps/web/lib/miniapps/apps/pay.tsx + /home Wallet panel   "ZEC" block: shielded balance, UA, QR, sends
supabase/migrations/0141_worlds_fair.sql     zcash_sends table + decision kind (below)
```

### 9.3 Wallet lifecycle (in the Box)

- **Init** (first `/zec address` or provisioning step when `ZCASH_ENABLED`): `air-zec
  init --network test|main --server testnet.zec.rocks:443|zec.rocks:443` generates a
  24-word mnemonic, encrypts it with an `age` identity stored at
  `/var/lib/air-zec/identity` (owner `zcash:zcash`, mode 0600), birthday = current
  chain height (short first sync), writes `wallet.sqlite` + `blocks/` under
  `/var/lib/air-zec/` (not under `.hermes/`, so the agent's file tools cannot read it;
  C4 still holds: the content is in the Box). The mnemonic is shown **once** on the
  Wallet tab via the control plane's `readFile`-free path (the binary prints it to the
  command result exactly once and then refuses `display-mnemonic` unless a fresh
  owner-session-signed request arrives) — the owner's backup is theirs.
- **Sync**: a systemd timer runs `air-zec sync` every 2 minutes while the Box is
  awake (`update_chain_tip → suggest_scan_ranges → scan_cached_blocks → enhance`),
  writing a value-free status (`height`, `synced_at`) and the balance summary to
  `.hermes/miniapps/zcash/snapshot.json` (agent-readable, lease-written). Ironwood
  (NU6.3, mainnet since 2026-07-28) is handled by the crate wave; UAs are encoded by
  the library (Rev 0 where representable), receivers include the current shielded
  pool; the spec never hand-rolls pool selection (ZIP 326 forbids sending to other
  wallets' legacy Orchard receivers — the library enforces it).
- **Addresses**: `air-zec address --new` → a fresh UA (`u1…` / `utest1…`), written to
  `snapshot.json.addresses[]`; the agent shows the newest.
- **Requests** (ZIP-321): `air-zec request --amount 1.5 --memo "…" --label Air` →
  `zcash:u1…?amount=1.5&memo=<base64url, no padding>&label=Air` — the control plane
  renders the QR (`lib/wallet/qr.ts`) and files `payment_requests(currency='zec',
  rail='zcash', receive_address=UA)`; `tick()` matches incoming notes by memo/amount
  from the Box snapshot's received list (`list-tx` output), marks `paid` with
  `tx_ref = txid`.

### 9.4 Send: stage → approve → exec

1. `/zec send 0.1 to u1… memo "rent"` (or the agent via `POST /api/wallet/zcash
   {action:"propose", to, amount, memo}`) → the control plane runs `sudo -u zcash
   air-zec propose --to … --value <zatoshis> --memo …` in the Box: validates the
   address (`ZcashAddress::try_from_encoded`, rejects transparent-only + memo),
   computes a **ZIP-317 proposal** (`propose_transfer` with `GreedyInputSelector` and
   `MultiOutputChangeStrategy`), returns `{ fee_zatoshis, total, proposal_hash,
   spendable, anchor_height }` — no key is touched. Row `zcash_sends(previewed)` +
   caps (`assertPayCaps` at the ZEC→USD rate from the box's cached rate or 0 when
   unknown → per-send cap in ZEC via `ZCASH_PER_SEND_CAP_ZEC`) → `pending_approval`
   + `zcash_send` decision (payload: to (first 20 chars + last 6), amount, memo
   presence, fee, network).
2. Approve → `resolveZcashSend`: CAS `pending_approval → executing`; mint
   `nonce = HMAC(ZCASH_EXEC_SIGNING_KEY, sendId ‖ proposal_hash ‖ exp(2 min))`; run
   `sudo -u zcash air-zec exec --send <id> --nonce <nonce>` via `lib/box/client.command`.
3. `air-zec exec` **first** calls `POST /api/wallet/zcash/exec-claim {sendId, nonce,
   proposal_hash}` with the Box's gateway token; the control plane verifies the HMAC,
   atomically flips `executing → claimed` (a second claim is 409 and the binary
   exits without signing). Only then does the binary decrypt the identity, re-propose,
   assert the proposal hash is unchanged (else `exec-result{state:"expired"}` and no
   signature), `create_proposed_transactions` with the bundled prover and
   `OvkPolicy::Sender`, and `send_transaction` to lightwalletd. It posts
   `exec-result {txid}` → row `submitted`; `tick()` reads the Box snapshot's mined
   height → `confirmed` after 1 confirmation (testnet) / 3 (mainnet). Broadcast
   ambiguity (connection drop after `send_transaction`) → `uncertain`, never
   re-executed; the next sync shows the txid or not and the owner is told.
4. Deny / expiry (5 min) → `denied` / `expired`; the nonce is never minted.

### 9.5 Tables

```sql
create table zcash_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  decision_id uuid references decisions(id) on delete set null,
  network text not null check (network in ('main','test')),
  to_address text not null, amount_zat bigint not null, memo_present boolean not null default false,
  fee_zat bigint, proposal_hash text not null,
  state text not null check (state in ('previewed','pending_approval','executing','claimed','submitted','confirmed','denied','expired','failed','uncertain')),
  txid text, error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index zcash_sends_pending_idx on zcash_sends (user_id) where state in ('pending_approval','executing','claimed');
-- value-bearing memo text never leaves the Box; Postgres stores memo_present only (C4/C18).
```

### 9.6 Why this is the trust boundary

The agent user can run `air-zec propose` (read-only + proposal) but has no sudo
entry for `exec`; the identity file is unreadable to it; `exec` without a claimable
nonce exits before touching the key; the nonce is minted only by the resolver after
the owner's tap; the control plane never holds the key. A compromised agent prompt can
stage a send (which the owner sees as a card) and nothing else. This is T1 for a
chain whose stack cannot live in a serverless control plane.

### 9.7 Acceptance (§12 W5)

- Rust: `cargo test` in `infra/template/air-zec` (request URI grammar per ZIP-321
  incl. memo base64url without padding and the transparent+memo rejection; proposal
  hash determinism; `exec` refuses without a claim; `exec` refuses on proposal drift).
- Control plane: `chains/zcash/nonce.test.ts` (HMAC, expiry, single claim),
  `rails/zcash.test.ts` (state machine, `uncertain` terminal), route tests for
  `exec-claim` (409 on second claim, 403 without gateway token).
- Testnet gate: init → fund from a testnet faucet → `/zec balance` after sync →
  `/zec request 0.01` QR paid from another testnet wallet flips to `paid` → `/zec send
  0.005 to utest1…` approve → txid visible on a testnet explorer; a forced second
  `exec` with the same nonce is refused.

---

## 10. W6 — Docs and skills (½ session, runs alongside everything)

- `docs/site/index.md`, `solana.md`, `tempo.md`, `hyperliquid.md`, `zcash.md`,
  `formation.md` are the source of truth for `air.wzrd.tech/docs/<slug>`. The operator
  mirrors them to the docs site (Mintlify) exactly as `docs/muse-connector.md` is
  mirrored to `/docs/muse`; a page is "done" when the public URL matches the repo
  file byte-for-byte modulo front-matter.
- Each page carries the commands a judge can type, the invariants, the network table,
  and the official links from the Colosseum corpus; nothing on a page describes
  unshipped behavior as live — update the page in the same PR as the feature.
- `.agents/skills/air-worlds-fair` routes Devin and the Box to the installed sponsor
  skills; `.agents/skills/zcash` (W5) is the only track skill the ecosystem does not
  ship.
- Box skills landing in template `infra/template/skills/`: `trade` (updated),
  `pay-rails`, `machine-pay`, `zcash`, `formation`; add to `base-skills`
  manifest/`verify-box.sh` expectations.

---

## 11. Box skills — contract

All five skills follow `infra/template/skills/trade/SKILL.md`: derive `BASE` from
`OPENAI_BASE_URL`, authenticate with the gateway token, **stage only**, tell the owner
the card is waiting, stop. Hard rules every skill repeats verbatim:

1. Never present a preview as executed.
2. One approval at a time per lane; a second request is refused with the pending one named.
3. An uncertain result is terminal; report it, never retry.
4. Reads are free; anything that moves value is a decision.
5. Name the network on every line ("on Tempo testnet", "on Hyperliquid testnet").

`zcash` additionally: the agent has **no** send command; it may call `balance`,
`address`, `request`, and `propose`. `zcash-exec` is a separate binary the agent cannot
invoke with a valid nonce (§9).

---

## 12. Verification

Standard per session: `cd apps/web && npm run typecheck && npm run lint && npm test
-- --run && npm run build`; `scripts/apply-migrations.sh` shadow-applies `0141` in
`ci.yml`; `verify-box.sh` sees new skills; `docs/review-findings.json`-style ledger
is not required for this program, but every commit names its session.

| Session | Unit (colocated Vitest, no network) | Resolver / integration | Manual gate before any `*_LIVE_ENABLED` |
|---|---|---|---|
| W0 | `chains/registry.test.ts` (every rail resolves testnet by default; `liveEnabled` flips), `pay/parse.test.ts` (every arm + `/payment`, `/pay\n`, memos > 32 bytes), `pay/caps.test.ts` | `api/decisions` accepts the four new kinds and rejects unknown; needs-panel renders value-free | — |
| W1 | `hyperliquid/format.test.ts` (price/size rules incl. 5-sig-fig + `8−szDecimals`, `"0"` refused, cloid from uuid, lowercase), `venue.test.ts` on recorded `spotMetaAndAssetCtxs`/`spotClearinghouseState`/`order` fixtures (filled, resting, `{error}` in a batch `ok`, timeout → `uncertain`), `service.test.ts` `venueFor` picks the active connection; paper on HL prices | double-approve → one submit; `orderStatus(cloid)` reconciliation; `unknownOid` stays `uncertain` | Testnet: one $10 IOC buy of `HYPE-USDC`, one cancel via each approve surface, one forced timeout; builder fee shows on the fill |
| W2 | `tempo/rail.test.ts` (memo encoding, fee estimate, receive-policy redirect → `redirected`, `tx_ref` dedupe), `payments/mpp.test.ts` with an injected `Mppx` (402 shape carries both challenges; receipt before session), `pay/machine.test.ts` (challenge normalization x402/MPP, policy match, price-changed → `expired`) | `resolvePayment` tempo arm CAS; `resolveMachinePayment` stores the body in the Box; `tick()` marks paid once | Moderato: faucet → send with memo (sponsored) → watcher marks the mirror request paid; `npx mppx <mini-app url>` opens a paid session; `npx mppx --inspect` shows the challenge |
| W3 | see §7 | | Devnet |
| W4 | `formation/packet.test.ts` (completeness, zod), `decide.test.ts` (the three questions → recommendation matrix), `deadlines.test.ts` (83(b) = +30 d, reminders), `apps/formation*.test.ts` (owner gate, forbidden actions, submit requires `completeness.missing = []`) | `formation_submit` CAS; browser task is created under the purchase stop; deny restores `ready` | A real walk to the provider's checkout page with the stop engaged (no payment) |
| W5 | see §9 | | Testnet |
| W6 | docs pages lint (links resolve; every command in a page exists in a parser test) | | Public URLs resolve |

Skill acceptance (paper/testnet fixtures, `npm test` with `WF_EVAL_FIXTURE=1`): port
the trade evals' four shapes per rail — *approval*, *denial*, *balance language*,
*chained decomposition* — as scripted turns in `evals/agent-suite` (cases
`WF-HL-01..04`, `WF-TEMPO-01..04`, `WF-SOL-01..04`, `WF-ZEC-01..04`, `WF-FORM-01..03`).

---

## 13. Sessions and ordering

| # | Session | Depends on | Est. | Lands |
|---|---|---|---|---|
| W0 | Registry, migration `0141`, rail seams, parsers, cron, panel renderers | — | ½ | prerequisite for all |
| W1 | Hyperliquid venue | W0 | 1 | `/trade` on HL testnet + paper on HL prices |
| W2 | Tempo rail + MPP + machine payments | W0 | 1 | `/pay … on tempo`, MPP gate, agent buyer |
| W3 | Solana rail (CDP wallet, Solana Pay, x402 Solana) | W0 | 1 | `/pay … on solana`, Solana `accepts` |
| W4 | `/formation` | W0 | 1 | the mini-app end to end (no chain) |
| W5 | Zcash Box wallet | W0 + template build | 1–1.5 | `/zec` on testnet |
| W6 | Docs + skills | — | ½ | pages + skills (already drafted in this branch) |
| S1 | `/launch` (Meteora DBC, devnet, entitlement) | W3 | 1 | stretch |

**Submission-grade slice:** W0 → {W1, W2} in parallel → W6, then W3/W4/W5 as sessions
allow. W1 and W2 are chosen first because `/trade` and `/pay` already exist end to end
and each needs exactly one new venue/rail file to show the whole loop on a track's
native primitive.

---

## 14. Environment and credentials (all server-side, none `NEXT_PUBLIC_`)

| Variable | Session | Notes |
|---|---|---|
| `HL_LIVE_ENABLED` (`false`), `HL_BUILDER_ADDRESS`, `HL_BUILDER_FEE_TENTHS_BP` (`10`), `HL_SLIPPAGE_BPS` (`100`) | W1 | Builder address must be approved per user; keep `f ≤ 1000` (spot cap) |
| `TEMPO_LIVE_ENABLED` (`false`), `TEMPO_SPONSOR_URL` (`https://sponsor.moderato.tempo.xyz` on testnet; `https://api.tempo.xyz/rpc/sponsor?key=…` on mainnet), `TEMPO_API_KEY` (optional, `tempo:sk:…`), `MPP_SECRET_KEY` | W2 | `MPP_SECRET_KEY` is mppx's challenge-signing secret, not a chain key |
| `SOLANA_LIVE_ENABLED` (`false`), `SOLANA_RPC_URL` (Helius), `SOLANA_RPC_URL_DEVNET`, `SOLANA_USDC_MINT_DEVNET`, `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET` (exist), `CDP_WALLET_SECRET` | W3 | CDP server wallets need the wallet secret in addition to the API key |
| `ZCASH_LIVE_ENABLED` (`false`), `ZCASH_LIGHTWALLETD` (mainnet), `ZCASH_LIGHTWALLETD_TESTNET`, `ZCASH_EXEC_SIGNING_KEY` | W5 | the exec-nonce HMAC key, control-plane only |
| `X402_NETWORK` (exists: `base`), `X402_SOLANA_NETWORK` (`solana-devnet`) | W3 | both `accepts` entries are built from the registry |
| `PROVIDER_VAULT_KEY`, `MINIAPP_SIGNING_KEY`, `TRADE_PREVIEW_SIGNING_KEY` | exist | unchanged |

C5 host allowlists live in `lib/chains/registry.ts` per rail and are asserted by a
test that greps `fetch(` targets in the rail modules.

---

## 15. Open decisions (need the owner)

1. **Hyperliquid perps.** Spot-only (recommended) vs. owner-opt-in perps with isolated
   margin, a per-position cap as a `trade_settings` decision, and liquidation price on
   the card. Not in any session until decided.
2. **HL connection shape.** Paste-the-API-key (v1, matches Coinbase BYOK) vs.
   Air-generated agent + in-wallet `approveAgent` on the mini origin (needs a
   wallet-connect surface; cleaner custody story).
3. **Builder code.** Register `HL_BUILDER_ADDRESS` now (needs a funded HL account)
   or ship orders without `builder` for the submission.
4. **Tempo signer custody.** v1 sealed key on testnet is acceptable for the
   submission; **mainnet waits for the access-key model (v1.1)**. Confirm.
5. **Solana wallet provider.** CDP server wallet (recommended) vs. thirdweb.
6. **Formation provider surface.** Stablecorp-only handoff (recommended) vs. a picker.
7. **Zcash mainnet.** Testnet-only for the submission (recommended).
8. **MPP recipient.** Users' own Tempo address (`users.tempo_address`, verified) vs.
   Air-managed per-user address from the sealed signer (simpler now, custody later).

---

## 16. Stretch — `/launch` (Meteora DBC, devnet, entitlement-gated)

Specified for completeness; not scheduled. `apps/web/lib/miniapps/apps/launch.tsx` +
`lib/launch/` with `@meteora-ag/dynamic-bonding-curve-sdk` (`DynamicBondingCurveClient`):
the agent builds a **config** (quote mint USDC, migration target DAMM v2, curve
percentages, creator fee share, locked vesting) and a **pool** (name, symbol, supply,
metadata URI from the asset pipeline) as a preview; `launch_pool` decision shows every
field; the resolver (CDP Solana wallet, devnet) signs `createConfig` then
`createPool` with a deterministic seed derived from the preview so a retry cannot
create a second pool; `swapQuote`/`swap` reads only; migration is Meteora's keepers.
Program id `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` (mainnet and devnet).
Entitlement `launch` off by default; devnet only until reviewed.
