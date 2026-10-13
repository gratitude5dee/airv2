---
title: Hyperliquid — spot trading on HyperCore with your agent
description: Air on Hyperliquid: `/trade` gets a HyperCore spot venue behind the same preview → approve → fill contract, connected through an API-wallet key you paste once (testnet first), with builder-code fees, live candles, and paper mode on Hyperliquid prices.
slug: /docs/hyperliquid
---

# Hyperliquid

**Status: planned.** Becomes **testnet** when the Hyperliquid venue (W1a) merges; the
Settings connect form, tape candles and watch (W1b) follow and are listed under
'What we document but do not ship yet' until then. Until W1a merges this page is the
design, not a shipped feature. Mainnet stays behind an operator flag and a per-user
allowlist (spec.md §W2).

Hyperliquid is an L1 with an on-chain order book (HyperCore) and an EVM (HyperEVM)
that share one state. Air plugs HyperCore **spot** markets into `/trade`, the
approval-gated trading mini-app that already runs Coinbase and paper mode. The
contract does not change: your agent previews, you approve the exact order, the
control plane submits it once.

## What you can do

| You say | What happens |
|---|---|
| `/trade connect hyperliquid` (W1b) | Settings → Connect: you enter your **master address** and paste the **private key of an API wallet** you generated and approved from your own Hyperliquid account on the testnet API page (`app.hyperliquid-testnet.xyz/API`; testnet first). Air seals the key server-side, verifies it on save (`userRole` must answer `agent` for your master; `extraAgents` must list the agent address; when it reports a `validUntil`, it must be in the future and Air stores it as the chip's expiry) and shows only the last 4 of the agent address: `● hyperliquid · testnet · agent …a1b2 · expires 2026-12-30`. Your master key never leaves your wallet, and Air never asks your wallet to sign anything — there is no in-wallet `approveAgent` flow. |
| `/trade buy $50 of HYPE` (agent) | Preview on the connected network: the pair resolved from `spotMeta` (`HYPE-USDC` if that network lists it), est. fill, size truncated to the market's `szDecimals`, price formatted to 5 significant figures, taker fee, builder fee as its own line, expiry countdown. Tap **Approve** → one IOC limit at the preview price (mid plus a slippage band, default 1%) with a 16-byte client order id (cloid) derived from the preview. Receipt: `✓ Placed at the venue · cloid 0x…` with a link to your master address on the HyperCore explorer — `order` returns no transaction hash, so there is none to show. |
| `/trade sell half my PURR` (agent) | Sized against the just-read **available** balance (`total − hold`) of your master address, never a predicted one. |
| `/trade portfolio` | Balances from `spotClearinghouseState` for your master address; USDC counts as cash. |
| `/trade orders` · `/trade cancel last` | Open orders from `frontendOpenOrders`; a cancel is its own approval and goes by cloid (`cancelByCloid`). |
| `/trade watch HYPE > 30` (W1b) | Price alert from `allMids`, the market name resolved through `spotMeta`; it tells you, it never trades. |
| The Tape (W1b) | The one-screen surface: 1-minute candles from `candleSnapshot` over the tape window (fetched on each poll, no cache), your position, and UP / DOWN which stage a preview. |

`buy` / `sell` lines are agent turns (sizing and product resolution happen through
`/api/trade`, never regex); `connect`, `portfolio`, `orders`, `cancel`, and `watch`
are deterministic.

Paper mode works with no connection at all, at live Hyperliquid prices (mainnet
`allMids`, whichever network you would connect to); fills are chipped
`paper · HL prices`.

## What Air deliberately does not do here

- **No perpetuals, margin, or leverage.** `/trade` is spot-only by allowlist
  (`docs/trade/plan.md` T4). A perps ticket is an open product decision, not a hidden
  flag.
- **No withdrawals, no transfers.** The key Air holds is an API wallet: it cannot
  withdraw or send to other addresses, and Air's own signing code can only produce
  spot order and cancel actions — the client exposes exactly `order` and
  `cancelByCloid` plus `/info` reads, asserts `10000 ≤ assetId < 100000` against the
  `spotMeta.universe` index it just resolved, sets `expiresAfter`, and a test fails if
  any other exchange method appears. Moving funds in or out is a user-signed action
  from your master wallet, which Air never has.
- **No autonomous orders.** Watch alerts, schedules, and chained requests never submit
  anything; one approval is one order, and the next leg is sized from a fresh balance
  read.
- **No resubmits.** A submit whose outcome is unknown is terminal `uncertain` (C23).
  Air tells you to check Orders; reconciliation reads the venue by cloid and never
  places the order again.

## How it works under the hood

### Connecting: API wallets

Hyperliquid separates the **master wallet** (owns funds, signs EIP-712 "user-signed"
actions like transfers, withdrawals, and `approveAgent`) from **agent / API wallets**
(approved once by the master, can sign order and cancel actions, cannot withdraw or
transfer). That is exactly the blast radius Air wants for a key the control plane
keeps on your behalf.

v1 is paste-the-key: you generate the API wallet on Hyperliquid's API page, approve it
from your master there, and hand Air the private key plus your master address. Air
never sees the master key.

```ts
import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";

const transport = new HttpTransport({ isTestnet: true });
const agent = privateKeyToAccount(pastedApiWalletKey);           // sealed on arrival; hint = last 4 of agent.address
const info = new InfoClient({ transport });

// Verified on save — the form refuses unless userRole answers agent for your master and extraAgents lists the agent:
const role = await info.userRole({ user: agent.address });        // { role: "agent", data: { user: masterAddress } }
const agents = await info.extraAgents({ user: masterAddress });   // must list agent.address; a reported validUntil must be in the future (stored as the chip's expiry)

const exchange = new ExchangeClient({ transport, wallet: agent }); // orders and cancels only
```

Air then trades with that `ExchangeClient` and always queries state for **your master
address**, not the agent's. Agent keys expire (90 days by default; naming one
`"<name> valid_until <ms>"` sets up to 180). Air stores the `validUntil` it reads (when
`extraAgents` reports one) and shows it on the chip as the expiry; it does not rotate
keys for you. Rotate = re-enter the new key in Settings. Disconnect deletes Air's
sealed copy of the key; it cannot revoke the agent's approval on Hyperliquid — revoke
it yourself on the API page (`https://app.hyperliquid-testnet.xyz/API`, mainnet
`https://app.hyperliquid.xyz/API`).

