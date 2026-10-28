# R-CF-12 — Runtime compatibility fixes

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-12: …`.

**Why.** These are the small cross-cutting breaks still left on Workers Paid after the subsystems move, and most fail silently. The only self-fetch is `lib/orchestrator/sharedBridge.ts:203-204`, which feeds every iMessage quick-ack, initial reply and bridge reply. A Worker fetching its own Custom Domain gets a 522 ([CF 522](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/)); before P4 the same URL lands on the blocked Vercel team; and the catch returns `null` either way. Workers guarantee only `cf-connecting-ip` as the client IP. `x-forwarded-for` is added by the proxy after Workers run ([transform rules](https://developers.cloudflare.com/rules/transform/request-header-modification/)), and `x-real-ip` is documented only for Worker subrequests ([CF headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)). So the pairing and pay-link throttle (`lib/security/limits.ts:282-295`) and the guest limiter (`app/mini/[app]/route.ts:471-473`) key on `"unknown"` or on a value the client chose (verify in (n)). In proxy mode, Vercel overwrites both headers with the Cloudflare egress IP. Four more problems:
- `VERCEL_*` values never exist on Workers (`lib/env.ts:395-398,836-841`).
- `validateEnv` reads runtime `NODE_ENV` (`lib/env.ts:269`), which OpenNext never sets, so fail-fast drops to a warning.
- Module-scope `sharp`/`heic-convert` imports (`lib/identity/references.ts:7`, `lib/miniapps/identityThumb.ts:20`, `lib/identity/heif.ts:9`) crash all 14 route entries whose static graph reaches them, including `/mini/[app]` and `/api/inbound/imessage`.
- Static assets bypass `next.config.ts:34-58` `headers()`.

Paid has no 10 ms CPU or 50-subrequest cap, so `scryptSync` and the other CPU-heavy code stay as they are.

**Deltas.**
- **(a) Self-calls → `SELF` service binding**
  - `apps/web/lib/runtime/platform.ts` NEW. This item owns it and lands first in P1 (§2.5 C2). It exports exactly these names:
    - `onWorkerd(): boolean` is `navigator.userAgent === "Cloudflare-Workers"`.
    - `runtimeHost(): "cloudflare" | "vercel" | "node"` returns `"cloudflare"` when `onWorkerd()` is true, `"vercel"` when `process.env.VERCEL_REGION` is set (Vercel injects it, §1), and `"node"` otherwise (`next dev`, vitest).
    - `setCfEnv(env)` stores `env` at `globalThis[Symbol.for("air.cfEnv")]`. R-CF-02's `applyEnv` calls it as the first statement of every entrypoint (§2.5 C3). The global key is needed because lib code is bundled twice: once in the Next chunks and once in the wrangler entry bundle.
    - `cfEnv(): AirCfEnv | null` returns `globalThis[Symbol.for("air.cfEnv")] ?? getCloudflareContext({ async: false })?.env ?? null`. It swallows the error that `getCloudflareContext()` throws outside an OpenNext request. It is sync; never call it at module scope. Code that can run inside a DO, a Workflow, `queue()` or `scheduled()` reads bindings only through `cfEnv()`.
    - `cfWaitUntil(p)`: inside an OpenNext request on workerd it calls the request's `ctx.waitUntil(p)`; otherwise it runs `void p.catch(…)` and logs the error. It is for short best-effort work only. The 30 s cap applies, and R-CF-06's `defer` owns anything longer.
    - `AirCfEnv` is the root-code view of the generated `CloudflareEnv` (§2.5 C4). It is a structural type with every binding optional, starting with `SELF?: { fetch(input: Request | string | URL, init?: RequestInit): Promise<Response> }` and `CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string }`.
      - The root tsconfig never sees workerd types (R-CF-02). So an item that adds a binding read from root code adds its optional field here, in the same PR.
    - Only this module imports `getCloudflareContext`. Define no `isWorkerd`, `cfContext`, `cloudflareContext` or `requestScope` alias, and create no `lib/runtime/host.ts` (§2.5 C2).
  - `apps/web/package.json`: move `@opennextjs/cloudflare` (`:45`) from `devDependencies` to `dependencies`, because server code now imports it. Its dev-only `wrangler` import is `webpackIgnore`d, so Vercel bundles are unaffected.
  - `apps/web/lib/http/self.ts` NEW (§2.5 C3):
    - Signature: `selfFetch(path: string, init?: RequestInit, opts?: { host?: "app" | "mini" | "link" })`.
    - Throw unless `path` starts with `/`.
    - Build the URL as `new URL(path, env.appOrigin() | env.miniappOrigin() | env.linkappOrigin())`.
      - This is the real public host, never a `self` host and never `AIR_PUBLIC_ORIGIN`. The host matters because middleware routes on `host` (`middleware.ts:56`).
      - The request never leaves the Worker (§2.5 C1).
    - On workerd, call `cfEnv()?.SELF.fetch(url, init)`. If `SELF` is missing, throw `selfFetch: SELF binding missing`. Never fall back to fetching the public host: that gives a 522, or before P4 the blocked Vercel team.
    - Elsewhere (Vercel, `next dev`, vitest), call global `fetch(url, init)`.
    - `SELF` targets R-CF-02's `Internal` entrypoint, which runs `applyEnv` and then OpenNext directly (§2.5 C1). It applies no hosting switch, no `proxyToVercel` and no `x-air-*` strip.
      - So `selfFetch` adds no marker header and no auth of its own. Callers pass their own `Authorization`: `sharedBridge` sends the box gateway token, and `/api/cron/*` callers send `Bearer ${CRON_SECRET}`.
  - `apps/web/lib/orchestrator/sharedBridge.ts:203-204`: replace `fetch(\`${env.appOrigin()}/api/gateway/v1/chat/completions\`, …)` with `selfFetch("/api/gateway/v1/chat/completions", …)`. Keep `signal: requestSignal(options.timeoutMs)`.
    - The call sits in `gatewayCompletion` (`:187`), which backs `sharedBridgeReply`, `quickAckReply`, `initialReply`, `initialResponse` and `progressUpdateReply` (`:70-185`).
    - Callers: `app/api/inbound/imessage/route.ts:445` (`initialResponse`), `lib/orchestrator/flush.ts:1152` (`progressUpdateReply`) and `lib/orchestrator/flush.ts:1435` (`sharedBridgeReply`).
  - This is the only self-fetch. A grep of `app/` and `lib/` for `fetch(` near `env.appOrigin()`, `miniappOrigin()` or `linkappOrigin()` finds nothing else.
    - The other 68 accessor uses only build URLs that boxes, users or third parties call: `lib/provisioning/provision.ts:909,945,970`, `lib/bots/provision.ts:116`, `lib/providers/claude.ts:345`, `lib/provisioning/connectors.ts:109,147,249` and others. Leave them.
  - `apps/web/wrangler.jsonc`: no `SELF` change in this PR. R-CF-02 adds `{ "binding": "SELF", "service": "airv2-app", "entrypoint": "Internal" }` together with the entry (§2.5 C1). Until then, `selfFetch` throws on workerd and the `sharedBridge` catch returns `null`, as it does today.
  - Out of scope here:
    - R-CF-02 owns `/_switch`, including its upstream probe and SHA warning (§2.5 C12).
    - R-CF-14 moves the `CONTROL_PLANE_ORIGIN` callers to service bindings: `infra/workers/muse/wrangler.toml:23`, `infra/workers/outbound/wrangler.toml:16`, `infra/workers/create/src/adapter.ts:31`.
- **(b) Client IP**
  - `apps/web/lib/http/client-ip.ts` NEW: `clientIp(headers): string | null`, validated with `isIP` from `node:net`. Use it from route handlers only; never import it from middleware.
    - On workerd, read `cf-connecting-ip` only. Ignore `x-real-ip`, `x-forwarded-for` and `x-air-client-ip`. The public `fetch` strips every inbound `x-air-*` header anyway (§2.5 C1).
    - On Node, read `x-air-client-ip` first, then `x-real-ip`, then the rightmost `x-forwarded-for` hop (today's order).
      - Only middleware writes `x-air-client-ip` (next bullet). R-CF-02 sets it only for a hop that `trustedOriginHost` accepts (`lib/http/edge.ts`, §2.5 C11).
  - `apps/web/middleware.ts:65-74`: make `x-air-client-ip` a middleware-owned marker, like `x-mini-host`. Add it to `spoofed` and call `headers.delete("x-air-client-ip")`. A client value then never reaches a route, even before R-CF-02 lands.
    - R-CF-02 owns `lib/http/edge.ts`, the `edgeProxySecret()` accessor, and setting the header again from a trusted hop.
    - This item adds no edge-auth helper and no `OPTIONAL_ENV` name. R-CF-01 already lists `EDGE_PROXY_SECRET`.
  - `apps/web/lib/security/limits.ts:282-295`: `pairAttemptSource` hashes `clientIp(headers) ?? "unknown"`. Update the trust-order comment at `:275-281`.
    - Callers are unchanged: `app/api/berd/pair/route.ts:29`, `app/api/buzz/pair/route.ts:30`, `app/mini/link/[slug]/route.ts:132`.
    - Berd and buzz share `kind = "pair_attempt"` (20/h per source, `:62`, `:307-329`). Pay links use 10/min per (link, source) (`:333-354`).
  - `apps/web/app/mini/[app]/route.ts:471-473`: replace the leftmost-XFF read, which clients can spoof, with `clientIp(request.headers) ?? "unknown"`.
  - `apps/web/lib/miniapps/guests.ts:28-44`: keep the in-memory limiter. The grant's `max_uses` is the hard cap, and `:23-27` already says the limiter is per instance.
    - Delete keys whose window is empty.
    - Cap the Map at 10,000 keys, dropping the oldest, so it cannot grow inside the 128 MB isolate.
    - Change the comment to "per isolate on Workers".
  - No change to `recordStoreOpen` (`lib/security/limits.ts:99-112`). A per-isolate 1 s write throttle is still bounded.
  - Contract for R-CF-02: `proxyToVercel` sets `x-air-client-ip: <cf-connecting-ip>` next to `x-air-edge-auth`, because Vercel overwrites XFF and `x-real-ip` with the Cloudflare egress IP.
- **(c) `VERCEL_*` metadata → build SHA** (§2.5 C5)
  - `apps/web/lib/env.ts:836-841`: keep the `vercel*` accessors and add `buildSha: (): string | null => process.env["AIR_BUILD_SHA"] ?? process.env["VERCEL_GIT_COMMIT_SHA"] ?? null`.
    - R-CF-02's entry sets `process.env.AIR_BUILD_SHA` from `BUILD_SHA` in `worker/build-info.ts`, and the wrangler `define` fills `BUILD_SHA`. The entry is always wrangler-bundled, so nothing relies on `define` reaching the Next chunks.
    - Add no build-constants `.d.ts`, no `__AIR_BUILT_AT__` and no generated module.
  - `apps/web/app/api/admin/deployments/route.ts:214-216`:
    - `git_sha: env.buildSha()`.
    - `deployed_at: env.vercelDeploymentCreatedAt() ?? cfEnv()?.CF_VERSION_METADATA?.timestamp ?? null`.
      - On Cloudflare this is the upload time of the live Worker version. R-CF-02 binds `CF_VERSION_METADATA`.
      - A `cf:env push` (`wrangler secret bulk`) creates a new version, so this time can be later than the code deploy.
    - `region: env.vercelRegion() ?? cfColo(request.headers)`. When `onWorkerd()` is true, `cfColo` returns `cf:<COLO>` from the suffix of the `cf-ray` request header; otherwise it returns `null` (verify the suffix on workers.dev).
    - Add `platform: runtimeHost()`. The field is additive; check that the admin repo ignores unknown keys (verify).
  - This item lands first in P1. So R-CF-02 writes its Vercel-side `app/api/version/route.ts` with `env.buildSha()`, and its Cloudflare `/api/version` reports the same `BUILD_SHA`. R-CF-13 passes `--define __AIR_BUILD_SHA__:"<sha>"` (§2.5 C5).
  - Do not use `CF_VERSION_METADATA.tag` as the SHA. `wrangler secret bulk` creates a new version, and nobody has checked whether the tag carries over.
  - `apps/web/env.example.md:505-513`: edit it by hand (§2.5 C20). Point the four reference comments at their Cloudflare replacements. Keep each `(lib/env.ts:N)` citation on the line that reads the name.
    - `VERCEL_GIT_COMMIT_SHA` → `on Cloudflare env.buildSha() reads AIR_BUILD_SHA (R-CF-12); never set`.
    - `VERCEL_DEPLOYMENT_CREATED_AT` → `on Cloudflare deployed_at uses CF_VERSION_METADATA.timestamp (R-CF-12); never set`.
    - `VERCEL_REGION` → `on Cloudflare region is the cf-ray colo (R-CF-12); never set`.
    - `VERCEL_OIDC_TOKEN` → `on Cloudflare set AI_GATEWAY_API_KEY instead (R-CF-12 (d)); never set`.
    - Add a new reference section `## Worker-injected (reference only, never set)` after `## Vercel-injected`. It holds `# AIR_BUILD_SHA=` with the comment `set by worker/entry.ts from the build define (R-CF-02); never set`. R-CF-01 reserves the name, so it can never appear as `NAME=`.
    - `lib/env.example.test.ts` (R-CF-01) enforces the format and the citations.
- **(d) AI gateway key**
  - `apps/web/lib/env.ts:392-398`: on workerd (`onWorkerd()`), `aiGatewayApiKey()` returns `AI_GATEWAY_API_KEY || null` and never falls back to `VERCEL_OIDC_TOKEN`. Vercel behavior is unchanged. Update the doc comment.
  - `apps/web/lib/jev/transport.ts:40-57`: when `pickBackend()` returns `null` on workerd, call `log.warn("jev.unrouted", { reason: "no TYPESAFE_API_KEY / AI_GATEWAY_API_KEY" })` once per isolate (import `../log`). The name has the `<area>.<event>` form (§2.5 C16).
  - `apps/web/env.example.md:46-47`: edit it by hand (§2.5 C20). The comment becomes `# required on Cloudflare unless TYPESAFE_API_KEY is set (lib/env.ts:396)`, with the citation kept on the line that reads the name.
- **(e) Stripe**
  - `apps/web/lib/payments/stripe.ts:13-17`: construct the client as `new Stripe(env.stripeSecretKey(), { httpClient: Stripe.createFetchHttpClient() })`.
  - `apps/web/lib/payments/stripe.ts:21-34`: make `verifyStripeSignature` async and call `await stripeClient().webhooks.constructEventAsync(rawBody, signature, env.stripeWebhookSecret(), undefined, Stripe.createSubtleCryptoProvider())`. Await it at `app/api/inbound/stripe/route.ts:75`.
  - Why it matters even though today works:
    - Stripe is not in `serverExternalPackages` (`next.config.ts:13`), so Next's webpack bundles stripe 22.5.0's node build under its server conditions (`default`), and the sync `constructEvent` works on workerd.
    - If stripe is ever externalized, OpenNext's `workerd` condition selects the worker build. The sync verify then throws, the catch at `stripe.ts:31-32` swallows it, and every webhook gets a 400.
- **(f) DNS-based SSRF guards**
  - `apps/web/lib/kernel/purchases.ts:162-172` (`resolvesOnlyPublicAddresses`): before the `.every()` at `:167`, keep only entries with `isIP(address) !== 0`, and require at least one to remain.
    - This filter is required. workerd 1.20261006.1 `lookup(…, {all:true})` maps every DoH `Answer` entry to `{address: answer.data}` without checking the record type, so a CNAME answer yields a hostname as an "address". Today that fails closed for every CNAME-fronted merchant (e.g. `www.amazon.com`).
    - `BlockList` and `isIP` (`:16-17,123-160`) are native ([CF changelog 2025-01-28](https://developers.cloudflare.com/changelog/post/2025-01-28-nodejs-compat-improvements/)).
    - `{all:true}` is two DoH subrequests (A + AAAA). `hints` throws `ERR_OPTION_NOT_IMPLEMENTED`; `all` and `verbatim` are accepted.
    - The same changelog still says `lookup` throws "Not implemented", which contradicts the workerd source. The node-compat probe below decides. If `lookup` throws on production, switch both guards to `dns.promises.resolve4` + `resolve6` (documented) with the same filter.
  - `apps/web/lib/muse/capabilities.ts:133-136`: apply the same filter before `privateAddress`. `privateAddress` (`:114-120`) runs its `startsWith("fc"|"fd"|"fe80:"|"::ffff:")` checks before `isIP`, so a CNAME target like `fdcdn.example.net.` reads as private and blocks a public download.
- **(g) scrypt**: no change to `apps/web/lib/miniapps/gates.ts:11,124-137`. N=16384 costs about 42 ms CPU and 16 MiB per call, well under the 30 s default CPU.
- **(h) Cross-request promise caches**
  - `apps/web/lib/runtime/single-flight.ts` NEW: `singleFlight<T>(name)` returns `{ run(key, fn), get(key) }`.
    - On Node it uses a process-wide map (today's behavior).
    - On workerd (`onWorkerd()`) it never shares, inside or outside a request: `run` always calls `fn`, and `get` returns `undefined`.
      - §2.5 C2 provides no request-scope accessor.
      - Cross-request dedupe belongs to durable owners, such as R-CF-05's `BoxLifecycle.wake` (§2.5 C8).
    - It clears the entry once the promise settles, only if the entry is still that promise.
  - Why: a promise created in request A is tied to A's I/O.
    - If A finishes or is cancelled first (client disconnect, or an `after()` cut at 30 s), A's subrequests are cancelled, and request B, still awaiting A's promise, never settles. workerd then fails B with "The script will never generate a response" (1101).
    - Sharing I/O objects across requests also throws "Cannot perform I/O on behalf of a different request" ([CF errors](https://developers.cloudflare.com/workers/observability/errors/); continuation rules: `handle_cross_request_promise_resolution`, default since 2024-10-14, [CF compat flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)).
  - Apply the helper to:
    - `lib/orchestrator/boxes.ts:230,267-276` (`wakeWaiters`). Keep the export name and `.get()`, which `lib/orchestrator/wake-waiter.test.ts:125,135` reads.
    - `lib/box/desktop.ts:16-36`. Delete its local `singleFlight`.
    - `lib/masterkey/client.ts:29,123-126` (`inflight`). `tokenCache` at `:28` holds plain data; keep it.
    - `lib/box/tenki.ts:477,490-498` (`resumesInFlight`), for uniformity. It is moot on workerd after R-CF-05.
  - No change:
    - `lib/namespace/client.ts:382` caches resolved values, not promises.
    - `lib/miniapps/themeContext.ts:59` is already request-scoped by AsyncLocalStorage.
  - Owned elsewhere: `lib/spectrum/fast-reaction.ts:25` (`tokenRequest`, R-CF-03) and `lib/create/kit.ts:284,386` (R-CF-10).
  - `apps/web/lib/supabase.ts:12-14`: set `auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }`.
    - auth-js 2.112.2 calls `startAutoRefresh` in non-browser runtimes, so the module singleton starts a 30 s refresh ticker inside the first request's context. Every PostgREST call also goes through `auth.getSession()` and its lock queue.
    - No code uses `supabase.auth` (grep), and `lib/supabase.ts:12` is the only `createClient`.
- **(i) Static assets**
  - `apps/web/public/_headers` NEW. It mirrors `next.config.ts:34-58` plus the immutable rule for `/_next/static`. Keep the `headers()` block for Vercel.
    ```
    /_next/static/*
      Cache-Control: public, max-age=31536000, immutable

    /creator-os/*
      Cache-Control: public, max-age=86400, stale-while-revalidate=604800

    /creator-os/fonts/*
      ! Cache-Control
      Cache-Control: public, max-age=31536000, immutable
    ```
    When a header is set twice its values are joined with a comma, so the font rule detaches the broader one first ([CF _headers](https://developers.cloudflare.com/workers/static-assets/headers/)).
  - `apps/web/lib/miniapps/reserved.ts:14-18`: add `"vendor"` to `PLATFORM_RESERVED`.
    - `public/vendor/**` is served before the Worker, so on `mini.wzrd.tech` it shadows a user named `vendor`, which `USERNAME_RE` allows (`lib/miniapps/nested.ts:13`).
    - `creator-os`, `app-icons` and the `public/*.sh` names cannot be usernames.
    - Check prod first: `select 1 from users where username = 'vendor'` (verify).
- **(j) Compat flags and diagnostics** in `apps/web/wrangler.jsonc:6`:
  ```jsonc
  "compatibility_flags": ["nodejs_compat", "enable_nodejs_process_v2", "enable_request_signal", "global_fetch_strictly_public"],
  "upload_source_maps": true,
  ```
  - This item owns `compatibility_flags` and `upload_source_maps` (§2.5 C10). R-CF-02's end-state config and R-CF-07 only rely on them.
  - `enable_request_signal`: the OpenNext worker template passes `request.signal` to the Next handler, but without the flag the signal never aborts. So `app/api/creative/[jobId]/events/route.ts:57` keeps polling Supabase for up to 480 s after the tab closes.
  - `global_fetch_strictly_public`: from P4 the Worker is in the `wzrd.tech` zone. Without the flag, same-zone `fetch()` goes straight to the origin, skipping Workers and security settings, or fails with 1042 ([CF compat flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/), [CF errors](https://developers.cloudflare.com/workers/observability/errors/)).
    - Affected hosts: `muse.wzrd.tech` (`lib/env.ts:746`), `api.wzrd.tech` (`:467`), `mcp.mail.wzrd.tech` (`:470`), `connector.wzrd.tech` (`:491`), `media.wzrd.tech` (`:596`), `apps.wzrd.tech` (`:606,619`), `create.wzrd.tech` (`:639`).
  - Do not add `cache` / Workers Cache. Its key excludes the host, so it would cross-serve `app.`/`mini.`/`link.` content.
- **(k) Dependency ranges**
  - `apps/web/package.json:29`: next `^15.5.26` → `^15.5.27`.
  - `apps/web/package.json:68`: wrangler `^4.0.0` → `^4.148.0`.
  - These match `@opennextjs/cloudflare` 1.20.10's peerDependencies (`next >=15.5.27 <16 || >=16.3.8`, `wrangler ^4.148.0`). Keep `^1.20.10` (`:45`).
  - Run `npm install --package-lock-only` at the repo root. The lockfile already resolves next 15.5.27 (`package-lock.json:19483`), wrangler 4.149.0 (`:24872`) and the adapter at 1.20.10 (`:5700`).
- **(l) OpenNext caching**: keep `apps/web/open-next.config.ts:3` as `defineCloudflareConfig({})` (dummy caches).
  - The app has no ISR, `revalidate` or `"use cache"`. On Paid, re-rendering the 8 non-dynamic pages costs a few ms.
  - Do not switch to `staticAssetsIncrementalCache` in this PR. It only works when the deploy runs populateCache (`.open-next/cache` → `assets/cdn-cgi/_next_cache`), and a plain `wrangler deploy` skips that silently.
  - If it is adopted later, deploy through `opennextjs-cloudflare deploy` and add a CI check that the directory exists.
  - Do not add the KV, R2 or D1 caches, or `WORKER_SELF_REFERENCE`.
- **(m) Lazy poison imports** (stop-gap until R-CF-09/R-CF-10 replace the packages)
  - OpenNext evaluates each route's static graph lazily. A module-scope throw (sharp's native load, libheif's `new WebAssembly.Module(bytes)`; runtime WASM compile is not allowed) returns 500 for every route whose graph reaches that module.
  - Today that is 14 entries for sharp/heic. About 19 more statically reach esbuild/tailwind (load-only, verify), including `/api/decisions`, which `/home` polls every 60 s.
  - Move each import to the call site, following `lib/create/icon.ts:173`, and keep types via `import type`:
    - `lib/identity/heif.ts:9` → `const { default: convert } = await import("heic-convert")` inside `heifToJpeg`/`heifToPng` (`:46`, `:55`).
    - `lib/identity/references.ts:7` → `await import("sharp")` inside `composeReferenceSheet` (`:198`, uses at `:212`, `:219`).
    - `lib/miniapps/identityThumb.ts:20` → `await import("sharp")` at the resize (`:75`).
    - `lib/miniapps/freeze.ts:11,23` → import `node:child_process` and `ffmpeg-static` inside the stitch helpers (`:1010`, `:1219`), and build `execFileAsync` (`:991`) lazily.
    - `lib/create/build.ts:22` → `await import("esbuild")` at `:604` and `:894`, with `esbuild.Plugin`/`esbuild.Message` via `import type`.
    - `lib/create/css.ts:11` → `await import("tailwindcss")` inside `utilityCss` (`:213`, call at `:227`).
    - Leave `lib/box/client.ts:20` (`./tenki`) to R-CF-05.
  - After this, those code paths fail only when called. The callers already tolerate failure, e.g. `lib/miniapps/drawCommand.ts:105` `heifToJpeg(…).catch(() => undefined)`.
  - `apps/web/lib/runtime/poison-imports.test.ts` NEW:
    - Walk value imports (skip `import type` and all-type named imports; follow `export … from` and `require()`; do not follow dynamic `import()`). Resolve `@/` and relative specifiers.
    - Entries: `app/**/{route.ts,page.tsx,layout.tsx}`, `middleware.ts`, `instrumentation.ts`. Skip `lib/miniapps/client/**` and `*.test.*`.
    - POISON: `sharp`, `heic-convert`, `ffmpeg-static`, `node:child_process`, `child_process`, `esbuild`, `tailwindcss`, `@tenkicloud/sandbox`, `@connectrpc/connect-node`, `@grpc/grpc-js`, `spectrum-ts`, `@photon-ai/advanced-imessage`, including subpaths.
    - The gRPC and Tenki packages load fine but every call fails. Keeping them out of static graphs also cuts cold-start evaluation.
    - Fail when an entry reaches a POISON specifier except through an edge in `ALLOWLIST` (`"<file>:<line> -> <specifier>": "R-CF-NN"`).
    - Also fail when an `ALLOWLIST` edge no longer exists, so the list only shrinks (same discipline as `lib/env.test.ts:30` and `LEGACY` in `lib/testing/date-now.test.ts`).
    - Seed: `"lib/box/client.ts:20 -> ./tenki": "R-CF-05"`.
  - No change to `lib/security/c18.ts:12-15`. OpenNext's init sets `globalThis.__dirname ??= ""` before routes evaluate, and `join("", …)` does not throw.
- **(n) PR #522 500 diagnosis.** Do this before any perf work.
  1. With `upload_source_maps` on (it stays; R-CF-15 owns sampling), run `npx wrangler tail airv2-app --format json` in `apps/web`.
  2. Curl each of `/`, `/login`, `/mini`, `/mini/create`, `/api/store/search` with `curl -s -o /dev/null -w '%{http_code}\n' https://airv2-app.<subdomain>.workers.dev<path>`. Research saw the subdomain `gratitude-8f4` (verify). A Workers Logs query on `$workers.scriptName = "airv2-app"` also works.
  3. Put a per-path table in the PR body with: `$workers.outcome` (`exception` = 1101/500, `exceededCpu` = 1102/503), the exception message, CPU time, and whether `[env] Missing required env var(s) … — continuing (development)` appears.
  4. Route the result:
     - "Missing required env var" (`lib/env.ts:7-13` via `lib/supabase.ts:12`) → R-CF-01, no code change.
     - `exceededCpu` → R-CF-15 `limits.cpu_ms`.
     - Any other exception → fix it here, with a test.
  - `apps/web/instrumentation.ts:9`: change to `validateEnv(process.env, process.env.NODE_ENV)`.
    - Next's webpack and OpenNext's `bundle-server` both inline the literal `process.env.NODE_ENV` as `"production"`.
    - The runtime key is never set: OpenNext `init.js` `populateProcessEnv` copies only bindings and `.env*` values. So `source["NODE_ENV"] ?? "development"` (`lib/env.ts:269`) resolves to development on workerd (verify in step 3).
    - The `NODE_ENV` read is exempt from the env grep guard (`lib/env.test.ts:34`).
  - `apps/web/middleware.ts:133-141`: add `segments[0] !== "create"` so main-host `/mini/create` gets a 308 to mini `/create`, as `login` and `publish` already do.
    - Today it is rewritten to `/mini/store/create`, whose `getRegistryApp` lookup ends in `notFound()` (`app/mini/(store)/store/[slug]/page.tsx:76-78`), or in a 500 when env is missing.
    - This is not a Cloudflare bug; it only showed up in the probe.

> Note for owner: The contract blames the PR #522 500s on `serviceClient()` → `required()`. That only holds if `validateEnv` warned rather than threw: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are in REQUIRED_ENV (`lib/env.ts:41-42`), so a throwing `register()` would have failed `/` too. The runtime-`NODE_ENV` mechanism above explains the split, and the decision to diagnose first stands. Once (n) lands, a missing required var fails every route on that isolate, which is what R-ARCH-02 intends. Ship that line only after `cf-env check` (R-CF-01) passes on production values.

**Acceptance.**
- [ ] `lib/runtime/platform.ts` and `lib/http/self.ts` exist with the §2.5 C2/C3 exports, and `sharedBridge.ts` uses `selfFetch`. The grep guard fails on any of these:
  - a new `fetch(\`${env.(app|miniapp|linkapp)Origin()}…`;
  - any `AIR_PUBLIC_ORIGIN` read;
  - a `https://self` host.
- [ ] (with R-CF-02) On workers.dev, `wrangler tail` shows a service-binding invocation of the `Internal` entrypoint for `POST /api/gateway/v1/chat/completions` on a quick-ack, and no outbound fetch from `airv2-app` to `app.wzrd.tech`.
  - Locally, with `wrangler dev` and `target=vercel` in local KV (§2.5 C22), the same call is served by this build, not proxied.
- [ ] On Cloudflare, `/api/berd/pair` from two client IPs writes two different `ops_events.ref` hashes, and neither is `sha256("unknown")`. A spoofed `X-Forwarded-For`, `X-Real-IP` or `x-air-client-ip` does not change the hash.
- [ ] On Cloudflare, `/mini/<slug>?g=` guest throttling ignores a spoofed `X-Forwarded-For`.
- [ ] (with R-CF-02) `GET /api/admin/deployments` on Cloudflare returns:
  - `control_plane.git_sha` equal to the deployed SHA, from `AIR_BUILD_SHA`;
  - a non-null `deployed_at`;
  - `platform: "cloudflare"`.
  - Vercel output is unchanged apart from `platform`.
- [ ] A signed Stripe fixture (or `stripe trigger checkout.session.completed`) against preview returns 200 and writes one `stripe_events` row. A bad signature returns 400.
- [ ] The node-compat probe shows that `lookup` resolves on workerd (or the `resolve4/6` fallback is in place), and that its output is filtered to IP literals; `BlockList` rejects `10.0.0.1` and `::1`; `scryptSync` completes.
- [ ] `curl -I` returns:
  - [ ] `/creator-os/ui.js` → `public, max-age=86400, stale-while-revalidate=604800`.
  - [ ] `/creator-os/fonts/newsreader-latin.woff2` → exactly `public, max-age=31536000, immutable`.
  - [ ] `/_next/static/*` → immutable.
- [ ] `wrangler.jsonc` lists the four flags and `upload_source_maps`, and `npx wrangler deploy --dry-run` passes. R-CF-02 adds `SELF` (§2.5 C1).
- [ ] `package.json` ranges are bumped, `git diff package-lock.json` touches only the range lines (no resolved version changes), and `@opennextjs/cloudflare` sits under `dependencies`.
- [ ] `open-next.config.ts` is unchanged.
- [ ] `poison-imports.test.ts` passes with the one-entry allowlist.
- [ ] On workers.dev, `/mini/<first-party slug>` (e.g. `/mini/todo`) and `GET /api/decisions` return no 1101.
- [ ] A 10-minute two-tab `/home` soak shows no "different request" warnings or errors in tail.
- [ ] The PR body contains the PR #522 diagnosis table.
- [ ] With one required var removed in preview, `/` returns 500 and tail shows `Missing required env var(s)`.
- [ ] Main-host `/mini/create` returns a 308 to `${MINIAPP_ORIGIN}/create`.
- [ ] `isReservedWord("vendor")` is true.

**Tests.**
- **Unit / integration (vitest).** Do not add these suites to `vitest.pure-tests.txt`; they stub globals or mock modules.
  - `apps/web/lib/runtime/platform.test.ts` NEW:
    - `cfEnv()` returns the `setCfEnv` value first.
    - Otherwise it returns `getCloudflareContext().env` from `vi.mock("@opennextjs/cloudflare")`, and `null` when that throws.
    - `runtimeHost()` returns each of its three values.
  - `apps/web/lib/http/self.test.ts` NEW:
    - Node path calls global `fetch` with `https://app.example.test/api/...`.
    - workerd path (stub `navigator.userAgent`; `setCfEnv({ SELF: { fetch } })`) calls `SELF.fetch` with the real public host and never global `fetch`. Without `SELF` it throws and still never calls global `fetch`.
    - `host: "mini"` uses the mini origin, no `x-air-*` header is added, and a relative path throws.
    - Grep guard over `app/` and `lib/` file contents for `fetch\(\s*\`\$\{env\.(app|miniapp|linkapp)Origin\(\)\}`, `AIR_PUBLIC_ORIGIN` and `https://self` (§2.5 C1).
  - `apps/web/lib/orchestrator/sharedBridge.test.ts`: the `:39-53` case stays green on the Node path; add one workerd-mode case.
  - `apps/web/lib/http/client-ip.test.ts` NEW:
    - workerd ignores XFF, `x-real-ip` and `x-air-client-ip`.
    - Node prefers `x-air-client-ip`, then `x-real-ip`.
    - Rightmost-hop fallback, and an invalid IP returns `null`.
  - R-CF-02 owns `apps/web/lib/http/edge.test.ts`. This item adds no edge-auth test.
  - `apps/web/lib/security/ma11.test.ts`: add a workerd `cf-connecting-ip` case next to `:178` and `:198`.
  - `apps/web/lib/miniapps/guests.test.ts` NEW: window behavior, pruning of empty keys, and the 10,000-key cap.
  - `apps/web/app/api/admin/deployments/route.test.ts`:
    - SHA from `process.env.AIR_BUILD_SHA`, which wins over `VERCEL_GIT_COMMIT_SHA`;
    - SHA from `VERCEL_GIT_COMMIT_SHA` alone;
    - `null` when neither is set;
    - `deployed_at` from `setCfEnv({ CF_VERSION_METADATA })`;
    - `region` from a `cf-ray` header on workerd;
    - the `platform` field.
  - `apps/web/lib/payments/stripe.test.ts`: the five existing webhook cases (`:51-85`) pass with async verify. Add a spy asserting `Stripe.createFetchHttpClient` is used.
  - `apps/web/lib/kernel/purchases.test.ts` (already mocks `node:dns/promises` at `:10`):
    - a CNAME entry plus a public A record → `true`;
    - names only → `false`;
    - a private A record → `false`.
  - `apps/web/lib/muse/capabilities.test.ts`: a CNAME entry named `fdcdn.example.net.` plus a public A record downloads; names only → `unsafe_file_url`.
  - `apps/web/lib/runtime/single-flight.test.ts` NEW:
    - Node shares across calls.
    - workerd never shares: two concurrent `run(key)` calls both invoke `fn`.
    - The entry clears on settle.
    - `lib/orchestrator/wake-waiter.test.ts`, `lib/box/desktop.test.ts` and `lib/masterkey/client.test.ts` stay green.
  - `apps/web/lib/supabase.test.ts` NEW: `createClient` receives the three auth flags.
  - `apps/web/lib/identity/heif.test.ts`, `lib/identity/references.test.ts`, `lib/miniapps/identityThumb.test.ts` and `lib/create/build.test.ts` stay green with the lazy imports.
  - `apps/web/lib/runtime/poison-imports.test.ts` NEW (above).
  - `apps/web/middleware.test.ts`:
    - new "main host" block for the `/mini/create` 308; `login` and `publish` are unchanged;
    - a client-sent `x-air-client-ip` is stripped: `x-middleware-override-headers` is present and `x-middleware-request-x-air-client-ip` is absent.
  - `apps/web/lib/miniapps/nested.test.ts`: assert `vendor` is reserved.
- **Manual probes:**
  - Preview: `cd apps/web && AIR_BUILD_TARGET=cloudflare npx opennextjs-cloudflare build && npx opennextjs-cloudflare preview`, with `.dev.vars` packs from `cf-env dev` (R-CF-01).
    - This is what `npm run cf:build` runs once R-CF-13 lands (§2.5 C17).
    - Then curl the PR #522 paths, run the `curl -I` header checks, and POST the signed Stripe fixture.
  - `apps/web/scripts/cf-probe/node-compat.ts` NEW (dev-only, never deployed):
    - Exercises `lookup("www.amazon.com", {all:true, verbatim:true})` (print the raw entries), `dns.promises.resolve4/resolve6`, `BlockList.check`, `scryptSync` with defaults, `createSign("RSA-SHA256")`, Ed25519 `sign`, `inflateRawSync` and `crc32`.
    - Run `npx wrangler dev scripts/cf-probe/node-compat.ts --compatibility-date 2026-10-12 --compatibility-flags nodejs_compat`, then `curl localhost:8787`.
    - Paste the output into the PR.
  - Bundle checks:
    - Run `npx wrangler deploy --dry-run --outdir "$TMPDIR/cfout"`.
    - `grep -rl "stripe.cjs.node\|NodeCryptoProvider" "$TMPDIR/cfout"` confirms the node build (verify).
    - The build SHA is checked by R-CF-02's `/api/version` acceptance, not here (§2.5 C5).
  - Diagnosis: `wrangler tail` as in (n).

**Risks & notes.**
- **`global_fetch_strictly_public`.** Same-zone subrequests go through the front door, so zone WAF and bot rules apply to them, and each one is a billed request. If they get challenged, exempt them with `cf.worker.upstream_zone eq "wzrd.tech"`.
- **`enable_request_signal`.** A client disconnect now aborts any work that reads `request.signal`; today only the creative events route does (grep). The gateway deliberately uses a header deadline instead (`app/api/gateway/v1/[...path]/route.ts:604-609`).
- **Single-flight on workerd.** Box wakes are not deduped on workerd, not even inside one request, so concurrent callers can each resume the same box.
  - The code already tolerates this across Vercel instances (`lib/box/tenki.ts:486-489`; per-caller admission in `boxes.ts`).
  - Watch provider start limits (`isStartLimit`, `lib/box/desktop.ts:10`).
  - R-CF-05's `BoxLifecycle.wake` restores cross-request dedupe (§2.5 C8).
- **`selfFetch` outside a request.** `cfEnv()` reads the env that `applyEnv` stores with `setCfEnv` in every entrypoint (§2.5 C2, C3). So queue, scheduled, DO and Workflow callers (R-CF-04/05/06/11) call `selfFetch` with no extra argument, and they never call `getCloudflareContext()` themselves.
- **`selfFetch` and the hosting switch.** `SELF` targets the `Internal` entrypoint, which never reaches the switch (R-CF-02, §2.5 C1). With `target=vercel`, quick-acks and every other internal call are still served by this build. The only public path served on Cloudflare whatever the target is R-CF-08's fal webhook.
- **Lazy imports.** HEIC conversion, identity thumbs, reference sheets and the freeze stitch still fail on workerd until R-CF-09, but they fail per call instead of taking whole routes down.
- **AI Gateway.** It is a Vercel product on the blocked team `5dee-studios`; check whether its keys still work while the team is blocked (verify). `pickBackend` tries `TYPESAFE_API_KEY` first.
- **Research correction.** `runtime-opennext-facts` says stripe 22.5.0 lists `default` before `workerd`. The tarball's order is extensibility, browser, bun, deno, worker, workerd, default. The conclusion still holds (the node build is used today), because webpack bundles stripe under Node conditions.
- **Build SHA.** `env.buildSha()` reads `process.env.AIR_BUILD_SHA`, which R-CF-02's wrangler-bundled entry sets (§2.5 C5). So it does not matter whether wrangler applies `--define` to OpenNext's server chunks. Until R-CF-02 lands, the value is `null` on Cloudflare.
- **`_headers` on Vercel.** Vercel serves `public/_headers` at `/_headers`, which is harmless. Workers parse the file and do not serve it.
- **Cost.** `scryptSync` stays: about 42 ms per gate POST is negligible at Paid CPU pricing.

**Depends on.** R-CF-01 (P1).
- The (c) and (d) hand-edits must pass R-CF-01's `lib/env.example.test.ts`. The preview probes use the `.dev.vars` packs from `cf-env dev`.
- The (n) `instrumentation.ts` fail-fast line ships only after the owner's `cf-env check` (R-CF-01) passes on production values.
- Not a dependency: R-CF-02 builds on this item, which lands first in P1.
  - R-CF-02's `applyEnv` calls `setCfEnv` from `lib/runtime/platform.ts` (§2.5 C3), and its Vercel-side `/api/version` uses `env.buildSha()`.
  - R-CF-02 adds the `SELF` → `Internal` binding, sets `process.env.AIR_BUILD_SHA` and `x-air-client-ip`, and owns `lib/http/edge.ts` (§2.5 C1, C5, C11).
  - The acceptance items marked "(with R-CF-02)" are checked once it lands.
- R-CF-13 passes `--define __AIR_BUILD_SHA__` and sets `AIR_BUILD_TARGET` in `cf:build` (§2.5 C5, C17).
- R-CF-05 removes the last poison allowlist entry, and R-CF-09/R-CF-10 replace the lazily imported packages.
