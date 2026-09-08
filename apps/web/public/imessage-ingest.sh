#!/bin/bash
# WZRD Air — iMessage history ingest (run on YOUR Mac).
#
# Reads your local iMessage database (~/Library/Messages/chat.db — the only
# place your history exists) and uploads recent text messages to your own
# agent's computer. Nothing is stored on the platform's shared database.
#
# Usage:  curl -fsSL https://app.wzrd.tech/imessage-ingest.sh | bash -s -- <UPLOAD_TICKET> [DAYS] [SINCE_ISO_UTC]
#
# Requirements: macOS, Terminal granted Full Disk Access
# (System Settings → Privacy & Security → Full Disk Access → Terminal).
set -euo pipefail

TICKET="${1:-}"
DAYS="${2:-365}"
SINCE="${3:-}"
ENDPOINT="${AIR_INGEST_ENDPOINT:-https://app.wzrd.tech/api/me/imessage-history}"
DB="$HOME/Library/Messages/chat.db"

if [ -z "$TICKET" ]; then
  echo "usage: imessage-ingest.sh <UPLOAD_TICKET> [DAYS] [SINCE_ISO_UTC]" >&2
  exit 1
fi
if ! [[ "$DAYS" =~ ^[1-9][0-9]{0,4}$ ]]; then
  echo "DAYS must be a positive whole number (1–99999)." >&2
  exit 1
fi
SINCE_SECONDS="$(/usr/bin/python3 - "$SINCE" <<'CURSORPY'
import datetime, sys
value = sys.argv[1]
if not value:
    print(0)
else:
    try:
        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("timezone required")
        seconds = int(parsed.timestamp())
        if seconds < 0:
            raise ValueError("timestamp before 1970")
        print(seconds)
    except (ValueError, OverflowError):
        raise SystemExit("SINCE must be an ISO timestamp with timezone, e.g. 2026-09-01T12:00:00Z.")
CURSORPY
)"
if [ "$(uname)" != "Darwin" ]; then
  echo "This script reads the macOS Messages database — run it on your Mac." >&2
  exit 1
fi
if [ ! -r "$DB" ]; then
  echo "Cannot read $DB — grant Terminal Full Disk Access (System Settings → Privacy & Security), then retry." >&2
  exit 1
fi

TMP="$(mktemp)"
DECODER="$(mktemp)"
CATALOGUE="$(mktemp)"
trap 'rm -f "$TMP" "$DECODER" "$CATALOGUE"' EXIT
curl -fsSL "${ENDPOINT%/api/me/imessage-history}/vendor/pytypedstream-0.1.0-py3-none-any.whl" -o "$DECODER"

# Apple stores message.date as nanoseconds since 2001-01-01.
sqlite3 -json "file:$DB?mode=ro" "
  SELECT
    m.guid AS id,
    COALESCE(c.guid, c.chat_identifier, h.id, 'unknown') AS chat_id,
    datetime(m.date/1000000000 + strftime('%s','2001-01-01'), 'unixepoch') AS ts,
    COALESCE(c.display_name, c.chat_identifier, '') AS chat,
    COALESCE(h.id, 'me') AS sender,
    m.is_from_me AS is_from_me,
    m.text AS text,
    hex(m.attributedBody) AS attributed_body
  FROM message m
  LEFT JOIN handle h ON h.ROWID = m.handle_id
  LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
  LEFT JOIN chat c ON c.ROWID = cmj.chat_id
  WHERE ((m.text IS NOT NULL AND m.text != '') OR m.attributedBody IS NOT NULL)
    AND m.date/1000000000 + strftime('%s','2001-01-01') > strftime('%s','now') - ${DAYS}*86400
    AND m.date/1000000000 + strftime('%s','2001-01-01') >= ${SINCE_SECONDS}
  ORDER BY m.date ASC, m.ROWID ASC;
" > "$TMP"

# Include identities outside the selected date window for legacy migration.
sqlite3 -json "file:$DB?mode=ro" "
  SELECT DISTINCT
    COALESCE(c.guid, c.chat_identifier, h.id, 'unknown') AS id,
    COALESCE(c.display_name, c.chat_identifier, '') AS label
  FROM message m
  LEFT JOIN handle h ON h.ROWID = m.handle_id
  LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
  LEFT JOIN chat c ON c.ROWID = cmj.chat_id
  ORDER BY id, label;
" > "$CATALOGUE"

/usr/bin/python3 - "$TMP" "$ENDPOINT" "$TICKET" "$DAYS" "$DECODER" "$CATALOGUE" <<'PYEOF'
import hashlib, json, sys, time, urllib.error, urllib.request

rows_path, endpoint, ticket, days = sys.argv[1:5]
if len(sys.argv) > 5:
    with open(sys.argv[5], "rb") as decoder:
        if hashlib.sha256(decoder.read()).hexdigest() != "499920d4cb8bec8fd9d9cdd4c6312765eb418c398c10371ab1c9c0051104d278":
            raise SystemExit("Decoder checksum mismatch; nothing uploaded.")
    sys.path.insert(0, sys.argv[5])

def message_text(row):
    if row.get("text"):
        return row["text"]
    if not row.get("attributed_body"):
        return ""
    try:
        from typedstream import unarchive_from_data
        from typedstream.archiving import TypedValue
        from typedstream.types.foundation import NSString
        archive = unarchive_from_data(bytes.fromhex(row["attributed_body"]))
        if archive.clazz.name not in (b"NSAttributedString", b"NSMutableAttributedString"):
            raise ValueError("unexpected archive type")
        for field in archive.contents:
            value = field.value if isinstance(field, TypedValue) else None
            if isinstance(value, NSString):
                return value.value
        raise ValueError("missing string")
    except Exception:
        raise SystemExit("A message body could not be decoded; nothing uploaded. Keep the database and report this error.") from None
