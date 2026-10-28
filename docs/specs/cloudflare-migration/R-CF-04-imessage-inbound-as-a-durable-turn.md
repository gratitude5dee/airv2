# R-CF-04 — iMessage inbound as a durable turn

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-04: …`.

**Why.** Today the webhook makes about 10-14 Supabase round trips before the 200, then runs the whole turn in `after()` (`app/api/inbound/imessage/route.ts:463-513`). That turn includes:
- the debounce `setTimeout` (`lib/orchestrator/flush.ts:2145-2148`);
- the claim;
- the box wake, with a deadline of up to 180 s (`lib/orchestrator/boxes.ts:249,339`);
- a Hermes SSE stream held for up to 120 s, with a 2 s cancel poll (`flush.ts:1739-1849`).

OpenNext maps `after()` to `ctx.waitUntil`, which is cut 30 s after the response on both plans. So on Cloudflare, every turn that needs a wake or a real model run dies mid-flight. The sweep backstop (`app/api/cron/sweep/route.ts:95-120`) is no substitute: it runs up to 10 overdue turns one after another inside a single per-minute sweep request, each turn taking minutes.

Other code depends on today's Postgres semantics, and those must be kept:
- the `claim_flush` CAS plus admission lease (`supabase/migrations/0106_compute_migrations.sql:355-405`);
- the `flush_jobs` readers (`lib/vault/purchase.ts:108-116`, `app/api/crm/update/route.ts:47-54`);
- the `batch_queue` writers outside the webhook (`lib/location/resolve.ts:99-152`).

Design rule:
- Postgres stays the system of record for `batch_queue`, `carried_messages` and `flush_jobs`. `schedule_flush` (`0130_burst_sender_tiers.sql:14-42`) and `claim_flush` do not change. Here, "mirror" means the DO path writes the same columns at the same points as `runFlush` does, plus new phase columns.
- A per-space `ConversationDO` (SQLite) owns the stage-1 inbox, all timers, the turn state machine and cancellation.
- Each phase runs in the Next app through `selfFetch` (the `SELF` binding to the `Internal` entrypoint, §2.5 C1), one request per phase. That way `lib/` code is not bundled into the worker entry a second time, and each phase gets its own CPU budget.

**Deltas.**

*Stage 1 (before the 200) and stage 2 (the gates), in `app/api/inbound/imessage/route.ts`.*
- In the durable engine, only this runs before the ACK:
  1. verify (`:76-101`), then parse and ignore echoes (`:103-119`);
  2. `conversation(inbound.spaceId).ingest({inbound, receivedAtMs})`. On `{fresh:false}`, return 200 `{deduped:true}`;
  3. otherwise `after(() => runInboundGate(...))` and return 200.

  Store the parsed `InboundSpectrumMessage` (`lib/routing/spectrum.ts:35-51`), never the raw body. `locationSignal` is already a boolean, so no coordinates are stored.
- If `ingest` throws, run `runInboundGate(..., "durable")` inline before the ACK, in Vercel's ordering. If `scheduleTurn` then also fails, the `flush_jobs` row is left overdue and the sweep's `notifyConversation` retries it every minute.
- `lib/orchestrator/turn/gate.ts` NEW: `runInboundGate(supabase, inbound, receivedAtMs, mode: "legacy" | "durable", defer: (fn) => void)`.
  - This is pure code motion of `route.ts:121-513`. The legacy `POST` calls it inline before the ACK with `defer = after`, so Vercel behavior is unchanged.
  - In durable mode the gate already runs post-ACK. `defer` collects the promises (onboarding reply `:239-258`, muse `:305-328`, onairos `:356-419`) and the gate awaits them before `completeGate`, so no `after()` is nested inside `after()`. `provisionComputeWithWelcome` (`:251`) does not use that callback. It goes through R-CF-06's registry as `defer("provision.compute", { userId }, { key: deferKey("provision", userId, messageId) })` (§2.5 C7).
  - The order is the requirement and must not change:
    1. route resolution (`:126-129`) and warm senders (`:130-135`)
    2. `inbound_events` dedupe (`:137-152`)
    3. empty body (`:154-163`)
    4. unroutable line / onboarding signup (`:165-215`)
    5. `handleOnboarding` (`:217-260`)
    6. trust tier and the tier-2 decision (`:262-290`)
    7. muse (`:292-330`)
    8. onairos (`:332-421`)
    9. reaction dispatch (`:435-441`) and `initialResponse` (`:445-449`)
    10. `enqueueInbound` (`:450-458`): `batch_queue` insert, destination, look-ahead, and `schedule_flush`, which stamps `cancelled_at` (`flush.ts:279`)
    11. kindness: markRead, typing, `sendInitialReply`, direct-completion delete (`:463-500`)
  - Durable mode replaces `flushAfterDebounce` (`:505`) with `scheduleTurn({runAt, messageId})`. Call it right after `enqueueInbound` and before the kindness sends, so a cut `after()` cannot lose the turn.
  - Every early return (tier 2, muse, onairos, onboarding, signup, unroutable) calls `completeGate(id, "handled")` and never `scheduleTurn`. So only a message that reaches `enqueueInbound` can cancel or stop an in-flight run (M4, `route.ts:262-264`).
  - Exactly-once:
    - `claimGate(id)` takes a 30 s lease.
    - `markGate(id, "deduped" | "enqueued" | "kind")` runs after each external write. A retry resumes after the last marker.
    - An `inbound_events` conflict on gate attempt ≥2 proceeds; it is our own earlier insert.
    - On the backstop path, the kindness sends are skipped when `now - receivedAt > 15 s`, logged as `imessage.ttfk_skipped` with `reason: "stale"` (§2.5 C16).
    - The signup-failure delete (`:182-187`) stays for Vercel parity. In durable mode the failure fails the gate. The DO retries at 5 s, 30 s, 2 m and 10 m, then marks the message `dropped` with a `log.error` `imessage.gate_dropped` (identifiers only).

*ConversationDO: `apps/web/worker/conversation.ts` NEW.*
- R-CF-02's entry exports it as `export { ConversationDO } from "./conversation";`. Keyed by `getByName(spaceId)`, the same key as the `flush_jobs` PK.
- Module scope imports only `cloudflare:workers`, `applyEnv` from `./env-unpack` (R-CF-02), `selfFetch` from `../lib/http/self` (R-CF-12; it pulls in only `lib/env.ts`, which imports just `zod`, and `lib/runtime/platform.ts`) and local types, so a poison import elsewhere can never take down the entry. Put the logic in a pure `ConversationCore` over an injected `Store` and `Clock`, so it can be tested in Node.
- `alarm()` and every RPC method call `applyEnv(this.env)` as their first statement (§2.5 C3). `applyEnv` also runs `setCfEnv`, so `cfEnv()`, `selfFetch` and the packed values stay current after a secret rotation on a reused isolate.
- Read `CRON_SECRET` from `process.env` at call time (filled by `applyEnv`), never at module scope.
- SQLite schema (developers.cloudflare.com/durable-objects/api/sqlite-storage-api/):
  ```sql
  CREATE TABLE IF NOT EXISTS inbox (message_id TEXT PRIMARY KEY, received_at INTEGER NOT NULL,
    inbound TEXT,                        -- parsed message JSON; set NULL when stage 2 ends (goal C4: transient)
    stage TEXT NOT NULL DEFAULT 'new',   -- new|deduped|enqueued|kind|done|handled|dropped
    attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER);
  CREATE TABLE IF NOT EXISTS turn (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL DEFAULT 0,
    expected_run_at TEXT, chain_started_at TEXT, operation_id TEXT, phase TEXT NOT NULL DEFAULT 'idle',
    cancel_requested INTEGER NOT NULL DEFAULT 0,
    line TEXT,                           -- Air line (inbound.phone) of the last ingest; deliver() fallback, not user content
    state TEXT);                         -- TurnState JSON; NULL at finalize
  CREATE TABLE IF NOT EXISTS tasks (kind TEXT NOT NULL, key TEXT NOT NULL DEFAULT '', due_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER, PRIMARY KEY (kind, key));
  CREATE TABLE IF NOT EXISTS outbox (key TEXT PRIMARY KEY, phone TEXT,
    parts TEXT,                          -- OutboundPart[] JSON; set NULL once sent (goal C4: transient)
    stage TEXT NOT NULL DEFAULT 'queued', -- queued|sent|dropped
    created_at INTEGER NOT NULL);
  ```
  "goal C4" is the repo's content rule (`docs/goal-air2.md:21`: no message content in Postgres), not §2.5 C4.
- `TurnState` fields:
  - `{job: {spaceId, userId, phone, attempts, senderTier}, chainStartedAt, operationId?, burstTier, senderRef, burstSenderId?}`
  - `{carried, fresh, consumedIds, rawInput, responseLaneInput, receivedAtMs?, locationContext?, locationInput?}`
  - `{boxId, run?: {runId, session, botName?}, deadlines: {runCreatedAt, initialAt, finalAt, wakeStartedAt?}}`
  - `{reply?: {buffered, tapback?, files, cards, muse?}, cancelled}`

  It never stores box tokens, `api_server_key` or hosted URLs. Every phase re-resolves the box target from `boxes`, and a bot target through `listBots` + `botTarget` by `botName` (`flush.ts:1510-1519`).
- RPCs: `ingest`, `claimGate`, `markGate`, `completeGate`, `scheduleTurn({runAt, messageId})`, `kick({runAt})` (sweep and location, through `notifyConversation`), `deliver(parts, { key, phone? })`, and `status()` (phase and timestamps only, no content).
- `deliver(parts, { key, phone? })` (§2.5 C8) is the per-chat, ordered outbound lane for sends outside a turn: R-CF-08's iMessage continuation and R-CF-11's schedule delivery.
  - `key` is an `imessageKey(...)` result (§2.5 C15), for example `imessageKey("creative", jobId, "attachment")`. The RPC inserts `outbox(key)` and an `out:<key>` task due now, then returns `{accepted: true, dup}` once both rows are written. A key already in `outbox` is a no-op that returns `dup: true`.
  - `parts`:
    ```ts
    type OutboundPart =
      | { kind: "text"; body: string }
      | { kind: "rich_link"; url: string }
      | { kind: "attachment"; media: { r2Key: string } | { storagePath: string };
          name: string; mimeType: string; size: number;
          fallbackUrl?: string };   // sent as a rich link on 413 too_large / operationNotSupported (creative/imessage.ts:262-273)
    ```
  - `phone` is the Air line to send from. When it is omitted, the DO uses `turn.line`. With neither, the task ends `dropped` and logs `imessage.deliver_dropped` (identifiers only).
  - `out:*` tasks run through the same single dispatcher as the turn phases, so they never interleave with a turn's `deliver` bubbles. They do not wait for an in-flight turn to finalize.
  - On Vercel `conversation()` returns `undefined`. Callers then send directly through `createSpectrumSender()` with the same keys and no cross-turn ordering.
- `alarm()` is the single dispatcher.
  - It runs due tasks in `due_at` order. Each task is leased, and its phase runs as:
    ```ts
    selfFetch("/api/internal/imessage/turn", {          // SELF → Internal entrypoint; never the hosting switch (§2.5 C1)
      method: "POST",
      headers: { authorization: "Bearer " + process.env.CRON_SECRET, "content-type": "application/json" },
      body: JSON.stringify({ spaceId, phase, turn }),
      signal: AbortSignal.timeout(budget + 10_000),
    })
    ```
    `selfFetch` builds `new URL(path, env.appOrigin())`, so middleware sees the app host (§2.5 C1, C3).
  - A phase's returned `turn.state` is always persisted, because its Postgres side effects already happened (for example, drained rows were deleted). Results are never discarded.
  - `turn.version` is bumped by every `scheduleTurn`. Alarms run concurrently with RPCs (developers.cloudflare.com/changelog/post/2026-08-25-durable-object-alarm-abort-no-retry/). If the version changed while a phase ran, the dispatcher re-applies the cancellation rules below to the phase's returned `schedule` before arming it.
  - `alarm()` never throws. Attempts and backoff live in `tasks`, because platform alarm retries stop at 6.
  - A DO has a single alarm, so set it to `min(due_at)` after each task and in every RPC that adds an earlier task.
- One turn at a time per space. A `claim` defers (1 s re-check) while another turn is past `claim` and not finalized. That gives per-chat ordering of bubbles across turns; today a successor chain can overlap the predecessor's delivery.
- Upserting a `claim:<runAt>` task deletes older `claim:*` tasks, whose CAS would lose anyway.
- Cancellation through `scheduleTurn`:
  - It always upserts `claim:<runAt>`.
  - Phase in `drain`, `lanes`, `wake` or `start`: set `cancel_requested=1`. The running phase checks `chainCancelled` at its next boundary, as today (`flush.ts:739, 1124, 1179, 1616`), and carries the burst.
  - Phase in `poll` or `sse`: make `stop` due now. This replaces the 2 s poll at `flush.ts:89, 1762-1807`.
  - Phase `deliver`: the turn finishes delivery without carrying, which is today's behavior.
- Every path that calls `rescheduleWithBackoff` (`flush.ts:772, 898, 1063, 1198, 1253, 1480, 1648`) returns the new `run_at`; change `rescheduleWithBackoff` (`:641-655`) to return it. The DO then upserts `claim:<run_at>`, so backoff retries never wait for the sweep.
- Tasks and phases. Each phase is idempotent; the source lines are the code that moves.

  | Task | Does (source) | Budget | Next |
  |---|---|---|---|
  | `gate:<msgId>` | backstop for stage 2, due at receipt + 5 s (`route.ts:121-513`); if the inbox row holds an unexpired lease, re-arm at `lease_until` | 25 s | `claim:<runAt>` via `scheduleTurn` |
  | `claim:<runAt>` | `claimFlush` (`flush.ts:368-413`), then read attempts and tier (`:2151-2155`). A `claimed` result is always applied | 5 s | `drain`. `lost` / `missing` → idle. `admission_closed` → retry every 30 s for up to 30 min, then leave it to the sweep |
  | `drain` | read carried and queued rows (`:416-443`), persist them in `turn.state`, then delete them by id (a crash in between re-reads them; rows dedupe by PK); empty → delete the job (`:1075-1077`); oldest row older than `IMESSAGE_STALE_TURN_HOURS` → delete the rows and the job, log `imessage.turn_stale {space_id, age_s}`, send nothing; burst tier (`:1085-1101`) | 10 s | `lanes`; stale → `finalize` |
  | `lanes` | `deliverBurstCommands` (`:1106-1132`); arm `progress` under `:1143-1147`'s condition (`:1148-1162`); draw, freeze, twin, creative and location lanes (`:1166-1415`). Heavy executors are handed off: creative to R-CF-08, draw and freeze rendering to R-CF-09 / R-CF-06 | 30 s | `wake` or `finalize`; `progress` |
  | `wake` | `ensureBoxAwake` (`:1417-1484`) as steps. The first step runs the per-caller admission, credentials and `stop_after:null` (`boxes.ts:255-265`) and stamps `deadlines.wakeStartedAt`. Each step calls R-CF-05's `wakeStep(boxId)` (§2.5 C8), one probe per call, and re-arms `wake` after its `nextCheckMs`. R-CF-05 owns the 1/2/4/8 s spacing (`wakeProbeDelayMs`, `boxes.ts:237`) and the one restart at 60 s (`:346-361`). `failed`, or `wakeStartedAt + 180 s` (`:339`), is a wake failure. On wake failure at attempt 0: bridge or holding line (`:1429-1479`), then carry and backoff | 10 s per step | `start`; or `claim` at the backoff `run_at` |
  | `start` | materialize attachments (`:1486-1492`; `getAttachment` max 16 MiB, larger files get a "too large" marker); bots (`:1494-1532`); `ensureSession` (`:1539-1554`); R-IMSG-02 prior-run stop (`:1558-1673`); stamp `runCreatedAt` (`:1556-1557`); `createRun` with `idempotencyKey` (`:1674-1711`, key at `:1696`); write `hermes_run_id` (`:1712-1715`); open the `agent_runs` row (`:1717-1732`) | 60 s | `poll` |
  | `poll` | `getRun` plus the F1 rules below | 5 s | `poll` (+2 s), `sse`, `deliver` or `retry` |
  | `sse` | F1 fallback (below) | up to the 120 s hard cap | `deliver` or `retry` |
  | `stop` | `stopRun`, a `stop_failed` receipt (`:1766-1806`), carry (`:1977-1981`); deletes `progress` | 15 s | `finalize` |
  | `progress` | due at `receivedAt + 18.5 s`: generate with `progressUpdateReply`, send at `receivedAt + 20 s` (`ttfk.ts:13,15,271-294,300`); key `imessageKey("turn", spaceId, chainStartedAt, "progress-two")` | 5 s | none |
  | `deliver` | delete `progress` first; tapback, reply or bubbles (`:1900-1930`); send-files (`:1935-1943`); cards (`:1949-1962`); muse (`:1968-1975`); receipts (`:1984-2033`); job delete (`:2034-2041`). All sends are keyed `imessageKey("turn", spaceId, chainStartedAt, slot)` (R-CF-03, §2.5 C15). The budget covers 4 uploads × 120 s | 600 s | `finalize` |
  | `retry` | delete `progress`; failure path (`:1850-1899`) plus `retryUndeliveredStream` (`:725-785`); backoff through `rescheduleWithBackoff` (`:641-655`) | 30 s | `finalize`; `claim` at the new `run_at` |
  | `finalize` | delete `progress`; `armStopAfter` (`:2045-2048`); `completeOperation` (`:1030-1033`); clear `turn.state` | 10 s | idle |
  | `out:<key>` | phase `outbound`, from `deliver(parts, {key})`: send `outbox.parts` in order through `createSpectrumSender()` (R-CF-03 transport and ledger), part `i` keyed `imessageKey(key, String(i))`; an attachment that gets `too_large` or `operationNotSupported` falls back to its `fallbackUrl` as a rich link; then set `outbox.parts` to NULL and `stage='sent'` | 600 s | none |
  | `gc` | idle for 48 h (no task due, no `queued` outbox row) → `deleteAlarm()` + `deleteAll()` (matches the 48 h TTL at `sweep/route.ts:210`) | n/a | n/a |

- Guards that must hold on both engines. These labels are introduced by this spec; they are not yet in the repo.
  - R-IMSG-01 = `docs/specs/flush-stream-livelock.md` F1 + F2: the activity-aware 45 s / 120 s deadline (`flush.ts:96-97, 134-165, 1817-1824`) and the `MAX_ATTEMPTS=5` honest-text cap (`:88, 746-769`).
  - R-IMSG-02 = the dead-stop guard (`:1558-1673`). `run_not_found` satisfies the stop (`:664-670, 1578`). An unstoppable prior run holds the burst. When retries are exhausted, send the honest text and delete the job (`:1622-1645`).

*Phase route: `app/api/internal/imessage/turn/route.ts` NEW.*
- Auth: `requireCron` (`lib/auth/guard.ts:173-181`). The route is also reachable from the public host, so the cron bearer is its only gate; there is no marker header (§2.5 C1).
- Dispatches to `lib/orchestrator/turn/phases.ts` (the `outbound` phase lives in `lib/orchestrator/turn/outbound.ts` NEW) and returns `{turn, schedule: [{task, atMs}], done}`. Check `request.signal.aborted` at phase boundaries (`enable_request_signal`).
- Each phase logs one `imessage.turn_phase {space_id, phase, ms, outcome}` line, identifiers only (§2.5 C16).
- Superseded chain: before running `drain`, `lanes`, `wake`, `start`, `poll`, `sse`, or `deliver` before its first send, read `flush_jobs.chain_started_at`. If the row exists, `chain_started_at` is non-null, and it differs from `turn.chainStartedAt`, carry any drained rows and return `{done: true, reason: "superseded"}`. A missing row or a null value continues, as today. `stop`, `retry`, `finalize` and `outbound` never check.
- `middleware.ts` passes this route through untouched. SELF URLs carry the app host (`env.appOrigin()`, §2.5 C1), so the main-host branch returns `NextResponse.next()` (`middleware.ts:98-152`).
- Phase requests reach OpenNext through R-CF-02's `Internal` entrypoint. They never run the hosting switch or `proxyToVercel`, so `target=vercel` cannot proxy DO phases to Vercel (§2.5 C1). This item adds no host, header or path exception to the public `fetch`.

*Phases: `lib/orchestrator/turn/phases.ts` NEW.* Code motion out of `runFlushInner` (`flush.ts:1036-2051`) into phase functions that take and return an explicit `TurnState`. `runFlushInner` becomes an inline driver that calls the same functions in sequence; that is the Vercel engine. One implementation, two drivers.

*Hermes completion by polling.*
- Use R-CF-06's `getRun(target, runId)` from `lib/hermes/client.ts` (§2.5 C6). It returns `Promise<HermesRunStatus | null>` with the passthrough schema `run_id`, `status`, `created_at`, `updated_at`, `output`, `error`, `last_event`. The phases map `null` (404) to `run_not_found`. This item adds no second getter or schema.
- The pinned Hermes (`infra/template/setup.sh:12`, `d337b73`) serves this route: `gateway/platforms/api_server.py:83` and `api_server_runs.py:1008-1012` (`_handle_get_run`). Only the repo client and the stub lack it today, and R-CF-06 adds both. No hermes-host change is needed.
  - Terminal statuses are `completed | failed | cancelled | interrupted` (`api_server_run_idempotency.py` `TERMINAL_STATUSES`).
  - `output` is `final_response`.
  - Completed, failed and cancelled statuses are kept for 3,600 s. An SSE buffer with no subscriber is kept for 300 s from run start while the run keeps going (`api_server.py:4060-4061`, `api_server_runs.py:1187-1204`).
- R-CF-06 adds the stub route to `evals/stub-hermes/server.ts` (route list at `:8-10`).
- F1 under polling:
  - Polls run 2 s apart (`CANCEL_POLL_MS`, `:89`), measured against `runCreatedAt` (stamped in `start`):
    - `completed` with non-empty output → `deliver`.
    - `completed` with empty output → the "run completed without a response" error (`:618-620`).
    - `failed`, `cancelled` or `interrupted` → `retry`.
    - Not terminal, and now ≥ `runCreatedAt + 120 s` → the 120 s error (`:1836`).
    - Not terminal, and now ≥ `max(runCreatedAt, updated_at×1000) + 45 s` → `sse`.
  - The `sse` phase opens `runEvents` (`hermes/client.ts:197-210`) once. Hermes replays everything buffered since the run started; the phase always subscribes before the 300 s buffer TTL.
  - The `sse` phase reuses `hermesDeltas`, `untilLiveDeadline` and `beforeDeadline` with the original deadlines, takes activity time from the event `timestamp` field, and keeps the in-route `chainCancelled` check (`:1762-1807`).
  > Note for owner: polling alone cannot implement F1 exactly. At the pinned Hermes, `message.delta` events never touch the pollable status: `_text_cb` only publishes events (`api_server_runs.py:876-880`), while tool and approval events do update it (`_push` → `_set_run_status`, `:271-272`). So "writing a long answer" looks like "hung" until the `sse` fallback replays the buffer. A second gap: progress-two can no longer be cancelled by the first text delta (today `flush.ts:1750`), only by `deliver`, `retry`, `stop` or `finalize`. A reply that starts at 15 s and finishes at 25 s now also gets the 20 s progress bubble. A third: delivery uses `status.output`, which is the final answer only, whereas today's `hermesDeltas` concatenates every `message.delta`, including narration before tool calls. That is a deliberate parity difference, covered by tests.

*`flush_jobs` mirror: `supabase/migrations/NNNN_flush_jobs_engine.sql` NEW.* Take the next free number at merge (§2.5 C23). It creates no extension.
```sql
alter table flush_jobs
  add column engine   text not null default 'after' check (engine in ('after','durable')),
  add column phase    text,
  add column phase_at timestamptz;