Live orders on Hyperliquid — testnet included — need the operator's
`TRADE_LIVE_ENABLED` (and `TRADE_ALLOWLIST` when set); `network = mainnet` on connect
additionally needs `HL_LIVE_ENABLED`.

### Reads

```ts
import { SymbolConverter } from "@nktkas/hyperliquid/utils";

const [spotMeta, ctxs] = await info.spotMetaAndAssetCtxs();       // tokens, markets, mark/mid prices
const usdc = spotMeta.tokens.find((t) => t.name === "USDC");       // by name — never by index
const conv = await SymbolConverter.create({ transport });
const coin = conv.getSpotPairId("HYPE/USDC");                      // "@107" on mainnet today; another name, or unlisted, on testnet
const bal = await info.spotClearinghouseState({ user: master });   // balances[].total / hold — always the master
const mids = await info.allMids();                                  // mids[coin]
const candles = await info.candleSnapshot({ coin, interval: "1m", startTime });
```

Spot markets are addressed by **name** from `spotMeta.universe` (`@<index>` for most
pairs, `PURR/USDC` for a few) for reads and by **asset id** `10000 + index` for orders.
Indices differ per network — `@107` is HYPE/USDC on mainnet; the testnet list is
different and may not carry HYPE/USDC at all — so Air resolves the pair from `spotMeta`
on the network in use on every preview and refuses an unlisted one
(`No Hyperliquid spot market named HYPE-USDC.`). No pair, index, or token index is
hardcoded; USDC is found by its token name.

