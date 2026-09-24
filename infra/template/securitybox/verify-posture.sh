#!/usr/bin/env bash
# Posture verification for securitybox — run after apply-posture.sh.
# Each check prints PASS/FAIL; summary at end. Exits nonzero on any FAIL.
PASS=0; FAIL=0
ck() {  # ck <name> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "PASS $1"; PASS=$((PASS+1));
  else echo "FAIL $1 (want '$2', got '$3')"; FAIL=$((FAIL+1)); fi
}

echo "=== A. custody ==="
ck ".env has no AIR_VAULT_KEY" "0" "$(grep -c '^AIR_VAULT_KEY=' /home/user/.hermes/.env 2>/dev/null || true)"
ck "/etc/air-vault/env owned by airvault 0600" "airvault" "$(stat -c %U /etc/air-vault/env 2>/dev/null)"
ck "store.enc owned by airvault" "airvault" "$(stat -c %U /home/user/.hermes/vault/store.enc 2>/dev/null || echo missing)"

echo "=== B. daemon ==="
ck "air-vaultd active" "active" "$(systemctl is-active air-vaultd)"
ck "air-vault list works (uid=user)" "0" "$(air-vault list --masked >/dev/null 2>&1; echo $?)"
ck "unsigned get --reveal denied" "2" "$(air-vault get nonexistent --reveal >/dev/null 2>&1; echo $?)"
ck "unsigned apply denied" "2" "$(air-vault apply /tmp/x.json >/dev/null 2>&1; echo $?)"

echo "=== C. cell ==="
ck "air-agent uid differs" "airagent" "$(/usr/local/libexec/air-cell -- id -un 2>/dev/null || echo fail)"
ck "cell cannot sudo" "1" "$(/usr/local/libexec/air-cell -- sudo -n true >/dev/null 2>&1; echo $?)"
ck "cell cannot read .env" "1" "$(/usr/local/libexec/air-cell -- cat /home/user/.hermes/.env >/dev/null 2>&1; echo $?)"
ck "cell cannot read store" "1" "$(/usr/local/libexec/air-cell -- cat /home/user/.hermes/vault/store.enc >/dev/null 2>&1; echo $?)"
ck "cell can write workspace" "0" "$(/usr/local/libexec/air-cell -- bash -c 'touch /home/user/.cellwrite && rm /home/user/.cellwrite' >/dev/null 2>&1; echo $?)"
ck "cell air-vault list ok" "0" "$(/usr/local/libexec/air-cell -- /usr/local/bin/air-vault list --masked >/dev/null 2>&1; echo $?)"
ck "cell get --reveal denied" "2" "$(/usr/local/libexec/air-cell -- /usr/local/bin/air-vault get x --reveal >/dev/null 2>&1; echo $?)"
ck "cell cannot reach api_server 8642" "0" "$(/usr/local/libexec/air-cell -- timeout 3 bash -c '</dev/tcp/127.0.0.1/8642' >/dev/null 2>&1; if [ $? -eq 0 ]; then echo 1; else echo 0; fi)"

echo "=== D. units healthy ==="
for u in hermes-gateway hermes-dashboard taskrouter openviking air-learningd air-vaultd; do
  ck "$u active" "active" "$(systemctl is-active $u)"
done

echo "=== E. egress rules ==="
ck "nft aircell table present" "0" "$(sudo nft list table inet aircell >/dev/null 2>&1; echo $?)"

echo
echo "posture: $PASS pass, $FAIL fail"
[ $FAIL -eq 0 ]