```
- The gate sets `engine='durable'` right after `schedule_flush`.
- The DO writes `phase` and `phase_at` best-effort, matched on `chain_started_at`.
- Every other write keeps its existing call site:
  - `hermes_run_id` (`flush.ts:1712-1715`, cleared at `:1653-1664`)
  - deletes (`:756-760, 1076, 1125-1129, 1633-1637, 2036-2040`)
  - backoff (`:641-655`)
- The admission lease stays at 300 s (`flush.ts:386`), as today.

*Other writers and readers of the turn tables.*
- `lib/location/resolve.ts:143-151`: `deliverHeldBurst` writes `batch_queue` and calls `scheduleFlush`, then relies on the sweep. Add `notifyConversation(spaceId, runAt)` using the `run_at` that `scheduleFlush` returns, when `turnEngine(userId)` resolves to `durable`. It is a no-op on Vercel, where the sweep still picks the job up.
- `app/api/cron/sweep/route.ts:95-120`: this item owns the overdue-flush edit; R-CF-11 only wraps the route in `cronGate`. When `CONVERSATION` is bound, never call `claimFlush` + `runFlush` inline. For each overdue row:
  - `turnEngine(job.user_id)` is `durable` → `notifyConversation(job.space_id, job.run_at)`;
  - otherwise skip the row and log `imessage.overdue_skipped {space_id, engine}`.

  Orphan recovery (`:88-93`) is unchanged; it only re-creates `flush_jobs` rows (`lib/orchestrator/carryRecovery.ts:181-188`), which then take this path. The weeks-old backlog is triaged by R-CF-11 before the first `cron_host` flip, with owner approval (§2.5 C13). The stale-turn guard in `drain` is the runtime backstop.
- `lib/orchestrator/overdueFlush.ts:22-42`: also select `engine, phase_at` for logging. The takeover rule (5 min `chain_started_at` lease, `:3`) is unchanged.
- `lib/vault/purchase.ts:108-116` and `app/api/crm/update/route.ts:47-54` only read `flush_jobs` (`hermes_run_id`, `chain_started_at`, `sender_tier`). No code change; the durable phases must write those fields at the same points (see Acceptance).
- `app/api/admin/health/route.ts:284-289` only reads the oldest `batch_queue` row. That stays correct because rows stay in Postgres until drain. Add `turn_phase` / `phase_at` from `flush_jobs` to the payload.
- `isBurstStart` (`lib/routing/imessage.ts:175`, `flush.ts:2058-2073`) and the direct-completion delete (`route.ts:490-494`) are unchanged.
- `initialResponse` and progress generation call the gateway through `sharedBridge.ts:203-204` (`${env.appOrigin()}/api/gateway/...`). On CF that request must go through R-CF-12's `selfFetch` (§2.5 C1, C3), because a Worker cannot fetch its own custom domain.

*Flag and helpers.*
- `lib/imessage/conversation.ts` NEW:
  - `conversation(spaceId)` → `cfEnv()?.CONVERSATION?.getByName(spaceId)` (`lib/runtime/platform.ts`, §2.5 C2). It returns `undefined` on Vercel and when the binding is absent. Never call `getCloudflareContext()` here: the helper also runs in Workflows (R-CF-08, R-CF-11) and in the queue consumer.
  - `notifyConversation(spaceId, runAt)` → `conversation(spaceId)?.kick({runAt})`.
  - `turnEngine(userId?)` returns the resolved engine, `after` or `durable`. It reads `imessage_turn_engine` from `platform_settings` (`after | durable | canary`; with `canary`, `durable` only for ids in `imessage_turn_canary_users`). Cache it for 30 s per isolate. It always returns `after` when `CONVERSATION` is unbound.
- `lib/settings/platform.ts:10`: add `IMESSAGE_TURN_ENGINE_KEY = "imessage_turn_engine"` and `IMESSAGE_TURN_CANARY_KEY = "imessage_turn_canary_users"` (comma-separated user ids). Values are strings, because `readPlatformSetting` only returns strings (`:17-33`).
- `app/api/admin/settings/route.ts:31-65`:
  - GET also returns both keys.
  - POST: the final contract accepts any non-empty subset of `{box_default_provider, imessage_turn_engine, imessage_turn_canary_users, cron_host (+ optional route)}`, validates each given key, and returns 400 on an invalid value or when no known key is present. This item adds the two iMessage keys. R-CF-11 states the same contract and adds `cron_host`. Whichever PR lands second merges into the key list and never replaces it.
  - The admin panel repo is unchanged; operators use curl with `ADMIN_API_KEY` + `X-Admin-Operator`.
- With the stored value `canary`, stage 1 also runs `resolveInboundRoute` (`route.ts:126-129`) to pick the engine for the user.
- `lib/env.ts`: add `IMESSAGE_STALE_TURN_HOURS` to `OPTIONAL_ENV` with an accessor `imessageStaleTurnHours()` (default 6), used by `drain`. Add the name by hand to `apps/web/env.example.md` under `## plain`, in the R-CF-04-tagged block (§2.5 C20); `lib/env.example.test.ts` checks it.
- `apps/web/wrangler.jsonc` additions. R-CF-02 owns the base config; `SELF` comes from R-CF-02 and `SIDECAR` from R-CF-03. Append after R-CF-05's entries (§2.5 C8). Never edit a deployed tag:
  ```jsonc
  "durable_objects": { "bindings": [ /* BOX_LIFECYCLE (R-CF-05) */ { "name": "CONVERSATION", "class_name": "ConversationDO" }] },
  "migrations": [ /* { "tag": "v1-box-lifecycle", … } (R-CF-05) */ { "tag": "v2-conversation", "new_sqlite_classes": ["ConversationDO"] }]
  ```
  Regenerate `worker/worker-configuration.d.ts` with `npm run cf:types` in this PR (§2.5 C4).

