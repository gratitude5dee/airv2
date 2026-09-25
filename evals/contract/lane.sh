#!/usr/bin/env bash
# Contract-eval lane (R-EV-07a). Brings up, in order:
#   scratch Postgres (docker) → all migrations → seed → PostgREST binary →
#   stub Hermes + fake internet → the real Next.js control plane → the
#   31-case runner — then writes evals/contract/results/<ts>/results.json
#   and tears everything down.
#
#   bash evals/contract/lane.sh            # full lane
#   CASES=A106,F105 bash evals/contract/lane.sh    # debug subset
#   LANES=web bash evals/contract/lane.sh          # one drive only
#   KEEP=1 bash evals/contract/lane.sh             # leave processes running
#
# No secrets anywhere — every credential is a localhost-generated throwaway.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

WORK="$ROOT/evals/contract/.work"
BIN="$ROOT/evals/contract/.bin"
mkdir -p "$WORK" "$BIN"
OUTBOX="$WORK/outbox.jsonl"
STUB_LOG="$WORK/stub.log"
WEB_LOG="$WORK/web.log"
RESULTS_DIR="$ROOT/evals/contract/results/$(date +%Y-%m-%dT%H-%M-%S)"

PG_CONTAINER="${PG_CONTAINER:-contract-eval-pg-$$}"
PG_PORT="${PG_PORT:-5544}"
PGRST_PORT="${PGRST_PORT:-3010}"
STUB_PORT="${STUB_PORT:-4470}"
STUB_SUPA_PORT="${STUB_SUPA_PORT:-4499}"
WEB_PORT="${WEB_PORT:-3099}"
WEB_ORIGIN="http://127.0.0.1:${WEB_PORT}"
EVAL_USER_ID="${EVAL_USER_ID:-11111111-2222-3333-4444-555555555555}"

PIDS=()
# `next start` and `tsx` both fork a worker child, so killing the recorded pid
# orphans the listener — the orphan then keeps the port (and, for next-server,
# the PREVIOUS run's secrets) and every later run's traffic hits stale state.
# Match the command line, not the pid.
kill_by_pattern() {
  pkill -f "$1" 2>/dev/null || true
}
cleanup() {
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  kill_by_pattern "next-server"
  kill_by_pattern "next start -p $WEB_PORT"
  kill_by_pattern "tsx evals/stub-hermes/server.ts"
  kill_by_pattern "evals/contract/.bin/postgrest"
  docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
}
if [ "${KEEP:-0}" != "1" ]; then trap cleanup EXIT; else trap 'echo "KEEP=1 — services left up"' EXIT; fi

# Same fix pre-flight: a crashed previous run leaves the same orphans — a
# stale postgrest keeps :3010 bound to a DELETED postgres, and every supa
# read then fails with "not in schema cache"/dead-connection errors.
kill_by_pattern "next-server"
kill_by_pattern "tsx evals/stub-hermes/server.ts"
kill_by_pattern "evals/contract/.bin/postgrest"
docker ps -aq -f "name=contract-eval-pg-" | xargs -r docker rm -f >/dev/null 2>&1 || true

# ── 1. scratch postgres ────────────────────────────────────────────────────
echo "== postgres :$PG_PORT =="
docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$PG_CONTAINER" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p "127.0.0.1:${PG_PORT}:5432" \
  postgres:15 >/dev/null
for _ in $(seq 1 60); do
  docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null

# ── 2. shim + migrations + seed (before PostgREST — it caches the schema) ──
echo "== migrations =="
bash "$ROOT/evals/contract/apply-migrations.sh" "$PG_CONTAINER" "$ROOT"
sed "s/:'uid'/'${EVAL_USER_ID}'/g" "$ROOT/evals/contract/seed.sql" \
  | docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres
echo "seed applied"

# ── 3. postgrest (static binary; docker hub rate-limits) ──────────────────
# Must start AFTER migrations: PostgREST caches the schema at boot — tables
# and RPCs created later stay invisible until a reload.
echo "== postgrest :$PGRST_PORT =="
PGRST="$BIN/postgrest"
if [ ! -x "$PGRST" ]; then
  curl -fsSL -o "$WORK/postgrest.tar.xz" \
    https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
  tar -xJf "$WORK/postgrest.tar.xz" -C "$BIN"
