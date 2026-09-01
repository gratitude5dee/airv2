#!/usr/bin/env bash
# air 2.0 — post-sync health gate. Scripted version of the UPGRADE.md §6
# verify list: runs on the box after sync-box.sh and exits non-zero if any
# baseline check fails, so fleet sync only records a box as converged when
# it is actually healthy. Prints one PASS/FAIL line per check.
set -uo pipefail

HOME_DIR="${HOME:-/home/user}"
FAILED=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS $name"
  else
    echo "FAIL $name"
    FAILED=1
  fi
}

check "soul-identity" grep -q '^## You are air' "$HOME_DIR/.hermes/SOUL.md"
check "air-vault" command -v air-vault
check "open-miniapp-card" command -v open-miniapp-card
check "box-browser-use" command -v box-browser-use
check "link-cli" test -x "$HOME_DIR/.hermes/node/bin/link-cli"
# Present for everyone, active only for boxes whose owner connected
# 1Password (OP_SERVICE_ACCOUNT_TOKEN); `op --version` reads no credential.
check "op-cli" op --version
check "skill-air-onboarding" test -f "$HOME_DIR/.hermes/skills/air-onboarding/SKILL.md"
check "skill-open-miniapp" test -f "$HOME_DIR/.hermes/skills/open-miniapp/SKILL.md"
check "plugin-creative" test -d "$HOME_DIR/.hermes/plugins/creative"
check "plugin-air-vault" test -d "$HOME_DIR/.hermes/plugins/air-vault"
check "unit-hermes-gateway" systemctl is-active --quiet hermes-gateway
check "unit-hermes-dashboard" systemctl is-active --quiet hermes-dashboard
check "unit-hermes-host" systemctl is-active --quiet hermes-host

gateway_health() {
  for _ in 1 2 3 4 5 6; do
    if curl -fsS -o /dev/null "http://127.0.0.1:8642/health"; then
      return 0
    fi
    sleep 5
  done
  return 1
}
check "gateway-health" gateway_health

dashboard_health() {
  curl -fsS -o /dev/null "http://127.0.0.1:9119/api/health"
}
check "dashboard-health" dashboard_health

if [ "$FAILED" -ne 0 ]; then
  echo "verify-box: FAILED" >&2
  exit 1
fi
echo "verify-box: OK"
