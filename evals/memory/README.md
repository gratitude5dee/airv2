# evals/memory — iMessage recall eval (R-EV-11 / MEM-11 / MEM-29)

The only memory-recall number in the product review was 4/4 on a hand-written
thread. This directory is a real harness: a deterministic synthetic 90-day
iMessage archive, 30 recall queries with expected artefacts, and a scorer for
recall@1 / recall@3 against OpenViking on a box.

## Layout

```
generate.ts   build the synthetic archive — seeded RNG, byte-identical output
archive/      generated output, committed (1236 messages, 8 threads, ~90 days)
  messages.jsonl   one IngestMessage per line — the shape
                   POST /api/me/imessage-history accepts
  threads/<sha256(chat_id)>/<YYYY-MM>.md   the exact partition files the
                   extractor writes and archiveStore.ts indexes into OpenViking
  manifest.json    every message id → its partition URI
                   (viking://resources/context/imessage-history/threads/…)
  queries.jsonl    30 recall queries, each with the message ids that satisfy it
score.ts      score a results file — recall@1/recall@3, exits 1 under the
              ≥ 80% recall@1 target from the prior review
run.ts        live runner — DEFERRED (needs a funded control plane + box)
memory.test.ts
```

## Offline (CI-safe)

```
npx tsx evals/memory/generate.ts          # rebuild archive/ — deterministic
npx vitest run evals/memory/memory.test.ts
npx tsx evals/memory/score.ts evals/memory/fixtures/results-perfect.jsonl
```

`score.ts` without an argument reads `archive/results.jsonl`. A results file is
one JSONL row per query: `{"id": "M04", "retrieved": ["viking://…/…/2026-08", …]}`
— retrieved artefact URIs in ranked order. A URI counts as a hit for a query
when it names the partition that contains any of the query's expected messages.

## Live run — deferred

`run.ts` is implemented end-to-end but has never run: it needs a funded
control plane, an eval-user session cookie, and a live box, none of which are
available in CI. When credentials exist:

```
EVAL_BASE_URL=http://127.0.0.1:3000 EVAL_SESSION_COOKIE=… EVAL_USER_ID=… \
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… BOX_API_BASE=… BOX_API_KEY=… \
npx tsx evals/memory/run.ts
```

It mints an ingest ticket via `GET /api/me/imessage-history`, POSTs
`messages.jsonl` in ≤4 MB chunks (the same path the extractor uses), waits for
OpenViking to finish indexing, then asks each query via `find` on the box's
viking MCP (`python3 -c …` through the ascii.dev box-command API) and writes
`results/memory-<stamp>/{results.jsonl,report.md}`. Re-running appends to the
results file, so an interrupted run resumes where it stopped.

## What counts as a hit

Queries are things a user actually asks the assistant ("when does Priya land
and what's her flight confirmation?"). The scoring granularity is the
partition URI, not the message line — retrieval that surfaces the right
thread-month page counts, because that page is what gets loaded into context.
A deeper pointer (`…/2026-08.md`, `…/2026-08/sections/…`) resolves to its
partition.

## Prior-review target

recall@1 ≥ 80%. The scorer exits non-zero below it, so it can gate CI once a
live box exists.
