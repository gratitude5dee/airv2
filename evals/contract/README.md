# Contract eval lane (R-EV-07a)

CI-runnable, secrets-free eval tier that proves the control plane files the
right decisions and performs the right writes for a **known** agent behaviour.
It does not test the model: a stub Hermes replays recorded tool-event streams
while the real `apps/web` control plane runs against a scratch Postgres with
all migrations applied.

## What runs

`npm run eval:contract` (or `bash evals/contract/lane.sh`) brings up:

1. `postgres:15` on `:5544` + `shim.sql` (bare-Postgres `auth.uid()` /
   `service_role` / `storage.buckets` — same shape as the CI `migrations` job)
   + every `supabase/migrations/*.sql` in order + `seed.sql`.
2. PostgREST on `:3010` (downloaded static binary, cached under `.bin/`).
   The control plane's Supabase client is pointed at the stub's `/rest/v1`
   proxy on `:4499`, which forwards to PostgREST.
3. `apps/web` built and started on `:3099` with generated placeholder secrets.
4. `evals/stub-hermes/server.ts` — an `api_server`-shaped stub on `:4470`
   implementing exactly the surface `lib/hermes/client.ts` calls
   (`POST /v1/runs`, `GET /v1/runs/{id}/events` SSE, `/api/sessions`,
   `/api/jobs`, …), plus the model provider (`/v1/chat/completions`), box
   provider (`/boxes/*`), AgentMail draft endpoint, eval control plane
   (`/__eval__/*`), and the `/rest/v1` Supabase proxy on `:4499`.
5. `evals/contract/run.ts` — drives every case in both lanes:
   - **web**: `POST /api/chat` (minted `air_session` cookie), then consumes
     `/api/chat/{runId}/events` to terminal.
   - **imessage**: `POST /api/inbound/imessage` with a real Spectrum HMAC
     signature (`v0:{ts}:{rawBody}` under `SPECTRUM_WEBHOOK_SECRET`), then
     polls `/__eval__/runs` until the flush's run finishes.

The seeded `boxes` row points `hosted_url` at the stub, so the real control
plane calls it for both `/api/chat` and the inbound flush. Spectrum sends are
recorded to `SPECTRUM_RECORD_OUTBOX` via the recording-sender seam in
`lib/spectrum/recording.ts`.

## Assertions

Each drive asserts:

- the stub run completed (fixture replayed to `run.completed`);
- every `must_do` pattern matched the run's evidence (tool previews, fired
  control-plane calls with status/body, model deltas) in order;
- no `must_not_do` pattern matched;
- `expected_decision_kind` row exists with `pending` status in the drive's
  time window (or zero decisions for `none` + non-adversarial cases);
- extra writes where the case covers them (calendar `agent_schedules`,
  `payment_requests`);
- imessage lane: at least one outbound send on the recording outbox.

Results land in `evals/contract/results/<timestamp>/results.json` (uploaded as
a CI artifact).

## Fixtures

`evals/stub-hermes/streams/<CASE>.jsonl` — one JSONL row per SSE event or
control-plane call the stub should replay:

- `{comment}` — provenance note, ignored.
- `{sse}` — emitted on `GET /v1/runs/{id}/events` verbatim
  (`data: <json>\n\n`).
- `{call}` — the stub itself fires this request at the real control plane with
  `Bearer <boxes.gateway_token>` while the run streams; recorded as evidence.

`$LANE` in a fixture is substituted per lane so lane-isolated resources
(purchase hosts, mini-app names, draft ids) don't collide across lanes.
`{draft}` payloads in `call` bodies are registered with the stub so the
AgentMail draft endpoint returns 200.

## Known gaps (XFAIL)

A drive that fails **only** inside a listed entry of `KNOWN_GAPS` in
`run.ts` is reported `XFAIL` and does not fail the suite — these are product
bugs the lane surfaces, not eval bugs. Anything else failing, or a listed gap
unexpectedly passing (XPASS — the bug was fixed; update the list), fails CI.

Current known gaps:

- **A106** — `POST /api/calendar/remind` is session-cookie-only, so the box
  has no credential path to file an event-tied one-shot reminder (401s).
- **K196** — `vault_fill` is a legal decision kind but the kernel_actions
  filer is disabled by default, so a vault-fill turn files nothing.

## Tuning

- `CASES=A106,K196` — run a subset.
- `LANES=web` — one lane only.
- `KEEP=1` — leave Postgres/web/stub running after the run.
- `EVAL_RESULTS=dir` — alternate results directory.
