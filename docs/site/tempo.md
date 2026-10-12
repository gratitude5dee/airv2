---
title: Tempo — stablecoin payments and machine payments with your agent
description: Air on Tempo: TIP-20 transfers with invoice memos, fees sponsored so you hold no gas token, a receive watcher that confirms delivery, and HTTP 402 machine payments (MPP) your mini-apps can charge and your agent can pay.
slug: /docs/tempo
---

# Tempo

Tempo is a payments blockchain: there is no native gas token, fees are paid in any
USD stablecoin, payment transfers get their own blockspace, every transfer can carry a
32-byte memo, and blocks finalize deterministically in under a second. Air uses Tempo
as a **pay rail** (send and receive stablecoins, with the invoice number in the memo)
and as a **machine-payments rail** (your mini-apps can charge per request with the
Machine Payments Protocol, and your agent can pay other services the same way).

Nothing changes about the Air contract: your agent *stages* a payment, you *approve*
it, the control plane *executes* it once, and an unconfirmed submit is never retried.

## What you can do

| You say | What happens |
|---|---|
| `/pay 25 USD to 0x… on tempo memo INV-0007` | Preview card: token (OUSD), amount, recipient, memo, estimated fee ($0.0006 or less), who pays the fee. Tap **Approve** → one `transferWithMemo` from your Tempo wallet. Receipt line with the explorer link. |
| `/pay request 25 USD on tempo memo INV-0007` | A request card with your Tempo address + the memo. When a matching transfer finalizes, the request flips to **paid** and you get a text. |
| `/pay tempo balance` | OUSD / pathUSD balances from your Tempo wallet, no card needed. |
| Open a priced mini-app with an MPP client | Your mini-app answers `402` with both an x402 and an **MPP** challenge; a paid request is verified and receipted before the page renders. |
| "Buy one image from that MPP service" | The agent previews the price (`--dry-run` semantics), you approve, the control plane pays the 402 under your caps, and the charge is receipted. |

