# R-CF-02 — Custom worker entry and the hosting switch

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-02: …`.

**Why.**
- **No hook before Next.** `apps/web/wrangler.jsonc:4` points `main` at `.open-next/worker.js`. Nothing can run before Next, so there is nowhere to unpack env (R-CF-01), host `/_switch`, expose the `Internal` entrypoint for `SELF`, or export `scheduled`, `queue`, DO or Workflow classes.
- **The deployed app-switch is costly and unsafe.** It reads KV on every request with no cache. It compares `Bearer ${SWITCH_TOKEN}` with `!==`, which is not constant-time. With target=cloudflare it costs 2 invocations per request.
- **Host routing breaks behind a proxy.** `middleware.ts:56` routes on the raw `host` header, and Vercel overwrites `x-forwarded-host`. So in rollback-proxy mode, mini and link routing (`:58`, `:76`) and the CSRF guard (`lib/http/origin.ts:57-65`) break.
- **No self-fetch.** A Worker cannot fetch its own custom domain (error 522). So `/api/version` must be answered in-process, and same-app calls must go through `SELF` to the `Internal` entrypoint, which never runs the hosting switch (§2.5 C1). R-CF-12 owns `selfFetch`; `lib/orchestrator/sharedBridge.ts:203-204` is the known offender.
- **No reliable tag.** The `wrangler secret bulk` version may not keep the deploy `--tag`, so the build SHA is baked into the bundle as a constant (§2.5 C5).

**Deltas.**
- `apps/web/worker/build-info.ts` — NEW (§2.5 C5):
  ```ts
  declare const __AIR_BUILD_SHA__: string | undefined;
  declare const __AIR_BUILT_AT__: string | undefined;
  export const BUILD_SHA = typeof __AIR_BUILD_SHA__ === "string" && __AIR_BUILD_SHA__ ? __AIR_BUILD_SHA__ : "dev";
  export const BUILT_AT = typeof __AIR_BUILT_AT__ === "string" && __AIR_BUILT_AT__ ? __AIR_BUILT_AT__ : null;
  ```
  - Wrangler `define` substitutes both. The config defaults are `"dev"` and `""`. CI (R-CF-13) overrides them with `--define __AIR_BUILD_SHA__:"<sha>"` and `--define __AIR_BUILT_AT__:"<iso>"`.
  - CLI defines merge over config defines (wrangler 4.149.0 `cli.js:220040`). `--define` splits on the first `:` (`cli.js:219859`), so an ISO timestamp value survives intact.
  - No `lib/build-constants.d.ts` exists. Next chunks read `process.env.AIR_BUILD_SHA` and `process.env.AIR_BUILT_AT`, which env-unpack sets (below).
- `apps/web/worker/env-unpack.ts` — NEW. A thin runtime wrapper over R-CF-01's applier. It exports `applyEnv`, the first statement of every entrypoint (§2.5 C3):
  ```ts
  import process from "node:process";
  import { env as bootEnv } from "cloudflare:workers";      // importable env: available at module evaluation
  import { createApplier, PACK_SLOTS, DIGEST_KEY } from "./env-pack";
  import { BUILD_SHA, BUILT_AT } from "./build-info";
  import { setCfEnv } from "../lib/runtime/platform";       // §2.5 C2 (R-CF-12)
  import { log } from "../lib/log";

  const applier = createApplier(process.env as Record<string, string | undefined>);
  let lastError: string | null = null;
  let lastDigest: string | null = null;
  const nextEnvCache = new WeakMap<object, { digest: string | null; env: CloudflareEnv }>();

  function run(source: Record<string, unknown>): void {
    const r = applier.apply(source);                       // overwrite on new digest; deletes removed names
    const d = typeof source[DIGEST_KEY] === "string" ? (source[DIGEST_KEY] as string) : null;
    if (r.changed || r.error !== lastError) {
      (r.error ? log.error : log.info)("env.unpack", { digest: d?.slice(0, 12) ?? null, rotated: r.changed, error: r.error });  // §2.5 C16
    }
    lastError = r.error; lastDigest = d;
    process.env.AIR_BUILD_SHA = BUILD_SHA;                 // §2.5 C5: read by R-CF-12 env.buildSha()
    if (BUILT_AT) process.env.AIR_BUILT_AT = BUILT_AT;     // read by R-CF-12 env.buildDeployedAt()
  }
  run(bootEnv as unknown as Record<string, unknown>);      // before ANY OpenNext/Next module evaluates

  /** Per invocation: re-check the digest (rotation on reused isolates), return the env OpenNext may see. */
  export function applyEnv(env: CloudflareEnv): CloudflareEnv {
    run(env as unknown as Record<string, unknown>);
    const hit = nextEnvCache.get(env);
    if (hit && hit.digest === lastDigest) { setCfEnv(hit.env); return hit.env; }
    const packed = applier.names();
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(env)) {
      if ((PACK_SLOTS as readonly string[]).includes(k) || k === DIGEST_KEY) continue;  // packs never reach Next
      if (typeof v === "string" && packed.has(k)) continue;                             // packed value wins over a same-named var/legacy secret
      copy[k] = v;
    }
    const out = copy as unknown as CloudflareEnv;
    nextEnvCache.set(env, { digest: lastDigest, env: out });
    setCfEnv(out);                                         // §2.5 C3: cfEnv() works in DOs, Workflows, queue() and scheduled()
    return out;
  }
  export const envError = (): string | null => lastError;
  export const envDigest = (): string | null => lastDigest;
  ```
  - Failure is soft: a bad or missing pack never throws at module scope. `/_switch`, `/api/version` and the proxy keep working, and OpenNext paths return 503.
  - OpenNext's `populateProcessEnv` overwrites `process.env` from the env it receives (`init.js:88-92`). Handing it the stripped copy keeps packed values authoritative.
  - `setCfEnv(out)` stores the env that OpenNext sees. Code in a DO, a Workflow, `queue()` or `scheduled()` reads bindings through `cfEnv()` (§2.5 C2), because `getCloudflareContext()` throws outside an OpenNext request.
  - The `env.unpack` line (§2.5 C16; R-CF-15 Q7) carries the 12-hex digest, `rotated`, and the error message. That message names a slot or key and never a value (R-CF-01).
  - ESM evaluates env-unpack's imports (`env-pack`, `build-info`, `lib/runtime/platform`, `lib/log`) before its body runs. None of them may read `process.env` at module scope. Keep it that way.
- `apps/web/worker/switch.ts` — NEW. The `/_switch` contract, identical to the deployed app-switch (§1.2): KV binding `HOSTING` = namespace `61b51af0f1da4cda8dd6449c845ac01e` ("app-hosting-switch"), key `"target"` ∈ {`vercel`, `cloudflare`}. A missing or unknown value means `vercel`.
  - **Host.** `/_switch` is answered on the main switch host and on every non-switch host:
    - the main switch host is the first `SWITCH_HOSTS` entry, `app.wzrd.tech`;
    - non-switch hosts are workers.dev until P6, and `localhost` under `wrangler dev`.
    - On `mini.wzrd.tech` and `link.wzrd.tech`, `/_switch` falls through to the normal path, which matches middleware host gating (§2.4).
    - `servesSwitchApi(hostname, env)` implements this rule.
  - **Auth.** `Authorization: Bearer <token>`. The token is `env.SWITCH_TOKEN`, the individual secret from `## secret @airv2-app` (R-CF-01), so the switch works even when the packs are broken. Fall back to `process.env.SWITCH_TOKEN`.
    - Compare `createHash("sha256").update(header).digest()` with the sha256 of `"Bearer " + token` using `timingSafeEqual`, both from `node:crypto`. They are supported under `nodejs_compat` (developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/) and work in vitest. `crypto.subtle.timingSafeEqual` does not exist in Node.
    - An empty or unset token always gives 401 `{"error":"unauthorized"}` (§1.2). app-switch would accept `Bearer undefined`.
    - Every response carries `cache-control: no-store`.
  - **`GET /_switch`** → 200:
    ```json
    {"target":"cloudflare","source":"kv|default|stale|error","served_by":"airv2-app","build_sha":"<sha>","worker_version":"<CF_VERSION_METADATA.id>","env_digest":"<12hex>","env_ok":true,"upstream":{"url":"https://airv2.vercel.app","status":200,"sha":"<sha>|null"}}
    ```
    `upstream` comes from a 3 s `fetch((process.env.UPSTREAM_VERCEL || env.UPSTREAM_VERCEL) + "/api/version", { signal: AbortSignal.timeout(3000) })`. That is an external host, never our own domain. Send `x-vercel-protection-bypass` when `VERCEL_AUTOMATION_BYPASS_SECRET` is set.
  - **`POST /_switch`** with body `{"target":"vercel"|"cloudflare","force"?:true}`. As in app-switch, `target` is case-insensitive. Semantics follow §2.5 C12:
    - Invalid JSON → 400 `{"error":"invalid json body"}`. Any other target → 400 `{"error":"target must be one of: vercel, cloudflare"}`. Other methods → 405 `{"error":"method not allowed"}`. These are app-switch's bodies (§1.2).
    - target=`cloudflare` → write, with no probe.
    - target=`vercel` first probes `UPSTREAM_VERCEL/api/version`, using the same 3 s probe as GET:
      - Unreachable, timed out, or any status other than 2xx or 404 → 409 `{"error":"upstream_unhealthy","upstream":{…}}`. `force` does not override this. A blocked Vercel answers 4xx/5xx, and flipping to it would cause an outage on every switch host.
      - A 404 means a pre-R-CF-02 build (the frozen `ce337d1` has no `/api/version`). It counts as reachable, but its SHA is unknown.
      - SHA mismatch (a 404, a null `sha`, or `sha !== BUILD_SHA`) → 409 `{"error":"sha_mismatch","warning":"upstream sha <x> != <BUILD_SHA>","upstream":{…}}`, unless `force:true` is sent. With `force:true` the write goes ahead and the 200 response carries `warning`. A strict same-SHA gate would make rollback impossible while Vercel is frozen.
      - Same SHA → write.
    - A write does the following:
      - `env.HOSTING.put("target", target)`;
      - updates this isolate's cache immediately;
      - logs `switch.flip` `{ from, to, forced }` (§2.5 C16);
      - returns 200 `{"target","previous","upstream","warning"?}`.
      `target` is app-switch's field; the others are additive.
    - The admin panel is unchanged and never sends `force`, so it shows the 409. A forced flip is a `curl` by the owner with `{"target":"vercel","force":true}`. If the entry itself is down, the owner's hard override is `wrangler kv key put` (§2.5 C22).
  - Keep every field and status that app-switch returns and accepts (§1.2), with the same names and types. Vendor app-switch first (below), and assert those bodies in `switch.test.ts`. The fields added here are additive, so the admin panel (gratitude5dee/admin) stays unchanged.
  - **Production writes are owner-only (§2.5 C22).** Devin never POSTs `/_switch` on a deployed Worker and never writes namespace `61b51af0f1da4cda8dd6449c845ac01e`, by `kv key put` or otherwise.
    - app-switch reads the same key for `app.wzrd.tech`, so a write before P4 also moves live traffic (R-CF-14).
    - Tests use `wrangler dev` with local KV, or a test namespace.
    - Production flips belong to the owner, at R-CF-14 T0 (§6).
  - **`currentTarget(env, ctx)`** — isolate cache with a 30 s TTL and stale-while-revalidate:
    ```ts
    type Target = "vercel" | "cloudflare";
    let cache: { target: Target; source: "kv" | "default" | "stale" | "error"; exp: number } | null = null;
    let inflight: Promise<void> | null = null;
    async function refresh(env: CloudflareEnv): Promise<void> {
      try {
        const v = await env.HOSTING.get("target");
        cache = { target: v === "cloudflare" ? "cloudflare" : "vercel",          // app-switch semantics
                  source: v === "vercel" || v === "cloudflare" ? "kv" : "default", exp: Date.now() + 30_000 };
      } catch (e) {
        console.error("[switch] kv read failed", String(e));
        cache = cache ? { ...cache, source: "stale", exp: Date.now() + 5_000 }
                      : { target: "cloudflare", source: "error", exp: Date.now() + 5_000 };   // cold isolate + KV down: serve self
      } finally { inflight = null; }
    }
    export async function currentTarget(env: CloudflareEnv, ctx: ExecutionContext): Promise<Target> {
      if (cache && Date.now() < cache.exp) return cache.target;
      inflight ??= refresh(env);
      if (cache) { ctx.waitUntil(inflight); return cache.target; }   // serve last value, revalidate in background
      await inflight; return cache!.target;
    }
    export function __resetSwitchCacheForTests(): void { cache = null; inflight = null; }
    ```
  - `isSwitchHost(hostname, env)` tests membership in the `SWITCH_HOSTS` var. workers.dev and preview URLs are never proxied, so CI smoke always hits this build.
  - SELF requests never reach this code. They enter `Internal` (§2.5 C1), so `selfFetch` (R-CF-12) and every DO, queue, cron and Workflow call is served by this build whatever the target.
  - `/_switch` does not touch `platform_settings.cron_host`. `cron_host` (R-CF-11) and `HOSTING.target` are independent levers (§2.5 C13).

