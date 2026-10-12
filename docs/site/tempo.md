---
title: Tempo — stablecoin payments and machine payments with your agent
description: Air on Tempo: TIP-20 transfers with invoice memos, fees sponsored so you hold no gas token, a receive watcher that confirms delivery from the finalized log, and HTTP 402 machine payments (MPP) your mini-apps can charge and your agent can pay — one approved charge at a time.
slug: /docs/tempo
---

# Tempo

Status: planned (testnet after W2a merges)

Tempo is a payments blockchain: there is no native gas token, fees are paid in any
USD stablecoin, payment transfers get their own blockspace, every transfer can carry a
32-byte memo, and blocks finalize deterministically in under a second. Air uses Tempo
as a **pay rail** (send and receive stablecoins, with the invoice number in the memo)
and as a **machine-payments rail** (your mini-apps can charge per request with the
Machine Payments Protocol, and your agent can pay such services one approved charge at
a time).

Nothing changes about the Air contract: your agent *stages* a payment, you *approve*
it, the control plane *executes* it once, and an unconfirmed submit is never retried.

## What you can do

| You say | What happens |
|---|---|
| `/pay 25 USD to 0x… on tempo memo INV-0007` | Preview card: token (OUSD), amount, recipient, memo, estimated fee (about $0.0006 at most), who pays the fee (sponsored on Moderato), network. Tap **Approve** → one `transferWithMemo` from the send account Air manages for you. Receipt line with the explorer link. |
| `/pay request 25 USD on tempo memo INV-0007` | A request card: the Tempo address you entered, the memo (yours, or a short request id if you give none), and the amount — as text and as a QR. When a finalized `TransferWithMemo` matching all three lands, the request flips to **paid** and you get a text. |
| `/pay tempo balance` | OUSD and pathUSD balances of the send account Air manages for you, no card needed. |
| `/pay tempo address` | The Tempo addresses on file — the send account Air manages (fund it from the Moderato faucet) and the receive address you entered — no card needed. |
| Open a priced mini-app with an MPP client | Your mini-app answers `402` with the x402 body it sends today **plus** an MPP `WWW-Authenticate: Payment` challenge paying to the Tempo address you entered; a paid retry is verified, settled, and receipted before the page renders. |
| "Pay for that MPP service" | The agent previews the challenge without paying; a card shows the exact amount, token, recipient, and realm; after your tap the control plane pays once under your caps and the charge is receipted. The demo target is an MPP-priced endpoint off Air's own hosts, which the fetch guard refuses (see *Your agent paying a 402*) — a throwaway `mppx` server on Moderato, not an Air mini-app. |

