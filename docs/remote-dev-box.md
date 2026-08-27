# A bare Box as a remote dev machine

Sometimes you want a plain Ubuntu VM on Box — no Hermes, no template — that you
SSH into from your laptop or point an external agent/editor at. Box supports
this directly: every box runs OpenSSH on port 22 as user `user`, and
`POST /boxes/{id}/sshkey` authorizes a public key on it.

All commands below use `infra/template/boxctl.sh` with `BOX_API_KEY` exported.
Keep that key on your machine — never put it in a box's `env`.

## 1. Create the box

```bash
./boxctl.sh create codex-dev          # prints the create envelope, then the id
./boxctl.sh wait bx_xxxxxxxx          # -> ready|idle
```

`create` defaults to `{"type":"default","ttlSeconds":null,"noEnv":true}`:
4 vCPU / 8 GB, no auto-stop, and none of your account's secrets or credentials
attached. Pass your own body as the third argument to change that.

## 2. Authorize a key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/box_dev -C box-dev
./boxctl.sh sshkey bx_xxxxxxxx ~/.ssh/box_dev.pub
./boxctl.sh ip bx_xxxxxxxx             # the machine's public IPv4
ssh -i ~/.ssh/box_dev user@<ip>
```

The key lands in `/home/user/.ssh/authorized_keys`, so it is captured by
snapshots and survives stop/resume.

## 3. Make sshd survive resume

The base image ships sshd socket-activated but with the unit *disabled*, so a
resumed box would come back without it. Enable it once:

```bash
./boxctl.sh cmd bx_xxxxxxxx "sudo systemctl enable ssh.socket ssh.service"
```

Stop/resume is a reboot: enabled units come back, hand-started processes and
`host`-exposed ports do not (§5.2 of ARCHITECTURE.md).

## 4. After a resume

The public IP is per-machine, not per-box — a resumed box usually comes back on
a different address. Re-read it and reconnect:

```bash
./boxctl.sh resume bx_xxxxxxxx && ./boxctl.sh wait bx_xxxxxxxx
./boxctl.sh ip bx_xxxxxxxx
```

For a stable *hostname* you need `host <port> --private`, which is HTTPS-only
and does not carry SSH. If you want a fixed address for SSH, join the box to a
tailnet instead (see `apps/web/lib/box/tailscale.ts`).

The base image already has git, gh, node 24, npm, python 3.12, uv, cargo,
docker, ripgrep, and the `codex` and `claude` CLIs.