with open(rows_path) as f:
    raw = f.read().strip()
rows = json.loads(raw) if raw else []
if not rows:
    print("No messages found in the selected window — nothing uploaded.")
    sys.exit(0)

messages = [
    {
        "id": r.get("id") or "",
        "chat_id": r.get("chat_id") or "",
        "ts": r.get("ts") or "",
        "chat": r.get("chat") or "",
        "from": ("me" if r.get("is_from_me") else (r.get("sender") or "")),
        "is_from_me": bool(r.get("is_from_me")),
        "text": message_text(r),
    }
    for r in rows
]

MAX_MESSAGES = 20000
MAX_BYTES = 4 * 1024 * 1024

def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

catalogue_field = b""
if len(sys.argv) > 6:
    with open(sys.argv[6]) as catalogue_file:
        catalogue = json.loads(catalogue_file.read().strip() or "[]")
    if len(catalogue) > 20000 or any(not isinstance(t.get("id"), str) or not t["id"] or not isinstance(t.get("label"), str) for t in catalogue):
        raise SystemExit("Invalid or oversized thread catalogue; nothing uploaded.")
    catalogue_field = b',"threads":' + encode(catalogue)

def envelope(first, last):
    return b'{"messages":[' , b'],"from_date":' + encode(first["ts"]) + b',"to_date":' + encode(last["ts"]) + catalogue_field + b'}'

# Validate every individual row before uploading anything; never silently
# truncate or skip a message which cannot fit in the server's byte budget.
encoded = [encode(message) for message in messages]
for message, data in zip(messages, encoded):
    prefix, suffix = envelope(message, message)
    if len(prefix) + len(data) + len(suffix) > MAX_BYTES:
        raise SystemExit("A message exceeds the upload byte limit; nothing uploaded.")

def chunks():
    start = 0
    size = 0
    for i, data in enumerate(encoded):
        prefix, suffix = envelope(messages[start], messages[i])
        proposed = size + len(data) + (1 if i > start else 0)
        if i > start and (i - start >= MAX_MESSAGES or len(prefix) + proposed + len(suffix) > MAX_BYTES):
            yield start, i
            start, size = i, 0
        size += len(data) + (1 if i > start else 0)
    yield start, len(messages)

# Failure envelope from the server: {error, code, retriable, retry_after_seconds?, resolve_at?}.
# Retriable failures (archive busy, box starting, transient upload failure)
# are retried with bounded backoff; anything else stops with the reason and
# the cursor to resume from. Network errors are treated as retriable.
MAX_ATTEMPTS = 8
MAX_WAIT_SECONDS = 120

def parse_error(status, raw):
    try:
        doc = json.loads(raw) if raw else {}
    except ValueError:
        doc = {}
    if not isinstance(doc, dict):
        doc = {}
    return {
        "status": status,
        "code": doc.get("code") if isinstance(doc.get("code"), str) else "http_%d" % status,
        "error": doc.get("error") if isinstance(doc.get("error"), str) else "HTTP %d" % status,
        "retriable": doc.get("retriable") is True or status in (502, 503, 504),
        "retry_after": doc.get("retry_after_seconds") if isinstance(doc.get("retry_after_seconds"), (int, float)) else None,
        "resolve_at": doc.get("resolve_at") if isinstance(doc.get("resolve_at"), str) else None,
    }

def post(body):
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ticket}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp), None
    except urllib.error.HTTPError as http_error:
        return None, parse_error(http_error.code, http_error.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, OSError, ValueError) as network_error:
        return None, {"status": 0, "code": "network", "error": str(network_error) or "network error",
                      "retriable": True, "retry_after": None, "resolve_at": None}

def wait_seconds(failure, attempt):
    if failure["retry_after"] is not None:
        wait = float(failure["retry_after"])
    else:
        wait = 2.0 * (2 ** (attempt - 1))
    return min(max(wait, 1.0), MAX_WAIT_SECONDS)

def stop(failure, cursor, uploaded):
    lines = [f"Upload stopped ({failure['code']}): {failure['error']}"]
    if failure["code"] == "resolution_required" and failure["resolve_at"]:
        lines.append(f"Resolve the pending chat identities here (signed in): {failure['resolve_at']}")
    if uploaded:
        lines.append(f"{uploaded} messages were saved before stopping.")
    if cursor:
        lines.append(f"Archive cursor: {cursor} — a fresh command from the app resumes there automatically.")
    raise SystemExit("\n".join(lines))

def upload(body, cursor, uploaded):
    for attempt in range(1, MAX_ATTEMPTS + 1):
        result, failure = post(body)
        if failure is None:
            return result
        if not failure["retriable"] or attempt == MAX_ATTEMPTS:
            if failure["retriable"]:
                failure = dict(failure, error=f"{failure['error']} (gave up after {MAX_ATTEMPTS} attempts)")
            stop(failure, cursor, uploaded)
        wait = wait_seconds(failure, attempt)
        print(f"Retrying in {wait:.0f}s ({failure['code']}): {failure['error']}", file=sys.stderr)
        time.sleep(wait)

total = 0
cursor = None
for start, end in chunks():
    prefix, suffix = envelope(messages[start], messages[end - 1])
    body = prefix + b",".join(encoded[start:end]) + suffix
    result = upload(body, cursor, total)
    if isinstance(result, dict) and isinstance(result.get("cursor"), str):
        cursor = result["cursor"]
    total += end - start
    print(f"Uploaded {total}/{len(messages)} messages…")

print(f"Done — {total} messages from the last {days} days are on your agent's computer.")
if cursor:
    print(f"Archive cursor: {cursor} (the next command from the app resumes here automatically).")
PYEOF