The first four rows land together (send, request, the two reads); the two `402` rows
follow in the same session once the send path is accepted. Everything runs on
**Moderato testnet** first. Mainnet is a flag the operator flips after the live gate
(same discipline as Trade's `TRADE_LIVE_ENABLED`) — and for Tempo the flag is necessary
but not sufficient: the signer Air holds for testnet never opens on mainnet (see
*What we document but do not ship yet*).

## For judges

- **Track-native primitives:** TIP-20 `transferWithMemo` with a 32-byte memo; fee
  sponsorship (`feePayer: true` through the Moderato relay) so the user holds no gas
  token; delivery confirmed from the finalized `TransferWithMemo` log, not the
  receipt (receive policies can redirect); MPP `charge` intent via `mppx` on the
  mini-app `402` gate, next to the x402 entry it already serves.
- **Network chip:** every card and receipt names the network (Tempo Moderato, chain
  42431).
- **The three commands:** `/pay 1 USD to 0x… on tempo memo INV-1` → Approve → receipt
  with `explore.testnet.tempo.xyz/tx/<hash>`; `/pay request 1 USD on tempo memo INV-1`,
  paid from a second faucet-funded account → **paid** within one cron tick;
  `/pay tempo balance`.
- **Sponsor touched:** Tempo — Moderato RPC, the public fee-payer relay, the faucet,
  `viem/tempo` (viem 2.57.4), `mppx` 0.13.3.
- **Where the code lands:** `apps/web/lib/chains/tempo/{client,signer}.ts`,
  `apps/web/lib/pay/rails/tempo.ts`, `apps/web/app/api/pay/route.ts` (W2a);
  `apps/web/lib/payments/mpp.ts`, `apps/web/lib/pay/machine.ts` (W2b). Invariants:
  `docs/worlds-fair/spec.md` §W1 (nothing moves without your tap), §W2 (testnet
  first), §W8 (never from an unattended run).
- **Video:** `[video timestamp: TBD]`.

## How it works under the hood

### Wallet

Tempo gives each Air user two addresses, and they are deliberately not the same one.

**The send account.** A per-user secp256k1 key generated server-side, sealed under the
control plane's vault key, opened only inside the approval resolver, never in the Box
or the browser. It is **testnet-only by construction**: the signer refuses to open on
mainnet whatever `TEMPO_LIVE_ENABLED` says. Fund it from the Moderato faucet
(`client.faucet.fundSync`). Mainnet waits for the access-key model, where your own
Tempo Wallet (passkey) is the root and Air holds only an access key you authorized
with limits, expiry, and scopes (see *What we document but do not ship yet*).

**The receive address.** Your own Tempo address, entered once in the Pay card's
owner-only settings view and checksum-validated. Requests and MPP revenue land there.
Air never holds a key for it, so nothing Air signs can touch what you are paid.

The client is `viem/tempo` (viem ≥ 2.57; Air pins 2.57.4):

```ts
import { Account, createClient, http, withRelay } from "viem/tempo";
const client = createClient({
  account,                       // Account.fromSecp256k1(opened only in the resolver)
  testnet: true,                 // Moderato (42431); the raw signer never opens for mainnet (4217)
  feeToken: OUSD,                // 0x20c0000000000000000000006a37da5c996874be
  transport: withRelay(http(), http("https://sponsor.moderato.tempo.xyz")),  // TEMPO_SPONSOR_URL
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
  feePayer: true,                         // relayed through the public Moderato sponsor; approved payer on mainnet
  nonceKey: "expiring",                   // no nonce tracking; ≤ 5-minute validity
});
```

The approval card shows exactly these fields and expires in five minutes. The send
runs through the same approval lane that moves USDC on Base: on your tap Air re-reads
the staged row and re-checks balance, caps and expiry before it claims it (a row past
its expiry is refused, and the pay-rails cron sweeps unapproved rows past `expires_at`
to **expired**), then claims the staged transfer once (`pending → submitting`), the
Tempo rail prepares and submits it, and the state it reports is written back. Tempo
has no provider-side idempotency key, so that single claim is the only guard — a
second tap finds the row claimed and stops. One pending Tempo send at a time; a second
proposal is refused until the first is approved, denied, or expires.

`transferSync` waits for the receipt, and Air then looks for the `Transfer` log to
**your recipient** in it. A receipt with no such log means the recipient's receive
policy redirected the funds to the guard: the send is marked **redirected**
("delivered to the recipient's guard, not their balance") and never retried. If the
submit times out, Air looks the transaction hash up once; if it is still unknown the
send is terminal — the card reads **Send outcome unknown — check the chain**
(`submit_unknown`) — and Air never resubmits.

Receipt line: `✓ Sent 25 OUSD on Tempo Moderato · explore.testnet.tempo.xyz/tx/<hash>`.

### Receive and confirm

A successful transaction is not proof of delivery on Tempo: the recipient's **receive
policy** can redirect funds to the `ReceivePolicyGuard`. Air therefore confirms a
request only from a finalized `TransferWithMemo` log that matches token, your receive
address, memo, and `amount ≥ requested`, and dedupes on `chainId:txHash:logIndex`. The
watcher is a cron tick, not a socket:

```ts
const logs = await client.getContractEvents({
  address: OUSD, abi: Abis.tip20, eventName: "TransferWithMemo",
  args: { to: receiveAddress, memo },      // both indexed
  fromBlock: lastSeenBlock, toBlock: "finalized",
});
for (const log of logs) markPaidIfMatches(log.args, `${chainId}:${log.transactionHash}:${log.logIndex}`);
```

The memo is your invoice number or a short request id; it is public, so Air never puts
names in it. The card prints address, memo, and amount as text; the QR is a
convenience, not something the watcher depends on.

### Machine payments (MPP) on your mini-apps

Air mini-apps already answer `402 Payment Required` with an x402 `accepts` payload. On
Tempo the same response also carries a `WWW-Authenticate: Payment …` challenge (charge
intent, OUSD, recipient = the Tempo address you entered — Air never custodies gate
revenue; if you have not entered one, the MPP challenge is simply omitted). A client
retries with `Authorization: Payment <credential>`. The credential carries either a
signed transaction (**pull** mode: the client signs a TIP-20 transfer that pays its own
fee and Air's server broadcasts it) or a transaction hash (**push** mode: the client
broadcast it, say from a browser wallet). Air attaches no fee payer to the gate, so
there is no funded hot key an anonymous client could drain. Air verifies and settles
the credential, writes a receipt keyed on the transaction hash, and only then mints the
paid session; a replayed credential gets `402 already redeemed`, never a session. The
`X-PAYMENT` header keeps taking today's x402 path.

```ts
import { Mppx, tempo } from "mppx/server";
const mppx = Mppx.create({
  realm,                                                          // this app's origin
  methods: [tempo({ currency: OUSD, recipient: publisherAddress, testnet: true })],
});
const result = await mppx.charge({ amount: "0.10" })(request);    // decimal string, OUSD units
if (result.status === 402) return result.challenge;               // before any body exists
return result.withReceipt(renderApp());
```

### Your agent paying a 402

The Box never holds a Tempo key. When the agent meets a `402`, it asks the control
plane to inspect the challenge without paying (what `npx mppx --inspect <url>` shows)
and a `machine_payment` card is filed with the exact amount, token, recipient, and
realm. Every charge waits for your tap; there is no budget that pays on its own yet.
After your approval the resolver fetches the challenge again (if the price, asset, or
recipient changed, the card expires with "the price changed"), creates the credential
with your sealed Tempo signer, completes the request, counts the charge against your
pay caps, writes the receipt, and saves the response body to your Box at
`.hermes/miniapps/pay/machine/<id>.json` for the agent to read. A failure after the
credential exists is terminal: Air tells you and never retries.

The control plane fetches only `https://` URLs that resolve to public addresses —
reusing the public-address check the kernel purchase quote path already uses —
re-checks DNS immediately before each request, follows no redirects (any `3xx` fails
the charge), refuses Air's own hosts (`app.wzrd.tech`, `mini.wzrd.tech`,
`*.on.ascii.dev`, and Air's database host), waits at most 10 seconds, and reads at
most 1 MB. That denylist is why the demo target above is not an Air mini-app.

## Networks and addresses

| | Mainnet | Moderato testnet |
|---|---|---|
| Chain ID | 4217 | 42431 |
| RPC | `https://rpc.tempo.xyz` | `https://rpc.moderato.tempo.xyz` |
| WebSocket | `wss://rpc.tempo.xyz` | `wss://rpc.moderato.tempo.xyz` |
| Explorer | `https://explore.tempo.xyz` | `https://explore.testnet.tempo.xyz` (`/tx/<hash>`) |
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
- **Memos are 32 bytes**, not 32 characters, and they are public. A longer memo is
  refused at preview.
- **Two addresses.** Sends come from the account Air manages; requests and MPP revenue
  land in the address you entered, which Air never signs for.
- **One pending send, five-minute previews.** A second Tempo send waits until the
  first is approved, denied, or expired.
- **Outcome unknown means stop.** A timeout after a submit gets one hash lookup, then
  the send is terminal (`submit_unknown`) and you are told to check the explorer. Air
  never resubmits.
- The public fee sponsor is **testnet-only**. Production sponsorship needs an approved
  payer (Tempo Console API key) or a self-hosted relay with its own policy.

## What we document but do not ship yet

If a row from *What you can do* has not merged by submission, it moves here too.

- **Standing budgets ("up to $5/day for image generation").** Next, after access keys.
  The design is a Tempo **access key** your root authorizes with per-token limits,
  expiry, and a `transferWithMemo` scope — a key that cannot withdraw, cannot create
  contracts, and can be revoked permanently
  (`client.accessKey.authorizeSync({ accessKey, expiry, limits: [{ token: OUSD, limit,
  period: 86400 }], scopes: [{ address: OUSD, selector:
  "transferWithMemo(address,uint256,bytes32)" }] })`). Until then every machine charge
  is its own approval, and there is no policy command.
- **Mainnet.** `TEMPO_LIVE_ENABLED` is necessary but not sufficient. The raw signer Air
  holds for testnet never opens on mainnet; mainnet needs the access-key model — your
  Tempo Wallet (passkey) is the root, onboarded on the mini origin with the Accounts
  SDK, and Air holds only an access key with limits, expiry, and scopes kept equal to
  your Air caps. Fee sponsorship on mainnet needs an approved payer
  (`TEMPO_SPONSOR_URL=https://api.tempo.xyz/rpc/sponsor?key=tempo:sk:…`); the public
  relay is Moderato-only.
- **Virtual addresses (TIP-1022).** Per-customer addresses derived from one master
  (Address Registry `0xFDC0…0000`) so a payer needs no memo. Air uses your address plus
  a 32-byte memo instead; virtual addresses exist and are not built.
- **Metered sessions (MPP `session` intent).** Pay-as-you-go through an on-chain
  channel reserve and off-chain vouchers, including streamed per-unit charges. Air's
  gate charges per request; sessions are documented, not shipped.
- **Wallets that scan the request QR.** The QR carries an EIP-681-style
  `transferWithMemo` URI as a best effort; no Tempo wallet is documented to parse it,
  so the card always prints address, memo, and amount as text.
- **Issuing your own TIP-20 stablecoin.** One SDK call on testnet
  (`client.token.createSync`) — but mint, pause, freeze, and supply-cap roles are
  production security decisions, so Air documents it and does not expose it.

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
- Machine payments (MPP): https://tempo.xyz/developers/docs/guide/machine-payments · protocol: https://mpp.dev/protocol
- Accounts SDK: https://accounts.tempo.xyz/docs
- Agent tooling: `claude mcp add --transport http tempo https://mcp.tempo.xyz`, `npx skills add tempoxyz/plugins --skill docs`
