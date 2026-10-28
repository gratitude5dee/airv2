# R-CF-06 — Durable deferred work (replace long after())

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-06: …`.

**Why.** OpenNext maps `after()` to `ctx.waitUntil`. That allows only 30 s after the response or client disconnect, on Paid too, and the 30 s covers every `waitUntil` in the invocation (https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil). `apps/web` has 27 non-test `after(` call sites (grep at HEAD 767b98c) across 15 files that import `after` from `next/server`. Several wake a box (up to ~420 s), hold a Hermes run, or provision (route budget 800 s, `lib/provisioning/provision.ts:91`), and on Workers those die silently mid-work. The durable home here is a Queue consumer: 15 min wall per invocation, `delaySeconds` up to 86,400, DLQ (https://developers.cloudflare.com/workers/platform/limits/#duration, https://developers.cloudflare.com/queues/configuration/javascript-apis/, https://developers.cloudflare.com/queues/configuration/dead-letter-queues/). Other items own their Workflows and DOs.

**Deltas.**

Inventory of all non-test `after(` call sites (lines as of HEAD 767b98c):

| # | Site | Work | Worst case | Decision |
|---|---|---|---|---|
| 1 | `app/api/admin/traces/route.ts:84` | `mirrorReceipts` to W&B (dormant: no `WANDB_API_KEY`, `lib/traces/weave.ts:17-19`) | ~5 fetches, <10 s | keep |
| 2 | `app/api/me/traces/export/route.ts:87` | same | <10 s | keep |
| 3 | `app/api/gateway/v1/[...path]/route.ts:385` | `releaseAppSpend` (1 RPC) | <2 s | keep |
| 4 | `…/route.ts:1069` | `meter()` at stream end: `agent_runs` insert + `add_spend` + `settleAppSpend` (`lib/gateway/metering.ts:36-93`) | <3 s | keep (R-CF-07 verifies it on OpenNext) |
| 5 | `…/route.ts:1084` | settle or release the hold on a usage-less stream | <2 s | keep (as #4) |
| 6 | `…/route.ts:1108` | `meter()` (non-stream) | <3 s | keep |
| 7 | `app/api/muse/grants/route.ts:37` | `writeConnectedToolsFile` → `ensureComputeAwake` (cold wake) + 180 s box command (`lib/provisioning/connectors.ts:174-229`) | ~10 min | **defer** `box.connected_tools` |
| 8 | `app/api/muse/air/[capability]/route.ts:39` | `observeMuseRun`: `ensureBoxAwake` + ≤14 s SSE, closes `agent_runs` (`lib/muse/capabilities.ts:199-247`) | 14 s warm; minutes cold | R-CF-07 (`run.finalize`) |
| 9 | `app/api/inbound/imessage/route.ts:197` | "text me from your phone" `sendLineReply` | <10 s | R-CF-04 |
| 10 | `…/imessage/route.ts:239` | onboarding reply + `provisionComputeWithWelcome` (`lib/provisioning/welcome.ts:74-84`) | ~13 min | R-CF-04 (DO sends the reply, then `defer("provision.compute")`; the kind is defined here) |
| 11 | `…/imessage/route.ts:305` | `maybeHandleMuseInbound` + reply | <30 s (verify) | R-CF-04 |
| 12 | `…/imessage/route.ts:356` | Onairos relay (30 s timeout, `lib/onairos/spectrum.ts:97`) + grants + reply | >30 s | R-CF-04 |
| 13 | `…/imessage/route.ts:463` | prewarm, tapback, first bubble, `flushAfterDebounce` → `runFlush` (`lib/orchestrator/flush.ts:2139`, `:1015`) | minutes | R-CF-04 |
| 14 | `app/api/inbound/email/route.ts:91` | `processInboundEmail`: getMessage, trust, spam, `ensureBoxAwake`, `createRun`, whole SSE, reply or draft (`lib/email/inbound.ts:160-290`) | wake 420 s + run | **defer** `email.turn` |
| 15 | `app/api/inbound/calcom/route.ts:98` | `ensureBoxAwake` + `nudgeSync`, one wait of `retryAfterSeconds` on `MigrationBusyError` (`:98-128`) | ~7 min + pause | **defer** `calendar.nudge` |
| 16 | `app/api/chat/route.ts:137` | `runTwinCommand` render | ≥420 s | R-CF-08 |
| 17 | `app/api/chat/route.ts:202` | `executeCreativeJob` | 420 s + resume | R-CF-08 |
| 18 | `app/api/create/build/route.ts:112` | keeps the build promise alive past the hold | ≤300 s | R-CF-10 |
| 19 | `app/api/internal/create/turn/route.ts:172` | `consumeAndReport`: wake, whole run SSE, `closeCreateRunRow`, `turn_done` (`:70-114`) | ≤800 s | R-CF-07 `run.finalize`; R-CF-10 registers the `create.turn_done` continuation and deletes this `after()` (§2.5 C7). No `create.turn.report` kind exists |
| 20 | `lib/routing/imessage.ts:93` | `closeWarmSpectrumSender` | <1 s (no-op on the relay transport, R-CF-03) | keep |
| 21 | `lib/miniapps/onboardingMirror.ts:306` | `refreshStatusMirrorIfAwake`: 5 box reads, only if `peekBoxState` says awake (`:281-288`) | <25 s (verify box-read timeouts) | keep (a cut leaves a stale mirror; harmless) |
| 22 | `lib/miniapps/apps/onboarding.tsx:737` | same (stale-while-revalidate) | <25 s | keep |
| 23 | `…/onboarding.tsx:3014` | `updateMiniAppCard` (iMessage card edit) | <10 s | keep (needs R-CF-03) |
| 24 | `…/onboarding.tsx:3112` | `syncConnections` (Composio read, `lib/connectors/manage.ts:104`) | <10 s (verify) | keep |
| 25 | `…/onboarding.tsx:3934` | `enableVideoAvatar` (`lib/identity/twin.ts:587`) | minutes | R-CF-08 |
| 26 | `lib/miniapps/apps/freeze.tsx:321` | `executeFreezeSketch` | ≤420 s | R-CF-08 |
| 27 | `lib/miniapps/apps/freeze.tsx:458` | `executeFreezeRender` (fal + ffmpeg stitch) | 420 s + 300 s | R-CF-08 + R-CF-09 |

Detached work outside `after()` that is just as exposed:
- `lib/orchestrator/boxes.ts:329,386,391,396`: R-CF-05 moves it to the DO post-wake alarm.
- `lib/chat/relay.ts:137,143` and `lib/bots/chat.ts:91,97`: R-CF-07 moves it to `captureKeepAlive`.

- `apps/web/lib/runtime/defer.ts` NEW:

  ```ts
  export type DeferKind = "email.turn" | "calendar.nudge" | "box.connected_tools"
    | "provision.compute" | "run.finalize";          // run.finalize: added with its row by R-CF-07 (§2.5 C7)
  export interface DeferOptions { key: string; delaySeconds?: number; hop?: number }
  /** Durable. CF (cfEnv()?.DEFERRED bound; lib/runtime/platform.ts, §2.5 C2): await send, retry once, else throw DeferSendError.
   *  Vercel: per-kind vercelInline(payload) ? after(() => executeInline(msg)) : skip;
   *  outside a request scope (after() throws) → void executeInline(msg). */
  export function defer<K extends DeferKind>(kind: K, payload: DeferPayloads[K], opts: DeferOptions): Promise<void>;
  /** Short best-effort work (<~25 s): after() in a Next scope, else cfWaitUntil(p) (lib/runtime/platform.ts), else void. */
  export function keepAlive(work: Promise<unknown> | (() => Promise<unknown>)): void;
  /** For stream callbacks. Call while still in request scope: it opens one hold through after() or cfWaitUntil()
   *  (§2.5 C2). keep(p) adds p; the hold settles once the kept work has settled. Callers keep their
   *  stream-end work on both the flush and the cancel path. */
  export function captureKeepAlive(): (p: Promise<unknown>) => void;
  /** Stable key from arbitrary ids: `${prefix}:${base64url(sha256(parts.join("\x1f"))).slice(0,32)}`. */
  export function deferKey(prefix: string, ...parts: string[]): string;
  ```

  - Validate each payload with its kind's zod schema.
  - Reject JSON over 8 KiB. The Queue limit is 128 KB per message, so this is our own cap.
  - `key` must match `^[A-Za-z0-9:_.@-]{1,200}$`. RFC-822 message ids and cal.com keys do not, so always build keys from raw ids with `deferKey()`.
  - Payloads carry ids and enums only (repo constraint C4, `docs/goal-air2.md:21`; not §2.5 C4): no bodies, prompts, addresses or tokens.
  - No other context helper: the Workers paths use only `cfEnv()` and `cfWaitUntil()` from `lib/runtime/platform.ts` (R-CF-12, §2.5 C2), so `defer()` also works when called from a DO phase, a Workflow step or the queue route.
- Message schema, `lib/runtime/deferTypes.ts` NEW:

  ```ts
  interface DeferredMessage<K extends DeferKind = DeferKind> {
    v: 1; kind: K; key: string; payload: DeferPayloads[K];
    hop: number;          // 0 on first send, +1 per "again"
    enqueuedAt: number;   // epoch ms
    traceId: string;      // crypto.randomUUID(), logged only
  }
  ```

- `apps/web/lib/runtime/deferHandlers.ts` NEW. Registry entries are `{schema, maxSeconds, maxHops, vercelInline, run: lazy import}`. Each `run(payload, {supabase, attempt, hop})` returns one of:
  - `{status:"done"}`
  - `{status:"again", afterSeconds, payload?}`
  - `{status:"dead", reason}`

  | Kind | Handler | maxSeconds | maxHops | Key | Producer |
  |---|---|---|---|---|---|
  | `email.turn` | `lib/email/turn.ts` NEW (below) | 600 | 400 | `deferKey("email", inboxId, messageId)` | email route |
  | `calendar.nudge` | `lib/calendar/nudge.ts` NEW: body of calcom `:98-128`. `MigrationBusyError` at hop 0 → `again(retryAfterSeconds)`; at hop 1 → `dead`. `armStopAfter` in `finally` | 600 | 1 | `deferKey("calcom", accountId, calcomDedupeKey(envelope))` | calcom route |
  | `box.connected_tools` | `writeConnectedToolsFile(serviceClient(), userId)` | 780 (wake 420 + command 180+60) | 0 | `tools:${grantId}` | muse grants |
  | `provision.compute` | `provisionComputeWithWelcome` | 840 | 0 | `deferKey("provision", userId, messageId)` | R-CF-04 |
  | `run.finalize` | `lib/runs/finalize.ts` (R-CF-07) | 60 | 2000 (safety net; the handler's own deadline ends first) | `run:${runId}` | R-CF-07 |

  - `vercelInline` returns true for every kind except `run.finalize`, which R-CF-07 defines.
  - This is the only deferred-work registry (§2.5 C7). R-CF-06 registers the first four kinds. Each later PR adds its row to this table and its member to `DeferKind`/`DeferPayloads` in the same PR, with `run` lazily importing its own module:
    - R-CF-07: `run.finalize` (`lib/runs/finalize.ts`);
    - R-CF-10: `create.build`;
    - R-CF-11: `cron.publish.user`, `cron.ads.metaReport`, `cron.sources.user` and `cron.migration.drive` (`lib/cron/jobs.ts`).
  - Kind names are `<area>.<verb>`. No item keeps a second table or uses another field name, such as `maxWallMs`.
  - Every row has `maxSeconds` ≤ 840. The route's race against `maxSeconds` (below) is the only wall guard. The consumer does no per-kind wall check, and it gets none from later items.
- `apps/web/lib/hermes/client.ts`: add `getRun(target, runId): Promise<HermesRunStatus | null>`. R-CF-06 owns it because it lands first in P3 (§2.5 C6). R-CF-04, R-CF-07 and R-CF-10 reuse it and add no second getter.
  - `GET /v1/runs/{id}` through `hermesFetch` (`:101-125`), with `signal: AbortSignal.timeout(15_000)`.
  - `HermesApiError(404)` → `null`. Callers map `null` to `run_not_found` / `lost`.
  - Schema: `z.object({run_id: z.string().optional(), status: z.string(), created_at: z.number().nullish(), updated_at: z.number().nullish(), output: z.string().nullish(), error: z.string().nullish(), last_event: z.string().nullish()}).passthrough()`. This is the superset R-CF-04 needs (its F1 math reads `updated_at`).
  - The pinned Hermes `d337b73` (`infra/template/setup.sh:12`) already serves the route:
    - `api_server_runs.py:188` registers `GET /v1/runs/{run_id}`, and `:1008-1012` is `_handle_get_run`;
    - `_set_run_status` (`:210-217`) writes `run_id`, `status`, `updated_at` and `created_at` in epoch seconds;
    - `output` is `final_response` (`:937`).

    No hermes-host change is needed. Only the client and the stub lack the route.
  - Add a JSDoc invariant on `runEvents` (`:197`): one subscriber per run; background code must use `getRun`.
- `apps/web/lib/hermes/runStatus.ts` NEW: `TERMINAL = {"completed","failed","cancelled","interrupted"}`, matching hermes `TERMINAL_STATUSES`. `toOutcome(status | null)` maps 404 to `"lost"`.
- `apps/web/lib/runs/poll.ts` NEW: `pollRunOnce(supabase, {userId, runId, apiServerKey?})` returns `{state:"terminal", status, output} | {state:"running"} | {state:"lost"}`.
  - Read `loadBoxCredentials` (`lib/box/credentials.ts:71`); it never wakes.
    - No row, or `state==="stopped"` → `lost`.
    - Any other non-ready state → `running`.
  - Call `getRun`.
  - While running, keep the box alive without changing semantics:
    - If `stop_after is null`, set `last_active_at=now()`. The sweeper's leaked-null check (`lib/orchestrator/sweep.ts:16,38-44`) must not fire on runs over 30 min.
    - Otherwise call `armStopAfter` (monotonic, `lib/orchestrator/boxes.ts:459`).
- `lib/email/turn.ts` NEW splits `processInboundEmail` (`lib/email/inbound.ts:160-290`) into hops.
  - **Hop 0:**
    - Run the existing pre-run logic (`:166-231`), then `ensureBoxAwake` (`:232`), then `createRun` (`:240-243`) with `idempotencyKey: payload key`. `RunRequest` supports it (`lib/hermes/client.ts:62`); the Hermes key charset is (verify).
    - Return `again(10, {...payload, runId, tier, startedAt})`.
    - `MigrationBusyError` → `holdReceipt` (unchanged; route `:95-102`), then done.
    - Pre-run side effects must tolerate a retry after a consumer kill (spam labels, `createDecision` for tier 2). Verify that `createDecision` dedupes on `(user_id, kind, ref)` (verify).
  - **Hop n:** `pollRunOnce`.
    - `running` → `again(min(10·2^n, 60))`.
    - `lost` → log, `armStopAfter`, done.
    - `terminal` with output:
      - Re-fetch the message (subject, from).
      - Tier 0 replies (`replyToMessage`, idempotency key mapping at `:255-257`); tier 1 drafts (`client_id` at `:266`) + `queueEmailDraftReview`.
      - Insert `agent_runs` (`:280-288`) only if no row with that `hermes_run_id` exists.
      - `armStopAfter`.
  - No SSE is held, so the handler is safe to retry.
- `apps/web/app/api/internal/defer/route.ts` NEW. `runtime="nodejs"`, `requireCron` (`lib/auth/guard.ts:173`). The body is a `DeferredMessage`. It is reached only through `selfFetch` → `SELF` → the `Internal` entrypoint (§2.5 C1).
  - Call `claim_deferred(key, kind, hop, maxSeconds+60)`:
    - `done` or `dup` → 200 `{result:"dup"}`
    - `dead` → 422
    - `busy` → 409 + `Retry-After: <lease remaining>`
    - `run` → execute, racing the handler against `maxSeconds`.
  - Handler results:
    - `done` → `finish_deferred(key,'done')`, 200.
    - `again`, within `maxHops` → **send first**: `defer(kind, payload', {key, delaySeconds, hop: hop+1})`. Then `finish_deferred(key,'queued', hop+1)`, 200.
    - `again` past `maxHops` → `dead`.
    - `dead` or invalid payload → `finish_deferred(key,'dead', hop, reason)`, 422.
    - throw or timeout → `finish_deferred(key,'queued', hop, errorClass)`, 503.
  - Header `x-air-defer-dead: 1` (DLQ path) → `mark_deferred_dead(key, hop)`, 200. It marks the row dead only when the row's `hop = msg.hop`, the status is not `done`, and no live lease is held. A busy duplicate that exhausted retries can then never kill a live job.
  - Log `deferred.{done,again,dup,dead,error}` with `{kind, key, hop, attempt, trace_id, duration_ms}` only, through `log` (`lib/log.ts`). These are R-CF-15's canonical names (§2.5 C16). The route emits them. The consumer emits no second line per message, except `deferred.error` when the SELF call itself throws.
- `supabase/migrations/NNNN_deferred_jobs.sql` NEW. Take the next free number at merge; the highest today is `0140` (§2.5 C23). It creates no extension.

  ```sql
  create table deferred_jobs (
    key text primary key check (char_length(key) <= 200),
    kind text not null,
    hop int not null default 0,
    status text not null check (status in ('queued','running','done','dead')),
    attempts int not null default 0,
    lease_until timestamptz,
    last_error text check (char_length(last_error) <= 200), -- error class only (goal-air2 C4)
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    done_at timestamptz
  );
  alter table deferred_jobs enable row level security;
  create index deferred_jobs_status_updated_idx on deferred_jobs (status, updated_at);
  -- claim_deferred(p_key text, p_kind text, p_hop int, p_lease_seconds int)
  --   returns table(outcome text, retry_after_seconds int):
  --   insert (key, kind, hop=p_hop, status='running', attempts=1, lease_until=now()+lease)
  --   on conflict (key) do update set status='running', hop=p_hop, attempts=attempts+1, lease_until=now()+lease
  --     where status not in ('done','dead') and p_hop >= deferred_jobs.hop
  --       and (lease_until is null or lease_until < now());
  --   else report: done | dead | dup (p_hop < hop) | busy (lease held; retry_after = lease remaining).
  -- finish_deferred(p_key text, p_status text, p_hop int default null, p_error text default null) returns void
  --   (hop = coalesce(p_hop, hop); clears lease; done_at on 'done').
  -- mark_deferred_dead(p_key text, p_hop int) returns void (guarded as above).
  -- All: language plpgsql security definer set search_path = public;
  --   revoke all … from public; grant execute … to service_role;   (style of 0106_compute_migrations.sql:224-238)
  ```

  R-CF-11's sweep deletes `done` rows older than 14 days (`status = 'done' and done_at < now() - interval '14 days'`).
- `apps/web/worker/queue.ts` NEW: `consumeDeferred`. R-CF-02's entry wires it into `queue()`, whose first statement is `applyEnv(env)` (§2.5 C3):

  ```ts
  // apps/web/worker/entry.ts (R-CF-02):
  //   async queue(batch, env, ctx) { applyEnv(env); await consumeDeferred(batch, env, ctx); }
  import { selfFetch } from "../lib/http/self";             // SELF → Internal entrypoint (§2.5 C1, C3)

  export async function consumeDeferred(batch: MessageBatch<DeferredMessage>, env: CloudflareEnv, _ctx: ExecutionContext) {
    const backoff = (n: number) => Math.min(30 * 2 ** (n - 1), 900);
    const dead = batch.queue === "air-deferred-dlq";
    for (const msg of batch.messages) {
      try {
        const res = await selfFetch("/api/internal/defer", {
          method: "POST", body: JSON.stringify(msg.body),
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, "content-type": "application/json",
                     "x-air-defer-attempt": String(msg.attempts), ...(dead ? { "x-air-defer-dead": "1" } : {}) } },
          { env });                                            // URL = new URL(path, env.appOrigin()); never AIR_PUBLIC_ORIGIN
        if (res.ok || res.status === 422) msg.ack();
        else if (res.status === 409) {
          const ra = Number(res.headers.get("retry-after")) || 60;
          msg.retry({ delaySeconds: Math.min(Math.max(ra, 1), 900) });
        } else msg.retry({ delaySeconds: backoff(msg.attempts) });
      } catch { msg.retry({ delaySeconds: backoff(msg.attempts) }); }   // logs deferred.error
    }
  }
  ```

  - `applyEnv(env)` runs first, so `CRON_SECRET` comes from the current digest after a rotation on a reused isolate.
  - The handler runs in its own SELF invocation: its own CPU budget under `limits.cpu_ms`, and no wall limit while the consumer waits. The consumer's 15 min wall is the cap, hence `maxSeconds` ≤ 840.
  - `SELF` targets the `Internal` entrypoint, which never runs the hosting switch or `proxyToVercel` (§2.5 C1). So `/api/internal/defer` is always served by this build, whatever the HOSTING target, and the public handler gets no path exemption.
  - `Internal` never strips headers, so `x-air-defer-attempt` and `x-air-defer-dead` arrive intact. The public `fetch` strips every inbound `x-air-*` header, so an outside caller cannot set `x-air-defer-dead`.
- `apps/web/wrangler.jsonc`:

  ```jsonc
  "queues": {
    "producers": [ { "binding": "DEFERRED", "queue": "air-deferred" } ],
    "consumers": [
      { "queue": "air-deferred", "max_batch_size": 1, "max_retries": 8, "retry_delay": 30,
        "dead_letter_queue": "air-deferred-dlq", "max_concurrency": 25 },
      { "queue": "air-deferred-dlq", "max_batch_size": 10, "max_retries": 3 }
    ]
  }
  ```

  - These values are canonical (§2.5 C7). R-CF-02's end-state sketch only points at them (§2.5 C10).
  - With `max_batch_size` 1, a batch is dispatched as soon as one message is available. No `max_batch_timeout` is needed, which already meets R-CF-10's low-latency need.
  - R-CF-13's `ensure-resources` job (§2.5 C18) creates both queues before the deploy that first binds them. This PR adds `wrangler queues create air-deferred || true` and `wrangler queues create air-deferred-dlq || true` to that job.
  - Regenerate `apps/web/worker/worker-configuration.d.ts` with `npm run cf:types` in this PR (§2.5 C4); never hand-edit it. Root code (`lib/runtime/defer.ts`) reads `DEFERRED` through a local structural type: `{ DEFERRED?: { send(m: DeferredMessage, o?: { delaySeconds?: number }): Promise<void> } }`.
- Producer swaps:
  - `app/api/inbound/email/route.ts:87-107` → `await defer("email.turn", {userId, inboxId, messageId}, {key})`.
  - `app/api/inbound/calcom/route.ts:98-128` → `await defer("calendar.nudge", {userId, accountId, dedupeKey}, {key})`.
  - For both webhooks, on `DeferSendError`: delete the `inbound_events` dedupe row (`webhook_id`, `message_id` exactly as passed to `dedupeInboundEvent`; same pattern as the signup failure path, `app/api/inbound/imessage/route.ts:180-187`). Return 503 so the provider redelivers.
  - `app/api/muse/grants/route.ts:37` → `defer("box.connected_tools", {userId}, {key:\`tools:${grant.id}\`})`; on a send failure, fall back to `keepAlive`.
- Vercel fallback: `executeInline(msg)` calls the same `executeDeferred()` as the route, with the same ledger.
  - `again` sleeps in-process while `elapsed + afterSeconds < 760 s`; otherwise it logs `deferred.inline_budget_exhausted`.
  - Kinds with `vercelInline(payload) === false` are skipped (logged `deferred.skip_vercel`).
  - Both log names join R-CF-15's table (§2.5 C16).
  - Vercel is the rollback target only.
- `apps/web/lib/runtime/after-inventory.test.ts` NEW.
  - For every non-test file under `app/` and `lib/` that imports `after` from `next/server`, count `\bafter\(` outside comments.
  - Diff against an allowlist keyed by **file → count** (not line numbers, which drift): rows 1-6 and 20-24, plus the R-CF-04/07/08/10 rows until their PRs land.
  - A new long `after()` fails CI.

**Acceptance.**
- [ ] `wrangler queues list` (run with the CI token after the `ensure-resources` job, §2.5 C18) shows `air-deferred` and `air-deferred-dlq`, with `airv2-app` consuming both.
- [ ] On Workers, an email to an agent address is answered when the box was stopped (cold wake longer than 30 s). Tail shows `deferred.again` hops, then `deferred.done kind=email.turn`. The webhook returns 200 in under 1 s. The live check is owner-run: Devin supplies the command and the expected tail output in the PR, and shows the same hop sequence locally under `wrangler dev` (Miniflare queues, `evals/stub-hermes`, a signed fixture).
- [ ] Re-sending the same queue message (a test producer under `wrangler dev`; on workers.dev the owner can use the dashboard's "Send message") gives `{result:"dup"}`, and the side effect happens once. A duplicate of hop n sent while hop n+1 is queued is also `dup`, with no second polling chain.
- [ ] A handler that always throws is retried with backoff, lands in the DLQ after 8 retries, and ends with `deferred_jobs.status='dead'` and a `deferred.dead` log line (R-CF-15 alert A5, matched on `msg`, §2.5 C16).
- [ ] Under `wrangler dev` with `target=vercel` in local KV (`--local`, never the production namespace, §2.5 C22), a queued message is still handled by this build through `Internal`: `deferred.done` appears in the local log.
- [ ] Conditional: only if Vercel is unblocked at this SHA, else record N/A. On the Vercel runtime, `email.turn`, `calendar.nudge` and `box.connected_tools` run inline via `after()`. Locally, `next start` without a `DEFERRED` binding shows the same inline path.
- [ ] `after-inventory.test.ts` passes. No `ensureBoxAwake` remains reachable from an `after()` callback outside the R-CF-04/07/08/10 rows.
- [ ] `supabase/tests/rls_all_tables.sql` passes with `deferred_jobs`.

**Tests.**
- `lib/runtime/defer.test.ts` NEW:
  - The Vercel path calls the mocked `after`, honors `vercelInline`, and runs inline when `after` throws.
  - The Workers path (mocked `cfEnv()` from `lib/runtime/platform.ts`) calls `DEFERRED.send` with `v:1`, the key and the hop.
  - `captureKeepAlive` opens one hold while in scope (mocked `after` / `cfWaitUntil`), and that hold settles only after the kept work.
  - Schema, size and key validation; `deferKey` is deterministic and regex-safe for `<id@host>` input.
  - A send failure throws `DeferSendError`.
- `app/api/internal/defer/route.test.ts` NEW (`FakeSupabase`, `lib/testing/fakeSupabase.ts`):
  - 401 without the bearer.
  - Claim outcomes map to 200, 409, 422 and 503; `dup` → 200.
  - `again` sends before finishing, with hop+1.
  - Exceeding `maxHops` gives `dead`.
  - The DLQ header marks dead only when the hop matches and no lease is held.
  - Each outcome logs exactly one `deferred.*` line with the canonical name.
- `supabase/tests/deferred_jobs.sql` NEW: claim, re-claim, stale-hop `dup`, busy lease and the DLQ guard.
- `worker/queue.test.ts` NEW: a fake `MessageBatch` checks the ack/retry mapping per status, `Retry-After` clamping and backoff. It also checks that the call goes through `selfFetch` to a mocked `SELF` at `${APP_ORIGIN}/api/internal/defer`, and that no `AIR_PUBLIC_ORIGIN` is read.
- `worker/entry.test.ts` (R-CF-02's file): `queue()` calls `applyEnv(env)` before `consumeDeferred`.
- `lib/hermes/client.test.ts`: `getRun` parses a 200 (including `updated_at`, `last_event` and an unknown extra field kept by `passthrough`), maps 404 to `null`, and maps a bad shape to `HermesApiError(502)`.
- `lib/runs/poll.test.ts` NEW: stopped → `lost`; `starting` → `running`; the `last_active_at` touch when `stop_after` is null, and arming otherwise.
- `lib/email/turn.test.ts` NEW (hop machine):
  - Hop 0 creates the run with the idempotency key.
  - Hop n with `running` gives `again`.
  - `completed` replies (tier 0) or drafts (tier 1).
  - No duplicate `agent_runs` row.
- Update `app/api/inbound/email/route.test.ts` and `app/api/inbound/calcom/route.test.ts`:
  - Mock `@/lib/runtime/defer` instead of `next/server` `after` (pattern at `email/route.test.ts:33-36`).
  - Assert the dedupe row is released on `DeferSendError`.
- `lib/calendar/nudge.test.ts` NEW: `MigrationBusyError` gives `again(retryAfterSeconds)` at hop 0 and `dead` at hop 1; `armStopAfter` always runs.
- Add `GET /v1/runs/{id}` to `evals/stub-hermes/server.ts`. The stub currently lists runs, events, stop and approval only (`:8-10`). R-CF-06 owns this stub route (§2.5 C6).
- Manual:
  - `wrangler dev` (Miniflare local queues), then `curl` the email webhook with a signed fixture.
  - `wrangler tail airv2-app --format json | jq 'select(.logs[].message[0] | test("deferred"))'`.

**Risks & notes.**
- Queues are at-least-once and unordered. Handlers must be idempotent: the ledger with hop fencing, per-kind keys, and provider idempotency keys. Never use `air-deferred` for iMessage bubbles. Per-chat ordering is `ConversationDO.deliver` (R-CF-04, §2.5 C8) over R-CF-03's transport, with keys built by `imessageKey()` (§2.5 C15).
- `provision.compute` retried after a partial build: `ensureComputeProvisioned` (`lib/provisioning/provision.ts:652-672`) returns false once a `boxes` row exists. A retry then skips the welcome and can leave a half-configured box. R-CF-04 must add a readiness check (verify).
- `CRON_SECRET` authenticates every SELF call. Rotating it mid-flight fails in-flight messages: they get 401, retry, then hit the DLQ. Accept both values for one deploy while rotating.
- `await defer()` before the ACK adds one Queue write (an estimated 5-20 ms) to webhook latency.
- Long-holding kinds (`provision.compute`, wakes) occupy one consumer invocation each. `max_concurrency: 25` is a starting value; tune it in R-CF-15.
- Queue retention is 4 days by default. The DLQ consumer drains straight into the ledger.
- Queues pricing: 1M operations/month included, then $0.40/M (verify). A message costs ~3 operations.
- Scope: the "calendar/bots stream consumers" named in the contract are not `after()` sites.
  - `lib/calendar/sweep.ts:294` runs in the `/api/cron/schedules` cron (R-CF-11).
  - `lib/bots/rooms.ts:82` runs synchronously inside `POST /api/bots/rooms/[id]/send`, which is bounded on Workers only by the client staying connected. Keep it.

**Depends on.** R-CF-01, R-CF-02 (entry `queue()` with `applyEnv`; `SELF` bound to the `Internal` entrypoint), R-CF-12 (`lib/runtime/platform.ts` `cfEnv`/`cfWaitUntil`; `selfFetch`), R-CF-13 (`ensure-resources` job that creates the queues).
