#!/usr/bin/env bash
# Apply pending supabase/migrations/*.sql to the database, tracking what has
# run in applied_migrations (name + sha256 of the file that ran).
# Migrations are forward-only: files sort lexicographically (0001_..., 0002_...)
# and a file must never be edited after it has been applied — an edited
# applied file fails this script on its recorded hash.
#
# Env (production): SUPABASE_ACCESS_TOKEN (sbp_... personal access token),
#                   SUPABASE_PROJECT_REF (project ref, e.g. imkbxdsxfgmkylbgaygv).
# Env (local/CI):   DATABASE_URL — a libpq URL; applies over psql instead of
#                   the management API. Same apply loop, same guarantees.
set -euo pipefail

MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"
# "<old name> <new name>" per line: a migration renamed after it was applied
# somewhere (e.g. renumbered to dodge a prefix collision). A database that
# recorded the old name gets the new one recorded too, so the file is not
# re-run. Fresh databases never see the old name and apply the new file.
RENAMES_FILE="$(dirname "$0")/migration-renames.txt"

if [ -n "${DATABASE_URL:-}" ]; then
  run_sql() {
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qf -
  }
  applied_rows() {
    echo "select name, coalesce(sha256, '') from applied_migrations;" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -F'|' -f -
  }
else
  : "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN (or DATABASE_URL) is required}"
  : "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF (or DATABASE_URL) is required}"
  API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
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
  applied_rows() {
    echo "select json_agg(json_build_array(name, coalesce(sha256, ''))) from applied_migrations;" \
      | run_sql | jq -r '.[0].json_agg[]? | @tsv'
  }
fi

# Tracking table: name + the hash of the file that produced it. RLS enabled
# like every other public table (rls_all_tables.sql in supabase/tests).
echo "create table if not exists applied_migrations (name text primary key, applied_at timestamptz not null default now(), sha256 text);" | run_sql > /dev/null
echo "alter table applied_migrations add column if not exists sha256 text;" | run_sql > /dev/null
echo "alter table applied_migrations enable row level security;" | run_sql > /dev/null

applied=$(applied_rows | tr '\t' '|' || true)
applied_names=$(cut -d'|' -f1 <<< "$applied")

if [ -f "$RENAMES_FILE" ]; then
  while read -r old new; do
    case "$old" in ""|\#*) continue ;; esac
    if grep -qxF "$old" <<< "$applied_names" && ! grep -qxF "$new" <<< "$applied_names"; then
      echo "Recording $new as applied (was applied as $old)"
      printf "insert into applied_migrations (name) values (%s) on conflict do nothing;\n" "'$new'" | run_sql > /dev/null
      applied="$applied"$'\n'"$new"
      applied_names="$applied_names"$'\n'"$new"
    fi
  done < "$RENAMES_FILE"
fi

pending=0
for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  name=$(basename "$file")
  hash=$(sha256sum "$file" | cut -d' ' -f1)
  recorded=$(grep -F "$name|" <<< "$applied" | head -1 | cut -d'|' -f2- | tr -d '[:space:]' || true)
  if grep -qxF "$name" <<< "$applied_names"; then
    if [ -z "$recorded" ]; then
      # Applied before hashes were recorded: pin the current file's hash.
      printf "update applied_migrations set sha256 = '%s' where name = '%s';\n" "$hash" "$name" | run_sql > /dev/null
    elif [ "$recorded" != "$hash" ]; then
      echo "FAIL: $name was edited after it was applied (recorded ${recorded:0:12}…, on disk ${hash:0:12}…)." >&2
      echo "Migrations are forward-only — write a new file instead." >&2
      exit 1
    fi
    continue
  fi
  echo "Applying $name"
  # One request/transaction per migration: the statements plus the tracking
  # insert run atomically, so a failed migration is not marked applied.
  { cat "$file"; printf "\ninsert into applied_migrations (name, sha256) values ('%s', '%s');\n" "$name" "$hash"; } | run_sql > /dev/null
  pending=$((pending + 1))
done

echo "Done: $pending migration(s) applied."
