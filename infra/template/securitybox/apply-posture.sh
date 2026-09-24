#!/usr/bin/env bash
# securitybox posture apply — runs on the box (as uid=user, sudo).
# Idempotent. Failures exit nonzero; safe to re-run.
set -euo pipefail
PAYLOAD=${PAYLOAD_DIR:-/home/user/payload}

echo "== [1] users/groups =="
getent group airv >/dev/null || sudo groupadd -r airv
getent passwd airvault >/dev/null || sudo useradd -r -U -s /usr/sbin/nologin -d /var/lib/air-vaultd -m airvault
getent passwd airagent >/dev/null || sudo useradd -r -U -s /usr/sbin/nologin -d /home/user -M airagent
sudo usermod -aG airv user
sudo usermod -aG airv airagent

echo "== [2] vault custody =="
sudo mkdir -p /etc/air-vault /etc/aircell /var/lib/air-vaultd
# Split crown-jewel secrets out of ~/.hermes/.env -> /etc/air-vault/env
sudo python3 - <<'PY'
import os, re, pwd, grp
SRC = "/home/user/.hermes/.env"
DST = "/etc/air-vault/env"
# Only AIR_VAULT_KEY moves: it decrypts the vault store and is never needed
# by Hermes in-process. DAYTONA_API_KEY etc. STAY — the terminal env
# passthrough injects them for the agent deliberately (sandbox creds).
MOVE = {"AIR_VAULT_KEY"}
lines = open(SRC).read().splitlines()
moved, keep = [], []
for ln in lines:
    k = ln.split("=", 1)[0].strip()
    (moved if k in MOVE else keep).append(ln)
try:
    existing = open(DST).read().splitlines()
except FileNotFoundError:
    existing = []
seen = {l.split("=", 1)[0] for l in existing if "=" in l}
merged = existing + [l for l in moved if l.split("=", 1)[0] not in seen]
open("/tmp/.env.keep", "w").write("\n".join(keep) + "\n")
open("/tmp/.env.moved", "w").write("\n".join(merged) + "\n")
print("moved:", [l.split("=", 1)[0] for l in moved])
PY
sudo install -m 600 -o airvault -g airvault /tmp/.env.moved /etc/air-vault/env
install -m 600 -o user -g user /tmp/.env.keep /home/user/.hermes/.env
sudo rm -f /tmp/.env.keep /tmp/.env.moved
# cp signing pubkey (generated locally, installed by caller beforehand)
sudo install -m 644 "$PAYLOAD/cp-signing.pub" /etc/air-vault/cp-signing.pub
# store custody: airvault owns the vault tree; .inbox group airv writable.
# ~/.hermes is 0700 user — airvault gets traverse-only (--x) ACL so it can
# reach vault/ but cannot read/list anything else inside .hermes.
sudo mkdir -p /home/user/.hermes/vault/.inbox
sudo setfacl -R -b /home/user/.hermes   # clean slate; ACLs re-set below
sudo chown -R airvault:airvault /home/user/.hermes/vault
sudo chmod 700 /home/user/.hermes/vault
sudo chown airvault:airv /home/user/.hermes/vault/.inbox
sudo chmod 2770 /home/user/.hermes/vault/.inbox
sudo setfacl -m u:airvault:--x /home/user
sudo setfacl -m u:airvault:--x,m:--x /home/user/.hermes
sudo setfacl -d -m u:airvault:r /home/user/.hermes/vault/.inbox
sudo chmod 600 /home/user/.hermes/vault/store.enc 2>/dev/null || true
sudo chown airvault:airvault /home/user/.hermes/vault/store.enc 2>/dev/null || true
# daemon state dir (socket lives here — /run is tmpfs-masked inside the cell)
sudo mkdir -p /var/lib/air-vaultd
sudo chown airvault:airv /var/lib/air-vaultd
sudo chmod 2750 /var/lib/air-vaultd

