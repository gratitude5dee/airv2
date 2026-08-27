#!/bin/bash
# WZRD Air — import your existing agent context (run on YOUR machine).
#
# Packages your local Hermes profile (~/.hermes), Codex CLI sessions
# (~/.codex), and Claude Code sessions (~/.claude) — the layouts the
# codex-claude-transfer and DataMoat projects read — and uploads them to
# your own agent's computer. Secrets are excluded and obvious credentials
# are redacted before anything leaves this machine. Nothing is stored on
# the platform's shared database.
#
# Usage:  curl -fsSL https://app.wzrd.tech/agent-context-import.sh | bash -s -- <UPLOAD_TICKET>
#
# Requirements: macOS or Linux with python3.
set -euo pipefail

TICKET="${1:-}"
ENDPOINT="${AIR_IMPORT_ENDPOINT:-https://app.wzrd.tech/api/me/agent-context}"

if [ -z "$TICKET" ]; then
  echo "usage: agent-context-import.sh <UPLOAD_TICKET>" >&2
  exit 1
fi

/usr/bin/env python3 - "$ENDPOINT" "$TICKET" <<'PYEOF'
import json, os, re, sys, urllib.error, urllib.request

endpoint, ticket = sys.argv[1:3]
home = os.path.expanduser("~")

MAX_FILE_BYTES = 512 * 1024
MAX_CHUNK_BYTES = 3 * 1024 * 1024  # stay under the server's 4 MB cap
MAX_FILES_PER_CHUNK = 200
MAX_TOTAL_BYTES = 200 * 1024 * 1024

# Never ship secret-bearing files.
EXCLUDE_NAME = re.compile(
    r"(^\.env($|\.)|credential|secret|\.pem$|id_rsa|id_ed25519|\.keychain|"
    r"^auth\.json$|token)", re.IGNORECASE)
EXCLUDE_DIR = {".git", "node_modules", "vault", "venv", ".venv", "__pycache__",
               "cache", ".cache", "tmp", "logs", "shell-snapshots", "statsig",
               "todos", "attachments", "outbox"}

# Redact obvious credentials in transit (belt and braces — the box is the
# user's own, but imported transcripts can quote keys).
REDACT = [
    re.compile(r"sk-[A-Za-z0-9_\-]{16,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"xox[abprs]-[A-Za-z0-9\-]{10,}"),
    re.compile(r"AIza[0-9A-Za-z_\-]{30,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
]

def redact(text):
    for rx in REDACT:
        text = rx.sub("[REDACTED]", text)
    return text

# source -> (root, [(subpath-or-None meaning walk root, suffixes)])
SOURCES = {
    "hermes": (os.path.join(home, ".hermes"),
               [("SOUL.md", None), ("AGENTS.md", None), ("MEMORY.md", None),
                ("memory", (".md", ".txt", ".json", ".jsonl")),
                ("skills", (".md",)),
                ("context", (".md", ".txt", ".json", ".jsonl"))]),
    "codex": (os.path.join(home, ".codex"),
              [("AGENTS.md", None), ("instructions.md", None),
               ("sessions", (".jsonl",)), ("archived_sessions", (".jsonl",))]),
    "claude": (os.path.join(home, ".claude"),
               [("CLAUDE.md", None),
                ("projects", (".jsonl", ".md"))]),
}

def collect(root, entries):
    files = []
    for sub, suffixes in entries:
        path = os.path.join(root, sub)
        if suffixes is None:
            if os.path.isfile(path):
                files.append((sub, path))
            continue
        for dirpath, dirnames, filenames in os.walk(path):
            dirnames[:] = [d for d in dirnames if d.lower() not in EXCLUDE_DIR
                           and not EXCLUDE_NAME.search(d)]
            for name in sorted(filenames):
                if EXCLUDE_NAME.search(name):
                    continue
                if not name.lower().endswith(suffixes):
                    continue
                full = os.path.join(dirpath, name)
                files.append((os.path.relpath(full, root), full))
    return files

TRUNCATION_MARKER = "\n...[truncated]...\n"

def read_capped(path):
    # Budget in UTF-8 bytes — the server enforces MAX_FILE_BYTES on bytes,
    # so character counts (or an unbudgeted marker) would overshoot the cap
    # and get the whole chunk rejected.
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            if size <= MAX_FILE_BYTES:
                text = f.read().decode("utf-8", errors="replace")
            else:
                # keep head + tail of oversized transcripts, marker included
                # in the budget (replacement chars can widen 1 byte -> 3, so
                # leave that headroom too)
                half = (MAX_FILE_BYTES - len(TRUNCATION_MARKER.encode())) // 2 // 3
                head = f.read(half).decode("utf-8", errors="replace")
                f.seek(size - half)
                tail = f.read().decode("utf-8", errors="replace")
                text = head + TRUNCATION_MARKER + tail
        text = redact(text)
        while len(text.encode()) > MAX_FILE_BYTES:
            text = text[: len(text) // 2] + TRUNCATION_MARKER
        return text
    except OSError:
        return None

def post(payload):
    req = urllib.request.Request(
        endpoint, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {ticket}"},
        method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as error:
        detail = ""
        try:
            detail = json.load(error).get("error", "")
        except Exception:
            pass
        print(f"Upload failed ({error.code}): {detail or error.reason}", file=sys.stderr)
        sys.exit(1)

batches = []  # (source, files) upload plan built first so we know the last one
total_bytes = 0
for source, (root, entries) in SOURCES.items():
    if not os.path.isdir(root):
        print(f"{source}: no {root} found — skipping.")
        continue
    found = collect(root, entries)
    if not found:
        print(f"{source}: nothing importable under {root} — skipping.")
        continue
    batch, batch_bytes = [], 0
    for rel, full in found:
        if total_bytes >= MAX_TOTAL_BYTES:
            break
        content = read_capped(full)
        if content is None or not content.strip():
            continue
        entry = {"path": rel.replace(os.sep, "/"), "content": content}
        entry_bytes = len(content.encode())
        if batch and (batch_bytes + entry_bytes > MAX_CHUNK_BYTES
                      or len(batch) >= MAX_FILES_PER_CHUNK):
            batches.append((source, batch))
            batch, batch_bytes = [], 0
        batch.append(entry)
        batch_bytes += entry_bytes
        total_bytes += entry_bytes
    if batch:
        batches.append((source, batch))
    print(f"{source}: {sum(len(b) for s, b in batches if s == source)} files packaged.")

if not batches:
    print("Nothing found to import — no Hermes, Codex, or Claude context on this machine.")
    sys.exit(0)

uploaded = 0
for i, (source, files) in enumerate(batches):
    final = i == len(batches) - 1
    result = post({"source": source, "files": files, "final": final})
    uploaded += len(files)
    print(f"Uploaded {uploaded} files…")
    if final and result.get("dictionary_started"):
        print("All context is on your agent's computer — it is now building your personal Dictionary.MD.")

print("Done.")
PYEOF