> Note for owner: The contract keeps app-switch's KV semantics, so a missing or unknown `target` means `vercel` here too. While the Vercel team is blocked, that default turns a deleted or never-written key into an outage on every switch host. Mitigations:
> - At R-CF-14 T0, before `app.wzrd.tech` is attached, the owner writes `target=cloudflare` explicitly (`POST /_switch` or `wrangler kv key put`, §2.5 C22). Today's live value is unknown. A read-only `npx wrangler kv key get target --namespace-id 61b51af0f1da4cda8dd6449c845ac01e --remote` answers that (verify).
> - The admin panel should flag `source:"default"`.
> - Consider flipping the default to `cloudflare` once app-switch is retired (P6).
>
> A KV *read error* on a cold isolate is not part of that contract. That case serves `cloudflare` (`source:"error"`).

- `apps/web/worker/proxy.ts` — NEW `proxyToVercel(request, env, url)`, porting app-switch (§1.2):
  ```ts
  const DROP = /^(host|connection|cdn-loop|cf-.*|x-forwarded-(for|host|proto)|x-real-ip|x-air-.*|x-vercel-protection-bypass|content-length)$/i;
  export async function proxyToVercel(request: Request, env: CloudflareEnv, url: URL): Promise<Response> {
    const upstream = new URL(process.env.UPSTREAM_VERCEL || env.UPSTREAM_VERCEL);
    if (upstream.host === url.host || isSwitchHost(upstream.hostname, env)) return json(508, { error: "proxy_loop" });
    const headers = new Headers();
    for (const [k, v] of request.headers) if (!DROP.test(k)) headers.set(k, v);
    const ip = request.headers.get("cf-connecting-ip");
    headers.set("x-forwarded-host", url.host);            // Vercel overwrites it; kept for app-switch parity
    headers.set("x-forwarded-proto", "https");
    if (ip) { headers.set("x-forwarded-for", ip); headers.set("x-air-client-ip", ip); }
    const secret = process.env.EDGE_PROXY_SECRET;
    if (secret) { headers.set("x-air-origin-host", url.host); headers.set("x-air-edge-auth", secret); }
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (bypass) headers.set("x-vercel-protection-bypass", bypass);
    const target = new URL(url.pathname + url.search, upstream);
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(target, { method: request.method, headers, redirect: "manual",
        body: request.method === "GET" || request.method === "HEAD" ? null : request.body });
    } catch {
      log.warn("proxy.upstream", { status: 0, duration_ms: Date.now() - started });
      return json(502, { error: "upstream_unreachable" });             // app-switch: JSON 502 only on fetch throw
    }
    log.info("proxy.upstream", { status: res.status, duration_ms: Date.now() - started });   // §2.5 C16
    const out = new Response(res.body, res);              // body streams through (SSE ok)
    const loc = out.headers.get("location");
    if (loc && /^https?:\/\//i.test(loc)) {
      const l = new URL(loc);
      if (l.host === upstream.host) { l.protocol = "https:"; l.host = url.host; out.headers.set("location", l.toString()); }
    }
    out.headers.set("x-served-by", "app-switch:vercel");  // app-switch parity: `app-switch:<target>` (§1.2)
    return out;
  }
  ```
  - `fetch()` derives Host from the URL, so the `host` header that app-switch set is not needed. Cookies are host-only, so no `Set-Cookie` rewrite is needed.
  - The loop guard is host-based. The public fetch has already stripped every inbound `x-air-*` header (§2.5 C1), so the guard cannot rely on an inbound `x-air-edge-auth`.
