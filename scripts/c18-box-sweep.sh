#!/usr/bin/env bash
# V8 hardening item 1 — the production-shaped half of the C18 sweep.
#
# The CI half (apps/web/lib/security/c18-sweep.test.ts) gates the shapes;
# this runbook greps the real surfaces against a production-shaped account
# that has exercised every V1–V6 path (vault add/reveal/fill, calendar
# invite + sync, social automation, shopping fill, bots). Run each section
# where that surface lives; zero hits or the wave doesn't ship.
#
# Usage:
#   1. Load the account with known planted values (a password, a PAN+CVV,
#      a TOTP seed, an API key, a note body) and exercise every path.
#   2. Export them here — values never go on a command line in prod shells
#      with shared history; use a throwaway session.
#        export C18_PLANTED='hunter2-... 4929... 83521 JBSWY3... sk-...'
#   3. Run the sections below and attach the output to the wave exit review.
set -euo pipefail

if [[ -z "${C18_PLANTED:-}" ]]; then
  echo "C18_PLANTED is required: space-separated planted values" >&2
  exit 2
fi

fail=0
sweep() {
  local name="$1" text="$2"
  local hits=0
  for value in ${C18_PLANTED}; do
    if grep -qF -- "${value}" <<<"${text}"; then
      echo "C18 HIT [${name}]: planted value present" >&2
      hits=1
      fail=1
    fi
  done
  [[ "${hits}" -eq 0 ]] && echo "C18 ok [${name}]"
}

# ── 1. Box filesystem, minus the encrypted store ─────────────────────────────
# Run INSIDE the account's box (Box API `command`, never a shell the browser
# can reach). store.enc is the one file allowed to contain the values —
# encrypted; everything else must be clean, including Hermes sessions,
# run events, and skill state.
if [[ "${C18_SWEEP_BOX_FS:-0}" == "1" ]]; then
  matches=$(grep -rIlF \
    --exclude='store.enc' \
    --exclude-dir='.git' \
    -e "${C18_PLANTED%% *}" \
    "${HOME}" 2>/dev/null || true)
  for value in ${C18_PLANTED}; do
    found=$(grep -rIlF --exclude='store.enc' --exclude-dir='.git' \
      -e "${value}" "${HOME}" 2>/dev/null || true)
    matches="${matches}${found:+$'\n'}${found}"
  done
  if [[ -n "${matches}" ]]; then
    echo "C18 HIT [box-fs]:" >&2
    echo "${matches}" | sort -u >&2
    fail=1
  else
    echo "C18 ok [box-fs]"
  fi
fi

# ── 2. Postgres row dump ─────────────────────────────────────────────────────
# Feed a full dump of the account's rows (every wave table + decisions +
# agent_runs) on stdin:  psql ... -c "copy (...) to stdout" | C18_SECTION=pg …
if [[ "${C18_SECTION:-}" == "pg" || "${C18_SECTION:-}" == "logs" || "${C18_SECTION:-}" == "sse" ]]; then
  sweep "${C18_SECTION}" "$(cat)"
fi

# ── 3. Vercel logs ───────────────────────────────────────────────────────────
#   vercel logs <deployment> --since 1d | C18_SECTION=logs scripts/c18-box-sweep.sh
# ── 4. SSE captures ─────────────────────────────────────────────────────────
# Capture the client-side EventSource transcript for a chat turn that
# touched the vault (browser devtools → copy response), then:
#   C18_SECTION=sse scripts/c18-box-sweep.sh < capture.txt

exit "${fail}"
