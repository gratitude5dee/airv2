# R-CF-15 — Observability, limits and budgets

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-15: …`.

**Why.** PR #522's probe returned 500s, not CPU overruns (a CPU overrun is 1102, which is HTTP 503). On workerd `validateEnv` only warns (R-CF-12 (n)). So the 500s are most likely 1101 uncaught exceptions from `required()` inside `serviceClient()`, because only 57 of ~90 values were set. Nobody could tell, because nothing was read from Workers Logs. The migration adds four runtime types that the Next app's logs cannot see: Containers, Durable Objects, Workflows and Queue consumers. Paid billing is usage-based and has no hard cap.

Current state:
- `apps/web/wrangler.jsonc:19-21` sets only `observability.enabled: true`.
- air-muse samples at 1 (`infra/workers/muse/wrangler.toml:16-18`) and air-outbound at 0.1 (`infra/workers/outbound/wrangler.toml:22-24`).
- Request URLs, including `?k=` approval tokens and `?t=`/`?g=` launch tokens, are logged unredacted.

Pricing:
- Workers Logs on Paid includes 20M events/month, then $0.60/M, with 7-day retention.
- From 2026-12-01 it moves to Cloudflare Observability pricing: Paid gets 50 GB ingestion and 10 GB-month storage per cycle, then $0.25/GB and $0.10/GB-month. Traces, container logs and Issues share that pool (developers.cloudflare.com/workers/observability/logs/workers-logs/, developers.cloudflare.com/observability/pricing/).

**Deltas.**
- **`apps/web/wrangler.jsonc:19-21`.** Replace it with the block below. Every key exists in the wrangler 4.149.0 `config-schema.json`.
  ```jsonc
  "observability": {
    "enabled": true,
    "redact_query_string": true,     // ?k= approval tokens, ?t=/?g= launch tokens, ?fal_webhook=
    "issues": { "enabled": true },
    "logs": { "enabled": true, "invocation_logs": true, "head_sampling_rate": 1 },
    "traces": { "enabled": true, "head_sampling_rate": 0.1 }
  },
  "limits": { "cpu_ms": 60000 },     // contract start value; set here if R-CF-02 has not
  "upload_source_maps": true         // (verify OpenNext emits server maps and the R-CF-13 size gate still passes)
  ```
  - Keep `head_sampling_rate: 1` through the P6 soak.
  - Do not add a top-level `cache` block. The Workers Cache key ignores the host (developers.cloudflare.com/workers/cache/cache-keys/), and the mini store home sets `public, s-maxage=60` on `/` (`apps/web/middleware.ts:229-234`). A cached mini `/` would then be served at `app.wzrd.tech/`.
  - Any later caching must go through a named entrypoint that passes the host in `ctx.props`, which is part of the key. That is not part of this item.
- **`infra/workers/sidecar/wrangler.jsonc`** (created in R-CF-03):
  - use the same `observability` block;
  - set `containers[].observability.enabled: true` for `ImessageRelay` and `MediaWorker`;
  - the cost caps are the §2.5 C14 numbers, and this item does not set them again:
    - `MediaWorker` keeps `max_instances: 2` (R-CF-09).
    - `ImessageRelay` takes no `max_instances` under the `durable_object` scheduling policy. Its count is the fixed pair `relay-0`/`relay-1` (`RELAY_INSTANCES=2`, R-CF-03).
    - The optional `TenkiRelay` is one instance (R-CF-05).
- **`infra/workers/build/wrangler.jsonc`** (created in R-CF-10): the same `observability` block, with `limits.cpu_ms: 300000` (contract).
- **Canonical log events (§2.5 C16).** Every new control event is one JSON line `{ msg: "<area>.<event>", ... }`, written through `log` (`apps/web/lib/log.ts:28-33`). That module has no dependencies, and Workers Logs indexes the JSON fields. The producing item emits exactly the name and fields below. This item adds no second emitter in `worker/entry.ts` or `worker/handler.ts`. Lines carry identifiers only, never values, tokens or message bodies.

  | `msg` | Fields | Emitted by |
  |---|---|---|
  | `env.unpack` | `digest` (12 hex), `rotated`, `error` (`yes`/`no`) | R-CF-02 `worker/env-unpack.ts`, when the digest or the error state changes. It logs the digest only, never values. |
  | `switch.flip` | `from`, `to`, `forced` | R-CF-02 `worker/switch.ts`, on a successful `POST /_switch` |
  | `proxy.upstream` | `status`, `duration_ms` | R-CF-02 `worker/proxy.ts`, only when the target is Vercel |
  | `cron.dispatch` | `cron`, `path`, `status`, `duration_ms`, `scheduled_time` | R-CF-11 `worker/cron.ts`, one per SELF call, whatever `cron_host` is |
  | `cron.skipped` | `route`, `host` | R-CF-11 `lib/cron/guard.ts` (the non-owner host's 204) |
  | `cron.fanout` | `route`, `kind`, `count` | R-CF-11 |
  | `cron.unknown_expression` | `cron` | R-CF-11 `worker/cron.ts` |
  | `deferred.done`, `deferred.again`, `deferred.dup`, `deferred.dead`, `deferred.error` | `kind`, `key`, `hop`, `attempt`, `trace_id`, `duration_ms` | R-CF-06 `app/api/internal/defer/route.ts`, one per queue message. The DLQ path also emits `deferred.dead`. |
  | `deferred.inline_budget_exhausted`, `deferred.skip_vercel` | `kind`, `key` | R-CF-06 Vercel fallback |
  | `imessage.send` | `op`, `transport`, `outcome`, `duration_ms` | R-CF-03 transport sender (`lib/imessage/transportSender.ts`), one per send |
  | `relay.health` | `instance`, `ready`, `inflight` | R-CF-03 air-sidecar keep-warm alarm |
  | `relay.send` | `op`, `outcome`, `duration_ms` | R-CF-03 air-sidecar relay |
  | `creative.events.closed` | `reason` | R-CF-07 creative SSE route |

  - Pre-existing lines keep their names, because existing tests and readers depend on them: `cron sweep`, `cron schedules`, `cron trade`, `cron publish` (`app/api/cron/*/route.ts`) and `imessage ttfk reaction` (`lib/routing/imessage.ts:148-158`).
  - R-CF-11's four new route duration lines (`ads`, `ad-metrics`, `sources`, `health`) copy that `cron <route>` form (`publish/route.ts:24-30`). Q5 and §5 check 11 then read one family for all 8 routes.
  - Any other new event follows `<area>.<event>`, and the PR that produces it adds it to this table.
- **`infra/workers/sidecar/src/*`** (created in R-CF-03 and R-CF-09):
  - `{msg:"relay.health", instance, ready, inflight}` from the keep-warm alarm.
  - `{msg:"relay.send", op, outcome, duration_ms}`.
  - Never log message bodies. Telemetry "never records message contents" (`docs/operations/imessage-ttfk.md:13`).
- **NEW `docs/operations/cloudflare-observability.md`.** It holds the canonical log table above, plus the saved queries, alerts, budgets, cost model and weekly review below.
- **NEW `apps/web/scripts/cf-usage.mjs`.** Local-only; the owner runs it (§6.20). It needs a separate local token with Account Analytics Read (§6.10). That scope does not go on the CI token.
  - It pulls GraphQL Analytics for each `scriptName` over the last 24 h and 7 d:
    - from `workersInvocationsAdaptive`: requests, errors by status (`scriptThrewException`, `exceededResources`, `internalError`) and CPU p50/p99;
    - from `durableObjectsPeriodicGroups`: DO usage, including month-to-date duration in GB-s;
    - container running time per class.
  - Dataset and field names are unconfirmed (verify).
  - It compares the numbers with the budget table and exits non-zero on a breach.
- **Alerts.** Configure them under Observability → Alerts → Monitors (Beta since 2026-10-02).
  - Monitors evaluate SQL API datasets, and SQL API log datasets include Workers logs. So A1–A8 are Monitors over the Workers logs dataset (verify the dataset name and field mapping). They match on `$workers.*` fields or on a `msg` from the canonical table. A9 is a billing budget alert.
  - Destinations: the owner's email plus one webhook. Webhooks are available on all plans since 2026-10-02.

| ID | Signal | Threshold | Catches |
|---|---|---|---|
| A1 | airv2-app `$workers.outcome = "exception"` (1101) | ≥ 10 per 5 min | Uncaught exceptions, including `required()` env throws (the PR #522 class) |
| A2 | airv2-app, air-sidecar or air-build `$workers.outcome` in (`exceededCpu`, `exceededMemory`) (1102) | ≥ 1 per 5 min | CPU or 128 MB memory overrun |
| A3 | `$workers.event.response.status >= 500` ratio on app, mini or link | > 2 % over 10 min | User-visible errors, including proxy mode |
| A4 | `msg = "cron.dispatch"` count | 0 in 3 min | Crons silently stopped. `scheduled()` dispatches every minute whatever `cron_host` is (§2.5 C13), so the monitor needs no `cron_host` condition. |
| A5 | `msg = "deferred.dead"` | ≥ 1 per 15 min | Lost background work |
| A6 | `creative-job` instances `errored` (Workflows analytics or an R-CF-08 log line; verify) | ≥ 3 per 1 h | Creative pipeline failures |
| A7 | `msg = "relay.health"` with `ready = false`, or fewer than 2 ready instances (`relay-0`, `relay-1`) | 2 consecutive alarms | iMessage outbound down |
| A8 | `msg = "imessage ttfk reaction"` with `within_sla = false` (`lib/routing/imessage.ts:148-158`) | > 10 % per 1 h | The 1 s tapback SLA (`lib/orchestrator/ttfk.ts:10`) |
| A9 | Billing budget alerts (Billing → Billable Usage) | $25, $30, $45 | Cost. They fire the day after the threshold is crossed and exclude the $5 fee. Expected usage without the fee is about $17–19 (§3.3). |

- **Saved queries** (Workers Observability Query Builder):
  - **Q1, errors:** `$metadata.service = "airv2-app" AND $workers.outcome != "ok"`, grouped by `$workers.outcome` and `$workers.event.request.path`.
  - **Q2, exceptions:** `$metadata.error EXISTS`, showing the message. Use it to classify PR #522's 500s before any performance work (R-CF-12).
  - **Q3, CPU:** p50, p99 and max of `$workers.cpuTimeMs`, grouped by `$workers.event.request.path`.
  - **Q4, long tails:** `$workers.wallTimeMs > 25000`. This finds remaining `after()` work near the 30 s `waitUntil` cap.
  - **Q5, crons:** `msg` in {`cron sweep`, `cron schedules`, `cron trade`, `cron publish`, `cron ads`, `cron ad-metrics`, `cron sources`, `cron health`}, p95 of `duration_ms`. The existing log lines are at `app/api/cron/sweep/route.ts:248-251`, `schedules/route.ts:26`, `trade/route.ts:43` and `publish/route.ts:26`. R-CF-11 adds the other four.
  - **Q6, TTFK:** p95 of `elapsed_ms` and the within-SLA ratio for `msg = "imessage ttfk reaction"`.
  - **Q7, env:** `msg = "env.unpack"`, digest per version.
- **Budgets and limits.** Tune them only from measured data.

| Surface | Config | Start | Tuning rule |
|---|---|---|---|
| airv2-app fetch CPU | `limits.cpu_ms` | 60,000 (contract) | After 7 days of P4: max(60,000, 2 × max `cpuTimeMs` of `ok` invocations in Q3), capped at 300,000. Prefer moving heavy work out over raising it. |
| Subrequests | `limits.subrequests` | Paid default 10,000 | Raise only for a logged "Too many subrequests" |
| Startup | 1 s platform limit | — | R-CF-13 reads `startup_time_ms` from the deploy's wrangler output file (`WRANGLER_OUTPUT_FILE_PATH`; verify the field on 4.149.0) and warns above 800 ms |
| Memory | 128 MB per isolate, shared by concurrent requests | — | Memory Usage chart p99 > 100 MB means investigate; any `exceededMemory` raises A2 |
| air-build | `limits.cpu_ms` | 300,000 | Peak memory from the Memory Usage chart |
| Containers | Instance type; `max_instances` (MediaWorker); `RELAY_INSTANCES` (relay) | Relay lite (or basic) × 2, fixed as `relay-0` and `relay-1`; MediaWorker standard-1 with `max_instances` 2 and `sleepAfter` 2 min; TenkiRelay × 1 if used (§2.5 C14) | Move the relay to basic only if A7 fires on memory (§6.16). MediaWorker running time over 10 h/day is a breach (§3.5). |
| DO duration | Month-to-date GB-s (`cf-usage.mjs`) | One rounded 1M GB-s unit expected (§3.3) | Breach at 1.3M GB-s; a second unit needs more than 1.4M GB-s (§3.5) |
| Queue / Workflows | DLQ, `max_retries`, explicit `WorkflowStepConfig` | Per R-CF-06 (§2.5 C7) and R-CF-08 (§2.5 C9) | A5 and A6 silent for 7 days |
| Images | Binding | 5,000 unique transforms/month free | Per-user budget (R-CF-09) |
| Error budget | — | 1101 + 1102 < 0.1 % of airv2-app requests per day | P4 and P5 exit gate |

- **Cost model.** These are estimates. Refine them in week 1 with `cf-usage.mjs` and Billable Usage. Rates are from developers.cloudflare.com/workers/platform/pricing/, /containers/platform/pricing/ and /durable-objects/platform/pricing/. The figures match §3.3.

| Line | Included on Paid | Expected now | Estimated $/month |
|---|---|---|---|
| Subscription | — | — | 5.00 |
| Workers requests | 10M/month, then $0.30/M | ~0.6–1M (15–25k/day, plus 4.8k cron dispatches/day, plus queue, DO and Workflow invocations; est.) | 0 |
| Workers CPU | 30M CPU-ms, then $0.02/M | ~20–60M ms (est.) | 0–0.60 |
| ImessageRelay, 2× lite always on (`relay-0`, `relay-1`) | 25 GiB-h memory, 375 vCPU-min, 200 GB-h disk | ~365 GiB-h, ~2,920 GB-h | ~3.75 (~14.35 if basic) |
| Container Durable Objects | 1M requests, 400k GB-s | Duration accrues only while each DO is active: requests, alarms, and pending I/O up to 15 min each, including a pending `ctx.container.monitor()` on compat ≥ 2026-10-01. Expected case (§3.3): 2 always-active DOs × 128 MB ≈ 657k GB-s. Billable usage rounds up to a 1M GB-s unit. A second unit needs more than 1.4M GB-s. | 12.50 expected; 0 only if container DOs prove eligible for eviction |
| MediaWorker, standard-1, `max_instances` 2 | Shared with the above | ~0.33 GiB-h per stitch | < 1 at 100 stitches |
| Workflows / Queues / KV | 500k steps; 1M queue operations (≈ 3 per message); 10M KV reads | Within allowance | 0 |
| Workers Logs | 20M events until 2026-11-30; 50 GB/cycle after | A few M events / < 10 GB (est.) | 0 |
| **Total** | | | **≈ 22–24 expected; ≈ 9–11 if container DOs prove eligible for eviction** |

- **Dashboards to read at each phase's exit review:**
  - Workers & Pages → airv2-app → Metrics: errors by invocation status, CPU time, Memory Usage P50–P999.
  - Containers: `npx wrangler containers list`, then `npx wrangler containers info <id>`.
  - Workflows: `npx wrangler workflows instances list creative-job --status errored` (R-CF-08). Run the same for `air-schedule-run` and `air-fleet-sync` (R-CF-11).
  - Queues: `npx wrangler queues info air-deferred`, plus its DLQ `air-deferred-dlq` (R-CF-06).
  - Durable Objects: requests, duration and Total storage for `ConversationDO` and `BoxLifecycle`. Read the container DOs (`ImessageRelay`, `MediaWorker`) separately (§3.4).
  - Workers Issues, which groups recurring exceptions; route it to the alert destinations.

**Acceptance.**
- [ ] Workers Logs shows invocation logs at sampling 1 for airv2-app, and for air-sidecar (including container logs) and air-build once each is deployed. Request URLs show query strings redacted.
- [ ] Q1–Q7 and the canonical log table are saved and linked from `docs/operations/cloudflare-observability.md`.
- [ ] Alerts go live in stages, and each one has fired once (test notification or a temporarily lowered threshold):
  - A1–A3 and A9 before P2;
  - A5 when R-CF-06 lands and A4 when R-CF-11 lands (P3);
  - A6–A8 before P4.
- [ ] Every log-based alert and query matches a `msg` from the canonical table (or a pre-existing line it names), and each producing item's tests assert that name (§2.5 C16).
- [ ] The PR #522 500s are classified through Q2, with the root cause recorded, before any performance work.
- [ ] `cf-usage.mjs` passes the budget table at P3, P4 and P5 exit (owner-run, §6.20).
- [ ] `limits.cpu_ms` is re-set from Q3 data after 7 days of P4, and the commit message cites the measured max.
- [ ] Zero `exceededMemory` over the 7 days after P5, and 1101 + 1102 < 0.1 % per day.
- [ ] No log line contains an env value, token or message body (test below).

**Tests.**
- Log-line assertions live in each producer's test file and land with that producer:
  - `apps/web/worker/cron.test.ts` (R-CF-11): `runScheduled` emits one `cron.dispatch` line per due path, with status, duration and `scheduled_time`.
  - `apps/web/app/api/internal/defer/route.test.ts` (R-CF-06): one `deferred.<outcome>` line per message; the DLQ path emits `deferred.dead`.
  - `apps/web/worker/switch.test.ts` (R-CF-02): a successful POST emits exactly one `switch.flip`.
- `apps/web/worker/handler.test.ts` (R-CF-02's file; this item adds the case in P1): seed a sentinel secret into the env packs and assert that no captured console line contains it, including `env.unpack`.
- NEW `apps/web/wrangler.config.test.ts`:
  - Read `wrangler.jsonc` through wrangler's config reader (verify the export name in 4.149.0; otherwise parse JSONC).
  - Assert `observability.redact_query_string === true`, `logs.head_sampling_rate === 1` and no top-level `cache`.
- NEW `apps/web/scripts/cf-usage.test.ts`: evaluate the budgets over a fixture GraphQL response, including the DO-duration and MediaWorker running-time rows. A breach exits 1; a clean run exits 0.
- `apps/web/lib/log.test.ts` stays unchanged and green.
- Manual probes:
  - Errors: `npx wrangler tail airv2-app --format json --status error | jq -c '{t:.eventTimestamp,o:.outcome,u:.event.request.url,e:[.exceptions[]?.message]}'`. `--status error` maps to `exception`, `exceededCpu`, `exceededMemory` and `unknown` (wrangler 4.149.0 `parseOutcome`, `cli.js` ~l.308445).
  - CPU per route comes from Q3. If the tail JSON carries `cpuTime` and `wallTime` (verify on 4.149.0), print them with `jq` as well.
  - `npx wrangler check startup` for the 1 s limit.
  - Before P4, load `/`, `/home` and the mini store home 20 times each on workers.dev, and record the Q3 p99 as the baseline.

**Risks & notes.**
- **Sampling.** Head sampling drops whole invocations, errors included. A1–A8 are log-based, so they see only sampled invocations. Keep sampling at 1 on every Worker that has a log-based alert. Lower it only after the December volume is known.
- **Pricing change.** The 2026-12-01 pricing change lands mid-rollout. Traces and container logs then count toward ingestion.
- **DO duration.** Container-DO duration depends on how R-CF-03 keeps the relay warm. Read Billable Usage in week 1. Avoid holding a `monitor()` promise across alarms unless its duration is budgeted.
- **Denial of wallet.** `limits.cpu_ms` also guards against denial-of-wallet. A global 300,000 on airv2-app widens the blast radius of a runaway loop.
- **Shared memory.** 128 MB is per isolate, so one buffered attachment or zip can 1102 unrelated requests that share the isolate. R-CF-03, R-CF-09 and R-CF-10 bound this.
- **No CDN cache.** Nothing caches in front of the Worker, so the store home's `s-maxage` (`middleware.ts:232`) no longer caches anything. Budget its SSR cost in Q3.
- **Phone numbers in logs.**
  - Existing log lines carry `space_id` (`lib/routing/imessage.ts:152`). The space id is the chat guid `iMessage;-;<handle>` (`lib/location/address.ts:4`), so it can contain a phone number.
  - Workers Logs keeps these lines for 7 days, readable by anyone with account observability read. Restrict account membership.

**Depends on.** R-CF-02 (the handler, switch, proxy and env-unpack emitters; through it, R-CF-01's packs for the sentinel test) and R-CF-13 (size and startup gates). The later stages do not block this item's P1 PR. The air-sidecar and air-build blocks, the producers' log lines and the A4–A7 monitors land in, or right after, R-CF-03, R-CF-06, R-CF-08, R-CF-09, R-CF-10 and R-CF-11, which follow the canonical table.
