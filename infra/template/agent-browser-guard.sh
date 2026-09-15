#!/usr/bin/env bash
# Guard Hermes' built-in browser_* transport before it reaches agent-browser.
set -euo pipefail

REAL="${AIR_AGENT_BROWSER_REAL:-${HOME:-/home/user}/.hermes/node/bin/agent-browser-air-real}"
GUARD="${AIR_BROWSER_LEASE_GUARD_BIN:-/usr/local/bin/air-browser-lease-guard}"
case "${1:-}" in
  install|--help|-h|--version|-V)
    exec "$REAL" "$@"
    ;;
esac
"$GUARD"
exec "$REAL" "$@"
