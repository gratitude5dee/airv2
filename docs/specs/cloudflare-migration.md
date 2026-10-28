# Cloudflare migration: airv2 fully on Cloudflare Workers (Paid)

Moves the entire airv2 control plane (`apps/web`) from Vercel to Cloudflare. It finishes the
migration PR #522 started, so that every feature runs on Cloudflare, with iMessage first:
web, the mini/link hosts, background work, crons and Create builds. Vercel stays only as a
rollback target behind the existing admin Hosting switch.

- **Status:** spec, ready to implement. Written 2026-10-27 from the repo at `main` (46aa365).
  Research covered the live Cloudflare and Vercel accounts and the vendor SDK sources.
- **Implementer:** Devin. Ship **one PR per `R-CF-NN`** item, in the phase order of §4.
  Title each PR `R-CF-NN: …`, matching the repo's `R-*` convention.
  **Read §2.5 (cross-cutting conventions) first.** It is normative and overrides any R-CF item that disagrees.
- **Companion file:** `apps/web/env.example.md`, the committed names-only env template from R-CF-01.
  It was generated in the same PR as this spec, from `apps/web/lib/env.ts` and `apps/web/lib/create/config.ts`.

## 0. Verdict and decisions

### Can the whole product run on the Workers **Free** plan? No.

Two blockers hold on Free regardless of engineering effort:

1. **iMessage sends.** Photon's hosted iMessage plane for our Spectrum Cloud project only speaks gRPC:
   - The hosts are `imessage.spectrum.photon.codes:443` and `<instance>.imsg.photon.codes:443` (`apps/web/lib/spectrum/fast-reaction.ts:15,108`).
   - Photon has published no HTTP send endpoint (`ARCHITECTURE.md` §7.2: *"There is no public HTTP send-message endpoint"*).
   - Workers cannot open gRPC. `node:http2` is a stub whose `connect()` throws.
   - On Free, the only way around this would be a Container relay, and Containers are Paid only.
2. **Create builds.** One esbuild build costs about 0.5–3 s of CPU. Free allows 10 ms per request,
   Durable Object request and Workflow step, and has no Containers.

Everything else was rated "no" or "risky" on Free. The binding limits are 10 ms CPU, 50 external
subrequests, 30 s `waitUntil`, 64 vars, 5 cron triggers per account, 3,000 Workflow steps/day and
100k requests/day. Those quotas are also shared with the account's 33 other Workers.

| Subsystem | Free | Paid (with this spec) | What binds / what fixes it |
|---|---|---|---|
| iMessage outbound | no | yes | gRPC-only vendor plane. Fix: `air-sidecar` relay Container (R-CF-03); Photon HTTP if offered |
| iMessage inbound turn | no | yes | `after()` capped at 30 s on both plans. Fix: `ConversationDO` (R-CF-04) |
| Box control (Tenki) | no | yes | Tenki data plane is HTTP/2-only. Fix: lazy import, `ascii` default, migrate 2 `tk_` boxes (R-CF-05) |
| Streams (SSE relays) | no | yes | Fits Paid CPU as-is (R-CF-07) |
| Creative jobs | risky | yes | 420 s jobs in `after()`. Fix: `CreativeJob` Workflow + fal webhooks (R-CF-08) |
| Create builds | no | yes | Native esbuild + disk reads. Fix: `air-build` with esbuild-wasm (R-CF-10) |
| Crons | no | yes | Fix: Paid Cron Triggers + `scheduled()`; long items fan out (R-CF-11) |
| Media (ffmpeg, sharp, HEIC) | no | yes | Fix: Images binding + `MediaWorker` Container (R-CF-09) |
| SSR / auth routes | no | yes | 10 ms CPU on Free; fine on Paid (R-CF-12) |
| Env / deploy / switch | no | yes | 217 names exceed even Paid's 128 → packing (R-CF-01/02/13) |

### Decisions (owner, 2026-10-26/27)

1. **Target is Workers Paid** ($5/mo for the account), with everything on Cloudflare.
2. **Env:** all env values, secrets included, live in the gitignored `apps/web/.env.airv2.md`.
   `apps/web/scripts/cf-env.mjs` packs and uploads them (R-CF-01).
3. **Hosting switch:** the deployed `app-switch` logic is folded into `airv2-app`'s custom worker entry.
   - The `/_switch` API and the KV `HOSTING.target` key keep their current contract, so the admin panel (repo `gratitude5dee/admin`) needs no change.
   - Vercel is only the rollback target. It works only once the Vercel account is unblocked (§6).
4. **Hosts:** `app.wzrd.tech` is cut over first, then `mini.wzrd.tech` and `link.wzrd.tech`.
5. **Workers for Platforms** (the per-app functions lane: `air-dispatcher`, `air-dev`, `<slug>-draft`/`-dev`
   deploys) stays **gated off**. That is today's production state. WfP is a separate $25/mo add-on (§7).

### Workstream index

Ship in phase order. Within a phase, ship in dependency order: P1 runs 01 → 12 → 02 → 13 → 15; P2 runs 03, 05, 09; P3 runs 06 → 04 and 07 → 08, 10 and 11. "Depends on" lists hard dependencies only. Each item's own section notes its soft ones.

| ID | Workstream | Phase | Size | Depends on |
|---|---|---|---|---|
| [R-CF-01](cloudflare-migration/R-CF-01-env-and-secrets-from-a-gitignored-markdown-file.md) | Env and secrets from a gitignored markdown file | P1 | M | — |
| [R-CF-02](cloudflare-migration/R-CF-02-custom-worker-entry-and-the-hosting-switch.md) | Custom worker entry and the hosting switch | P1 | M | 01, 12 |
| [R-CF-03](cloudflare-migration/R-CF-03-imessage-outbound-transport.md) | iMessage outbound transport (+ `air-sidecar` ImessageRelay) | P2 | L | 01, 02, 12, 13 |
| [R-CF-04](cloudflare-migration/R-CF-04-imessage-inbound-as-a-durable-turn.md) | iMessage inbound as a durable turn (`ConversationDO`) | P3 | XL | 01, 02, 03, 05, 06, 12 |
| [R-CF-05](cloudflare-migration/R-CF-05-box-control-on-workers.md) | Box control on Workers | P2 | L | 01, 02, 12 (Option B: 03) |
| [R-CF-06](cloudflare-migration/R-CF-06-durable-deferred-work-replace-long-after.md) | Durable deferred work (replace long `after()`) | P3 | L | 01, 02, 12, 13 |
| [R-CF-07](cloudflare-migration/R-CF-07-streams-and-realtime.md) | Streams and realtime | P3 | M | 02, 05, 06, 12 |
| [R-CF-08](cloudflare-migration/R-CF-08-creative-jobs-as-a-workflow.md) | Creative jobs as a Workflow | P3 | L | 01, 02, 03, 04, 06, 09, 12 |
| [R-CF-09](cloudflare-migration/R-CF-09-media-without-native-binaries.md) | Media without native binaries | P2 | L | 01, 02, 03, 12, 13 |
| [R-CF-10](cloudflare-migration/R-CF-10-create-lane-builds-on-cloudflare-air-build.md) | Create lane builds (`air-build`) | P3 | L | 01, 02, 06, 07, 09, 12, 13 |
| [R-CF-11](cloudflare-migration/R-CF-11-crons-on-cloudflare-cron-triggers.md) | Crons on Cloudflare Cron Triggers | P3 | L | 01, 02, 03, 04, 05, 06, 07, 09, 12, 13 |
| [R-CF-12](cloudflare-migration/R-CF-12-runtime-compatibility-fixes.md) | Runtime compatibility fixes | P1 | M | 01 |
| [R-CF-13](cloudflare-migration/R-CF-13-ci-cd-for-airv2-app.md) | CI/CD for airv2-app | P1 | M | 01, 02 |
| [R-CF-14](cloudflare-migration/R-CF-14-cutover-hosts-and-third-party-urls.md) | Cutover, hosts and third-party URLs | P4–P6 | M | 14.1a: —; rest: 01–13, 15 |
| [R-CF-15](cloudflare-migration/R-CF-15-observability-limits-and-budgets.md) | Observability, limits and budgets | P1→ | S | 02, 13 |

## 1. Current state

### 1.1 What PR #522 delivered

PR #522, "Add OpenNext Cloudflare Workers deploy for airv2 (airv2-app)": head `41b1c37`, merge `46aa365`, merged 2026-10-19T04:27Z. It builds and deploys. It does not serve the app.

- `apps/web/wrangler.jsonc:1-22` (current contents):
  - `name: "airv2-app"` (:3), `main: ".open-next/worker.js"` (:4), compat date `2026-10-12` (:5).
  - Flags `nodejs_compat` and `enable_nodejs_process_v2` (:6). `enable_request_signal` and `global_fetch_strictly_public` are missing (R-CF-12).
  - `ASSETS` serves `.open-next/assets` (:7-10).
  - `observability.enabled` (:19-21).
  - Two vars, neither read by any code: `AIR_PUBLIC_ORIGIN` (:14) and `UPSTREAM_VERCEL` (:17). The commit message says `airv2-app` "matches app-switch UPSTREAM_CF". `UPSTREAM_CF` is a var on the deployed `app-switch` script (§1.2). No repo file contains it. R-CF-02 deletes `AIR_PUBLIC_ORIGIN`, and no later item reads or deletes it: same-app calls go through the `SELF` binding's `Internal` entrypoint via `selfFetch()`, with URLs built on `env.appOrigin()` (§2.5 C1, C3). `UPSTREAM_VERCEL` stays as the rollback-proxy target (R-CF-02).
  - Not configured: routes or custom domains, KV, service bindings (including `SELF`), crons, queues, DOs, Workflows, `limits` and `secrets.required`. The app is reachable only on workers.dev.
- `apps/web/open-next.config.ts:3` is `defineCloudflareConfig({})`, which uses the dummy incremental cache. Prerendered pages re-render on every request. This is acceptable because `apps/web` has no ISR, `revalidate*`, `unstable_cache` or `generateStaticParams`.
- `apps/web/package.json` ranges: `next ^15.5.26` (:29), `@opennextjs/cloudflare ^1.20.10` (:45), `wrangler ^4.0.0` (:68). Resolved versions: next 15.5.27, OpenNext 1.20.10, wrangler 4.149.0. R-CF-12 bumps the ranges.
- It was deployed by hand to `airv2-app.gratitude-8f4.workers.dev`:
  - Script id `64986eada5984bbf838b99986c04ff4e`, last modified 2026-10-12T15:54Z.
  - That is 4 minutes before commit `41b1c37` (15:58Z), so it was deployed from a working tree, not from main.
- No CI deploys it:
  - `.github/workflows/workers.yml:13-22` triggers only on `infra/workers/**` and the workflow file itself.
  - The `web` job in `.github/workflows/ci.yml:49-66` runs plain `npm run build` (:64).
- Numbers reported in the PR:
  - Bundle: 34 MB. The limit is 64 MiB uncompressed. There has been no compressed cap since 2026-09-04: https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/
  - Static assets: 1,299 files.
  - Production vars: 57 of about 90 set. The PR text also says "~60". The Free cap of 64 does not matter on Paid.

Probe table from PR #522, with the corrected reading:

| Probe | PR #522 result | PR #522 explanation | Corrected reading |
|---|---|---|---|
| `/`, `/login`, `/home`, `/approve/[id]` | 200 | "static/ISR + light SSR" | Consistent. `/approve/[id]` returns only `<ApproveClient>` and does no server DB read (`app/approve/[id]/page.tsx:18-27`). |
| `/api/me`, `/api/me/agent-context` | 401 | "correct (unauthenticated)" | Consistent. The handler returns before `serviceClient()` (`app/api/me/route.ts:18-22`). |
| `/mini`, `/mini/create`, `/api/store/search` | **500** | "Worker throws under the Free plan's 10 ms CPU cap" | **Wrong.** A CPU or memory overrun is Error 1102, which returns HTTP **503** (outcome `exceededCpu` / `exceededMemory`). HTTP 500 is Error 1101, an uncaught exception. All three routes go through `serviceClient()` (`lib/supabase.ts:10-12`) → `env.supabaseUrl()` (`lib/env.ts:344`) → `required()` (`lib/env.ts:7-13`). See the per-route rows below. |
| ↳ `/mini` | | | Store home calls `serviceClient()` directly (`app/mini/(store)/page.tsx:157`). |
| ↳ `/mini/create` | | | `app/mini/(store)/create/page.tsx:1` is `"use client"` with no server DB read. It is not what ran. On the main host (workers.dev counts as main), middleware rewrites `/mini/create` to `/mini/store/create` (`middleware.ts:98,112,133-141`). That page's `generateMetadata` calls `getRegistryApp(serviceClient(), slug)` (`app/mini/(store)/store/[slug]/page.tsx:40`). |
| ↳ `/api/store/search` | | | `serviceClient()` runs first (`app/api/store/search/route.ts:25`). |

Before any perf work, read the Workers Logs outcome and exception stack for these three probes (R-CF-12 (n)).

