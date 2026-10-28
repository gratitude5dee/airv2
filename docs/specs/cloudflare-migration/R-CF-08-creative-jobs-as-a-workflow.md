# R-CF-08 — Creative jobs as a Workflow

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-08: …`.

**Why.** Every render today is a single in-process call that submits, polls and downloads. Most of these calls run inside `after()`:
- `apps/web/app/api/chat/route.ts:137-154` (/twin) and `:202-208` (/imagine, /animate, /zap).
- `lib/miniapps/apps/freeze.tsx:321,458`.
- `lib/miniapps/apps/onboarding.tsx:3934` (`enableVideoAvatar`, `lib/identity/twin.ts:587`).

The iMessage lanes await the render inside the flush turn: `lib/orchestrator/flush.ts:1335` → `lib/creative/imessage.ts:82-214`, and /twin through `flush.ts:1291` → `lib/identity/twinCommand.ts:198`. The budget is 420 s plus a resume (`lib/creative/gmi.ts:24`, `lib/creative/run.ts:216-226`), which is why `route.ts:44` sets `maxDuration = 800`. `waitUntil`/`after()` is cut off 30 s after the response on both plans.

Other problems on Workers:
- fal polls every 1 s (`lib/creative/fal.ts:61,635-662`) and GMI every 2 s (`gmi.ts:18,618-690`).
- The concurrency cap is a module-level semaphore (`gmi.ts:63-125`). Separate isolates do not share it.
- Ingest buffers up to 100 MB and then calls `Buffer.concat` on it (`lib/creative/media-url.ts:48,186-231`), inside a 128 MB isolate.
- Workflow steps retry 5× by default, and the engine can restart a step even when it has `retries: 0` ([Rules of Workflows](https://developers.cloudflare.com/workflows/build/rules-of-workflows/)). Without a durable fence before the POST, a paid render can be submitted twice. That breaks the repo's product rule C23, "never automatically resubmit" (`run.ts:231-234`, `onboarding.md:608`). In this section, "product rule C4" and "product rule C23" mean the repo's goal-doc rules (`docs/goal-air2.md:21`, `onboarding.md:608`), not §2.5 C4 and C23.

**Deltas.**

*Config and entry*
- `apps/web/wrangler.jsonc`: add the Workflow binding. This item owns the name and the retention (§2.5 C9). Instance IDs follow the rule `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$`, at most 100 chars.
  ```jsonc
  "workflows": [{ "name": "creative-job", "binding": "CREATIVE_JOB", "class_name": "CreativeJob",
                  "default_retention": { "success_retention": "1 hour", "error_retention": "1 day" } }]
  ```
  - In the same PR, regenerate `apps/web/worker/worker-configuration.d.ts` with `npm run cf:types`. Never hand-edit it (§2.5 C4). Where the generated `Workflow` type is too loose for the sealed params, cast at the use site.
  - `wrangler deploy` creates the Workflow itself, so R-CF-13's `ensure-resources` job needs no step for this binding (§2.5 C18).

  Do **not** add `CREATIVE_WEBHOOK_ORIGIN` to `vars`. `## plain` values ship packed through R-CF-01 (`apps/web/env.example.md`, "Rules"), so the md file stays the only source.
- `apps/web/lib/env.ts` and `apps/web/env.example.md`: add four names to the manifest. None of them is in the committed template yet. Edit `env.example.md` by hand and add the names under the `# --- added by docs/specs/cloudflare-migration.md ---` blocks, tagged `R-CF-08`. No generator exists, and `apps/web/lib/env.example.test.ts` (R-CF-01) checks format and completeness (§2.5 C20).
  - `CREATIVE_SEAL_KEY` (`## secret`): 64 hex chars, the AES-256-GCM key for `lib/crypto/secretbox.ts`.
  - `CREATIVE_WEBHOOK_SECRET` (`## secret`): the HMAC key for the webhook `sig`.
  - `CREATIVE_WEBHOOK_ORIGIN` (`## plain`): default `https://app.wzrd.tech`. Until R-CF-14's cutover sets it back to the app host, the owner sets it to airv2-app's workers.dev origin in `.env.airv2.md` and pushes it. `cf:env push` is owner-only (§2.5 C22).
  - `FAL_WEBHOOK_USER_ID` (`## plain`, optional): pins `X-Fal-Webhook-User-Id`.
  - When the runtime is CF, `validateEnv` requires the two secrets.
- `apps/web/worker/entry.ts` and `apps/web/worker/handler.ts` (R-CF-02):
  - Add `export { CreativeJob } from "./creativeJob"` to `entry.ts`.
  - `POST /api/creative/fal-webhook` is the only public path that Cloudflare serves whatever the hosting target is (§2.5 C1). R-CF-02's `createFetchHandler` lists it explicitly, **after `/_switch` and `/api/version` and before the hosting-target branch**. Fill that hook with `handleFalWebhook(request, env)`, lazily imported from `lib/creative/falWebhook.ts`.
    - The Workflow always lives on CF, so the webhook must never be forwarded to Vercel.
    - The route also bypasses OpenNext.
    - By the time the hook runs, the public `fetch` has already called `applyEnv(env)` and stripped inbound `x-air-*` headers.
- `apps/web/worker/creativeJob.ts` NEW: `class CreativeJob extends WorkflowEntrypoint<CloudflareEnv, SealedParams>`. `run()` does two things, in this order:
  1. Its first statement is `applyEnv(this.env)` from `apps/web/worker/env-unpack.ts` (§2.5 C3). A Workflow invocation never passes through `fetch`, and `lib/env.ts` reads `process.env`. Without this call every packed secret (Supabase, fal, GMI) reads as unset, and a secret rotated while the isolate is reused stays stale.
     - `applyEnv` also calls `setCfEnv(this.env)` from `apps/web/lib/runtime/platform.ts` (R-CF-12, §2.5 C2), so `cfEnv()` works in every step.
     - `getCloudflareContext()` throws outside OpenNext's `runWithCloudflareRequestContext` (`@opennextjs/cloudflare@1.20.10 dist/cli/templates/init.js:21-24`), so creative code never calls it directly.
     - `cfEnv()` reads env from `globalThis[Symbol.for("air.cfEnv")]` first, because lib code is bundled twice: once in the Next chunks and once in the wrangler entry bundle.
  2. `await import("../lib/creative/workflow/run")`. This keeps entry startup small, and a crash at module scope in the creative graph cannot break every route. R-CF-09 removes the static `heic-convert` import first.

