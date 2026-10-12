---
title: Base, Arbitrum, and Robinhood Chain — what already works
description: Air's wallet and x402 gate live on Base today. Arbitrum and Robinhood Chain are EVM chains Air reaches by configuration; this page records the network facts and the one thing to know about each.
slug: /docs/evm-chains
---

# Base, Arbitrum, Robinhood Chain

Air's server-managed wallet is on **Base** (USDC), the Pay mini-app's USDC rail sends
on Base, and the mini-app x402 gate settles USDC on Base through the Coinbase
Developer Platform facilitator. Nothing here is new for the World's Fair; it is the
substrate the Solana, Tempo, Hyperliquid, and Zcash rails plug into. Arbitrum and
Robinhood Chain are EVM chains Air can point the same wallet at by configuration.

## Networks

| Chain | Chain id | RPC | Explorer | Gas | USDC |
|---|---|---|---|---|---|
| Base | 8453 | `https://mainnet.base.org` | basescan.org | ETH | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532 | `https://sepolia.base.org` | sepolia.basescan.org | ETH | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Arbitrum One | 42161 | `https://arb1.arbitrum.io/rpc` | arbiscan.io | ETH | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Arbitrum Nova | 42170 | `https://nova.arbitrum.io/rpc` | nova.arbiscan.io | ETH | — |
| Arbitrum Sepolia | 421614 | `https://sepolia-rollup.arbitrum.io/rpc` | sepolia.arbiscan.io | ETH | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| Robinhood Chain | 4663 | `https://rpc.mainnet.chain.robinhood.com` | robinhoodchain.blockscout.com | ETH | USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Robinhood Chain testnet | 46630 | `https://rpc.testnet.chain.robinhood.com` | explorer.testnet.chain.robinhood.com | ETH | faucet tokens |

Public RPCs are rate-limited and have no WebSocket on Arbitrum and Robinhood Chain;
production reads go through a provider.

## Base

- Sub-second confirmation through Flashblocks (200 ms preconfirmations); fees
  typically under a cent.
- **Base Pay** (`@base-org/account`: `pay({ amount, to, testnet })` and
  `getPaymentStatus`) is a no-wallet-connect USDC checkout; the Base Account SDK is
  now branded Coinbase Wallet and documented under the Coinbase Developer Platform.
- **OnchainKit and MiniKit were archived in September 2026.** New work uses wagmi +
  viem and the Farcaster mini-app SDK; Base publishes migration skills
  (`npx skills add base/skills`).
- **x402** is protocol v2 under the x402 Foundation: `PAYMENT-REQUIRED`,
  `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE` headers, CAIP-2 network ids
  (`eip155:8453`), schemes `exact` / `upto` / `batch-settlement`. The public
  facilitator at `https://x402.org/facilitator` is testnet-only; mainnet uses the CDP
  facilitator. Air's gate moves to v2 in the Solana session while still accepting v1
  `X-PAYMENT` clients.
- Funding: Coinbase withdrawals with network Base; **Coinbase Onramp** session
  tokens (`POST https://api.developer.coinbase.com/onramp/v1/token`, five-minute
  single-use token, hosted URL `https://pay.coinbase.com/buy/select-asset?sessionToken=…`)
  for a hosted buy flow into a Base or Solana address.

## Arbitrum

Arbitrum One is a Nitro rollup; Nova is AnyTrust. `block.number` approximates the L1
block (use `ArbSys` for L2 height), L1→L2 senders are aliased, canonical withdrawals
take about seven days. Stylus lets you write contracts in Rust. Air needs none of this
for payments: change `WALLET_CHAIN_ID` and the USDC address and the wallet rail works.

## Robinhood Chain

An Arbitrum Orbit chain settling to Ethereum, mainnet since July 2026. Gas is ETH.
Stock Tokens are ERC-20s with the ERC-8056 scaled-UI extension (`uiMultiplier` changes
on splits; raw balances never rebase); read the live contract registry at
`docs.robinhood.com/chain/contracts` — a same-ticker token at another address is a
fake. Chainlink tokenized-equity feeds exist on mainnet only (24/5 sessions, so use
multi-day staleness windows). Testnet faucet:
https://faucet.testnet.chain.robinhood.com (test ETH plus sample Stock Tokens).
Deploy and verify with Foundry:

```sh
forge create src/Hello.sol:Hello --rpc-url https://rpc.testnet.chain.robinhood.com --private-key $PK --broadcast
forge verify-contract --chain-id 46630 --verifier blockscout \
  --verifier-url https://explorer.testnet.chain.robinhood.com/api <ADDRESS> src/Hello.sol:Hello
```

## Resources

- Base: https://docs.base.org/get-started/base · connect: https://docs.base.org/get-started/connect-to-base · SDKs and APIs: https://docs.base.org/get-started/sdks-and-apis
- Arbitrum public chains: https://docs.arbitrum.io/arbitrum-essentials/public-chains
- Robinhood Chain: https://docs.robinhood.com/chain/connecting/ · deploy: https://docs.robinhood.com/chain/deploy-smart-contracts/ · faucet: https://faucet.testnet.chain.robinhood.com/
- Coinbase Onramp: https://docs.cdp.coinbase.com/onramp/introduction/welcome · x402: https://docs.cdp.coinbase.com/x402/welcome