fi
PGRST_DB_URI="postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres" \
PGRST_DB_ANON_ROLE=postgres \
PGRST_DB_SCHEMAS=public \
PGRST_SERVER_PORT="$PGRST_PORT" \
PGRST_DB_EXTRA_SEARCH_PATH=public \
"$PGRST" >"$WORK/postgrest.log" 2>&1 &
PIDS+=("$!")
for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${PGRST_PORT}/" >/dev/null 2>&1 && break || true
  sleep 1
done

# ── 4. env ─────────────────────────────────────────────────────────────────
gen() { node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))'; }
SESSION_SECRET="$(gen)"
SPECTRUM_WEBHOOK_SECRET="$(gen)"
ADMIN_API_KEY="$(gen)"
cat > "$WORK/web.env" <<EOF
NODE_ENV=production
APP_ORIGIN=$WEB_ORIGIN
ADMIN_API_KEY=$ADMIN_API_KEY
AGENTMAIL_API_KEY=$(gen)
AGENTMAIL_WEBHOOK_SECRET=$(gen)
BOX_API_BASE=http://127.0.0.1:${STUB_PORT}
BOX_API_KEY=$(gen)
BOX_TEMPLATE_ID=eval-template
COMPOSIO_API_KEY=$(gen)
MASTERKEY_PARTNER_SECRET=$(gen)
MINIAPP_SIGNING_KEY=$(gen)
MODEL_PROVIDER_API_KEY=$(gen)
MODEL_PROVIDER_BASE_URL=http://127.0.0.1:${STUB_PORT}
SESSION_SECRET=$SESSION_SECRET
SPECTRUM_PROJECT_ID=eval-project
SPECTRUM_PROJECT_SECRET=$(gen)
SPECTRUM_WEBHOOK_SECRET=$SPECTRUM_WEBHOOK_SECRET
STRIPE_SECRET_KEY=$(gen)
STRIPE_WEBHOOK_SECRET=$(gen)
SUPABASE_SERVICE_ROLE_KEY=eval-service-role
SUPABASE_URL=http://127.0.0.1:${STUB_SUPA_PORT}
TENKI_API_KEY=$(gen)
THIRDWEB_SECRET_KEY=$(gen)
WZRDMAIL_API_KEY=$(gen)
WZRDMAIL_BASE_URL=http://127.0.0.1:${STUB_PORT}
WZRDMAIL_WEBHOOK_SECRET=$(gen)
SPECTRUM_RECORD_OUTBOX=$OUTBOX
EOF

# ── 5. build + start the real control plane ────────────────────────────────
echo "== web build =="
set -a; . "$WORK/web.env"; set +a
(cd apps/web && npm run build) >"$WORK/build.log" 2>&1 || {
  tail -40 "$WORK/build.log"; echo "build failed"; exit 1; }
echo "== web :$WEB_PORT =="
(cd apps/web && exec npx next start -p "$WEB_PORT") >"$WEB_LOG" 2>&1 &
PIDS+=("$!")
for _ in $(seq 1 60); do
  curl -fsS "$WEB_ORIGIN" >/dev/null 2>&1 && break || true
  sleep 1
done

# ── 6. stub hermes + fake internet ─────────────────────────────────────────
echo "== stub :$STUB_PORT/:${STUB_SUPA_PORT} =="
STUB_PORT=$STUB_PORT STUB_SUPA_PORT=$STUB_SUPA_PORT \
WEB_ORIGIN=$WEB_ORIGIN STUB_GATEWAY_TOKEN=eval-gateway-token \
PGRST_UPSTREAM="http://127.0.0.1:${PGRST_PORT}" \
STUB_LOG=$STUB_LOG \
npx tsx evals/stub-hermes/server.ts >"$WORK/stub.out" 2>&1 &
PIDS+=("$!")
for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${STUB_PORT}/health" >/dev/null 2>&1 && break || true
  sleep 1
done

# ── 7. run the cases ───────────────────────────────────────────────────────
echo "== cases =="
EVAL_USER_ID=$EVAL_USER_ID \
EVAL_SUPA_URL="http://127.0.0.1:${STUB_SUPA_PORT}" \
SUPABASE_SERVICE_ROLE_KEY=eval-service-role \
WEB_ORIGIN=$WEB_ORIGIN \
STUB_URL="http://127.0.0.1:${STUB_PORT}" \
OUTBOX=$OUTBOX \
RESULTS_DIR=$RESULTS_DIR \
npx tsx evals/contract/run.ts

echo "results → $RESULTS_DIR"