*Staged rollout with Vercel parity.*
1. Ship dark: migrations, DO class and phase route deployed, flag unset, so `after` everywhere.
2. Synthetic test on workers.dev, with `canary` set to the owner's test user. The owner runs this step (§6): the flag write through the admin API, and the signed replays, which need the production `SPECTRUM_WEBHOOK_SECRET`. Devin supplies the commands and the expected output in the PR, and runs the same harness locally against `opennextjs-cloudflare preview` with a test secret in `.dev.vars`.
   - The signed webhook carries `x-spectrum-signature: v0=<hex HMAC-SHA256(SPECTRUM_WEBHOOK_SECRET, "v0:{ts}:{body}")>` and `x-spectrum-timestamp`, per `lib/routing/spectrum.ts:124-166`.
   - Reuse the `envelope()` / `deliver()` builders from `app/api/inbound/imessage/route.test.ts:155-200`, and send with `apps/web/scripts/imessage-synthetic.mjs` NEW.
3. After the app.wzrd.tech cutover (R-CF-14): the owner sets `canary` for the owner, then a 48 h soak watching `agent_runs` outcomes and the ttfk logs.
4. The owner sets `durable` for everyone.

Steps 3 and 4 wait until R-CF-08, R-CF-09 and R-CF-11 have merged. Until then the creative, draw and freeze lanes still render inside the 30 s `lanes` budget, iPhone HEIC attachments fail, and nothing runs the sweep backstop on CF.

