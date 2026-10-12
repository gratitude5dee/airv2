---
title: Air at the Crypto World's Fair
description: How your Air agent trades, pays, gets paid, and forms your company across Solana, Tempo, Hyperliquid, and Zcash — with nothing moving until you approve it.
slug: /docs/worlds-fair
---

# Air at the Crypto World's Fair

Status: per track — see the Status column below. Base (wallet, USDC rail, x402 gate)
is shipped today; every other row is planned until its session merges. Each track page
carries its own `Status:` line, which flips to testnet or shipped when that happens.

Air is a personal AI agent with its own phone number, inbox, computer, and wallet,
tied to exactly one person. It talks to you over iMessage and the web. It can stage
money actions — an order, a payment, a purchase, a company filing — but **nothing
moves until you tap Approve** on an exact, expiring preview. If a venue does not
confirm, Air never retries on its own.

For the Crypto World's Fair we taught that one contract five new tricks:

| Page | Status | What your agent can do |
|---|---|---|
| [Hyperliquid](/docs/hyperliquid) | planned · testnet first | `/trade buy $50 of HYPE` — HyperCore spot through an API wallet you connect once (testnet first); paper mode prices from Hyperliquid before you connect; every order previewed, approved, receipted |
| [Tempo](/docs/tempo) | planned · testnet first | `/pay 25 USD to 0x… on tempo memo INV-7` — TIP-20 transfers with an invoice memo, fees sponsored on Moderato; `/pay request … on tempo` flips to paid when the memo'd transfer lands; your priced mini-apps accept HTTP 402 machine payments over MPP beside x402 |
| [Solana](/docs/solana) | planned | `/pay request 12 USDC on solana` — a Solana Pay QR to your own Solana address that confirms itself; x402 on Solana for your mini-apps; sends from a server wallet under caps |
| [Zcash](/docs/zcash) | planned | A shielded wallet that lives on your own Box; Unified Addresses and ZIP-321 requests; sends staged by the agent, executed only after your approval |
| [Formation](/docs/formation) | planned | `/formation` — decide LLC vs C-Corp, build the packet, hand off to Stablecorp with a checkout stop, track EIN/bank, get reminded before the 83(b) deadline, invoice in stablecoins |
| [Base, Arbitrum, Robinhood Chain](/docs/evm-chains) | shipped (Base) | What already works on Base today (wallet, USDC rail, x402 gate) and the network facts for the other EVM tracks |

## The rules that do not change

- **Stage, never execute.** Your agent and its Box can preview and propose. Only the
  approval resolver, running under your session or your approval link, touches a
  venue or a chain — or, for Zcash, your Box acting on the resolver's single-use
  nonce.
- **Exact, expiring previews.** What you approve is a signed snapshot of the order or
  payment. Change one field and it needs a new preview. Previews expire in five minutes.
- **One pending money approval per lane.** A second order, or a second send on the
  same chain rail (Tempo, Solana, Zcash), waits until you approve, deny, or let the
  first one expire.
- **Caps are yours.** Per-order, daily, and velocity caps apply server-side. Raising a
  cap is itself an approval; lowering one applies at once.
- **Uncertain means stop.** A timeout after a submit is terminal. Air tells you to
  check the ledger; it never resubmits.
- **Keys stay put.** Exchange and chain credentials you connect are sealed in the
  control plane and never reach your Box, your browser, or a log. Your shielded Zcash
  spending key lives only on your Box, wrapped with a secret the control plane holds —
  neither side can spend alone, and the seed never passes through the control plane.
- **Not advice.** Previews are estimates. Air does not rank assets or promise outcomes.

## Try it

Text your Air number:

```
/trade                          open the Trade tape (paper mode, $10,000 simulated)
/trade connect hyperliquid      connect an API wallet (testnet first)
/trade buy $50 of HYPE          preview → Approve → receipt (paper until you connect)
/pay tempo balance              OUSD balance on Tempo
/pay request 25 USD on tempo    request card; paid when the memo'd transfer lands
/pay 12 USDC to <address> on solana
/zec address                    a fresh Unified Address + ZIP-321 (zcash:) QR — utest1… on testnet
/formation                      open the Formation card
```

Every read is `/pay <rail> balance` or `/pay <rail> address`; `/zec …` is shorthand
for the same command on the Zcash rail (`/zec balance` is `/pay zcash balance`).
`/formation` opens a card rather than taking arguments. Anything else after `/pay` or
`/trade` goes to your agent as a request and comes back as a preview if money is
involved.

Everything above also works from the web composer at `app.wzrd.tech/home`.