*Migration*
- `supabase/migrations/NNNN_creative_workflow.sql` NEW (§2.5 C23). The highest existing migration is `0140_wzrd_connect.sql`. Take the next free number at merge time.
  - Widen the status check with the same drop/add pattern as `0046_wallet_submit_unknown.sql:5-9`. `creative_jobs_status_check` is the default name of the inline check at `0021_creative_lane.sql:11-13`. Confirm it with `\d creative_jobs`.
    ```sql
    alter table creative_jobs drop constraint creative_jobs_status_check;
    alter table creative_jobs add constraint creative_jobs_status_check check (status in
      ('routing','submitting','submitted','polling','delivered','failed','refused','submit_unknown'));
    ```
  - Add these columns to `creative_jobs`:
    - `runner text check (runner in ('inline','workflow'))`. Null means the job has not started.
    - `provider text check (provider in ('fal','gmi'))`.
    - `provider_model text`. This is a model id, not a URL, so product rule C4 allows it. Reconcile needs it after the 1 h instance retention.
    - `continuation text`. This holds the sealed delivery target only, never a prompt or URL.
    - `tts_started_at timestamptz`. This is the `tts` fence (see the lanes below). Null means synthesis has not started.
  - Add the partial index `creative_jobs_inflight_idx on creative_jobs (created_at) where status in ('routing','submitting','submitted','polling')`.
  - Add the table `creative_permits (job_id uuid primary key references creative_jobs(id) on delete cascade, expires_at timestamptz not null)` with RLS enabled. Otherwise `supabase/tests/rls_all_tables.sql` fails CI.
  - Add the functions `claim_creative_permit(p_job uuid, p_cap int, p_lease_s int) returns boolean` and `release_creative_permit(p_job uuid)`:
    - Write them in plpgsql with `security definer set search_path = public`, and take `pg_advisory_xact_lock`.
    - Claim deletes expired leases, renews an existing lease, and refuses when the cap is reached.
    - Grant as in `0106_compute_migrations.sql:224-225`: `revoke all … from public; grant execute … to service_role`.
- `supabase/tests/creative_permits.sql` NEW: test cap enforcement, renewal on re-claim, and reclaim after expiry.

*Core split (both runners share one code path)*
- `apps/web/lib/creative/run.ts`: split `executeCreativeJob` (`:118-266`) into three functions:
  - `prepareCreativeJob`: cap, prefs and plan (`:133-174`).
  - `classifyGenerationError`: `:212-238`.
  - `commitGeneratedMedia(…, { defer })`: `:240-265`. The clip-backed freeze render uses `defer` on both runners (see *Freeze render wiring*).

  `executeCreativeJob` stays as the inline (Vercel) composition and behaves exactly as before.