Parity rules:
- Vercel has no `CONVERSATION` binding, so it always runs `after` with the inline driver and the spectrum transport.
- The `claim_flush` CAS (`0106:381-387`) plus `schedule_flush`'s `cancelled_at` arbitrate across hosts. Whoever claims a given `run_at` runs it; the other host's phases see the chain as cancelled or superseded and carry.
- Rollback (`/_switch` to `vercel`, R-CF-02, with the §2.5 C12 semantics; owner-only, §2.5 C22) needs no drain. DO alarms keep running on CF and claimed turns finish. Pending DO claims for old `run_at` values lose the CAS, and new webhooks land on Vercel.
- Setting the flag to `after` on CF is only a degraded emergency lever; the 30 s `after()` cap still applies.

**Acceptance.**
- [ ] Synthetic replay on the test user (owner-run on workers.dev; Devin supplies the command and expected output in the PR and runs it locally): the webhook does only verify, parse and DO `ingest` before the 200 (plus `resolveInboundRoute` under `canary`). The live check, webhook p95 under 300 ms with `durable`, moves to §4 P4 exit and §5 check 1.
- [ ] Synthetic warm text-only turn (same harness, owner-run): tapback `within_sla` (≤1 s) and first bubble `ttfk_met` (≤5 s, `INITIAL_REPLY_SLA_MS`) on ≥95% of replays. The reply is delivered. `agent_runs` rows match Vercel in shape (`first_bubble`, `completed`). The live-traffic SLA is §5 check 1 at P4 exit.
- [ ] A tier-2 message during an owner run creates the `tier2_contact` decision and never touches `flush_jobs.cancelled_at`, the DO turn or the run. The same holds for muse, onairos and onboarding messages.
- [ ] A second owner message mid-run stops the run within 5 s; the burst is carried and the combined turn runs once.
- [ ] Reasoning or tool events, then text at 60 s → delivered. Keepalives only → fails at 45 s. Five consecutive failures → one honest text, job deleted, no further retry (R-IMSG-01).
- [ ] An unstoppable prior run holds the burst, and `run_not_found` (a `null` from `getRun`) counts as stopped (R-IMSG-02).
- [ ] Killing the `deliver` phase after bubble 2 → the retry sends only bubbles 3-5 (ledger). No duplicate tapback, card or file.
- [ ] A `scheduleTurn` that arrives mid-`drain` loses no message: the drained rows are processed or carried.
- [ ] Cold box that wakes within 180 s: progress-two at about 20 s and no holding line. Wake failure on attempt 0: a bridge or holding line exactly once, the burst carried, and a `claim` armed at the backoff `run_at` (R-CF-05 `wakeStep`).
- [ ] A location held burst flushes by `run_at + 2 s` on CF without the sweep.
- [ ] The CF sweep never calls `runFlush` inline. A row whose user resolves to `after` is skipped and logged as `imessage.overdue_skipped`.
- [ ] A turn whose oldest queued row is older than `IMESSAGE_STALE_TURN_HOURS` sends nothing, deletes its rows and the job, and logs `imessage.turn_stale`, on both drivers.
- [ ] While admission is closed (migration fence), no turn runs. After it reopens, the turn runs exactly once.
- [ ] `purchase.ts` and `crm/update` read the same `hermes_run_id`, `chain_started_at` and `sender_tier` during a durable turn as during a legacy one.
- [ ] `deliver(parts, {key})` called twice with the same key sends each part once. An `out:` task that falls due during a turn's `deliver` phase sends after that phase's last bubble.
- [ ] After `finalize`, `status()` shows no inbox content and `turn.state IS NULL`. After `out:` sends, `outbox.parts IS NULL`. After 48 h idle, nothing is left in DO storage.
- [ ] A flag flip takes effect within 30 s; in-flight turns finish or yield through the CAS; no message is lost.
- [ ] With `target=vercel`, DO phase requests still run on Cloudflare, because they enter through the `Internal` entrypoint (§2.5 C1). A request to `/api/internal/imessage/turn` without the cron bearer gets 401.
- [ ] The scenario suite passes on both the inline driver and the DO driver.

