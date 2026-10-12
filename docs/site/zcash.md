---
title: Zcash — a shielded wallet on your own computer
description: Air on Zcash: a shielded light wallet that lives in your Box, Unified Addresses and ZIP-321 payment requests your agent can hand out, and sends the agent can only stage — executed in your Box after your approval, with a single-use nonce and a key half the control plane releases once per approved send.
slug: /docs/zcash
---

# Zcash

Status: planned — nothing on this page is live yet. The design is `docs/worlds-fair/spec.md §9`; the Box wallet binary (`air-zec`) is not baked, so every `/zec` row below is listed under *What we document but do not ship yet* with what blocks it.

Zcash is private money: shielded transfers hide sender, receiver, and amount. Its
maintained stack is Rust (`librustzcash`, Zebra, lightwalletd), and the right way to
hold ZEC is on a machine you control. Every Air user already has one: the **Box**,
your agent's own Linux computer. So Air's Zcash wallet runs there, its spending key
never leaves it, and the control plane relays the memo to your Box and stores only an
address hint, the amount and whether there is a memo — never the memo text.

## What you can do

Every row here needs `air-zec` in your Box. Until it is baked, each row also appears
under *What we document but do not ship yet* with what blocks it.

| You say | What happens |
|---|---|
| `/zec address` | A fresh Unified Address (`utest1…` on testnet, `u1…` on mainnet) from your Box wallet, with a QR. |
| `/zec request 1.5 memo October rent` | A ZIP-321 payment request (`zcash:utest1…?amount=1.5&memo=…`) as a QR and link. When the note arrives, the request flips to **paid** within a cron tick and you get a text. |
| `/zec balance` | Shielded balance (spendable vs pending confirmations) and sync height from your Box's last sync. No card. |
| `/zec send 0.1 to utest1… memo rent` | Preview: recipient (shortened), amount, ZIP-317 fee, network. Tap **Approve** → your Box builds, proves, signs, and broadcasts exactly that transaction. Transaction id in chat. |

`/zec …` is shorthand for `/pay … on zcash` — one parser, one approval card: `/zec address` = `/pay zcash address`, `/zec balance` = `/pay zcash balance`, `/zec request 1.5 …` = `/pay request 1.5 ZEC on zcash …`, `/zec send 0.1 to utest1… …` = `/pay 0.1 ZEC to utest1… on zcash …`.

Testnet by default (`utest1…` addresses, `testnet.zec.rocks`). Mainnet is a flag the
operator flips after the live gate, and it waits for a seed backup path that stays on
the Box (see *Things to know*).

## Why the wallet is in the Box

Air has two rules about keys. Credentials you connect (an exchange API key) are sealed
in the control plane and never reach your Box or browser. Keys that are **yours alone**
never leave your own machine. A Zcash spending key is the second kind. Putting it in a
serverless control plane would make Air a custodian; putting it in a browser card is
forbidden by Air's no-client-storage rule and is no place for a light-client sync.

The one thing the control plane holds for Zcash is a per-user **wrapping secret**,
sealed like any connected credential. It is useless without the identity file in your
Box, it is never written to the Box at rest, and it is released exactly once per
approved send. The control plane never holds a seed or a spending key.

## How a send actually executes

```
agent ── air-zec propose ──▶ fee + proposal hash ──▶ zcash_send approval card
owner taps Approve ──▶ control plane mints a single-use nonce (2 minutes, bound to this send)
            ──▶ Box runs `air-zec exec --send <id> --nonce …`
                  ├─ claims the nonce with the control plane (second claim is refused)
                  │    and receives the wrapping secret in that one HTTPS response
                  ├─ unwraps the identity in memory, re-proposes; if anything changed, stops without signing
                  ├─ proves + signs, broadcasts via lightwalletd, reports the txid
                  └─ zeroizes the wrapping secret
```

- The agent has **no send command**. It can read balances, make addresses and
  requests, and stage a proposal.
- The boundary is a 2-of-2, not a Unix user. The Box account that runs the agent also
  runs every control-plane command and has root (fleet sync and the Tailscale opt-in
  need it), so a separate `zcash` system user and 0700 files are defense in depth,
  never the boundary. What the agent cannot do is spend: the identity file is wrapped
  with the control plane's secret, and that secret arrives only inside an
  owner-approved send.
- Without a nonce the control plane minted after your tap, `exec` exits before it
  touches a key. A nonce can be claimed once and expires in two minutes.
- Plainly: a fully compromised agent could stage a send (you see a card) and could
  reach the key only during a send you approved. It cannot spend on its own, and the
  control plane never holds a seed or spending key — only the wrapping secret.
- If the broadcast is ambiguous (connection drops after sending), the send is marked
  **uncertain** and is never re-executed; the next sync shows the txid or not.

This is the same stage → approve → execute contract as every other money action in
Air, applied where the signer has to be your own machine. It is the PCZT idea
(propose, prove, sign, send as separate steps) mapped onto Air's trust boundary.

## Under the hood

