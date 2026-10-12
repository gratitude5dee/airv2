---
title: Zcash — a shielded wallet on your own computer
description: Air on Zcash: a shielded light wallet that lives in your Box, Unified Addresses and ZIP-321 payment requests your agent can hand out, and sends the agent can only stage — executed after your approval with a single-use key the agent never holds.
slug: /docs/zcash
---

# Zcash

Zcash is private money: shielded transfers hide sender, receiver, and amount. Its
maintained stack is Rust (`librustzcash`, Zebra, lightwalletd), and the right way to
hold ZEC is on a machine you control. Every Air user already has one: the **Box**,
your agent's own Linux computer. So Air's Zcash wallet runs there, its keys never leave
it, and the control plane only ever sees what an approval card needs: an address, an
amount, a memo.

## What you can do

| You say | What happens |
|---|---|
| `/zec address` | A fresh Unified Address (`u1…`) from your Box wallet, with a QR. |
| `/zec request 1.5 memo "October rent"` | A ZIP-321 payment request (`zcash:u1…?amount=1.5&memo=…`) as a QR and link. When the note arrives, the request flips to **paid** and you get a text. |
| `/zec balance` | Shielded balance (spendable vs pending confirmations), sync height. No card. |
| `/zec send 0.1 to u1… memo "rent"` | Preview: recipient (shortened), amount, ZIP-317 fee, network. Tap **Approve** → your Box builds, proves, signs, and broadcasts exactly that transaction. Transaction id in chat. |

Testnet by default (`utest1…` addresses, `testnet.zec.rocks`). Mainnet is a flag the
operator flips after the live gate.

## Why the wallet is in the Box

Air has two rules about keys. Credentials you connect (an exchange API key) are sealed
in the control plane and never reach your Box or browser. Keys that are **yours alone**
never leave your own machine. A Zcash spending key is the second kind. Putting it in a
serverless control plane would make Air a custodian; putting it in a browser card is
forbidden by Air's no-client-storage rule and is no place for a light-client sync.

## How a send actually executes

```
agent ── air-zec propose ──▶ fee + proposal hash ──▶ zcash_send approval card
owner taps Approve ──▶ control plane mints a single-use nonce (2 minutes)
            ──▶ Box runs `air-zec exec --nonce …` as a separate system user
                  ├─ claims the nonce with the control plane (second claim is refused)
                  ├─ re-proposes; if anything changed, stops without signing
                  ├─ proves + signs with the encrypted identity the agent cannot read
                  └─ broadcasts via lightwalletd, reports the txid
```

- The agent has **no send command**. It can read balances, make addresses and
  requests, and stage a proposal.
- `exec` runs as a different system user. The agent's sudo rule does not include it,
  and the encrypted identity file is not readable by the agent.
- Without a nonce the control plane minted after your tap, `exec` exits before it
  touches a key. A nonce can be claimed once.
- If the broadcast is ambiguous (connection drops after sending), the send is marked
  **uncertain** and is never re-executed; the next sync shows the txid or not.

This is the same stage → approve → execute contract as every other money action in
Air, applied where the signer has to be your own machine. It is the PCZT idea
(propose, prove, sign, send as separate steps) mapped onto Air's trust boundary.

## Under the hood

- Binary: `air-zec`, a small Rust CLI on the Ironwood-era crates
  (`zcash_client_backend` 0.24+, `zcash_client_sqlite` 0.22+, bundled Sapling
  prover; Orchard and Ironwood need no parameters). It mirrors the commands in the
  `zcash-devtool` walkthrough (`init`, `sync`, `balance`, `list-addresses`, `propose`,
  `send`, `pay`), which is the reference implementation and explicitly not for
  production.
- Sync: a timer runs every two minutes while your Box is awake; a value-free status
  and your balance summary land in the Box document your agent reads.
- Light client servers: `zec.rocks:443` (mainnet, regional mirrors `na/eu/ap/sa`),
  `testnet.zec.rocks:443`; status at https://hosh.zec.rocks. Self-hosting means Zebra
  with lightwalletd (or Zaino) in front.
- Network state as of October 2026: NU6.3 "Ironwood" is live on mainnet (new shielded
  pool, v6 transactions); NU7 is live on testnet with its mainnet height pending. Air
  pins the crate wave that understands both and lets the library choose receivers and
  pools; wallets must not send to other wallets' legacy Orchard receivers after
  Ironwood, and the library enforces that.

## ZIP-321 requests

```
zcash:u1…?amount=1.5&memo=T2N0b2JlciByZW50&label=Air&message=Invoice%20INV-7
```

Amount is decimal ZEC with up to 8 places; the memo is base64url without padding
and is not allowed with transparent-only addresses; unknown `req-` parameters make a
URI invalid. Air renders the QR server-side.

## Things to know

- First sync from a fresh wallet is fast because the birthday is the creation
  height; restoring an old seed scans from that seed's birthday and takes longer.
- Shielded balance shows **spendable** and **pending** separately; a send waits for
  the confirmation policy.
- Public lightwalletd servers are best-effort and rate-limited.
- The mnemonic is shown once, to you, on the Wallet tab. Back it up. Air cannot
  recover it.

## Resources

- Documentation index: https://zcash.github.io/
- librustzcash: https://github.com/zcash/librustzcash · `zcash_client_backend`: https://docs.rs/zcash_client_backend/latest/zcash_client_backend/
- zcash-devtool walkthrough: https://github.com/zcash/zcash-devtool/blob/main/doc/walkthrough.md
- ZIP 316 Unified Addresses: https://zips.z.cash/zip-0316 · ZIP 321 payment URIs: https://zips.z.cash/zip-0321
- Zebra: https://zebra.zfnd.org/user/install.html · lightwalletd: https://github.com/zcash/lightwalletd · Zaino: https://github.com/zingolabs/zaino
- Wallet threat model: https://github.com/zodl-inc/zodl-project/blob/main/wallet_threat_model.md
