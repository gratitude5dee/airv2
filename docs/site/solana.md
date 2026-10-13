---
title: Solana — payments, Solana Pay, and x402 with your agent
description: Air on Solana: Solana Pay requests that confirm themselves into your own wallet, USDC sends from a server wallet and x402 on Solana next, and the tokenization and privacy paths we document for later.
slug: /docs/solana
---

# Solana

**Status:** planned — nothing on this page is live until the Solana Pay receive session
(spec.md §13, W3a) merges; it then reads *testnet* for the rows that landed. Sends from
a CDP server wallet and the x402 Solana entry are next.

On Solana, Air is a **payments agent** first. Your agent can request money with a
Solana Pay QR that confirms itself into your own wallet. Next: send USDC after you
approve an exact preview, pay x402-priced services one approved charge at a time, and
let your mini-apps charge in USDC on Solana as well as on Base. The contract is the
same everywhere in Air: the agent stages, you approve, the control plane executes once,
and an unconfirmed submit is never retried.

## What you can do

| You say | What happens |
|---|---|
| `/pay request 12 USDC on solana` | A Solana Pay transfer request to your own wallet (`solana:<your address>?amount=12&spl-token=<USDC mint>&reference=…`) as a QR and a link. Scan it with Phantom on devnet; when a confirmed transaction carrying that reference raises your USDC balance by at least 12, the request flips to **paid** on the next cron tick and you get a text. Unpaid requests expire after 24 h. |
| `/pay solana balance` | SOL and USDC balances and recent activity for your Solana address (and the send account once it exists), no card. |
| `/pay solana address` | Your receive address and its QR. Owner-only: paste it once in the Pay card's settings view (or tell your agent: `/pay solana address set <addr>` — handled by the agent, not the parser). Air validates the base58 form and never holds its key. |
| `/pay 12 USDC to <address> on solana` — next | Preview: recipient, amount, whether the recipient needs a USDC account created (and the rent that costs), fee. Tap **Approve** → one transfer, signed by a CDP server wallet Air creates for you on first use, confirmed on chain. |
| "Pay for that x402 API" — next | The agent previews the 402 challenge (amount, asset, who gets paid) without paying and files an approval card; nothing moves until you tap it, and every charge is receipted. Standing budgets are next, after access keys. |
| Open a priced Air mini-app with a Solana x402 client — next | The 402 response lists a Solana `accepts` entry next to the Base one; settlement is verified and receipted before the page renders. Lands after the MPP branch on the same gate. |

Everything runs on **devnet** by default. Mainnet is a flag the operator flips after
the live gate.

## How it works under the hood

### Wallet

Two addresses, two jobs:

- **Receive — your own wallet.** `users.solana_address` is an address you paste
  (owner-only; base58, 32–44 chars). It is the Solana Pay recipient and the x402
  `payTo` for your mini-apps. Air never holds a key that can sign for it, so requested
  payments and mini-app revenue land somewhere Air cannot spend from.