- `apps/web/worker/handler.ts` — NEW factory, so tests run without `.open-next`:
  ```ts
  const FAL_WEBHOOK = "/api/creative/fal-webhook";                       // §2.5 C1: the only public path CF serves whatever the target
  export function createFetchHandler(d: { openNext: { fetch: ExportedHandlerFetchHandler<CloudflareEnv> };
      buildSha: string; applyEnv: (e: CloudflareEnv) => CloudflareEnv; envError: () => string | null; envDigest: () => string | null;
      falWebhook?: (request: Request, env: CloudflareEnv, ctx: ExecutionContext) => Promise<Response> }) {   // supplied by R-CF-08
    return async (inbound: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> => {
      const nextEnv = d.applyEnv(env);                                   // §2.5 C3: first statement; digest re-check every invocation
      const request = stripAirHeaders(inbound);                          // §2.5 C1: every inbound x-air-* goes before any routing
      const url = new URL(request.url);
      if (url.pathname === "/_switch" && servesSwitchApi(url.hostname, env)) return handleSwitch(request, env, ctx, d);
      if (url.pathname === "/api/version" && (request.method === "GET" || request.method === "HEAD")) {
        return json(200, { sha: d.buildSha, host: "cloudflare", served_by: "airv2-app",
          target: await currentTarget(env, ctx), switch_host: isSwitchHost(url.hostname, env),
          worker_version: env.CF_VERSION_METADATA?.id ?? null, env_digest: d.envDigest()?.slice(0, 12) ?? null });
      }                                                                   // answered BEFORE the switch, never proxied
      if (url.pathname === FAL_WEBHOOK && request.method === "POST") {   // the Workflow lives on CF (R-CF-08): never proxied
        if (d.envError()) return json(503, { error: "env_unavailable" });
        return d.falWebhook ? d.falWebhook(request, env, ctx) : d.openNext.fetch(request, nextEnv, ctx);
      }
      if (isSwitchHost(url.hostname, env) && (await currentTarget(env, ctx)) === "vercel") return proxyToVercel(request, env, url);
      if (url.pathname === "/_next/image") return json(404, { error: "not_found" });   // no next/image in the app; guards IMAGES (R-CF-09)
      if (d.envError()) return json(503, { error: "env_unavailable" });   // cause only in logs
      return d.openNext.fetch(request, nextEnv, ctx);
    };
  }
  function stripAirHeaders(request: Request): Request {
    const headers = new Headers(request.headers);
    let hit = false;
    for (const k of [...headers.keys()]) if (k.startsWith("x-air-")) { headers.delete(k); hit = true; }
    return hit ? new Request(request, { headers }) : request;
  }
  ```
  - `json()` always sets `cache-control: no-store`.
  - The order is fixed: `applyEnv` → strip → `/_switch` → `/api/version` → fal webhook → switch → `/_next/image` 404 → env 503 → OpenNext.
    - The fal webhook is the only public path that Cloudflare serves whatever the target (§2.5 C1). Later items add no other route before the switch.
    - The `/_next/image` 404 sits on the Cloudflare branch. In proxy mode Vercel answers that path.
    - `/cdn-cgi/image` needs nothing (R-CF-09).
