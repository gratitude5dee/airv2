---
name: zcash
description: Zcash shielded wallet development for Air — the Box-resident `air-zec` wallet (librustzcash, Ironwood-era crates), Unified Addresses, ZIP-321 payment requests, ZIP-317 fees, lightwalletd/Zebra topology, and the stage → approve → exec contract. Use when building or changing anything under infra/template/air-zec, lib/chains/zcash, lib/pay/rails/zcash, or the zcash box skill.
---

# Zcash (Air)

Spec: `docs/worlds-fair/spec.md §9`. Public page: `docs/site/zcash.md`. Reference
implementation to mirror (not to ship): `zcash/zcash-devtool` → `doc/walkthrough.md`
and `src/commands/wallet/{init,sync,propose,send}.rs`.

## Fixed facts (October 2026)

| Thing | Value |
|---|---|
| Mainnet state | NU6.3 "Ironwood" live since height 3,428,143 (2026-07-28): new shielded pool, v6 tx format, legacy Orchard pool restricted (ZIP 2006/326) |
| Testnet state | NU7 live at 4,465,026 (25-second blocks); mainnet NU7 height unassigned |
| Crates | `zcash_client_backend` ≥ 0.24, `zcash_client_sqlite` ≥ 0.22, `zcash_proofs` (`bundled-prover`), `zip321`, `pczt`, `tonic` 0.14 with `lightwalletd-tonic-tls-webpki-roots` |
| lightwalletd | mainnet `https://zec.rocks:443` (`na/eu/ap/sa.zec.rocks`), testnet `https://testnet.zec.rocks:443`; status https://hosh.zec.rocks |
| Self-host | `zebrad` RPC `127.0.0.1:8232` (`18232` testnet), `enable_cookie_auth = false`; `lightwalletd --zcash-conf-path ~/.config/zebrad.toml --grpc-bind-addr 127.0.0.1:9067` |
| UA prefixes | `u1…` mainnet, `utest1…` testnet (Rev 0); `zu`/`tu` are Rev 2 — parse both |
| Fees | ZIP-317: `StandardFeeRule::Zip317`, `MultiOutputChangeStrategy`; 1 confirmation testnet / 3 mainnet |

## The flow to implement (one function per devtool command)

```rust
let mut client = CompactTxStreamerClient::connect(server).await?;          // tonic + webpki roots
let mut db = WalletDb::for_path(path, params, SystemClock, OsRng)?; init_wallet_db(&mut db, None)?;
let birthday = AccountBirthday::from_treestate(client.get_tree_state(BlockId{height: h-1, ..}).await?.into_inner(), None)?;
let (account, usk) = db.create_account("air", &seed, &birthday, None)?;    // seed stays age-encrypted at rest
// sync: update_chain_tip → suggest_scan_ranges (Verify first) → get_block_range into FsBlockDb → scan_cached_blocks → on Continuity truncate_to_height → transaction_data_requests → decrypt_and_store_transaction
let request = TransactionRequest::from_uri(uri)?;                            // ZIP-321, or Payment::without_memo
let proposal = propose_transfer(&mut db, &params, account, &GreedyInputSelector::new(), &change, request, ConfirmationsPolicy::default(), &SpendPolicy::default(), None, None)?;
// exec only: create_proposed_transactions(&mut db, &params, &SystemClock, &mut OsRng, &prover, &prover, &SpendingKeys::from_unified_spending_key(usk), OvkPolicy::Sender, &proposal, None)? → send_transaction(RawTransaction{..})
```

## Rules

1. The agent never gets a `send`. `air-zec exec` runs as the `zcash` system user and
   refuses without a claimable nonce from `POST /api/wallet/zcash/exec-claim`.
2. The proposal hash is recomputed at exec; any drift → stop, report `expired`.
3. Memo text never reaches Postgres (`memo_present` only). Addresses are shortened on
   cards (first 20 + last 6).
4. Broadcast ambiguity is terminal `uncertain`. Never re-execute.
5. ZIP-321: amount ≤ 8 decimals, memo base64url **without** padding, memo forbidden
   with transparent-only addresses, reject unknown `req-*` params.
6. Testnet by default; `ZCASH_LIVE_ENABLED` gates mainnet; never ship a `-pre` crate
   from git in the template — pin released versions.

## Install lines worth knowing

```bash
git clone https://github.com/zcash/zcash-devtool && cd zcash-devtool
cargo run --release --all-features -- wallet -w ../dev-wallet init --name Air -i ../dev-wallet/key.txt -n test -s zecrocks
cargo run --release --all-features -- wallet -w ../dev-wallet sync -s zecrocks
cargo run --release --all-features -- wallet -w ../dev-wallet list-addresses
cargo run --release --all-features -- wallet -w ../dev-wallet propose --address <utest1…> --value 1000000
```

No ecosystem agent skill exists for Zcash; this file is Air's.
