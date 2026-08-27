#!/bin/bash
# WZRD Air — real profile browsing (run on YOUR machine).
#
# Snapshots your default Chromium browser's ACTIVE profile — the one you
# actually browse (Local State → profile.last_used) — with its cookies,
# saved logins, and preferences, and uploads it to your own agent's
# computer under ~/.hermes/browser-profile/<browser>/. Your live browser
# profile is never opened directly, only copied. Only the active profile
# is copied — other profiles are never snapshotted. Nothing is stored on
# the platform's shared database.
#
# This is a consent-gated convenience, not an isolation boundary: a page
# the agent visits runs with your real logins. Turn it off any time from
# onboarding/Settings — that deletes the snapshot on your agent's computer.
#
# Usage:  curl -fsSL https://app.wzrd.tech/browser-profile-import.sh | bash -s -- <UPLOAD_TICKET>
# Set AIR_BROWSER=chrome|edge|brave|chromium to override detection.
#
# Requirements: macOS or Linux with python3. (On Windows a running browser
# holds an exclusive lock on these databases — fully quit it first and run
# this from WSL/Git Bash.)
set -euo pipefail

TICKET="${1:-}"
ENDPOINT="${AIR_BROWSER_ENDPOINT:-https://app.wzrd.tech/api/me/browser-profile}"
BROWSER="${AIR_BROWSER:-}"

if [ -z "$TICKET" ]; then
  echo "usage: browser-profile-import.sh <UPLOAD_TICKET>" >&2
  exit 1
fi

/usr/bin/env python3 - "$ENDPOINT" "$TICKET" "$BROWSER" <<'PYEOF'
import base64, json, os, shutil, sys, tempfile, urllib.error, urllib.request

endpoint, ticket, forced = sys.argv[1:4]
home = os.path.expanduser("~")
mac = sys.platform == "darwin"

# Decoded bytes per part: base64 inflates 4/3, server caps a part at 3 MB
# of base64.
PART_BYTES = 2 * 1024 * 1024
MAX_PARTS_PER_FILE = 40

# browser -> user-data-dir candidates, checked in order.
ROOTS = {
    "chrome": [
        os.path.join(home, "Library/Application Support/Google/Chrome") if mac
        else os.path.join(home, ".config/google-chrome"),
    ],
    "edge": [
        os.path.join(home, "Library/Application Support/Microsoft Edge") if mac
        else os.path.join(home, ".config/microsoft-edge"),
    ],
    "brave": [
        os.path.join(home, "Library/Application Support/BraveSoftware/Brave-Browser") if mac
        else os.path.join(home, ".config/BraveSoftware/Brave-Browser"),
    ],
    "chromium": [
        os.path.join(home, "Library/Application Support/Chromium") if mac
        else os.path.join(home, ".config/chromium"),
    ],
}

def find_root():
    order = [forced] if forced else ["chrome", "edge", "brave", "chromium"]
    for kind in order:
        for root in ROOTS.get(kind, []):
            if os.path.isfile(os.path.join(root, "Local State")):
                return kind, root
    return None, None

kind, root = find_root()
if not root:
    print("No Chromium-family browser profile found (Chrome/Edge/Brave/Chromium)."
          " A non-Chromium default (e.g. Firefox) isn't supported.", file=sys.stderr)
    sys.exit(1)

# Active profile only: Local State → profile.last_used (fallback Default).
try:
    with open(os.path.join(root, "Local State"), encoding="utf-8") as f:
        local_state = json.load(f)
    profile_dir = local_state.get("profile", {}).get("last_used") or "Default"
except (OSError, ValueError):
    profile_dir = "Default"

# Only auth/preference files of the active profile — mirrors the server
# allowlist. "profile/" is the alias the server lays out as Default/.
CANDIDATES = [
    ("Local State", os.path.join(root, "Local State")),
    ("profile/Preferences", os.path.join(root, profile_dir, "Preferences")),
    ("profile/Secure Preferences", os.path.join(root, profile_dir, "Secure Preferences")),
    ("profile/Cookies", os.path.join(root, profile_dir, "Cookies")),
    ("profile/Network/Cookies", os.path.join(root, profile_dir, "Network", "Cookies")),
    ("profile/Login Data", os.path.join(root, profile_dir, "Login Data")),
    ("profile/Login Data For Account", os.path.join(root, profile_dir, "Login Data For Account")),
    ("profile/Web Data", os.path.join(root, profile_dir, "Web Data")),
    ("profile/Bookmarks", os.path.join(root, profile_dir, "Bookmarks")),
]

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

# Copy to a temp snapshot first so a running browser never fights us for
# the live files (macOS/Linux allow copying while the browser is open; a
# locked copy fails fast rather than producing a signed-out session).
staging = tempfile.mkdtemp(prefix="air-browser-")
plan = []
try:
    for rel, src in CANDIDATES:
        if not os.path.isfile(src):
            continue
        dst = os.path.join(staging, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        try:
            shutil.copy2(src, dst)
        except OSError:
            print(f"Could not copy {rel} — fully quit {kind} and retry.", file=sys.stderr)
            sys.exit(1)
        size = os.path.getsize(dst)
        if size == 0:
            continue
        parts = max(1, -(-size // PART_BYTES))
        if parts > MAX_PARTS_PER_FILE:
            print(f"Skipping {rel} — larger than the import budget.")
            continue
        plan.append((rel, dst, parts))

    if not any(rel.endswith("Cookies") for rel, _, _ in plan):
        print(f"{kind}: no cookie database found in profile '{profile_dir}' — nothing to import.",
              file=sys.stderr)
        sys.exit(1)

    print(f"Snapshotting {kind} profile '{profile_dir}' ({len(plan)} files)…")
    for i, (rel, path, parts) in enumerate(plan):
        last_file = i == len(plan) - 1
        with open(path, "rb") as f:
            for part in range(parts):
                data = f.read(PART_BYTES)
                post({
                    "browser": kind,
                    "path": rel,
                    "part": part,
                    "parts": parts,
                    "content_b64": base64.b64encode(data).decode(),
                    "final": last_file and part == parts - 1,
                })
        print(f"Uploaded {rel}")
finally:
    shutil.rmtree(staging, ignore_errors=True)

print("Done — real profile browsing is now ON for your agent."
      " Logins you do in your own browser sync when you run this again."
      " Turn it off any time from onboarding/Settings to delete the snapshot.")
PYEOF
