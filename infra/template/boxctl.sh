#!/usr/bin/env bash
# Thin operator helper around the Box API for template builds.
# Usage: BOX_API_KEY=... ./boxctl.sh <cmd> <boxId> [args...]
set -euo pipefail
BASE="${BOX_API_BASE:-https://ascii.dev/api/box/v1}"
auth=(-H "Authorization: Bearer ${BOX_API_KEY}" -H "Content-Type: application/json")

case "$1" in
  get)   curl -sS "${auth[@]}" "$BASE/boxes/$2" ;;
  wait)  # wait for ready/idle
    for _ in $(seq 1 120); do
      state=$(curl -sS "${auth[@]}" "$BASE/boxes/$2" | python3 -c 'import sys,json;print(json.load(sys.stdin)["box"]["state"])')
      echo "state=$state" >&2
      case "$state" in ready|idle) echo "$state"; exit 0 ;; error) echo error; exit 1 ;; esac
      sleep 5
    done; echo timeout; exit 1 ;;
  cmd)   # cmd <boxId> <command> [timeoutSeconds]
    python3 - "$2" "$3" "${4:-60}" <<'PY'
import json, os, sys, urllib.request
base = os.environ.get("BOX_API_BASE", "https://ascii.dev/api/box/v1")
box_id, command, timeout = sys.argv[1], sys.argv[2], int(sys.argv[3])
req = urllib.request.Request(
    f"{base}/boxes/{box_id}/commands",
    data=json.dumps({"command": command, "timeoutSeconds": timeout}).encode(),
    headers={"Authorization": f"Bearer {os.environ['BOX_API_KEY']}",
             "Content-Type": "application/json"},
    method="POST")
with urllib.request.urlopen(req, timeout=timeout + 30) as resp:
    body = json.load(resp)
print(body.get("stdout", ""))
if body.get("stderr"):
    print("--- stderr ---", file=sys.stderr)
    print(body["stderr"], file=sys.stderr)
sys.exit(0 if body.get("exitCode") == 0 else 1)
PY
    ;;
  stop)   curl -sS -X POST "${auth[@]}" "$BASE/boxes/$2/stop" ;;
  resume) curl -sS -X POST "${auth[@]}" "$BASE/boxes/$2/resume" ;;
  fork)   curl -sS -X POST "${auth[@]}" "$BASE/boxes/$2/fork" -d "${3:-{\"noEnv\":true}}" ;;
  *) echo "unknown command: $1" >&2; exit 2 ;;
esac