> Note for owner: the `required()` explanation fits the 200/401/500 split once you account for the boot mode on workerd (R-CF-12 (n)):
> - **`validateEnv()` only warned on workerd.** `register()` → `validateEnv()` (`instrumentation.ts:8-10`, `lib/env.ts:267-285`) throws only when `environment === "production"` (`lib/env.ts:283`). The default is the runtime read `source["NODE_ENV"] ?? "development"` (`lib/env.ts:269`). Next and OpenNext inline the literal `process.env.NODE_ENV` as `"production"`, but `source["NODE_ENV"]` is a runtime key that OpenNext never sets. So on workerd it resolved to development and logged `[env] Missing required env var(s) … — continuing (development)` instead of throwing (verify in R-CF-12 (n) step 3). A throwing `register()` would have failed `/` too, and `/` returned 200 although only 57 of about 90 values were set.
> - **`required()` then threw at call time.** Routes that never reach `serviceClient()` returned 200, or returned 401 before reaching it (`/api/me`, `app/api/me/route.ts:18-22`). The three 500 routes call `serviceClient()` → `env.supabaseUrl()` → `required()` (`lib/env.ts:7-13`), which throws `Missing required env var: SUPABASE_URL` (or `SUPABASE_SERVICE_ROLE_KEY`, `lib/env.ts:41-42`).
> - **Unauthenticated `/api/store/search` reaches only `serviceClient()` before its 401 path.** Without a bearer, `tryBoxPrincipal` returns `null` before any query (`lib/auth/guard.ts:111-116`). `requireOwner` then yields 401 through the same session code that worked for `/api/me` (`lib/auth/guard.ts:100-106,144-151`). So a "PostgREST error after the client was built" cannot explain that probe; the throw is inside `serviceClient()` itself.
> - **What is left, if Workers Logs do not show "Missing required env var":**
>   - `createClient()` rejecting a value that is present but malformed: quotes, whitespace, or a non-URL `SUPABASE_URL` (verify against supabase-js `createClient` validation).
>   - A module-scope throw in those routes' graph.
>   - The probes ran against a different var set than the `/api/me` probe.
>
> The decision stands: diagnose from Workers Logs first (R-CF-12 (n)). When R-CF-01 runs `check`, also confirm the format of `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Once R-CF-12 (n) passes the inlined `NODE_ENV` to `validateEnv`, a missing required name fails every route on that isolate. So that change ships only after `cf:env -- check` passes on production values.

### 1.2 The deployed `app-switch` Worker (not in the repo)

Facts from a read-only CF API read of the script and its code (2026-10-28):

- Script `app-switch`, id `958d3644d2da4ab28580112132f0d81a`, last modified 2026-10-12T14:23Z. The code is a single esbuild bundle of `index.js`.
- KV binding `HOSTING` points at namespace `61b51af0f1da4cda8dd6449c845ac01e` ("app-hosting-switch"). Key `target` is `vercel` or `cloudflare`. Any other value reads as `vercel`.
- `/_switch` contract. The admin panel depends on it, so R-CF-02 keeps every existing path, method, field, status and error body below. The only changes are additive response fields, a constant-time bearer compare, the 409 upstream guard and an optional `force` flag (§2.5 C12). The admin panel is unchanged and cannot send `force`, so a forced flip is a `curl` with `{"force":true}` that the owner runs (§2.5 C22):
  - Auth: `Authorization: Bearer ${SWITCH_TOKEN}`. It returns 401 `{"error":"unauthorized"}` when the token is unset or does not match. The compare is plain `!==`, not constant-time.
  - `GET` → 200 `{"target":"<t>"}`.
  - `POST {"target":"vercel"|"cloudflare"}` (case-insensitive) → `HOSTING.put("target", t)` → 200 `{"target":"<t>"}`.
  - Errors: 400 `{"error":"invalid json body"}`, 400 `{"error":"target must be one of: vercel, cloudflare"}`, and 405 `{"error":"method not allowed"}` for other methods.
- Every other path is proxied to `UPSTREAM_CF` or `UPSTREAM_VERCEL`. Both values are script vars (verify them in the dashboard).
  - Deletes `host`, `connection`, `cdn-loop`, `cf-connecting-ip`, `cf-ipcountry`, `cf-ray`, `cf-visitor`, `cf-worker`, `cf-request-id` and `x-forwarded-for`.
  - Sets `host` to the upstream host, `x-forwarded-host` to the original host, `x-forwarded-proto`, and `x-forwarded-for` to `cf-connecting-ip`.
  - Uses `redirect: "manual"`, rewrites a `Location` that points at the upstream host back to the original host, and sets `x-served-by: app-switch:<target>`.
- It awaits `env.HOSTING.get("target")` on every request, with no cache.
- It returns a JSON 502 only when `fetch()` throws. There is no 503/1102 detection and no failover.
- With `target=cloudflare`, each request costs 2 invocations: app-switch, then airv2-app through its public URL.
- Because it replaces `Host`, Next host routing (`middleware.ts:56`) would treat mini and link as the main host. It is only safe in front of `app.wzrd.tech`.
- Unknown:
  - Which routes are bound to it (verify in Workers → app-switch → Domains & Routes). On Vercel, `app.wzrd.tech` is `misconfigured=true`, and the project-domain record was last updated 2026-10-15T04:41Z. Both fit app-switch owning that host.
  - The current value of `target` (verify with `npx wrangler kv key get target --namespace-id 61b51af0f1da4cda8dd6449c845ac01e --remote`). Production behaviour today depends on it. With `vercel`, dynamic traffic and the iMessage webhooks hit the blocked Vercel account. With `cloudflare`, they hit the partly configured airv2-app.
- **Route precedence:** a Worker route on a hostname takes precedence over a Custom Domain on the same hostname (https://developers.cloudflare.com/workers/configuration/routing/routes/). If app-switch keeps an `app.wzrd.tech/*` route, it keeps intercepting after airv2-app takes the Custom Domain in P4. The owner deletes that route in the same cutover step (R-CF-14 runbook, §6.12; §2.5 C22).
- Action (owned by R-CF-02 and shipped in P1, because R-CF-02 ports this logic, §2.5 C19; R-CF-13 adds the dry-run check; R-CF-14 owns the runbook and retires the live script after the soak in P6):
  - `infra/workers/app-switch/src/index.js` NEW: the deployed bundle, verbatim. Fetch it read-only via `GET /accounts/e8f42c0430906e1515a2af01d5c1d2d1/workers/scripts/app-switch/content/v2` (verify the endpoint), or with `npx wrangler init app-switch --from-dash app-switch` into a scratch dir.
  - `infra/workers/app-switch/wrangler.jsonc` NEW, containing:
    - `name: "app-switch"`, `main: "src/index.js"`, and the compat date from the API (verify).
    - KV `HOSTING` → `61b51af0f1da4cda8dd6449c845ac01e`.
    - `vars` `UPSTREAM_CF` and `UPSTREAM_VERCEL` with their live values.
    - `secrets.required: ["SWITCH_TOKEN"]`.
    - **No `routes`**, so a stray deploy cannot take a hostname.
  - `infra/workers/app-switch/README.md` NEW: the routes and custom domains bound to app-switch at vendoring time (from Domains & Routes, above). This is the only place they are recorded (§2.5 C19).
  - `.github/workflows/workers.yml:37-42`: R-CF-13 adds `{ name: app-switch, dir: infra/workers/app-switch }` to the `check` matrix as a dry-run-only check. There is no deploy job (§2.5 C18, C19).
  - Purposes: history, and an independent kill switch outside airv2-app's failure domain (§2.4). It is useful only with `target=vercel`, because `UPSTREAM_CF` is the workers.dev URL and that URL goes away in P6.
  - Any `app-switch` deploy, including an emergency one, is owner-only (§2.5 C19, C22).

### 1.3 Vercel

- Account:
  - Team `5dee-studios` (`team_PYXAVq4jrHw8k0bNffmhc2jE`), Pro plan. Project `airv2` (`prj_k85SYkCP3elo3YIChN6o45gEbsRC`).
  - Every Vercel commit status since 2026-10-10T18:27Z reads **"Account is blocked."** The first was PR #521 head `82b5f47`. Later ones include PR #522 head `41b1c37` and main `46aa365`. The reason for the block is not visible read-only.
- Deploys: none since 2026-10-08. Production is still `dpl_6XqRNBzkoQENVNYtw4HAKb5Kw1nj`, commit `ce337d1`, which predates #522. It is aliased to `app.`, `mini.` and `link.wzrd.tech` and to `airv2.vercel.app`.
- Runtime:
  - Function invocations, Fluid CPU and memory billing were $0 from 2026-10-11 to 2026-10-20 (PT days).
  - Runtime logs are empty and runtime errors show none.
  - So **functions and the 8 crons have not run since about 2026-10-11**. CDN requests are still recorded, most likely serving a block page.
  - Any third-party webhook registered directly at `airv2.vercel.app` bypasses every switch and fails while the account is blocked. Stripe may be one (`lib/payments/stripe.test.ts:32`, verify in the Stripe dashboard). R-CF-14 re-registers it.
- **Unblocking restarts the old crons.** Once the account is unblocked, `ce337d1`'s 8 crons resume immediately. That build has no `cron_host` guard, so it would double-run with Cloudflare crons and drain stale backlog (see below). Owner action (P0, before paying the balance): open Project Settings → Cron Jobs → **Disable Cron Jobs**, which needs no redeploy. Verify that a blocked team can save that setting; if it cannot, do not unblock until it can (§6.3). Re-enable them only on a Vercel build that has the R-CF-11 `cron_host` guard.
- DNS. `wzrd.tech` uses Cloudflare nameservers `aria/coen.ns.cloudflare.com`, and all three hosts are orange-cloud proxied:
  - `mini.wzrd.tech` and `link.wzrd.tech`: Vercel `configuredBy=http`, `misconfigured=false`.
  - `app.wzrd.tech`: Vercel `configuredBy=null`, **`misconfigured=true`**.
- Certificates: Vercel's `*.wzrd.tech` wildcard and apex certs **expire 2026-11-28**.
  - Renewing the wildcard needs DNS-01, which Vercel cannot complete on Cloudflare nameservers.
  - mini and link may fall back to HTTP-01. `app.wzrd.tech` cannot.
  - Consequence: DNS rollback to Vercel (rollback B) stops working after that date. Proxy rollback to `airv2.vercel.app` (rollback A) is not affected.
- Domain registration: `wzrd.tech` is **registered at Vercel with auto-renew off** and expires 2027-06-28. Domain control currently depends on a blocked account. Owner action (P0): transfer it to Cloudflare Registrar, or turn renewal on. Whether a blocked account can start a transfer is unknown (verify).
- Rollback viability: Vercel works as a rollback target only after the owner settles the balance. The Vercel build is frozen at `ce337d1` and knows nothing of any migration applied since then. So R-CF-02's `POST /_switch {target:"vercel"}` probes `UPSTREAM_VERCEL/api/version` first (§2.5 C12):
  - An unreachable or non-2xx upstream gets 409.
  - A 404 counts as a pre-R-CF-02 build such as `ce337d1` and is allowed.
  - A SHA mismatch returns a `warning` and needs `{"force":true}`.
  - A strict same-SHA gate would make rollback impossible while Vercel is frozen. So the owner confirms that the Vercel build is compatible with the applied migrations before flipping (§2.5 C22).
- Backlog risk: the crons have been dark since about 2026-10-11, so `flush_jobs` (`run_at`), `agent_schedules` (`next_run_at`) and `content_slots` (`scheduled_at`, status `scheduled`) rows may be weeks overdue. The sweep's overdue `runFlush` (`lib/orchestrator/overdueFlush.ts:31-33`) would deliver stale iMessage replies, and stale schedules and slots would fire blindly.
  - R-CF-11 ships the backlog triage step: a read-only report of the overdue rows per table (count and oldest age), then a drain-or-expire decision.
  - It runs before the first `cron_host=cloudflare` flip, and again before Vercel crons are re-enabled. `cron_host` and `HOSTING.target` are independent levers, so that flip may happen at P3 exit, before the P4 target flip (§2.5 C13).
  - Devin implements it and tests it locally. The owner runs it against production and approves the decision (§2.5 C22, §6) (verify counts).

### 1.4 Existing Cloudflare Workers

Account `e8f42c0430906e1515a2af01d5c1d2d1` has 34 scripts (`workers_list`, 2026-10-28):

- Ours: `airv2-app`, `app-switch`, `air-muse`, `air-outbound`, `air-backend`, `air-landing`, `air-benchmark-fixtures`.
- Related products on the same account: `wzrd-connect`, `wzrd-admin` (possibly the admin panel, verify), and `wzrdmail-*` (10 scripts).
- Others: `zap-*`, `fye-*`, `tha-bay-web*`, `wzrd-landing`, `wzrd-studio`, `musebook-*` and more.

All of them share the Paid included usage (§3.3). `air-dispatcher`, `air-dev` and `air-create` are **absent**.

| Worker | Repo config | Deployed | Relevance |
|---|---|---|---|
| `air-dispatcher` | `infra/workers/wrangler.toml:11`; routes `*-apps.wzrd.tech/*` and `apps.wzrd.tech/*` (:16-21); `dispatch_namespaces` `air-apps` (:53-55) | no | Workers for Platforms (WfP), a $25/mo add-on. **Out of scope.** Stays gated by `appOriginLaneReady()` (`apps/web/lib/functions/deploy.ts:74-80`). |
| `air-dev` | `infra/workers/dev-router/wrangler.jsonc:6`; routes `*-dev.wzrd.tech/*` (:11-14); dispatch namespace (:15) | no | WfP. Out of scope. |
| `air-create` | `infra/workers/create/wrangler.jsonc:12`; custom domain `create.wzrd.tech` (:16); Workflow `create-job` (:18); `dispatch_namespaces` (:26); cron `17 4 * * *` (:27); `cpu_ms 60000` (:28) | no | WfP draft/dev lanes. Out of scope, no change in this spec. Its build step POSTs to the control plane (`create/src/workflow.ts:300-302` → `create/src/adapter.ts:94-98`, `/api/internal/create/build` at `CONTROL_PLANE_ORIGIN`). |
| `air-outbound` | `infra/workers/outbound/wrangler.toml`; `CONTROL_PLANE_ORIGIN=https://app.wzrd.tech` (:16) | yes (2026-10-06) | WfP outbound. Idle, because no dispatcher is deployed. Calls back with `new URL(route.target, env.CONTROL_PLANE_ORIGIN)` (`outbound/index.mjs:157`). R-CF-14 switches it to a service binding. |
| `air-muse` | `infra/workers/muse/wrangler.toml`; `global_fetch_strictly_public` (:7); `CONTROL_PLANE_ORIGIN` (:23) | yes (2026-09-21, by hand) | Calls back at `muse/src/index.ts:235` and `muse/src/full.ts:57`. R-CF-14 switches it to a service binding. |
| `static-stub` | `infra/workers/static-stub/index.mjs` | n/a | Embedded by `lib/functions/staticStub.ts`. Never deployed by wrangler. |

- `workers.yml` runs `check` for dispatcher, create, dev-router, outbound and muse (:37-42). It has deploy jobs for outbound (:75), dispatcher (:92), create (:127) and dev-router (:144). **Muse has no deploy job.**
- The dispatcher, create and dev-router scripts are absent from the account, which is consistent with WfP not being purchased (verify the job history).
- R-CF-13 adds deploy jobs for `air-sidecar` and `air-build`, and the dry-run-only `app-switch` check. `airv2-app` deploys only after the Workers it binds exist (§2.5 C18).

### 1.5 Environment inventory

Counted from `lib/env.ts` and `lib/create/config.ts`. The committed template is `apps/web/env.example.md`. It was produced once, with this spec, and no generator is committed. Every item that adds a name hand-edits the template in the right section, with the tag comments. `apps/web/lib/env.example.test.ts` (R-CF-01) enforces format and completeness (§2.5 C20).

- **217 server names**:
  - 21 required: `REQUIRED_ENV`, `lib/env.ts:25-47`.
  - 169 optional: `OPTIONAL_ENV`, `lib/env.ts:60-230`. This count includes the 6 members of the 2 at-least-one groups (`REQUIRED_GROUPS`, `lib/env.ts:52-55`).
  - 27 unmanifested: read by code but missing from the manifest. R-CF-01 adds them.
- By class: 56 secret, 157 plain, 4 injected by Vercel (`VERCEL_OIDC_TOKEN`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_CREATED_AT`, `VERCEL_REGION`).
- 1 public build-time name: `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`.
- R-CF-01/02/03 add 6 names, already in the template:
  - `SWITCH_TOKEN`, `EDGE_PROXY_SECRET`, `VERCEL_AUTOMATION_BYPASS_SECRET` (`env.example.md:153-158`).
  - `UPSTREAM_VERCEL`, `IMESSAGE_TRANSPORT`, `PHOTON_IMESSAGE_HTTP_ADDRESS` (:479-485).
- Later items add their own names by hand-editing the template (§2.5 C20):
  - R-CF-05: `TENKI_RELAY`.
  - R-CF-08: `CREATIVE_SEAL_KEY`, `CREATIVE_WEBHOOK_SECRET`, `CREATIVE_WEBHOOK_ORIGIN`, `FAL_WEBHOOK_USER_ID`.
  - R-CF-10: a `## secret @air-build` section with `R2_BUILD_ACCESS_KEY_ID` and `R2_BUILD_SECRET_ACCESS_KEY`.
- Template sections: `## secret` (:36), `## plain` (:161), `## public` (:488), `## secret @air-sidecar` (:495), and a reference-only block of Vercel-injected names (:503). R-CF-01 moves `SWITCH_TOKEN` (:153-154) into a new `## secret @airv2-app` section, placed before `## secret @air-sidecar`.
- Packing is required on Paid too: 217 names against 128 vars+secrets per Worker. Production uses about 90 today, which would fit, but the contract packs everything. That leaves headroom and gives rotation through `AIR_ENV_DIGEST`.
- On Vercel: at least 54 distinct keys (the env listing stops at 100 entries across environments). 9 production vars are stored as type `plain`, including `APP_ORIGIN_SIGNING_KEY`, `CREATE_BRIDGE_SECRET` and `LIVE_TOKEN_SECRET`. Classify these under `## secret` and rotate them during the migration (R-CF-01). `CANDIDATE_SECRET` is also stored as `plain`, but it is WfP-only (read by air-create and air-dev) and not in the manifest. Do not copy it (§6.8).
- Vercel-coupled reads, both handled by R-CF-12:
  - `aiGatewayApiKey` falls back to `VERCEL_OIDC_TOKEN` (`lib/env.ts:395-398`).
  - `VERCEL_*` deploy metadata is read at `lib/env.ts:837-841`.

### 1.6 Vercel crons (`apps/web/vercel.json:1-36`)

All 8 routes are GET handlers guarded by `requireCron`, a constant-time check of `Authorization: Bearer CRON_SECRET` (`lib/auth/guard.ts:173-180`, `secretEqual` at :92-97). `maxDuration` comes from each route's export, and Workers ignores it.

| Path | Schedule | maxDuration | Where | Weight per tick |
|---|---|---|---|---|
| `/api/cron/sweep` | `* * * * *` | 800 | `app/api/cron/sweep/route.ts:36` | Heaviest. About 13 sequential phases: idle stop, box reconcile, overdue `runFlush` (a full iMessage turn), fleet waves, migrations, TTL deletes. |
| `/api/cron/schedules` | `* * * * *` | 800 | `app/api/cron/schedules/route.ts:13` | Up to 10 due schedules (`SWEEP_BATCH`, `lib/calendar/sweep.ts:33`). Each runs `ensureBoxAwake`, a Hermes run and delivery. |
| `/api/cron/trade` | `* * * * *` | 60 | `app/api/cron/trade/route.ts:16` (no `runtime` export) | Reconciles orders for up to 100 owners (:34), then watchlists. |
| `/api/cron/publish` | `*/5 * * * *` | 800 | `app/api/cron/publish/route.ts:14` | Up to 100 due + 20 stale slots (`lib/publish/worker.ts:85,93`). Box wake, `ingestAsset` (100 MB cap, `lib/assets/pipeline.ts:58`). |
| `/api/cron/ads` | `*/10 * * * *` | 300 | `app/api/cron/ads/route.ts:14` | Spend-ceiling sweep. |
| `/api/cron/ad-metrics` | `15 * * * *` | 300 | `app/api/cron/ad-metrics/route.ts:14` | Metrics ingest plus Meta box runs. |
| `/api/cron/health` | `30 * * * *` | 300 | `app/api/cron/health/route.ts:16` | Connection health, spend reconcile, preflight. |
| `/api/cron/sources` | `0 */6 * * *` | 300 | `app/api/cron/sources/route.ts:20` | Proposals, user by user. |

- There are 6 distinct expressions. That gives 1,924 `scheduled()` invocations/day and 4,804 job runs/day (R-CF-11). Each due path is dispatched through `SELF` → `Internal` with the cron bearer, so it does not depend on the hosting target (§2.5 C1, C13).
- The `platform_settings` table exists (`supabase/migrations/0108_platform_settings.sql`). Its key constants live next to `BOX_DEFAULT_PROVIDER_KEY` (`lib/settings/platform.ts:10`).
- The highest existing migration is `0140_wzrd_connect.sql`. New migrations in this spec are written `NNNN_<name>.sql`. Each R-CF PR takes the next free number when it merges, because the PRs land in any order (§2.5 C23).

## 2. Target architecture

### 2.1 Topology

```
 Browsers · Spectrum webhooks (/api/inbound/imessage) · Stripe · GitHub App · AgentMail/wzrdmail · Cal.com
 fal webhooks (?fal_webhook=) · boxes (/api/gateway/v1, /api/box/v1, /api/cards) · admin.wzrd.tech (/_switch, /api/admin/*)
                                          │ HTTPS
   app.wzrd.tech (P4) · mini.wzrd.tech + link.wzrd.tech (P5) · airv2-app.gratitude-8f4.workers.dev (until P6)
                                          │ Custom Domains; /_next/static, /creator-os/*, … served as assets (worker not invoked)
┌─────────────────────── airv2-app  (apps/web; wrangler main = worker/entry.ts) ─────────────────────────────┐
│ applyEnv(env) first in every entrypoint, DO method and Workflow run() (§2.5 C3): AIR_ENV_00..07 +           │
│   AIR_ENV_DIGEST → process.env (re-unpack when the digest changes) → setCfEnv(env)                          │
│ fetch ─┬ strip every inbound x-air-* header, before anything else (§2.5 C1)                                 │
│        ├ /_switch      main host only · Bearer SWITCH_TOKEN (constant-time) · KV HOSTING (~30 s cache)      │
│        ├ /api/version  BUILD_SHA (wrangler define __AIR_BUILD_SHA__, §2.5 C5) + current target              │
│        ├ /_next/image → 404 (no next/image in app; protects Images budget)                                  │
│        ├ POST /api/creative/fal-webhook → CreativeJob, on Cloudflare whatever the target (R-CF-08)          │
│        ├ target=vercel ─────► proxyToVercel ──(x-air-origin-host, x-air-client-ip, x-air-edge-auth)──► https://airv2.vercel.app │
│        └ target=cloudflare ─► OpenNext .open-next/worker.js → middleware.ts → Next routes                   │
│ Internal (WorkerEntrypoint = SELF target) ─ applyEnv → OpenNext; never the switch, proxy or header strip    │
│ scheduled ─ 6 Cron Triggers ─► await selfFetch(/api/cron/*, Bearer CRON_SECRET) → SELF → Internal;          │
│                                each route does work only while platform_settings.cron_host='cloudflare'     │
│ queue ───── consumers of air-deferred + air-deferred-dlq ◄── DEFERRED.send() from lib/runtime/defer.ts      │
│ BoxLifecycle DO (wake, wakeStep)   ConversationDO (SQLite, alarms; one per iMessage space; deliver())       │
│ Workflows: CreativeJob `creative-job` (fal webhooks, GMI polls) · ScheduleRun · FleetSyncBox (R-CF-11)      │
│ SELF (service → airv2-app, entrypoint Internal): selfFetch() for crons, queue, DO phases, box lifecycle and │
│   the gateway self-call; replaces fetch(`${appOrigin}/api/...`)                                             │
└──┬───────────────┬───────────────┬───────────────┬───────────────┬──────────────────────────────────────────┘
   │ SIDECAR       │ BUILD         │ IMAGES        │ MEDIA (R2)    │ fetch (public internet)
   ▼               ▼               ▼               ▼               ▼
 air-sidecar      air-build       Cloudflare      air-media       Supabase (PostgREST, Storage)
 Worker+Containers esbuild-wasm   Images          (public at      Box API: 17 ascii boxes · Hermes on boxes
 ImessageRelay    tailwind JS     (HEIC→JPEG,     media.wzrd.tech) fal · GMI · OpenRouter/model providers
  lite/basic ×2   Kit modules/R2  thumbs)                         Stripe · Composio · Coinbase · AgentMail
  relay-0, relay-1                                                Photon HTTP adapter (later, gated)
 MediaWorker ≤2                                                   same-zone Workers: muse., api./mcp.mail., connector.wzrd.tech
  standard-1 (ffmpeg)
 TenkiRelay (optional; 1 instance; 2 tk_ boxes)
   │ gRPC / HTTP2 (Node 22)
   ▼
 Photon: imessage.spectrum.photon.codes:443 · <server>.imsg.photon.codes:443  (lib/spectrum/fast-reaction.ts:15,108)

 air-muse, air-outbound ── service binding CONTROL_PLANE ──► airv2-app        (R-CF-14)
 app-switch (vendored, infra/workers/app-switch/, no routes after P4) = standby kill switch until P6 (R-CF-14)
```

- iMessage inbound is already HTTP: Spectrum webhooks go to `/api/inbound/imessage`, then to `ConversationDO` (R-CF-04).
- Outbound has no public HTTP send endpoint (`ARCHITECTURE.md:781`), so it goes through `SIDECAR` → `ImessageRelay` (R-CF-03). `ConversationDO.deliver()` is the per-chat ordered lane in front of it (§2.5 C8).
- Boxes have `${appOrigin}/api/gateway/v1` baked in at provision time, so the public hostname must stay `app.wzrd.tech`.
- `admin.wzrd.tech` is the operator dashboard (`docs/platform.md:245`, repo `gratitude5dee/admin`). It is a caller only.
- Internal calls never leave the Worker and never reach the switch: every caller uses `selfFetch()` → `SELF` → the `Internal` entrypoint (§2.5 C1, C3).

### 2.2 `airv2-app` bindings

| Binding | Type | Purpose | R-CF |
|---|---|---|---|
| `ASSETS` | static assets | `.open-next/assets` (exists, `wrangler.jsonc:7-10`). Keep `not_found_handling` unset and `run_worker_first` false. | R-CF-02 |
| `HOSTING` | KV `61b51af0f1da4cda8dd6449c845ac01e` | Hosting `target`, with the same contract as app-switch (§1.2). Writes to this namespace are owner-only; tests use local KV or a test namespace (§2.5 C22). | R-CF-02 |
| `SELF` | service → `airv2-app`, `entrypoint: "Internal"` | Every internal call, through `selfFetch()` (§2.5 C1, C3): R-CF-04 DO phases, R-CF-05 lifecycle, R-CF-06 queue consumer, R-CF-11 `scheduled()`, R-CF-12 gateway self-call. `Internal.fetch` runs `applyEnv(this.env)` and then OpenNext; it never runs the switch or `proxyToVercel` and never strips `x-air-*`. Avoids the 522 a Worker gets when it fetches its own Custom Domain. | R-CF-02 (callers: R-CF-04, R-CF-05, R-CF-06, R-CF-11, R-CF-12) |
| `DEFERRED` | Queue producer `air-deferred` | `defer(kind, payload, { key, delaySeconds? })` on Cloudflare, dispatched through the one handler table `lib/runtime/deferHandlers.ts` (§2.5 C7) | R-CF-06 |
| (consumers) | Queue consumers `air-deferred` and `air-deferred-dlq` | Entry `queue()`. `air-deferred`: `max_batch_size` 1, `max_retries` 8, `retry_delay` 30, `max_concurrency` 25, `dead_letter_queue` `air-deferred-dlq`. A second consumer drains `air-deferred-dlq`. R-CF-06 owns these values (§2.5 C7). | R-CF-06 |
| `BOX_LIFECYCLE` | Durable Object `BoxLifecycle` (`new_sqlite_classes`, migration tag `v1-box-lifecycle`) | Per-box wake and stop coordination: blocking `wake(boxId)` for request paths, non-blocking `wakeStep(boxId)` for alarm-driven callers (§2.5 C8) | R-CF-05 (P2) |
| `CONVERSATION` | Durable Object `ConversationDO` (`new_sqlite_classes`, migration tag `v2-conversation`) | Per-space debounce, the turn state machine, and `deliver(parts, { key })`, the per-chat ordered outbound lane (§2.5 C8) | R-CF-04 (P3) |
| `CREATIVE_JOB` | Workflow `creative-job`, class `CreativeJob` | Creative jobs (fal/GMI). Retention: success 1 h, error 1 day. The name must be unique in the account, and `create-job` is reserved by `air-create` (`infra/workers/create/wrangler.jsonc:18`) (§2.5 C9). | R-CF-08 |
| `SCHEDULE_RUN` | Workflow `air-schedule-run`, class `ScheduleRun` | One instance per claimed agent-schedule occurrence | R-CF-11 |
| `FLEET_SYNC` | Workflow `air-fleet-sync`, class `FleetSyncBox` | One instance per box in a fleet wave | R-CF-11 |
| `IMAGES` | Images | Replaces sharp and heic-convert. Bound at the entry. The entry 404s `/_next/image`, because OpenNext would otherwise use `IMAGES` for arbitrary URLs and spend the 5k free transformations. The app uses no `next/image` component. `/cdn-cgi/image/*` needs nothing, because it does not reach production Workers (R-CF-09). | R-CF-09 |
| `MEDIA` | R2 `air-media` | Media and build artifacts, without SigV4 | R-CF-09, R-CF-10 |
| private thumb store | R2 or Supabase private bucket | Identity thumbs, kept off the public `air-media`. R-CF-09 names it. | R-CF-09 |
| `SIDECAR` | service → `air-sidecar` | iMessage relay, ffmpeg stitch, optional Tenki relay. The binding is the only way in; there is no header auth (§2.5 C15). | R-CF-03, R-CF-09, R-CF-05 |
| `BUILD` | service → `air-build` | `/api/create/*` compile and build | R-CF-10 |
| `CF_VERSION_METADATA` | version_metadata | Version id for `/api/version`. The SHA itself is the build constant `BUILD_SHA` (§2.5 C5). | R-CF-02, R-CF-13 |
| `define` | `__AIR_BUILD_SHA__`, default `"dev"` | CI passes `--define __AIR_BUILD_SHA__:"<sha>"`; the entry sets `process.env.AIR_BUILD_SHA` (§2.5 C5) | R-CF-02, R-CF-13 |
| `AIR_ENV_00..07`, `AIR_ENV_DIGEST` | secrets (`secrets.required`) | Packed env | R-CF-01 |
| `triggers.crons` | 6 expressions | Matches `vercel.json` | R-CF-11 |
| `limits.cpu_ms` | 60,000 | Starting value, tuned from Workers Logs | R-CF-15 |
| compat flags | + `enable_request_signal`, `global_fetch_strictly_public` | Request abort reaches handlers; same-zone fetches go out as public requests | R-CF-12 (R-CF-07 relies on `enable_request_signal`) |
| `upload_source_maps` | `true` | Source-mapped stack traces in Workers Logs | R-CF-12 (R-CF-15 keeps it) |

- Every item that adds a binding regenerates `apps/web/worker/worker-configuration.d.ts` (`npx wrangler types --env-interface CloudflareEnv worker/worker-configuration.d.ts`) in the same PR. Nobody hand-edits it, and no `cloudflare-env.d.ts` exists (§2.5 C4).
- Queues, R2 buckets and the side Workers exist before `airv2-app` binds them. R-CF-13's `ensure-resources` job and the `workers.yml` deploy jobs for `air-sidecar` and `air-build` run first (§2.5 C18).

Consolidated sketch, for illustration only (§2.5 C10). Each R-CF item owns its own block, and the owner's values win:

```jsonc
{
  "name": "airv2-app",
  "main": "worker/entry.ts",
  "compatibility_date": "2026-10-12",
  "compatibility_flags": ["nodejs_compat", "enable_nodejs_process_v2", "enable_request_signal", "global_fetch_strictly_public"],  // R-CF-12
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "define": { "__AIR_BUILD_SHA__": "\"dev\"" },                     // R-CF-02; CI overrides (R-CF-13)
  "limits": { "cpu_ms": 60000 },
  "upload_source_maps": true,                                       // R-CF-12
  "kv_namespaces": [{ "binding": "HOSTING", "id": "61b51af0f1da4cda8dd6449c845ac01e" }],
  "services": [
    { "binding": "SELF", "service": "airv2-app", "entrypoint": "Internal" },   // R-CF-02 (§2.5 C1)
    { "binding": "SIDECAR", "service": "air-sidecar" },
    { "binding": "BUILD", "service": "air-build" }
  ],
  "queues": { "producers": [{ "binding": "DEFERRED", "queue": "air-deferred" }],
              "consumers": [                                        // R-CF-06 owns these values
                { "queue": "air-deferred", "max_batch_size": 1, "max_retries": 8, "retry_delay": 30,
                  "dead_letter_queue": "air-deferred-dlq", "max_concurrency": 25 },
                { "queue": "air-deferred-dlq", "max_batch_size": 10, "max_retries": 3 } ] },
  "durable_objects": { "bindings": [{ "name": "BOX_LIFECYCLE", "class_name": "BoxLifecycle" },     // R-CF-05
                                    { "name": "CONVERSATION", "class_name": "ConversationDO" }] }, // R-CF-04
  // Append-only, in merge order; never edit or reuse a deployed tag (§2.5 C8).
  "migrations": [{ "tag": "v1-box-lifecycle", "new_sqlite_classes": ["BoxLifecycle"] },      // R-CF-05, P2
                 { "tag": "v2-conversation", "new_sqlite_classes": ["ConversationDO"] }],  // R-CF-04, P3
  "workflows": [
    { "binding": "CREATIVE_JOB", "name": "creative-job", "class_name": "CreativeJob",          // R-CF-08
      "default_retention": { "success_retention": "1 hour", "error_retention": "1 day" } },
    { "binding": "SCHEDULE_RUN", "name": "air-schedule-run", "class_name": "ScheduleRun" },    // R-CF-11; retention per R-CF-11 (§3.5)
    { "binding": "FLEET_SYNC", "name": "air-fleet-sync", "class_name": "FleetSyncBox" }        // R-CF-11; retention per R-CF-11 (§3.5)
  ],
  "images": { "binding": "IMAGES" },
  "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "air-media" }],
  "version_metadata": { "binding": "CF_VERSION_METADATA" },
  "triggers": { "crons": ["* * * * *", "*/5 * * * *", "*/10 * * * *", "15 * * * *", "30 * * * *", "0 */6 * * *"] },
  "secrets": { "required": ["AIR_ENV_00", "AIR_ENV_01", "AIR_ENV_02", "AIR_ENV_03",
                            "AIR_ENV_04", "AIR_ENV_05", "AIR_ENV_06", "AIR_ENV_07", "AIR_ENV_DIGEST"] },
  "vars": { "UPSTREAM_VERCEL": "https://airv2.vercel.app", "SWITCH_HOSTS": "app.wzrd.tech,mini.wzrd.tech,link.wzrd.tech" },
  "observability": { "enabled": true }
  // P4: "routes": [{ "pattern": "app.wzrd.tech", "custom_domain": true }]; P5: + mini, link; P6: "workers_dev": false
}
```

- `AIR_PUBLIC_ORIGIN` (`wrangler.jsonc:14`) is read by no code. R-CF-02 deletes it, and no later item deletes it again. SELF URLs are built inside `selfFetch()` from `env.appOrigin()` (or `env.miniappOrigin()` for mini routes), so middleware host routing still works and the request never leaves the Worker. There is no `self` host, no `x-air-self` or `x-air-cron` marker and no path allowlist (§2.5 C1).
- `UPSTREAM_VERCEL` stays a wrangler `var` as the default (R-CF-02 config), together with `SWITCH_HOSTS`. A `## plain` value in the md file (`env.example.md:480-481`) overrides it at unpack time.
- OpenNext's `WORKER_SELF_REFERENCE` is not needed. Only ISR revalidation queues use it, and this app has no ISR.
- Static assets are served before middleware on every host. So `public/*.sh` (3 files) and `public/vendor/` resolve on `mini.wzrd.tech` and `link.wzrd.tech` too, and they shadow any mini-app slug `vendor`. Before P5, either add `assets.run_worker_first` patterns for those paths or move them under an app-only prefix (R-CF-14).