**Tests.**
- `lib/orchestrator/turn/phases.test.ts` NEW, each phase with fake IO:
  - claim outcomes (`missing`, `lost`, `admission_closed`);
  - drain persist-then-delete, and the stale-turn guard;
  - the F1 poll math and sse escalation, with `getRun` mocked (a `null` maps to `run_not_found`);
  - the `wake` steps: `wakeStep` mocked through `ready`, `waking` with `nextCheckMs`, `failed`, and the 180 s cap;
  - retry backoff, `MAX_ATTEMPTS`, and every `rescheduleWithBackoff` path returning `run_at`;
  - the R-IMSG-02 cases;
  - cancel → stop → carry;
  - superseded-check scope;
  - `outbound`: per-part `imessageKey(key, i)` keys and the attachment `fallbackUrl` path.
- `lib/orchestrator/turn/parity.test.ts` NEW. One scenario table runs through both drivers (recording sender, `lib/testing/fakeSupabase.ts`). It includes the eight cases in `docs/specs/flush-stream-livelock.md` §Testing and asserts identical sends and DB writes, apart from the documented output and progress differences.
- `lib/orchestrator/turn/gate.test.ts` NEW:
  - gate order;
  - tier 2, muse, onairos and onboarding never call `schedule_flush` or `scheduleTurn`;
  - durable `defer` is awaited before `completeGate`, and `provisionComputeWithWelcome` is enqueued through R-CF-06 `defer("provision.compute", …)` with its `deferKey`;
  - resume from each marker;
  - the stale-kindness skip;
  - a backstop on a leased row re-arms.
