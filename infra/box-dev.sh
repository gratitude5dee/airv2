#!/usr/bin/env bash
# Operate a personal Box as an SSH dev machine, with idle spin-down.
#
# Box's own auto-stop TTL counts from start, not from last use, and a box's
# in-box token cannot stop the box (its scope is host/lux only) — so idleness
# has to be judged from the machine that connects. This script does that:
# keep the TTL short and push it out only while an SSH connection is open.
# When you stop connecting, the TTL lapses, Box archives the box and snapshots
# it, and `up` brings that exact filesystem back.
#
#   BOX_API_KEY=... BOX_DEV_ID=bx_xxxxxxxx ./box-dev.sh <cmd>
#
#   up         resume if needed, re-authorize the key, extend, print user@ip
#   ip         current public IPv4 (empty when archived)
#   keepalive  extend the TTL iff an SSH connection to the box is established;
#              run from cron/launchd every few minutes
#   down       stop and snapshot now
#   status     one line of state/ip/archiveAfter
#
# Keep BOX_API_KEY on your machine. Never put it in the box's env.
set -euo pipefail

BASE="${BOX_API_BASE:-https://ascii.dev/api/box/v1}"
BOX="${BOX_DEV_ID:?set BOX_DEV_ID to the box id}"
KEY="${BOX_DEV_SSH_KEY:-$HOME/.ssh/codex_box_ed25519}"
# Seconds of headroom the TTL is pushed to on every keepalive tick. The box
# archives this long after the last tick that saw a live connection.
TTL="${BOX_DEV_IDLE_TTL:-3600}"
auth=(-H "Authorization: Bearer ${BOX_API_KEY:?set BOX_API_KEY}" -H "Content-Type: application/json")

get() { curl -sS "${auth[@]}" "$BASE/boxes/$BOX"; }
field() { python3 -c 'import sys,json;print(json.load(sys.stdin)["box"].get(sys.argv[1]) or "")' "$1"; }

extend() { curl -sS -X PATCH "${auth[@]}" "$BASE/boxes/$BOX" -d "{\"ttlSeconds\":$TTL}" >/dev/null; }

# Is a local process holding an SSH connection to the box right now? macOS has
# lsof, Linux boxes may only have ss; netstat prints host.port, not host:port.
ssh_connected() {
  local ip="$1"
  command -v lsof >/dev/null 2>&1 &&
    lsof -nP -iTCP -sTCP:ESTABLISHED 2>/dev/null | grep -q "$ip:22" && return 0
  command -v ss >/dev/null 2>&1 &&
    ss -tn state established 2>/dev/null | grep -q "$ip:22" && return 0
  netstat -an 2>/dev/null | grep ESTABLISHED | grep -qE "$ip[.:]22" && return 0
  return 1
}

wait_ready() {
  for _ in $(seq 1 60); do
    state=$(get | field state)
    case "$state" in
      ready|idle) echo "$state" >&2; return 0 ;;
      error) echo "box entered error state" >&2; return 1 ;;
    esac
    sleep 5
  done
  echo "timed out waiting for $BOX" >&2; return 1
}

case "${1:-status}" in
  up)
    state=$(get | field state)
    case "$state" in
      archived|archiving|stopped) curl -sS -X POST "${auth[@]}" "$BASE/boxes/$BOX/resume" -d "{\"ttlSeconds\":$TTL}" >/dev/null ;;
    esac
    wait_ready
    extend
    # authorized_keys rides the snapshot, but re-posting is idempotent and
    # covers a box restored from an older snapshot.
    curl -sS -X POST "${auth[@]}" "$BASE/boxes/$BOX/sshkey" \
      -d "$(python3 -c 'import json,sys;print(json.dumps({"key":open(sys.argv[1]).read().strip()}))' "$KEY.pub")" >/dev/null
    echo "user@$(get | field ip)"
    ;;
  ip) get | field ip ;;
  keepalive)
    ip=$(get | field ip)
    [ -n "$ip" ] || exit 0
    if ssh_connected "$ip"; then
      extend
      echo "extended: ttl=${TTL}s"
    fi
    ;;
  down)
    # Never force: a refused stop means the snapshot is failing (C6).
    curl -sS -X POST "${auth[@]}" "$BASE/boxes/$BOX/stop" >/dev/null
    for _ in $(seq 1 60); do
      state=$(get | field state)
      [ "$state" = "archived" ] && break
      sleep 5
    done
    echo "$state" ;;
  status) get | python3 -c 'import sys,json;b=json.load(sys.stdin)["box"];print(b["state"], b.get("ip") or "-", "archiveAfter="+str(b.get("archiveAfter")), "snapshot="+str(b.get("lastSnapshotStatus")))' ;;
  *) echo "unknown command: $1" >&2; exit 2 ;;
esac
