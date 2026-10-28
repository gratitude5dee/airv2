# R-CF-05 — Box control on Workers

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-05: …`.

**Why.** 17 of the 19 live boxes are `ascii`. They run over plain fetch (`boxFetch`, `apps/web/lib/box/client.ts:130`), so they already work on Workers. Three problems remain.

1. **Tenki SDK cost and failure.** `client.ts:20` imports `./tenki` statically. That loads `@tenkicloud/sandbox` 1.0.2 and `@connectrpc/connect-node` (`lib/box/tenki.ts:30-42`), plus `ws` and ~154 KB of protobuf descriptors, into every route graph that reaches box code. `tenki-refs.ts:1-8` was split out for exactly this reason, but only `fork()` imports lazily (`client.ts:169`). Every Tenki call fails at `http2.connect()`, because `node:http2` is a stub in workerd (https://developers.cloudflare.com/workers/runtime-apis/nodejs/#non-functional-stub-modules). That covers the bidi `run` data plane behind `command()` (`tenki.ts:752-781`) and the unary control plane, which `sandbox()` builds on connect-node `createGrpcTransport` (`tenki.ts:154-172`). The SDK's data plane always uses connect-node `createGrpcTransport` + `Http2SessionManager`, whatever `ClientOptions.transport` says (challenge:crons). Injecting a transport therefore fixes nothing, on any plan.
2. **Wake dedupe is per process.** The single-flight maps are `wakeWaiters` (`lib/orchestrator/boxes.ts:230`), `resumesInFlight` (`tenki.ts:477`) and `pendingResumes` (`lib/box/desktop.ts:17`). On Workers they are per isolate. Prewarm, turn and relay on different isolates double-resume and race the hosted-token rotation in `refreshApiServerRoute` (`boxes.ts:107`). Stops are not serialized against wakes at all.
3. **Detached work and callers inside `after()` die.** `wakeBox` (`boxes.ts:285`) starts four detached tasks (`:329`, `:386`, `:391`, `:396-406`) that die when their request ends. Callers of `ensureBoxAwake` inside `after()` cannot finish a cold wake inside the 30 s `waitUntil` cap. A cold wake is `waitForBox` (5 s polls, 240 s default; `client.ts:421-437`, `lib/env.ts:296`) plus a health loop of up to 180 s (`boxes.ts:339-380`).

**Deltas.**
- `apps/web/lib/box/client.ts`
  - Delete the static import at `:20`.
  - `providerOf` (`:46-51`) takes `isTenkiBoxId`/`isTenkiTemplateRef` from `./tenki-refs`.
  - Add `loadTenki(): Promise<TenkiAdapter>`, a memoized `import("./tenki")`.
    - When `onWorkerd()` (`lib/runtime/platform.ts`, §2.5 C2) holds and `TENKI_RELAY` is unset: reject with `new BoxApiError(503, "tenki_unavailable_on_workers")` without importing anything.
    - When `onWorkerd()` holds and `TENKI_RELAY=1`: return the relay adapter (Option B).
  - Rebuild these as `async (...a) => (await loadTenki()).fn(...a)`:
    - `tenkiProvider` (`:346-363`)
    - `renameBox` (`:375-377`)
    - the `hostRoute` tenki branch (`:492-494`)
    - `fork()` (`:168-169`)
  - ascii paths must never evaluate the SDK.
- `apps/web/lib/runtime/platform.ts` belongs to R-CF-12 (P1, §2.5 C2). This item imports `onWorkerd()` and `cfEnv()` from it and adds nothing to the file. It defines no `isWorkerd` or `cfContext` alias. R-CF-12 also moves `@opennextjs/cloudflare` (`apps/web/package.json:45`) to `dependencies`.
- Default provider is ascii:
  - `apps/web/lib/settings/platform.ts`: add a pure `effectiveBoxProvider(stored)`.
    - Return `"tenki"` only when all three hold: stored is `"tenki"`; `isTenkiSnapshotRef(env.tenkiTemplateId())` holds; and the code is not running under `onWorkerd()` without `TENKI_RELAY=1`.
    - Otherwise return `"ascii"`. When the workerd rule is the reason, also log `log.warn("box_default_provider=tenki ignored on workers")`.
  - Callers of `effectiveBoxProvider`:
    - `apps/web/lib/provisioning/provision.ts:687-696` (`defaultBoxProvider`).
    - `apps/web/app/api/admin/settings/route.ts:21-29`: replace the local copy, so that GET shows the truth to the admin panel (separate repo, contract unchanged). This item does not touch POST (`:45-65`). R-CF-11 states the final POST contract, which R-CF-04 and R-CF-11 both extend.
  - `supabase/migrations/NNNN_box_default_provider_ascii.sql` NEW (§2.5 C23). The highest number today is `0140_wzrd_connect.sql`. Take the next free number at merge, because R-CF PRs land in any order.

    ```sql
    insert into platform_settings (key, value)
    values ('box_default_provider', '"ascii"'::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now();
    ```

    `value` is jsonb (`0108_platform_settings.sql`), and `readPlatformSetting` (`lib/settings/platform.ts:17-33`) expects a JSON string.
- **Owner decision: the 2 `tk_` boxes (P0, §6 item 5).** List them with `select user_id, provider_box_id, state from boxes where provider_box_id like 'tk_%';`.
  - **Option A (recommended): migrate to ascii** with the existing tooling, before P4 cutover. **The owner runs it**, because it needs production values and only the owner holds them (decision 2). Devin puts the command sequence and the expected output of each step in the PR description.
    - Call `POST /api/admin/migrations {op:"prepare", user_id, direction:"tenki_to_box"}`. Pass the direction explicitly, because the default is `box_to_tenki` (`app/api/admin/migrations/route.ts:122`). Then call `cutover` and `cleanup` (`:1-11`). To re-drive a parked phase, call `{op:"drive"}` (`:140-149`).
    - Auth: `Authorization: Bearer ADMIN_API_KEY` plus the `x-admin-operator` header (`lib/auth/guard.ts:153`).
    - `prepare` refuses unless `MIGRATION_ENABLED=true` (`lib/migration/operations.ts:59-67`, `lib/env.ts:526-527`).
    - The driver runs Tenki exec on the source box, so it must run on a **Node host**: a local `next start` whose child env carries the production values. The command is `npm run cf:env -- dev -- sh -c 'npx next build && MIGRATION_ENABLED=true npx next start'`. `cf:env -- dev` merges the md values into the child process env and writes only `.dev.vars` (R-CF-01). Never write an `.env*` file (R-CF-01 build guard).
    - `MIGRATION_ENABLED=true` exists only in that child env. Keep it unset on Cloudflare. `reconcileMigrations` is gated on it (`lib/migration/sweep.ts:20`), so the observe and retention timers do not auto-advance. Drive them with `GET ?user_id=` plus `{op:"drive"}` until the phase is `completed` (terminal phases at `lib/migration/types.ts:30-35`).
    - Never call `/api/cron/sweep` from that host, or the sweep double-runs against the active cron host.
  - **Option B: TenkiRelay.**
    - `infra/workers/sidecar` gets an optional `TenkiRelay` container class: lite, `sleepAfter` ~5 min, exactly one instance (§2.5 C14), so every Tenki op serializes in one container.
      - It takes the next `vN-tenki-relay` tag in `air-sidecar`'s own migrations list (§2.5 C8).
      - It wraps the Node SDK behind container routes `/v1/{getBox,resume,stop,deleteBox,command,writeFile,hostRoute,requestDesktop,renameBox,fork}`.
      - The sidecar Worker routes `/tenki/v1/*` to it and strips the prefix, as it does for R-CF-03's `/imessage/v1/*`.
      - Access is through the binding only. There is no auth header (§2.5 C15).
    - The container reads `TENKI_API_KEY`. This option adds a `TENKI_API_KEY=` line under `## secret @air-sidecar` in `apps/web/env.example.md`, and the owner pushes the value with `cf:env -- push --worker air-sidecar` (§2.5 C22). The `air-sidecar` deploy job in `.github/workflows/workers.yml` (R-CF-13, §2.5 C18) ships the class.
    - `apps/web/lib/box/tenki-relay.ts` NEW implements `BoxProvider` over `cfEnv()?.SIDECAR.fetch("https://sidecar/tenki/v1/<op>", …)`.
    - Add `TENKI_RELAY` to `OPTIONAL_ENV` (`lib/env.ts:60`). Hand-edit `apps/web/env.example.md` to add it in the right section with its tag comment. `lib/env.example.test.ts` enforces the format (§2.5 C20).
    - Cost: a 1-3 s container cold start on each idle wake.
  - With either option, `TENKI_API_KEY` stays in `REQUIRED_ENV` (`lib/env.ts:43`). The **R-CF-05.P6** follow-up PR moves it to `OPTIONAL_ENV` once no `tk_` rows remain. R-CF-14.4 and the §4 P6 exit list that PR.
  - Out of scope: the SDK-free Connect-JSON client and the in-box HTTP bridge (design:tenki-box steps 1-2). Their wire protocol is unverified, and both need a template rebuild.
- Per-isolate maps that lose dedupe on Workers:

  | Map | Effect on Workers | Replacement |
  |---|---|---|
  | `lib/orchestrator/boxes.ts:230` `wakeWaiters` | double resume, concurrent `refreshApiServerRoute` token rotation, duplicate `systemctl restart` (`:347-361`) | BoxLifecycle DO |
  | `lib/box/tenki.ts:477` `resumesInFlight` | duplicate Tenki sessions; the losers are closed (`:486-488`) | moot after Option A; Option B serializes in one container |
  | `lib/box/desktop.ts:17` `pendingResumes` | duplicate resume kicks | `kickWake()` via DO |
  | `lib/box/desktop.ts:16` `pendingDesktopRequests` | duplicate desktop-URL requests (harmless) | keep |
  | `lib/namespace/client.ts:382` `ingressTokens` | cache only: extra IssueIngressAccessToken calls | keep |
  | `lib/masterkey/client.ts:29` `inflight` (not box) | extra token mints | keep |

- `apps/web/worker/box-lifecycle-core.ts` NEW. A pure, testable `BoxLifecycleCore` with dependencies `{exec(op, body), storage, setAlarm, now}`.
  - There is one instance per `provider_box_id` (`idFromName`). That gives a global single-flight and serializes wakes, wake steps, post-wake work and stops.
  - Every RPC takes only `boxId` (§2.5 C8). The internal route looks up the user from `boxes.provider_box_id`. The core persists `box_id` on the first call.
  - `wake(boxId)`: blocking, for request paths (§2.5 C8).
    - In-memory single-flight: `this.inflight ??= …`. It waits for an in-flight stop to finish first.
    - On success, store `pending_post_wake = result.postWake`, clear any `step` cursor and arm the alarm.
    - Return the `UserBox` to callers only. **Never persist it**: it carries `hostedToken` and `apiServerKey`.
  - `wakeStep(boxId): { state: "ready" | "waking" | "failed", nextCheckMs }`: non-blocking, for alarm-driven callers such as R-CF-04's `wake` phase (§2.5 C8). Each call runs at most one probe.
    - While a `wake`, a stop or another step is in flight, return `{state:"waking", nextCheckMs: 2_000}` without probing.
    - Otherwise run one `exec("wake_step", {boxId, cursor})` with the persisted `step` cursor, and persist the cursor that comes back.
    - `ready`: clear the cursor, store `pending_post_wake` and arm the alarm, as `wake` does. `nextCheckMs` is 0.
    - `failed`: clear the cursor and record `last_result`, including `error_type` `start_limit`. `nextCheckMs` is 0.
    - The result never carries a `UserBox`. The caller re-reads the target from `boxes`; R-CF-04 never stores box tokens.
  - `kick(boxId)`
    - Store `pending_wake` and call `setAlarm(now)`. It is a no-op while a wake or a step is in flight.
    - If a `start_limit` was recorded less than 60 s ago, return `{lastError}`, so that desktop can still raise `StartLimitError`.
  - `stop(boxId)`: while a wake, a step cursor or post-wake work is in flight, return `{deferred:"waking"}`. Otherwise single-flight the stop.
  - `alarm()`
    - Run `pending_wake`.
    - Run `pending_post_wake` as `exec("post_wake")`.
    - Watchdog: if `op_started_at` is older than 10 min and nothing is in flight, clear the cursor and run `exec("reconcile")`.
    - The alarm time is the earlier of two times: now, when work is pending; and `op_started_at + 11 min`.
  - Persist only `{box_id, op, op_started_at, step, pending_wake, pending_post_wake, last_result:{ok, at, error_type?}}`. `step` is `{started_at, health_started_at?, probe, resumed, refreshed, restarted}` and holds no tokens.
- `apps/web/worker/box-lifecycle.ts` NEW: `export class BoxLifecycle extends DurableObject<CloudflareEnv>`.
  - The RPC methods `wake`, `wakeStep`, `kick` and `stop`, plus `alarm()`, each start with `applyEnv(this.env)` from `./env-unpack` (§2.5 C3). That call re-checks the pack digest on a reused isolate and calls `setCfEnv`, so `process.env.CRON_SECRET` and `cfEnv()` hold current values after a rotation.
  - A thin wrapper whose `exec` is:
    ```ts
    const exec = (op: LifecycleOp, body: Record<string, unknown>) =>
      selfFetch("/api/internal/box/lifecycle", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, "content-type": "application/json" },
        body: JSON.stringify({ op, ...body }),
      });
    ```
    - `selfFetch` (`lib/http/self.ts`, R-CF-12) calls `SELF`, which is the `Internal` entrypoint, with `new URL(path, env.appOrigin())`. The request never reaches the hosting switch (§2.5 C1).
    - The cron bearer is still sent, because the route uses `requireCron`.
  - Log one `{msg:"box.lifecycle", op, outcome, duration_ms}` line per exec through `log` (`lib/log.ts`). Never log the result body. This PR adds the name to R-CF-15's event table (§2.5 C16).
  - The DO stays active while its fetch is pending. The alarm wall is 15 min (https://developers.cloudflare.com/workers/platform/limits/#duration), so a worst-case wake (~420 s) fits.
- `apps/web/app/api/internal/box/lifecycle/route.ts` NEW. `runtime="nodejs"`, guarded by `requireCron` (`lib/auth/guard.ts:173`).
  - The body is `{op, boxId, cursor?, steps?}`. Look up `user_id` with `boxes.select("user_id").eq("provider_box_id", boxId).maybeSingle()`. If there is no row, return `{ok:false, error:{type:"error", status:404}}`.
  - `op:"wake"`
    - Run `assertAdmissionOpen` + `loadBoxCredentials` + `wakeBoxDirect(supabase, userId, creds, {collectPostWake:true})`.
    - `wakeBox` at `boxes.ts:285` is exported under the name `wakeBoxDirect`.
    - Return `{ok:true, box, postWake}` or `{ok:false, error:{type:"start_limit"|"box_api"|"error", status, message}}`.
  - `op:"wake_step"`: run `assertAdmissionOpen` + `loadBoxCredentials` + `wakeBoxStep(supabase, userId, creds, cursor)` (below). Return `{state, nextCheckMs, cursor, postWake?, error?}`.
  - `op:"stop"`: `stop()` (`client.ts:388`).
  - `op:"post_wake"`: `runPostWake(...)` (below).
  - `op:"reconcile"`: `reconcileVerdict` plus the row repair from `app/api/cron/sweep/route.ts:50-82`.
  - It must never call `ensureBoxAwake`, which would recurse into the DO.
- `apps/web/lib/orchestrator/boxes.ts`
  - `wakeBox(..., opts?: {collectPostWake?: boolean})`. When the flag is set, the four detached calls become step names in `postWake: PostWakeStep[]`, which is returned to the DO:
    - `void afterResume` (`:329`) → `"after_resume"`, only when a resume happened.
    - `void refreshDashboardRoute` (`:386`) → `"dashboard"`.
    - `void mirrorBrandIfStale` (`:391`) → `"brand"`.
    - The connected-tools IIFE (`:396-406`) → `"tools"`, only when `wroteStarting`.
    - Without the flag (Vercel, tests) the code is unchanged.
  - `wakeBoxStep(supabase, userId, creds, cursor)` NEW, exported. It runs one iteration of `wakeBox`, driven by the cursor instead of in-process loops. `wakeBox` itself is unchanged.
    - No cursor: call `getBox`. If the state is not `ready`/`idle`, write `starting` and call `resume` (`:293-327`, including the concurrent-resume rule and `StartLimitError`). Return `waking` with `nextCheckMs` 5,000.
    - `resumed` and not yet `ready`/`idle`: call `getBox` once and return `waking` at 5,000 ms, the `waitForBox` cadence (`client.ts:421-437`). Return `failed` on the `error` state, or once `boxReadyTimeoutMs()` has passed since `started_at`.
    - Box up: run one `health(target)` probe. If it fails, run one `refreshApiServerRoute` (`:107`) and probe again.
      - Once `refreshed` is set and 60 s have passed since `health_started_at` (`HERMES_RESTART_GRACE_MS`, `:59`), run the single `systemctl restart` (`:347-361`).
      - `nextCheckMs` is `wakeProbeDelayMs(probe)` (1/2/4/8 s, `:237`).
      - 180 s after `health_started_at`, return `failed`.
    - Healthy: write `ready` and the state event (`:408-416`). Return `ready` with `postWake`, as `collectPostWake` would.
    - `failed` runs the same cleanup as `wakeBox` (`:424-454`: `armStopAfter`, provider state restore).
  - `ensureBoxAwake` (`:249`): keep the per-caller admission, credentials and `stop_after:null` (`:255-265`). After that, when `lifecycleStub(boxId)` exists, return `coordinatedWake(boxId)` instead of taking the `wakeWaiters` path (`:267-276`).
  - `ensureBoxAwakeStep(supabase, userId)` NEW. It runs the same per-caller admission, credentials and `stop_after:null` (`:255-265`), then calls `wakeStep(boxId)`.
    - Without a stub (Node, tests), it awaits `ensureBoxAwake` and returns `{state:"ready", nextCheckMs:0}`.
    - R-CF-04's `wake` phase calls it.
  - `prewarmBox` (`:146-171`): on Workers it becomes `kickWake(boxId)`. The DO alarm runs a full wake, and the turn's `ensureBoxAwake` joins it. The R-CF-04 call site is unchanged.
  - `peekUserBox` (`:212`) stays the non-waking target lookup. It never touches the DO.
- `apps/web/lib/orchestrator/postWake.ts` NEW: `runPostWake(supabase, {userId, boxId, steps})`.
  - It runs `Promise.allSettled` over `afterResume(boxId)`, `refreshDashboardRoute`, `mirrorBrandIfStale` and `writeConnectedToolsFile(supabase, userId, boxTarget(boxId))`. These four already run concurrently today.
  - The worst case is ~4 min, which fits the 15 min alarm wall.
  - It logs each failure and never wakes the box.
- `apps/web/lib/box/lifecycle.ts` NEW
  - `lifecycleStub(boxId)`: given `ns = cfEnv()?.BOX_LIFECYCLE`, return `ns.get(ns.idFromName(boxId))`, or `null` when there is no binding. `cfEnv()` works in requests, DOs, `queue()` and `scheduled()` (§2.5 C2).
  - `coordinatedWake(boxId)`, `wakeStep(boxId)`, `kickWake(boxId)`, `coordinatedStop(boxId)`.
  - Map errors back to `StartLimitError`, `BoxApiError(status)` or `Error`. Messages carry no tokens.
- `apps/web/lib/box/desktop.ts:50-54` `resumeOnce`: when a stub exists, call `kickWake(boxId)`. A `lastError` of `start_limit` throws `StartLimitError` (today's path at `:128-130`). Keep the `state:"starting"` write at `:123-126`.
- Stop callers:
  - `apps/web/lib/orchestrator/idleStop.ts:83`: when a stub exists, call `coordinatedStop(box.provider_box_id)`.
    - On `{deferred:"waking"}`: release the claim as the refused-stop path does (`:102-105`), count it as `deferred.busy`, and leave `state` alone. The in-flight wake overwrites the `stopping` row written at `:79-82` with `ready` or the provider state (`boxes.ts:408-411`, `:439-449`).
    - `stopIdleBoxes` calls `coordinatedStop` inline for each box. There is no per-box fan-out, and R-CF-11's sweep needs no change for it.
  - `apps/web/app/api/box/stop/route.ts:67` (user stop): the same, except that `{deferred:"waking"}` returns 409 `{error:"box_waking"}`.
- Durable `ensureBoxAwake` for `after()` callers: every such caller moves to `defer(kind, payload, { key })` (the R-CF-06 table, §2.5 C7) or to R-CF-04/08/10. Inside a queue consumer or a Workflow step, the call runs synchronously in a SELF request (no wall limit while the caller waits), and the DO dedupes across isolates.
- `apps/web/wrangler.jsonc` (append to R-CF-02's config):

  ```jsonc
  "durable_objects": { "bindings": [ { "name": "BOX_LIFECYCLE", "class_name": "BoxLifecycle" } ] },
  "migrations": [ { "tag": "v1-box-lifecycle", "new_sqlite_classes": ["BoxLifecycle"] } ]
  ```

  - Migration tags are append-only, in merge order (§2.5 C8). `v1-box-lifecycle` comes first, because R-CF-05 ships in P2 and R-CF-04's `v2-conversation` follows in P3. Never edit a deployed entry.
  - This adds `BOX_LIFECYCLE` to the contract's binding list.
- `apps/web/worker/entry.ts` (R-CF-02):
  - Add `export { BoxLifecycle } from "./box-lifecycle";`.
  - No routing change. The DO's calls reach the `Internal` entrypoint through `SELF` and never touch the switch (§2.5 C1). No path rule exists for `/api/internal/box/lifecycle`.
- `apps/web/worker/worker-configuration.d.ts` (R-CF-02): after adding the binding, regenerate the file with `npx wrangler types --env-interface CloudflareEnv worker/worker-configuration.d.ts` and commit it (§2.5 C4). Never hand-edit it. Where the generated type is too loose, cast at the use site: `DurableObjectNamespace<BoxLifecycle>` in `worker/`, and a local structural RPC type in `lib/box/lifecycle.ts`, as R-CF-02 does for root code.
- `apps/web/package.json:16,22`: keep `@connectrpc/connect-node` and `@tenkicloud/sandbox` while the Node/Vercel path and `scripts/tenki-template.mjs` use them. Once no `tk_` rows remain and Option B is unused, the R-CF-05.P6 follow-up PR moves them to devDependencies.

**Acceptance.**
- [ ] Importing `lib/box/client.ts` and running ascii `getBox`/`command` never evaluates `lib/box/tenki.ts` (vitest flag).
- [ ] On `opennextjs-cloudflare preview`, ascii-user routes (`/api/box/status`, `/api/box/wake`) log no `ERR_METHOD_NOT_IMPLEMENTED`/`http2` errors. The PR records cold-isolate `cpuTime` before and after the change.
- [ ] On Workers, any op on a `tk_` box either fails with `BoxApiError` 503 `tenki_unavailable_on_workers` or succeeds through TenkiRelay (Option B).
- [ ] `platform_settings.box_default_provider = "ascii"`. On Workers, `GET /api/admin/settings` returns `effective_box_provider: "ascii"` even when the stored value is `"tenki"`.
- [ ] Option A (owner-run; Devin supplies the commands and expected output in the PR): before P4, `select count(*) from boxes where provider_box_id like 'tk_%'` returns 0, and both migrations reach `completed`.
- [ ] On the workers.dev deploy, two concurrent `POST /api/box/wake` calls for one stopped ascii box produce exactly one `{msg:"box.lifecycle", op:"wake"}` line (`wrangler tail`), and both callers get the same hosted token. `wrangler dev` runs a single isolate, so the core unit test also covers this case.
- [ ] Stepping a stopped ascii box with `wakeStep`:
  - it returns `waking`, with `nextCheckMs` 5,000 while the provider boots and then 1/2/4/8 s during health;
  - it then returns `ready`, with one `op:"wake_step"` line per call;
  - a `wakeStep` issued during a blocking `wake` logs no line;
  - after `ready`, `peekUserBox` returns the box.
- [ ] A sweep stop or user stop issued during an in-flight wake, step sequence or post-wake is deferred (sweep: `deferred.busy`; user: 409), not executed.
- [ ] After a cold wake on Workers, tail shows one `{msg:"box.lifecycle", op:"post_wake"}` alarm execution, and `connected-tools.md` is rewritten on the box.
- [ ] Under `wrangler dev --var SWITCH_HOSTS:localhost` with `target=vercel` in local KV (§2.5 C22), a `kickWake` still runs its exec on this build. It never reaches `proxyToVercel` (§2.5 C1).
- [ ] DO storage dumps (`wrangler dev` inspector) contain no `hostedToken` or `apiServerKey`.

**Tests.**
- `lib/box/client-lazy.test.ts` NEW. It must be a separate file, because `client.test.ts:31` imports `./tenki` directly.
  - `vi.mock("./tenki", …)` with an evaluation flag: ascii ops leave it false, and a `tk_` op sets it.
  - With `vi.stubGlobal("navigator", {userAgent:"Cloudflare-Workers"})` (read by `onWorkerd()`), a `tk_` op rejects with 503 and the flag stays false.
- `lib/settings/platform.test.ts` NEW: `effectiveBoxProvider` across combinations of stored value, template and workerd.
- `app/api/admin/settings/route.test.ts` NEW: GET on workerd returns effective `ascii`.
- `worker/box-lifecycle-core.test.ts` NEW (fake storage, exec and clock):
  - N concurrent `wake()` calls run one exec.
  - A stop during a wake, a step cursor or post-wake work returns `deferred`; a wake during a stop waits.
  - `wakeStep` runs one exec per call and persists the returned cursor. It returns `waking` without an exec while a `wake` or another step is in flight. On `ready` it arms post-wake and clears the cursor.
  - `kick` arms the alarm, and the alarm runs the wake.
  - Post-wake steps run from the alarm.
  - `start_limit` round-trips into `kick().lastError` and into a `failed` step.
  - The watchdog fires `reconcile` and clears a stale cursor.
  - Storage never holds the `UserBox`.
- `worker/box-lifecycle.test.ts` NEW (mock `cloudflare:workers`, `./env-unpack` and `lib/http/self`): every RPC and `alarm()` calls `applyEnv(this.env)` before anything else, and `exec` calls `selfFetch("/api/internal/box/lifecycle", …)` with the cron bearer.
- `lib/orchestrator/wake-waiter.test.ts`: with `cfEnv` mocked to return `{ BOX_LIFECYCLE }`, `ensureBoxAwake` delegates and `wakeWaiters` stays empty. The existing cases stay green without the stub.
- `lib/orchestrator/boxes.test.ts` (or extend `wake-waiter.test.ts`): with `collectPostWake`, nothing detached is called, and `postWake` lists the expected steps in both the resumed and the already-ready cases.
- `lib/orchestrator/wake.test.ts` (extend): `wakeBoxStep` transitions:
  - resume on the first call;
  - 5 s spacing while booting;
  - `wakeProbeDelayMs` spacing during health;
  - one restart at 60 s;
  - `failed` after 180 s, with the `wakeBox` cleanup.
  - Without a stub, `ensureBoxAwakeStep` falls back to `ensureBoxAwake`.
- `app/api/internal/box/lifecycle/route.test.ts` NEW:
  - 401 without the cron bearer;
  - `user_id` is looked up by `provider_box_id`;
  - `wake` and `wake_step` run admission and `wakeBoxDirect`/`wakeBoxStep`, and never `ensureBoxAwake`.
- `lib/orchestrator/postWake.test.ts` NEW: each step fails in isolation; nothing wakes the box.
- `lib/orchestrator/idleStop.test.ts` (extend): `{deferred:"waking"}` releases the claim and counts `busy`.
- Manual:
  - Run `wrangler dev`, make two parallel `curl -X POST /api/box/wake` calls, and watch `wrangler tail --format pretty | grep box.lifecycle`.
  - Run `opennextjs-cloudflare preview` with one ascii turn and one `tk_` turn (expect 503 for the `tk_` turn).

**Risks & notes.**
- Each `ensureBoxAwake` on Workers adds a DO RPC and a SELF request: an estimated +10-50 ms, plus one billed request. Measure it. A follow-up fast path: skip the DO when `creds.state==="ready"` and a 3 s `health()` passes.
- A deploy or runtime update restarts the DO. In-flight DO requests get up to 30 s, and any storage access after shutdown errors (https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/). The SELF wake can then be cancelled, and waiting callers reject and retry. The watchdog and the sweep reconcile at 30 min (`cron/sweep/route.ts:50-82`) repair rows left in `starting`. CI deploys on every main merge, so expect this in practice.
- Post-wake work now runs after the health loop instead of beside it. `afterResume` does not gate health (`boxes.ts:80-84`), so this is acceptable.
- A `wakeStep` probe can outlast R-CF-04's 10 s step budget, because `refreshApiServerRoute` runs the box-side `host` CLI with `--timeout 120` (`asciiHostCommand`). The step in the DO still completes and persists its cursor. A `wakeStep` that arrives meanwhile returns `waking` without probing, so a slow probe never doubles.
- Option A closes admission for the user during cutover. Messages queue through the existing `MigrationBusyError`/`holdReceipt` paths. If both users are inactive, the owner may prefer to notify them and delete the boxes instead.
- During a HOSTING switch window, Vercel's in-process `wakeWaiters` and the CF DO can wake the same box concurrently (challenge:crons). The existing concurrent-resume handling (`boxes.ts:303-327`) tolerates this.
- Namespace (macOS) wakes (`lib/compute/awake.ts:44-63`) stay uncoordinated. Because the DO is keyed by `provider_box_id`, they can join later.
- `CRON_SECRET` is optional in the manifest (`lib/env.ts:87`). Without it `requireCron` fails closed, so it must be set on Cloudflare (R-CF-01/R-CF-11).

**Depends on.** R-CF-01 (packs, `cf:env -- dev`, `env.example.test.ts`), R-CF-02 (entry, `Internal` + `SELF`, `applyEnv`, DO export), R-CF-12 (`lib/runtime/platform.ts`, `selfFetch`). Option B only: R-CF-03 (air-sidecar).
