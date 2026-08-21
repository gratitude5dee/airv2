#!/bin/bash
# WZRD Air — iMessage history ingest (run on YOUR Mac).
#
# Reads your local iMessage database (~/Library/Messages/chat.db — the only
# place your history exists) and uploads recent text messages to your own
# agent's computer. Nothing is stored on the platform's shared database.
#
# Usage:  curl -fsSL https://app.wzrd.tech/imessage-ingest.sh | bash -s -- <UPLOAD_TICKET> [DAYS]
#
# Requirements: macOS, Terminal granted Full Disk Access
# (System Settings → Privacy & Security → Full Disk Access → Terminal).
set -euo pipefail

TICKET="${1:-}"
DAYS="${2:-90}"
ENDPOINT="${AIR_INGEST_ENDPOINT:-https://app.wzrd.tech/api/me/imessage-history}"
DB="$HOME/Library/Messages/chat.db"

if [ -z "$TICKET" ]; then
  echo "usage: imessage-ingest.sh <UPLOAD_TICKET> [DAYS]" >&2
  exit 1
fi
if [ "$(uname)" != "Darwin" ]; then
  echo "This script reads the macOS Messages database — run it on your Mac." >&2
  exit 1
fi
if [ ! -r "$DB" ]; then
  echo "Cannot read $DB — grant Terminal Full Disk Access (System Settings → Privacy & Security), then retry." >&2
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Apple stores message.date as nanoseconds since 2001-01-01.
sqlite3 -json "file:$DB?mode=ro" "
  SELECT
    datetime(m.date/1000000000 + strftime('%s','2001-01-01'), 'unixepoch') AS ts,
    COALESCE(c.display_name, c.chat_identifier, '') AS chat,
    COALESCE(h.id, 'me') AS sender,
    m.is_from_me AS is_from_me,
    m.text AS text
  FROM message m
  LEFT JOIN handle h ON h.ROWID = m.handle_id
  LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
  LEFT JOIN chat c ON c.ROWID = cmj.chat_id
  WHERE m.text IS NOT NULL AND m.text != ''
    AND m.date/1000000000 + strftime('%s','2001-01-01') > strftime('%s','now') - ${DAYS}*86400
  ORDER BY m.date ASC;
" > "$TMP"

/usr/bin/python3 - "$TMP" "$ENDPOINT" "$TICKET" "$DAYS" <<'PYEOF'
import json, sys, urllib.request

rows_path, endpoint, ticket, days = sys.argv[1:5]
with open(rows_path) as f:
    raw = f.read().strip()
rows = json.loads(raw) if raw else []
if not rows:
    print("No messages found in the selected window — nothing uploaded.")
    sys.exit(0)

messages = [
    {
        "ts": r.get("ts") or "",
        "chat": r.get("chat") or "",
        "from": ("me" if r.get("is_from_me") else (r.get("sender") or "")),
        "is_from_me": bool(r.get("is_from_me")),
        "text": r.get("text") or "",
    }
    for r in rows
]

CHUNK = 20000
total = 0
for i in range(0, len(messages), CHUNK):
    part = messages[i : i + CHUNK]
    body = json.dumps(
        {
            "messages": part,
            "from_date": part[0]["ts"],
            "to_date": part[-1]["ts"],
        }
    ).encode()
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ticket}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        json.load(resp)
    total += len(part)
    print(f"Uploaded {total}/{len(messages)} messages…")

print(f"Done — {total} messages from the last {days} days are on your agent's computer.")
PYEOF
