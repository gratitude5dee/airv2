---
title: Hyperliquid — spot trading on HyperCore with your agent
description: Air on Hyperliquid: `/trade` gets a HyperCore spot venue behind the same preview → approve → fill contract, connected through an API wallet you approve once, with builder-code fees, live candles, and testnet-first setup.
slug: /docs/hyperliquid
---

# Hyperliquid

Hyperliquid is an L1 with an on-chain order book (HyperCore) and an EVM (HyperEVM)
that share one state. Air plugs HyperCore **spot** markets into `/trade`, the
approval-gated trading mini-app that already runs Coinbase and paper mode. The
contract does not change: your agent previews, you approve the exact order, the
control plane submits it once.

## What you can do

| You say | What happens |
|---|---|
| `/trade connect hyperliquid` | Settings → Connect: you paste the address of an **API wallet** you approved from your Hyperliquid account (testnet first). Air stores the agent key sealed, server-side. Your master key never leaves your wallet. |
| `/trade buy $50 of HYPE` | Preview: `HYPE/USDC`, est. fill, size truncated to the market's `szDecimals`, price formatted to 5 significant figures, fee, builder fee, expiry countdown. Tap **Approve** → one IOC limit at the preview price with a client order id derived from the preview. |
| `/trade sell half my PURR` | Sized against the just-read **available** balance (`total − hold`), never a predicted one. |
| `/trade orders` · `/trade cancel last` | Open orders from `frontendOpenOrders`; a cancel is its own approval. |
| `/trade watch HYPE > 30` | Price alert from `allMids`; it tells you, it never trades. |
| The Tape | The one-screen surface with a close-line chart from `candleSnapshot`, your position, and UP / DOWN which stage a preview. |

Paper mode works with no connection at all, at live Hyperliquid prices.

## What Air deliberately does not do here

- **No perpetuals, margin, or leverage.** `/trade` is spot-only by allowlist
  (`docs/trade/plan.md` T4). A perps ticket is an open product decision, not a hidden
  flag.
- **No withdrawals, no transfers.** The agent key Air holds is an API wallet: it can
  place and cancel orders and nothing else. Moving funds in or out is a user-signed
  action from your master wallet, which Air never has.
- **No autonomous orders.** Watch alerts, schedules, and chained requests never submit
  anything; one approval is one order, and the next leg is sized from a fresh balance
  read.

## How it works under the hood

### Connecting: API wallets

Hyperliquid separates the **master wallet** (owns funds, signs EIP-712 "user-signed"
actions like transfers and withdrawals) from **agent / API wallets** (approved once by
the master, can sign order and cancel actions, cannot withdraw or transfer). That is
exactly the blast radius Air wants for a key the control plane keeps on your behalf.

```ts
import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const transport = new HttpTransport({ isTestnet: true });
const agentKey = generatePrivateKey();                // sealed in Air's control plane
const agent = privateKeyToAccount(agentKey);
// Signed by YOU (master key), in your own wallet — Air never sees it:
await master.approveAgent({ agentAddress: agent.address, agentName: "air valid_until " + (Date.now() + 90 * 864e5) });
```

Air then trades with `new ExchangeClient({ transport, wallet: agent })` and always
queries state for **your** address, not the agent's. Agent keys expire (90 days by
default; "name valid_until <ms>" sets up to 180). Rotating means approving a new one
in Settings.

### Reads

```ts
const info = new InfoClient({ transport });
const [spotMeta, ctxs] = await info.spotMetaAndAssetCtxs();     // tokens, markets, mark/mid prices
const bal = await info.spotClearinghouseState({ user });         // balances[].total / hold
const mids = await info.allMids();                               // mids["@107"] == HYPE/USDC mid
const candles = await info.candleSnapshot({ coin: "@107", interval: "1h", startTime });
```

Spot markets are addressed by **name** (`@107` on mainnet is `HYPE/USDC`; indices
differ on testnet) for reads and by **asset id** `10000 + index` for orders. Air
resolves both from `spotMeta` on every preview, never from a cached label.

### Orders

Hyperliquid has no market order type; a "market" buy is an IOC limit at an aggressive
price. The preview is the only thing you approve:

```ts
const a = conv.getAssetId("HYPE/USDC");                // 10000 + index
const szDec = conv.getSzDecimals("HYPE/USDC");         // base token's szDecimals
await exchange.order({
  orders: [{
    a, b: true,
    p: formatPrice(previewPrice, szDec, "spot"),       // ≤5 sig figs, ≤ 8 − szDecimals decimals
    s: formatSize(size, szDec),                        // truncated, never "0"
    r: false,
    t: { limit: { tif: "Ioc" } },
    c: clientOrderIdFromPreview,                       // 16-byte cloid derived from the signed preview
  }],
  grouping: "na",
  builder: { b: AIR_BUILDER, f: 10 },                  // tenths of a basis point; max 1000 on spot
});
```

Rules Air enforces before and after you tap: price and size formatting (a wrongly
formatted number changes the signed hash and the exchange rejects it), one nonce per
action, inspect **every** `statuses[i]` because a batch `ok` can still carry
`{ error }`, and if the request times out, reconcile by `orderStatus(cloid)` before
anything is considered — never resubmit.

### Builder code

Air registers a builder address. You approve a maximum builder fee once
(`approveBuilderFee({ maxFeeRate: "0.01%", builder })`, a user-signed action from your
wallet); every order Air stages carries `builder.f` at or below that. The fee is shown
on the preview card and appears on fills as `builderFee`.

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

- Two signing schemes: L1 actions (msgpack + keccak, EIP-712 domain `Exchange`,
  chain id 1337) for orders; direct EIP-712 (`HyperliquidSignTransaction`) for
  transfers and approvals. `@nktkas/hyperliquid` handles both.
- Nonces are millisecond timestamps, unique per signer, within a 100-nonce window.
- Rate limits are weighted per IP and scale with your traded volume per address;
  Air reads `userRateLimit` and keeps a margin.
- Minimum order notional on the exchange is small (about $10); Air's per-order and
  daily caps sit above that and are yours to set.

## Resources

- API docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
- TypeScript SDK: https://github.com/nktkas/hyperliquid
- Rust SDK + skills: https://github.com/infinitefield/hypersdk (`npx skills add infinitefield/hypersdk`)
- HyperEVM: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm
- Interacting with HyperCore from HyperEVM: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore
- HyperCore ↔ HyperEVM transfers: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/hypercore-less-than-greater-than-hyperevm-transfers