- **Send — a CDP server wallet (next).** On your first `/pay … on solana` send, Air asks
  Coinbase Developer Platform for an account named after your user id
  (`users.solana_cdp_address`; idempotent, one per user). The key lives with CDP, never
  in Air, never in your Box. Air builds the transaction with `@solana/kit` (the 5.5.1
  already in Air's tree), asserts it is exactly the approved transfer, hands the
  unsigned transaction to CDP to sign inside the approval resolver, and submits it.
  Air's one CDP credential can only request signatures; the pre-sign assertion is what
  bounds what it may request. Without that credential the rail is read-only — there is
  no raw-key fallback.

### Solana Pay request

Air builds the URI by hand (no `@solana/pay`; its Kit major does not match Air's tree)
and finds the payment by its reference key:

```ts
import { generateKeyPairSigner } from "@solana/kit";               // lib/pay/solanaPay.ts
const reference = (await generateKeyPairSigner()).address;        // fresh per request, stored on the row
const fields = { amount: "12", "spl-token": USDC_MINT, reference,  // amount ≤ 6 decimals
                 label: "Air", message: "Request INV-7", memo: requestId };
const url = `solana:${recipient}?` + Object.entries(fields)
  .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
const qr = await addressQrDataUrl(url);                            // lib/wallet/qr.ts encodes any string

// later, on each pay-rails cron tick (rails/solana.ts tick()):
const [sig] = await rpc.getSignaturesForAddress(reference, { limit: 1 }).send();
const tx = await rpc.getTransaction(sig.signature, { encoding: "jsonParsed",
  maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send();
// paid ⇔ tx.meta.err === null and (post − pre) token balance for
// { owner: recipient, mint: USDC_MINT } ≥ 12; tx_ref = signature (unique), expire 24 h
```

The recipient is your wallet address (never a token account); the wallet derives the
USDC account. The reference is a fresh public key that wallets attach as a read-only
account so the transfer can be found. Confirmation is a balance delta, not an
instruction match, so the guard instruction Phantom adds to what it signs does not
break it. The same signature can never pay two requests.

### Send (next)

The preview is staged as one transfer row (recipient, amount, token, fee) with a
5-minute expiry; approving it runs the lane every Air send uses: one approval card,
claimed exactly once by the resolver, which re-reads that row before it claims it. The
rail rebuilds exactly that transaction as a **v0** message: compute-unit limit and
price (≤ 5 lamports per unit), create the recipient's USDC account if missing,
`TransferChecked` for 6-decimal USDC, and a memo carrying the request id. Before the
message goes to CDP, Air decompiles it and asserts: only the ComputeBudget,
AssociatedToken, Token and Memo programs; exactly one `TransferChecked` with the
registry USDC mint, the staged amount and the recipient's associated token account as
destination; memo = request id; and a compute-unit price at or under the cap. Any
mismatch refuses to sign. CDP signs the transaction (never a bare message); Air submits
with `sendAndConfirmTransactionFactory` at `confirmed` and reads it back with
`maxSupportedTransactionVersion: 0`. If the network does not answer after the send, Air
looks the signature up once and otherwise marks the transfer **uncertain** and tells
you — it is never retried.

### x402 on Solana (next, after the MPP branch)

Air mini-apps already answer `402 Payment Required` with an x402 payload for USDC on
Base. With Solana enabled the same response — still the x402 v1 wire your clients
speak today (`X-PAYMENT`) — carries a second `accepts` entry:

```json
{ "scheme": "exact", "network": "solana-devnet", "maxAmountRequired": "10000",
  "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "payTo": "<your Solana address>", "maxTimeoutSeconds": 60,
  "extra": { "feePayer": "<facilitator fee payer>" } }
```

The client builds a partially signed transfer, the facilitator pays the fee and
settles, Air writes the receipt (keyed on the transaction signature, so a replay is a
402, never a session), and only then mints the paid session. The receipt records the
chain as `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` whatever string was on the wire.
Revenue goes straight to your address; Air never custodies it. The entry is omitted
until you have pasted a Solana address; the Base entry never depends on it.

As a buyer, the agent uses the same protocol in reverse: it inspects the challenge
without paying, files a card, you approve, and the resolver pays from the CDP send
account. Standing budgets ("up to $5/day for this API") are next, after access keys.

## Networks and addresses

| | Mainnet | Devnet |
|---|---|---|
| CAIP-2 | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| RPC | your provider (Helius, Triton, QuickNode, FluxRPC) | `https://api.devnet.solana.com` |
| USDC mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| x402 facilitator | CDP facilitator (`https://api.cdp.coinbase.com/platform/v2/x402`), after the live gate | `https://x402.org/facilitator` (testnet-only) |
| Transactions | v0; every lookup passes `maxSupportedTransactionVersion: 0` | same |

## What we document but do not ship yet

- **Sends, and funding them.** The CDP server wallet above, plus a Coinbase Onramp
  session link on mainnet. Next, once the operator credential is provisioned.
- **x402 on Solana (accepts entry + buyer arm).** After W2b lands the MPP branch on
  the same gate. Until then the 402 response carries only the Base entry and the agent
  cannot pay an x402 challenge from the CDP send account.
- **Standing budgets for machine payments.** Next, after access keys. Until then every
  x402 charge is its own approval card.
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
- **Wallets and treasury.** Phantom (a Solana track sponsor) — today the wallet we
  expect you to pay Solana Pay requests from; Phantom Connect for embedded sign-in
  later. Squads v4 for multisig treasuries (fund the vault PDA, never the multisig
  PDA), Swig for role-scoped smart wallets. Air's own custody model does not need them
  for the payments rail.

## Resources

- Solana docs: https://solana.com/docs · quick start: https://solana.com/docs/intro/quick-start · installation: https://solana.com/docs/intro/installation
- Agent skills: https://solana.com/skills (`npx skills add solana-foundation/solana-dev-skill`) · MCP: `claude mcp add --transport http solana-mcp-server https://mcp.solana.com/mcp`
- create-solana-dapp: https://github.com/solana-foundation/create-solana-dapp
- PAY.SH (`pay` — x402 and MPP buyer CLI; every real payment needs a local unlock prompt): https://github.com/solana-foundation/pay
- x402: https://docs.cdp.coinbase.com/x402/welcome · Solana guide: https://solana.com/docs/payments/agentic-payments/intro-to-x402
- Coinbase Onramp: https://docs.cdp.coinbase.com/onramp/introduction/welcome
- Meteora DBC: https://docs.meteora.ag/developer-guides/dbc
- Confidential transfers: https://solana.com/docs/tokens/extensions/confidential-transfer
- Arcium: https://docs.arcium.com/