- `apps/web/worker/entry.ts` — NEW wrangler `main`. Import order matters:
  ```ts
  import { applyEnv, envError, envDigest } from "./env-unpack";    // MUST stay the first import
  import { WorkerEntrypoint } from "cloudflare:workers";
  // @ts-expect-error -- generated by `opennextjs-cloudflare build`; JS without types
  import openNext from "../.open-next/worker.js";
  import { BUILD_SHA } from "./build-info";
  import { createFetchHandler } from "./handler";
  // @ts-expect-error -- OpenNext DO classes; inert until an incremental/tag cache is configured (open-next.config.ts:3 is {})
  export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";
  // export { BoxLifecycle } from "./box-lifecycle";            // R-CF-05 (tag v1-box-lifecycle)
  // export { ConversationDO } from "./conversation";           // R-CF-04 (tag v2-conversation)
  // export { CreativeJob } from "./creativeJob";               // R-CF-08 (Workflow creative-job)
  // export { ScheduleRun } from "./workflows/scheduleRun";     // R-CF-11
  // export { FleetSyncBox } from "./workflows/fleetSync";      // R-CF-11
  // Each class calls applyEnv(this.env) first in every fetch, alarm, RPC method and run() (§2.5 C3).

  /** The SELF target (§2.5 C1): { "binding": "SELF", "service": "airv2-app", "entrypoint": "Internal" }. */
  export class Internal extends WorkerEntrypoint<CloudflareEnv> {
    async fetch(request: Request): Promise<Response> {
      const nextEnv = applyEnv(this.env);                         // §2.5 C3: first statement
      return openNext.fetch(request, nextEnv, this.ctx);          // no switch, no proxyToVercel, no x-air-* strip
    }
  }

  export default {
    fetch: createFetchHandler({ openNext, buildSha: BUILD_SHA, applyEnv, envError, envDigest }),
    // Every handler calls applyEnv(env) first:
    // async scheduled(controller, env, ctx) { applyEnv(env); await runScheduled(controller, env, ctx); },  // R-CF-11 (SELF → Internal, Bearer CRON_SECRET)
    // async queue(batch, env, ctx) { applyEnv(env); await consumeDeferred(batch, env, ctx); },            // R-CF-06 (air-deferred, air-deferred-dlq; §2.5 C7)
  } satisfies ExportedHandler<CloudflareEnv>;
  ```
  - `Internal` is reachable only through a service binding; no route or hostname maps to it. Its URLs carry the real public host (`new URL(path, env.appOrigin())`, or `env.miniappOrigin()` for mini routes), so middleware host routing works. The request never leaves the Worker.
  - There is no `self` host, no `x-air-self` or `x-air-cron` marker, and no path allowlist (§2.5 C1). Routes behind `requireCron` (`/api/cron/*`) still need `Authorization: Bearer ${CRON_SECRET}` from the caller.
  - Use `@ts-expect-error` with a description, not `@ts-ignore`. The repo uses that form, and `eslint . --max-warnings 0` (`package.json:10`, `next/typescript` `ban-ts-comment`) rejects bare `@ts-ignore`.
  - The directive holds before and after a build. OpenNext copies only `worker.js` (no `.d.ts`) into `.open-next/` (`dist/cli/build/utils/copy-package-cli-files.js`), so TS reports TS2307 (missing) or TS7016 (untyped) either way.
  - This follows the OpenNext custom-worker pattern (opennext.js.org/cloudflare/howtos/custom-worker, verify URL). OpenNext 1.20.10 `templates/worker.js:10-15` exports a default `{fetch}` plus the three DO classes.
- `apps/web/worker/tsconfig.json`, `apps/web/worker/worker-configuration.d.ts` — NEW. The second is generated by `npx wrangler types --env-interface CloudflareEnv worker/worker-configuration.d.ts` and committed (§2.5 C4). Nobody hand-edits it, and no `cloudflare-env.d.ts` exists. Wiring is in R-CF-13.
  - Land R-CF-13's `tsconfig.json` and `eslint` excludes in this PR, because root `tsconfig.json:30` includes `**/*.ts` and would typecheck `worker/` without workers types.
  - Root code that touches bindings (R-CF-12 `selfFetch`) uses a local structural type such as `{ SELF?: { fetch(r: Request): Promise<Response> } }`, so the root tsconfig never needs workerd runtime types.
- `apps/web/package.json` — add two scripts from R-CF-13's canonical set:
  - `"typecheck": "tsc --noEmit && tsc -p worker/tsconfig.json --noEmit"` (replacing `tsc --noEmit`, `:9`);
  - `"cf:types": "wrangler types --env-interface CloudflareEnv worker/worker-configuration.d.ts"`.

  The other `cf:*` scripts, `cf:build` (§2.5 C17) included, land with R-CF-13.
