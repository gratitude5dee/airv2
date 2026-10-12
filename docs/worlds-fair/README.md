# Crypto World's Fair — what Air builds, and why (analysis + program index)

Colosseum's Crypto World's Fair (https://colosseum.com/worldsfair) is a multi-chain
hackathon with ecosystem tracks. Four tracks carry $100,000 pools — **Solana,
Hyperliquid, Tempo, Zcash** — and four carry $25,000 — Ethereum, Base, Arbitrum,
Robinhood Chain. Every track's resource bundle ends with the same shared group,
**"Company formation and banking"** (Stablecorp). Submissions close **11:59pm PDT,
2026-10-12**; only work done inside the window is judged.

This folder is the program of record for Air's entry:

| File | What it is |
|---|---|
| `README.md` (this file) | The analysis: which features, on which surface, and why — with the rejected options |
| `spec.md` | The executable spec for Devin (SWE-2 Max): milestones per session, invariants, routes, migrations, tests |
| `../site/{solana,tempo,hyperliquid,zcash,formation,index}.md` | Public docs pages, source of truth for `air.wzrd.tech/docs/<slug>` (mirrored by the operator, same convention as `docs/muse-connector.md`) |
| `../../.agents/skills/{colosseum-resources,solana-dev,tempo,hyperliquid-*,meteora,pay,agentic-wallet,arcium,…}` | Installed sponsor/track skills (`npx skills add …`, pinned in `skills-lock.json`) |

Read `ARCHITECTURE.md`, `docs/goal-miniapps-v9.md` and `docs/trade/plan.md` before
`spec.md`. Where this folder and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins.

---

## 1. The thesis — one approval card, many chains

Air is one person's agent: its own phone number, inbox, computer, and wallet. The
thing Air already does that no chain SDK does is **the money contract**: an agent may
*stage* a payment, an order, a purchase, a publish — and only the owner's tap on an
exact, expiring preview executes it (`decisions` resolver, T1–T9 in
`docs/trade/plan.md`, C23 "an uncertain submit is terminal"). Paper mode rehearses the
same path with fake money.

Every World's Fair track is, from Air's point of view, **one more venue or rail behind
that same card**:

```
 iMessage / web ──"/trade buy 20 HYPE"──▶ control plane ──▶ decisions(pending) ──▶ owner taps Approve
                                                                 │
                      TradeVenue seam ◀──────────────────────────┘  (Coinbase | paper | Hyperliquid …)
                      PayRail  seam   ◀────── payment_requests ──┘  (Stripe | Base USDC | Solana | Tempo | Zcash)
```

So the entry is not five hackathon demos; it is one product (**"your agent, every
chain, nothing moves without you"**) demonstrated on five tracks, each exercising that
track's native primitive:

| Track | Native primitive we exercise | Air surface |
|---|---|---|
| Hyperliquid | HyperCore spot via an owner-approved **API wallet**, builder code, candles | `/trade` — a third `TradeVenue` behind the existing tape + approval card |
| Tempo | **TIP-20** transfers with **memos**, **fee sponsorship**, **MPP** (HTTP 402 machine payments) | `/pay` rail + the mini-app pay gate (x402 **and** MPP) |
| Solana | **Solana Pay** transfer requests, **x402 on Solana**, Coinbase server wallets (Solana), Meteora **DBC** launch (stretch) | `/pay` rail + mini-app x402 gate (Solana accepts) + `/launch` (stretch) |
| Zcash | **Shielded** light wallet in the user's own Box (zingolib), **Unified Addresses**, **ZIP-321** requests, PCZT-style stage→approve→send | new `/zec` tab in Wallet + `zcash` box skill |
| Shared (every track) | **Company formation and banking** (Stablecorp): entity choice → formation packet → handoff → EIN/bank → USDC invoicing | new `/formation` mini-app |

The judges' question for every track is "did they use the thing that makes this
ecosystem different?" The table is the answer. The product question — "would an Air
user want this?" — is answered per track below.

---

## 2. Selection criteria (how the options were scored)

1. **Reuse of an existing seam.** `TradeVenue` (`apps/web/lib/trade/venue.ts`),
   `payment_requests` + `wallet_transfers` (`lib/commerce/paymentRequests.ts`,
   `lib/wallet/send.ts`), the mini-app gate chain with x402 (`lib/payments/x402.ts`),
   box documents (`lib/miniapps/store.ts`), the mini-app module contract
   (`lib/miniapps/apps/types.ts`), box skills (`infra/template/skills/*`). A feature
   that is "one more arm of an existing switch" ships in a session; one that needs a
   new approval system does not ship at all.
2. **Visible track-native usage.** Memos on Tempo, API wallets on Hyperliquid,
   shielded pools on Zcash, Solana Pay URIs — not "we can also send ETH here".
3. **Demo-able on a testnet with no owner-held funds.** Tempo Moderato has an RPC
   faucet; Hyperliquid has a testnet and paper mode already exists; Solana devnet;
   Zcash testnet via `-n test`. Mainnet is a flag flip, never a prerequisite.
4. **Key custody stays where Air already puts it.** Third-party money credentials
   live in the control plane, sealed (`trade_connections.secret_sealed`); user
   content and user-owned keys live in the Box (C4, C18); the browser never sees a
   secret. Anything that would hand a hot key to the agent process is rejected.
5. **Effort in Devin sessions** (half-day units). The window closes tonight; the
   spec orders work by demo value per hour and marks the submission-grade slice.

---

## 3. Hyperliquid — `/trade` gets a third venue

**Why it fits.** `/trade` *is* a trading app already: parser, tape, paper mode,
preview-token discipline, one-pending-approval, caps, reconciliation, iMessage
approval cards, cron expiry. `docs/trade/tape.md` literally cites Bloxwap
(self-custodial Hyperliquid perps) as the UX reference. The `TradeVenue` interface
exists so a venue is a file, not a rewrite.

**What we build.** `hyperliquidVenue` implementing `TradeVenue` for **HyperCore spot**
(`PURR/USDC`, `HYPE/USDC`, …) against `https://api.hyperliquid.xyz` (`/info` reads,
`/exchange` writes) and the testnet twin. Connection = the owner approves an **API
wallet** (agent key) from their master wallet once — `approveAgent` — and the agent
key's private key is sealed in `trade_connections` exactly like the Coinbase secret
(control plane only; the Box never holds it — this is the Adaam departure
`docs/trade/plan.md §7` explains). API wallets cannot withdraw, which is the right
blast radius for a key the control plane holds on the user's behalf. Orders carry
Air's **builder code** (`approveBuilderFee` once, `builder` field on orders) so the
venue is also a revenue line. Tape candles come from `candleSnapshot`; watchlist from
`allMids`.

**What we deliberately do not build.** Perps. T4/§0.1 of the trade plan says spot
only, by allowlist, forever — and a hackathon is the wrong moment to relitigate
leverage for a product whose brand is "nothing moves without you". The spec lists
perps as an open decision with the exact gate it would need (owner opt-in,
isolated-margin only, per-position cap as a `trade_settings` decision). HyperEVM
contracts are documented (chain 999/998, CoreWriter, system addresses for
Core↔EVM transfers) because the funding path for a HyperCore account runs through
them, but no contract is deployed.

**Rejected alternatives.** (a) Letting the Box hold the agent key and sign directly:
faster, but it makes T1 a property of the prompt instead of the architecture.
(b) A Hyperliquid *perps* ticket with 1x only: still a perp account, still liquidation
semantics the approval card cannot honestly render in five lines.

---

## 4. Tempo — `/pay` grows a stablecoin rail, and the gate learns 402 twice

**Why it fits.** Tempo is a payments chain (no native gas token, fees payable in any
USD TIP-20 token, dedicated payment lanes, 32-byte transfer memos, protocol-level
receive policies, fee sponsorship) co-designed with Stripe — and Air's commerce rails
are Stripe Connect + USDC. Air's `payment_requests` already has exactly two currencies
(`usd` → Stripe Checkout on the payee's connected account, `usdc` → the wallet
transfer approval). Tempo is a third row in that `check` constraint, not a new product.

**What we build.**
- **Send:** `payment_requests.currency = 'tempo'`: owner approval → control plane
  sends `transferWithMemo(to, amount, memo = request id)` from the user's server wallet
  on Tempo, fees **sponsored** so the user holds no gas token (Tempo's sponsor is
  testnet-only; production needs an approved payer — documented, flagged).
- **Receive:** `/pay request 25 USD on tempo` → a **virtual address** or the wallet
  address + memo; `accept-a-payment` watcher (Transfer events filtered by memo)
  flips the request to `paid` and texts the owner. Receive policies are set to the
  stablecoins Air accepts.
- **Machine payments:** the mini-app gate chain already answers `402` with x402
  `accepts`. We add the **MPP** challenge (`WWW-Authenticate: Payment …`, charge
  intent, Tempo method) alongside it, verified server-side before any body exists
  (MA5), receipts ledgered like `x402_receipts` (MA9). And the agent gets the client
  half: a `pay` policy that lets the Box call MPP/x402-priced services with the
  control plane paying under caps — the same "stage, never execute" shape, where the
  cap *is* the standing approval and every charge is receipted.

**Why both x402 and MPP.** They are the two live 402 dialects (Coinbase's and
Stripe/Tempo's). Air mini-apps as *sellers* should accept both; Air agents as *buyers*
should pay both. Tempo's docs frame MPP as the chain's "machine payments" category —
the one the track's resource groups call out explicitly.

**Rejected alternatives.** Issuing an Air TIP-20 stablecoin (the "issuance" build
path): it is a one-command demo but it is not a product Air's users need, and
mint/pause/freeze authorities are production security decisions, not hackathon ones.
Documented in `docs/site/tempo.md` as "what you could do next".

---

## 5. Solana — payments first, launch second

**Why it fits.** Solana's track bundle is the broadest; its build paths most relevant
to Air are *Payments + Commerce* (Solana Pay, subscriptions, x402 on Solana),
*Agents + Tokenization* (PAY.SH, Coinbase agentic wallet skills, Meteora DBC,
Metaplex), *Privacy* (Token-2022 confidential transfers, Arcium), and the sponsors
(Phantom Connect, Squads, Reflect, Meteora).

**What we build (v1).**
- **Solana wallet per user** via Coinbase CDP server wallets (Solana account) —
  the CDP key pair is already in the env for the x402 facilitator; the installed
  `agentic-wallet` skill is Coinbase's own SOL/USDC balance+transfer recipe. Keys stay
  at CDP; Air's resolver signs only after approval (same shape as the thirdweb Base
  wallet).
- **Solana Pay receive**: `/pay request 12 USDC on solana` → a `solana:` transfer
  request URI with `reference` + QR (we already ship server-side QR), and a watcher
  that confirms by reference and flips the request to `paid`.
- **x402 on Solana for the mini-app gate**: a second `accepts` entry (CAIP-2 Solana
  mainnet/devnet, USDC mint) through the same CDP facilitator; the pay page shows
  both. Publisher payout is the publisher's *Solana* address, verified the same way
  `users.wallet_address` is today — no custody (MA6).
- **Agent pays on Solana** under the same `pay` policy as Tempo (x402 Solana buyer
  through CDP wallet), receipted.

**Stretch: `/launch` (Meteora DBC).** A creator mini-app where the agent stages a
**Dynamic Bonding Curve** launch (name, symbol, supply, curve config, migration
target DAMM v2) and the owner approves the *exact config* before the pool exists.
This is Meteora's "Agents + Tokenization" path and it maps onto Air's Creator OS
surfaces (shop, storefront, ads). It is a stretch because token issuance is the one
place where "nothing moves without you" is necessary but not sufficient — the spec
gates it behind an entitlement and devnet-only until reviewed.

**Rejected / deferred.** Confidential transfers (Token-2022): the right privacy
story for payroll-style payouts, but both accounts need the extension, the ZK proof
flow is multi-step, and the stock test validator lacks the proof program — documented,
not built. Arcium: a different compiler and threat model; documented as the path for
a private order-flow venue later. Swaps via an aggregator as a `solanaVenue`: viable
(same seam as Hyperliquid) but it is a general-DEX feature, not a track-native one,
and the window is short.

---

## 6. Zcash — a shielded wallet that lives on the user's own computer

**Why it fits.** Air gives every user a Box: their own Linux computer that already
runs the vault, the browser, and the agent. Zcash's maintained stack is Rust
(`librustzcash`, `zcash_client_backend`, Zingolib, Zebra, lightwalletd); there is no
production JS light client. So the natural Air shape is **the shielded wallet runs in
the Box**, keys never leave it (C4: content in the Box; C18: secrets never on a
reduced-trust surface), and the control plane only sees what the approval card needs:
a Unified Address, an amount, a memo.

**What we build.**
- `zcash` box skill + a baked `zingo-cli` (maintained Rust wallet core) in the
  template: `balance`, new **Unified Address**, **ZIP-321** payment request
  (`zcash:u1…?amount=…&memo=…`) rendered as a QR in the Wallet tab.
- **Send = stage → approve → execute in the Box.** The agent files
  `POST /api/wallet/zcash/propose {to, amount, memo}` → `zcash_send` decision → owner
  taps Approve → the resolver issues a single-use execution nonce → the Box's
  `zcash-exec` (not the agent) checks the nonce against the control plane, builds and
  broadcasts the shielded transaction, reports the txid. The agent never has a path to
  `send` without a nonce; the control plane never has a key. This is the PCZT idea
  (propose/prove/sign/send split) applied to Air's trust boundary.
- Testnet by default (`-n test`, zec.rocks testnet lightwalletd); mainnet behind the
  same flag discipline as `TRADE_LIVE_ENABLED`.

**Rejected.** Running the wallet in the control plane (holds keys we do not want);
a browser/WASM wallet in the mini-app (C17 forbids client storage, and the
light-client sync does not belong in a 375 px card); `zcash-devtool` as the runtime
(explicitly "DO NOT commit significant funds"; it is the reference walkthrough, not the
binary).

---

## 7. Formation — the mini-app every track's bundle points at

**Why it fits.** "Company formation and banking" is in every track's resource groups.
The product is Stablecorp (mystablecorp.xyz): Delaware C-Corp or Wyoming LLC from
anywhere, no SSN, EIN, registered agent, US business bank account with a USDC
treasury, invoicing in USDC/EURC/USDT/fiat, 83(b), cap table. Founding-cohort
pricing: LLC from $999 one-time, C-Corp from $1,199 one-time (their marketing; verify
at checkout). There is **no public Stablecorp API** — the integration surface is a
guided intake, a handoff, and the money rails after.

Air is unusually good at exactly that: an agent that interviews you over iMessage,
keeps documents in your vault, puts deadlines on your calendar, drives a browser with a
purchase stop before any payment (`purchase_review`), and then runs your money through
approval-gated rails. The 83(b) election is a 30-day hard deadline most founders miss;
Air's calendar spine already does reminders.

**What we build: `/formation` mini-app** (`mini.wzrd.tech/formation`, owner-only):
1. **Decide** — entity picker driven by Stablecorp's LLC-vs-C-Corp guide (residency,
   investors, tokens/treasury plans) → a one-screen recommendation with reasons.
2. **Intake** — the agent collects the packet (company name + alternates, state,
   founders, equity split, addresses, registered-agent choice, mailing, EIN need,
   83(b) intent) into `.hermes/miniapps/formation/packet.json` (C4). Name availability
   check via browser-use on the state registry.
3. **Handoff** — `formation_submit` decision shows the exact packet + price; approval
   opens Stablecorp's checkout in the Box browser with the existing purchase stop
   (human clicks Pay). No scraping, no credentials stored for them.
4. **Track** — status tiles (filed → EIN → bank → ready) updated by the owner or by
   inbound email parsing (AgentMail); **83(b) countdown** and annual-compliance dates
   on the calendar; documents into the vault.
5. **Run the money** — USDC invoicing through `/pay` on Base, Solana, or **Tempo with
   memo = invoice number**; Squads Altitude listed as the treasury option.

**Rejected.** Generating legal documents ourselves (bylaws, RSPAs) — Stablecorp's
package includes them and we should not pretend to be counsel; the mini-app links,
stores, and reminds.

---

## 8. The $25k tracks — documented, not built

Base: Air's wallet *is* on Base (chain 8453, USDC) and the x402 gate settles there
today; nothing new is required to be "on Base", and the Base docs page says exactly
what already works. Arbitrum / Robinhood Chain (an Arbitrum Orbit chain, 4663 mainnet
/ 46630 testnet, ETH gas, Stock Tokens) / Ethereum L1: all EVM, all reachable by
changing `WALLET_CHAIN_ID` and the USDC address — the spec's chain registry (W0) makes
that a config row, and the docs pages say so. No entry-specific work beyond that.

---

## 9. Program and ordering

| # | Session (Devin SWE-2 Max) | Deliverable | Demo value / hour |
|---|---|---|---|
| **W0** | Chain registry + rail widening | `lib/chains/registry.ts` (Base, Solana, Tempo, HyperEVM, Zcash), `payment_requests.currency` widened, `decisions.kind` widened, migration `0141` | prerequisite |
| **W1** | Hyperliquid spot venue | `hyperliquidVenue`, Settings → Connect (API wallet), builder fee, tape candles | **highest** — the loop already exists |
| **W2** | Tempo pay rail + MPP | send with memo + sponsorship, receive watcher, MPP gate + client, Moderato faucet path | high |
| **W3** | Solana pay rail | CDP Solana wallet, Solana Pay receive, x402 Solana accepts, agent x402 buyer | high |
| **W4** | Formation mini-app | module, packet doc, `formation_submit` decision, 83(b) calendar, invoicing hooks | high (no chain risk) |
| **W5** | Zcash box wallet | `zingo-cli` in template, `zcash` skill, `zcash_send` decision + exec nonce, Wallet → ZEC tab | medium (longest lead time: sync) |
| **W6** | Docs + skills | `docs/site/*.md` → `air.wzrd.tech/docs/*`, `.agents/skills` pins, box skills | required for every track submission |
| Stretch | `/launch` (Meteora DBC) | devnet, entitlement-gated | — |

**Submission-grade slice for tonight:** W0 + W1 (paper + testnet) + W2 (Moderato) +
W6, with W3/W4 as far as a session gets. Each session is independent after W0 and
`spec.md §12` gives the per-session acceptance tests, so they run in parallel.

---

## 10. Open decisions for the owner

1. **Hyperliquid perps** — spot-only (recommended for v1) vs. an owner-opt-in perps
   ticket with isolated margin and a per-position cap as a `trade_settings` decision.
2. **Builder code revenue** — register Air's builder address now (needs an HL
   account with ≥100 USDC) or ship without the `builder` field.
3. **Solana wallet provider** — CDP server wallet (recommended: keys already in env,
   Solana-native, faucet on devnet) vs. thirdweb (one provider for Base and Solana, but
   its Solana send path is not what `lib/thirdweb/client.ts` exercises today).
4. **Formation handoff** — Stablecorp only (recommended; it is what every track's
   bundle links) or a provider picker (Stablecorp, Squads Altitude for treasury, a
   generic "I already have a company" path).
5. **Zcash mainnet** — testnet-only for the submission (recommended) or enable
   mainnet behind `ZCASH_LIVE_ENABLED` with a per-send cap.
6. **MPP on mainnet** — Tempo's public fee sponsor is testnet-only; production
   sponsorship needs an approved payer. Ship MPP on Moderato for the submission.