### Orders

Hyperliquid has no market order type; a "market" buy is an IOC limit at an aggressive
price. The preview is the only thing you approve, and the submitted order is built from
the stored preview — never re-priced:

```ts
import { formatPrice, formatSize } from "@nktkas/hyperliquid/utils";

const a = conv.getAssetId("HYPE/USDC");                // 10000 + index on this network; Air asserts 10000 ≤ a < 100000 and a − 10000 === the universe index it just resolved; only t.limit is ever built
const szDec = conv.getSzDecimals("HYPE/USDC");         // base token's szDecimals
await exchange.order({
  orders: [{
    a, b: true,
    p: formatPrice(previewPrice, szDec, "spot"),       // ≤5 sig figs, ≤ 8 − szDecimals decimals
    s: formatSize(size, szDec),                        // truncated, never "0"
    r: false,
    t: { limit: { tif: "Ioc" } },
    c: cloid,                                          // 16-byte client order id from the approved preview
  }],
  grouping: "na",
  builder: { b: AIR_BUILDER, f: 10 },                  // tenths of a basis point (10 = 1 bp; spot cap 1000); sent only once you approved it
});
```

Rules Air enforces before and after you tap: price and size formatting (a wrongly
formatted number changes the signed hash and the exchange rejects it); one nonce per
action; `expiresAfter` set to the card's expiry, so a request that arrives late is
refused by the exchange itself. A per-order `{ error }` inside an otherwise `ok` batch
makes the SDK throw, and the order is `rejected` with the exchange's own words. A
timeout is `uncertain` — terminal. Reconciliation reads `orderStatus` by cloid and
flips `submitted` rows to filled, cancelled, or rejected; `unknownOid` leaves the row
alone. Nothing is ever resubmitted.

### Builder code