Everything runs on **Moderato testnet** first. Mainnet is a flag the operator flips
after the live gate (same discipline as Trade's `TRADE_LIVE_ENABLED`).

## How it works under the hood

### Wallet

Each Air user already has a server-managed wallet (thirdweb, Base). For Tempo the
same wallet model applies: one address per user, keys never in the Box or the browser,
signing only inside the approval resolver. The client is `viem/tempo`:

```ts
import { Account, createClient, http, withRelay } from "viem/tempo";
const client = createClient({
  account,                       // server-side signer for this user
  testnet: true,                 // Moderato (42431); omit for mainnet (4217)
  feeToken: OUSD,                // 0x20c0000000000000000000006a37da5c996874be
  transport: withRelay(http(), http("https://sponsor.moderato.tempo.xyz")),
});
```

### Send with a memo, fees sponsored

```ts
import { toHex, parseUnits } from "viem";
const { receipt } = await client.token.transferSync({
  token: OUSD,
  to: recipient,
  amount: parseUnits("25", 6),            // TIP-20 is always 6 decimals
  memo: toHex("INV-0007", { size: 32 }),  // ≤ 32 bytes, public
  feePayer: true,                         // public sponsor on testnet; approved payer on mainnet
  nonceKey: "expiring",                   // no nonce tracking; ≤ 5-minute validity
});
```

The approval card is a signed snapshot of exactly these fields. If the submit times
out, Air looks up the transaction hash before it ever considers a retry, and in
practice marks the request `uncertain` and tells you.

### Receive and confirm

A successful transaction is not proof of delivery on Tempo: the recipient's **receive
policy** can redirect funds to the `ReceivePolicyGuard`. Air therefore confirms a
request only from the finalized `Transfer` log that matches token, recipient, and
amount, and dedupes on `chainId:txHash:logIndex`:

```ts
client.token.watchTransfer({
  token: OUSD,
  args: { to: myAddress },
  onTransfer: (t, log) => markPaidIfMatches(t, log.transactionHash, log.logIndex),
});
```

Memos are matched through the indexed `TransferWithMemo` event. The memo is the
request id or your invoice number; it is public, so Air never puts names in it.

### Machine payments (MPP) on your mini-apps

Air mini-apps already answer `402 Payment Required` with an x402 `accepts` payload.
On Tempo they also send a `WWW-Authenticate: Payment …` challenge (charge intent,
OUSD, recipient = **your** verified Tempo address — Air never custodies gate revenue).
A client retries with `Authorization: Payment <credential>`; Air verifies and settles
it, writes a receipt, and only then mints the paid session.

```ts
import { Mppx, tempo } from "mppx/server";
const mppx = Mppx.create({
  methods: [tempo({ currency: OUSD, recipient: publisherAddress, testnet: true })],
});
const result = await mppx.charge({ amount: "0.10" })(request);
if (result.status === 402) return result.challenge;   // before any body exists
return result.withReceipt(renderApp());
```

### Your agent paying a 402

The Box never holds a Tempo key. When the agent meets a 402, it previews the
challenge (`npx mppx --inspect <url>` semantics) and files a `machine_payment`
decision with the exact amount, token, recipient, and realm. After your approval the
control plane creates the credential and completes the request; every charge is
capped and receipted. Standing budgets ("up to $5/day for image generation") are
themselves an approval, and are implemented as Tempo **access keys** with per-token
limits and expiry — a key that cannot withdraw, cannot create contracts, and can be
revoked permanently.

## Networks and addresses

| | Mainnet | Moderato testnet |
|---|---|---|
| Chain ID | 4217 | 42431 |
| RPC | `https://rpc.tempo.xyz` | `https://rpc.moderato.tempo.xyz` |
| WebSocket | `wss://rpc.tempo.xyz` | `wss://rpc.moderato.tempo.xyz` |
| Explorer | `https://explore.tempo.xyz` | `https://explore.testnet.tempo.xyz` |
| Fee sponsor | approved payer via `https://api.tempo.xyz/rpc/sponsor?key=…` | `https://sponsor.moderato.tempo.xyz` (no key) |
| Faucet | — | `tempo_fundAddress` JSON-RPC, or `client.faucet.fundSync({ account })` |

| Token | Address | Note |
|---|---|---|
| OUSD | `0x20c0000000000000000000006a37da5c996874be` | Recommended stablecoin, both networks |
| pathUSD | `0x20c0000000000000000000000000000000000000` | Root quote token, fallback fee token |
| AlphaUSD | `0x20c0000000000000000000000000000000000001` | Testnet example token |
| USDC.e | `0x20c000000000000000000000b9537d11c60e8b50` | Mainnet, bridged |

All TIP-20 tokens have 6 decimals. Fee Manager `0xfeec…0000`, Stablecoin DEX
`0xdec0…0000`, TIP-403 registry `0x403c…0000`, ReceivePolicyGuard `0xB10C…0000`.

## Things to know

- **No native balance.** `eth_getBalance` returns a sentinel; Air shows only TIP-20
  balances and the currency symbol `USD`.
- **New-address transfers cost more gas** (~300k). Air estimates per transfer and
  shows the estimate on the card.
- **Finality is deterministic.** Once a block is `finalized` there are no
  confirmations to wait for.
- **Memos are 32 bytes**, not 32 characters.
- **Issuing your own TIP-20 stablecoin** is one SDK call on testnet
  (`client.token.createSync`) — but mint, pause, freeze, and supply-cap roles are
  production security decisions, so Air documents it and does not expose it.
- The public fee sponsor is **testnet-only**. Production sponsorship needs an approved
  payer (Tempo Console API key) or a self-hosted relay with its own policy.

## Resources

- Connection details: https://tempo.xyz/developers/docs/quickstart/connection-details
- Getting funds: https://tempo.xyz/developers/docs/guide/getting-funds
- TypeScript SDK: https://tempo.xyz/developers/docs/sdk/typescript
- EVM compatibility: https://tempo.xyz/developers/docs/quickstart/evm-compatibility
- Send a payment: https://tempo.xyz/developers/docs/guide/payments/send-a-payment
- Accept a payment: https://tempo.xyz/developers/docs/guide/payments/accept-a-payment
- TIP-20 overview: https://tempo.xyz/developers/docs/protocol/tip20/overview
- Issuance: https://tempo.xyz/developers/docs/guide/issuance
- Tempo API: https://tempo.xyz/developers/docs/api
- Machine payments (MPP): https://tempo.xyz/developers/docs/guide/machine-payments
- Accounts SDK: https://accounts.tempo.xyz/docs
- Agent tooling: `claude mcp add --transport http tempo https://mcp.tempo.xyz`, `npx skills add tempoxyz/plugins --skill docs`
