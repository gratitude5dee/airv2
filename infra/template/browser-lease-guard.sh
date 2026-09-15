#!/usr/bin/env bash
# Fail closed when an owner holds a checkout browser-control lease.
set -euo pipefail

ENV_FILE="${AIR_HERMES_ENV_FILE:-${HOME:-/home/user}/.hermes/.env}"
CURL_BIN="${AIR_LEASE_GUARD_CURL_BIN:-curl}"
base="${AIR_LEASE_GUARD_BASE_URL:-}"
token="${AIR_LEASE_GUARD_TOKEN:-}"
if [ -z "$base" ] && [ -f "$ENV_FILE" ]; then
  base="$(grep -m1 '^OPENAI_BASE_URL=' "$ENV_FILE" | cut -d= -f2- || true)"
fi
if [ -z "$token" ] && [ -f "$ENV_FILE" ]; then
  token="$(grep -m1 '^OPENAI_API_KEY=' "$ENV_FILE" | cut -d= -f2- || true)"
fi
if [ -z "$base" ] || [ -z "$token" ]; then
  echo "Browser input paused: checkout control guard is unavailable." >&2
  exit 75
fi

endpoint="${base%/api/gateway/v1}/api/checkout/handoff?active_human_control=1"
response="$($CURL_BIN -fsS --max-time 4 "$endpoint" \
  -H "Authorization: Bearer $token" 2>/dev/null)" || {
  echo "Browser input paused: checkout control guard could not be verified." >&2
  exit 75
}
if grep -Eq '"active"[[:space:]]*:[[:space:]]*false' <<<"$response"; then
  exit 0
fi
if grep -Eq '"active"[[:space:]]*:[[:space:]]*true' <<<"$response"; then
  echo "Browser input paused: the owner currently controls this browser." >&2
  exit 75
fi
echo "Browser input paused: checkout control guard returned an invalid response." >&2
exit 75