- `apps/web/wrangler.jsonc` — illustrative end state (§2.5 C10). Each block's values belong to the item named in its comment, and that item's values win.
  - This PR ships the lines tagged R-CF-02. R-CF-01's `secrets.required` and R-CF-12's flags and `upload_source_maps` are already on main (§4 P1 order).
  - R-CF-02 owns `SELF` (§2.5 C1). If R-CF-12 merged a plain `SELF` entry, this PR adds `"entrypoint": "Internal"` to it.
  - The other blocks land with their items. A resource or side Worker exists before it is bound (R-CF-13 `ensure-resources` and side-worker deploys, §2.5 C18), because wrangler rejects bindings to classes, queues or Workers that do not exist yet.
  - R-CF-02 itself binds only things that exist today: the `HOSTING` namespace, version metadata, and this script (`SELF`).
  ```jsonc
  {
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "airv2-app",
    "main": "worker/entry.ts",                                            // R-CF-02
    "compatibility_date": "2026-10-12",
    "compatibility_flags": ["nodejs_compat", "enable_nodejs_process_v2",
                            "enable_request_signal", "global_fetch_strictly_public"],   // R-CF-12 (j); R-CF-07 relies on enable_request_signal
    "upload_source_maps": true,                                           // R-CF-12 (j)
    "workers_dev": true,                                                  // R-CF-14 P6 → false
    "preview_urls": false,
    "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
    "define": { "__AIR_BUILD_SHA__": "\"dev\"", "__AIR_BUILT_AT__": "\"\"" },   // R-CF-02 (§2.5 C5); CI --define overrides (R-CF-13)
    "limits": { "cpu_ms": 60000 },                                        // R-CF-02 start; R-CF-15 tunes (Paid max 300000)
    "vars": {
      "UPSTREAM_VERCEL": "https://airv2.vercel.app",                      // rollback-proxy target; md value overrides
      "SWITCH_HOSTS": "app.wzrd.tech,mini.wzrd.tech,link.wzrd.tech"       // only these honour HOSTING.target; the first serves /_switch
    },                                                                    // AIR_PUBLIC_ORIGIN (old :14) removed here, and only here (§2.5 C1)
    "secrets": { "required": ["AIR_ENV_00","AIR_ENV_01","AIR_ENV_02","AIR_ENV_03",
                              "AIR_ENV_04","AIR_ENV_05","AIR_ENV_06","AIR_ENV_07","AIR_ENV_DIGEST"] },  // R-CF-01
    "kv_namespaces": [{ "binding": "HOSTING", "id": "61b51af0f1da4cda8dd6449c845ac01e" }],              // R-CF-02
    "version_metadata": { "binding": "CF_VERSION_METADATA" },                                            // R-CF-02
    "services": [
      { "binding": "SELF", "service": "airv2-app", "entrypoint": "Internal" },   // R-CF-02 (§2.5 C1): selfFetch (R-CF-12), R-CF-04/05/06/11
      { "binding": "SIDECAR", "service": "air-sidecar" },                 // R-CF-03
      { "binding": "BUILD", "service": "air-build" }                      // R-CF-10
    ],
    "queues": {                                                           // R-CF-06 owns values (§2.5 C7)
      "producers": [{ "binding": "DEFERRED", "queue": "air-deferred" }],
      "consumers": [
        { "queue": "air-deferred", "max_batch_size": 1, "max_retries": 8, "retry_delay": 30,
          "max_concurrency": 25, "dead_letter_queue": "air-deferred-dlq" },
        { "queue": "air-deferred-dlq" }                                   // R-CF-06 sets its batch/retry values
      ]
    },
    "durable_objects": { "bindings": [
      { "name": "BOX_LIFECYCLE", "class_name": "BoxLifecycle" },          // R-CF-05 (P2)
      { "name": "CONVERSATION", "class_name": "ConversationDO" }          // R-CF-04 (P3)
    ] },
    "migrations": [                                                       // append-only, in merge order; later classes take the next vN-<name> (§2.5 C8)
      { "tag": "v1-box-lifecycle", "new_sqlite_classes": ["BoxLifecycle"] },     // R-CF-05
      { "tag": "v2-conversation", "new_sqlite_classes": ["ConversationDO"] }     // R-CF-04
    ],
    "workflows": [                                                        // names and retention set by the owning item (§2.5 C9)
      { "name": "creative-job", "binding": "CREATIVE_JOB", "class_name": "CreativeJob",
        "default_retention": { "success_retention": "1 hour", "error_retention": "1 day" } },   // R-CF-08
      { "name": "air-schedule-run", "binding": "SCHEDULE_RUN", "class_name": "ScheduleRun" },   // R-CF-11 (sets retention)
      { "name": "air-fleet-sync", "binding": "FLEET_SYNC", "class_name": "FleetSyncBox" }        // R-CF-11 (sets retention)
    ],
    "images": { "binding": "IMAGES" },                                    // R-CF-09
    "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "air-media" }],   // R-CF-09 (R-CF-10 reuses it)
    "triggers": { "crons": ["* * * * *", "*/5 * * * *", "*/10 * * * *", "15 * * * *", "30 * * * *", "0 */6 * * *"] },  // R-CF-11 (vercel.json:1-36)
    "routes": [{ "pattern": "app.wzrd.tech", "custom_domain": true }],    // R-CF-14 P4; then mini.wzrd.tech, link.wzrd.tech (P5)
    "observability": { "enabled": true }                                  // R-CF-15 replaces this block (logs, traces, redaction)
  }
  ```
- `apps/web/lib/http/edge.ts` — NEW. The single edge-trust module (§2.5 C11); no `edge-proxy.ts` exists. Edge-runtime-safe: no `node:` imports, because middleware runs on Vercel's Edge runtime.
  - `trustedOriginHost(headers): string | null`.
  - Returns the `x-air-origin-host` value only when both of these hold:
    - `x-air-edge-auth` matches `env.edgeProxySecret()` under a constant-time compare: UTF-8 encode both values, XOR every byte over the expected secret's length (out-of-range bytes read as 0), OR in the length difference, and test the result once. There is no early exit.
    - `x-air-origin-host` is the host of `env.appOrigin()`, `env.miniappOrigin()` or `env.linkappOrigin()`.
  - Returns `null` when `EDGE_PROXY_SECRET` is unset.
  - Consumers: `middleware.ts` and `lib/http/origin.ts` (below). R-CF-12's `clientIp()` uses the middleware marker that this check produces.
  - §2.5 C11 names `node:crypto` `timingSafeEqual` over sha256 digests. This module cannot import `node:crypto`:
    - middleware imports it, and on Vercel middleware runs on the Edge runtime, which has no `node:crypto` (`lib/miniapps/reserved.ts:9-10`; nextjs.org/docs/messages/node-module-in-edge-runtime);
    - OpenNext 1.20.10 does not run Node.js middleware.
    - So edge.ts keeps C11's contract (one module, one function, constant time) with a dependency-free compare. `switch.ts` keeps `node:crypto`, because it runs only on workerd.