Air registers a builder address. You approve a maximum builder fee once
(`approveBuilderFee({ maxFeeRate: "0.01%", builder })`, a user-signed action from your
master wallet); every order Air stages carries `builder.f` at or below that. The fee is
its own line on the preview card and appears on fills as `builderFee`. Until you
approve it, orders go without the field — Air never fails an order on a missing builder
approval. Hyperliquid may require the builder address itself to hold a minimum account
value before approvals succeed (README's ≥100 USDC is unsourced) — unverified; resolve
at the testnet rehearsal.

### Funding (documented, not automated)

Bridged USDC arrives in **spot**. `usdClassTransfer` moves between spot and perps
(not needed for spot trading). HyperEVM ↔ HyperCore transfers go through per-token
system addresses (`0x2000…0000 + tokenIndex`; HYPE uses `0x2222…2222`), with decimals
converted by `evmExtraWeiDecimals`. All of these are master-wallet actions; Air shows
you the exact steps and never performs them.

## Networks and limits

| | Mainnet | Testnet |
|---|---|---|
| REST | `https://api.hyperliquid.xyz` (`/info`, `/exchange`) | `https://api.hyperliquid-testnet.xyz` |
| WebSocket | `wss://api.hyperliquid.xyz/ws` | `wss://api.hyperliquid-testnet.xyz/ws` |
| HyperEVM RPC / chain id | `https://rpc.hyperliquid.xyz/evm` · 999 | `https://rpc.hyperliquid-testnet.xyz/evm` · 998 |
| Explorer | `https://app.hyperliquid.xyz/explorer` | `https://app.hyperliquid-testnet.xyz/explorer` |
| API wallet page | `https://app.hyperliquid.xyz/API` | `https://app.hyperliquid-testnet.xyz/API` |
| USDC | `spotMeta.tokens[].name === "USDC"` (tokenId `0xeb62eee3685fc4c43992febcd9e75443`) | resolved the same way; index differs |

- Two signing schemes: L1 actions (msgpack + keccak, EIP-712 domain `Exchange`,
  chain id 1337) for orders; direct EIP-712 (`HyperliquidSignTransaction`) for
  transfers and approvals. `@nktkas/hyperliquid` handles both; Air only ever signs the
  first kind.
- Nonces are millisecond timestamps, unique per signer, within a 100-nonce window.
- Rate limits are weighted per IP and scale with your traded volume per address
  (`userRateLimit` reports the budget). Air opens one client per resolver call and
  never retries a 429; after a submit, C23 applies.
- Minimum order notional on the exchange is small (about $10); Air's per-order and
  daily caps sit above that and are yours to set.

## What we document but do not ship yet

- **Settings venue picker + connect form, 1-minute tape candles, and `/trade watch`
  on Hyperliquid prices (W1b).** W1a lands the venue, the active-connection lookup,
  the price seam and paper mode on `allMids`; the connect UI, `candleSnapshot`
  candles and HL-priced watch alerts follow in W1b.
- **An Air-generated agent key approved from your wallet.** The alternative to
  paste-the-key: Air mints the key, you sign one `approveAgent` in your own wallet.
  It needs a wallet-connect surface on the mini-app origin, so it waits.

  ```ts
  import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
  const agent = privateKeyToAccount(generatePrivateKey());         // sealed in Air's control plane
  // Signed by YOU (master key), in your own wallet — Air never sees it:
  await master.approveAgent({ agentAddress: agent.address, agentName: "air valid_until " + (Date.now() + 90 * 864e5) });
  ```

- **Mainnet.** The code path is the same; `HL_LIVE_ENABLED` and the per-user allowlist
  are off until the testnet rehearsal and the live gate pass.
- **Stop and trigger orders.** `t.trigger` is refused with
  `Stop-limit orders aren't available on Hyperliquid here — use a limit order.`
- **WebSocket streams.** Air polls `/info` for prices, candles, balances, and order
  state; the `wss` endpoints above are listed for completeness.
- **HyperEVM.** Read precompiles and `CoreWriter` let contracts read and act on
  HyperCore; Air's venue talks to HyperCore directly and deploys nothing on the EVM.
- **Funding moves.** `usdClassTransfer`, `spotSend`, and the EVM bridge stay
  master-wallet actions you perform yourself (above).

## For judges

- **Native primitives:** HyperCore spot order book (`order`, IOC limit with a cloid;
  `cancelByCloid`), API wallets (agent key scoped to orders and cancels, verified with
  `userRole` and `extraAgents`), builder codes (`approveBuilderFee`, per-order
  `builder`), and the `/info` reads `spotMetaAndAssetCtxs`, `spotClearinghouseState`,
  `allMids`, `candleSnapshot`, `frontendOpenOrders`, `orderStatus` — through
  `@nktkas/hyperliquid`, with the `hyperliquid-trading`, `hyperliquid-payments`, and
  `hyperliquid-rust-sdk` skills from `infinitefield/hypersdk` pinned in
  `skills-lock.json`.
- **Network chip** on every card and receipt: `● hyperliquid · testnet` (paper:
  `paper · HL prices`).
- **The three commands:** `/trade connect hyperliquid`, `/trade buy $50 of HYPE`,
  `/trade orders` (then `/trade cancel last`).
- **Sponsor touched:** Hyperliquid — HyperCore spot order book, API wallets and
  builder codes; nothing deployed on HyperEVM.
- **What the video shows:** one approval card on testnet with the chip visible, ending
  on the receipt line with the cloid. `[video timestamp: TBD]`

## Resources

- API docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
- TypeScript SDK: https://github.com/nktkas/hyperliquid
- Rust SDK + skills: https://github.com/infinitefield/hypersdk (`npx skills add infinitefield/hypersdk`)
- HyperEVM: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm
- Interacting with HyperCore from HyperEVM: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore
- HyperCore ↔ HyperEVM transfers: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/hypercore-less-than-greater-than-hyperevm-transfers
