# Crypto World's Fair — what Air builds, and why (analysis + program index)

Colosseum's Crypto World's Fair is a multi-chain hackathon with eight ecosystem
tracks — **Solana, Ethereum L1, Hyperliquid, Base, Tempo, Arbitrum, Zcash, Robinhood
Chain** (track ids in `https://ColosseumOrg.github.io/hackathon-resources/crypto-worlds-fair.json`).
Every track's resource bundle ends with the same shared group, **"Company formation and
banking"** (Stablecorp). Per-track prize pools and the submission deadline are *not* in
the resources corpus; this program assumes submissions close **11:59pm PDT,
2026-10-12** and that only work done inside the window is judged — confirm both on the
hackathon page before treating the §9 ordering as final.

This folder is the program of record for Air's entry:

| File | What it is |
|---|---|
| `README.md` (this file) | The analysis: which features, on which surface, and why — with the rejected options |
| `spec.md` | The executable spec for Devin (SWE-2 Max): §4.2 the final `0141` SQL, §4.4 repo conventions, §12 acceptance per session, §13 sessions and ordering, §15 open decisions, **§17 demo and submission** (owner pre-seed checklist, shot list, per-track blurbs) |
| `recommendations.md` | The verified review of this program: 14 ranked recommendations (R1–R14), the spec-correction appendix applied to `spec.md`/this file/`docs/site`, and the open questions nobody could verify offline. Read it to know *why* the spec reads as it does |
| `../site/{index,solana,tempo,hyperliquid,zcash,formation,evm-chains}.md` | Public docs pages, source of truth for `air.wzrd.tech/docs/<slug>` (slug from each file's front-matter; `index.md` → `/docs/worlds-fair`; mirrored by the operator, same convention as `docs/muse-connector.md`). Each carries a visible `Status: shipped \| testnet \| planned` line directly under its H1, and unshipped rows live under "What we document but do not ship yet" |
| `../../.agents/skills/{colosseum-resources,solana-dev,pay,agentic-wallet,meteora,arcium,tempo,hyperliquid-trading,hyperliquid-payments,hyperliquid-rust-sdk}` | Installed sponsor/track skills (`npx skills add …`, pinned in the root `skills-lock.json`) |
| `../../.agents/skills/{air-worlds-fair,zcash}` | Repo-authored (not in the lock). `air-worlds-fair` routes Devin to the rest — the Box never receives `.agents/skills` — and its non-negotiables carry spec §2's own numbering (WF1–WF9; sessions stay W0–W6) |

Read `ARCHITECTURE.md`, `docs/goal-miniapps-v9.md`, `docs/trade/plan.md` and
`recommendations.md` before `spec.md`. Where this folder and `ARCHITECTURE.md`
disagree, `ARCHITECTURE.md` wins.

---

## 1. The thesis — one approval card, many chains

Air is one person's agent: its own phone number, inbox, computer, and wallet. The
thing Air already does that no chain SDK does is **the money contract**: an agent may
*stage* a payment, an order, a purchase, a publish — and only the owner's tap on an
exact, expiring preview executes it (the `decisions` resolver — `lib/decisions/resolve.ts`
and its hosted-link twin `lib/approvals/hosted.ts` — T1–T9 in `docs/trade/plan.md`,
C23 "an uncertain submit is terminal"). Paper mode rehearses the same path with fake
money.

Every World's Fair track is, from Air's point of view, **one more venue or rail behind
that same card**:

```
 iMessage / web ──"/trade buy 20 HYPE"──────────▶ control plane ──▶ decisions(pending) ──▶ owner taps Approve
                 ──"/pay 25 OUSD to 0x… on tempo"─▶                                            │
     TradeVenue seam ◀──────────── trade_order ─────────────────────────────────────────────┘  (Coinbase | paper | Hyperliquid)
     PayRail.submitSend ◀── run_approval → executeTransfer (one wallet_transfers row) ───────┘  (Base USDC | Tempo OUSD | Solana USDC)
     air-zec exec in the Box ◀── zcash_send + single-use nonce ─────────────────────────────┘  (Zcash, shielded)
     receive: payment_requests ◀── rail.watchReceive / tick()      (Stripe | Base | Solana Pay | Tempo memo | ZIP-321)
```

Sends never create a `payment_requests` row: a Base/Tempo/Solana send is one
`wallet_transfers` row plus one `run_approval` decision, executed by the existing
`executeTransfer` lane (CAS, idempotency key, terminal `submit_unknown`) through
`PayRail.submitSend`; Zcash keeps its own `zcash_sends` row and `zcash_send` kind
(§6).
`payment_requests` is the receive ledger and the Stripe / legacy-USDC payee lane.
`/pay` gets deterministic canonical forms (`send`, `request`, `<rail> balance`,
`<rail> address`, `help`) with an agent fallback for anything else; `/zec …` is
shorthand for `/pay … zcash`.

So the entry is not five hackathon demos; it is one product (**"your agent, every
chain, nothing moves without you"**) demonstrated on five tracks, each exercising that
track's native primitive:

| Track | Native primitive we exercise | Air surface |
|---|---|---|
| Hyperliquid | HyperCore spot via an owner-approved **API wallet**, builder code, candles | `/trade` — a third `TradeVenue` behind the existing tape + approval card |
| Tempo | **TIP-20** transfers with **memos**, **fee sponsorship**, **MPP** (HTTP 402 machine payments) | `/pay` rail + the mini-app pay gate (x402 **and** MPP) |
| Solana | **Solana Pay** transfer requests, **x402 on Solana**, Coinbase server wallets (Solana) for sends, Meteora **DBC** launch (stretch) | `/pay` rail + mini-app x402 gate (Solana `accepts`) + `/launch` (stretch) |
| Zcash | **Shielded** light wallet in the user's own Box (`air-zec` on librustzcash), **Unified Addresses**, **ZIP-321** requests, PCZT-style stage→approve→send | `/zec` (shorthand for `/pay … zcash`) in Wallet + `zcash` box skill |
| Shared (every track) | **Company formation and banking** (Stablecorp): entity choice → formation packet → handoff → EIN/bank → USDC invoicing | new `/formation` mini-app |

The judges' question for every track is "did they use the thing that makes this
ecosystem different?" The table is the answer. The product question — "would an Air
user want this?" — is answered per track below.

---

## 2. Selection criteria (how the options were scored)

1. **Reuse of an existing seam.** `TradeVenue` (`apps/web/lib/trade/venue.ts`), the
   wallet-transfer lane (`lib/wallet/send.ts`: `createTransferRequest`,
   `executeTransfer`, `WalletSubmitUnknownError`), `payment_requests` for receives
   (`lib/commerce/paymentRequests.ts`), the mini-app gate with x402
   (`lib/payments/x402.ts`), checkout handoffs (`lib/checkout/handoffs.ts`), box
   documents (`lib/miniapps/store.ts`), the mini-app module contract
   (`lib/miniapps/apps/types.ts`), box skills (`infra/template/skills/*`). A feature
   that is "one more arm of the existing resolver chains" (`resolve.ts` **and**
   `hosted.ts`, in the same PR as its decision kind) ships in a session; one that
   needs a new approval system does not ship at all.
2. **Visible track-native usage.** Memos on Tempo, API wallets on Hyperliquid,
   shielded pools on Zcash, Solana Pay URIs — not "we can also send ETH here".
3. **Demo-able on a testnet with no owner-held funds.** Tempo Moderato has a faucet
   (`client.faucet.fundSync`); Hyperliquid has a testnet (its drip needs a
   mainnet-funded address) and paper mode already exists; Solana devnet with Circle
   faucet USDC; Zcash testnet via `testnet.zec.rocks` (no verified public faucet —
   source testnet ZEC early, spec §17). Mainnet is a flag flip, never a prerequisite.
4. **Key custody stays where Air already puts it.** Third-party money credentials
   live in the control plane, sealed (`trade_connections.secret_sealed`,
   `user_chain_keys.secret_sealed`); user content and user-owned keys live in the Box
   (C4, C18); the browser never sees a secret; nothing agent-writable feeds money
   logic. Anything that would hand a hot key to the agent process is rejected.
5. **Effort in Devin sessions** (half-day units), as fixture-green halves that run in
   parallel after one serial W0. The window closes tonight; §9 and spec §13 order
   work by demo value per hour and mark the submission-grade slice.

---

## 3. Hyperliquid — `/trade` gets a third venue

**Why it fits.** `/trade` *is* a trading app already: parser, tape, paper mode,
preview-token discipline, one-pending-approval, caps, reconciliation, iMessage
approval cards, cron expiry. `docs/trade/tape.md` literally cites Bloxwap
(self-custodial Hyperliquid perps) as the UX reference. The `TradeVenue` interface
exists so a venue is a file, not a rewrite.

**What we build.** `hyperliquidVenue` (`lib/trade/hyperliquid/{client,format,venue}.ts`,
`@nktkas/hyperliquid@0.33.3`) implementing `TradeVenue` for **HyperCore spot**
(`PURR/USDC`, `HYPE/USDC`, … resolved from `spotMeta` at runtime, never a hardcoded
index) against `https://api.hyperliquid.xyz` (`/info` reads, `/exchange` writes) and
the testnet twin. Connection (v1 — spec §15.2 is closed): the owner creates an **API
wallet** on `app.hyperliquid[-testnet].xyz/API`, approves it from their master wallet
there, and pastes its private key plus the master address into Settings → Connect
(`/trade connect hyperliquid`). Air seals the key in `trade_connections.secret_sealed`
exactly like the Coinbase secret, verifies it with `userRole`/`extraAgents`, and shows
only the last 4 of the agent address (control plane only; the Box never holds it —
this is the Adaam departure `docs/trade/plan.md §7` explains). API wallets cannot
withdraw, and Air's wrapper exposes exactly `order` and `cancelByCloid` (grep-tested),
asserts a spot `assetId` and sets `expiresAfter` on every order — the right blast
radius for a key the control plane holds on the user's behalf. `venueFor` switches on
the active connection's `provider`; `trade_orders.venue` is stamped at preview and
bound in the resolver; the SDK's `ApiRequestError` is a venue rejection, a transport
timeout is terminal `uncertain` (C23). Orders carry Air's **builder code**
(`approveBuilderFee` once at max 0.01%, `builder` on orders) so the venue is also a
revenue line. Prices go through a new `lib/trade/prices.ts` seam (`allMids`,
`spotMetaAndAssetCtxs`, `candleSnapshot`, no key) so paper mode, the tape and the
watchlist price `HYPE-USDC` from Hyperliquid. Live on HL — testnet included — still
requires `TRADE_LIVE_ENABLED`; `HL_LIVE_ENABLED` additionally gates mainnet on connect.

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
semantics the approval card cannot honestly render in five lines. (c) An
Air-generated agent keypair approved in-wallet (`approveAgent` on the mini origin):
the cleaner custody story, but it needs a wallet-connect surface — post-submission.

---

## 4. Tempo — `/pay` grows a stablecoin rail, and the gate learns 402 twice

**Why it fits.** Tempo is a payments chain (no native gas token, fees payable in any
USD TIP-20 token, dedicated payment lanes, 32-byte transfer memos, protocol-level
receive policies, fee sponsorship) co-designed with Stripe — and Air's commerce rails
are Stripe Connect + USDC. Air's `payment_requests` already has exactly two currencies
(`usd` → Stripe Checkout on the payee's connected account, `usdc` → the wallet
transfer approval). Tempo is one more `(currency, rail)` pair — `('ousd','tempo')` —
in that `check` for receives, and one more `PayRail` (`lib/pay/rails/tempo.ts`)
behind the existing wallet-transfer approval lane for sends. Not a new product.

**What we build** (W2a, then W2b in the same session).
- **Send:** `/pay 25 OUSD to 0x… on tempo memo INV-1` (deterministic parser
  `lib/pay/parse.ts`, the Pay form, or `POST /api/pay`) → `rail.previewSend` → one
  `wallet_transfers` row (`rail='tempo'`, 5-minute expiry) + one `run_approval`
  decision with a value-free payload → owner taps → the existing `executeTransfer`
  CAS → `tempoRail.submitSend` = `transferWithMemo(to, amount, memo)` with
  `feePayer: true`, fees **sponsored** so the user holds no gas token → `submitted`
  with `chainId:hash:logIndex`, `redirected` when no Transfer log reaches our
  recipient, `submit_unknown` on timeout (C23). The signer is a per-user sealed
  secp256k1 key in `user_chain_keys`, **testnet-only** by schema check and by
  `lib/chains/tempo/signer.ts` refusing to open on mainnet regardless of
  `TEMPO_LIVE_ENABLED`; mainnet waits for the access-key model. Tempo's public
  sponsor relay is Moderato-only; production needs an approved payer key (§10).
- **Receive:** `/pay request 25 OUSD on tempo` → the user's Tempo address + a
  32-byte memo (TIP-1022 virtual addresses exist and are not built), printed as text
  with a QR; `tick()` watches finalized `TransferWithMemo` events (token + to + memo +
  amount ≥ requested), flips the request to `paid` and texts the owner
  (`deliverPayEvent`). Protocol receive policies are documented, not configured.
- **Machine payments, seller half (W2b):** the mini-app gate chain already answers
  `402` with x402 `accepts`. We add the **MPP** method (`WWW-Authenticate: Payment …`,
  charge intent, Tempo method) as one header-keyed branch in `lib/payments/x402.ts`
  (`Authorization: Payment` → `lib/payments/mpp.ts`; `X-PAYMENT` → today's path),
  verified server-side before any body exists (MA5), receipted in `x402_receipts`
  (`protocol='mpp'`) *before* the session (MA9, spec.md §WF4). The recipient is the
  publisher's own `users.tempo_address`, owner-entered and checksum-validated; no
  fee-payer key on the gate; the method is omitted when the address is absent (MA6).
- **Machine payments, buyer half (W2b):** one per-charge `machine_payment` card. The
  Box files a 402 challenge (`POST /api/pay {action:'machine'}`), the control plane
  probes the URL through the kernel-purchase SSRF guard and writes
  `pending_approval`, the owner taps, `resolveMachinePayment` pays, re-fetches and
  hands the body to the Box. Every charge is a card and a receipt — the same "stage,
  never execute" shape (spec.md §WF1/§WF8). Standing budgets (`pay_policies`,
  `/pay policy …`, access-key `authorizeSync`) are **next, after access keys**:
  schema dormant, no auto-pay branch in a Box-callable route.

**Why both x402 and MPP.** They are the two live 402 dialects (Coinbase's and
Stripe/Tempo's). Air mini-apps as *sellers* should accept both; Air agents as *buyers*
should pay both. Tempo's docs frame MPP as the chain's "machine payments" category —
the one the track's resource groups call out explicitly.

**Rejected alternatives.** (a) Issuing an Air TIP-20 stablecoin (the "issuance" build
path): it is a one-command demo but it is not a product Air's users need, and
mint/pause/freeze authorities are production security decisions, not hackathon ones.
Documented in `docs/site/tempo.md` as "what you could do next". (b) A `feePayer`
sponsor account on the gate: a funded hot key an anonymous 402 client can drain.
(c) An Air-managed per-user payout address from the sealed signer (spec §15.8 option
b): custody of gate revenue — MA6 says the platform never custodies it.

---

## 5. Solana — payments first, launch second

**Why it fits.** Solana's track bundle is the broadest; its build paths most relevant
to Air are *Payments + Commerce* (payment channels, subscriptions/allowances, payment
indexing), *Agents + Tokenization* (x402 on Solana, PAY.SH, Coinbase agentic wallet
skills, Metaplex), *Privacy + Confidential Compute* (Token-2022 confidential balances,
Arcium), plus the track sponsors (Phantom, Squads/Altitude, Reflect, Meteora DBC).
Solana Pay is the Foundation's spec, not a listed track resource — we build it anyway,
because a Phantom scan that confirms itself is the most visible Solana-native beat.

**What we build (v1).**
- **W3a — Solana Pay receive, CDP-free.** The owner pastes their own Solana wallet
  address (`users.solana_address`, base58-validated, via `/pay solana address set
  <addr>` or the Pay card's owner settings). `/pay request 12 USDC on solana` → a
  hand-rolled `solana:` transfer-request URI (`lib/pay/solanaPay.ts`, `@solana/kit`
  5.5.1 only — no `@solana/pay`, whose peers are unsatisfiable against the lockfile)
  with `reference` + QR (we already ship server-side QR); `rails/solana.ts tick()`
  finds the signature by reference and confirms by USDC balance delta to the
  recipient (robust to Phantom's guard instruction), flips the request to `paid`,
  expires at 24 h. `/pay solana balance` reads the pasted address. Acceptance: a
  Phantom devnet payment flips the request within one cron tick.
- **W3b — sends and x402 (after W2b).** `/pay 5 USDC to <addr> on solana` runs
  through the same `run_approval → executeTransfer` lane. The send account is a
  Coinbase CDP server wallet (`users.solana_cdp_address`, created lazily on the first
  send; the CDP API key is already in the env for the x402 facilitator, the wallet
  secret `CDP_WALLET_SECRET` is not — provision it before the session or sends move
  later; SDK names to confirm against the installed `@coinbase/cdp-sdk`). Keys stay
  at CDP; the transaction is a **v0** `[ComputeBudget, CreateATA?, TransferChecked(USDC),
  Memo(request id)]` and `lib/chains/solana/wallet.ts` decompiles and asserts it
  (program allowlist, exactly one `TransferChecked` to the staged ATA/mint/amount,
  memo = request id) before `signTransaction` — `CDP_WALLET_SECRET` is a pooled
  operator credential like `THIRDWEB_SECRET_KEY` on Base, and that assertion is the
  per-user bound. **x402 on Solana for the mini-app gate**: a second **v1** `accepts`
  entry with the installed `x402@1.2.0` (`network:'solana-devnet'` on the wire,
  devnet USDC mint, receipt stores the registry CAIP-2; facilitator =
  `env.x402FacilitatorUrl()` for devnet, CDP for Base mainnet only); the human pay
  page keeps today's single Air-wallet CTA and lists Solana under "Other wallets"
  only when the publisher has pasted a `users.solana_address`. Publisher payout is
  the publisher's pasted `users.solana_address` — never an account Air's secret can
  sign for (MA6). The agent pays x402 on Solana as a per-charge `machine_payment`,
  receipted; standing budgets next, after access keys.

**Stretch: `/launch` (Meteora DBC).** A creator mini-app where the agent stages a
**Dynamic Bonding Curve** launch (config: quote mint, supply, curve, migration target
DAMM v2; pool: name, symbol, metadata URI) and the owner approves the *exact config*
before the pool exists. This is Meteora's path onto Air's Creator OS surfaces (shop,
storefront, ads). It is a stretch because token issuance is the one place where
"nothing moves without you" is necessary but not sufficient — the spec gates it behind
a new `entitlements.launch_enabled` column in its own migration (no self-serve path),
devnet-only regardless of `SOLANA_LIVE_ENABLED`, with `lib/launch/dbc.ts` as the single
adapter allowed to import `@solana/web3.js` v1. Scheduled as S1 only after W3b lands
and only if a session remains.

**Rejected / deferred.** Confidential balances (Token-2022): the right privacy story
for payroll-style payouts, but both accounts need the extension, the ZK proof flow is
multi-step, and the stock test validator lacks the proof program — documented, not
built. Arcium: a different compiler and threat model; documented as the path for a
private order-flow venue later. Swaps via an aggregator as a `solanaVenue`: viable
(same seam as Hyperliquid) but it is a general-DEX feature, not a track-native one,
and the window is short. `@solana/pay` as a dependency (peers on kit ^6.9): ~40 lines
by hand instead. `npx awal x402 pay` as the acceptance client: it settles USDC on Base
only — `scripts/x402-solana-pay.ts` with `@x402/fetch` + `@x402/svm` instead.

---

## 6. Zcash — a shielded wallet that lives on the user's own computer

**Why it fits.** Air gives every user a Box: their own Linux computer that already
runs the vault, the browser, and the agent. Zcash's maintained stack is Rust
(`librustzcash`, `zcash_client_backend`, Zingolib, Zebra, lightwalletd); there is no
production JS light client. So the natural Air shape is **the shielded wallet runs in
the Box**, the spending key never leaves it (C4: content in the Box; C18: secrets
never on a reduced-trust surface), and the control plane holds only what the approval
card needs — a Unified Address, an amount, a memo — plus a wrap secret, never a seed
or spending key.

**What we build.**
- `zcash` box skill + a baked **`air-zec`** binary (librustzcash `zcash_client_backend`
  / `zcash_client_sqlite`, mirroring the zcash-devtool walkthrough) in the template:
  `balance`, new **Unified Address**, **ZIP-321** payment request
  (`zcash:u1…?amount=…&memo=…`) rendered as a QR in the Wallet tab; `/zec …` is
  shorthand for `/pay … zcash`. The crate is built in a GitHub Actions `rust` job and
  installed as a sha256-pinned release asset by setup.sh / sync-box.sh (never
  `cargo build` on a Box); a `zcash`-user systemd timer keeps the wallet synced and
  writes the snapshot atomically.
- **Send = stage → approve → execute in the Box.** The agent files
  `POST /api/wallet/zcash {propose: to, amount, memo}` → `zcash_sends` row +
  `zcash_send` decision → owner taps Approve → `resolveZcashSend` mints a single-use
  nonce (2 minutes, bound to the send) → `zcashRail.submitSend` runs
  `sudo -u zcash air-zec exec --send <id> --nonce <n>`; `air-zec exec` (the same
  binary's exec subcommand, not the agent) claims the nonce at
  `POST /api/wallet/zcash/exec-claim`, receives the per-user **wrap secret** in that
  HTTPS response, unwraps the `age` identity, builds, proves and broadcasts the
  shielded transaction, zeroizes, and reports the txid. This is the PCZT idea
  (propose/prove/sign/send split) applied to Air's trust boundary.
- **The boundary, stated honestly.** It is a 2-of-2: the identity at
  `/home/user/.air-zec/identity` is wrapped with a per-user secret the control plane
  holds sealed (`user_chain_keys` rail=`zcash`, kind=`wrap_secret`) and never writes to
  the Box at rest; a nonce exists only after an owner tap; the control plane never
  holds a seed or spending key. The Box account that runs the agent also runs every
  control-plane command and has root, so the `zcash` Unix user is defense in depth,
  not the boundary — a root-capable compromised agent can stage (the owner sees a
  card) and could reach the key only during an owner-approved send. No seed export
  through the control plane in v1 (C18); mainnet waits for a Box-resident backup path.
- Testnet by default (`--server https://testnet.zec.rocks:443`); mainnet behind
  `ZCASH_LIVE_ENABLED` with ZEC-denominated caps (`ZCASH_PER_SEND_CAP_ZEC`,
  `ZCASH_DAILY_CAP_ZEC`), the same flag discipline as `TRADE_LIVE_ENABLED`. Nothing
  agent-writable feeds money logic: a request flips `paid` only from `air-zec list-tx`
  run by the control plane, and caps never price from a Box-cached rate.
- Tonight's half is **W5a**: the control-plane side (`lib/chains/zcash/*`,
  `lib/pay/rails/zcash.ts`, `/api/wallet/zcash` + `exec-claim`/`exec-result`) behind an
  injectable `ZecBinary` seam whose test fake replays recorded `air-zec` JSON. **W5b**
  is the crate, after the hackathon. Beats ordered by ZEC needed: init →
  `address --new` → ZIP-321 request → `exec` refusal without a claimable nonce
  (zero ZEC) → `propose` card and the real send (faucet testnet ZEC after sync).
  If `air-zec` is not baked by submission, every binary-backed `/zec` row moves
  under "What we document but do not ship yet" in `docs/site/zcash.md`.

**Rejected.** Running the wallet in the control plane (holds keys we do not want);
a browser/WASM wallet in the mini-app (C17 forbids client storage, and the
light-client sync does not belong in a 375 px card); `zcash-devtool` as the runtime
(explicitly "DO NOT commit significant funds"; it is the reference walkthrough, not the
binary); a Unix-user split or a sudoers rule presented as *the* boundary (the agent
account has root); `display-mnemonic` through the control plane (the seed would
transit a command result and a browser, C18).

---

## 7. Formation — the mini-app every track's bundle points at

**Why it fits.** "Company formation and banking" is in every track's resource groups.
The product is Stablecorp (mystablecorp.xyz): Delaware C-Corp or Wyoming LLC from
anywhere, no SSN, EIN, registered agent, US business bank account with a USDC
treasury, invoicing in USDC/EURC/USDT/fiat, 83(b), cap table. Founding-cohort
pricing: LLC from $999 one-time, C-Corp from $1,199 one-time (a ~Jan 2026 marketing
snapshot; verify at checkout), plus hackathon perks listed in the Colosseum corpus
(30% off incorporation, priority EIN, priority banking KYB, a free 30-minute setup
call) — there is no perk code; the Submit screen says "mention Crypto World's Fair at
checkout". There is **no public Stablecorp API** and the checkout path is unknown
(the agent navigates from the homepage) — the integration surface is a guided intake,
a handoff, and the money rails after.

Air is unusually good at exactly that: an agent that interviews you over iMessage,
keeps documents on your Box, puts deadlines on your calendar, drives a browser with a
checkout-handoff stop before any payment (`checkout_handoffs`: the human pays on the
merchant page), and then runs your money through approval-gated rails. The 83(b)
election is a 30-day hard deadline most founders miss; Air's calendar spine already
does reminders.

**What we build: `/formation` mini-app** (`mini.wzrd.tech/formation`, owner-only),
three screens:
1. **Packet** — the three entity-decision questions (residency, investors,
   tokens/treasury) inline until `packet.decision.entity` is set, then the checklist
   the agent fills over iMessage (company name + alternates, state, founders, equity
   split, addresses, registered-agent choice, mailing, EIN need, 83(b) intent) into
   `.hermes/miniapps/formation/packet.json` (C4; lease-written through
   `lib/formation/store.ts`, actions through `appendActionLogEntry`). Name
   availability is optional and owner-entered (a browser-use registry check is P2).
2. **Submit** — the `formation_submit` decision shows the exact packet + package +
   quoted price + disclosure (value-free `formation_requests` row in W4's own
   migration). Approval CAS-flips `ready → submitted` and starts a Box run that opens
   Stablecorp's checkout, pre-types the packet, and stops at the existing **checkout
   handoff** (`POST /api/checkout/handoff` + the Checkout card): the human clicks
   Pay; the agent never enters a card. `purchase_review` applies only if the owner
   separately asks for a vault card fill. No scraping, no credentials stored for them.
3. **Status** — Filed → EIN → Bank → Ready tiles the owner taps (the agent can update
   them when a provider email arrives — `lib/mail/client.ts`, allowlisted
   `@mystablecorp.*` senders; parsing is P2); **83(b) countdown** and
   annual-compliance dates as calendar events (`upsertLocalEvent`) with 21/7/2-day
   `agent_schedules` reminders; documents as Box files
   (`.hermes/miniapps/formation/documents/`), the EIN into the Vault; and one Money
   line — USDC invoicing through `/pay` on Base, Solana, or **Tempo with memo =
   invoice number**; Squads Altitude listed as the treasury option.

W4 runs last (§9): it has no chain risk, and a user forms a company once.

**Rejected.** Generating legal documents ourselves (bylaws, RSPAs) — Stablecorp's
package includes them and we should not pretend to be counsel; the mini-app links,
stores, and reminds. Five tabs (Decide / Intake / Handoff / Track / Money): the user
comes back for the Status line — the brokerage-ticket mistake `docs/trade/tape.md`
diagnosed.

---

## 8. The EVM tracks — Base, Arbitrum, Robinhood Chain, Ethereum L1 — documented, not built

Base: Air's wallet *is* on Base (chain 8453, USDC) and the x402 gate settles there
today; nothing new is required to be "on Base", and `docs/site/evm-chains.md` says
exactly what already works. Two Base facts shape the spec: OnchainKit and MiniKit
were archived in September 2026 (Base now recommends wagmi + viem and the Farcaster
mini-app SDK), and x402 moved to protocol v2 under the x402 Foundation
(`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` headers, CAIP-2 networks) — Air's gate
stays on the v1 wire it runs on mainnet today (`X-PAYMENT`, the installed
`x402@1.2.0`, which already ships SVM support); W2b adds MPP as a header-keyed branch
and W3b adds Solana as a v1 `accepts` entry, and a v2 branch is added only if devnet
rehearsal shows the hosted facilitator rejects v1 SVM payloads (spec §7.5). Arbitrum /
Robinhood Chain (an Arbitrum Orbit chain, 4663 mainnet / 46630 testnet, ETH gas,
Stock Tokens with the ERC-8056 scaled-UI extension) / Ethereum L1: all EVM, all
reachable by changing `WALLET_CHAIN_ID` and the USDC address — the spec's chain
registry (W0) makes that a config row. No entry-specific work beyond that.

---

## 9. Program and ordering

| # | Session (Devin SWE-2 Max) | Deliverable | Depends on | Demo value / hour |
|---|---|---|---|---|
| **W0** | Chain registry + rail widening (one serial session) | **All** of migration `0141` (four decision kinds, `formation` card kind, `users.solana_address/tempo_address/solana_cdp_address/solana_policy_id`, `user_chain_keys` with network/kind, `wallet_transfers` widening, `payment_requests` currency `('usd','usdc','ousd','zec')` + rail/direction/receive columns, `trade_orders.venue` + `trade_connections.active` backfilled, `x402_receipts` protocol/network, `machine_payments`, dormant `pay_policies`, `pay_caps`, RLS on every new table); `lib/chains/registry.ts`; `lib/pay/rails/index.ts` (`PayRail`, `baseRail`, `railFor`) + the `executeTransfer` prepare/submit split; `lib/pay/parse.ts` + `lib/pay/imessage.ts` dispatched at `flush.ts` and `chat/route.ts`; `lib/auth/origin.ts requireInteractiveRun`; `lib/trade/prices.ts` seam (Coinbase impl); env rows; `viem@2.57.4` direct dep; `/api/cron/pay-rails` | — | prerequisite |
| **W1a** | Hyperliquid venue on fixtures | `hyperliquid/{client,format,venue}.ts` on recorded fixtures, `venueFor`/`getTradeConnection`, `hyperliquidPublicPrices` in the prices seam, paper on `allMids` | W0 | **highest** — the loop already exists |
| **W1b** | Hyperliquid surface | Settings venue picker / connect form, tape candles, watch, the testnet $10 IOC gate | W1a | high |
| **W2a** | Tempo rail | `lib/chains/tempo/{client,signer}.ts`, `rails/tempo.ts` send + receive + `tick`, `POST /api/pay`, `deliverPayEvent`, pay.tsx "To pay" / "Getting paid" lists, owner-entered `tempo_address` | W0 | high |
| **W2b** | MPP + machine payments | MPP method as one header-keyed branch in `x402.ts`; one per-charge `machine_payment` (`pending_approval` only, SSRF-guarded fetch reusing `lib/kernel/purchases.ts`) | W2a, same session | high |
| **W3a** | Solana Pay receive | hand-rolled URI + balance-delta watcher against owner-pasted `users.solana_address`, kit 5.5.1, no `@solana/pay`, no CDP | W0 | high (one Phantom scan) |
| **W3b** | Solana sends + x402 | v1 `accepts` entry with `x402@1.2.0`, x402 buyer arm, CDP sends as v0 with the pre-sign assertion | W0 + W2b | medium |
| **W4** | Formation mini-app | three screens, `formation_requests` in its own migration, checkout-handoff stop, `store.ts`/`actionLog.ts` primitives, `upsertLocalEvent` deadlines | W0; **last** | high (no chain risk) |
| **W5a** | Zcash control-plane half | `lib/chains/zcash/*`, `rails/zcash.ts`, `/api/wallet/zcash` + `exec-claim`/`exec-result`, behind a `ZecBinary` seam on recorded `air-zec` JSON | W0 | medium |
| **W5b** | `air-zec` crate | GitHub Actions `rust` job, sha256-pinned asset installed by setup.sh / sync-box.sh, sync timer | W5a; after the hackathon | — (longest lead time: build + sync) |
| **W6** | Docs + skills | `docs/site/*.md` with a visible `Status:` line under every H1 and "not yet" sections, Box skills + `verify-box.sh` lines, per-track blurbs + shot list (spec §17) | W0 | required for every track submission |
| S1 | `/launch` (Meteora DBC) | devnet, `entitlements.launch_enabled` | W3b; only if a session remains | — |

**Submission-grade slice for tonight:** W0 → {W1a, W2a} in parallel (+ W3a, W5a if a
session is free) → W6 → W2b if W2a's acceptance passed by ~21:00 PDT. Anything not
merged green by the freeze stays where it stands with its page labelled `planned`.
If the prize pools turn out not to favour Solana/Zcash, the "if free" choice flips to
W4.

Rules every session shares: W0 owns all of `0141` (nobody edits it after it applies);
W4 (`formation_requests`) and W5 (`zcash_sends`) ship their own forward-only files
numbered at merge time. Each session lands its renderer/resolver arms (`resolve.ts`,
`hosted.ts`, the approve-client union) in the same PR as its decision kind. Commit
subjects start `R-WF-0<n>:` (W0 → `R-WF-00` … W6 → `R-WF-06`). `spec.md §12` gives the
per-session acceptance (colocated Vitest fixtures, no network); `spec.md §4.4` the repo
conventions that keep a first CI run green. Owner pre-seed steps — HL testnet API
wallet + drip, Tempo faucet for two accounts, Phantom on devnet + the pasted Solana
address, testnet ZEC, a Stablecorp checkout walk — start **now**; they have lead time no
session can absorb. `spec.md §17` lists them in order, with the shot list and the
per-track blurbs.

---

## 10. Open decisions for the owner (mirrors `spec.md §15`)

1. **Hyperliquid perps** — spot-only (recommended for v1) vs. an owner-opt-in perps
   ticket with isolated margin and a per-position cap as a `trade_settings` decision.
   Not in any session until decided.
2. **HL connection shape** — *closed for the submission*: paste-the-API-key (v1,
   matches Coinbase BYOK). Post-submission: an Air-generated agent keypair +
   wallet-signed `approveAgent` (needs a wallet-connect surface).
3. **Builder code** — ON for testnet: `HL_BUILDER_ADDRESS` = an Air-controlled testnet
   address, and approving Air's builder fee from the demo master is a pre-seed step
   so the fill shows `builderFee`. Hyperliquid may require the builder address to hold
   a minimum account value before `approveBuilderFee` succeeds — the figure is not in
   our notes; confirm on the HL docs.
4. **Tempo signer custody** — v1 sealed per-user key on testnet is acceptable for the
   submission; **mainnet waits for the access-key model (v1.1)**. Confirm.
5. **Solana wallet provider** — CDP server wallet (recommended: the API key is already
   in env, Solana-native, faucet on devnet) vs. thirdweb (one provider for Base and
   Solana, but its Solana send path is not what `lib/thirdweb/client.ts` exercises
   today). W3a needs neither (owner-pasted address); W3b sends ship only if
   `CDP_WALLET_SECRET` is provisioned before the session.
6. **Formation handoff** — Stablecorp only (recommended; it is what every track's
   bundle links) or a provider picker (Stablecorp, Squads Altitude for treasury, a
   generic "I already have a company" path).
7. **Zcash mainnet** — testnet-only for the submission (recommended), or enable
   mainnet behind `ZCASH_LIVE_ENABLED` with ZEC-denominated caps — only once a
   Box-resident seed backup path exists.
8. **MPP recipient** — *closed*: the publisher's own `users.tempo_address`,
   owner-entered (option a). An Air-managed per-user address was rejected under MA6.
9. **Fee sponsorship on mainnet** — the public sponsor relay is Moderato-only; mainnet
   needs `TEMPO_SPONSOR_URL=https://api.tempo.xyz/rpc/sponsor?key=tempo:sk:…` under an
   approved key. Ship sponsored sends + MPP on Moderato for the submission.

Also in `spec.md §15`, not a decision for tonight: **standing budgets** return with
the v1.1 access-key signer — minted from the first `machine_payment` card, evaluated
by `evaluateDelegatedApproval`, executed only by `resolveMachinePayment` with
`resolved_by='policy'`, hard ceilings, entitlement-gated off.

Open *questions* the review could not settle offline (prize pools and deadline;
`@coinbase/cdp-sdk` Solana method names; whether the hosted facilitator accepts v1 SVM
payloads; the HL testnet USDC pair and builder minimum; a Tempo wallet that parses the
memo URI; a Zcash testnet faucet; Stablecorp's checkout path) are listed in
`recommendations.md` — resolve each at rehearsal, never by hardcoding.
