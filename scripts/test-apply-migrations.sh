#!/usr/bin/env bash
# R-P0-5: verify apply-migrations.sh's sha256 check rejects an edited
# applied file. Runs against a scratch Postgres via DATABASE_URL.
set -uo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Point the script at a one-migration scratch dir by shadowing
# MIGRATIONS_DIR in a copied script.
cp "$SCRIPT_DIR/apply-migrations.sh" "$WORK/apply.sh"
mkdir -p "$WORK/migrations" "$WORK/up"
sed -i "s|^MIGRATIONS_DIR=.*|MIGRATIONS_DIR=\"$WORK/migrations\"|" "$WORK/apply.sh"
printf 'create table probe_one (id int);\n' > "$WORK/migrations/0001_probe.sql"

export DATABASE_URL
fail=0

echo "1) first apply records the hash"
bash "$WORK/apply.sh" > "$WORK/up/1.log" 2>&1 || { cat "$WORK/up/1.log"; exit 1; }
grep -q "Done: 1 migration" "$WORK/up/1.log" || { cat "$WORK/up/1.log"; fail=1; }

echo "2) second apply is a no-op"
bash "$WORK/apply.sh" > "$WORK/up/2.log" 2>&1 || { cat "$WORK/up/2.log"; fail=1; }
grep -q "Done: 0 migration" "$WORK/up/2.log" || { cat "$WORK/up/2.log"; fail=1; }

echo "3) editing an applied file fails the apply"
printf 'create table probe_one (id int, extra int);\n' > "$WORK/migrations/0001_probe.sql"
if bash "$WORK/apply.sh" > "$WORK/up/3.log" 2>&1; then
  echo "FAIL: tampered migration applied without error" >&2
  fail=1
else
  grep -q "was edited after it was applied" "$WORK/up/3.log" || { cat "$WORK/up/3.log"; fail=1; }
fi

echo "4) tampered file was not re-run"
extra=$(psql "$DATABASE_URL" -qAt -c "select count(*) from information_schema.columns where table_name='probe_one' and column_name='extra';")
[ "$extra" = "0" ] || { echo "FAIL: tampered statements reached the database" >&2; fail=1; }

echo "5) recorded hash is a sha256"
hash=$(psql "$DATABASE_URL" -qAt -c "select sha256 from applied_migrations where name='0001_probe.sql';")
echo "$hash" | grep -qE '^[0-9a-f]{64}$' || { echo "FAIL: bad hash '$hash'" >&2; fail=1; }

# Clean up the probe table + tracking row so the suite stays side-effect free.
psql "$DATABASE_URL" -qAt -c "drop table if exists probe_one; delete from applied_migrations where name='0001_probe.sql';" > /dev/null

if [ "$fail" -eq 0 ]; then echo "apply-migrations hash check: ok"; fi
exit "$fail"