### 2.3 Workers

| Worker | New or existing | Source | Purpose | Plan features used |
|---|---|---|---|---|
| `airv2-app` | existing (PR #522) | `apps/web` (+ `apps/web/worker/` NEW) | Next app, hosting switch, `Internal` entrypoint for `SELF`, crons, queue consumers, `BoxLifecycle`, `ConversationDO`, and the `CreativeJob`, `ScheduleRun` and `FleetSyncBox` Workflows | `cpu_ms` above the 30 s default, Cron Triggers, Queues, SQLite DOs and alarms, Workflows, Images, R2, KV, service bindings and named entrypoints, Custom Domains, Workers Logs |
| `air-sidecar` | NEW | `infra/workers/sidecar` | Backstop for Node-only deps. Reached only through the `SIDECAR` binding: `workers_dev: false`, no `routes`, no header auth (§2.5 C15). Deployed by its `workers.yml` job before `airv2-app` binds it (§2.5 C18). See the classes below. | **Containers (Paid only)**, container-backed DOs and alarms, secrets from `## secret @air-sidecar` (`env.example.md:495-501`) |
| `air-build` | NEW | `infra/workers/build` | esbuild-wasm (`initialize({wasmModule, worker:false})`), tailwind JS compile, Kit as modules or R2 objects. Has its own 128 MB isolate. `workers_dev: false`. Deployed by its `workers.yml` job before `airv2-app` binds it (§2.5 C18). | `cpu_ms` 300,000, bundled `.wasm` module, R2 |
| `app-switch` | existing (deployed, vendored) | `infra/workers/app-switch` (NEW dir) | Independent kill switch until it is retired in P6. Its `app.wzrd.tech` route is removed at P4. The vendored `src/index.js` is the downloaded bundle, verbatim; its `wrangler.jsonc` has no `routes`, and the live routes are recorded only in its `README.md`. R-CF-13 dry-runs it; every deploy and the retirement are owner-only (§2.5 C19, C22). | KV |
| `air-muse` | existing | `infra/workers/muse` | Calls the control plane through service binding `CONTROL_PLANE`, replacing `fetch(CONTROL_PLANE_ORIGIN)` | DO (SQLite), KV, service binding |
| `air-outbound` | existing | `infra/workers/outbound` | Same switch to `CONTROL_PLANE`. Idle while WfP stays gated. | KV, service binding |
| `air-dispatcher`, `air-dev`, `air-create` | in repo, not deployed | `infra/workers/*` | **Out of scope.** Needs WfP ($25/mo add-on) and stays gated. | — |

`air-sidecar` classes (instance counts per §2.5 C14):

- `ImessageRelay`: lite/basic, `durable_object` scheduling policy, two fixed always-warm instances `relay-0` and `relay-1` (`RELAY_INSTANCES` 2), keep-warm DO alarm, SIGTERM drain.
- `MediaWorker`: standard-1, at most 2 instances, `sleepAfter` 2 min.
- `TenkiRelay`: optional, one instance.

### 2.4 Hosting switch modes

The switch is folded into the `airv2-app` entry (R-CF-02). It keeps every field and status code of app-switch's contract in §1.2: `/_switch` GET and POST, the JSON shapes, `Bearer SWITCH_TOKEN`, and KV `HOSTING` key `target`. Three things change. The compare becomes constant-time. Responses gain additive fields, and POST gains the upstream guard with an optional `force` flag (§2.5 C12). And `/_switch` is answered only on the main host (the first `SWITCH_HOSTS` entry, `app.wzrd.tech`, plus workers.dev until P6); on mini and link, `/_switch` falls through to OpenNext, matching middleware host gating. The admin panel (`gratitude5dee/admin`) does not change. It cannot send `force`, so a forced flip is a `curl` with `{"target":"vercel","force":true}` that the owner runs (§2.5 C22).

- **Header trust:** the public `fetch` strips every client-supplied `x-air-*` header, and `x-forwarded-host`, before anything else (§2.5 C1). `lib/http/origin.ts:57-64` trusts `x-forwarded-host`, which the client controls on Cloudflare (R-CF-02/R-CF-12). The `Internal` entrypoint behind `SELF` never strips and never proxies, so internal traffic needs no marker header.
- **`target=cloudflare`** (the target state from P4 on):
  - Every non-asset request goes to OpenNext.
  - `scheduled()` dispatches every tick, and each cron route does work only while `platform_settings.cron_host='cloudflare'` (R-CF-11's route guard).
  - `defer()` sends to `air-deferred`.
  - `IMESSAGE_TRANSPORT=relay`, or `http` once Photon confirms an endpoint.
- **`target=vercel`** (rollback A):
  - `airv2-app` still answers `/_switch`, `/api/version` and `POST /api/creative/fal-webhook` (§2.5 C1). Everything else on a switch host goes through `proxyToVercel` to `UPSTREAM_VERCEL` (`https://airv2.vercel.app`).
  - `SELF` traffic reaches the `Internal` entrypoint and never the switch, so cron dispatch, queue messages, DO phases and box-lifecycle calls stay on Cloudflare.
  - It ports app-switch's header handling and adds the trusted headers:
    - `x-air-origin-host` (original host).
    - `x-air-client-ip` (from `cf-connecting-ip`), needed because Vercel overwrites `x-forwarded-for`.
    - `x-air-edge-auth: EDGE_PROXY_SECRET`.
    - Optional `x-vercel-protection-bypass`.
  - Vercel trusts the host and client IP only when `x-air-edge-auth` matches, checked by `trustedOriginHost()` in `lib/http/edge.ts` (constant-time, §2.5 C11). Consumers: `middleware.ts:56`, `lib/http/origin.ts:57-64`, `lib/security/limits.ts` `pairAttemptSource`, and the `app/mini/[app]/route.ts` guest rate limit.
  - Vercel takes the in-process paths: `IMESSAGE_TRANSPORT=spectrum`, and `defer()` maps to `after()`. Vercel crons run only if `cron_host='vercel'`.
  - Durable work already in flight on Cloudflare keeps draining there: DO alarms, Workflow instances and queued messages. It stays exclusive through the shared Postgres fences: `flush_jobs`/`claim_flush`, the `creative_jobs` status, and `cron_host` (R-CF-04/06/08/11).
- **Two switches** (§2.5 C13):
  - `HOSTING.target` (request routing, KV) and `platform_settings.cron_host` (job ownership, Postgres) are independent levers. `/_switch` flips only `target`.
  - Cloudflare crons run through `scheduled()` → `SELF` → `Internal`, so they do not depend on the public target. `cron_host=cloudflare` flips at P3 exit (§4), before `target` moves at P4. That is safe because Vercel crons are not running while the Vercel account is blocked.
  - Before the first flip, the owner approves and runs R-CF-11's backlog triage step (§6, §2.5 C22). Weeks-old `flush_jobs`, `agent_schedules` and `content_slots` rows must not fire blindly.
  - Rollback A changes only `target`; crons stay on Cloudflare. `cron_host` moves back to `vercel` only in R-CF-14's rollback B step, or when the failure also breaks the cron routes.
  - The single-valued `cron_host` row guarantees that only one host runs crons at any time.
- **Flip latency:** up to about 30 s of isolate cache plus KV propagation (up to about 60 s), so about 90 s of mixed hosting. Requests can land on both hosts during that window. This relies on the existing `inbound_events` dedupe and claim idempotency.
- **Preconditions for rollback A:**
  - The Vercel account is unblocked, and Vercel crons are disabled until the same-SHA build is live (§1.3).
  - Vercel is deployed at the same SHA. The POST guard probes `UPSTREAM_VERCEL/api/version` and never fetches its own custom domain (§2.5 C12):
    - an unreachable or non-2xx upstream → 409;
    - a 404 counts as a pre-R-CF-02 build and is allowed;
    - a SHA mismatch returns a `warning` and requires `{"force":true}`. A strict same-SHA gate would make rollback impossible while Vercel is frozen at `ce337d1`.
  - `airv2.vercel.app` is reachable without Deployment Protection (verify after the unblock).
- **Failure domain:** rollback A shares airv2-app's failure domain. A startup throw (for example, env-unpack missing its digest) or a bad bundle takes out `/_switch` and the proxy together. In that case the fallbacks, both owner-only (§2.5 C22), are:
  - The owner redeploys the vendored `app-switch` and re-adds its `app.wzrd.tech/*` route from `infra/workers/app-switch/README.md`, because the vendored config has no `routes` (§2.5 C19). The route takes precedence over the Custom Domain, so no DNS change is needed.
  - Rollback B: the owner points DNS back to Vercel. This must ship together with a deploy freeze: the owner sets the repo variable `AIRV2_ROLLBACK_B=true`, which skips the `airv2-app.yml` deploy (§2.5 C21), or the `routes` entry is removed from `wrangler.jsonc`. A non-TTY `wrangler deploy` would otherwise re-take the hostname (`override_existing_dns_record=true`). Rollback B also stops working once the certificate expires on 2026-11-28 (R-CF-14).

### 2.6 What "everything on Cloudflare" means operationally

It holds when all of the following are true:

1. `app.`, `mini.` and `link.wzrd.tech` are Custom Domains on `airv2-app`, with no CNAME to Vercel and no `app-switch` route on any of them. `app-switch` is retired and `workers_dev` is false (P6).
2. `HOSTING.target=cloudflare` and `platform_settings.cron_host=cloudflare`. The `crons` block is gone from `vercel.json`, and Vercel cron jobs are disabled in Settings (P6).
3. No request, cron, background job or webhook executes on Vercel. The Vercel project is kept, not deleted, as a cold rollback target only, and it works only once the owner settles the balance.
4. Every `after()` site whose work can exceed about 25 s runs through `defer()` → Queue, DO or Workflow, and every wait on a Hermes run outside a request goes through `run.finalize` (§2.5 C7). At least 15 modules under `app/` and `lib/` import `after` from `next/server` today (R-CF-06). Nothing relies on `waitUntil` lasting more than 30 s.
5. Node-only dependencies are either replaced (Images binding; esbuild-wasm in `air-build`) or run in `air-sidecar` Containers (gRPC iMessage, ffmpeg, optional Tenki).
6. No server code calls the global `fetch()` on `${env.appOrigin()}/...`. Such calls use `selfFetch()`, which sends the same URL through `SELF` to the `Internal` entrypoint (§2.5 C1, C3). Today `lib/orchestrator/sharedBridge.ts:203-204` still does. `air-muse` and `air-outbound` use `CONTROL_PLANE`.
7. Env values live only in `apps/web/.env.airv2.md` and reach the Worker as packed secrets. `NEXT_PUBLIC_*` values come from GitHub repo variables at CI build time. Nothing is read from Vercel env.
8. `airv2-app` deploys come only from `.github/workflows/airv2-app.yml`, and `/api/version` reports main's SHA (R-CF-13). `air-sidecar` and `air-build` deploy from their `workers.yml` jobs (§2.5 C18).

These dependencies stay off Cloudflare by design:

- Supabase (Postgres and Storage).
- Photon/Spectrum.
- Box API, boxes and Hermes.
- Tenki, for the 2 `tk_` boxes if kept (R-CF-05).
- fal, GMI and model providers.
- Stripe, GitHub App, AgentMail, Composio, Cal.com and Coinbase.
- Vercel AI Gateway: `lib/jev/transport.ts:49-53` calls `env.aiGatewayBase()`, which defaults to `ai-gateway.vercel.sh` (`lib/env.ts:390-391`). It may be billed to the blocked team (verify). R-CF-12 decides.

Separate Cloudflare products on the same account (out of scope, but sharing its allotments):

- wzrdmail (`wzrdmail-*`; `WZRDMAIL_BASE_URL` defaults to `https://api.wzrd.tech`, `lib/env.ts:467`, MCP at :470).
- WZRD Connect (`wzrd-connect`; `connector.wzrd.tech`, `lib/env.ts:491`).
- Muse (`air-muse`; `muse.wzrd.tech`, `lib/env.ts:746`).

From airv2-app, a same-zone `fetch()` to another Worker works only if the target is a Custom Domain, or through `global_fetch_strictly_public` (https://developers.cloudflare.com/workers/platform/limits/#worker-to-worker-subrequests). Check how each host is attached in the P1 workers.dev smoke (verify).

### 2.5 Cross-cutting conventions (normative)

These rules override anything an individual R-CF item says. Where an item names a different file, helper or setting, this section wins. Each shared piece has exactly one owner; other items import it.

**C1. SELF calls never touch the hosting switch.** (Owner: R-CF-02.)
- `airv2-app` exports a named entrypoint, `export class Internal extends WorkerEntrypoint<CloudflareEnv>`, in `apps/web/worker/entry.ts`. Its `fetch(req)` runs `applyEnv(this.env)` and then calls the OpenNext handler directly. It never runs the switch or `proxyToVercel`, and it never strips `x-air-*` headers.
- The binding is `{ "binding": "SELF", "service": "airv2-app", "entrypoint": "Internal" }`. Every internal caller uses `env.SELF` through `selfFetch()` (C3): R-CF-04 DO phases, R-CF-05 lifecycle, R-CF-06 queue consumer, R-CF-11 `scheduled()`, R-CF-12 gateway self-call.
- Internal URLs use the real public host so that middleware host routing works: `new URL(path, env.appOrigin())`, or `env.miniappOrigin()` for mini routes. The request never leaves the Worker.
- There is no `self` host and no `x-air-self` or `x-air-cron` marker. No path allowlist is used for internal traffic.
- Routes that require the cron bearer (`/api/cron/*`) still receive `Authorization: Bearer ${CRON_SECRET}` from the caller.
- The **public** `fetch` strips every inbound `x-air-*` header before anything else.
- The only public path that is served by Cloudflare whatever the target is the fal webhook, `POST /api/creative/fal-webhook` (R-CF-08). It is listed explicitly in R-CF-02's handler, ahead of the switch branch.
- `AIR_PUBLIC_ORIGIN` is deleted from `wrangler.jsonc` in R-CF-02 only. No code reads it, and no later item deletes it again.

**C2. One runtime-environment helper.** (Owner: R-CF-12, P1.)
- `apps/web/lib/runtime/platform.ts` exports:
  - `onWorkerd(): boolean`
  - `runtimeHost(): "cloudflare" | "vercel" | "node"`
  - `setCfEnv(env)`
  - `cfEnv(): CloudflareEnv | null`, which returns `globalThis[Symbol.for("air.cfEnv")] ?? getCloudflareContext({ async: false })?.env ?? null` and swallows the throw outside a request
  - `cfWaitUntil(p)`
- No other module may be named `lib/runtime/host.ts` or define `isWorkerd`, `cfContext`, `cloudflareContext` or `requestScope` aliases.
- Code that can run inside a DO, a Workflow, `queue()` or `scheduled()` must use `cfEnv()`, never `getCloudflareContext()` directly.

**C3. Every entrypoint applies env first.** (Owner: R-CF-02.)
- `applyEnv(env)` is exported from `apps/web/worker/env-unpack.ts`. It unpacks the env packs, using the digest-based overwrite from R-CF-01, and calls `setCfEnv(env)`.
- It is the first statement of every entrypoint:
  - the public `fetch`, `Internal.fetch`, `scheduled` and `queue`;
  - every DO `fetch`, `alarm` and RPC method;
  - every Workflow `run()`.
- `selfFetch(path, init?, opts?)` lives in `apps/web/lib/http/self.ts` (R-CF-12). On workerd it calls `cfEnv().SELF.fetch(new URL(path, env.appOrigin()), init)`; elsewhere it does an absolute `fetch` to `env.appOrigin()`.

**C4. Generated env types.** (Owner: R-CF-02, checked in CI by R-CF-13.)
- `apps/web/worker/worker-configuration.d.ts` is generated by `npx wrangler types --env-interface CloudflareEnv worker/worker-configuration.d.ts` and committed.
- Any item that adds a binding regenerates it in the same PR. Nobody hand-edits it, and no `cloudflare-env.d.ts` exists.

**C5. One build SHA.** (Owner: R-CF-02; read by R-CF-12.)
- Wrangler `define` substitutes `__AIR_BUILD_SHA__`, which CI sets to `--define __AIR_BUILD_SHA__:"<sha>"` (R-CF-13) and which defaults to `"dev"`.
- `apps/web/worker/build-info.ts` exports `BUILD_SHA`, and the entry sets `process.env.AIR_BUILD_SHA = BUILD_SHA`.
- `env.buildSha()` in `lib/env.ts` (R-CF-12) returns `process.env.AIR_BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null`. No `lib/build-constants.d.ts` exists.

**C6. One Hermes run reader.** (Owner: R-CF-06.)
- `getRun(target, runId)` lives in `apps/web/lib/hermes/client.ts`. It returns `Promise<HermesRunStatus | null>`, and a 404 becomes `null`.
- Its zod schema uses `.passthrough()` with `run_id`, `status`, `created_at`, `updated_at`, `output`, `error` and `last_event`, which is the superset R-CF-04 needs.
- It is served by pinned Hermes `GET /v1/runs/{id}` (R-CF-04 cites `api_server_runs.py`). No item adds a hermes-host route for it.

**C7. One deferred-work registry.** (Owner: R-CF-06.)
- The API is `defer(kind, payload, { key, delaySeconds? })` from `apps/web/lib/runtime/defer.ts`. `key` is required and serves as the idempotency key.
- There is one static table, `apps/web/lib/runtime/deferHandlers.ts`. Its entries are `{ schema, maxSeconds, maxHops, vercelInline, run }`.
- Other items add rows to that table and import their `run` functions from their own modules. They never create a second registry.
- Kinds are named `<area>.<verb>`, for example `run.finalize`, `cron.publish.user` and `create.build`.
- Queue settings belong to R-CF-06:
  - consumer `air-deferred`: `max_batch_size` 1, `max_retries` 8, `retry_delay` 30, `max_concurrency` 25, `dead_letter_queue` `air-deferred-dlq`;
  - a second consumer for `air-deferred-dlq`.
- `run.finalize` (R-CF-07) is the only mechanism that waits for a Hermes run to finish outside a request. It takes pluggable continuations via `then: { type, ... }`.
  - R-CF-10 registers the `create.turn_done` continuation. It posts a correlated `turn_done:<role>:<round>` event and calls `closeCreateRunRow`.
  - That replaces `after(consumeAndReport)` at `app/api/internal/create/turn/route.ts:172`. No `create.turn.report` kind exists.

**C8. Durable Object classes and migrations.**
- Each class is added by its owning item. The tags are append-only, in merge order:
  - `v1-box-lifecycle`: `BoxLifecycle`, binding `BOX_LIFECYCLE` (R-CF-05, P2).
  - `v2-conversation`: `ConversationDO`, binding `CONVERSATION` (R-CF-04, P3).
  - Later classes (R-CF-11, R-CF-03 relay DOs on `air-sidecar`) take the next `vN-<name>` on their own worker.
- `BoxLifecycle` exposes:
  - a blocking `wake(boxId)` for request paths;
  - a non-blocking `wakeStep(boxId): { state: "ready" | "waking" | "failed", nextCheckMs }`, which runs one probe per call. Alarm-driven callers, such as R-CF-04's `wake` phase, use it.
- `ConversationDO` exposes `deliver(parts, { key })`: the per-chat, ordered outbound lane. R-CF-08's iMessage continuation and R-CF-11's schedule delivery send through it.

**C9. Workflows.**
- Names and retention are set by the owning item. `CreativeJob` is Workflow `creative-job`, retention success 1 h and error 1 day (R-CF-08). `create-job` is already taken by `air-create`.
- Instance IDs match `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$` and are at most 100 characters.
- Every step sets an explicit `WorkflowStepConfig`. A billed or side-effecting step has a durable fence written before the side effect, because the engine can restart a step even with `retries: { limit: 0 }`.

**C10. The `wrangler.jsonc` sketches are illustrative.**
- §2.2 and R-CF-02's end-state config show shape only. Each block (queues, DOs, Workflows, containers, crons) is defined by its owning item, and that item's values win.

**C11. Edge-proxy trust.** (Owner: R-CF-02.)
- There is one module, `apps/web/lib/http/edge.ts`, with `trustedOriginHost(headers): string | null`. It compares sha256 digests (WebCrypto `crypto.subtle.digest`) against `EDGE_PROXY_SECRET` in pure-JS constant time, with no `node:` imports, because middleware runs in the Edge runtime. `/_switch` in the worker entry uses `node:crypto` `timingSafeEqual` instead, which `nodejs_compat` supports.
- Middleware and `lib/http/origin.ts` use it. No `edge-proxy.ts` exists.

**C12. Switch semantics.** (Owner: R-CF-02.)
- `POST /_switch {target:"vercel"}` probes `UPSTREAM_VERCEL/api/version`. An unreachable or non-2xx upstream returns 409. A 404 counts as a pre-R-CF-02 build and is allowed.
- A SHA mismatch returns a `warning` and requires `{ "force": true }`. A strict same-SHA gate would make rollback impossible while Vercel is frozen at `ce337d1`.
- §1, §2.4, R-CF-14 and §5 use these semantics.

**C13. Crons and the switch are independent.**
- `cron_host` (R-CF-11) and `HOSTING.target` (R-CF-02) are separate levers.
- Cloudflare crons run through `scheduled()` → `SELF` (C1), so they do not depend on the public target.
- `cron_host=cloudflare` may flip at P3 exit, before P4, because Vercel crons are not running while the Vercel account is blocked. The single-valued `cron_host` row guarantees that only one host runs crons.
- Before the first flip, R-CF-11 runs the backlog triage step. The owner approves it (§6). Weeks-old `flush_jobs`, `agent_schedules` and `content_slots` rows must not fire blindly.

**C14. Container instances.**
- `ImessageRelay` (R-CF-03) uses the `durable_object` scheduling policy, with two fixed always-warm instances `relay-0` and `relay-1`.
- `MediaWorker` (R-CF-09) has at most 2 instances and `sleepAfter` 2 min.
- `TenkiRelay` (R-CF-05, optional) is one instance.
- §3 cost math and R-CF-15 alerts use exactly these numbers.

**C15. iMessage idempotency keys.**
- Every key is built with R-CF-03's `imessageKey(...parts)`. Callers pass parts, for example `("creative", jobId, "attachment")`, and never format keys themselves.
- The `air-sidecar` relay is reachable only through the `SIDECAR` service binding. There is no header auth.

**C16. Log event names.**
- R-CF-15's table of structured JSON log events (`{ msg: "<area>.<event>", ... }`) is canonical, for example `env.unpack`, `deferred.done|again|dup|dead|error`, `cron.dispatch`, `switch.flip` and `imessage.send`.
- Producing items emit exactly those names. Acceptance criteria and alerts match on `msg`.

**C17. Build target flag.** (Owner: R-CF-13.)
- `npm run cf:build` sets `AIR_BUILD_TARGET=cloudflare` for `next build`. This is build-time only, not a Worker var.
- R-CF-10's `next.config.ts` aliasing keys on it.
- R-CF-13's size gate fails if the bundle contains `esbuild/lib/main.js` or `tailwindcss/dist/lib`.

**C18. Resources and side Workers exist before they are bound.** (Owner: R-CF-13.)
- An `ensure-resources` job in `.github/workflows/airv2-app.yml` runs before the deploy, using the repo's existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Each step is idempotent: `wrangler queues create … || true`, `wrangler r2 bucket create … || true`.
- `.github/workflows/workers.yml` gains deploy jobs for `air-sidecar` and `air-build`, plus a dry-run-only check for the vendored `app-switch`.
- `airv2-app` deploys only after the Workers it binds exist.

**C19. `app-switch` vendoring.** (Owner: R-CF-02.)
- `infra/workers/app-switch/src/index.js` holds the downloaded bundle, verbatim. `infra/workers/app-switch/wrangler.jsonc` holds the KV `HOSTING` binding and the vars `UPSTREAM_CF` and `UPSTREAM_VERCEL`, with no `routes`.
- The live routes are recorded only in `infra/workers/app-switch/README.md`, so a deploy can never re-take a hostname.
- R-CF-13 adds the dry-run check. R-CF-14 retires the live script after the soak.
- Any `app-switch` deploy is owner-only.

**C20. `env.example.md` is hand-edited.**
- No generator is committed. Items that add env names edit `apps/web/env.example.md` directly, in the right section with the tag comments.
- `apps/web/lib/env.example.test.ts` (R-CF-01) enforces format and completeness.

**C21. Rollback B freeze variable.**
- The repo variable is `AIRV2_ROLLBACK_B` (`true` means frozen), from R-CF-13.
- R-CF-14's runbook sets and unsets that exact name. No `AIRV2_DNS_ROLLBACK` exists.

**C22. Owner-only operations.** Devin implements, tests and documents these, but never runs them against production:
- writes to KV namespace `61b51af0f1da4cda8dd6449c845ac01e`, or `POST /_switch` on a deployed Worker. Tests use local KV or a test namespace;
- DNS record changes and custom-domain attaches;
- `cf:env push` and `push --prune-legacy`;
- `app-switch` deploys and its retirement;
- deleting R2 objects or buckets, and disabling CI deploy jobs;
- the cron backlog triage of C13.

§6 lists each operation.

**C23. Migrations.**
- Migration files in this spec are written `supabase/migrations/NNNN_<name>.sql`. Each PR takes the next free number when it merges. The highest today is `0140`.
- Migrations that create extensions are guarded with `pg_available_extensions`, because CI applies them to plain `postgres:15`.

## 3. Limits, costs and budgets (Workers Paid)

Workers Paid costs $5/mo and is account-wide. It lifts all 34 scripts on `e8f42c0430906e1515a2af01d5c1d2d1` out of the Free quotas. Free was evaluated and rejected (rationale in §0). The spec does not design around Free-only limits (10 ms CPU, 50 subrequests, 100k req/day, 3,000 steps/day, 5 crons, 64 vars).

Sources:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workflows/reference/limits/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/containers/platform/pricing/

### 3.1 Limits the design relies on

| Limit | Workers Paid value | Design dependency | R-CF |
|---|---|---|---|
| CPU per HTTP invocation | 30 s default; `limits.cpu_ms` up to 300,000 | airv2-app starts at 60,000 and air-build at 300,000. Each SELF or service-binding hop is its own invocation with its own CPU limit. It is billed as one request, with CPU summed across Workers. | R-CF-02, R-CF-10, R-CF-15 |
| CPU per Cron Trigger | 30 s (interval under 1 h), 15 min (1 h or more) | `scheduled()` only dispatches. Jobs run as SELF → `Internal` HTTP invocations under `cpu_ms`. | R-CF-11 |
| Wall time, HTTP | Unlimited while the client is connected. Runtime updates give in-flight requests and streams up to 20 min of grace (changelog 2026-10-12). | SSE relays (5 routes) stay as they are. Clients reconnect. | R-CF-07 |
| `ctx.waitUntil` / `after()` | **30 s after the response, on both plans** | Anything longer goes through `defer()` | R-CF-06 |
| Wall time, cron / queue consumer / DO alarm | 15 min each | A SELF job lives only as long as its caller awaits it. `scheduled()` must `await Promise.allSettled(...)` over its `selfFetch()` calls, never `waitUntil` them. That gives each job up to the 15 min cron wall (the sweep's 800 s fits). Per-item work beyond that fans out. | R-CF-04, R-CF-06, R-CF-11 |
| Memory | **128 MB per isolate**, shared by concurrent requests in the isolate. The `/tmp` VFS counts against it. | No 100 MB buffers (`lib/assets/pipeline.ts:58`). esbuild runs in a separate Worker. | R-CF-09, R-CF-10 |
| Subrequests | 10,000 per invocation by default, up to 10M via `limits.subrequests`. Service-binding calls count. At most 32 Worker invocations per top-level request. | Creative SSE's 480 polls fit, and so does fal/GMI polling | R-CF-07, R-CF-08 |
| Simultaneous outgoing connections | 6 per invocation awaiting headers (service-binding calls excluded) | Wide `Promise.all` fetch fan-outs queue behind this | — |
| Vars + secrets | 128 per Worker, 5 KB each | 217 names → 9 packed secrets | R-CF-01 |
| Worker size / startup | 64 MiB uncompressed, no compressed cap. The global scope must run within 1 s. | 34 MB today. R-CF-13's CI size gate, which also fails if the bundle contains `esbuild/lib/main.js` or `tailwindcss/dist/lib` (§2.5 C17). Nothing heavy at module scope. | R-CF-13, R-CF-12 |
| Static assets | 100,000 files per version, 25 MiB per file. Asset hits never invoke the Worker and are free. | 1,299 files | — |
| Cron Triggers | 250 per account | +6 on airv2-app. Earlier research found the 5 Free slots in use (`zap-cron` among them; verify per script). That does not matter at 250. | R-CF-11 |
| Workflows | See the list below the table | `CreativeJob` (Workflow `creative-job`) and R-CF-11's `ScheduleRun` and `FleetSyncBox`, each with explicit `WorkflowStepConfig`, durable pre-side-effect fences, sealed step outputs and explicit `default_retention` (§2.5 C9) | R-CF-08, R-CF-11 |
| Queues | Message at most 128 KB (`sendBatch` at most 100 messages / 256 KB); at-least-once delivery, unordered; retention 4 days by default (up to 14) | `air-deferred` and its DLQ `air-deferred-dlq`, with R-CF-06's consumer settings (§2.5 C7). Never used for per-chat bubble ordering; that is `ConversationDO.deliver()` (§2.5 C8). | R-CF-06, R-CF-03 |
| Durable Objects | Single-threaded per object; one alarm per object (`setAlarm` replaces it); alarm wall 15 min. Duration billed wall-clock at 128 MB while the object is in memory and cannot hibernate. Since compat date 2026-10-01, pending I/O also keeps the DO in memory, for up to 15 min per operation: service-binding calls, `fetch`, `waitUntil`, timers, `ctx.container.monitor()`. | `ConversationDO`, `BoxLifecycle`; keep-warm alarms on container DOs | R-CF-04, R-CF-05, R-CF-03 |
| Containers | See the list below the table | `ImessageRelay` (2 fixed warm instances, `relay-0` and `relay-1`), `MediaWorker` (at most 2, `sleepAfter` 2 min), optional `TenkiRelay` (1) (§2.5 C14) | R-CF-03, R-CF-09, R-CF-05 |
| Images | 5,000 unique transformations/month on Images Free. Beyond that, new transformations fail with 9422 unless Images Paid is bought. Binding calls are billed as unique transformations; `.info()` is free. | Replaces sharp and heic-convert. Needs the 9422 fallback, and the entry blocks `/_next/image`. | R-CF-09 |
| KV | Eventually consistent (about 60 s); 1 write/s per key | `HOSTING` is cached for 30 s per isolate | R-CF-02 |
| Same-zone fetch | A Worker fetching its own Custom Domain gets 522. Fetching another Worker works only if it is on a Custom Domain, or with `global_fetch_strictly_public`. | `SELF` / `selfFetch()`; §2.6 same-zone hosts | R-CF-12 |

Workflows limits:

- Step CPU follows `cpu_ms`, up to 5 min. Step wall time is unlimited.
- 10,000 steps per instance by default, up to 25,000.
- 1 MiB per non-stream step result and per event. 1 GB state per instance.
- 50,000 concurrent instances. Creation rate: 300/s per account and 100/s per Workflow.
- Instance IDs match `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$`, at most 100 chars. `create()` throws on an existing ID.
- Step defaults: 5 retries and a 10 min timeout per attempt.
- Retention: Workflows created on or after 2026-09-10 default to 7 days, max 30.

Containers limits:

- Paid only.
- Instance types: lite (1/16 vCPU, 256 MiB, 2 GB), basic (1/4, 1 GiB, 4 GB), standard-1 (1/2, 4 GiB, 8 GB).
- `max_instances` defaults to 20. The `durable_object` scheduling policy (R-CF-03's `ImessageRelay`) takes no `max_instances`.
- No uptime guarantee: SIGTERM, then up to 15 min, then SIGKILL, on host restarts and rollouts.
- Cold start 1-3 s or more.
- The `Container` class default `sleepAfter` is 10 min.

### 3.2 Limits that still bind on Paid

1. **`waitUntil` is 30 s.** Paid does not extend it. This forces `defer()` → Queue/DO/Workflow for the iMessage flush, chat creative jobs, `internal/create/turn`, onboarding long tasks, stream consumers and any long gateway metering (R-CF-06). Waiting for a Hermes run outside a request goes only through `run.finalize`; `internal/create/turn` uses R-CF-10's `create.turn_done` continuation (§2.5 C7).
2. **128 MB memory per isolate.** It is the same on Paid, and the isolate's loaded code takes part of it. Stream or bound whole-file hashing, zips and media ingest, and keep esbuild in `air-build` (R-CF-09, R-CF-10). Watch Workers Logs for the `exceededMemory` outcome.
3. **Node-only dependencies,** on any plan:
   - No `child_process` (ffmpeg-static, native esbuild).
   - No native addons (sharp).
   - No runtime WASM compile from bytes. heic-convert/libheif crashes at module evaluation.
   - `node:http2` is a stub whose `connect()` throws. So every gRPC call fails for `spectrum-ts`, `@photon-ai/advanced-imessage/grpc` and the `@tenkicloud/sandbox` data plane. The Tenki package is statically imported by `lib/box/client.ts:20`.
   - `fs` is a VFS. `/bundle` holds only modules, so Create Kit disk reads fail.
   - Remedies: R-CF-03, R-CF-05, R-CF-09, R-CF-10.
4. **Durable-execution semantics:**
   - The Workflow engine may re-run a step even with `retries: 0`.
   - Queues deliver at least once and out of order.
   - A DO has one alarm.
   - Containers get SIGTERM'd on host rollouts.
   - So every side effect needs an idempotency key or a durable fence (R-CF-03/04/06/08; §2.5 C9, C15).
5. **15 min wall** for cron, queue consumer and alarm invocations, and for any SELF job awaited by them. Per-item work fans out (R-CF-11).
6. The table above also covers: same-zone fetch rules (522 on self), 128 vars, 6 concurrent connections awaiting headers, the 1 s startup budget, and the 64 MiB bundle cap.

### 3.3 Monthly cost estimate

Container unit prices from CF docs. Containers are billed per 10 ms of running time:

- Memory: $0.0000025/GiB-s, which is $0.009/GiB-h.
- Disk: $0.00000007/GB-s, which is $0.000252/GB-h.
- vCPU: $0.000020/vCPU-s, billed on active use only.
- Included per account per month: 25 GiB-h, 200 GB-h and 375 vCPU-min (22,500 vCPU-s). The memory and disk allotment is worth about $0.275.
- Memory and disk are billed on the provisioned size while running, idle time included, until `sleepAfter`.

Container scenarios (instance counts per §2.5 C14):

| Scenario | Memory | Disk | Total |
|---|---|---|---|
| 1 lite, always on (730 h) | 182.5 GiB-h = $1.64 | 1,460 GB-h = $0.37 | $2.01 gross, **about $1.75 net** of the allotment (matches the contract) |
| 1 basic, always on | 730 GiB-h = $6.57 | 2,920 GB-h = $0.74 | $7.31 gross, **about $7.03 net** |
| `ImessageRelay` × 2 lite | — | — | **about $3.75/mo** |
| `ImessageRelay` × 2 basic | — | — | **about $14.35/mo** |

- Relay CPU is billed on active use only and is near zero while idle. Even 5% of 1/16 vCPU on 2 instances is about 16k vCPU-s, which is under the allotment.
- `MediaWorker` (standard-1) per freeze stitch, assuming about 60 s of work plus 120 s of `sleepAfter`:
  - Memory: 4 GiB × 180 s = $0.0018.
  - Disk: 8 GB × 180 s = $0.0001.
  - CPU: 0.5 vCPU × 60 s = 30 vCPU-s, which is $0.0006 once past the allotment.
  - Total: **about $0.0025 per stitch**, so $0.25 per 100 and $2.50 per 1,000. Cold starts add provisioned time.
- Optional `TenkiRelay` (lite, always on, one instance): **+$2.01**.
- Container egress: 1 TB/month included in North America and Europe, then $0.025/GB.

**Container-backed DO duration.** Each container is driven by a DO. Since compat date 2026-10-01, a pending `ctx.container.monitor()`, `waitUntil` or service-binding call keeps that DO in memory and billed. Keep-warm alarms re-arm it. So 2 always-warm relays most likely bill continuous DO duration: 2 × 0.125 GB × 2,628,000 s ≈ **657k GB-s/month**. That is over the 400k included. Billable usage (usage minus the 400k included) is rounded **up** to the next 1M GB-s, so it bills **$12.50**. `ConversationDO` turns and `BoxLifecycle` wakes (pending fetches and alarms while a Hermes run polls or a box wakes) add to the same meter. A second unit ($25) starts only above 1.4M GB-s in total (400k included + 1M), which is about 743k GB-s more than the relays alone. Treat one unit as the expected case (verify after 7 days in the Durable Objects metrics).

Account estimate at today's scale. The traffic figure is the design-time estimate for about 20 active users; verify it in Analytics.

| Item | Assumption | Included in Paid | Est. extra / month |
|---|---|---|---|
| Subscription | account-wide | — | **$5.00** |
| Workers requests | 0.5-1M dynamic + 1,924 `scheduled()` invocations/day (about 58k) + queue, DO and Workflow invocations | 10M | $0 |
| Workers CPU | about 1M × 15-40 ms + 4,804 jobs/day × about 50 ms ≈ 20-50M CPU-ms | 30M CPU-ms ($0.02 per extra million) | $0-1 |
| DO requests | `ConversationDO` + `BoxLifecycle` + container DOs + alarms, under 1M | 1M ($0.15 per extra million) | $0 |
| DO duration | 2 warm relay DOs (about 657k GB-s) + turns and box wakes | 400k GB-s; billable usage rounded up to 1M units at $12.50 | **$12.50** (verify); $0 only if container DOs prove eligible for eviction |
| DO SQLite | small | 25B rows read, 50M rows written, 5 GB-month | $0 |
| Workflows | at most 5k `CreativeJob`s × at most 20 steps = 100k steps, plus R-CF-11's `ScheduleRun`/`FleetSyncBox` steps (verify) | 500k steps ($0.80 per 100k); 1 GB-month ($0.20/GB-month) | $0 |
| Queues | at most 100k messages × 3 ops | 1M ops ($0.40 per extra million) | $0 |
| KV (`HOSTING`) | at most 1 read per isolate per 30 s | 10M reads | $0 |
| R2 (`air-media`) | existing usage (verify) | 10 GB-month; 1M Class A; 10M Class B; egress free | about $0 |
| Images | under 5k unique transformations | 5k (Images Free) | $0. Beyond that, Images Paid at $0.50 per 1,000. |
| Containers | 2 lite relays + 100 stitches | allotment as above | about $4.00 |
| Workers Logs | `head_sampling_rate` 1, 2-5M events | Until 2026-11-30: 20M events (+$0.60/M). From 2026-12-01: 50 GB ingestion + 10 GB-month per billing cycle ($0.25/GB, $0.10/GB-month), shared with Container logs | $0 |
| **Total** | | | **about $22-24/month expected; about $9-11 if container DOs prove eligible for eviction** |

High case: about $54/month.
- Base subscription: $5.
- Basic relays: $14.35.
- `TenkiRelay`: $2.01.
- 1,000 stitches: about $3.
- CPU overage: $2.
- 10k image transformations: $2.50.
- Two rounded units of DO duration (over 1.4M GB-s): $25.

Risks to the estimate:
1. **DO duration.** This is the dominant variable, and it is billed in 1M GB-s steps of $12.50. To reduce it:
   - Do not hold `monitor()` or long service-binding calls open from relay DOs longer than needed.
   - Keep `ConversationDO` waits on alarms, not pending fetches.
   - Trading the 2 always-warm relays of §2.5 C14 for 1 warm relay plus a cold standby is an owner decision (§6). Until the owner makes it, the design and this estimate use 2.
2. **Shared allotments.** The included amounts are shared by all 34 scripts (wzrdmail-*, fye-*, tha-bay-*, zap-*, …). Check their usage before relying on the headroom.
3. **Images Paid is a separate opt-in,** and buying it is an owner decision (§6). On Images Free, transformation number 5,001 and later fail with 9422. R-CF-09 must fall back to the original image.

### 3.4 How to check usage against the included allotments

- Dashboard: Billing → Billable Usage gives per-product meters against the included amounts (verify the menu path). Observability usage also appears there from 2026-12-01.
- Product pages:
  - Workers & Pages → `airv2-app` → Metrics: requests, CPU time, and errors by outcome (`exception` vs `exceededCpu` vs `exceededMemory`).
  - Durable Objects: requests, duration GB-s, SQLite storage. Check the `ImessageRelay`/`MediaWorker` namespaces separately from `ConversationDO` and `BoxLifecycle`.
  - Workflows → `creative-job` (`CreativeJob`), `air-schedule-run` and `air-fleet-sync`: steps, storage.
  - Queues → `air-deferred` and `air-deferred-dlq`: operations, backlog.
  - Containers: instance running time per class.
  - Images: unique transformations.
- GraphQL Analytics API:
  - `workersInvocationsAdaptive`: sum `requests` and `cpuTime`, grouped by `scriptName`, across all 34 scripts.
  - DO, Queue and Workflow datasets (`stepCount` for Workflows) cover the rest (verify dataset names).
  - R-CF-15 automates a weekly report.

### 3.5 Budgets and guardrails (implemented by R-CF-15)

- **CPU caps:** `airv2-app` `limits.cpu_ms` 60,000 and `air-build` 300,000. Raise them only with per-route evidence from Workers Logs. Keep `limits.subrequests` at the 10,000 default as a runaway guard.
- **Container caps** (§2.5 C14; R-CF-15 uses the same numbers):
  - `ImessageRelay`: 2 fixed instances, `relay-0` and `relay-1`, from `RELAY_INSTANCES` 2 in code (R-CF-03). The `durable_object` scheduling policy takes no `max_instances`; only R-CF-03's `default`-policy fallback sets `max_instances` 3.
  - `MediaWorker`: `max_instances` 2, `sleepAfter` 2 min (`infra/workers/sidecar/wrangler.jsonc`, R-CF-09).
  - `TenkiRelay`: 1 instance, optional (R-CF-05).
  - `BuildContainer`: `max_instances` 3 (basic), only if R-CF-10's container fallback is deployed.
  - A cap is the cost ceiling if `sleepAfter` fails: 2 standard-1 `MediaWorker` instances running all month cost about $55 in memory and disk (vCPU is billed only while active), plus their DO duration. Alert when `MediaWorker` running time exceeds 10 h/day.
- **DO duration:** alert when month-to-date DO duration passes 1.3M GB-s. The second billable unit starts above 1.4M GB-s (400k included + 1M).
- **Retention and retries:**
  - Workflows: explicit `default_retention` of 7 days or less. `creative-job` uses success 1 h and error 1 day (R-CF-08).
  - `air-deferred`: `max_retries` 8 plus the DLQ `air-deferred-dlq`, which has its own consumer (R-CF-06, §2.5 C7).
  - Logs: `head_sampling_rate` 1 until P4 is stable, then 0.1-0.25. Ingestion is metered per GB from 2026-12-01.
- **Spend targets:** expect about $22-24/month (about $9-11 if container DOs prove eligible for eviction; §3.3). Budget alerts (R-CF-15 A9) at $25 and $30. Above $45, review DO duration first, then container running time, image transformations and CPU outliers.

## 4. Rollout plan

Rules:
- Run one phase at a time. A phase's exit is the next phase's entry.
- Each §6 owner action names the phase it blocks.
- A PR merges only after every item on its "Depends on." line.
- A side Worker, queue or bucket exists before the airv2-app PR that binds it merges (§2.5 C18):
  - R-CF-13's `ensure-resources` job creates the queues and buckets.
  - `workers.yml` deploys `air-sidecar` and `air-build`.
  - airv2-app deploys only after the Workers it binds exist.
  - The owner runs `cf:env -- push --worker <name>` once that Worker is deployed (§6.8).
- Steps marked owner are §2.5 C22 operations (§6.21). Devin implements and tests them locally (local KV, a test namespace, `wrangler dev`) and puts the command and its expected output in the PR. No remote `HOSTING` write and no `POST /_switch` on a deployed Worker happen before P4 T0.
- Vercel has most likely been down for dynamic paths since about 2026-10-11 (medium confidence; the owner should confirm with an external `curl`). Each phase therefore restores service rather than risking it. Keep soaks short, except where shared state could run twice (crons, publish).

| Phase | Ships | Entry | Exit (all must hold) |
|---|---|---|---|
| **P0 Owner prerequisites** | Nothing from Devin | Spec merged | See below |
| **P1 Platform** | R-CF-01, R-CF-12, R-CF-02 (which includes the vendored `app-switch`, §2.5 C19), R-CF-13, R-CF-15 (config, A1–A3, A9). R-CF-14.1a (WfP deploy gating) at any point. | P0 exit (account on Paid) | See below |
| **P2 Node-only dependencies** | R-CF-03 first, then R-CF-05 and R-CF-09 | P1 exit; A1–A3 and A9 live; §6 items 10 (P2 scopes), 11 and 13 done | See below |
| **P3 Durable background work** | R-CF-06 first; then R-CF-04 and R-CF-07; then R-CF-11, R-CF-08 and R-CF-10. R-CF-10 is here because it needs R-CF-06's `defer` and R-CF-07's `run.finalize` continuation (§2.5 C7). A5 lands with R-CF-06 and A4 with R-CF-11. `imessage_turn_engine` stays `after`, with no canary, until R-CF-08 has merged. R-CF-14.1b at any point after R-CF-01 and R-CF-13. | P2 exit; §6 item 10 (P3 scopes) done; §6 item 15 done before the R-CF-10 merge | See below |
| **P4 app.wzrd.tech** | R-CF-14.2 | See below | §5 checks 1–5, 7–12 and 15–22 green on the app host; 24 h with A1–A3 silent and 1101 + 1102 < 0.1 %; tapback `within_sla` on ≥ 95 % of warm turns over those 24 h (R-CF-03, Q6); no `x-vercel-id` |
| **P5 mini.wzrd.tech, then link.wzrd.tech** | R-CF-14.3 (`vendor` reservation already merged in 14.1b) | P4 exit plus at least 2 h clean (mini cards are dead on Vercel, so do not wait longer); `LINK_HOST_ENABLED=true` pushed | §5 checks 6, 13 and 14 green; 48 h clean on all three hosts |
| **P6 Cleanup** | R-CF-14.4, the R-CF-05 and R-CF-10 P6 cleanups, R-CF-15 tuning | P5 exit; at least 7 days with `cron_host=cloudflare` | See below |

**P0 exit:**
- The account is on Workers Paid.
- The Photon email has been sent. No answer is required; the relay is the P2 path.
- The `SWITCH_TOKEN` value is known.
- Vercel Cron Jobs are disabled before any unblock (§6.3). Verify that a blocked team can save the setting. If it cannot, do not unblock until it can. This condition gates the Vercel unblock, not P1.
- `apps/web/.env.airv2.md` is filled in. Validation with `cf:env -- check` waits for R-CF-01 in P1.
- The `tk_` box decision is recorded.
- The domain renewal or transfer has started.

**P1 exit:**
- CI deploys every main SHA.
- `/api/version` on workers.dev equals the main SHA.
- `npm run cf:env -- check` passes (owner-run, §6.20).
- workers.dev returns 200 for `/`, `/login`, `/home`, `/approve/<id>`, `/mini`, `/mini/create` and `/api/store/search`. That includes the paths behind PR #522's 500s, and their cause is classified through Q2.
- The vendored `app-switch` dry-runs in `workers.yml` (§2.5 C19).
- A secret rotation is picked up without a redeploy (R-CF-01; the owner runs the push).
- 24 h with A1 and A2 silent under smoke traffic.

**P2 exit:**
- The relay sends a text, a tapback, an attachment and a card from Cloudflare to the owner's test chats: one on a shared-pool line and one on a dedicated line (§6.14).
- Both relay instances, `relay-0` and `relay-1`, stay ready for 24 h (A7 silent once it is live).
- A HEIC is converted through the Images binding.
- An ascii box wakes and runs a command from Cloudflare.
- The `tk_` boxes are migrated (owner-run, §6.20), or TenkiRelay is live.
- MediaWorker matches the freeze stitch on the fixture clips.

**P3 exit:**
- Signed replays of recorded Spectrum webhooks complete turns on workers.dev (R-CF-04 harness; owner-run, §6.20). `canary` is set only for the test user, and only after R-CF-08 has merged (§6.18).
- A CreativeJob (`creative-job`) runs end to end with a fal webhook.
- A clip-backed freeze render on Cloudflare ends `delivered` (R-CF-08 with R-CF-09's stitch).
- air-build produces a Kit fixture bundle that is hash-identical to the Node build. `air-create build` gets 200, or 202 followed by `succeeded` (R-CF-10).
- SSE chat streams on workers.dev.
- All 8 cron paths are dispatched by `scheduled()`.
- The owner runs and approves R-CF-11's backlog triage. The owner then flips `cron_host=cloudflare` at this exit: one route override at a time, then the global key (§6.17). The flip does not wait for P4, because `cron_host` and `HOSTING.target` are independent (§2.5 C13). Vercel crons stay disabled.
- A4 and A5 are silent for 24 h.
- Q4 shows no `after()` work over 25 s.

**P4 entry:**
- P3 exit.
- R-CF-14.1b merged, including the canary rehearsal with the rollback B drill.
- A1–A9 live.
- R-CF-12 `selfFetch` sweep complete.
- KV `target`, routes and domains recorded (runbook step 1).
- §6 items 9, 10 (P4 scope) and 12 done.

**After P4 exit (runs alongside P5):**
- The owner sets `imessage_turn_engine=canary` for themself and soaks for 48 h. The owner then sets `durable` for everyone (R-CF-04, §6.18).
- On `durable`, measure R-CF-04's webhook p95 (< 300 ms) and its ≥ 95 % warm-turn SLA (§5 check 1). These gate P6 exit, not P5, so the P4→P5 gap stays at hours.

**P6 exit:**
- `CREATIVE_WEBHOOK_ORIGIN=https://app.wzrd.tech` is pushed (owner, §6.8), and a `/zap` webhook is verified on the app host, before `workers_dev:false` lands (R-CF-08).
- `AIRV2_SMOKE_URL` is `https://app.wzrd.tech` before `workers_dev:false` lands (R-CF-13).
- The `vercel.json` crons block is removed.
- `workers_dev:false`.
- The canary record and certificate are gone.
- The R-CF-05 P6 cleanup has shipped: `TENKI_API_KEY` is in `OPTIONAL_ENV` and the Tenki packages are devDependencies, once 0 `tk_` rows remain.
- The R-CF-10 P6 cleanup has shipped: the legacy `compileWorkspace`, the Kit disk extractors and the `/api/create/turn` tracing include are removed.
- `imessage_turn_engine=durable` for everyone, with R-CF-04's webhook p95 and warm-turn SLA met.
- `cpu_ms` and sampling are re-set from data.
- The owner retires app-switch (§2.5 C22) after at least 14 days without a rollback, with inventory row 12 confirmed. The vendored copy still dry-runs.

## 5. Verification plan

Run checks 1–11 on workers.dev at P3 exit, where they apply. Inbound turns use either the signed-replay harness (owner-run; it needs `SPECTRUM_WEBHOOK_SECRET`, §6.20) or the app-switch soft step with GET and webhook traffic only. Run the full list on the real hosts at P4 and P5 exit. Checks 12, 21 and 22 are owner-run (§2.5 C22, §6.20). Record results in `docs/operations/cloudflare-cutover.md`.

| # | Flow | Probe | Pass | Evidence |
|---|---|---|---|---|
| 1 | iMessage turn, with tapback timing | Owner's phone texts the Air line "what's on my calendar tomorrow?" | 👀 within 1 s (`REACTION_SLA_MS`, `lib/orchestrator/ttfk.ts:10`); first bubble within 5 s (`INITIAL_REPLY_SLA_MS`, `:11`); full reply; no duplicate bubbles; the `flush_jobs` mirror row is created, claimed and deleted. Over the 24 h before P4 exit: `within_sla` on ≥ 95 % of warm turns (R-CF-03). Once `imessage_turn_engine=durable` (§6.18): webhook p95 < 300 ms, and ≥ 95 % of warm turns meet both SLAs (R-CF-04; gates P6 exit). | Q6 `elapsed_ms`; `agent_runs.ttfk_ms`/`ttfk_met` (`supabase/migrations/0135_agent_runs_ttfk.sql`) |
| 2 | Burst | 3 texts within 2 s | One turn and one Hermes run | ConversationDO logs; `agent_runs` |
| 3 | Command inside a burst | `/calendar` plus a text in one burst | Card plus reply; F3 behaviour from `docs/specs/flush-stream-livelock.md` kept | Thread |
| 4 | Attachment in | iPhone HEIC photo plus caption | Described correctly; Images binding call logged; no 1102 | Q1, Q3 |
| 5 | Attachment out | `/draw a red fox` | Image delivered as an attachment, exactly once | `creative-job` instance `complete` |
| 6 | Card | `/calendar`, then tap the card | Opens on mini.wzrd.tech (P5); live updates arrive | Thread; mini-host logs |
| 7 | Web chat stream | app.wzrd.tech/home → send a prompt | `/api/chat` → `/api/chat/[runId]/events` streams; Stop (`/api/chat/[runId]/stop`) ends it within 2 s; a reload mid-stream recovers | Browser; Q1 |
| 8 | Creative job (web) | Start a web video job | `/api/creative/[jobId]/events` shows progress; fal webhook signature verified; asset ingested once | `wrangler workflows instances list creative-job` |
| 9 | Freeze stitch | `/freeze <prompt>` with a clip | MediaWorker starts and runs; stitched MP4 delivered; duration and frame count equal the parity reference (R-CF-09) | Container logs |
| 10 | Create build | `/create miniapp for a todo list` | Plan, then build; `/api/create/compile` returns 2xx synchronously; repeating the same (job_id, round) returns the same artifact; the app publishes to mini | air-build logs |
| 11 | Each cron tick | Watch for 1 h | `cron.dispatch` counts: sweep, schedules and trade 60 each; publish 12; ads 6; ad-metrics 1 at :15; health 1 at :30; sources at the next `0 */6` boundary. Each returns 200 with its `cron <name>` duration line. A host that is not `cron_host` does no work: R-CF-11 returns 204 and logs `cron.skipped`. | Q5; A4 silent |
| 12 | Admin `/_switch`, both ways (owner) | From the admin panel: GET; then POST `vercel`; then POST `cloudflare` | If Vercel is blocked: POST `vercel` gets 409 `upstream_unhealthy` and KV is unchanged (record the response). If Vercel is unblocked and at the same SHA: 200; `x-vercel-id` within 60 s; crons keep dispatching on Cloudflare, because rollback A never moves `cron_host` (§2.5 C13); mini/link routing and a browser POST still work; then switch back. A SHA mismatch returns a `warning` and needs `{"force": true}`. Send that only with owner approval, because migrations may have moved. A 404 from a pre-R-CF-02 build passes the health probe (§2.5 C12). | `curl -sI`; `/api/version` `target`; Q5 |
| 13 | mini host | `/`, `/<user>/<app>`, `?t=` launch link, `/mini/<app>`, `/api/mini/*`, `/vendor/README.md` | Store home 200; loader 200 with publisher CSP; the token redeems once (second use rejected); `/mini/<app>` 301s to `/<app>`; API 200; the vendor file is served as a static asset | `curl`; middleware tests |
| 14 | link host | `link.wzrd.tech/<slug>`, `/api/mini/*`, `/creator-os/*` | Pay link renders; the API passes through; the asset is served | `curl` |
| 15 | Stripe webhook | Stripe dashboard → Send test webhook `checkout.session.completed`, then resend | 200 both times; the side effect happens once | Stripe deliveries; Q1 |
| 16 | Email inbound | Send mail to an agent address | `/api/inbound/email` returns 200; message filed or agent replies | Q1; inbox |
| 17 | GitHub App | Redeliver the latest delivery; open the Setup URL | 200; 303 to mini `/create` (`app/api/create/github/setup/route.ts:20-22`) | GitHub deliveries |
| 18 | Box callbacks | One box turn | `/api/gateway/v1/*`, `/api/mcp/*` and `/api/cards/*` return 2xx on Cloudflare | Q1, grouped by path |
| 19 | air-muse | One muse connector call | 200 over the service binding; no public fetch | air-muse logs |
| 20 | Old approval link | Open an `/approve/<id>?k=` link minted before cutover | Renders; decision recorded; the `k` value is absent from the logged URL | DB; Q1 |
| 21 | Rollback drills (owner) | Canary: rollback B with the CI guard (`AIRV2_ROLLBACK_B=true`, §2.5 C21); rollback A if Vercel is unblocked | As in the R-CF-14 acceptance list | Runbook log |
| 22 | Budgets (owner) | `node apps/web/scripts/cf-usage.mjs` with the local Analytics token (§6.10) | Exit 0; no unexpected product in Billable Usage | Script output |

## 6. Owner actions (not Devin)

1. **Upgrade to Workers Paid** ($5/month, account-wide) on account `e8f42c0430906e1515a2af01d5c1d2d1`. This moves all 34 workers off the shared free quotas. *Blocks P1.*

2. **Email help@photon.codes.** *Blocks nothing; gates R-CF-03's `http` transport.* Ask:
   - (a) Is there a hosted `imessage-server-v2-http` endpoint for Spectrum Cloud projects? What are its addresses for shared and dedicated lines, and how does `x-photon-server` routing work?
   - (b) Do Spectrum-issued project tokens work against it?
   - (c) Is gRPC-Web enabled?
   - (d) What are the token-mint rate limits?
   - (e) Do edits and reactions count toward the 5,000 messages/server/day quota?
   - (f) What is the deduplication window for client message ids (`duplicateMessage`)?
   - (g) Does editing the webhook URL rotate its signing secret?

3. **Vercel. Needed only for rollbacks A and B.** *Blocks rollback A/B only.*
   - **First, before paying:** in project airv2 (`prj_k85SYkCP3elo3YIChN6o45gEbsRC`), go to Settings → Cron Jobs → **Disable**.
     - Verify that the blocked team can save this setting. If it cannot, do not unblock until it can.
     - The live build (ce337d1) predates the `cron_host` guard. An unblock would immediately run sweep, publish and schedules a second time against the shared Supabase, and drain the weeks-old backlog (§6.17).
   - **Stop the cost driver.** On every team project:
     - block `devin/*` and `codex/*` preview builds (Ignored Build Step or `git.deploymentEnabled`; verify the syntax);
     - set build machines to Standard;
     - turn off on-demand concurrent builds;
     - turn on Spend Management with pause.

     Billing research for team `5dee-studios` (`team_PYXAVq4jrHw8k0bNffmhc2jE`): about $756 of the ~$820 billed from 2026-07-01 to 10-20 (92%) was Build CPU Minutes from agent preview builds across team projects. airv2 had about 1 build in the sample. Functions cost about $12.
   - **Open a billing case now:** vercel.com/help → Create Case → Billing, asking for those charges to be credited.
     - Collect invoice IDs and PDFs first.
     - Vercel's Support Terms require billing amendments within one month of the invoice date. The September usage invoice is likely dated about 2026-10-01 (verify), so its window closes around 2026-11-01. August's has likely lapsed.
     - Do not file a chargeback, which can suspend the account. Pay what is not credited.
   - **After the unblock:**
     - create a Protection Bypass for Automation secret (it becomes `VERCEL_AUTOMATION_BYPASS_SECRET`);
     - set `EDGE_PROXY_SECRET` on Vercel;
     - let main redeploy so Vercel matches the Cloudflare SHA. Otherwise `POST /_switch` to `vercel` returns a `warning` and needs `force` (§2.5 C12).

     Keep the team on Pro (§7).

4. **Domain `wzrd.tech`.** It is registered at Vercel with auto-renew off and expires 2027-06-28.
   - Transfer it to Cloudflare Registrar (preferred). That needs the auth code from Vercel and may require the account to be in good standing (verify). Otherwise turn on auto-renew.
   - The `*.wzrd.tech` wildcard cert at Vercel expires 2026-11-28; that matters only for rollback B.
   - *Start in P0; must be done before 2027-06-28.*

5. **Decide the 2 `tk_` boxes.** Either migrate them to ascii with the `lib/migration` tooling (recommended), or keep Tenki through the air-sidecar `TenkiRelay`. *Decide in P0; blocks P2 exit.*

6. **Decide WfP.** The default is that it stays gated (§7). Buying the $25/month add-on is a separate project, and it would also set `vars.WFP_ENABLED=1`. *Blocks nothing.*

7. **Provide `SWITCH_TOKEN`.** This is the value the admin panel sends. Secrets cannot be read back from the deployed app-switch.
   - Copy it from the admin panel's server config, or rotate it: generate one value and set it at the same time in the admin panel, in `.env.airv2.md`, and with `npx wrangler secret put SWITCH_TOKEN --name app-switch`.
   - Also confirm the URL the admin panel calls for `/_switch` (R-CF-14 inventory row 12).

   *Blocks P1 (R-CF-02 acceptance) and P6.*

8. **Fill `apps/web/.env.airv2.md`** from `apps/web/env.example.md`. *Blocks P1. `LINK_HOST_ENABLED` blocks P5, and switching `CREATIVE_WEBHOOK_ORIGIN` back blocks P6.*
   - Take the values from the Vercel project env and the vendor consoles.
   - `APP_ORIGIN_SIGNING_KEY`, `CREATE_BRIDGE_SECRET` and `LIVE_TOKEN_SECRET` are stored as "plain" on Vercel, but the template files them under `## secret`. Keep them there, and consider rotating them.
   - `CANDIDATE_SECRET` is read only by air-create and air-dev (`infra/workers/create/src/check.ts`, `infra/workers/dev-router/index.mjs`), both WfP-gated. Do not copy it into this file.
   - Keep `APP_ORIGIN=https://app.wzrd.tech`. Set `LINK_HOST_ENABLED=true` before P5.
   - Set `CREATIVE_WEBHOOK_ORIGIN` to airv2-app's workers.dev origin until P4. Set it to `https://app.wzrd.tech` before P6 (R-CF-08).
   - Once R-CF-01 lands, run `npm run cf:env -- check`, then `push`, then `public`.
   - Once the R-CF-02 entry is live on workers.dev, run `push --prune-legacy` (R-CF-01).
   - Run `push --worker air-sidecar` once air-sidecar is deployed (P2). Run `push --worker air-build` with item 15.
   - Never create any `.env*` file in `apps/web` or the repo root. OpenNext inlines them into the bundle.

9. **Webhook dashboards.** Read the Photon webhook URL and the GitHub App Setup URL. After 14.1b lands, run `node apps/web/scripts/webhook-inventory.mjs`; it needs the values file. Apply `--fix` once the output has been reviewed. *Blocks P4.*

10. **Cloudflare tokens.**
    - The `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets need the R-CF-13 scopes, plus the following (verify the exact permission names):
      - **Containers Edit**, for the `air-sidecar` deploy job in `workers.yml` (§2.5 C18). *Blocks P2.*
      - **Queues Edit** and **Workers R2 Storage Edit**, for R-CF-13's `ensure-resources` job, which creates `air-deferred`, `air-deferred-dlq` and the `air-build` bucket (§2.5 C18). Also **Workflows Edit**, for R-CF-08 and R-CF-11. *Blocks P3.*
      - **Workers Routes Write** on zone `wzrd.tech`. That permission is required to change Routes or Custom Domains during deploy (developers.cloudflare.com/workers/authorization/). It is needed from the 14.1b canary deploy on. Add DNS Edit if the canary deploy needs it (verify). *Blocks the canary rehearsal and P4.*
    - Fix the secrets that made `workers.yml` run 37415667694 fail. *Blocks P2, because air-sidecar deploys from `workers.yml`.*
    - Issue a separate local token with Account Analytics Read for `cf-usage.mjs`.

    *Blocks P2, P3 and P4, as marked.*

11. **Alert destinations and budget alerts.** Set up the R-CF-15 destinations and the A9 budget alerts. *Blocks P2.*

12. **Cutover windows** (§2.5 C22: DNS changes and custom-domain attaches).
    - Approve and run the dashboard steps of the runbook (CNAME delete, Custom Domain attach, route delete) for app (P4), then for mini and link (P5). Pick times when you can test from a phone.
    - Approve `cf-canary.wzrd.tech` and create its rehearsal CNAME.

    *Blocks P4 and P5.*

13. **Images plan.** *Blocks P2.*
    - Decide between Images Paid and Images Free. On Images Free, the 5,001st unique transformation in a month fails with 9422, and HEIC uploads then fail (R-CF-09).
    - Confirm the account is on the Images subscription, not legacy Image Resizing (error 9432).

14. **Test chats.** *Blocks R-CF-03 acceptance and P2 exit.*
    - Provide one test chat on a shared-pool line and one on a dedicated line. They are used for `/api/admin/imessage/probe` (R-CF-03) and the P2 exit sends.
    - Your own phone runs §5 check 1.

15. **air-build credentials and Tier B.** *Blocks the R-CF-10 merge (P3).*
    - The `air-build` bucket itself comes from R-CF-13's `ensure-resources` job (§2.5 C18).
    - Add R-CF-10's lifecycle rules: `src/` expires after 1 day, `out/` after 7 days.
    - Create an R2 API token scoped to `air-build` only. Put `R2_BUILD_ACCESS_KEY_ID` and `R2_BUILD_SECRET_ACCESS_KEY` under `## secret @air-build` in `.env.airv2.md`. Run `npm run cf:env -- push --worker air-build` once air-build is deployed.
    - Run `curl -sI https://media.wzrd.tech/_platform/kit/restricted/<KIT_RESTRICTED_VERSION>.tgz`. If it returns 200:
      - delete that object from `air-media`;
      - re-upload it to `air-build/kit/restricted/`;
      - treat it as a licence exposure (R-CF-10).

16. **Container sizing.** *Blocks nothing; decide at the P2 and P3 exit reviews.*
    - The relay count is fixed at two, `relay-0` and `relay-1` (§2.5 C14). Choose `lite` or `basic` for the relay. Move to `basic` only if A7 fires on memory; that costs about $14.35/month instead of $3.75 (§3.3).
    - MediaWorker stays `standard-1`. If the measured stitch p95 is over 240 s, decide whether to move to `standard-2` (R-CF-09).

17. **Cron backlog triage and the `cron_host` flip.** *Blocks P3 exit.*
    - Before the first flip, run R-CF-11's backlog triage step against production and approve its result. Weeks-old `flush_jobs`, `agent_schedules` and `content_slots` rows must not fire blindly (§2.5 C13).
    - Then flip `cron_host` one route override at a time, in the order of R-CF-11's staged flip, and finish with the global key. Use the admin settings API (`ADMIN_API_KEY` + `x-admin-operator`) or the SQL in R-CF-11.

18. **iMessage turn engine.** *The test-user canary blocks P3 exit; `durable` blocks P6 exit.*
    - Keep `imessage_turn_engine=after` until R-CF-08 has merged.
    - Then set `canary` for your test user only, for R-CF-04's P3 synthetic replays.
    - After P4 exit, set `canary` for yourself and soak for 48 h. Then set `durable` for everyone (R-CF-04).
    - Use the admin settings API (`ADMIN_API_KEY` + `X-Admin-Operator`).

19. **Desktop client.** *Blocks nothing on Cloudflare; ship it during P3.* The desktop client is not in this repo. Ship the same run-recovery change that R-CF-07 adds for web (`lib/chat/recover.ts`: poll the run status URL after a dropped stream).

20. **Owner-run checks.** These need production values or credentials that only you hold. Devin puts the command and the expected output in each PR. You run it and paste the result into the PR:
    - `cf:env -- check`, `push`, `push --worker <name>`, `push --prune-legacy` and `public` (R-CF-01);
    - the first `airv2-app` deploy, if it has to happen before R-CF-13. Otherwise merge R-CF-13 first and dispatch `airv2-app.yml` (R-CF-02);
    - `/api/admin/imessage/probe` with real Photon tokens (R-CF-03);
    - the signed synthetic webhook replays, which need `SPECTRUM_WEBHOOK_SECRET` (R-CF-04);
    - the `tk_` box migration with production values (R-CF-05);
    - the live email check (R-CF-06);
    - `webhook-inventory.mjs` (§6.9) and `cf-usage.mjs` (R-CF-15, §5 check 22).

21. **Owner-only operations (§2.5 C22).** Devin implements, tests (local KV, a test namespace, `wrangler dev`) and documents these, but never runs them against production:
    - writes to KV namespace `61b51af0f1da4cda8dd6449c845ac01e`, and `POST /_switch` on a deployed Worker (R-CF-02 acceptance, R-CF-14 T0, rollback A, §5 check 12);
    - DNS record changes and custom-domain attaches (§6.12, the R-CF-14 runbook and rollback B);
    - `cf:env push` and `push --prune-legacy` (§6.8);
    - `app-switch` deploys, its `SWITCH_TOKEN` secret (§6.7) and its retirement (R-CF-14.4);
    - deleting R2 objects or buckets (§6.15);
    - disabling CI deploy jobs, including the rollback B freeze with `AIRV2_ROLLBACK_B=true` (§2.5 C21);
    - the cron backlog triage (§6.17).

## 7. Out of scope

- **The Workers for Platforms functions lane:** `air-dispatcher`, `air-dev`/dev-router, the `<slug>-draft`/`-dev` deploys, and deploying `air-create`, which binds a dispatch namespace (`infra/workers/create/wrangler.jsonc:26`).
  - They stay gated by `appOriginLaneReady()` (`apps/web/lib/functions/deploy.ts:74-80`), and their CI deploy jobs stay behind `vars.WFP_ENABLED` (R-CF-14.1a).
  - WfP is a $25/month add-on that Workers Paid does not include. Static mini-apps keep the R2 lane.
- **Admin repo UI** (`gratitude5dee/admin`): no change, because the `/_switch` + KV contract is preserved (R-CF-02). If the admin panel calls an app-switch-specific URL, repointing it is an admin-repo change, tracked there.
- **Vercel Hobby as the rollback host:** not allowed.
  - Hobby forbids commercial use, and the app takes payments and runs ads.
  - Hobby crons run at most once a day, but `apps/web/vercel.json` has 3 every-minute crons.
  - Hobby's maximum duration is 300 s, but 22 routes set `maxDuration = 800`.
- **Also out of scope:**
  - moving Supabase;
  - the pg_cron + pg_net cron fallback (documented only);
  - Photon HTTP transport beyond the gated adapter;
  - replacing the freeze stitch with fal's ffmpeg APIs;
  - Workers Cache on airv2-app;
  - deleting the Vercel project or team (the owner decides after the rollback window);
  - the Workers Free plan.

## Files

- [`R-CF-01`](cloudflare-migration/R-CF-01-env-and-secrets-from-a-gitignored-markdown-file.md)
- [`R-CF-02`](cloudflare-migration/R-CF-02-custom-worker-entry-and-the-hosting-switch.md)
- [`R-CF-03`](cloudflare-migration/R-CF-03-imessage-outbound-transport.md)
- [`R-CF-04`](cloudflare-migration/R-CF-04-imessage-inbound-as-a-durable-turn.md)
- [`R-CF-05`](cloudflare-migration/R-CF-05-box-control-on-workers.md)
- [`R-CF-06`](cloudflare-migration/R-CF-06-durable-deferred-work-replace-long-after.md)
- [`R-CF-07`](cloudflare-migration/R-CF-07-streams-and-realtime.md)
- [`R-CF-08`](cloudflare-migration/R-CF-08-creative-jobs-as-a-workflow.md)
- [`R-CF-09`](cloudflare-migration/R-CF-09-media-without-native-binaries.md)
- [`R-CF-10`](cloudflare-migration/R-CF-10-create-lane-builds-on-cloudflare-air-build.md)
- [`R-CF-11`](cloudflare-migration/R-CF-11-crons-on-cloudflare-cron-triggers.md)
- [`R-CF-12`](cloudflare-migration/R-CF-12-runtime-compatibility-fixes.md)
- [`R-CF-13`](cloudflare-migration/R-CF-13-ci-cd-for-airv2-app.md)
- [`R-CF-14`](cloudflare-migration/R-CF-14-cutover-hosts-and-third-party-urls.md)
- [`R-CF-15`](cloudflare-migration/R-CF-15-observability-limits-and-budgets.md)
- [`Appendix A — Route impact matrix`](cloudflare-migration/appendix-a-route-impact-matrix.md)