- `apps/web/lib/env.ts` — add the accessor `edgeProxySecret: (): string | null => process.env["EDGE_PROXY_SECRET"] || null` if it is absent. The name is already in `OPTIONAL_ENV` from R-CF-01.
- `apps/web/middleware.ts`:
  - `:56` → `const originHost = trustedOriginHost(request.headers); const host = originHost ?? request.headers.get("host") ?? "";`.
  - After `:74`:
    ```ts
    const clientIp = originHost ? request.headers.get("x-air-client-ip") : null;
    headers.delete("x-air-origin-host"); headers.delete("x-air-edge-auth"); headers.delete("x-air-client-ip");
    headers.delete("x-air-host"); headers.set("x-air-host", host);
    if (clientIp) headers.set("x-air-client-ip", clientIp);
    ```
    - These are middleware-owned markers, the same pattern as `x-mini-host`.
    - Middleware strips only these four. On Cloudflare, any other `x-air-*` header that reaches OpenNext came through `Internal`, because the public fetch strips every inbound one (§2.5 C1). R-CF-06 and R-CF-11 depend on those headers.
  - Route handlers never see `x-air-edge-auth`. R-CF-12's `clientIp()` reads `x-air-client-ip` on Node as this middleware marker, in `lib/security/limits.ts:282-295` (`pairAttemptSource`) and `app/mini/[app]/route.ts:471-473` (guest rate limit).
  - `:149-152` and `:166-168` — always return `NextResponse.next({ request: { headers } })`. The bare `NextResponse.next()` would forward the client's unstripped `x-air-*` headers and drop `x-air-host`.
- `apps/web/lib/http/origin.ts:59` → `forwardedHost: request.headers.get("x-air-host") ?? trustedOriginHost(request.headers) ?? request.headers.get("x-forwarded-host")`.
  - Prefer the host that middleware resolved. `trustedOriginHost` covers callers that bypass middleware. The raw value is the last fallback, for tests only. Middleware always sets `x-air-host`, so a client-set `x-forwarded-host` on a direct CF request is ignored, and `origin.ts` is its only app reader.
  - Update the header comment (`:1-12`): the forwarded host is now the trusted original host, not "the proxy-forwarded host Vercel presents".
- `apps/web/app/api/version/route.ts` — NEW: `GET → { sha: env.buildSha(), host: runtimeHost(), target: null }`, with `cache-control: no-store` and `export const dynamic = "force-dynamic"`.
  - `env.buildSha()` (R-CF-12, §2.5 C5) returns `process.env.AIR_BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null`. `runtimeHost()` comes from `lib/runtime/platform.ts` (§2.5 C2).
  - Vercel serves this route. On Cloudflare the public entry answers first, and an `Internal` call that reaches the route reports `host:"cloudflare"`.
- `infra/workers/app-switch/` — NEW, the vendored source of the deployed app-switch (§2.5 C19). Land it as the first commit of this PR, because the port is checked against it.
  - `src/index.js`: the downloaded bundle, verbatim. Fetch it read-only, with `npx wrangler init app-switch --from-dash app-switch` into a scratch dir or with the CF API script-content endpoint (§1.2).
  - `wrangler.jsonc` contains:
    - `name: "app-switch"`, `main: "src/index.js"`, and the compat date the API reports;
    - KV `HOSTING` → `61b51af0f1da4cda8dd6449c845ac01e`;
    - vars `UPSTREAM_CF` and `UPSTREAM_VERCEL` with their live values;
    - `secrets.required: ["SWITCH_TOKEN"]`;
    - **no `routes`**. Delete any route that `--from-dash` writes.
  - `README.md` records the live routes (from Workers → app-switch → Domains & Routes). That is the only place they appear, so a deploy can never re-take a hostname.
  - R-CF-13 adds the `workers.yml` dry-run check. R-CF-14 retires the live script after the soak.
  - Deploys are manual and owner-only (§2.5 C19, C22): `npx wrangler deploy` in that dir, as the independent kill switch. Never auto-deploy it. Using it after P4 means the owner re-adds a route in the dashboard (R-CF-14 runbook), never in this config.

