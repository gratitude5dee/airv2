#!/usr/bin/env bash
# air-vault — thin UDS client for air-vaultd (privilege-separated vault).
# Same argv contract as before; secrets never travel in argv.
# Lease guard preserved for browser-fill verbs (owner must hold the lease).
set -euo pipefail
SOCK=/var/lib/air-vaultd/air-vaultd.sock

# Fill verbs route through the lease guard when present (template-dependent).
if [ -x /usr/local/bin/air-browser-lease-guard ]; then
  case "${1:-}" in
    type|op-fill)
      /usr/local/bin/air-browser-lease-guard "$@" ;;
    totp)
      for a in "$@"; do
        if [ "$a" = "--type" ]; then
          /usr/local/bin/air-browser-lease-guard "$@"
          break
        fi
      done ;;
  esac
fi

export __AV_ARGV_JSON="$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1:]))' "$@")"
exec /home/user/.hermes-venv/bin/python - "$SOCK" <<'PYEOF'
import json, os, socket, sys
sock_path = sys.argv[1]
argv = json.loads(os.environ["__AV_ARGV_JSON"])
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
try:
    s.connect(sock_path)
except OSError as e:
    sys.stderr.write(json.dumps({"error": "daemon_unreachable", "message": str(e)}) + "\n")
    sys.exit(2)
s.sendall(json.dumps({"argv": argv}).encode() + b"\n")
s.shutdown(socket.SHUT_WR)
buf = b""
while True:
    chunk = s.recv(1 << 16)
    if not chunk:
        break
    buf += chunk
res = json.loads(buf.decode())
sys.stdout.write(res.get("out", ""))
sys.stderr.write(res.get("err", ""))
sys.exit(res.get("rc", 2))
PYEOF