- `apps/web/worker/conversation.test.ts` NEW: `ConversationCore` with an in-memory store and a fake clock. Covers ingest dedupe, task ordering and leases, results persisted under an interleaved `scheduleTurn`, claim-task replacement, one turn at a time, `progress` deleted by later phases, `deliver` dedupe by key and `out:` ordering after a running `deliver` phase, the `turn.line` fallback, alarm never throws, gc. A wrapper test asserts that `alarm()` and every RPC call `applyEnv` first.
- `app/api/inbound/imessage/route.test.ts`: the durable branch (ACK path, ingest-failure fallback) and the unchanged legacy branch.
- `app/api/internal/imessage/turn/route.test.ts` NEW: auth (no or wrong bearer → 401), superseded chain.
- `lib/hermes/client.test.ts` (R-CF-06 owns `getRun`): add one fixture in the pinned Hermes shape with `updated_at` and `last_event`, which the F1 math reads.
- `app/api/cron/sweep/route.test.ts` NEW: notify instead of the inline run; a user that resolves to `after` is skipped and logged.
- `lib/location/resolve.test.ts` NEW: notify after `scheduleFlush`, only under `durable`.
- `app/api/admin/settings/route.test.ts` NEW: new keys, per-key validation, a subset without `box_default_provider` accepted.
- Manual:
  - Run `opennextjs-cloudflare preview` with `evals/stub-hermes`, and `infra/workers/sidecar` under `wrangler dev`.
  - Send synthetic webhooks with `scripts/imessage-synthetic.mjs`, signed with a local test secret.
  - Follow the new `imessage.turn_phase {space_id, phase, ms, outcome}` log lines (identifiers only) in the local output. On workers.dev the owner follows them with `npx wrangler tail airv2-app --search "imessage.turn_phase"`.
  - Kill drills, locally: abort the phase request mid-`deliver`, `drain:0`, restart `evals/stub-hermes` mid-poll, restart the preview mid-turn (it stands in for a deploy).