- `apps/web/lib/creative/start.ts` NEW: `startCreativeJob(deps, job, lane, params, continuations)`. It is a separate module because its Node branch imports `after` from `next/server`. Nothing under `lib/creative/workflow/*` may import it or any `next/*` module, because wrangler builds the entry bundle outside Next.
  - CAS `runner` from null to `'workflow'` when `cfEnv()?.CREATIVE_JOB` exists (`cfEnv` from `lib/runtime/platform.ts`, §2.5 C2), and to `'inline'` otherwise. Losing the CAS means the job already started, so return.
  - CF: call `assertWorkflowInstanceId(job.id)`, then `CREATIVE_JOB.create({ id: job.id, params: seal({ lane, ...params }), retention: { successRetention: "1 hour", errorRetention: "1 day" } })`.
  - A `create()` that throws "already exists" counts as started. Any other throw (a 429 on creation rate, or a transient error) sets `failed` + `FAILED_LINE` at once, because nothing was submitted. Then rethrow, so the caller returns today's `"run failed"` (`route.ts:159,213`) instead of leaving the row stranded for 30 min until the reaper.
  - The runner CAS and the submit fence also stop a re-run after retention ([create](https://developers.cloudflare.com/workflows/build/workers-api/#create)).
  - Node: `after(() => runCreativeJobInline(…))`, which is today's behaviour. This is the only `after()` this item adds. On CF `CREATIVE_JOB` is always bound, so this branch never runs there.
- `apps/web/lib/creative/workflow/run.ts` NEW: the step plan (see the table below).
  - A top-level try/finally always runs the `permit-release` and `cleanup` steps.
  - Then, only when the continuation list includes these kinds, the finally runs `continue:twin-avatar` (if it has not run yet in this instance) and `freeze:release`, which runs last on every path.
  - An uncaught error before `submit` sets `failed` + `FAILED_LINE`.
  - An uncaught error after `submit` sets `submit_unknown` + `SUBMIT_UNKNOWN_LINE`.
  - Cancellation is cooperative. Never call `terminate()`, because it skips cleanup and the permit release.
    - **Before `submit`**, every step re-reads `creative_jobs.status` and ends the run with no POST if the status is terminal.
    - **After `submit`**, a terminal status (an owner cancel) does not stop polling or ingest. The render is already paid for, and "a late delivery stays recorded on the job" (`lib/miniapps/freeze.ts:1327-1328`, `lib/miniapps/draw.ts:651-652`). `claimDelivered` then loses, and the continuations receive `claimed: false`.
- `apps/web/lib/creative/workflow/seal.ts` NEW: `seal<T>()`/`open<T>()` over `lib/crypto/secretbox.ts:17,25`, keyed with `CREATIVE_SEAL_KEY`.
  - Seal every params object, and every step output that can hold a prompt, a signed input URL or a provider media URL. Hex sealing doubles the size, so keep each output well under the 1 MiB non-stream step-result limit ([limits](https://developers.cloudflare.com/workflows/reference/limits/)).
  - Also pass `sensitive: "output"` on those steps. That field appears only in the step config of [instance events](https://developers.cloudflare.com/workflows/build/subscribe-to-instance-events/), not in the documented `WorkflowStepConfig` type, so cast if the types reject it (verify).
  - Never return the personal GMI key from a step. Re-read `getProviderKey(supabase, userId, "gmi")` inside `submit` and inside each poll round.
- `apps/web/lib/creative/workflow/ids.ts` NEW: `assertWorkflowInstanceId(id)` checks `/^[a-zA-Z0-9_][a-zA-Z0-9-_]{0,99}$/` (§2.5 C9). IDs are only ever `job.id` (a uuid) or `${job.id}-late`, never anything derived from user text.
- `apps/web/lib/creative/jobs.ts`:
  - Add `'submitting'` to `CreativeJobStatus` (`:27-34`) and to the counted statuses in `underDailyLimit` (`:210`).
  - Add `fenceSubmit(jobId)`: a CAS from `routing` to `submitting` that returns the row.
  - Add `fenceTts(jobId)`: a CAS on `tts_started_at` from null to `now()` that returns whether it won.
  - Add `claimDelivered(jobId, assetId, { defer })`. It runs `update … set status='delivered', delivered_at, output_asset_id where id=$1 and status in ('submitted','polling')` and returns whether a row changed. With `defer`, it writes `output_asset_id` and keeps `polling`. The clip-backed freeze render uses this (see *Freeze render wiring*).
  - Make `insertRenderCostEvent` (`:218-239`) an upsert with `onConflict: "user_id,kind,ref", ignoreDuplicates: true`. The unique key already exists (`0015_calendar_sources.sql:89`), so a retried write is a no-op instead of a logged error. The skeptic note that `cost_events` has no unique constraint is wrong.
- Add `'submitting'` to the other status lists: `lib/miniapps/draw.ts:65`, `lib/miniapps/freeze.ts:63` (this list also gates the stale-slot path at `:586`), and `lib/miniapps/client/draw-studio.tsx:259`.
- `apps/web/lib/creative/permit.ts` NEW: `acquireCreativePermit`, `renewCreativePermit` and `releaseCreativePermit` call the RPCs.
  - The lease is 1,200 s, renewed in each poll round and in each `fal-result*` step.
  - For `runner='workflow'` this replaces `withCreativeSlot` (`gmi.ts:107-125`). The Workflow lane never *calls* `withCreativeSlot` or `withGmiSlot`, so the module counters at `gmi.ts:63-64` stay idle there. The inline (Vercel) path keeps the semaphore.
- `apps/web/lib/creative/fal.ts`:
  - `submitZapRequest` (`:416-454`) gains an optional `webhookUrl`, appended as `?fal_webhook=<encodeURIComponent(url)>` to the URL at `:431`. Only `runner='workflow'` passes it, because a webhook for a Vercel job would race the inline poller.
  - Export `falSubmitOnce`, `falStatusOnce` and `falResultOnce`. `falResultOnce` reuses `resultOrThrow` (`:505-537`), so the split between a definitive 4xx and an unknown outcome (`TRANSIENT_RESULT_STATUSES`, `:497`) does not change.
  - Keep the poll loop (`:635-662`) for the inline path only. `withWavAudio` (`:370-409`) runs in `prepare`.
- `apps/web/lib/creative/gmi.ts`: split `generateCompiledRequest` (`:417-499`) into:
  - `gmiSubmitOnce`: `:440-487`. It returns `{requestId}` or `{media}`, or throws as today.
  - `gmiPollRound(requestId, kind, untilMs, apiKey)`: the body of `poll` (`:618-690`), limited to one round.

  `poll`/`resumeGeneration` (`:709-719`) stay for the inline path, and `buildHeygenAvatarRequest` (`:392-415`) does not change.
- `apps/web/lib/creative/falWebhook.ts` NEW: the handler. Checks run cheapest first, and any failed check returns 401.
  - The handler runs ahead of R-CF-02's `envError()` 503. So an unset `CREATIVE_WEBHOOK_SECRET` (broken packs) returns 503, and fal retries. The handler never verifies against an empty key.
  1. `job` matches the instance-ID rule, and `sig` equals `hex(HMAC-SHA256(CREATIVE_WEBHOOK_SECRET, job))`, compared with `node:crypto` `timingSafeEqual`.
  2. The headers `X-Fal-Webhook-Request-Id`, `-User-Id`, `-Timestamp` and `-Signature` (hex) are all present, and |now − timestamp| ≤ 300 s (verify fal's tolerance).
  3. Build the message `${requestId}\n${userId}\n${timestamp}\n${sha256hex(rawBody)}` and verify it with Ed25519 against any key in `https://rest.alpha.fal.ai/.well-known/jwks.json` (verify the URL).
     - Use `node:crypto` `verify(null, …)` over `createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x }, format: "jwk" })`.
     - Cache the JWKS in the Cache API for 24 h.
     - fal's SDK has no verifier, so this is written by hand.
  4. Parse only `{request_id, status}`. Never keep `payload`, which carries provider media URLs. The result is re-read by request id.
  5. Call `(await env.CREATIVE_JOB.get(job)).sendEvent({ type: "fal-done", payload: { requestId, status } })`.
     - The docs do not say whether an event that arrives before the instance reaches `waitForEvent` is kept (verify). They only say that `sendEvent` throws when the instance is not running or has errored ([sendEvent](https://developers.cloudflare.com/workflows/build/workers-api/#sendevent)).
     - If an early event is dropped, `fal-result` still reconciles by request id after the `fal-wait` timeout.
  6. **Late path.** It applies when all of these hold:
     - `get()` throws (not found, or past retention), or `status()` reports complete, errored or terminated;
     - the row has `runner='workflow'` and `provider_request_id = requestId`;
     - the row's status is in {`submit_unknown`, `submitted`, `polling`}.

     It calls `env.CREATIVE_JOB.create({ id: \`${job}-late\`, params: seal({ lane: "late", jobId: job, requestId }), retention: { successRetention: "1 hour", errorRetention: "1 day" } })` and then returns 200. A create that throws "already exists" deduplicates fal retries.
  7. If `sendEvent` throws while `status()` still reports running, waiting or queued, the failure is transient: return 503 so fal retries (verify fal's delivery timeout and retry schedule). Every other verified case (delivered, cancelled, request-id mismatch) returns 200, so fal stops.
- `apps/web/lib/creative/continuations.ts` NEW: a typed union of continuations that the `continue:<kind>` steps run in order. Each runner:
  - is idempotent, keyed or CAS'd on the job id;
  - takes `{ late: boolean, claimed: boolean, result }`;
  - never re-takes a slot when `late` is set.

  The kinds:
  - `imessage {spaceId, phone, mode, deliveryLine?}`.
    - It turns `deliverCreativeResult` (`imessage.ts:232-287`) into a list of delivery parts and sends them through R-CF-04's `conversation(spaceId).deliver(parts, { key: imessageKey("creative", jobId) })` (§2.5 C8), so the bubbles stay ordered with the turn.
    - Each part carries `clientMessageId = imessageKey("creative", jobId, "attachment" | "rich" | "url" | "caption")`. Those are R-CF-03's key parts, built only with `imessageKey` (§2.5 C15).
    - Parts carry ids, lines and the delivery link, never bytes or provider media URLs.
    - On Vercel, `conversation()` returns `undefined`, so the runner sends directly through the R-CF-03 sender with the same keys. Keys are identical on both runners, so a rollback never double-sends.
    - A result that was not delivered sends its `line` (`:240-242`).
    - Choose between attachment and rich link from `asset.bytes` *before* downloading: above 50 MiB (R-CF-09), go straight to the rich link (`:262-273`).
    - `deliveryLine` carries the /twin override (`twinCommand.ts:213-216`).
  - `draw {sessionId}`: the event append and the CAS slot clear, moved verbatim from `draw.ts:488-507`. When `claimed` is false because a cancel won, append nothing. The CAS clear stays a no-op.
  - `freeze {sessionId, kind, pinnedSourceId, sourceAtAdmit, clipBacked}`. It runs `finishFreezeRun` (`freeze.ts:686-707`), then a kind-specific step:
    - `kind: "sketch"`: the source-still CAS (`freeze.ts:827-855`, predicated on `active_job_id = jobId` and `sourceAtAdmit`).
    - `kind: "render"`: the `freeze:*` steps in *Freeze render wiring* below. They run R-CF-09's `lib/miniapps/freezeStitch.ts` functions.

    Either way, `releaseFreezeSlot` (`:602-612`) runs last on every path (see `:863`, `:985`) as the `freeze:release` step. When `claimed` is false, skip the stitch.
  - `twin-avatar {}`: writes `avatar_status` (`ready` or `failed`), `avatar_error` and `avatar_preview_asset_id` as `twin.ts:659-663` does. It is a plain overwrite, so a retry is a no-op. `run()`'s finally also runs it when the run ends before `continue:*`, so the twin row never stays `pending`.
  - `none`: synchronous callers do their own post-processing after `awaitCreativeJob`.

  The `continuation` column stores the sealed list, so the late instance can deliver.
- `apps/web/lib/creative/await.ts` NEW: `awaitCreativeJob(jobId, budgetMs = 900_000)` reads `creative_jobs` every 2 s and returns the `CreativeRunResult` view. It loads `asset` through `output_asset_id` and takes `deliveryUrl` from `signedDeliveryForJob` (`store.ts:204-228`).
- `apps/web/lib/creative/store.ts`: `stageCreativeInput` (`:241-285`) gains an optional `{ key }`.
  - `prepare` passes the deterministic key `<userId>/staging/<jobId>-in-<n>.<ext>` and uploads with `upsert: true`. A retried `prepare` then overwrites its earlier uploads instead of leaking random `deliveries/` keys (`:261`).
  - On CF, `prepare` stages attachments one at a time. `imessage.ts:119` runs them concurrently, and each buffer can be up to 50 MiB (R-CF-09).
- `apps/web/lib/creative/reaper.ts` NEW.
  - This item adds the call to `app/api/cron/sweep/route.ts`. On CF the sweep runs from R-CF-11's Cron Triggers (`scheduled()` → `SELF`, §2.5 C1), whenever `cron_host` hands crons to Cloudflare (§2.5 C13).
  - It does nothing when `cfEnv()?.CREATIVE_JOB` is missing (a Vercel sweep). It cannot see instance status there, and must never misread a live instance as missing.
  - It handles at most 50 rows per run.
  - It selects in-flight `runner='workflow'` rows older than 30 min and checks `instance.status()`. A `get()` throw counts as missing.
  - For missing or terminal instances:
    - `routing` → `failed` + `FAILED_LINE`;
    - `submitting`/`submitted`/`polling` → `submit_unknown` + `SUBMIT_UNKNOWN_LINE`.
  - It releases the permit and removes the `<userId>/staging/<jobId>*` objects: list `<userId>/staging` with `search: jobId`.
  - It never resubmits (product rule C23).

*Step plan* (`lib/creative/workflow/run.ts`). Every `step.do` passes an explicit `WorkflowStepConfig` (§2.5 C9), kept in a `STEP_TABLE` like `infra/workers/create/src/workflow.ts:42-50`. Step names are deterministic.

| Step | Config | Does | Output (sealed) |
|---|---|---|---|
| `prepare` | `retries {limit:3, delay:"5 seconds", backoff:"exponential"}`, `timeout "3 minutes"` | Cancel check; daily cap; prefs (`run.ts:163-174`, key presence only); plan (`zapPlanFor` `:95-111` / `directCreativePlan`); fal WAV transcode. iMessage only: build the sender with R-CF-03's `createSpectrumSender()`, because no `sender` object is passed into a Workflow. On workerd `selectTransport()` returns `relay`, so the sender is `createTransportSender(createRelayTransport(), …)` with the default `PostgresSendLedger`, and the relay resolves `SIDECAR` through `cfEnv()` (§2.5 C2). Then `getAttachment`, staging (`imessage.ts:115-141`, deterministic keys), ref resolution and `recordReferenceUses` (`:144-180`). | `{plan, turn, provider, model, keyMode, stagedKeys}` |
| `permit:<n>`, n ≤ 28 | `retries {limit:3, delay:"2 seconds"}`, `timeout "15 seconds"`; `step.sleep("permit-wait:<n>", "15 seconds")` between attempts | `claim_creative_permit(job, env.creativeMaxConcurrency(), 1200)` | `{granted}`. 28 misses = 420 s, the same wait as `fal.ts:576-588`; then `failed` + `BUSY_LINE`. |
| `submit` | `retries {limit:0, delay:0}`, `timeout "60 seconds"` | **Cap re-check:** run `underDailyLimit` again, because jobs that sat in `routing` during the permit wait were not counted. Over the cap → `failed` + `DAILY_LIMIT_LINE`. **Fence:** re-read the row. `routing` → `fenceSubmit`. `submitting` with a null `provider_request_id` → `submit_unknown`, **no POST** (the engine restarted mid-POST). `submitted`/`polling` with an id → return it. `submitted`/`polling` with a null id (a GMI synchronous success lost to a restart) → `submit_unknown`. Anything else → stop. Then exactly one POST, with errors mapped as in `run.ts:212-238`. Success writes `status='submitted', provider_request_id, provider, provider_model`. | `{requestId}` or `{media}` (GMI synchronous success) |
| fal `fal-wait` | `step.waitForEvent("fal-wait", {type:"fal-done", timeout:"7 minutes"})` | Wakes on the webhook. The type uses only `[A-Za-z0-9_-]`. | `{requestId, status}` |
| fal `fal-result` | `retries {limit:5, delay:"5 seconds", backoff:"exponential"}`, `timeout "60 seconds"` | `falStatusOnce`, then `falResultOnce`. Still IN_QUEUE/IN_PROGRESS → one `fal-wait-2` (5 min) + `fal-result-2` (same config), then `FalEnqueuedError` → `submit_unknown`. ERROR status → reconcile only through `resultOrThrow`. | `{media}` |
| gmi `gmi-poll:<n>`, n ≤ 7 | `retries {limit:3, delay:"5 seconds"}`, `timeout "3 minutes"` | Up to 120 s of 2 s polling; renew the permit; re-read the personal key | `{state, media?}`. After 840 s (420 s + a 420 s resume) → `failed` + `FAILED_LINE`, matching `run.ts:224-226`. |
| `permit-release` | `retries {limit:3, delay:"2 seconds"}`, `timeout "15 seconds"` | `release_creative_permit`. As with `withCreativeSlot` today, the permit covers submit through result. | — |
| `ingest-upload` / `ingest-commit` | `retries {limit:3, delay:"10 seconds", backoff:"exponential"}`; timeouts `5 min` / `60 s` | Streamed ingest (R-CF-09): upload and hash in one pass, then commit. Commit order: asset row (`unique(user_id, sha256)`, `0011_creative_assets.sql:19`) → delivery (look up an existing unrevoked `purpose = creative:<jobId>` before `mintDelivery`, `pipeline.ts:217`) → `claimDelivered` (with `{defer: true}` for a clip-backed freeze render) → cost upsert. Cost is booked whenever an asset was produced and `keyMode` is platform (`run.ts:251-253`), even if the claim lost to a cancel. A lost claim leaves `output_asset_id` set and the status `failed`; the job never flips to `delivered`. | `{assetId, claimed}` |
| `continue:<kind>` | `retries {limit:3, delay:"10 seconds"}`, `timeout "2 minutes"`; the `freeze:*` steps use their own configs (*Freeze render wiring*) | The continuations above | — |
| `cleanup` | `retries {limit:3, delay:"5 seconds"}`, `timeout "30 seconds"` | `removeStagedInputs` (`store.ts:318-328`), then release the permit again (idempotent) | — |

Each lane reuses the same primitives:
- `executor`: everything that calls `executeCreativeJob` today, including `createTwinImage` (`twin.ts:529`, render at `:564`).
- `twin-speech`: `createTwinSpeechVideo` (`twin.ts:474`) → `renderLipsync` (`twin.ts:405-467`). It adds two steps before the fal submit/wait/result/ingest steps:
  - `tts` (`retries {limit:0, delay:0}`, `timeout "2 minutes"`). Synthesis is billed, so the step has a durable fence (§2.5 C9):
    - **Fence:** `fenceTts(jobId)` sets `tts_started_at` before the ElevenLabs call.
    - `synthesizeTwinSpeech` (`lib/identity/voiceClone.ts:214`) gains an optional `{ stagingKey }`. With it, the clip is uploaded to `<userId>/staging/<jobId>-tts.<ext>` (`upsert: true`) and adopted with `adoptStagedObject` (R-CF-09) instead of `ingestGeneratedAudio`.
    - On re-entry with the fence already set (the engine restarted the step), adopt the staged clip if it exists. Otherwise set `submit_unknown` + `SUBMIT_UNKNOWN_LINE` and make no second synthesis call.
    - Any other failure sets `failed`.
    - Output: `{speechAssetId}`.
  - `transcode` (`retries {limit:3, delay:"5 seconds", backoff:"exponential"}`, `timeout "3 minutes"`): `wavAudioUrl`, `lib/identity/lipsync.ts:66-68`. Its output is a fal storage URL, so it is sealed.
- `twin-video`: `createTwinVideo` (`twin.ts:194-285`), on the GMI poll steps.
- `late`: `fal-result`, then ingest, then the continuations from `creative_jobs.continuation`, with the claim widened to include `submit_unknown`.

*Freeze render wiring.* R-CF-09 ships the pure step functions in `apps/web/lib/miniapps/freezeStitch.ts`, `stitchFreezeClip`, and the inline (Vercel) ordering. This item runs those functions in the Workflow:
1. At admission, `executeFreezeRender` records `clipBacked = session.clip_asset_id != null` in the sealed `freeze` continuation.
2. For a clip-backed render, `ingest-commit` calls `claimDelivered(…, {defer: true})`. That writes `output_asset_id = raw` and keeps `polling`, with these effects:
   - the job keeps the slot (`ACTIVE_JOB_STATUSES`, `freeze.ts:63-68`);
   - the studio keeps waiting on `activeJob` (`freezeStatus`, `:1369`);
   - the save lane (`freeze.tsx:483-492`, which requires `delivered`) cannot ship the raw move.
3. `continue:freeze` then runs these steps, with the configs from this item's `STEP_TABLE`:

| Step | Config | Does | Output (sealed) |
|---|---|---|---|
| `freeze:plan` | `retries {limit:3, delay:"5 seconds"}`, `timeout "60 seconds"` | R-CF-09's plan: re-read `freeze_sessions` (as `freeze.ts:1117-1146` does) and the job status. A swapped source or a missing clip → degrade. A terminal (cancelled) job → skip to release. | `{plan}` |
| `freeze:stitch` | `retries {limit:4, delay:"30 seconds", backoff:"exponential"}`, `timeout "8 minutes"` | Mint the clip and camera signed GETs and the staging upload URL **inside the step**. Never mint them earlier, because outputs replay on resume. Then call `stitchFreezeClip` (R-CF-09). A 429 from a busy pool throws for a retry, about 7.5 min in total, before the degrade path. | `{ok, sha256, bytes, …}` or `{skipped}` |
| `freeze:commit` | `retries {limit:3, delay:"10 seconds"}`, `timeout "60 seconds"` | `adoptStagedObject`, then the `polling` → `delivered` CAS with the stitched asset, or with the raw asset on the degrade path. Append one `completed` event. Zero rows (a cancel) changes nothing. | — |
| `freeze:release` | `retries {limit:3, delay:"5 seconds"}`, `timeout "15 seconds"` | `releaseFreezeSlot` (`freeze.ts:602-612`, a CAS on job id), from the try/finally in `run()`. It runs last on every path. | — |

*Entry points*
- `app/api/chat/route.ts:202-208`: replace `after()` with `startCreativeJob(…, "executor", …, [{ kind: "none" }])`. Keep returning `creative_job_id`. Keep `maxDuration = 800` (`:44`) for the inline Vercel rollback.
- `app/api/chat/route.ts:137-154` and `lib/identity/twinCommand.ts:97-127`:
  - `runTwinCommand` keeps the reference check inline and returns `{ lane: "twin-speech" | "executor", jobId, params }`.
  - The preconditions inside `createTwinSpeechVideo`/`createTwinImage` move to `prepare`.
  - `ensureJob` (`twin.ts:342`) still creates the row first.
- `lib/creative/imessage.ts:82-214`: the lane parses the command and still replies to ambiguous commands inline (`:109-113`).
  - Otherwise it calls `createCreativeJob`, then `startCreativeJob` with params `{attachmentIds, text, command}` and the `imessage` continuation, and returns `true`.
  - It never awaits a render inside the ConversationDO turn.
  - Staging, ref resolution and `recordReferenceUses` (`:177-180`) move to `prepare`. A ref problem becomes `refused` + its line, which the `imessage` continuation sends.
- `lib/identity/twinCommand.ts:198-221` (the iMessage /twin lane, entered from `flush.ts:1291`): use the same start as the chat route, plus the `imessage` continuation with the `deliveryLine` from `:213-216`. Never await the render in the turn.
- `lib/miniapps/drawCommand.ts:164` and `lib/miniapps/freezeCommand.ts:138`: use the `draw`/`freeze` continuation plus `imessage`, carrying the same sends as today.
- `lib/miniapps/apps/freeze.tsx:321,458` (`executeFreezeSketch` / `executeFreezeRender`): start with the `freeze` continuation (`kind` sketch or render).
- `lib/miniapps/apps/onboarding.tsx:3926-3937` (`enableVideoAvatar`, `twin.ts:587-664`):
  - The refusals (`:593-615`) stay inline, so the response is unchanged.
  - Write the `pending` patch (`:636-646`), then call `startCreativeJob(…, "twin-speech", …, [{ kind: "twin-avatar" }])` in place of `after(run)`.
  - `tts` runs only when the clone is ready (`:619-623`). Otherwise `prepare` passes the newest voice sample (`:625-632`) as the speech asset.
  - `recordReferenceUses` (`:647-650`) runs in `prepare`, or after `tts` once the speech asset is known.
- Synchronous HTTP callers keep their response shape by calling `startCreativeJob(…, none)`, then `awaitCreativeJob`, then their existing post-processing:
  - `lib/miniapps/apps/draw.tsx:212,232` (the draw slot and event go through the `draw` continuation)
  - `lib/miniapps/apps/image.tsx:470`
  - `lib/create/icon.ts:311` (route `app/api/create/icon/route.ts:117`)
  - `lib/identity/generate.ts:132` (`settings.tsx:1014`, `onboarding.tsx:3848`)
  - `createTwinVideo` callers on the `twin-video` lane: `lib/miniapps/apps/settings.tsx:1103` and `lib/miniapps/apps/onboarding.tsx:4023`.
- `cancelActiveFreezeJob` (`freeze.ts:1329-1348`) and `cancelActiveDrawJob` (`draw.ts:653`): also call `releaseCreativePermit(jobId)`.
- `apps/web/lib/runtime/after-inventory.test.ts` (R-CF-06):
  - Drop the R-CF-08 rows from the allowlist. These are R-CF-06 inventory rows 16, 17 and 25-27: `app/api/chat/route.ts` −2, `lib/miniapps/apps/onboarding.tsx` −1 and `lib/miniapps/apps/freeze.tsx` −2.
  - Add `lib/creative/start.ts → 1` for the Node-only branch.

**Acceptance.**
- [ ] On airv2-app, `/imagine` and `/zap` return `creative_job_id` in under 1 s, and the instance id equals the job id. `creative_jobs` moves routing → submitting → submitted → (polling) → delivered, and the SSE route (`app/api/creative/[jobId]/events/route.ts`) emits `creative.done`.
- [ ] Restarts:
  - A restart injected mid-POST (the step throws after `fetch` resolves and the engine re-runs `submit`) produces exactly one provider POST and `submit_unknown`.
  - A restart injected in `tts` after the ElevenLabs call produces exactly one synthesis call.
- [ ] Webhook outcomes:
  - A fal webhook with a valid signature wakes the instance.
  - A bad signature, a skewed timestamp or a bad HMAC returns 401.
  - An unset `CREATIVE_WEBHOOK_SECRET` returns 503.
  - A webhook for a delivered job returns 200 and changes nothing.
  - A webhook for a `submit_unknown` job with `runner='workflow'` ingests and delivers once, including the iMessage bubbles once.
  - With HOSTING `target=vercel`, a webhook that reaches airv2-app (workers.dev, or any host after P4) is still served by Cloudflare and never proxied.
- [ ] `wrangler workflows instances describe creative-job <id>` shows no prompt, signed URL, provider media URL or API key. Params and outputs are `v1:` sealed strings.
- [ ] With `CREATIVE_MAX_CONCURRENCY=2`:
  - a third concurrent job waits in `permit-wait:*` and proceeds after a release;
  - a killed instance's lease expires within 20 min;
  - `submitting` jobs count toward the daily cap, and a burst of N parallel `/imagine` calls at cap − 1 submits at most one render.
- [ ] Cancel behaviour:
  - A cancel before `submit` makes no provider POST.
  - A cancel after `submit` still ingests: the asset is recorded in `output_asset_id`, the status stays `failed`, and no draw event or freeze stitch follows.
- [ ] A `CREATIVE_JOB.create()` failure other than "already exists" leaves the row `failed`, not `routing`.
- [ ] Under forced retries of every ingest/continue step, each delivered job has exactly one `creative_assets` row per digest, one `asset_deliveries` row per purpose, and one `cost_events` row with `ref = creative:<jobId>`. A forced retry of `prepare` leaves no extra staging objects.
- [ ] iMessage behaviour:
  - `/imagine` with a HEIC attachment returns from the turn at once and delivers the attachment and caption once.
  - `/twin say …` returns from the turn at once and delivers once.
  - A 60 MB video result is sent as a rich link.
  - Delivery bubbles go through `ConversationDO.deliver` and never interleave with an in-flight turn's bubbles.
- [ ] A clip-backed freeze render on CF ends `delivered` with a stitched MP4 output:
  - it stays `polling` and holds the slot until `freeze:commit`;
  - save is refused during the stitch;
  - cancelling mid-stitch leaves `failed` with no output swap;
  - a source swap mid-render degrades to the raw move;
  - a busy pool (both instances returning 429) waits and then stitches, or degrades after about 7.5 min;
  - `freeze:release` runs last on every path;
  - the stitched output matches R-CF-09's Vercel-path golden fixtures: same stream layout, and duration within one frame.
- [ ] Enabling the video avatar on CF returns at once. The twin row ends `ready` with `avatar_preview_asset_id` set, or `failed`, and never stays `pending`.
- [ ] The reaper turns an orphaned `polling` job (instance deleted) into `submit_unknown`, removes its staging objects and never resubmits. A sweep without a `CREATIVE_JOB` binding changes no rows.
- [ ] `after-inventory.test.ts` passes with the R-CF-08 rows removed.
- [ ] On Vercel (`runner='inline'`), all existing creative tests pass unchanged.

**Tests.**
- `lib/creative/workflow/run.test.ts` NEW. A fake `WorkflowStep` records step names and configs, memoizes outputs, and can re-run a step to simulate an engine restart. Inject fake fal, GMI and Supabase clients the way `FalGenerationOptions` (`fal.ts:93-102`) already does. Cases:
  - the fence, including the null-id `submitted` case;
  - the `tts` fence: a re-run after an engine restart makes exactly one synthesis call and either reuses the staged clip or ends `submit_unknown`;
  - the cap re-check in `submit`;
  - permit exhaustion → BUSY;
  - the fal timeout → re-wait → `submit_unknown` path;
  - GMI at 840 s → failed;
  - cancel before submit (no POST) and cancel after submit (ingest, claim lost, continuations skipped);
  - a `prepare` retry re-stages to the same keys;
  - every step that can carry sensitive data returns sealed output;
  - every `step.do` has an explicit config with `retries.delay` and `timeout`;
  - freeze render: a clip-backed ingest keeps `polling`; a cancel mid-stitch swaps no output; `freeze:release` runs last on every path, including an uncaught error;
  - `twin-avatar` runs from the finally when the run fails before `continue:*`.
- `lib/creative/start.test.ts` NEW:
  - runner CAS;
  - "already exists" → started;
  - 429 → `failed`.
- `lib/creative/falWebhook.test.ts` NEW. Use a test keypair from `generateKeyPairSync("ed25519")`, a fake JWKS fetch and cache, and a fake `CREATIVE_JOB` binding (running / throws / terminal / not found). Assert:
  - the 200/401/503 matrix, including the unset-secret 503;
  - `-late` is created at most once.
- `lib/creative/jobs.test.ts` NEW:
  - `fenceSubmit` and `fenceTts`;
  - `claimDelivered` (normal, deferred, lost to a cancel);
  - the cost upsert is idempotent.
- `lib/creative/continuations.test.ts` NEW:
  - the draw, freeze (sketch and render), imessage and twin-avatar runners are idempotent;
  - every part carries `clientMessageId = imessageKey("creative", jobId, slot)`, with the same keys whether it goes through a fake `ConversationDO.deliver` or the direct sender;
  - `claimed: false` suppresses draw/freeze side effects;
  - the imessage runner chooses the rich link by `asset.bytes`.
- `supabase/tests/creative_permits.sql` NEW, run by the existing migration-apply and SQL-test steps in `.github/workflows/ci.yml:112-129`.
- Add the pure suites to `apps/web/vitest.pure-tests.txt`. Only suites without `vi.mock` or env mutation qualify (see the file header).
- Manual probes:
  - Run `opennextjs-cloudflare preview`, POST `/api/chat` with `/imagine a cat`, then run `wrangler workflows instances list creative-job` and `… describe`. `npm run cf:env -- dev` writes the local values into `.dev.vars`. fal cannot reach a local preview, so a local `/zap` finishes through the `fal-wait` timeout and `fal-result`.
  - Run `wrangler tail airv2-app --format pretty` during a `/zap` on the workers.dev deployment to see the webhook hit.
  - Replay a captured webhook with a bad signature and expect 401.
  - Before P4, the owner sets `CREATIVE_WEBHOOK_ORIGIN` to the workers.dev URL and pushes it (§2.5 C22).

**Risks & notes.**
- Webhook origin until cutover:
  - Until cutover, `app.wzrd.tech` goes through the legacy app-switch. With `target=vercel`, app-switch forwards `/api/creative/fal-webhook` to Vercel, where it returns 404. So the owner points `CREATIVE_WEBHOOK_ORIGIN` at airv2-app's workers.dev host until R-CF-14. Once airv2-app holds the host, R-CF-02's handler serves the path on Cloudflare whatever the target (§2.5 C1).
  - R-CF-14's cutover runbook switches it back to `https://app.wzrd.tech`: the owner edits `.env.airv2.md` and runs `cf:env -- push` (§2.5 C22), then verifies that a `/zap` webhook lands on the app host.
  - P6 (`workers_dev: false`) must not land before that check passes.
  - A lost webhook only delays a job, because `fal-result` reconciles by request id.
- The contract puts the Workflow class in airv2-app, so every step invocation boots the airv2-app script. Keep the creative graph lazily imported from `run()`, keep `next/*` out of it (`start.ts` holds `after`), and check startup in Workers Logs (R-CF-15).
- `sensitive: "output"` is documented only in the instance-event config shape, so sealing is mandatory either way.
- Rotating `CREATIVE_SEAL_KEY` breaks in-flight instances. The owner rotates it (a `cf:env push`, §2.5 C22) only when `creative_jobs_inflight_idx` is empty. The alternative is to add `CREATIVE_SEAL_KEY_PREV`.
- With 1 h / 1 day retention, `describe` stops working once retention ends. The reaper and the late path rely on Postgres (`runner`, `provider_request_id`, `provider_model`, `continuation`). Workflows created on or after 2026-09-10 on Workers Paid default to 7-day retention ([changelog](https://developers.cloudflare.com/changelog/post/2026-09-10-paid-retention-default/)), so set retention explicitly on the binding and on every `create()`.
- GMI has no verified webhook, so it polls. Ask GMI for a callback field. If one exists, GMI moves to the `waitForEvent` path.
- The SSE route caps streams at 480 s (`events/route.ts:19`), but a job can now take about 20 min. R-CF-07 owns that client contract, and there is no regression versus today.
- During a rollback window, when both runners are live, the inline semaphore and the Postgres permits are separate. Concurrency can then reach 2 × `CREATIVE_MAX_CONCURRENCY`.
- Behaviour change: a late render no longer flips a cancelled job to `delivered` (today `run.ts:244-248` overwrites it unconditionally). Its `output_asset_id` is still recorded.
- Synchronous callers (draw, icon, image, character sheet, twin video) hold the HTTP request open for up to about 15 min, as on Vercel today.
  - A disconnect no longer loses the render, only the request-side post-processing.
  - The stale-slot path recovers the slot (`draw.ts` claim; `freeze.ts:586`).
  - Requests proxied through app-switch before P4 may hit fetch timeouts (verify).
- A `tts` re-entry with no staged clip ends `submit_unknown`, even when ElevenLabs never billed. That is the product rule C23 trade-off: an unknown outcome is never retried automatically.

**Depends on.**
- R-CF-01: env packing, the `## secret`/`## plain` sections and `env.example.test.ts`.
- R-CF-02: the entry and `createFetchHandler`: `applyEnv`, the fal-webhook hook ahead of the switch branch, and the `CreativeJob` export.
- R-CF-03: the iMessage transport, `imessageKey` and attachments.
- R-CF-04: `ConversationDO.deliver(parts, { key })` and `conversation()` for the `imessage` continuation.
- R-CF-06: the after() inventory hand-off. The creative sites move here, not to the queue, and this PR shrinks the `after-inventory.test.ts` allowlist.
- R-CF-09: lazy heic/sharp, streamed ingest (`ingestGeneratedStream`, `adoptStagedObject`), the 50 MiB limits, and the `freezeStitch.ts` step functions and `stitchFreezeClip` that *Freeze render wiring* runs.
- R-CF-12: `lib/runtime/platform.ts` (`cfEnv`, `setCfEnv`).
- Soft: R-CF-11, which runs the sweep on CF. The reaper acts only once `cron_host=cloudflare` (§2.5 C13). Nothing in this item waits for it.
