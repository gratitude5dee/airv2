#!/usr/bin/env bash
# Apply pending supabase/migrations/*.sql to the production database via the
# Supabase management API, tracking what has run in applied_migrations.
# Migrations are forward-only: files sort lexicographically (0001_..., 0002_...)
# and a file must never be edited after it has been applied.
#
# Env: SUPABASE_ACCESS_TOKEN (sbp_... personal access token),
#      SUPABASE_PROJECT_REF (project ref, e.g. imkbxdsxfgmkylbgaygv).
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

run_sql() {
  local body http
  body=$(jq -n --rawfile q /dev/stdin '{query: $q}')
  http=$(curl -sS -o /tmp/sql-out.json -w "%{http_code}" -X POST "$API" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$body")
  if [ "$http" -ge 300 ]; then
    echo "SQL failed (HTTP $http):" >&2
    cat /tmp/sql-out.json >&2
    return 1
  fi
  cat /tmp/sql-out.json
}

echo "create table if not exists applied_migrations (name text primary key, applied_at timestamptz not null default now());" | run_sql > /dev/null

applied=$(echo "select coalesce(json_agg(name), '[]'::json) from applied_migrations;" | run_sql | jq -r '.[0].coalesce | join("\n")')

pending=0
for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  name=$(basename "$file")
  if grep -qxF "$name" <<< "$applied"; then
    continue
  fi
  echo "Applying $name"
  # One request per migration: the statements plus the tracking insert run in
  # the same implicit transaction, so a failed migration is not marked applied.
  { cat "$file"; printf "\ninsert into applied_migrations (name) values (%s);\n" "'$name'"; } | run_sql > /dev/null
  pending=$((pending + 1))
done

echo "Done: $pending migration(s) applied."