**Risks & notes.**
- `space_id` is the chat guid and is the same across lines. Keying the DO by it inherits the existing `flush_jobs` PK collision.
- The 300 s admission lease can expire on long cold turns, as it can today.
- If a DO stalls longer than 3,600 s, Hermes forgets the run status and polling sees `run_not_found`. That is handled like the R-IMSG-02 or `retry` path. A box restart has the same effect, except for idempotent runs, whose status persists in Hermes' `RunIdempotencyStore`.
- The DO has one alarm, and a running alarm handler is not preempted. Long phases (`sse`, `deliver`, `outbound`) delay the other tasks for that space; cancellation inside `sse` relies on the in-route `chainCancelled` check.
- Every airv2-app deploy restarts ConversationDOs, which cuts in-flight alarm handlers. The phase is retried at-least-once and re-runs idempotently (ledger keys, `createRun` `idempotencyKey`).
- A gate retry after a crash between the `batch_queue` insert and `markGate` can enqueue twice; the window is milliseconds. A cross-host duplicate that coincides with a gate retry can process the message twice.
- goal C4: message text sits transiently in DO SQLite (inbox, `turn.state` and `outbox.parts`). It is cleared at stage-2 end, at finalize, after each `out:` send and at the 48 h gc. Never log it.
- The `deliver` lane orders out-of-turn sends with turn bubbles only on Cloudflare. On Vercel, callers send directly with the same keys, as today.
- The stale-turn guard drops replies to messages older than `IMESSAGE_STALE_TURN_HOURS`, on both engines. That is deliberate: after an outage, a reply hours late is worse than none.
- Cost per turn on Paid is about 10 phase requests, about 60 polls, plus the DO requests. That is negligible.
- SELF calls enter through the `Internal` entrypoint and never reach the hosting switch (§2.5 C1). Phase routes need `enable_request_signal` so an aborted phase stops instead of running twice; the ledger's `inflight` state covers what is left.

**Depends on.** R-CF-01 (`env.example.md` format and test, packed `CRON_SECRET`), R-CF-02 (entry, `Internal` + `SELF`, `applyEnv`), R-CF-03 (transport, `imessageKey`, send ledger), R-CF-05 (`BoxLifecycle.wakeStep`), R-CF-06 (`getRun`, `defer` + `provision.compute`), R-CF-12 (`cfEnv`, `selfFetch`). R-CF-08, R-CF-09 and R-CF-11 are not dependencies. R-CF-08 and R-CF-11 build on this item (`deliver`, `notifyConversation`), and R-CF-09 lands beside it. The production flag waits for all three (*Staged rollout*).
