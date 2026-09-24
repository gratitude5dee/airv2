# securitybox posture payload

Mirror of the files applied to the eval box `securitybox` (bx_vur3f6mn).
This is eval scaffolding for the privacy-spec posture, NOT template-shipped
code yet — do not wire into setup.sh without review.

- `apply-posture.sh` — idempotent provisioner (users/groups, vault custody,
  daemon, cell build, ACLs, hermes spawn patch, nft, unit drop-ins).
- `air-vaultd.py/.service` — UDS daemon; per-verb + per-uid/cgroup policy;
  restricted verbs need an ed25519 `--cap` (cap-v1|argv|nonce|exp).
- `air-vault.sh` — replacement `/usr/local/bin/air-vault` (thin UDS client).
- `air-cell.c` — setuid launcher: mount-ns masking while root, then real
  uid=airagent + no_new_privs. Build: `gcc -O2 -o air-cell air-cell.c`
  (dynamic — static NSS segfaults).
- `patch_hermes.py` — eval-only Hermes patch: routes shell spawns through
  air-cell + daemon-mode vault_source fetch. Upstream hook deferred (D1).
- `agent-egress.nft` — drops cell-uid (airagent) traffic to loopback
  control planes + link-local.
- `verify-posture.sh` — 22-check posture suite.
- `cp-signing.pub` — NOT committed: it's the eval box's mock CP signer.
  Production signs caps in the control plane (D2); install the real pubkey
  before `apply-posture.sh` step 2.
