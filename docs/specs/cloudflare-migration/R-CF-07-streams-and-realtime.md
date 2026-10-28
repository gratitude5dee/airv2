# R-CF-07 — Streams and realtime

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-07: …`.

**Why.** On Paid the SSE relays fit as they are. CPU accrues only while JS runs. The relay `TransformStream` plus the terminal scanner (`lib/hermes/terminal.ts:11-50`) plus the OpenNext `Writable` hop cost ~5 µs/frame. A 3,000-frame run is ~15-17 ms (Node-measured, ±2x on workerd; design:streams-and-realtime), against `limits.cpu_ms` 60,000. HTTP wall time is unlimited while the client is connected, and runtime updates give up to 20 min of grace (https://developers.cloudflare.com/workers/platform/limits/#runtime-updates).

Lifecycle is what breaks:
- `request.signal` is inert without `enable_request_signal`, which is missing from `apps/web/wrangler.jsonc:6`. The creative poll loop's abort check (`app/api/creative/[jobId]/events/route.ts:57`) never fires.
- `agent_runs` closes only when a browser stays connected through the terminal frame (`lib/chat/relay.ts:139-160`, `lib/bots/chat.ts:93-104`), through detached `void` writes.
- Hermes serves one consumer per run and drops the transport when that subscriber disconnects. A re-subscribe 404s and there is no replay (hermes-agent d337b736 `_drop_run_transport`; challenge:streams-and-realtime).
- The result: a dropped tab never closes the row. Muse `run-status` (`lib/muse/capabilities.ts:310-321`) reports `running` forever, and every client shows "Connection lost" (`app/home/page.tsx:731-736`, `app/home/bots-panel.tsx:540-544`, `lib/miniapps/client/create/CreateStudio.tsx:1964`).

**Deltas.**
- `apps/web/wrangler.jsonc:6`: `"compatibility_flags"` must contain `"enable_request_signal"` (https://developers.cloudflare.com/workers/configuration/compatibility-flags/#enable-requestsignal-for-incoming-requests). R-CF-12 owns this array and adds the flag in P1, together with `global_fetch_strictly_public`. This item only asserts it (test below). Do **not** add `request_signal_passthrough`: subrequests must not abort with the client.
- Relays stay in Next:
  - Routes: `app/api/chat/[runId]/events/route.ts`, `app/api/create/events/[runId]/route.ts`, `app/api/desktop/chat/[runId]/events/route.ts`, `app/api/bots/[name]/chat/[runId]/events/route.ts`.
  - No worker-entry fast path. Staying in Next keeps the `middleware.ts:163-183` host gating and `ensureBoxAwake` admission, which on Workers goes through R-CF-05's blocking `BoxLifecycle.wake` (§2.5 C8).
  - `stop_after` semantics are unchanged: `ensureBoxAwake` nulls it (`lib/orchestrator/boxes.ts:262-265`), and `rearm` fires on flush or cancel (`relay.ts:134-138,176-178`).
- `apps/web/lib/chat/relay.ts:112-181` and `apps/web/lib/bots/chat.ts:65-125`:
  - Take `const keep = captureKeepAlive()` (R-CF-06) before `pipeThrough`.
  - Wrap the `rearm`/`finish` writes (`relay.ts:137,143`, `chat.ts:91,97`) in `keep(...)`, on both the flush and the cancel path.
  - Factor `finish` into `closeRunRow()` (below).
- `apps/web/lib/runs/finalize.ts` NEW
  - `closeRunRow(supabase, {userId, runId, rowId?}, outcome)`: the two-step update from `relay.ts:143-159`, or `closeCreateRunRow` (`lib/create/turn.ts:319`) when `rowId` is set. Both are idempotent (`ended_at is null` guard).
  - `finalizeRun` is the handler for kind `run.finalize`. Add its row to R-CF-06's `deferHandlers.ts` table and `run.finalize` to `DeferKind` (§2.5 C7), with `vercelInline = (p) => Boolean(p.then) || p.source === "muse"`. Browser-relayed runs keep today's Vercel behavior.
  - `run.finalize` is the only mechanism that waits for a Hermes run to finish outside a request (§2.5 C7).
  - Payload: `{userId, runId, bot?, rowId?, source?: "web"|"bot"|"create"|"muse", then?: {type, …}, deadlineAt}`.
    - `then` is a continuation payload, validated by the schema of its registered continuation.
    - `deadlineAt` defaults to now + 3 h. A caller with `then` sets its own; R-CF-10 uses now + the role's wait + 60 s.
  - Steps:
    1. Row already closed and no `then` → done.
    2. With `bot`, load `api_server_key` via `getBot(supabase, userId, bot)` (`lib/bots/store.ts:47`); the payload never carries keys. Then `pollRunOnce` (R-CF-06).
    3. `terminal`:
       - Without `then`: `closeRunRow(toOutcome(status))`.
       - With `then`: run its registered continuation with `{kind:"terminal", status, output}`. The continuation closes the row itself. R-CF-10's `create.turn_done` calls `closeCreateRunRow` and posts the correlated `turn_done` for its role and round through `bridgePost(\`/v1/jobs/${jobId}/events\`, …)`, the contract of `app/api/internal/create/turn/route.ts:106-113` (§2.5 C7).
       - Then `armStopAfter`.
    4. `running` → `again`. Without `then`: 15→30→60→120 s, then 120 s. With `then`: 5 s for the first 10 min, then 15 s.
    5. `lost`, or past `deadlineAt`:
       - Without `then`: close as `lost`.
       - With `then`: run the continuation with `{kind:"lost"}` or `{kind:"deadline"}`.
       - Then `armStopAfter`. A job must never hang.
- `apps/web/lib/runs/continuations.ts` NEW: the static table of `then` continuations, keyed by `then.type`.
  - Each entry is `{schema, run(supabase, then, {userId, runId, rowId?, result})}`, where `result` is `{kind:"terminal", status, output?} | {kind:"lost"} | {kind:"deadline"}`.
  - This item ships the table empty; tests inject a stub. R-CF-10 adds `create.turn_done` with payload `{type:"create.turn_done", jobId, role, round}` (§2.5 C7).
  - A continuation owns its row close and its event. It must report on `lost` and `deadline` too. It must be idempotent per run, because a consumer kill between the continuation and `finish_deferred` runs it again.
  - An unknown `then.type` → `dead`.
- Enqueue `defer("run.finalize", …, {key:\`run:${runId}\`})` **exactly once per run**:
  - `lib/chat/relay.ts` after the insert at `:84` (`source:"web"`, delay 60 s).
  - `lib/bots/chat.ts` after `:50` (`bot`, delay 60 s).
  - `lib/create/turn.ts`, after the link at `:260-273` succeeds and before the `return` at `:274`. Add an option `startCreateTurn(..., {budget, finalizeThen?})`, where `finalizeThen` carries the `then` payload and its `deadlineAt`:
    - Callers that pass nothing get one message with no `then` (`source:"create"`, delay 60 s). Until R-CF-10 lands, that includes `app/api/internal/create/turn/route.ts:158-170`, whose `after(consumeAndReport)` at `:172` stays. `closeCreateRunRow` is idempotent, so the two closers do not conflict.
    - R-CF-10 makes that route pass `finalizeThen: {then: {type:"create.turn_done", jobId: job.id, role, round}, deadlineAt}` (delay 5 s), registers the continuation, and deletes the `after()` at `:172` together with `consumeAndReport` (`:70-114`) (§2.5 C7).
    - Never enqueue a second message with the same key: the ledger would drop it as `dup` and the job would hang.
  - `lib/muse/capabilities.ts` after the insert at `:291` (`source:"muse"`, delay 15 s). This replaces the `after` at `app/api/muse/air/[capability]/route.ts:39`.
- `lib/muse/capabilities.ts:199-247` `observeMuseRun`: poll `getRun` every 1 s for `waitSeconds` instead of opening `runEvents` (`:210`). Today the inline window cancels Hermes' only transport.
- Idempotency keys, so Hermes persists run status across gateway restarts (challenge: status is in-memory unless keyed; 3600 s TTL). The Hermes key charset is (verify).
  - `startChatRun` (`lib/chat/relay.ts:40-106`): `web:${crypto.randomUUID()}`.
  - `startBotChatRun` (`lib/bots/chat.ts:35-62`): `bot:${crypto.randomUUID()}`.
  - `startCreateTurn`: `create:${rowId}`.
  - Muse run: `muse:${crypto.randomUUID()}`.
- Status routes NEW. All are `Cache-Control: no-store`, with run ids regex-checked like the events routes:
  - `app/api/chat/[runId]/status/route.ts` (`sessionUserId`)
  - `app/api/bots/[name]/chat/[runId]/status/route.ts` (`sessionUserId` + `getBot`)
  - `app/api/create/events/[runId]/status/route.ts` (`storeSessionUserId`; the mini host is allowed via `/api/create/*`, `middleware.ts:172-176`)
  - `app/api/desktop/chat/[runId]/status/route.ts` (`desktopSession`)
  - Shared `lib/runs/status.ts`:
    - Require an `agent_runs` row for `(user_id, hermes_run_id)`, otherwise 404.
    - Then `peekUserBox` (`boxes.ts:212`; no wake) and `getRun` (R-CF-06, §2.5 C6). Respond `{status, output?}`.
    - When the box is not ready, respond `{status: row.outcome ?? "unknown"}`.
    - Never call `ensureBoxAwake`.
- `apps/web/lib/chat/recover.ts` NEW (client-safe): `recoverRun(statusUrl, {onDone(output?), onFailed, onLost, signal})`. It polls 2→4→8→15 s, capped at 60 min.
  - Wire it into `app/home/page.tsx:731-736` (status URL `/api/bots/${botName}/chat/${run_id}/status` for bot runs, matching `:639-643`), `app/home/bots-panel.tsx:540-544` and `CreateStudio.tsx:1964`.
  - On error: show "Reconnecting…", keep busy and the stop button active, and fill `output` only when `acc` is shorter.
  - `lost`/404 → reload the transcript through each surface's existing loader (home: `/api/box/api/sessions/${thread}/messages`, `page.tsx:453-455`; bots/Create: their history fetch, verify).
  - The desktop client is not in this repo; the owner ships that change (§6).
- Creative SSE: **keep polling**. On Paid, 480 one-query polls are far under the 10,000-subrequest default and ~150 ms CPU.
  - `app/api/creative/[jobId]/events/route.ts`:
    - The abort check at `:57` works once the flag is on.
    - At `MAX_STREAM_MS` (`:19`), send `creative.status {phase, reconnect:true}` before closing.
    - Log `creative.events.closed {reason: aborted|terminal|deadline|error}` in the `finally` (`:105-111`). The name joins R-CF-15's table (§2.5 C16).
  - `app/home/page.tsx:530-532`: on `onerror` or `reconnect`, when the last phase is non-terminal, re-open the `EventSource` after 2 s, up to 3 times (R-CF-08 Workflow jobs can outlive 480 s). Only then show "Connection lost".
  - Optional later: Supabase Realtime. Coordinate with R-CF-08 so there is one trigger:
    - `AFTER UPDATE OF status ON creative_jobs FOR EACH ROW WHEN (NEW.channel = 'web' AND OLD.status IS DISTINCT FROM NEW.status)` (verify the `channel` column) → `realtime.send(...)`.
    - The client treats events as hints and re-fetches status before rendering a terminal state.
    - Needs `NEXT_PUBLIC_SUPABASE_URL` + the publishable key in the build (R-CF-01/R-CF-13). Neither name is in the repo today. Add both by hand to `apps/web/env.example.md` `## public`, with tag comments (§2.5 C20).
    - Private channels need Supabase JWT minting, because sessions are custom HS256.
- Gateway (`app/api/gateway/v1/[...path]/route.ts`): no change on Paid.
  - Streaming CPU (challenge numbers), all far under 60 s:
    - GMI lane: ~9-12 µs/chunk.
    - OpenAI Responses translation: ~11-16 ms per 1,000 events, plus ~0.35 ms per large `response.*` event.
    - Body rewrite: up to ~3 ms at 570 KB.
  - `after()` at `:1069`/`:1084` runs inside the `meteringTee` `onEnd` callback (`:1067-1090`), after the stream ends. If the acceptance probe below fails on OpenNext, capture `captureKeepAlive()` before `meteringTee` and call it there instead.
  - `meteringTee` buffers the whole stream as a string (`lib/gateway/metering.ts:108-136`). That is fine at 128 MB, but the memory is shared with concurrent requests in the isolate. Optional later: a 64 KB byte-window tail.
- `apps/web/lib/orchestrator/sweep.ts:11-16`: update the comment. `NULL_DEADLINE_GRACE_MS` no longer bounds Workers streams; the finalizer's `last_active_at` touch does.

**Acceptance.**
- [ ] Closing the tab during a creative job logs `creative.events.closed reason=aborted` within ~1 s (one `POLL_MS`).
- [ ] A 10-min agent run streams end to end via `/api/chat/[runId]/events` on Workers, with tail `cpuTime` under 500 ms for that request.
- [ ] Kill the tab mid-run: the `agent_runs` row gets `outcome` and `ended_at` within 2 min of the run ending, and `boxes.stop_after` is armed.
- [ ] A run longer than 30 min with no viewer is not stopped by the sweeper.
- [ ] Muse `run-status` returns `done` for a run that outlived the 8 s window.
- [ ] With a `then` payload, the registered continuation runs exactly once per run, on the terminal, `lost` and deadline paths, and the finalizer closes no row itself (stub continuation). R-CF-10's acceptance proves it on a Create job turn longer than 33 min, including `turn_done outcome=failed` when the box was stopped.
- [ ] Web, bots and Create clients recover the final output after a forced disconnect (devtools offline toggle) instead of showing "Connection lost". A lost run reloads the transcript.
- [ ] Streamed gateway calls on Workers write `agent_runs` rows with `outcome='gateway_completion'`. This proves `after(meter)` in the `meteringTee` callback works on OpenNext; otherwise apply the fallback above.
- [ ] For web, bot and Create runs, only the relay subscribes to `/v1/runs/{id}/events` (grep test). The internal Create turn route is exempt until R-CF-10 lands.

**Tests.**
- `lib/runs/finalize.test.ts` NEW (`FakeSupabase`, mocked `pollRunOnce`):
  - Terminal closes the row and arms; `running` returns `again` on the expected schedule; `lost` and deadline close as `lost`.
  - `then` calls the registered continuation once (stub injected into `continuations.ts`), with the `terminal`, `lost` and `deadline` results. With `then`, the finalizer never closes the row itself. An unknown `then.type` gives `dead`.
  - An already-closed row without `then` is a no-op.
  - A bot payload loads the key via `getBot`.
- `lib/create/turn.test.ts` (extend or NEW): `finalizeThen` enqueues one message with the `then` payload and its `deadlineAt`; without it, one message with no `then`.
- `app/api/chat/[runId]/status/route.test.ts` NEW (pattern: `app/api/create/events/[runId]/route.test.ts`): 401, 400, 404 for a foreign run, passthrough of `running`/`completed`, and `ensureBoxAwake` never called.
- `lib/chat/recover.test.ts` NEW (fake timers): backoff schedule, terminal callbacks, abort.
- `app/api/creative/[jobId]/events/route.test.ts` NEW: aborting the `NextRequest` signal stops polling; a terminal status emits one frame and closes; the deadline emits `reconnect`.
- `lib/chat/relay.test.ts` NEW: the terminal frame routes the close and re-arm promises through the captured `keepAlive`, and so does the cancel path.
- `lib/muse/capabilities.test.ts` (extend): `observeMuseRun` polls `getRun` and never calls `runEvents`.
- `lib/runtime/hermes-subscribers.test.ts` NEW: greps `runEvents(` call sites against an allowlist keyed by file:
  - `lib/chat/relay.ts`, `lib/bots/chat.ts`, `lib/bots/rooms.ts`, `lib/calendar/sweep.ts` (R-CF-11);
  - `lib/orchestrator/flush.ts` and `lib/email/inbound.ts` until R-CF-04/R-CF-06 land;
  - `app/api/internal/create/turn/route.ts` until R-CF-10 lands.
- `apps/web/wrangler.config.test.ts` (R-CF-15's file, extend): `compatibility_flags` contains `enable_request_signal` and does not contain `request_signal_passthrough`.
- Manual:
  - `opennextjs-cloudflare preview`, then `curl -N -H 'cookie: …' /api/chat/<run>/events` and `wrangler tail --format json | jq '.event.request.url, .cpuTime'`.
  - Kill curl mid-run and watch for `deferred.done kind=run.finalize`.

**Risks & notes.**
- Hermes is single-consumer: any second subscriber steals the stream from the browser, so server code must use `getRun`. R-CF-04 moves the flush stream (`flush.ts:1741`) to status polling. R-CF-06 does the same for email (`lib/email/inbound.ts:246-250`). R-CF-10 does it for the Create turn (`internal/create/turn/route.ts:81`) through this item's `run.finalize` (§2.5 C7).
- The status fallback recovers only the final output, not tool chips or deltas. A RunHub DO fan-out with replay (design D) is a later option, and only worth it if a multi-viewer need appears.
- Hermes keeps status in memory and expires it 3,600 s after terminal. Without the idempotency key it is lost on a gateway restart, and the finalizer closes the row as `lost`. Confirm that keyed runs persist (verify).
- A deploy, or a runtime update past the 20-min grace, can still cut long streams. The client recovery path covers that.
- With `enable_request_signal`, OpenNext's request signal aborts on disconnect. `after()`/`waitUntil` work still gets 30 s (verify that no route relies on finishing synchronous work after the client leaves).
- Each finalizer hop is one Queue message (~3 ops) plus one SELF request. A 60-min Create turn is ~320 hops, which is negligible on Paid.

**Depends on.** R-CF-02 (`wrangler.jsonc`, entry `queue()`), R-CF-05 (relays wake through `BoxLifecycle.wake`, §2.5 C8; `peekUserBox` semantics unchanged), R-CF-06 (`defer`, `captureKeepAlive`, `getRun`, `pollRunOnce`, the `deferHandlers.ts` table), R-CF-12 (compat-flag array). R-CF-10 builds its `create.turn_done` continuation on this item, so R-CF-10 depends on R-CF-07 and not the other way round.
