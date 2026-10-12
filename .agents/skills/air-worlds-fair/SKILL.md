---
name: air-worlds-fair
description: Router for Air's Crypto World's Fair work (Solana, Tempo, Hyperliquid, Zcash, company formation). Use when adding a chain venue or pay rail to Air, extending /trade or /pay, building the /formation or /zec surfaces, or writing the air.wzrd.tech/docs track pages. Points at the right installed sponsor skill and the Air seams that must be reused.
---

# Air × Crypto World's Fair

Program of record: `docs/worlds-fair/README.md` (analysis) and
`docs/worlds-fair/spec.md` (the executable spec). Public docs pages:
`docs/site/*.md`. Read those before touching code; where they and
`ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins.

## The seams you extend (never bypass)

| Seam | File | Rule |
|---|---|---|
| Trading venue | `apps/web/lib/trade/venue.ts` (`TradeVenue`), `service.ts` (`venueFor`) | A chain is a venue. Preview → `trade_order` decision → resolver submits. Spot only (T4). |
| Pay rail | `apps/web/lib/commerce/paymentRequests.ts`, `apps/web/lib/wallet/send.ts` | A chain is a `currency` row. Approval executes server-side once; `WalletSubmitUnknownError` is terminal (C23). |
| Pay gate (402) | `apps/web/lib/payments/x402.ts`, `apps/web/lib/miniapps/gates.ts` | Settle with the facilitator before any body exists (MA5); receipt first-insert-wins (MA9); payTo = publisher's verified address (MA6). |
| Box documents | `apps/web/lib/miniapps/store.ts`, `stateLease.ts` | User content lives in the Box under `.hermes/miniapps/<app>/` (C4). |
| Mini-app module | `apps/web/lib/miniapps/apps/types.ts`, `index.ts`, migration row in `mini_apps` | Server HTML, owner gate inside the module, no client storage (C17). |
| Decisions | `apps/web/app/api/decisions/route.ts`, `apps/web/lib/approvals/hosted.ts` | New money kinds are arms of the same switch; side effects only in the resolver under the conditional `pending` flip. |
| Box skills | `infra/template/skills/<name>/SKILL.md` | The agent calls `${OPENAI_BASE_URL%/api/gateway/v1}/api/...` with its gateway token; it never holds a venue key. |

## Which installed skill to load

| Track / topic | Skill (already in `.agents/skills`) | Install line (pinned in `skills-lock.json`) |
|---|---|---|
| Colosseum resource corpus, sponsor offers | `colosseum-resources` | `npx skills add ColosseumOrg/colosseum-resources` |
| Solana programs, Kit clients, testing | `solana-dev` | `npx skills add solana-foundation/solana-dev-skill` |
| Solana x402 / MPP buyer CLI (PAY.SH) | `pay` | `npx skills add solana-foundation/pay` |
| Coinbase agentic wallets (SOL/USDC, EVM) | `agentic-wallet` | `npx skills add coinbase/agentic-wallet-skills` |
| Meteora DBC launches | `meteora` | `npx skills add MeteoraAg/meteora-invent` |
| Arcium confidential compute | `arcium` | `npx skills add arcium-hq/agent-skills` |
| Solana Mobile / Seeker | `solana-mobile`, `solana-mobile-wallet`, … | `npx skills add solana-mobile/solana-mobile-skills` |
| Tempo (TIP-20, MPP, SDK, node) | `tempo` | `npx skills add https://github.com/tempoxyz/agent-skills --skill tempo` |
| Hyperliquid trading / payments / Rust SDK | `hyperliquid-trading`, `hyperliquid-payments`, `hyperliquid-rust-sdk` | `npx skills add infinitefield/hypersdk` |
| Zcash shielded wallet in the Box | `zcash` (this repo) | — |

Repos with no skill but worth reading: `nktkas/hyperliquid` (TypeScript SDK the
Hyperliquid venue uses), `solana-foundation/create-solana-dapp`,
`zcash/zcash-devtool` (`doc/walkthrough.md`), `MeteoraAg/dynamic-bonding-curve-sdk`,
`coinbase/x402`, `base/docs`, `tempoxyz/docs`.

## Non-negotiables (from the spec, cite as `spec.md §W<n>`)

- W1 Every chain action is stage → owner approval → resolver. No Box-side signing
  except the Zcash wallet, and that only with a single-use execution nonce from the
  resolver.
- W2 Testnet first: Hyperliquid testnet, Tempo Moderato (42431), Solana devnet, Zcash
  testnet. Mainnet is a flag (`*_LIVE_ENABLED`), never a default.
- W3 Credentials the user connects (HL API wallet key, CDP key) are sealed in
  `trade_connections` / `provider_keys`; the Box and browser see a last-4 hint only.
- W4 Every 402 settlement (x402 or MPP) is receipted before access; every agent-paid
  charge is capped and receipted.
- W5 Copy is "estimates, not advice"; previews say "estimated"; nothing says
  "guaranteed".
