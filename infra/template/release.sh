#!/usr/bin/env bash
# air 2.0 — cut a template release. Packs the infra/template/ tree at the
# current commit, posts it to the fleet admin API, and prints the release row.
# The control plane stores the artifact in R2 and records the sha256; deploys
# and promotions then reference the immutable release, never a working tree.
#
# Usage: ADMIN_API_KEY=... APP_ORIGIN=https://... infra/template/release.sh [notes]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORIGIN="${APP_ORIGIN:?set APP_ORIGIN to the control-plane origin}"
KEY="${ADMIN_API_KEY:?set ADMIN_API_KEY}"
NOTES="${1:-}"

if ! git -C "$REPO_ROOT" diff --quiet HEAD -- infra/template \
  || [ -n "$(git -C "$REPO_ROOT" ls-files --others --exclude-standard -- infra/template)" ]; then
  echo "FATAL: infra/template has uncommitted or untracked changes — commit first" >&2
  exit 1
fi

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
VERSION="$(date -u +%Y.%m.%d)-${GIT_SHA:0:7}"
HERMES_REF="$(git -C "$REPO_ROOT" show "$GIT_SHA:infra/template/setup.sh" \
  | grep -m1 '^HERMES_REF=' | sed -E 's/.*:-([0-9a-f]+)\}.*/\1/' || true)"
# Via a file, not an env var: the base64 template tarball is megabytes and
# passing it in the environment blows the exec argument limit (E2BIG).
ARTIFACT_FILE="$(mktemp)"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$ARTIFACT_FILE" "$STAGE_DIR"' EXIT
# The artifact carries its own identity: setup.sh / sync-box.sh copy RELEASE
# to ~/.hermes/.template-release, which is how provisioning tells that a
# fork really came from the channel's release (never from a working tree).
# Packed from the commit itself, so the stamped git_sha identifies exactly
# the bytes shipped — nothing staged or untracked can ride along.
git -C "$REPO_ROOT" archive --format=tar "$GIT_SHA" infra/template \
  | tar xf - -C "$STAGE_DIR" --strip-components=1
printf 'version=%s\ngit_sha=%s\nhermes_ref=%s\n' "$VERSION" "$GIT_SHA" "$HERMES_REF" \
  > "$STAGE_DIR/template/RELEASE"
tar czf - -C "$STAGE_DIR" template | base64 -w0 > "$ARTIFACT_FILE"

RELEASE_ORIGIN="$ORIGIN" RELEASE_KEY="$KEY" RELEASE_VERSION="$VERSION" \
RELEASE_GIT_SHA="$GIT_SHA" RELEASE_HERMES_REF="$HERMES_REF" \
RELEASE_NOTES="$NOTES" RELEASE_ARTIFACT_FILE="$ARTIFACT_FILE" \
python3 - <<'EOF'
import json, os, urllib.request
body = json.dumps({
    "version": os.environ["RELEASE_VERSION"],
    "git_sha": os.environ["RELEASE_GIT_SHA"],
    "hermes_ref": os.environ.get("RELEASE_HERMES_REF") or None,
    "notes": os.environ.get("RELEASE_NOTES") or None,
    "artifact_base64": open(os.environ["RELEASE_ARTIFACT_FILE"]).read(),
}).encode()
req = urllib.request.Request(
    f"{os.environ['RELEASE_ORIGIN']}/api/admin/fleet/releases",
    data=body,
    headers={
        "Authorization": f"Bearer {os.environ['RELEASE_KEY']}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req) as response:
    print(json.dumps(json.load(response), indent=2))
EOF
