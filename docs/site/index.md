---
title: Air at the Crypto World's Fair
description: How your Air agent trades, pays, gets paid, and forms your company across Solana, Tempo, Hyperliquid, and Zcash — with nothing moving until you approve it.
slug: /docs/worlds-fair
---

# Air at the Crypto World's Fair

Air is a personal AI agent with its own phone number, inbox, computer, and wallet,
tied to exactly one person. It talks to you over iMessage and the web. It can stage
money actions — an order, a payment, a purchase, a company filing — but **nothing
moves until you tap Approve** on an exact, expiring preview. If a venue does not
confirm, Air never retries on its own.

For the Crypto World's Fair we taught that one contract five new tricks:

| Page | What your agent can do |
|---|---|
| [Hyperliquid](/docs/hyperliquid) | `/trade buy 20 HYPE` — HyperCore spot through an API wallet you approve once; every order previewed, approved, receipted |
| [Tempo](/docs/tempo) | `/pay 25 USD to @alice on tempo` — TIP-20 transfers with an invoice memo, fees sponsored; your mini-apps accept HTTP 402 machine payments (MPP and x402) |
| [Solana](/docs/solana) | `/pay request 12 USDC on solana` — a Solana Pay QR that confirms itself; x402 on Solana for your mini-apps; a Solana wallet your agent can fund and spend from, under caps |
| [Zcash](/docs/zcash) | A shielded wallet that lives on your own Box; Unified Addresses and ZIP-321 requests; sends staged by the agent, executed only after your approval |
| [Formation](/docs/formation) | `/formation` — decide LLC vs C-Corp, build the packet, hand off to Stablecorp with a purchase stop, track EIN/bank, never miss the 83(b) deadline, invoice in stablecoins |
| [Base, Arbitrum, Robinhood Chain](/docs/evm-chains) | What already works on Base today (wallet, USDC rail, x402 gate) and the network facts for the other EVM tracks |

## The rules that do not change

- **Stage, never execute.** Your agent and its Box can preview and propose. Only the
  approval resolver, running under your session or your approval link, touches a
  venue or a chain.
- **Exact, expiring previews.** What you approve is a signed snapshot of the order or
  payment. Change one field and it needs a new preview. Previews expire in five minutes.
- **One pending approval at a time.** A second request waits until you approve, deny,
  or let the first one expire.
- **Caps are yours.** Per-order, daily, and velocity caps apply server-side. Raising a
  cap is itself an approval.
- **Uncertain means stop.** A timeout after a submit is terminal. Air tells you to
  check the ledger; it never resubmits.
- **Keys stay put.** Exchange and chain credentials you connect are sealed in the
  control plane and never reach your Box, your browser, or a log. Keys that are yours
  alone (your shielded Zcash wallet) live only in your Box.
- **Not advice.** Previews are estimates. Air does not rank assets or promise outcomes.

## Try it

Text your Air number:

```
/trade                      open the Trade tape (paper mode, $10,000 simulated)
/trade connect hyperliquid  connect an API wallet (testnet first)
/pay request 25 USD on tempo
/pay 12 USDC to <address> on solana
/zec address                a fresh Unified Address + ZIP-321 QR
/formation                  start the company intake
```

Everything above also works from the web composer at `app.wzrd.tech/home`.
