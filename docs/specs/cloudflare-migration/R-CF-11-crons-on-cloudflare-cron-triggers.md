# R-CF-11 — Crons on Cloudflare Cron Triggers

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-11: …`.

**Why.** The eight Vercel crons (`apps/web/vercel.json:2-35`) have not fired since about 2026-10-11, after the 5dee-studios team was blocked. Since then idle boxes are not stopped, agent schedules do not fire and orphaned flushes are not recovered, and `airv2-app` declares no `triggers` (`apps/web/wrangler.jsonc:1-22`). A 1:1 port fails even on Paid: every route awaits all of its work inline under a Vercel `maxDuration` of 60-800 s, but a Cron Trigger invocation ends at the 15-min wall, and so does every SELF call it awaits (developers.cloudflare.com/workers/platform/limits/#duration). The sweep and schedules graphs also reach `lib/orchestrator/flush.ts` statically, and flush pulls in heic-convert (`lib/identity/heif.ts:9`, which crashes at module evaluation per the contract) and ffmpeg-static/child_process (`lib/miniapps/freeze.ts:11,23`); schedule, trade and Find My delivery uses Spectrum gRPC (`lib/calendar/sweep.ts:188`, `lib/trade/watch.ts:170`, `lib/location/resolve.ts:165`), and fleet waves (600 s commands, `lib/fleet/sync.ts:35-36`) and migration copy passes (`lib/migration/transfer.ts:189-194`) do not fit one invocation. CPU (30 s for cron; 60 s for HTTP via `limits.cpu_ms`) and subrequests (10,000) do not bind at today's scale: 19 boxes, 4 active schedules (all iMessage), 0 content slots, 0 active campaigns and 2 Meta accounts (read-only SQL, 2026-10-26). Because the crons have been dark for weeks, `flush_jobs`, `agent_schedules` and `content_slots` rows are overdue, and the first Cloudflare tick must not fire them blindly (§1.3, §2.5 C13).

**Deltas.**

- Per-route disposition. The fan-out targets are Queue `air-deferred` through R-CF-06's `defer` (§2.5 C7), the new Workflows below, and `ConversationDO` (R-CF-04). On Vercel every route keeps its current inline behaviour; each route branches on `runtimeHost()` from `lib/runtime/platform.ts` (§2.5 C2): `"cloudflare"` takes the CF branch, while `"vercel"` and `"node"` (local `next start`, vitest) keep today's inline path.

| Route · schedule · maxDuration | Work today | Breaks on Workers Paid | Change (CF branch) |
|---|---|---|---|
| `sweep` · `* * * * *` · 800 (`sweep/route.ts:36`) | Idle stops (`idleStop.ts:38-116`; `ovctl` probe 15 s, `indexIdle.ts:25`). Stale reconcile (`route.ts:54-82`). Carried recovery (`88-93`). Up to 10 overdue `runFlush` (`97-120`, `overdueFlush.ts:37`). Up to 200 upload releases (`confirm.ts:76,88-117`). One fleet wave (`131-136`). Drafts. Versions. App-origin reconcile (a no-op, `deploy.ts:74,538,725`). Up to 5 migration drives (`migration/sweep.ts:14,39-51`). Approval relays. Find My (`198-206`). 5 TTL deletes (`210-243`). | Module evaluation crashes. The route reaches flush via `route.ts:13`, via `lib/location/resolve.ts:15`, and via `lib/migration/driver.ts:20` → `replay.ts:15` → `lib/email/inbound.ts:33`; flush then loads heif/freeze (`flush.ts:49-50`). `runFlush` is a full iMessage turn: Spectrum gRPC, ffmpeg, and `after()` via `miniapps/cards.ts` → `onboardingMirror.ts:306`. A fleet wave runs its boxes one after another (`sync.ts:544-597`; per box 240 + 240 + 600·n s), and 5 migration steps of up to 660 s each exceed the 15-min wall. tk_ stop/getBox (Tenki gRPC) fails. | Inline with a deadline: stops (R-CF-05's `coordinatedStop`, called inline per box; no fan-out), reconcile, carried, uploads, drafts, versions, app-origin, approvals, Find My (after R-CF-03), TTL (plus `deferred_jobs`, below). Overdue flush → R-CF-04's `notifyConversation` (no claim here). Fleet → `FleetSyncBox` Workflow. Migrations → defer kind `cron.migration.drive`. Cut all three flush edges (see the bullets below). |
| `schedules` · `* * * * *` · 800 (`schedules/route.ts:13`) | Up to 10 due (`calendar/sweep.ts:33,390-396`), run one after another (`401-413`). Each runs `claim_schedule`, `ensureBoxAwake` (`281`), `readFile` (`282-285`), `createRun` with no `idempotencyKey` (`286-290`), a full SSE consume (`293-297`), Spectrum/AgentMail delivery (`177-229`), the ledger (`329`) and agent_runs (`337-349`). | Module evaluation via `sweep.ts:18` (flush graph). Spectrum gRPC. One schedule (wake ≈ 11 min, plus the run) can pass 15 min, and the batch runs sequentially. | The route only claims, then makes one `SCHEDULE_RUN.createBatch` call with one `ScheduleRun` per claimed occurrence. |
| `trade` · `* * * * *` · 60 (`trade/route.ts:16`) | Expire (`service.ts:711`). Reconcile up to 100 owners (`route.ts:27-36`, `service.ts:661`). Watchlist read on every awake box (`watch.ts:100-116`), plus the alert send (`watch.ts:170`). | Spectrum gRPC alerts. tk_ doc reads fail silently (`watch.ts:110-112`: `.catch` → empty watchlist). | Inline, with a 45 s deadline (see `cronDeadlineMs`). Alerts go through R-CF-03, keyed with `imessageKey("trade-watch", …)` (§2.5 C15). |
| `publish` · `*/5` · 800 (`publish/route.ts:14`) | Per user: wake, then each slot (`worker.ts:151-182`). Ingest buffers up to 100 MB plus a sha256 (`lib/assets/pipeline.ts:58,180-181`). IG/TikTok status polls. | More than one user exceeds the 15-min wall. 128 MB isolate memory. | Defer kind `cron.publish.user`, one message per user. Ingest memory is bounded by R-CF-09. |
| `ads` · `*/10` · 300 (`ads/route.ts:14`) | `sweepSpendCeilings` (`ads/route.ts:20`): DB reads plus an OpenAI pause | Nothing | Inline. Add a log line. |
| `ad-metrics` · `15 * * * *` · 300 (`ad-metrics/route.ts:14`) | OpenAI insights pages (`metrics.ts:234-318`). Per Meta user: a wake plus `createRun` with no key (`331-373`, `359-364`). | Sequential wakes approach the 15-min wall. A retry starts a second run. | OpenAI inline. Meta → defer kind `cron.ads.metaReport`, one message per user, with an idempotency key. |
| `sources` · `0 */6 * * *` · 300 (`sources/route.ts:20`) | `proposeForUser` per user, in sequence (`sources/route.ts:34-44`) | Unbounded users × Composio latency, against the 15-min wall | Defer kind `cron.sources.user`, one message per user. Duplicate deliveries are safe because of the unique dedupe gate (`propose.ts:108-121`). |
| `health` · `30 * * * *` · 300 (`health/route.ts:16`) | `probeConnectionHealth`, `reconcileSpend`, `creativePreflight` (`health/route.ts:23-30`) | Nothing (fetch only) | Inline. Add a log line. |

- `apps/web/wrangler.jsonc` — add the block below; this item's values win over the §2.2 and R-CF-02 end-state sketches (§2.5 C10). `SELF` (R-CF-02: `{ "binding": "SELF", "service": "airv2-app", "entrypoint": "Internal" }`, §2.5 C1), `DEFERRED` (R-CF-06), `CONVERSATION` (R-CF-04) and `enable_request_signal` (R-CF-12) come from those items. The two Workflows are appended to the `workflows` array next to R-CF-08's `creative-job`; names and retention are this item's (§2.5 C9), and `create-job` is already taken by `air-create`. This item adds no Durable Object class and no migration tag (§2.5 C8). Regenerate `apps/web/worker/worker-configuration.d.ts` in the same PR with `npx wrangler types --env-interface CloudflareEnv worker/worker-configuration.d.ts` (§2.5 C4). The `createBatch({ instances })` object form needs Wrangler ≥ 4.148.0 for local dev and `wrangler types`; the repo resolves 4.149.0 (`package-lock.json:24872-24873`). `wrangler deploy` creates the Workflows itself, so R-CF-13's `ensure-resources` job needs no new step for this item (§2.5 C18).
  ```jsonc
  "triggers": { "crons": ["* * * * *", "*/5 * * * *", "*/10 * * * *", "15 * * * *", "0 */6 * * *", "30 * * * *"] },
  "workflows": [
    { "name": "air-schedule-run", "binding": "SCHEDULE_RUN", "class_name": "ScheduleRun",
      "default_retention": { "success_retention": "1 day", "error_retention": "7 days" } },
    { "name": "air-fleet-sync",   "binding": "FLEET_SYNC",   "class_name": "FleetSyncBox",
      "default_retention": { "success_retention": "1 day", "error_retention": "7 days" } }
  ]
  ```
  Explicit retention of 7 days or less follows §3.5; Workers Paid otherwise defaults new Workflows to 7 days (§3.1).
- `apps/web/worker/cron.ts` — NEW. Holds the dispatch table and the SELF fan-out. It does not read `cron_host`; the route guard is the only gate. Every call goes through R-CF-12's `selfFetch` (`lib/http/self.ts`), which on workerd calls `SELF` → the `Internal` entrypoint with the real app host (`env.appOrigin()`), so it never meets the hosting switch (§2.5 C1, C3). Import it by relative path (see Risks on `@/…` resolution).
  ```ts
  import { selfFetch } from "../lib/http/self";        // R-CF-12 (§2.5 C3)

  export const CRON_PATHS = {
    "* * * * *": ["/api/cron/sweep", "/api/cron/schedules", "/api/cron/trade"],
    "*/5 * * * *": ["/api/cron/publish"],
    "*/10 * * * *": ["/api/cron/ads"],
    "15 * * * *": ["/api/cron/ad-metrics"],
    "0 */6 * * *": ["/api/cron/sources"],
    "30 * * * *": ["/api/cron/health"],
  } as const;
  export const CRON_SOFT_BUDGET_MS = 12 * 60_000;   // routes stop starting new items
  export const CRON_FETCH_TIMEOUT_MS = 14 * 60_000; // < 15 min scheduled wall
  export async function runScheduled(c: ScheduledController, env: CloudflareEnv): Promise<void> {
    const paths = CRON_PATHS[c.cron as keyof typeof CRON_PATHS];
    if (!paths) { console.error(JSON.stringify({ msg: "cron.unknown", cron: c.cron })); return; }
    const secret = process.env["CRON_SECRET"];          // scheduled() already ran applyEnv(env) (§2.5 C3)
    if (!secret) { c.noRetry(); throw new Error("CRON_SECRET unset"); }
    const deadline = String(c.scheduledTime + CRON_SOFT_BUDGET_MS);
    const failures: string[] = [];
    await Promise.all(paths.map(async (path) => {
      const started = Date.now();
      let status = 0;
      try {
        const res = await selfFetch(path, {             // SELF → Internal; never proxyToVercel (§2.5 C1)
          headers: { authorization: `Bearer ${secret}`, "x-air-cron-deadline": deadline },
          signal: AbortSignal.timeout(CRON_FETCH_TIMEOUT_MS),
        }, { env });
        status = res.status;
        await res.text();                                // routes return small JSON; wait for completion
        if (status !== 200 && status !== 204) failures.push(`${path} ${status}`);
      } catch (error) {
        failures.push(`${path} ${error instanceof Error ? error.name : "error"}`);   // TimeoutError → callee cancelled
      } finally {
        console.info(JSON.stringify({ msg: "cron.dispatch", cron: c.cron, path, status,
          duration_ms: Date.now() - started, scheduled_time: c.scheduledTime }));   // R-CF-15 name (§2.5 C16)
      }
    }));
    if (failures.length > 0) {
      c.noRetry();                                       // the next tick is the retry; platform retry semantics undocumented (verify)
      throw new Error(`cron ${c.cron}: ${failures.join("; ")}`);
    }
  }
  ```
- `apps/web/worker/entry.ts` (R-CF-02):
  - Add the `scheduled` handler below. `applyEnv(env)` is its first statement (§2.5 C3). `waitUntil` alone is cut 30 s after the handler returns (developers.cloudflare.com/workers/runtime-apis/context/#waituntil). The runtime waits for the handler's own promise for up to 15 min, and the first rejected `waitUntil` sets the Cron Events status (developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/).
    ```ts
    async scheduled(c, env, ctx) {
      applyEnv(env);                      // first statement (§2.5 C3)
      const run = runScheduled(c, env);
      ctx.waitUntil(run);                 // records failure in Cron Events
      await run.catch(() => undefined);   // keeps the invocation alive up to the 15-min wall
    }
    ```
  - Export the Workflow classes: `export { ScheduleRun } from "./workflows/scheduleRun";` and `export { FleetSyncBox } from "./workflows/fleetSync";`.
  - No change to the public `fetch` or R-CF-02's `worker/handler.ts`. Cron calls arrive through `SELF` → `Internal`, so `target=vercel` never proxies them to the blocked Vercel, and there is no `/api/cron/` path exception or `x-air-cron` marker (§2.5 C1). The public `fetch` strips every inbound `x-air-*` header, `x-air-cron-deadline` included, so an outside caller cannot set the deadline.
- `apps/web/lib/runtime/platform.ts` (R-CF-12, §2.5 C2) — reuse; do not create `lib/runtime/host.ts`.
  - `runtimeHost(): "cloudflare" | "vercel" | "node"` selects every CF/Vercel branch in this item, as described above.
  - Code that runs in `scheduled()`, a Workflow step or a defer handler reads bindings (`SCHEDULE_RUN`, `FLEET_SYNC`, `CONVERSATION`, `DEFERRED`) through `cfEnv()`, never `getCloudflareContext()` directly. `cfEnv()` works there because every entrypoint has already run `applyEnv`, which calls `setCfEnv(env)` (§2.5 C3).
  - R-CF-12 moves `@opennextjs/cloudflare` to `dependencies`; this item adds no import of it.
- `supabase/migrations/NNNN_cron_host.sql` — NEW. Take the next free number at merge; 0140 is the highest today (§2.5 C23).
  ```sql
  -- Migration NNNN — cron ownership (R-CF-11). Only the host named by
  -- platform_settings.cron_host (or a 'cron_host:<route>' override) does cron
  -- work; the other host answers 204. Values are JSON strings.
  insert into platform_settings (key, value)
  values ('cron_host', to_jsonb('vercel'::text))
  on conflict (key) do nothing;
  do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'platform_settings_cron_host_value') then
      alter table platform_settings add constraint platform_settings_cron_host_value
        check ((key <> 'cron_host' and not starts_with(key, 'cron_host:'))
               or value in ('"vercel"'::jsonb, '"cloudflare"'::jsonb));
    end if;
  end $$;
  ```
  The table is `key text pk, value jsonb` (`0108_platform_settings.sql:8-13`). `writePlatformSetting` stores a JSON string (`lib/settings/platform.ts:37-47`).
- `apps/web/lib/settings/platform.ts` — add the following. Do not use `readPlatformSetting` (`:17-33`) here, because it hides errors.
  - `CRON_HOST_KEY = "cron_host"` and `type CronHost = "vercel" | "cloudflare"`.
  - `readCronHost(route): Promise<CronHost | null>`. One query: `.in("key", ["cron_host", \`cron_host:${route}\`])`. The override wins. No rows → `"vercel"`. A read error → `null`.
  - `isCronOwner(route) = (await readCronHost(route)) === (runtimeHost() === "cloudflare" ? "cloudflare" : "vercel")`. Node (local `next start`, vitest) answers as the Vercel host, so today's tests keep their inline behaviour; a `null` read is never the owner.
  - `writeCronHost(value: CronHost | "inherit", route?)`. Passing `"inherit"` with a route deletes that route's override.
- `apps/web/lib/cron/guard.ts` — NEW, next to the unused `lib/cron/auth.ts` (`cronAuthorized`, `:10-17`, which no route imports; leave it alone).
  - `cronGate(request, route, maxDurationSeconds)`:
    1. Runs `requireCron` (`lib/auth/guard.ts:173-180`) first, so a bad bearer still gets 401 before any DB read.
    2. If `!isCronOwner(route)`, logs `cron.skipped {route, host}` and returns `new NextResponse(null, { status: 204 })`.
    3. Otherwise returns `{ deadlineMs: cronDeadlineMs(request, maxDurationSeconds) }`.
  - `cronDeadlineMs` computes `local = now + maxDuration·1000 − min(60_000, maxDuration·250)`. That is 740 s for sweep/schedules/publish, 240 s for the 300 s routes and 45 s for trade. If `x-air-cron-deadline` parses to a value within [now, now + 15 min], the deadline is `min(header, local)`; otherwise it is `local`. This never widens a route's budget beyond today's. The header reaches the route only through `SELF` → `Internal` (§2.5 C1); a Vercel cron or any public caller gets `local`.
- `apps/web/app/api/cron/*/route.ts` (all 8) — replace the `requireCron(...)` lines (`sweep/route.ts:40-41`, `trade/route.ts:20-21`, `schedules/route.ts:17-18`, `publish/route.ts:18-19`, `ads/route.ts:18-19`, `ad-metrics/route.ts:18-19`, `sources/route.ts:24-25`, `health/route.ts:20-21`) with `cronGate(request, "<name>", maxDuration)`.
  - Check `Date.now() < deadlineMs && !request.signal.aborted` before each item in these loops:
    - `stopIdleBoxes` (pass `deadlineMs`; the param already exists at `idleStop.ts:42,58`);
    - the stale-reconcile loop (`sweep/route.ts:61`) and the overdue loop (`:99`);
    - the trade owners loop (`trade/route.ts:34`) and `tickWatchlists(supabase, deadlineMs)` (`watch.ts:106`). Both checks sit between owners and between boxes, never inside one owner's reconcile;
    - the schedules claim loop (`calendar/sweep.ts:401`);
    - on the Vercel branch: the publish per-user loop (`worker.ts:151`), the Meta loop (`metrics.ts:341`) and the sources loop (`sources/route.ts:34`).
  - The bounded sweep sections (uploads ≤ 200, drafts ≤ 10 filings, versions, approvals, Find My), the TTL deletes and the log line always run.
  - Whether OpenNext forwards the Workers request signal into `NextRequest.signal` is unverified (verify), so the deadline is the primary stop.
  - Log names follow R-CF-15's canonical table (§2.5 C16). Rename the existing duration lines to `cron.sweep` (`sweep/route.ts:248-269`), `cron.schedules` (`schedules/route.ts:24-30`), `cron.publish` (`publish/route.ts:24-30`) and `cron.trade` (`trade/route.ts:41-50`), keeping their fields. Add `cron.ads`, `cron.ad-metrics`, `cron.sources` and `cron.health` duration lines in the same shape as `publish/route.ts:24-30`. R-CF-15's Q5 and §5 check 11 match on these names.
- `apps/web/app/api/cron/sweep/route.ts`:
  - Idle stops stay inline. `stopIdleBoxes` calls R-CF-05's `coordinatedStop` per box when a `BOX_LIFECYCLE` stub exists (`idleStop.ts:83`; R-CF-05 owns that edit). There is no per-box fan-out.
  - Overdue flush (`:97-120`), CF branch: R-CF-04 owns this edit. It calls `notifyConversation(job.space_id, job.run_at)` from `lib/imessage/conversation.ts` for each job from `listClaimableOverdueFlushJobs`, and never `claimFlush`, because the DO claims. This item only wraps the route in `cronGate` and runs the backlog triage (below) before the first `:sweep` flip.
  - Vercel branch: `const { claimFlush, runFlush } = await import("@/lib/orchestrator/flush")`, replacing the static import at `:13`.
  - That alone does not drop flush from the route graph. The two bullets below are also required (verified with a static-import walk).
  - TTL pass (`:208-243`): add a delete of `deferred_jobs` rows with `status = 'done'` and `done_at < now() − 14 days` (R-CF-06 hands this to the sweep), counted in `ttlRows`. R-CF-03's 7-day `imessage_sends` delete (R-CF-03 owns that edit) also stays in this inline pass.
  - R-CF-08's creative reaper (`lib/creative/reaper.ts`) runs in the inline section; R-CF-08 owns that call.
- `apps/web/lib/hermes/deltas.ts` — NEW.
  - Move `hermesDeltas` (`lib/orchestrator/flush.ts:572-637`, self-contained) here and re-export it from flush.
  - Repoint `lib/calendar/sweep.ts:18`, `lib/email/inbound.ts:33` and `lib/bots/rooms.ts:17` to `../hermes/deltas`. This removes the migration-driver path (`driver.ts:20` → `replay.ts:15` → `inbound.ts:33`) and the schedules path.
- `apps/web/lib/orchestrator/scheduleFlush.ts` — NEW.
  - Move `scheduleFlush` (`flush.ts:257-289`) and its helpers here: `DEBOUNCE_MS`, `CREATIVE_READY_DEBOUNCE_MS` and `REFERENCE_WINDOW_MS` (`:79-87`), `InboundMessage` (`:167-176`), and `debounceMsFor` with its regexes (`:205-224`; it depends only on the leaf `creative/parse`). Re-export all of them from flush.
  - `lib/location/resolve.ts:15` imports from the new module. Semantics are unchanged: the location context row is an RPC write, and the overdue path above runs it.
  - Coordinate with R-CF-12 (lazy poison imports) so this lands once.
- `apps/web/lib/calendar/sweep.ts`:
  - Thread `dueAt` (the pre-claim `next_run_at`, as an ISO string) through. The RPC returns the post-update row (`0106_compute_migrations.sql:305-313,345`), so `claimed.schedule.next_run_at` is already the next fire. `dueAt` is the same value R-CF-03 threads through `runSchedule` to `deliverImessage`.
  - `createRun({ ..., idempotencyKey: \`schedule-${id}-${Date.parse(dueAt)}\` })` (`:286-290`). This is the same string as `p_holder` (`:137`).
  - The `sendDraft` key becomes `schedule-${id}-${Date.parse(dueAt)}` instead of `Date.now()` (`:227`). Both mail providers send it as `Idempotency-Key` (`lib/agentmail/client.ts:340`, `lib/wzrdmail/client.ts:316`, via `lib/mail/client.ts:72-73`).
  - Split `runSchedule` (`:260-384`) into exported step functions: `scheduleWake`, `scheduleCreateRun`, `scheduleReadOutput` (CF: R-CF-06's `getRun` → output capped at 512 KiB, under the 1 MiB step-return limit), `scheduleDeliver`, `scheduleFinalize` and `scheduleFail`. `runSchedule` stays as their inline composition for Vercel, where the SSE consume (`:293-297`) stays inside the cron request; R-CF-07's `hermes-subscribers` allowlist keeps `lib/calendar/sweep.ts` for that path only.
  - Keep `runSchedule`'s order: `recordDelivery` (`:329`), then throw on `suppressed_transient`/`failed` (`:330-335`), then `agent_runs` (`:337-349`), then the one-shot delete and `rm -f` (`:350-365`).
  - `scheduleFinalize` is check-then-insert. `agent_runs` is keyed by `hermes_run_id`; `schedule_deliveries` is keyed by `(schedule_id, disposition, content_hash, created_at ≥ dueAt)`. Neither table has a unique key.
  - `scheduleFail` = `recordFailure` (`:231-257`) + the one-shot delete (`:372-379`) + `armStopAfter` (`:382`) + `completeOperation` (`:409-411`).
  - iMessage delivery uses the key `imessageKey("cal", schedule.id, dueAt)` (R-CF-03, §2.5 C15). On CF, `scheduleDeliver` sends through `conversation(destination.space_id).deliver(parts, { key })` (R-CF-04, §2.5 C8), with `parts` holding the output as one text message (R-CF-04 owns the part shape), so the bubble is ordered with the chat's turn bubbles. If `CONVERSATION` is unbound, it sends through the R-CF-03 transport with `clientMessageId: key`. The Vercel inline path sends through the transport with the same key.
  - `sweepSchedules`, CF branch: claim each due row (unchanged; still skip `duplicate`, `:404`), then make one `SCHEDULE_RUN.createBatch({ instances })` call. Each instance gets `id: workflowId("sched", schedule.id, Math.floor(Date.parse(dueAt) / 1000))` and `params: { schedule: claimed.schedule, dueAt, operationId }`.
    - A per-entry error with code 10405 (ID already exists) counts as success.
    - Any other per-entry error, or a thrown `createBatch` (invalid options make the whole call throw before any instance is created, developers.cloudflare.com/workflows/build/workers-api/#createbatch): run `scheduleFail` inline for the affected occurrences. This matches a failed `runSchedule` today.
- `apps/web/worker/workflows/scheduleRun.ts` — NEW `ScheduleRun extends WorkflowEntrypoint<CloudflareEnv, ScheduleRunParams>`.
  - `run()` calls `applyEnv(this.env)` as its first statement (§2.5 C3). Steps read bindings through `cfEnv()` (§2.5 C2).
  - Steps: `wake` → (keep-awake branch: `finalize-keepawake`, mirroring `sweep.ts:268-280`) → `create-run` → `arm-finalize` → wait `run-done` → `read-output` → `deliver` (email: `create-draft` then `send-draft`, so the draft id is sealed before the keyed send) → `finalize`. On a thrown error, run `fail`, then rethrow.
  - `wake` calls `ensureBoxAwake`, which goes through R-CF-05's blocking `BoxLifecycle.wake(boxId)` (§2.5 C8). A Workflow step may block, so it does not need `wakeStep`.
  - Waiting for the Hermes run. R-CF-07's `run.finalize` is the only mechanism that waits for a run outside a request (§2.5 C7), so no step holds the run's SSE:
    - `arm-finalize`: `defer("run.finalize", { userId, runId, source: "schedule", then: { type: "schedule.run_done", instanceId }, deadlineAt: runCreatedAt + 30 min }, { key: \`run:${runId}\`, delaySeconds: 5 })`. A restarted step re-sends the same key, and R-CF-06's ledger answers `dup` or `busy`, so there is still one finalizer per run.
    - `step.waitForEvent("run-done", { type: "run-done", timeout: "35 minutes" })`. A timeout does not fail the instance by itself; `read-output` decides.
    - `read-output`: re-resolve the box target without waking (`peekUserBox`, `boxes.ts:212`), then call `getRun(target, runId)` (R-CF-06, §2.5 C6). `completed` with non-empty output → the output, capped at 512 KiB. Any other status, or `null` → throw, so `fail` runs. The pinned Hermes keeps terminal status and output for 3,600 s (R-CF-04), far longer than this gap.
  - `apps/web/lib/cron/scheduleRunDone.ts` NEW: the `schedule.run_done` continuation. Add `{ type: "schedule.run_done", instanceId }` to R-CF-07's `then` continuation table in `lib/runs/finalize.ts`, and `"schedule"` to its `source` union. R-CF-07's finalizer polls through `pollRunOnce`/`getRun` (which also keeps the box's `stop_after` armed while the run is going) and calls the continuation once: on a terminal status, on `lost` or at `deadlineAt`.
    - The continuation calls `cfEnv().SCHEDULE_RUN.get(instanceId)`, then `sendEvent({ type: "run-done", payload: { outcome } })`.
    - `sendEvent` throws when the instance is not running. Log it and return done: the instance has already failed or finished.
    - `closeRunRow` matches no row here, because `ScheduleRun` inserts `agent_runs` only in `finalize`, so it is a no-op.
    - Whether an event sent before the instance reaches `waitForEvent` is buffered is unverified (verify). If it is not, the `read-output` re-check still delivers after the timeout; `delaySeconds: 5` makes that race unlikely.
  - Parity: on CF the delivered text is `status.output` (the final answer only), while Vercel's inline path concatenates every `message.delta`. This is the same deliberate difference as R-CF-04's turn delivery.
  - `create-draft` first checks `listDrafts(inboxId)` for a draft with the same subject and text and reuses it. A restarted step would otherwise leave an orphan that `sweepUnfiledDrafts` files as a review after 5 min (`lib/email/draftSweep.ts:2-7,13`).
  - Never return a box target or hosted token from a step, because step outputs are persisted. Every box step re-resolves credentials (`ensureBoxAwake` is cheap when the box is already healthy).
  - Give every `step.do` an explicit `WorkflowStepConfig` (§2.5 C9). Every step timeout exceeds its inner timeouts and stays at or under 30 min (developers.cloudflare.com/workflows/build/rules-of-workflows/):

    | step | inner worst case | timeout | retries |
    |---|---|---|---|
    | `wake` | `waitForBox` 240 s (`env.ts:295-297`, `box/client.ts:421-436`) + health/refresh 180 s (`boxes.ts:339`) + one in-flight 60 s command + 60 s fetch margin (`box/client.ts:285`) | `15 minutes` | `{limit: 2, delay: "30 seconds"}` |
    | `create-run` | `readFile` 60 s + 60 s, `createRun` 60 s (`hermes/client.ts:33`) | `5 minutes` | `{limit: 1, delay: "10 seconds"}` |
    | `arm-finalize` | one `DEFERRED.send`, retried once inside `defer` (R-CF-06) | `1 minute` | `{limit: 3, delay: "10 seconds"}` |
    | `run-done` (`waitForEvent`, not a `step.do`) | `deadlineAt` (run start + 30 min) plus one 15 s finalizer hop | `35 minutes` | n/a |
    | `read-output` | target lookup + `getRun` 15 s (R-CF-06) | `1 minute` | `{limit: 2, delay: "10 seconds"}` |
    | `deliver` / `send-draft` | one send (idempotent by key) | `3 minutes` | `{limit: 3, delay: "10 seconds", backoff: "exponential"}` |
    | `create-draft` | `listDrafts` + one AgentMail call | `1 minute` | `{limit: 0, delay: "1 second"}` |
    | `finalize` / `fail` | DB writes + `armStopAfter` + `completeOperation` | `2 minutes` | `{limit: 5, delay: "10 seconds", backoff: "exponential"}` |
- `apps/web/lib/fleet/sync.ts` + `apps/web/worker/workflows/fleetSync.ts` — NEW `FleetSyncBox extends WorkflowEntrypoint<CloudflareEnv, FleetSyncParams>`. Its `run()` calls `applyEnv(this.env)` as its first statement (§2.5 C3).
  - CF branch of `runSyncJobs` (`:478`): keep `reclaimExpiredLeases` and the canary→rolling→done transitions (`:508-538`). Claim a new wave (`claimWave`, `:336`) only when the job has no `syncing` rows; that caps the job at `wave_size` boxes in flight. Today one sweep syncs its wave one box at a time (`:544-597`), but overlapping sweeps can each hold a wave.
  - Then call `FLEET_SYNC.createBatch` with ids `workflowId("fleet", job.id, boxId, claimEpochSec)`. Treat 10405 as success. For any other error, release that row (`releaseClaims`, `:600`).
  - Split `syncOneBox` (`:233-328`) into the steps `check` → `resume` → `wait-ready` → `wait-home` → `sync` → `hermes-<i>` → `verify` → `finish`.
    - `check` covers `getBox`, `stop_after`, `activeMigrationFor` and `jobActive` (`:239-271`, `:546`), and returns `wasStopped`.
    - `finish` always runs, including after a failed step. It applies today's row outcome handling (`:558-596`: `deferred` → `pending`, row state, `bumpFailures`, pause at the threshold) and stops the box when `check` saw it stopped (`:323-327`).
  - Each step first renews the lease (`update sync_job_boxes set started_at = now() where job_id = … and provider_box_id = … and state = 'syncing'`) and re-checks `jobActive` (`:415`). If 0 rows match or the job is paused, it skips to `finish` with no box side effects; this is the durable fence written before every side effect (§2.5 C9).
  - `CLAIM_LEASE_MS` (`:43-47`, 1,460 s) stays above every step timeout.
  - Every `step.do` sets an explicit `WorkflowStepConfig` (§2.5 C9). Timeouts: `wait-ready` 6 min; `wait-home` 7 min (240 s + a 20 s probe + 60 s, `box/client.ts:512-528`); `sync`/`hermes-<i>`/`verify` 13 min (600 s command + 60 s fetch, `sync.ts:279-304`, `box/client.ts:285`).
  - Retries: `{limit: 0, delay: "1 second"}` on the on-box commands, because a retry can overlap a command still running on the box under the provider's 600 s cap (`sync.ts:32-36,199-206`). Use 2 retries on `resume` and the waits.
- `apps/web/lib/migration/sweep.ts` — CF branch: replace the inline `driveMigration` loop (`:39-51`) with one `defer("cron.migration.drive", { migrationId }, { key })` per due row (key rule below). The handler calls `driveMigration(supabase, id, { budgetMs: 60_000 })`. The driver's worker claim, heartbeat and `setWake` (`driver.ts:143-170`) make redelivery a no-op.
- `apps/web/lib/publish/worker.ts`:
  - Extract the per-user body (`:151-182`) into `publishUserSlots(supabase, userId, slotIds, deadlineMs)`. It re-reads slots by id; `claimSlot` (`:233`) and the `publish_state` checkpoints (`slots.ts:31,76`) gate them.
  - CF branch of `publishDueSlots`: one `defer("cron.publish.user", { userId, slotIds }, { key })` per user.
- `apps/web/lib/ads/metrics.ts` — `enqueueMetaReporting` (`:331-373`):
  - CF: one `defer("cron.ads.metaReport", { userId }, { key })` per user. The cooldown check (`:343-357`) moves into the handler.
  - Both hosts: `createRun({ ..., idempotencyKey: \`ads-reporting-${userId}-${yyyy-mm-dd UTC}\` })`.
- `apps/web/app/api/cron/sources/route.ts` — CF branch: one `defer("cron.sources.user", { userId }, { key })` per candidate user instead of the loop (`:34-44`).
- `apps/web/lib/cron/jobs.ts` — NEW. Holds the `run` functions of the 4 kinds. It is not a registry (§2.5 C7): add one row per kind to R-CF-06's table in `apps/web/lib/runtime/deferHandlers.ts`, and the kinds to its `DeferKind` union and `DeferPayloads`, with `run` lazily imported from this module.

  | Kind | Payload (ids only, C4) | `maxSeconds` | `maxHops` | `vercelInline` | Key |
  |---|---|---|---|---|---|
  | `cron.publish.user` | `{userId, slotIds}` | 720 | 0 | `() => true` | `deferKey("cron.publish.user", userId, tick)` |
  | `cron.ads.metaReport` | `{userId}` | 600 | 0 | `() => true` | `deferKey("cron.ads.metaReport", userId, tick)` |
  | `cron.sources.user` | `{userId}` | 300 | 0 | `() => true` | `deferKey("cron.sources.user", userId, tick)` |
  | `cron.migration.drive` | `{migrationId}` | 720 | 0 | `() => true` | `deferKey("cron.migration.drive", migrationId, tick)` |

  - `key` is required (§2.5 C7). `tick` is `String(Math.floor(Date.now() / periodMs))`, with the route's period: 5 min for publish, 1 h for ad-metrics, 6 h for sources and 1 min for the sweep. A replayed tick dedupes as `dup`; the next tick gets a fresh key, so a failed attempt is retried on today's schedule.
  - Each `run` sets `deadlineMs = start + (maxSeconds − 60) · 1000` and passes it down (`publishUserSlots`, the Meta handler, `proposeForUser`). R-CF-06's route races the handler against `maxSeconds` (≤ 840, under the 15-min consumer wall), and the queue settings are R-CF-06's (`max_batch_size` 1), so the consumer needs no per-kind check.
  - `vercelInline` is true, as for R-CF-06's own kinds. On Vercel the routes keep their inline loops and never call `defer`.
  - Each route logs `cron.fanout {route, kind, count}` once per tick.
  - Outside a Next request scope (a Workflow step), `after()` throws at `lib/routing/imessage.ts:93`. At `lib/miniapps/onboardingMirror.ts:306` it is caught, and the work falls back to an un-awaited `void run()` that can be cut off when the invocation ends. Inside R-CF-06's `/api/internal/defer` request, `after()` is cut 30 s after the response. Handlers and steps must not reach either site, or must wrap them via R-CF-06's `defer`.
- `apps/web/lib/cron/workflowId.ts` — NEW. `workflowId(prefix, ...parts)` joins with `_` and replaces `[^a-zA-Z0-9_-]` with `-`. If the result is over 100 chars it returns `${prefix}_${sha256hex(raw).slice(0, 40)}`. Output must match `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$` (developers.cloudflare.com/workflows/reference/limits/, §2.5 C9). IDs stay reserved for each Workflow's configured `default_retention` (1 day on success, 7 days on error, above), and each id here is unique per occurrence or claim.
- `apps/web/lib/cron/backlog.ts` + `apps/web/app/api/admin/cron/backlog/route.ts` — NEW. The backlog triage that must run before the first `cron_host=cloudflare` flip (§2.5 C13, §1.3). Running it against production is owner-only (§2.5 C22, §6); Devin implements it and tests it locally.
  - Both methods use `requireAdmin` (`Authorization: Bearer $ADMIN_API_KEY` plus `x-admin-operator`, `lib/auth/guard.ts:153-170`). Responses carry identifiers and counts only (C4), never message bodies or prompts.
  - `GET` → `reportCronBacklog(supabase, now)`. Per table it returns the count and the oldest due time:
    - `flush_jobs` that `listClaimableOverdueFlushJobs` (`overdueFlush.ts:22-42`) would claim, with the count and oldest `received_at` of their `batch_queue` and `carried_messages` rows;
    - `agent_schedules` with `status = 'active'` and `next_run_at < now()`, split into one-shot and recurring;
    - `content_slots` with `status = 'scheduled'` and `scheduled_at < now()`.
  - `POST { before, schedules: "skip" | "fire" }` → `expireCronBacklog`. `before` must be an ISO time in the past, otherwise 400.
    - Flush backlog: delete the `batch_queue` and `carried_messages` rows with `received_at < before`, then delete the `flush_jobs` rows with `run_at < before` whose space has no rows left. No bubble is sent. The 48 h TTL (`sweep/route.ts:208-243`) would delete those rows anyway, but in the same tick it runs after the overdue flush (`:97-120`).
    - Schedules, `skip`: advance each overdue recurring row to its next future occurrence with the same `nextRunAt` + `clampToWakingHours` computation as `claimSchedule` (`calendar/sweep.ts:120-129`), as a CAS on the old `next_run_at`. Overdue one-shots get `status = 'deleted'`, as a failed one-shot does today (`:372-379`); the inert prompt file stays on the box. `fire` leaves the rows alone: each fires once on the first tick, because `claimSchedule` advances from `max(now, next_run_at)` (`:120-122`).
    - Content slots: set `status = 'parked'` and `error_message = 'cron backlog'` on `scheduled` rows with `scheduled_at < before`, so the user re-schedules instead of getting a weeks-late post.
    - Log `cron.backlog` with the counts and the operator.
  - The owner runs it immediately before flipping `:sweep`, `:schedules` and `:publish` (and again before the global key if more than an hour has passed): `GET`, decide `before` and `schedules`, `POST`, then `GET` again to see zero rows older than `before`.
- `apps/web/app/api/admin/settings/route.ts` — this item states the final contract for all three PRs that extend it (R-CF-04, R-CF-05 and this one; this is the last to land, in P3):
  - GET returns `box_default_provider`, `effective_box_provider`, `imessage_turn_engine`, `imessage_turn_canary_users`, `cron_host` and `cron_host_overrides` (`settingsPayload`, `:31-37`).
  - POST accepts any non-empty subset of `{box_default_provider, imessage_turn_engine, imessage_turn_canary_users, cron_host}`, plus an optional `route` that applies to `cron_host`. Today `:49-58` requires `box_default_provider`.
    - Each key given is validated, then written: `cron_host` through `writeCronHost` (`"vercel" | "cloudflare"`, or `"inherit"` with a `route`); the R-CF-04 keys as strings (R-CF-04 owns their values).
    - `route` must be one of the 8 cron names, and is valid only with `cron_host`.
    - Return 400 when no known key is supplied or any supplied value is invalid.
  - The admin panel repo is unchanged. The owner flips via curl (`Authorization: Bearer $ADMIN_API_KEY`, `x-admin-operator`, `guard.ts:153,161-170`) or via SQL: `update platform_settings set value = '"cloudflare"', updated_at = now() where key = 'cron_host';`.
- `apps/web/vercel.json` — unchanged in this PR. Remove the crons in P6, after at least 7 days with `cron_host=cloudflare` and no failed Cron Events.

**Acceptance.**
- [ ] `wrangler.jsonc` `triggers.crons` equals the 6 distinct `vercel.json` expressions, and `CRON_PATHS` maps exactly the 8 paths (unit test).
- [ ] With `cron_host=vercel`, every tick on CF logs `cron.dispatch` with `status: 204` per path, and no `cron.sweep|schedules|trade` line.
- [ ] With `HOSTING.target=vercel`, every `cron.dispatch` is still answered by airv2-app (200 or 204, never a proxied response): dispatch goes through `SELF` → `Internal` and never reaches `proxyToVercel` (§2.5 C1). No code reads `AIR_PUBLIC_ORIGIN`.
- [ ] After setting `cron_host=cloudflare`:
  - CF logs `cron.sweep`, `cron.schedules` and `cron.trade` every minute.
  - Vercel, when running a build that has the guard, answers 204.
  - No route starts on both hosts in the same minute.
- [ ] Before the `:sweep`, `:schedules` and `:publish` flips, the backlog report shows no row older than the owner's `before`. The first CF sweep sends no reply to a message older than that cutoff, and no weeks-old schedule or slot fires unless the owner chose `fire`.
- [ ] `/api/cron/sweep` and `/api/cron/schedules` never return 1101. No cron route's static graph reaches `orchestrator/flush`, `identity/heif` or `miniapps/freeze` (import-walk test).
- [ ] The sweep invocation does not end at 30 s: a sweep with a mocked slow phase (> 60 s) under `wrangler dev` completes and logs `cron.sweep`.
- [ ] No scheduled invocation reaches the 15-min wall. Route `duration_ms` stays at or under 12.5 min, trade's at or under 50 s, and the Cron Events table shows failures only for answers other than 200/204.
- [ ] A due schedule produces exactly one `ScheduleRun` (`sched_<uuid>_<epochSec>`) and at most one delivered bubble or email. A replayed tick or a step restart creates no second instance (10405 = success) and no second send.
- [ ] No `ScheduleRun` step opens `/v1/runs/{id}/events`. Each instance gets one `run.finalize` message (`run:<runId>`) and one `run-done` event; tail shows `deferred.done kind=run.finalize`. A schedule's iMessage goes through `ConversationDO.deliver` with `imessageKey("cal", id, dueAt)`.
- [ ] `createRun` from schedules and from ads-reporting carries `idempotency_key`. `sendDraft` uses a key that does not change across retries.
- [ ] A fleet job never has more than `wave_size` rows in `syncing`. A row's lease is never reclaimed while its `FleetSyncBox` step is running. A box the Workflow resumed is stopped again in `finish`, on every outcome.
- [ ] Migration drives, per-user publishes, Meta reports and source sweeps run as `cron.*` defer messages with `deferKey` keys, each finishing within its `maxSeconds` (under 15 min).
- [ ] The sweep deletes `done` `deferred_jobs` rows older than 14 days and no others.
- [ ] `GET /api/admin/settings` returns `cron_host` and the R-CF-04/R-CF-05 keys. POST `{cron_host: "bogus"}` → 400, and the DB check also rejects it. POST `{imessage_turn_engine: "after"}` alone still succeeds.
- [ ] A 401 still comes before the cron_host read: a wrong bearer gets 401, never 204.

**Tests.**
- `apps/web/worker/cron.test.ts` (NEW):
  - Parity between `CRON_PATHS`, `vercel.json` and `wrangler.jsonc`. Strip full-line `//` comments, then `JSON.parse`; comments must stay on their own lines.
  - `runScheduled` calls `selfFetch(path, init, { env })`. With a fake `SELF`, the request URL is `${APP_ORIGIN}${path}` (from `env.appOrigin()`), with the bearer and `x-air-cron-deadline = scheduledTime + 12 min`, and with no `x-air-cron` header.
  - Each path logs one `cron.dispatch` line with `status`, `duration_ms` and `scheduled_time`.
  - Unknown expression → no fetch and one `cron.unknown` line. Missing secret → throws and calls `noRetry`.
  - 500 or 401 → rejects. 204 → resolves.
  - Timeout (a fake `SELF` that never resolves, with `AbortSignal.timeout` mocked) → rejects and logs `status: 0`.
- R-CF-02's `worker/entry.test.ts`:
  - `scheduled()` calls `applyEnv` before `runScheduled`, and awaits it: the handler promise does not settle before the run does.
  - The public `fetch` has no `/api/cron/` exception: with `target=vercel`, a valid-bearer `GET /api/cron/sweep` on the public entry is proxied like any other path, and an inbound `x-air-cron-deadline` is stripped. (R-CF-02's `Internal` test covers the same request reaching OpenNext through `SELF`.)
  - `ScheduleRun` and `FleetSyncBox` are exported.
- `apps/web/lib/settings/platform.test.ts` (NEW), using `FakeSupabase.tables` / `errors` (`lib/testing/fakeSupabase.ts:54-60`): no row → `vercel`; the override beats the global row; a table error → `null`; `isCronOwner` compares against a mocked `runtimeHost`, and `"node"` answers as `vercel`.
- `apps/web/app/api/cron/cron.test.ts`:
  - Keep the 4 cases per route (`:136-158`).
  - Add: a `cron_host=cloudflare` row → 204 with the sweep mock not called; a `cron_host:<name>` override; a `platform_settings` error → 204; a wrong secret with the row present → 401.
  - Trade: a deadline reached after the first owner stops before the next owner's `reconcileTradeOrders`, and the next tick reconciles the rest. Running one owner's reconcile twice against unchanged venue states writes nothing the second time (`service.ts:661-707` updates only on a state change).
  - Sweep: the TTL pass deletes `deferred_jobs` rows that are `done` and older than 14 days, and keeps `queued`, `running`, `dead` and recent `done` rows.
- `apps/web/lib/trade/watch.test.ts` (R-CF-03 creates it with the alert-key cases): add that `tickWatchlists(supabase, deadlineMs)` stops between boxes at the deadline, and that a box skipped this tick is processed on the next; a cross persisted as `firing` before the deadline is delivered once on the next tick, with the same key.
- `apps/web/lib/cron/workflowId.test.ts` (charset, the 100-char hash path).
- `apps/web/lib/cron/guard.test.ts`: header bounds; `min(header, local)`; trade (60) → 45 s; `cron.skipped` on a non-owner.
- `apps/web/lib/cron/jobs.test.ts` (NEW): each of the 4 `deferHandlers.ts` rows has a schema, `maxSeconds` ≤ 840, `maxHops: 0` and `vercelInline`; payloads reject non-id fields; the key is stable within a tick and changes on the next; every route calls `defer` with a `key`.
- `apps/web/lib/cron/backlog.test.ts` (NEW, `FakeSupabase`):
  - The report selects no content column (`body`, prompts) and counts only rows past due.
  - Expire deletes only rows older than `before`, and deletes a `flush_jobs` row only when its space has no rows left.
  - `skip` advances a recurring schedule to a future time and deletes an overdue one-shot; `fire` changes nothing.
  - Overdue `scheduled` slots become `parked`.
  - A future `before` → 400; no admin bearer or operator → 401.
- `apps/web/lib/cron/importHygiene.test.ts` (NEW, reads source text).
  - It does a transitive walk over static `import … from` / `export … from`, ignoring `import type` and `await import(`. The roots are the 8 `app/api/cron/*/route.ts`, `worker/cron.ts`, `worker/workflows/scheduleRun.ts`, `worker/workflows/fleetSync.ts`, `lib/cron/jobs.ts` and `lib/cron/scheduleRunDone.ts`.
  - The test fails if the walk reaches `lib/orchestrator/flush.ts`, `lib/identity/heif.ts`, `lib/miniapps/freeze.ts`, `heic-convert`, `ffmpeg-static` or `node:child_process`.
  - Drop the heif/freeze entries once R-CF-09 makes them lazy.
- `apps/web/lib/calendar/sweep.test.ts`:
  - `createRun` receives the holder key.
  - The `sendDraft` key is identical across two calls with `Date.now` mocked.
  - The CF branch calls `createBatch` with charset-valid ids, treats 10405 as success, and runs `scheduleFail` when `createBatch` throws.
  - Running finalize twice inserts one `agent_runs` row.
  - `scheduleDeliver` on CF calls `deliver` with `imessageKey("cal", id, dueAt)`, and falls back to the transport with the same `clientMessageId` when `CONVERSATION` is unbound.
- `apps/web/worker/workflows/scheduleRun.test.ts` and `fleetSync.test.ts`:
  - `run()` calls `applyEnv(this.env)` before the first step.
  - Every `step.do` has an explicit `timeout` and `retries`.
  - Step timeouts exceed the command timeouts: assert the `STEP` constants against `SYNC_TIMEOUT_SECONDS + 60`, `env.boxReadyTimeoutMs() + 180_000`, and so on.
  - The lease-lost fence and a paused job both exit without box side effects, and `finish` still stops a resumed box.
  - `create-draft` reuses an existing draft.
  - `arm-finalize` sends one `run.finalize` with key `run:<runId>` and `then: {type: "schedule.run_done", instanceId}`. A `run-done` timeout (vitest `forceEventTimeout`) with a `completed` `getRun` still delivers; with a non-terminal or `null` status it runs `fail`.
- `apps/web/lib/cron/scheduleRunDone.test.ts` (NEW): the continuation sends one `run-done` event with the mapped outcome; a `sendEvent` throw is logged and returns done.
- `apps/web/lib/fleet/fleet.test.ts`: on the CF branch, no new claim while `syncing` rows exist; a non-10405 createBatch error releases the row.
- `apps/web/lib/ads/metrics.test.ts`: one idempotency key per user per day.
- `apps/web/lib/publish/worker.test.ts`: `publishUserSlots` honours the deadline, and leftover slots stay `scheduled`.
- `supabase/tests/cron_host.sql` (NEW). It runs in the CI `migrations` job's SQL-test loop (`.github/workflows/ci.yml:117-129`). It checks that the seeded row is `'"vercel"'`, and that inserting `('cron_host:sweep', '"bogus"')` raises `check_violation` (catch it in a `do` block and `raise` if no error).
- Manual probes:
  - Local: run `cd apps/web && npx opennextjs-cloudflare build && npx wrangler dev --test-scheduled`, then:
    - `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*+*+*+*+*"` → three `cron.dispatch` lines.
    - `curl -X POST "http://localhost:8787/cdn-cgi/local/explorer/api/local/scheduled?worker=airv2-app" -H 'content-type: application/json' --data '{"cron":"0 */6 * * *"}'` (Wrangler ≥ 4.139). Check `result.outcome`.
    - Backlog triage against the local Supabase: seed an overdue `flush_jobs` row with old `batch_queue` rows, `GET` then `POST` `/api/admin/cron/backlog`, and confirm the next `cron.sweep` sends nothing for it.
  - Prod (read-only): `npx wrangler tail airv2-app --format json | jq -c 'select(.event.cron != null)'` and `npx wrangler workflows instances list air-schedule-run`.
  - Staged flip. The owner runs it (§6), one override at a time, watching Workers Logs (`cron.skipped` / `cron.dispatch`) and the dashboard Cron Events:
    1. `cron_host:health`, then `:ads`, then `:sources` (fetch only).
    2. `:ad-metrics` and `:publish`, after R-CF-05's durable wake (and R-CF-09 for publish). Run the backlog triage right before `:publish`.
    3. `:trade`, after the R-CF-03 relay.
    4. `:sweep`, after R-CF-03, R-CF-04 and the R-CF-05 tk_ decision. Run the backlog triage right before.
    5. `:schedules`, after R-CF-03. Run the backlog triage right before.
    6. Then the global key, at P3 exit (§4).

**Risks & notes.**
- `cron_host` is deliberately independent of `HOSTING.target` (§2.5 C13). Cloudflare crons run through `scheduled()` → `SELF` → `Internal`, so they do not depend on the public target, and `cron_host=cloudflare` may flip at P3 exit, before P4's target flip, while app traffic is still proxied or Vercel is still blocked. `/_switch` is unchanged (R-CF-02). Rollback A changes only `target`; R-CF-14's runbook moves `cron_host` back to `vercel` only in rollback B, when the cron routes themselves are broken. Both hosts read the same single-valued row, so no host starts a route it does not own. A run already in flight when the flag flips overlaps at most one tick, and the claims below cover that.

> Note for owner: the build running on Vercel predates this guard, and Vercel deploys are blocked. If you settle the Vercel balance without first disabling Vercel Cron Jobs (Project → Settings → Cron Jobs, §6 item 3) or deploying this guard, the old build's crons will run alongside the CF crons. The claims make that safe but wasteful (double wakes cost box start quota), and the old build would also drain the weeks-old backlog without triage.

- Overlapping ticks (a sweep taking longer than 60 s) were already possible on Vercel and still are. Safety comes from the existing claims:
  - the `claim_schedule` CAS and receipt (`0106_compute_migrations.sql:262-347`);
  - the `claimFlush` 5-min lease (`overdueFlush.ts:3`);
  - the `ovctl` stop-claim (`indexIdle.ts:108`);
  - `claimSlot` / `CLAIM_TTL_MS` 15 min (`publish/slots.ts:70`);
  - the migration worker claim and the fleet lease.
- A crash between `claim_schedule` and `createBatch` drops that occurrence. That is the same exposure as a Vercel crash before `runSchedule` today, and the window is milliseconds.
- Hermes completion. ScheduleRun never holds the run's SSE: R-CF-07's `run.finalize` polls the run and the `schedule.run_done` continuation wakes the instance (§2.5 C7). The pinned Hermes (`d337b73`) already serves `GET /v1/runs/{id}` (R-CF-04: `api_server.py:83`, `api_server_runs.py:1008-1012`); only the repo client lacked it, and R-CF-06 adds `getRun` (§2.5 C6). No hermes-host change is required. A run that takes longer than `deadlineAt` (30 min) is closed as `lost` by the finalizer, then `read-output` fails the instance, which counts toward `failure_count`. An optional later improvement (P2, not built): hermes-host POSTs run completion to an `/api/box/v1/...` callback, which persists it and calls `SCHEDULE_RUN.get(id).sendEvent({ type: "run-done" })`. It would cut finalizer hops, but needs a hermes-host change and a fleet rollout.
- The Workflow engine may re-run a step even with `retries: 0` (§2.5 C9). The fences:
  - The Hermes `idempotency_key` dedupes only while the first run is alive (`hermes/client.ts:59-61`). A restart after completion can start a second run, which costs money but is never user-visible.
  - The `run:<runId>` defer key: one finalizer per run.
  - `imessageKey("cal", id, dueAt)` for iMessage (R-CF-03), sent through `ConversationDO.deliver` (R-CF-04).
  - `Idempotency-Key` for mail sends. Whether AgentMail scopes it per draft path is unverified (verify).
  - Draft reuse in `create-draft`.
  - Check-then-insert in finalize.
  - The fleet lease fence.
- The `claim_schedule` operation lease TTL is 600 s (`calendar/sweep.ts:138`), shorter than a worst-case ScheduleRun. That is the same exposure as Vercel's 800 s maxDuration today. Raise it only with the migration owner.
- The `void` tasks in `wakeBox` (`orchestrator/boxes.ts:329,386,391,396`) are cut when a step or queue invocation ends. R-CF-05 moves them to the `BoxLifecycle` post-wake alarm; until it lands, do not flip the routes that wake boxes. `wakeWaiters` (`:230`) does not dedupe across isolates; R-CF-05's DO does.
- tk_ boxes: stop, reconcile, fleet and watchlist reads fail on CF (`box/client.ts:20`, Tenki gRPC). Do not flip `cron_host:sweep` until R-CF-05 has migrated the 2 tk_ boxes or bound a TenkiRelay; otherwise they are never idle-stopped.
- Workflow and queue handlers import lib directly, so a second copy of that graph lands in the wrangler-bundled entry. That copy includes `next/server` via `lib/migration/admission.ts:14` (`NextResponse`).
  - Watch R-CF-13's size gate, and follow whatever pattern R-CF-08 (`CreativeJob`) and R-CF-06 use for lib imports. Bindings come from `cfEnv()` (§2.5 C2), never from `getCloudflareContext()`.
  - Whether Wrangler/esbuild resolves `@/…` through the `apps/web/tsconfig.json` paths is unverified (verify).
- Trigger edits take up to 15 min to propagate. Triggers are not versioned: `wrangler rollback` does not revert them, and if R-CF-13 ever switches to `wrangler versions upload`, also run `wrangler triggers deploy`.
- Workflow `schedules` on the binding are not used (developers.cloudflare.com/workflows/build/trigger-workflows/). The contract fixes Cron Triggers plus SELF.
- Publish: the 5-min tick is shorter than a 7-min wake, so a user can be enqueued in two consecutive ticks (two keys). `claimSlot` keeps this safe. Add a per-user lease only if the logs show double wakes.
- The backlog triage is a one-time cutover step, not a standing guard. If crons stop for longer than the 48 h TTL again, the owner re-runs it before they resume.
- Documented fallback, not built: pg_cron + pg_net, if Cron Triggers misbehave.
  - Write it as a guarded migration that checks `pg_available_extensions`, because the CI scratch DB is plain `postgres:15` (`ci.yml:85-86`) with no pg_cron, pg_net or vault (§2.5 C23).
  - Create the secrets out of band in Vault, never in a migration.
  - Use one `cron.schedule` per route and `net.http_get`, because the routes export only GET. Send it to `https://app.wzrd.tech/api/cron/<name>` with `Authorization` read from `vault.decrypted_secrets`. No marker header exists (§2.5 C1).
  - This call is not SELF: it enters the public `fetch`. It therefore works only once `HOSTING.target=cloudflare` (P4); before that, the switch proxies it to Vercel. The public `fetch` also strips `x-air-cron-deadline`, so the route would fall back to its local budget (740 s for sweep), which exceeds pg_net's timeout. If the fallback is ever built, first give `cronGate` a bounded non-`x-air-*` deadline input (for example a `deadline=<epoch ms>` query parameter with the same [now, now + 15 min] bounds and the same `min` with `local`), and send `now + 540000`.
  - Set `timeout_milliseconds := 600000`. That is the future pg_net cap, and a pg_net disconnect cancels the Worker invocation, so the 9-min deadline is what keeps the work inside the timeout.
  - Keep TTL or cleanup SQL out of the dispatch jobs: pg_net sends only at commit, so a failed delete would drop that minute's dispatch. Add a separate daily `cron.job_run_details` cleanup job.
  - Accept that the bearer sits readable in `net.http_request_queue.headers` until it is sent.
  - Make sure WAF and Bot Fight Mode do not challenge Supabase egress. `cron_host` still gates.
- Observability (names per R-CF-15's canonical table, §2.5 C16):
  - Renamed existing lines: `cron.sweep` (`sweep/route.ts:248-269`), `cron.schedules` (`schedules/route.ts:24-30`), `cron.publish` (`publish/route.ts:24-30`), `cron.trade` (`trade/route.ts:41-50`).
  - New lines: `cron.dispatch` (one per SELF call, with `scheduled_time`), `cron.unknown`, `cron.skipped`, `cron.ads|ad-metrics|sources|health`, `cron.fanout` (`{route, kind, count}`) and `cron.backlog`. R-CF-15's A4 alert counts `cron.dispatch`; the entry emits no second dispatch line.
  - Workers Logs are already enabled (`wrangler.jsonc:19-21`). R-CF-15 must keep head sampling at 1 for cron invocations or accept gaps. The dashboard Cron Events table is unsampled.

**Depends on.** R-CF-01 (packed `CRON_SECRET`), R-CF-02 (custom entry, `Internal` entrypoint and `SELF` binding, `applyEnv`, generated `worker-configuration.d.ts`), R-CF-03 (iMessage transport, `imessageKey`), R-CF-04 (`ConversationDO.deliver`, the sweep's `notifyConversation`), R-CF-05 (`BoxLifecycle.wake`, `coordinatedStop`, the tk_ decision), R-CF-06 (`defer`, the `deferHandlers.ts` table, Queue `air-deferred`, `getRun`/`pollRunOnce`, `deferred_jobs`), R-CF-07 (`run.finalize` and its `then` continuations), R-CF-09 (bounded ingest memory, lazy heif/freeze), R-CF-12 (`lib/runtime/platform.ts`, `selfFetch`, lazy poison imports) and R-CF-13 (deploy, size gate). Soft: R-CF-15 (sampling at 1 for cron invocations). **Phase P3**, after R-CF-06, R-CF-04 and R-CF-07. A P6 follow-up removes the `vercel.json` crons.