- Binary: `air-zec`, one small Rust CLI on the Ironwood-era crates, released
  versions only: `zcash_client_backend` 0.24 (`lightwalletd-tonic-tls-webpki-roots`,
  `orchard`), `zcash_client_sqlite` 0.22, `zcash_proofs` 0.30 (`bundled-prover`;
  Orchard and Ironwood need no parameters), `zcash_keys` 0.16, `zcash_address` 0.13,
  `zip321` 0.9, `tonic` 0.14. It mirrors the commands in the `zcash-devtool`
  walkthrough (`init`, `sync`, `balance`, `list-addresses`, `propose`, `send`, `pay`),
  which is the reference implementation and explicitly not for production. The agent
  may run `balance | address | request | propose | sync`; `exec` is the same binary's
  subcommand and needs the nonce.
- Build: a GitHub Actions `rust` job (`cargo build --release --locked`, `cargo test`)
  publishes a sha256-pinned release asset that the Box template downloads and
  verifies. A Box never runs `cargo build`.
- Files: `identity`, `wallet.sqlite`, `blocks/` under `/home/user/.air-zec/` (owner
  `zcash:zcash`, mode 0700), inside the Box's per-minute snapshot. The identity is
  `age`-encrypted and wrapped with the control plane's secret.
- Sync: a systemd timer runs `air-zec sync` every two minutes while your Box is awake
  (30 s after boot) and writes a value-free status and your balance summary
  atomically to the Box document your agent reads.
- Agent-writable files never feed money logic: send caps are in ZEC (per send and
  per day); a USD cap uses a rate the control plane fetches itself and fails closed
  on mainnet; a request flips to **paid** only from `air-zec list-tx` output the
  control plane ran. Every argument to `air-zec` is shell-quoted; memos are at most
  512 bytes with no control characters.
- Light client servers: `zec.rocks:443` (mainnet, regional mirrors `na/eu/ap/sa`),
  `testnet.zec.rocks:443`; status at https://hosh.zec.rocks. Self-hosting means Zebra
  with lightwalletd (or Zaino) in front.
- Network state as of October 2026: NU6.3 "Ironwood" is live on mainnet (new shielded
  pool, v6 transactions); NU7 is live on testnet with its mainnet height pending. Air
  pins the crate wave that understands both and lets the library choose receivers and
  pools; wallets must not send to other wallets' legacy Orchard receivers after
  Ironwood, and the library enforces that.
- Addresses: the parser accepts Rev 0 (`u1…` / `utest1…`) and Rev 2 (`zu…` / `tu…`)
  Unified Addresses; which revision the wallet emits is the pinned library's choice.

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
  the confirmation policy (1 confirmation on testnet, 3 on mainnet).
- Public lightwalletd servers are best-effort and rate-limited.
- Seed export is not available yet. The mnemonic is generated in your Box and is never
  shown through the control plane (a command result would carry it through Air's
  servers and your browser). Mainnet waits for a backup path that stays on the Box.

## What we document but do not ship yet

Every binary-backed row on this page. The Status line flips as each lands.

- **`/zec address` and `/zec balance`** — need `air-zec` baked into the Box template
  and the sync timer running. Blocked on the Rust build job (after the hackathon).
- **`/zec request …`** and the **paid** flip — need `air-zec request` plus the
  control-plane watcher over `list-tx`.
- **`/zec send …`** — needs the `zcash_send` card, the nonce mint, the claim route,
  and `air-zec exec`. The control-plane half is testable against recorded `air-zec`
  output without Rust; the real send needs the binary and testnet ZEC.
- **Sync timer and balance snapshot** in the Box (`air-zec sync`).
- **Seed export / backup** — nothing beyond "stays on the Box" is designed; mainnet
  waits for it.
- **Mainnet** — behind `ZCASH_LIVE_ENABLED`, the per-send and daily ZEC caps, and the
  backup path above.

## For judges

- In the repo today: the design (`docs/worlds-fair/spec.md §9`), the developer skill
  (`.agents/skills/zcash`), and this page. Not in the repo: the `air-zec` crate, the
  Box sync unit, the Box agent's `zcash` skill, the control-plane rail, the `/zec`
  commands.
- What is different about it: the spending key is on the user's own computer, not
  with Air; the only Air-held material is a wrapping secret that is useless alone; the
  agent that proposes cannot execute on its own — the key is reachable only inside a
  send you approved; execution needs a nonce minted by the owner's tap and is
  single-use.
- How to verify when it ships, ordered by ZEC needed: `init` → `address --new` → a
  ZIP-321 request → `exec` refused without a claimable nonce (zero ZEC) → the
  `propose` card and a real testnet send.

## Resources

- Documentation index: https://zcash.github.io/
- librustzcash: https://github.com/zcash/librustzcash · `zcash_client_backend`: https://docs.rs/zcash_client_backend/latest/zcash_client_backend/
- zcash-devtool walkthrough: https://github.com/zcash/zcash-devtool/blob/main/doc/walkthrough.md
- ZIP 316 Unified Addresses: https://zips.z.cash/zip-0316 · ZIP 317 fees: https://zips.z.cash/zip-0317 · ZIP 321 payment URIs: https://zips.z.cash/zip-0321
- Zebra: https://zebra.zfnd.org/user/install.html · lightwalletd: https://github.com/zcash/lightwalletd · Zaino: https://github.com/zingolabs/zaino
- Wallet threat model: https://github.com/zodl-inc/zodl-project/blob/main/wallet_threat_model.md