**Acceptance.**
- [ ] After the first deploy (owner-run, below, or R-CF-13's workflow), workers.dev `GET /api/version` returns 200 `{sha:<deployed SHA>, host:"cloudflare", target, switch_host:false, worker_version, env_digest}` with `cache-control: no-store`.
  - It does not invoke `openNext.fetch` (unit test).
  - It is unchanged when local KV says `vercel` (`wrangler dev`).
- [ ] `/_switch`, under `wrangler dev` with local KV, never the production namespace (§2.5 C22):
  - No bearer or a wrong bearer → 401 `{"error":"unauthorized"}`.
  - With no `SWITCH_TOKEN` binding and no packed value, `Bearer undefined` → 401.
  - The correct bearer on GET → 200 with `target` and `source`.
  - POST `{target:"vercel"}` against a healthy local upstream at the same SHA → 200. `npx wrangler kv key get target --binding HOSTING --local` then prints `vercel`.
- [ ] POST `{target:"vercel"}` (§2.5 C12):
  - An upstream that is down or answers 402/5xx → 409 `upstream_unhealthy`, with or without `force:true`.
  - An upstream 404 or a different SHA → 409 `sha_mismatch` with `warning`. With `force:true` → 200 with `warning`.
- [ ] With target=vercel on a switch host, tested locally: `wrangler dev` plus a local `next start` of this branch, both sides with the same `EDGE_PROXY_SECRET`.
  - Mini-host paths render through the upstream with mini routing intact, because middleware saw a trusted `x-air-origin-host` (unit tests plus the local probe).
  - An absolute upstream `Location` is rewritten to the original host.
  - Responses carry `x-served-by: app-switch:vercel`.
  - Vault POSTs with `Origin: https://app.wzrd.tech` pass `isSameOriginRequest`.
  - The same checks against the live Vercel project are conditional: run them only once the owner unblocks Vercel and it serves this SHA (§6). Otherwise record N/A in the PR.
- [ ] With target=vercel:
  - workers.dev requests are served by OpenNext;
  - `SELF` requests enter `Internal`, which never consults the switch and keeps `x-air-*` headers;
  - `POST /api/creative/fal-webhook` on a switch host never reaches `proxyToVercel`.
  - All three are covered by unit tests.
- [ ] KV reads stay at ≤ 1 per isolate per 30 s (KV analytics or a log sample). A KV failure serves the last target without a 5xx.
- [ ] A corrupted pack (locally, hand-edit one slot in `.dev.vars`) gives 503 `env_unavailable` on OpenNext paths. `/_switch` (token from the individual secret), `/api/version` and proxy mode keep working.
- [ ] A forged `x-air-origin-host`/`x-air-client-ip`/`x-air-host`/`x-air-edge-auth` sent to Cloudflare is stripped by the public fetch. On the Vercel side, one without a valid `x-air-edge-auth` changes nothing and is stripped by middleware before route handlers.
- [ ] `wrangler dev` output shows JSON `env.unpack` and `switch.flip` lines (§2.5 C16), with no value in them.
- [ ] `npx wrangler deploy --dry-run --outdir .wrangler/dist` succeeds with `main: worker/entry.ts`. `infra/workers/app-switch` dry-runs too.

**Tests.**
- `apps/web/worker/switch.test.ts` (calls `__resetSwitchCacheForTests` in `beforeEach`):
  - Bearer compare: empty token, wrong length, correct. The binding token is preferred over `process.env`.
  - GET, POST, 400 (both §1.2 bodies), 405, with app-switch's exact error strings. A mixed-case `target` is accepted.
  - Host gating: `/_switch` is answered on the first `SWITCH_HOSTS` entry and on workers.dev. On a mini-host or link-host URL, `servesSwitchApi` is false.
  - Upstream probe outcomes:
    - 2xx at the same SHA → write;
    - 2xx at another SHA, and 404 → 409 `sha_mismatch`, and `force:true` → 200 with `warning`;
    - 402, 5xx and timeout → 409 `upstream_unhealthy` even with `force:true`.
  - The bypass header is sent when its secret is set.
  - A write logs one `switch.flip` line `{from, to, forced}`.
  - Fake timers: 100 requests in 30 s cause 1 `HOSTING.get`. The stale path calls `ctx.waitUntil`. A KV throw while warm gives the last target with `source:"stale"`; while cold, `cloudflare` with `source:"error"`.
  - A missing key gives `vercel` with `source:"default"`. A garbage value gives `vercel` with `source:"default"`.
- `apps/web/worker/proxy.test.ts`:
  - Every DROP pattern is removed, including `connection`, `cdn-loop` and inbound `x-air-*`.
  - The added headers are present. Edge-auth and bypass appear only when their secrets are set.
  - `redirect:"manual"` is passed.
  - The POST body is streamed (ReadableStream identity).
  - Location rewrite: an absolute upstream host is rewritten; a relative path and a foreign host are untouched.
  - `x-served-by` is `app-switch:vercel`. One `proxy.upstream` line per request.
  - Loop guard: an upstream equal to the request host or to any `SWITCH_HOSTS` entry → 508. A fetch throw → 502 JSON.
- `apps/web/worker/handler.test.ts` (mock `openNext.fetch`):
  - Order:
    - `applyEnv` runs first, exactly once per invocation;
    - inbound `x-air-*` headers are gone before `/_switch`, the proxy and OpenNext;
    - `/_switch` and `/api/version` come before the switch;
    - `POST /api/creative/fal-webhook` with target=vercel on a switch host goes to `falWebhook` (or OpenNext) and never to the proxy;
    - a non-switch host is never proxied;
    - `/_next/image` is 404 on the Cloudflare branch and proxied in Vercel mode;
    - an env error gives 503.
  - With a real `createApplier`, the env handed to OpenNext lacks `AIR_ENV_*` and a shadowed `UPSTREAM_VERCEL`.
- `apps/web/worker/entry.test.ts` — NEW. Later items add their cases here: R-CF-06 `queue`, R-CF-11 `scheduled`, R-CF-15 log lines.
  - `vitest.config.ts` gets two `resolve.alias` entries for this file's imports:
    - `cloudflare:workers` → `worker/test/cloudflare-workers.ts`, which provides an `env` object and a `WorkerEntrypoint` base class that stores `ctx` and `env`;
    - `/^\.\.\/\.open-next\/worker\.js$/` → `worker/test/open-next-worker.ts`, which provides a default `{ fetch }` plus the three DO class stubs.
  - Cases:
    - `Internal.fetch` calls `applyEnv` before `openNext.fetch`, hands OpenNext the stripped env, and keeps every `x-air-*` header. This holds while KV says `vercel` and the URL host is `app.wzrd.tech`.
    - After that call, `cfEnv()` (R-CF-12) returns the env that OpenNext received.
    - The `env.unpack` line is JSON with `msg:"env.unpack"`. A sentinel pack value never appears in captured console output.
- `apps/web/lib/http/edge.test.ts`:
  - The correct secret with an app, mini or link host returns that host.
  - These return `null`: a wrong secret, a wrong-length secret, a foreign host, and an unset `EDGE_PROXY_SECRET`.
- `apps/web/middleware.test.ts` (existing `process.env` + `x-middleware-request-*` pattern):
  - A request with `host: airv2.vercel.app` and a trusted `x-air-origin-host: mini.wzrd.tech` rewrites to `/mini` (`x-middleware-rewrite`).
  - The same request with a bad secret is treated as the main host.
  - `x-middleware-request-x-air-host` is always set.
  - `x-middleware-request-x-air-client-ip` is present only when trusted.
  - Middleware leaves `x-air-*` names outside its four markers untouched (e.g. `x-air-defer-attempt`).
  - A main-host `/api/*` path now carries `x-middleware-override-headers`.
- `apps/web/lib/http/origin.test.ts`:
  - `x-air-host` is preferred over `x-forwarded-host`.
  - A forged `x-forwarded-host` + matching Origin is rejected when `x-air-host` is set.
  - Without `x-air-host`, a trusted edge pair supplies the host.
- `apps/web/app/api/version/route.test.ts` — returns `env.buildSha()` and `runtimeHost()`, with `cache-control: no-store`.
- Manual probes, local (Devin):
  1. Run `npm run cf:env -- dev`. Leave `UPSTREAM_VERCEL` empty in the md for this probe, because a packed value wins over `--var`.
  2. Build with `npm run cf:build` once R-CF-13 lands. Until then run the same steps by hand: `npx tsx scripts/cf-guard.ts pre && AIR_BUILD_TARGET=cloudflare npx opennextjs-cloudflare build && npx tsx scripts/cf-guard.ts post` (§2.5 C17).
  3. After the CF build, start the upstream with `npm run build && npm run cf:env -- dev -- env AIR_BUILD_SHA=dev npx next start -p 3000`.
  4. Run `npx wrangler dev --var SWITCH_HOSTS:localhost --var SWITCH_TOKEN:local-test --var UPSTREAM_VERCEL:http://127.0.0.1:3000`.
  - Run `npx wrangler kv key put target vercel --binding HOSTING --local` and `curl -i localhost:8787/login`. Expect `x-served-by: app-switch:vercel` and the upstream body, while `curl -s localhost:8787/api/version` still reports the local build.
  - POST `/_switch` with `Authorization: Bearer local-test`:
    - `{"target":"vercel"}` → 200 (both sides are `dev`);
    - stop `next start` → 409 `upstream_unhealthy`;
    - restart it without `AIR_BUILD_SHA` → 409 `sha_mismatch`, then `force:true` → 200 with `warning`.
    - Read `npx wrangler kv key get target --binding HOSTING --local` after each write.
- Manual probe, owner-run (§2.5 C22, because it writes the production key): on workers.dev or at R-CF-14 T0, run `npx wrangler tail airv2-app --format pretty` while flipping the target via `/_switch`, and watch for `switch.flip` and `proxy.upstream`.

**Risks & notes.**
- **The kill switch shares a failure domain with the app.** A module-evaluation crash in OpenNext, or a bad bundle, takes `/_switch` and the proxy down with it.
  - Fail-soft unpack and the individual `SWITCH_TOKEN` remove env as a cause.
  - The independent paths are:
    - (a) the vendored app-switch, which the owner deploys and routes by hand (§2.5 C19, C22);
    - (b) DNS (Rollback B, R-CF-14, frozen via `AIRV2_ROLLBACK_B`, §2.5 C21);
    - (c) `wrangler rollback` (R-CF-13).
- **A flip is not atomic.** The ~30 s isolate cache plus KV propagation (up to ~60 s) means ~90 s of mixed hosting. That relies on `inbound_events` dedupe and `claimFlush` idempotency. Crons do not move with the flip: `scheduled()` reaches routes through `SELF` → `Internal`, and the single-valued `cron_host` row means only one host runs crons (§2.5 C13).
- **Static assets bypass the Worker.** CF assets are served before the Worker (`run_worker_first` defaults to false), even in proxy mode.
  - When Vercel HTML references hashes missing from the CF build, the asset lookup misses, falls through to the Worker and is proxied. So content-hashed `/_next/static` is safe.
  - Unhashed `public/creator-os/*.js` can skew when the Vercel and CF SHAs differ.
  - `public/vendor/*` and `public/*.sh` shadow same-named mini slugs on `mini.wzrd.tech`, which Vercel's matcher (`middleware.ts:238-242`) did not do. R-CF-12 owns reserved slugs and `public/_headers`.
  - Revisit `assets.run_worker_first` after a preview test of OpenNext 1.20.10 worker-first asset serving (verify).
- **`EDGE_PROXY_SECRET` handling.**
  - It must be identical in the md and on the Vercel project.
  - It must never be logged or forwarded to clients. The public fetch strips any inbound copy, middleware strips it before route handlers, and the entry adds it only on the upstream hop.
- **C11 and the Edge runtime.** `lib/http/edge.ts` keeps C11's single module and function, but compares without `node:crypto` (see Deltas). If middleware ever moves to the Node runtime on both hosts, switch it to `createHash` + `timingSafeEqual`.
- **`Internal` trusts its callers.** Any Worker on the account can bind `Internal`, but only airv2-app's own `SELF` should, because `Internal` skips the switch and the `x-air-*` strip. R-CF-14's `CONTROL_PLANE` bindings for air-muse and air-outbound therefore target the default entrypoint.
- **No WebSocket proxying.** `new Response(res.body, res)` cannot carry a WebSocket upgrade. No WebSocket is known on app, mini or link (create live sockets use `create.wzrd.tech`), so none is proxied (verify).
- **First deploy before R-CF-13.** The owner runs this once from a clean `main` checkout. It needs the owner's Cloudflare credentials, and the packs that the owner's `cf:env -- push` created (`secrets.required`; §2.5 C22). The alternative is to merge R-CF-13 and let its first workflow run do the deploy.
  ```sh
  npx tsx scripts/cf-guard.ts pre && AIR_BUILD_TARGET=cloudflare npx opennextjs-cloudflare build && npx tsx scripts/cf-guard.ts post \
    && OPEN_NEXT_DEPLOY=true npx wrangler deploy --tag "$(git rev-parse HEAD)" \
       --define "__AIR_BUILD_SHA__:\"$(git rev-parse HEAD)\"" --define "__AIR_BUILT_AT__:\"$(date -u +%FT%TZ)\""
  ```
- **From R-CF-12, merged earlier in P1 (§4).** This item imports these and does not redo them:
  - `lib/runtime/platform.ts` (`setCfEnv`, `cfEnv`, `runtimeHost`);
  - `lib/http/self.ts` `selfFetch` through `SELF`;
  - `env.buildSha()` and `env.buildDeployedAt()`, which read `process.env.AIR_BUILD_SHA` / `AIR_BUILT_AT`;
  - `sharedBridge.ts:203` on `selfFetch`;
  - the `# AIR_BUILD_SHA=` and `# AIR_BUILT_AT=` reference lines in the hand-edited `env.example.md` (§2.5 C20).
- **Merge check.** Diff the port's `/_switch` bodies, status codes and `x-served-by` against the vendored `src/index.js`. `switch.test.ts` asserts §1.2's bodies.

**Depends on.** R-CF-01 (`worker/env-pack.ts` applier, the `## secret @airv2-app` section), R-CF-12 (`lib/runtime/platform.ts` `setCfEnv`/`runtimeHost`, `env.buildSha()`).
