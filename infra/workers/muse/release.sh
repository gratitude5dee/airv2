#!/usr/bin/env bash
# Deploy only a committed MM0 artifact, then verify the public health endpoint.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORKER_DIR="$REPO_ROOT/infra/workers/muse"
HEALTH_URL="${AIR_MUSE_HEALTH_URL:-https://muse.wzrd.tech/__air/health}"

if ! git -C "$REPO_ROOT" diff --quiet -- infra/workers/muse || ! git -C "$REPO_ROOT" diff --cached --quiet -- infra/workers/muse; then
  echo "FATAL: infra/workers/muse has uncommitted changes — commit first" >&2
  exit 1
fi

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
SOURCE_SHA="$(shasum -a 256 "$WORKER_DIR/src/index.ts" | awk '{print $1}')"
VERSION="$(date -u +%Y.%m.%d)-${GIT_SHA:0:7}"

cd "$WORKER_DIR"
npm run check
npm run test
npx wrangler deploy --var "RELEASE_VERSION:$VERSION" --var "RELEASE_SHA256:$SOURCE_SHA"

for attempt in 1 2 3 4 5; do
  if curl -fsS --max-time 10 "$HEALTH_URL" | grep -q '"ok":true'; then
    break
  fi
  if [ "$attempt" = 5 ]; then
    echo "FATAL: $HEALTH_URL did not return healthy JSON after deploy" >&2
    exit 1
  fi
  sleep 3
done

printf '{"version":"%s","git_sha":"%s","source_sha256":"%s","health":"%s"}\n' "$VERSION" "$GIT_SHA" "$SOURCE_SHA" "$HEALTH_URL"
