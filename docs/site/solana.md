---
title: Solana — payments, Solana Pay, and x402 with your agent
description: Air on Solana: a Solana wallet your agent can fund and spend from under your caps, Solana Pay requests that confirm themselves, x402 on Solana for your mini-apps, and the tokenization and privacy paths we document for later.
slug: /docs/solana
---

# Solana

On Solana, Air is a **payments agent** first. Your agent can request money with a
Solana Pay QR that confirms itself, send USDC after you approve an exact preview, and
pay x402-priced services under a budget you set. Your mini-apps can charge in USDC on
Solana as well as on Base. The contract is the same everywhere in Air: the agent
stages, you approve, the control plane executes once, and an unconfirmed submit is
never retried.

## What you can do

| You say | What happens |
|---|---|
| `/pay request 12 USDC on solana` | A Solana Pay transfer request (`solana:<you>?amount=12&spl-token=USDC&reference=…`) as a QR and a link. When the transfer with that reference confirms, the request flips to **paid** and you get a text. |
| `/pay 12 USDC to <address> on solana` | Preview: recipient, amount, whether the recipient needs a USDC account created (and the rent that costs), fee. Tap **Approve** → one transfer, signed by your server wallet, confirmed on chain. |
| `/wallet solana` | SOL and USDC balances and recent activity, no card. On mainnet, a Coinbase Onramp link to fund the address. |
| "Pay for that x402 API" | The agent previews the 402 challenge (amount, asset, who gets paid), files an approval or pays under a standing budget you approved earlier. Every charge is receipted. |
| Open a priced Air mini-app with a Solana x402 client | The 402 response lists a Solana `accepts` entry next to the Base one; settlement is verified before the page renders. |

Everything runs on **devnet** by default. Mainnet is a flag the operator flips after
the live gate.

## How it works under the hood

### Wallet

Each user gets a Solana account from Coinbase Developer Platform **server wallets**.
The key lives with CDP, never in Air, never in your Box. Air builds transactions with
`@solana/kit` (transaction v1), hands the message to CDP to sign inside the approval
resolver, and submits it.

### Solana Pay request

```ts
import { encodeURL, findReference, validateTransfer } from "@solana/pay";
const reference = (await generateKeyPairSigner()).address;        // unique per request
const url = encodeURL({ recipient, amount: 12, splToken: USDC_MINT, reference,
                        label: "Air", message: "Request INV-7", memo: requestId });
// later, on a cron tick:
const { signature } = await findReference(rpc, reference, { finality: "confirmed" });
await validateTransfer(rpc, signature, { recipient, amount: 12, splToken: USDC_MINT, reference });
```

The recipient is your wallet address (never a token account); the wallet derives the
USDC account. The reference is a fresh public key that wallets attach as a read-only
account so the transfer can be found.

### Send

The preview is a signed snapshot of recipient, amount, and token. On approval Air
rebuilds exactly that transaction: compute-unit limit and price, create the
recipient's USDC account if missing, `TransferChecked` for 6-decimal USDC, and a memo
carrying the request id. If the network does not answer after the send, Air looks the
signature up once and otherwise marks the request **uncertain** and tells you.

### x402 on Solana

Air mini-apps already answer `402 Payment Required` with an x402 payload for USDC on
Base. With Solana enabled the same response carries a second `accepts` entry:

```json
{ "scheme": "exact", "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "amount": "10000", "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "payTo": "<your Solana address>", "maxTimeoutSeconds": 60 }
```

The client builds a partially signed transfer, the facilitator pays the fee and
settles, Air writes the receipt, and only then mints the paid session. Revenue goes
straight to your address; Air never custodies it.

As a buyer, the agent uses the same protocol in reverse: it inspects the challenge
without paying, you approve (or a budget you approved covers it), and the resolver
pays with your server wallet.

## Networks and addresses

| | Mainnet | Devnet |
|---|---|---|
| CAIP-2 | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| RPC | your provider (Helius, Triton, QuickNode, FluxRPC) | `https://api.devnet.solana.com` |
| USDC mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| x402 facilitator | CDP facilitator (`https://api.cdp.coinbase.com/platform/v2/x402`) | `https://x402.org/facilitator` |

## What we document but do not ship yet

- **Launch a creator token with Meteora's Dynamic Bonding Curve.** The agent would
  stage a pool config (quote USDC, migration to DAMM v2, fee schedule, creator fee
  share, locked vesting) and you would approve every field before the pool exists.
  Program `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` on mainnet and devnet; SDK
  `@meteora-ag/dynamic-bonding-curve-sdk`. Token issuance needs more than "nothing
  moves without you", so it stays behind an entitlement on devnet until reviewed.
- **Confidential transfers (Token-2022).** Hides amounts, not parties. Both accounts
  need the extension, proofs are built client-side, and the mint extension must be set
  at creation. The right privacy story for payroll-style payouts; not in the first
  release.
- **Arcium.** Encrypted computation (MPC) for things like dark pools and sealed-bid
  auctions. A different compiler and threat model; documented as the path to a private
  order-flow venue later. `npx skills add arcium-hq/agent-skills`.
- **Wallets and treasury.** Phantom Connect for embedded sign-in, Squads v4 for
  multisig treasuries (fund the vault PDA, never the multisig PDA), Swig for
  role-scoped smart wallets. Air's own custody model does not need them for the
  payments rail.

## Resources

- Solana docs: https://solana.com/docs · quick start: https://solana.com/docs/intro/quick-start · installation: https://solana.com/docs/intro/installation
- Agent skills: https://solana.com/skills (`npx skills add solana-foundation/solana-dev-skill`) · MCP: `claude mcp add --transport http solana-mcp-server https://mcp.solana.com/mcp`
- create-solana-dapp: https://github.com/solana-foundation/create-solana-dapp
- PAY.SH (x402 and MPP buyer CLI with local authorization): https://github.com/solana-foundation/pay
- x402: https://docs.cdp.coinbase.com/x402/welcome · Solana guide: https://solana.com/docs/payments/agentic-payments/intro-to-x402
- Coinbase Onramp: https://docs.cdp.coinbase.com/onramp/introduction/welcome
- Meteora DBC: https://docs.meteora.ag/developer-guides/dbc
- Confidential transfers: https://solana.com/docs/tokens/extensions/confidential-transfer
- Arcium: https://docs.arcium.com/
