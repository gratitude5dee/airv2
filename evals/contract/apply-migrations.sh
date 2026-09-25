#!/usr/bin/env bash
# Apply every supabase migration, in order, to a scratch Postgres (R-EV-07).
# Transport is psql inside the postgres:15 container (docker exec), so the
# lane works anywhere the image runs — local docker or a CI service.
#
#   bash evals/contract/apply-migrations.sh <container> <repo-root>
set -euo pipefail

CONTAINER="${1:?postgres container name}"
ROOT="${2:?repo root}"

docker exec -i "$CONTAINER" \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$ROOT/evals/contract/shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "apply $(basename "$f")"
  docker exec -i "$CONTAINER" \
    psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres < "$f"
done
echo "migrations applied"
