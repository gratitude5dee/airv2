#!/usr/bin/env bash
# air 2.0 — release the platform Workers (V11 §15). Mirrors
# infra/template/release.sh: immutable artifact, sha256, channel pointer.
#
#   1. refuse a dirty infra/workers tree;
#   2. digest dispatcher/index.mjs and static-stub/index.mjs;
#   3. deploy the Dispatcher with wrangler, tagged with the version + digest;
#   4. verify through the health path;
#   5. print the release record (version, git sha, digests) for the deploy log.
#
# Usage: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
#        CF_DISPATCH_HEALTH_URL=https://dispatch.apps.wzrd.tech/__air/health \
#        infra/workers/release.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKERS="$REPO_ROOT/infra/workers"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
HEALTH_URL="${CF_DISPATCH_HEALTH_URL:-https://dispatch.apps.wzrd.tech/__air/health}"

if ! git -C "$REPO_ROOT" diff --quiet -- infra/workers; then
  echo "FATAL: infra/workers has uncommitted changes — commit first" >&2
  exit 1
fi

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
VERSION="$(date -u +%Y.%m.%d)-${GIT_SHA:0:7}"
DISPATCHER_SHA="$(sha256sum "$WORKERS/dispatcher/index.mjs" | cut -d' ' -f1)"
STUB_SHA="$(sha256sum "$WORKERS/static-stub/index.mjs" | cut -d' ' -f1)"

# The control plane embeds the stub; a drift here would ship two stubs.
if ! grep -q "$STUB_SHA" "$REPO_ROOT/apps/web/lib/functions/staticStub.ts" 2>/dev/null; then
  echo "WARN: apps/web/lib/functions/staticStub.ts does not pin sha256 $STUB_SHA" >&2
  echo "      run: (cd apps/web && npm test -- --run lib/functions/staticStub)" >&2
fi

cd "$WORKERS"
npx --yes wrangler@4 deploy \
  --config wrangler.toml \
  --var "RELEASE_VERSION:$VERSION" \
  --var "RELEASE_SHA256:$DISPATCHER_SHA"

# Verify: the health path must answer from the new deployment.
for attempt in 1 2 3 4 5; do
  if curl -fsS --max-time 10 "$HEALTH_URL" | grep -q '"ok":true'; then
    break
  fi
  if [ "$attempt" = 5 ]; then
    echo "FATAL: $HEALTH_URL did not answer after deploy" >&2
    exit 1
  fi
  sleep 3
done

cat <<EOF
{
  "version": "$VERSION",
  "git_sha": "$GIT_SHA",
  "dispatcher_sha256": "$DISPATCHER_SHA",
  "static_stub_sha256": "$STUB_SHA",
  "health": "$HEALTH_URL"
}
EOF