echo "== [3] daemon + cli =="
sudo mkdir -p /usr/local/libexec
sudo install -m 755 "$PAYLOAD/air-vaultd.py" /usr/local/libexec/air-vaultd.py
sudo install -m 755 "$PAYLOAD/air-vault.sh" /usr/local/bin/air-vault
sudo install -m 644 "$PAYLOAD/air-vaultd.service" /etc/systemd/system/air-vaultd.service

echo "== [4] air-cell launcher =="
sudo gcc -O2 -o /usr/local/libexec/air-cell "$PAYLOAD/air-cell.c"
sudo chown root:root /usr/local/libexec/air-cell
sudo chmod 4755 /usr/local/libexec/air-cell
sudo install -m 644 "$PAYLOAD/mask.list" /etc/aircell/mask.list

echo "== [5] workspace ACLs =="
# airagent needs rwX on the workspace (~) except protected dirs (.hermes and
# credential-bearing dotdirs stay owner-only; the cell masks them too).
sudo setfacl -m u:airagent:rwx /home/user
sudo find /home/user \
  \( -path /home/user/.hermes -o -path /home/user/.ssh \
     -o -path /home/user/.aws -o -path /home/user/.docker \
     -o -path /home/user/.gnupg -o -path /home/user/.config/gh \) -prune \
  -o -print0 | sudo xargs -0 setfacl -m u:airagent:rwX 2>/dev/null || true
sudo find /home/user \
  \( -path "/home/user/.hermes*" -o -path "/home/user/.ssh*" \
     -o -path "/home/user/.aws*" -o -path "/home/user/.docker*" \
     -o -path "/home/user/.gnupg*" -o -path "/home/user/.config/gh*" \) -prune \
  -o -type d -print0 | sudo xargs -0 setfacl -m d:u:airagent:rwx 2>/dev/null || true

echo "== [6] hermes spawn patch =="
python3 "$PAYLOAD/patch_hermes.py"
python3 -m py_compile /home/user/hermes-agent/tools/environments/local.py \
                      /home/user/hermes-agent/tools/process_registry.py
echo "patch compiles OK"

echo "== [7] egress rules =="
sudo nft -f "$PAYLOAD/agent-egress.nft"
sudo install -m 644 "$PAYLOAD/agent-egress.nft" /etc/aircell/agent-egress.nft
sudo bash -c 'cat > /etc/systemd/system/aircell-egress.service <<UNIT
[Unit]
Description=aircell egress rules
After=network-pre.target
Before=network.target
[Service]
Type=oneshot
ExecStart=/usr/sbin/nft -f /etc/aircell/agent-egress.nft
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
UNIT'
sudo systemctl daemon-reload
sudo systemctl enable --now aircell-egress.service

echo "== [8] unit drop-ins =="
for u in taskrouter openviking air-learningd; do
  sudo mkdir -p /etc/systemd/system/$u.service.d
  sudo install -m 644 "$PAYLOAD/harden-loopback.conf" /etc/systemd/system/$u.service.d/aircell.conf
done
for u in hermes-gateway hermes-dashboard; do
  sudo mkdir -p /etc/systemd/system/$u.service.d
  sudo install -m 644 "$PAYLOAD/harden-gateway.conf" /etc/systemd/system/$u.service.d/aircell.conf
done

echo "== [9] restart =="
sudo systemctl daemon-reload
sudo systemctl enable --now air-vaultd.service
sudo systemctl restart taskrouter openviking air-learningd || true
sudo systemctl restart hermes-gateway
sudo systemctl restart hermes-dashboard
sleep 3
systemctl is-active air-vaultd hermes-gateway hermes-dashboard taskrouter | tr '\n' ' '
echo

echo "== [10] smoke =="
air-vault list --masked | head -5 || echo "list returned nonzero (empty vault ok)"
sudo -u airvault test -r /home/user/.hermes/vault && echo "airvault reaches vault dir" || echo "WARN: airvault cannot reach vault dir"
ls -la /etc/air-vault/env /home/user/.hermes/vault 2>/dev/null | head
sudo -n -u airagent true 2>&1 | head -2 || true
/usr/local/libexec/air-cell -- id | head -3 || true
echo "APPLY COMPLETE"
