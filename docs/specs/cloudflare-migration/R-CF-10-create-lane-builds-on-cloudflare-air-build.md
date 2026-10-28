# R-CF-10 — Create lane builds on Cloudflare (air-build)

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-10: …`.

**Why.** Today the Create build runs only on Node. `apps/web/lib/create/build.ts:22` imports native `esbuild`. `compileWorkspace` resolves imports through a tmp sandbox on disk (`build.ts:668-694`), and `kit.ts:293-345` extracts 17 vendor tarballs into tmp. `css.ts:18-35,199-205` reads the theme, the fonts and Tailwind from disk. `/api/create/build` keeps building in `after()` past a 60 s hold (`app/api/create/build/route.ts:35,112`), but `after()` is cut off 30 s after the response on both plans. Turns fail on airv2-app even without a build. `createSystemPrompt` calls `fs.readFileSync` (`lib/create/turn.ts:60-66`), so `/api/create/turn` answers 500 `run failed` (`app/api/create/turn/route.ts:106`), and `kitVersion()` silently returns `"unknown"` (`kit.ts:49-58`). On Paid, `@cloudflare/worker-bundler@0.2.6` (2026-10-07) shows that esbuild-wasm runs in workerd: it does `import("./esbuild.wasm")` then `esbuild.initialize({ wasmModule, worker: false })` (`dist/index.js:431-447`, on `esbuild-wasm@0.28.1`). CPU can be raised to 300 s with `limits.cpu_ms`, so the limit that binds is 128 MB per isolate. The V13 job lane (`infra/workers/create`) is not deployed (`workers_list` 2026-10-28: 34 scripts, no `air-create`). Its bugs must be fixed before it is ever enabled: `turn_done` events are not correlated to a turn, the findings shape does not match, the build step is not idempotent, cancel never stops the turn, and its bridge headers are `x-air-ts`/`x-air-sig`, which airv2-app's public `fetch` strips (§2.5 C1).

**Deltas.**

*0. M0 measurement gate (first commit; nothing wired to production)*
- `infra/workers/build/bench/run.mjs` NEW. Runs under `wrangler dev` and compiles each fixture 50× in one isolate:
  - the 6 templates (`packages/create-kit/templates/*`);
  - the `lib/create/build.test.ts` workspace;
  - 3 synthetic stress workspaces that the script generates: every Kit component imported; 300 named `lucide-react` icons; 400 files / ≈24 MiB with `public/` assets at `ASSET_MAX_BYTES`.
  - Never pull real user workspaces for the bench, because source stays in Boxes.
  - Record CPU, wall time and `outcome` from `wrangler tail --format json` in the PR description.
- **Gate:** 0 `exceededMemory`, CPU p95 ≤ 15 s, 100 % golden parity (§Tests). If memory fails, make the Container backend (step 4) the default (`BUILD_BACKEND=container`).

*1. Split `build.ts` so airv2-app no longer loads esbuild, Tailwind or Kit disk reads*
- `apps/web/lib/create/workspace.ts` NEW. Pure: no Box, `env`, `fs` or `miniapps/publish`. Move from `build.ts:82-332`:
  - constants (`AIR_APP_SCHEMA`, `WORKSPACE_ROOT`, `WORKSPACE_MAX_FILES`, `WORKSPACE_MAX_BYTES`, `SOURCE_MAX_BYTES`, `ASSET_MAX_BYTES`, `FUNCTIONS_*`);
  - `airJsonSchema`/`AirJson`, `WorkspaceFile`, `BuildSizes`, `CompileOutput`, `BuildManifest`, `BuildResult`, `BuildError`;
  - `hard`, `finding`, `parseAirJson`, `safeWorkspacePath`, `checkWorkspace`, `sweepWorkspaceSecrets`.
- `apps/web/lib/create/workspaceBox.ts` NEW. Box I/O:
  - `workspacePath` (`:252-254`). It calls `validateAppName` from `miniapps/publish`, which reaches `create/versions` → `storage/r2` → `env`.
  - `pullWorkspace` (`:339-373`), `listWorkspace` (`:382-403`), and `pushWorkspaceToStore()` (step 5).
- `apps/web/lib/create/kitRules.ts` NEW. Pure. Move from `kit.ts`: `KIT_SPECIFIER_RE`, `RESTRICTED_SPECIFIER_RE` (`:19-21`), `KitError` (`:24`), `packageNameOf` (`:164`), `readTar` (`:192`), `readTarGz` (`:240`), `safeArchivePath` (`:261`), `KitResolution`/`classifySpecifier` (`:446-457`). `kit.ts` re-exports them.
- `apps/web/lib/create/buildLedger.ts` NEW.
  - Move `build.ts:1262-1392`: `logTail`, `BuildState`, `BuildRecord`, `openBuild`, `closeBuild`, `latestBuild`, `getBuild`, `buildFailureMessage`.
  - Add `claimBuild()` (step 6).
  - `trackedBuild` (`:1398-1427`) stays in `build.ts` as the legacy path.
- Repoint the importers:
  - `WORKSPACE_ROOT` → `workspace.ts`: `lib/create/turn.ts:31`, `icon.ts:31`, `plan.ts:15`, and the type import at `templates.ts:17`.
  - `mirror.ts:33` (reached from `finalize.ts:34`) → `workspaceBox.ts`.
  - `progress.ts:16`, `app/api/create/status/route.ts:25`, `app/api/admin/deployments/route.ts:12` → `buildLedger.ts`, with `hard` from `workspace.ts`.
  - `app/api/create/files/route.ts:18-24`, `app/api/create/jobs/[id]/request/route.ts:21`, `app/api/internal/create/tests/route.ts:19` → `workspace.ts` / `workspaceBox.ts`.
  - `build.ts` re-exports every moved name for one release.
- `apps/web/lib/create/compile/` NEW. A pure compile core that air-build imports as-is. **Copy, don't move:** `build.ts` `compileWorkspace` (`:837-1066`) stays unchanged as the Node/Vercel path and the golden oracle until P6.
  - `core.ts`: a refactored copy of `compileWorkspace` and `compileFunctions` (`:583-666`), plus the html, measure and budget helpers (`:696-820`, `:1068-1105`). It takes `CompileContext { bundler, kit, vendor, restricted, mediaOrigin }`.
  - `vfs.ts`: the resolver. Replaces `kitPlugin` (`:428-515`), `functionsPlugin` (`:529-576`) and `resolveSandboxFile`/`writeSandbox` (`:668-694`).
  - `css.ts`: the `lib/create/css.ts` logic with theme, shell, fonts and the Tailwind theme injected.
  - `types.ts`: `Bundler`; `KitSource` (version, budgets, components, files); `VendorSource`.
  - **Import boundary (transitive closure):**
    - Allowed: `zod`, `tailwindcss`, `node:path`, `node:zlib`, `node:crypto`, `../workspace`, `../kitRules`, `../tests` (→ `./config`, which reads `process.env` only), `../lint`, `../../storage/guard`, `../../vault/scrub`, `../../miniapps/bundleRules`, `../../miniapps/bundleLimits`, `../../functions/egress`.
    - Never: `../env`, `node:fs`, `node:os`, `esbuild`, `@supabase/*`, `../../storage/r2`, `../../miniapps/publish`.
- `apps/web/lib/create/lint.ts`:
  - `:14`: import `bundleContentType` and `BundleFile` from `miniapps/bundleRules`. Today this line reaches `storage/r2`.
  - `:15,100-105`: `lintBundle(files, { mediaOrigin })` replaces `env.r2PublicBaseUrl()` in `allowedImageOrigins`. airv2-app call sites pass `env.r2PublicBaseUrl()`.
- `apps/web/lib/miniapps/bundleRules.ts` NEW.
  - Holds the pure part of `bundles.ts`: `BundleError`, `bundleContentType`, `BundleFile`, `readZip`, `validateBundle` (`:19-209`), `bundleKey` (`:211-213`), `FUNCTIONS_MODULE_DIR` and `FUNCTIONS_MAIN` (`:233-234`).
  - `bundles.ts` re-exports these and keeps `storeBundle` (`:216-226`) and `storeFunctionsModule` (`:240-246`), because `:12` imports `storage/r2`.

*2. Kit as data (bundled modules for the Kit, R2 for vendor)*

| Artifact (`packages/create-kit`) | Size | Files | On Cloudflare |
|---|---|---|---|
| `kit/**` (components, helpers, `air/theme.css`, `air/shell.css`, `*.module.css`) | 983,273 B text + 158,164 B woff2 | 291 (79 `meta.json`) | `generated/kit-files.json`, a bundled JSON module in air-build |
| `kit.lock.json` | 99,847 B | 1 | version and budgets only → `kit-index.json` |
| `prompts/create-agent.system.md` | 35,026 B | 1 | `kit-index.json.prompt` → airv2-app |
| `templates/**` | 47,195 B | 30 | not needed at runtime (`lib/create/templates.ts` has no importer); golden fixtures |
| `vendor/tarballs/*.tgz` (17, SBOM-pinned) | 7,900,104 B gz → 56,173,926 B raw | 6,511 | R2 `air-build/kit/vendor/<sbom16>/<pkg>.tar`, pruned to the metafile closure |
| └ upper bound without `*.ts`/`*.mts`/`*.cts`, maps, md | ≈18.4 MB | ≈3,250 | includes 4,777,452 B of react/react-dom/scheduler `development` builds and CJS twins |
| └ `lucide-react` 1.34.0 | 31,398,554 B raw (16.2 MB `.d.ts`/`.d.mts`, 12.4 MB maps) | 4,110 | 2,777,280 B of JS+JSON in 2,052 files |
| `tailwindcss/theme.css` 4.3.3 | 19,586 B | 1 | Text module in air-build |
| `esbuild-wasm@0.25.0` `esbuild.wasm` | 12,118,710 B | 1 | CompiledWasm module in air-build |
| Tier B `restricted/<version>.tgz` | not in the repo | — | R2 `air-build/kit/restricted/<version>.tgz`, copied by the owner from `air-media/_platform/kit/restricted/` (`kit.ts:22,383`), who then deletes the public copy (§2.5 C22; owner note below) |

- `packages/create-kit/scripts/precompile.ts` NEW. Add `"precompile": "tsx scripts/precompile.ts"` to `packages/create-kit/package.json`.
  - **esbuild version:** load apps/web's `esbuild@0.25.0` (`apps/web/package.json:59`, a devDependency) through `createRequire(apps/web/package.json)`. The root `node_modules/esbuild` resolves to 0.28.2 (package-lock).
  - **Synthetic builds:** use exactly the options at `build.ts:894-917` (alias, `nodePaths`, loaders) with `metafile: true`. Entries: every vendor package root and `exports` subpath, every Kit component entry, every template.
  - **Outputs:**
    - `apps/web/lib/create/generated/kit-index.json` (committed): `{kit_version, budgets, sbom_digest, vendor:{names, non_lite}, components, prompt, prompt_sha256, tailwind_version}`. `sbom_digest` is the digest from `kit.ts:305-309`.
    - `infra/workers/build/generated/kit-files.json` (gitignored): the Kit closure, `functions/index.ts` and the fonts, base64-encoded.
    - `infra/workers/build/generated/vendor/<pkg>.tar`: the union of metafile inputs per package.
    - `infra/workers/build/generated/vendor/resolve.json`: recorded resolutions `(importer | "<app>", specifier, kind) → {path, sideEffects}`, taken from metafile `imports[].original/path/kind` (verify that `original` exists in 0.25.0). Evaluate `sideEffects` per file from each `package.json`, because esbuild only honours `sideEffects` that a plugin returns explicitly.
  - **`--check`:** fails when the committed index drifts. Add it to `.github/workflows/create-kit.yml`, and add `apps/web/lib/create/generated/**` to that workflow's `paths`.
- `apps/web/lib/create/kit.ts:49-160`:
  - With no `root` argument, `kitVersion`, `kitBudgets`, `listKitComponents`, `readSbom`, `vendorPackageNames` and `nonLiteVendorNames` read `kit-index.json`.
  - An explicit `root`/`KIT_DIR` still reads disk (precompile, legacy).
  - The disk extractors (`:293-345`, `:393-434`, `:487-507`) stay only for the legacy Node path and are deleted in P6.
- `apps/web/lib/create/turn.ts:57-66,245`: `createSystemPrompt()` returns `kitIndex.prompt` (no fs), and `kitVersion()` reads the index. This fixes the ENOENT on both platforms and can ship first. The `/api/create/turn` tracing include (`next.config.ts:23-26`) then becomes dead; remove it in P6.

*3. `air-build` worker (NEW `infra/workers/build`)*
- **R2 bucket `air-build`** (private: no custom domain, `r2.dev` off; it does not exist per `r2_buckets_list` 2026-10-28):
  - R-CF-13's idempotent `ensure-resources` job creates it (§2.5 C18). Add its steps there: `wrangler r2 bucket create air-build || true`, then the lifecycle rules: expire `src/` after 1 day and `out/` after 7 days (`wrangler r2 bucket lifecycle add`; verify the flags and that a repeated add is harmless). `deploy-build` (below) runs the same two steps first, because `workers.yml` can run before `airv2-app.yml`.
  - The CI token needs Workers R2 Storage Edit for these steps and for the `r2 object put` uploads (§6 Cloudflare tokens).
  - The owner creates an R2 API token scoped to `air-build` only (§6).
- `package.json` NEW:
  - `esbuild-wasm` **0.25.0 exact**, which must equal `apps/web/package.json:59` (a test asserts this).
  - `tailwindcss` 4.3.3 exact. `@cloudflare/containers` (fallback only; pin an exact version, verify).
  - Dev: `wrangler` ^4.148.0, `vitest` 4.1.0, `@cloudflare/vitest-pool-workers` 0.22.0, the same pins as `infra/workers/muse/package.json:20-22`.
- `wrangler.jsonc` NEW:
```jsonc
{
  "name": "air-build",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-12",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": false, "preview_urls": false,          // reachable only via service binding
  "limits": { "cpu_ms": 300000 },
  "build": { "command": "npm run precompile" },          // writes generated/ (needs root npm ci)
  "rules": [
    { "type": "CompiledWasm", "globs": ["**/*.wasm"] },
    { "type": "Text", "globs": ["**/*.css", "**/*.md"], "fallthrough": true }
  ],
  "r2_buckets": [{ "binding": "BUILD_STORE", "bucket_name": "air-build" }],
  "vars": { "BUILD_BACKEND": "wasm", "CONTAINER_SRC_BYTES": "8388608",
            "MEDIA_ORIGIN": "https://media.wzrd.tech", "R2_ACCOUNT_ID": "",
            "KIT_RESTRICTED_VERSION": "", "KIT_RESTRICTED_SHA256": "" },
  "observability": { "enabled": true, "head_sampling_rate": 1 }
}
```
  - Secrets: `R2_BUILD_ACCESS_KEY_ID` and `R2_BUILD_SECRET_ACCESS_KEY`, in a new `## secret @air-build` section (R-CF-01 format). air-build reads them as individual Worker secrets; it has no env packs and no `applyEnv` (§2.5 C3 covers airv2-app's entrypoints).
  - Hand-edit `apps/web/env.example.md` (§2.5 C20): add the `## secret @air-build` section after `## secret @air-sidecar` (`env.example.md:495`), with a `# R-CF-10. …` tag comment in the same style. `apps/web/lib/env.example.test.ts` (R-CF-01) enforces the format and completeness.
  - The owner fills the values in `apps/web/.env.airv2.md` and runs `npm run cf:env -- push --worker air-build` after the first air-build deploy; `push --worker` refuses a Worker with no deployment (§2.5 C22, §6).
- `src/esbuild.ts` NEW:
  - Import the browser entry of `esbuild-wasm`. worker-bundler imports `esbuild-wasm/lib/browser.js`; check `dist/index.js` for the exact path it uses (verify).
  - Import `esbuild-wasm/esbuild.wasm` with a **dynamic import inside the handler**, so the 12.1 MB module stays out of the 1 s startup budget.
  - Call `initialize({ wasmModule, worker: false })` once per isolate, through a module-level promise that resets on failure.
  - Never use `wasmURL` and never `new WebAssembly.Module(bytes)`: workerd blocks runtime compiles.
- `src/index.ts` NEW. Endpoints (service binding only):
  - `POST /v1/src-url {key}` → presigned PUT for `src/<key>.tgz` (`application/gzip`, TTL 300 s).
    - Port the SigV4 presign from `lib/storage/r2.ts:163-203` into `src/presign.ts`, using the `R2_BUILD_*` credentials and bucket `air-build`.
    - A SigV4 presigned PUT signs `content-type;host` with `UNSIGNED-PAYLOAD` (`r2.ts:179-188`), so it **cannot cap the size**.
  - `POST /v1/compile {key, mode:"compile"|"build", version, previous_tests, restricted}`:
    - First HEAD `src/<key>.tgz`. Missing → 404. Empty → 400 `workspace is empty`. Size ≥ `WORKSPACE_MAX_BYTES + 1` → 413 `workspace exceeds 24 MiB`. This keeps parity with `build.ts:350-353`.
    - Over `CONTAINER_SRC_BYTES`, send it to the container backend when deployed; otherwise compile in-isolate.
    - Read the archive with `readTarGz` (`kitRules.ts`, today `kit.ts:240`) under the same caps as `build.ts:357-361`, then run `compile/core.ts`.
    - In `build` mode, write `out/<key>/bundle.tar` (bundle files plus `.fn/functions.mjs`, matching `FUNCTIONS_MODULE_DIR`/`FUNCTIONS_MAIN` at `bundles.ts:233-234`, when present) and `out/<key>/result.json`.
    - A repeat call with the same `key` and the same src sha256 returns the stored `result.json` without recompiling.
    - Returns `{findings, sizes, manifest, log, air, functions:{bytes,sha256}|null, bundle_key|null, backend}`.
  - `GET /v1/out/<key>/bundle.tar` streams the stored tar.
  - `POST /v1/warm` initializes esbuild. airv2-app fires it from `startCreateTurn` with `cfWaitUntil(...)`, reading `BUILD` through `cfEnv()` (`lib/runtime/platform.ts`, §2.5 C2).
  - `GET /v1/health` → `{ok, wasm:"ready"|"cold", kit_version, sbom_digest, vendor:"ok"|"missing"}`.
- `compile/vfs.ts` semantics. This is shared code; on the wasm path every load goes through plugins, because the fs stubs return ENOSYS.
  - `onResolve` returns namespace `air` for every specifier.
  - Workspace and Kit relative resolution is ported 1:1 from `resolveSandboxFile` (`build.ts:668`) and `resolveKitFile` (`kit.ts:487`). This includes `./kit/<source>/<name>` from any depth, `@kit/*`, `@kit/restricted/*`, and the path-escape, missing-import and absolute-import refusals.
  - Bare vendor specifiers and every import inside the vendor tree resolve by `resolve.json` lookup. The VFS returns the recorded `sideEffects` flag.
  - A miss becomes a hard `compile` finding with esbuild's own `Could not resolve "<spec>"` text (verify that it matches native).
  - `onLoad` serves from in-memory maps with the loaders at `build.ts:913`: ts/tsx/js/jsx/json/css; `.module.css` → `local-css`; images/fonts → `file`; `.md`/`.txt` → `text`.
- `compile/css.ts`:
  - Always emit `@import "tailwindcss/theme.css" layer(theme)`. `loadStylesheet` returns the Text-imported theme.
  - This fixes the silent theme drop at `css.ts:221-226`, where `tailwindDir()` returns null.
  - A missing theme sets `utilityFailed`.
  - Compile once per build and never cache the compiler, because `build()` accumulates candidates.
- `src/limiter.ts` NEW:
  - One build at a time per isolate. Queue at most 4; otherwise return 503 `build_busy` with `retry-after: 2`.
  - Vendor pack LRU capped at 24 MiB.
  - Drop the workspace maps after each response.
- Tier B: read `kit/restricted/<version>.tgz` from `BUILD_STORE`, check it against `KIT_RESTRICTED_SHA256` (the logic of `kit.ts:403-434`), and keep it in memory only.
- `.github/workflows/workers.yml`: R-CF-13 owns the side-Worker jobs, including the air-build `check` row and the `deploy-build` job (§2.5 C18). They must run exactly this:
  - **`check`:** the matrix row `{ name: build, dir: infra/workers/build }` (`:37-42`). For that row, run a root `npm ci --ignore-scripts` before the worker `npm ci` (`:48-53`). The dry-run (`:64-74`) runs `build.command` → precompile, which needs root `tsx`, `apps/web` esbuild 0.25.0 and `packages/create-kit`.
  - **`deploy-build` job** (`needs: check`, with the ungated `if` of `deploy-outbound` at `:78`; not `:130`, which R-CF-14.1a gates behind `vars.WFP_ENABLED`): the idempotent bucket and lifecycle steps (above), root `npm ci --ignore-scripts`, then `npm run precompile`, then upload `generated/vendor/*` with `npx wrangler r2 object put air-build/kit/vendor/<sbom16>/<file> --file <f> --remote`, then `wrangler deploy`.
    - Wrangler 4 defaults `r2 object` commands to local, so `--remote` is required.
    - The objects are content-addressed by `sbom16`, so re-putting them is harmless and needs no existence check.
  - **Order (§2.5 C18).** airv2-app deploys only after the Workers it binds exist. Merge the air-build worker and its CI first. Merge the step 5 airv2-app wiring (the `BUILD` binding) only after `wrangler deployments status --name air-build` shows a deployment.

*4. Container fallback (ship the config; deploy only if M0 fails or for oversized sources)*
- `infra/workers/build/container/Dockerfile` NEW: `node:22-slim`, native `esbuild@0.25.0` and `tailwindcss@4.3.3`. A small HTTP server on port 8080 runs the **same** `compile/core.ts` and VFS with a native `Bundler`.
- `infra/workers/build/src/container.ts` NEW: `BuildContainer extends Container` with `defaultPort = 8080`, `sleepAfter = "2m"` and `enableInternet = false`.
  - Containers cannot use bindings, so the Worker side streams the src tgz and Tier B from R2 into the request and writes the outputs back to R2.
  - Tier B is never baked into the image (`packages/create-kit/restricted/README.md`: private R2 object read only by the Build Service).
- `infra/workers/build/wrangler.jsonc` `env.container`:
  - `containers: [{ class_name: "BuildContainer", image: "./container/Dockerfile", instance_type: "basic", max_instances: 3 }]`.
    - §2.5 C14 lists only the deployed classes. If this backend is deployed, §3.5 cost math and R-CF-15 alerts add `BuildContainer` at 3 × `basic`.
  - A DO binding `BUILD_CONTAINER`, plus `migrations: [{ tag: "v1-build-container", new_sqlite_classes: ["BuildContainer"] }]` (or `exports`; never both). This is the first `vN-<name>` tag on air-build's own worker (§2.5 C8).
  - Deploy with `--env container` and set `BUILD_BACKEND` to `auto` or `container`. The container image build needs Docker on the runner, and the CI token needs Containers Edit (§6 Cloudflare tokens).

*5. airv2-app wiring*
- `apps/web/wrangler.jsonc`:
  - Add `"services": [{ "binding": "BUILD", "service": "air-build" }]`. R-CF-10 owns this binding (§2.5 C10). `"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "air-media" }]` is R-CF-09's, which lands first.
  - Regenerate `worker/worker-configuration.d.ts` with `npm run cf:types` in the same PR (§2.5 C4).
  - Merge only after air-build is deployed (step 3, **Order**).
  - **Keep `UPSTREAM_VERCEL`** (`:17`): R-CF-02's `proxyToVercel` ports app-switch's `UPSTREAM_VERCEL`. Only rewrite its comment (`:15-16`), which wrongly says the create/freeze carve lanes use it; no code reads it today.
- `apps/web/lib/storage/r2.ts`. R-CF-09 owns the binding-backed implementation and lands first (P2). R-CF-10 builds on it:
  - New `mediaBucket()` returns `cfEnv()?.MEDIA ?? null` (`lib/runtime/platform.ts`, §2.5 C2; it is `null` off Cloudflare and outside a request). It returns the bucket only when `env.r2Bucket() === "air-media"`, the bound bucket. R-CF-09's binding branch goes through it.
  - `putObject` (`:248`), `getObject` (`:264`), `headObject` (`:281`), `deleteObject` (`:300`) and `listKeys` (`:312`) use it when present and keep the SigV4 fetch otherwise. Presign stays SigV4.
  - Add `r2Writable()` = `mediaBucket() !== null || r2Configured()`. Use it in `build/route.ts:68` and `kit.ts` `extractRestricted` (`:405`). `r2Configured()` (`:31`) stays credential-only, because presign needs the keys.
  - This removes one external SigV4 request per file from `storeBundle` (`bundles.ts:224`) and `loadRelease` (`functions/deploy.ts:120-139`).
- `apps/web/lib/create/buildBackend.ts` NEW: `BuildBackend.compile(...)`.
  - `serviceBackend(cfEnv()?.BUILD)` when bound (§2.5 C2): push src, call `/v1/compile`, fetch `bundle.tar` once, and untar it with `readTar` (`kitRules.ts`).
  - Otherwise `localBackend()`: the legacy `build.ts` `compileWorkspace`, so the Vercel rollback is unchanged.
  - On isolate death (service-binding exception or 5xx with no JSON body), retry once with `x-air-build-backend: container` when that backend is deployed.
- `apps/web/lib/create/workspaceBox.ts` `pushWorkspaceToStore(target, appname, key)`:
  - Get the URL from `BUILD /v1/src-url`.
  - Run over the command lane (`runCommand`, 60 s), shell-quoting the URL as `shellQuote` does (`lib/fleet/sync.ts:177-179`): `cd "$HOME/<dir>" 2>/dev/null || exit 3; tar -czf - --exclude='.*' --exclude='node_modules' air.json create.plan.md src public functions 2>/dev/null | head -c <cap+1> | curl -fsS -X PUT -H 'content-type: application/gzip' --data-binary @- <url>`.
  - Exit 3 → `BuildError` 404. Any other non-zero exit → 502. A truncated (over-cap) archive is refused by air-build's HEAD check (413).
  - airv2-app never holds the archive. Today it holds the base64 string (`build.ts:346-349`).
  - Precedent for presigned URLs over the command lane: `lib/fleet/sync.ts:182-191` (a presigned GET).
- `apps/web/lib/create/build.ts` `buildApp` (`:1123-1254`):
  - Pull through `pushWorkspaceToStore` when `BUILD` is bound. `previousTests` still comes from `readComputeFile` (`:1137-1139`).
  - Use the claimed row's `planned_version` instead of `newVersionId()` (`:1171`).
  - `uploadVersion` (`:1212`) is unchanged and now stores through `MEDIA`.
- `apps/web/lib/create/deferred.ts` NEW: the `run` function of kind `create.build {build_id}`, and the `create.turn_done` continuation (step 8). It is not a registry (§2.5 C7):
  - Add one row to R-CF-06's table in `apps/web/lib/runtime/deferHandlers.ts`, and `create.build` to its `DeferKind` union and `DeferPayloads`: `{ schema: z.object({ build_id: z.string().uuid() }), maxSeconds: 600, maxHops: 0, vercelInline: () => true, run }`, with `run` lazily imported from this module. `vercelInline` keeps a message sent during a switch flip building inline on Vercel, as today.
  - Producer: `defer("create.build", { build_id: id }, { key: \`build:${id}\` })`. `key` is required.
  - No `create.turn.report` kind exists: the turn report is a `run.finalize` continuation.
- `apps/web/next.config.ts`:
  - When `process.env.AIR_BUILD_TARGET === "cloudflare"` (set by `npm run cf:build` for `next build`; build-time only, not a Worker var; R-CF-13, §2.5 C17), change `webpack: (config, { isServer })` to add `esbuild: false, tailwindcss: false` to the alias block (`:62-68`) **only when `isServer`**. `app/globals.css:1` `@import "tailwindcss"` goes through `@tailwindcss/postcss` (`postcss.config.mjs`) and must keep resolving.
  - Under the same flag, drop `esbuild` from `serverExternalPackages` (`:13`).
  - The Vercel build keeps the tracing at `:16-31`. Add the `/api/create/build` include list (`:17-22`) for `/api/create/compile` and `/api/internal/create/build`, which run the legacy compile on Vercel without it today.
- `apps/web/lib/create/icon.ts:189-202`: `resizeIcon(bytes, resizer)`.
  - On Cloudflare use the R-CF-09 Images resizer: two transforms (512 and 180, `fit:"cover"`, `image/png`), each on a **fresh** `ReadableStream`, because `IMAGES.input()` takes a stream.
  - Keep the sharp loader (`:171-179`) for Node, and keep `resized:false` (`:192`) as the last resort.

*6. Idempotent build keys*
- `supabase/migrations/NNNN_create_build_keys.sql` NEW. The highest today is `0140_wzrd_connect.sql`; take the next free number at merge (§2.5 C23).
```sql
alter table create_builds
  add column idem_key text,
  add column job_id uuid references create_jobs(id) on delete set null,
  add column round smallint,
  add column planned_version text check (planned_version is null or planned_version ~ '^v[0-9]{10,16}$'),
  add column lease_until timestamptz,
  add column backend text check (backend is null or backend in ('node','wasm','container')),
  add column error_status smallint;   -- HTTP status of a failed build, so a deferred build answers like an inline one
create unique index create_builds_idem_key_uidx on create_builds (idem_key) where idem_key is not null;
```
- `buildLedger.claimBuild(key, app, user, {jobId, round, id?})`:
  - Insert `{id?, idem_key: key, status:'running', planned_version: newVersionId(), lease_until: now()+10 min}`.
  - On a unique conflict, read the row:
    - terminal (`succeeded`/`failed`) → return the stored result, no rebuild;
    - `running` with a live lease → `409 build_in_progress` (retryable);
    - expired lease → compare-and-swap takeover (`.eq("id").eq("lease_until", observed)`) that reuses `planned_version`.
  - **Takeover check, before compiling:**
    - If `mini_apps.draft_version` or `bundle_version` equals `planned_version`, the first attempt committed (the pointer CAS at `versions.ts:338-354` succeeded). Close the row `succeeded` and return.
    - Else, if a `miniapp_versions` row for `(app_id, planned_version)` exists, the first attempt died mid-upload. Tombstone it the way `discardVersion` does (`versions.ts:426-446`; export it), then re-run `uploadVersion` with `planned_version`.
    - Without this step, `recordVersion` hits the unique index and returns 409 (`versions.ts:211-212`).
- Keys:
  - session/CLI builds: the route generates `id = crypto.randomUUID()` and claims `b-<id>` with that `id`. The `create.build {build_id}` consumer leases the same row, so a redelivered message never builds twice.
  - job builds: `job-<job_id>-r<round>`.
  - compile: `c-<uuid>`; no ledger row is written.
- `closeBuild` (`buildLedger.ts`) also writes `backend`, plus `error_status` from `error.status` (default 400) on failure.

*7. Job lane correctness (`infra/workers/create`; stays undeployed)*
- **Correlated events.** Add `turnEventType(role, round)` = `` `turn_done-${role}-${round}` `` in a pure `src/turnEvents.ts` NEW. Types are ≤ 100 chars (developers.cloudflare.com/workflows/build/workers-api/); use `[A-Za-z0-9_-]` only. This is the Workflow form of §2.5 C7's correlated `turn_done:<role>:<round>` event: the bridge body carries `{type:"turn_done", role, round, …}` (step 8), and `handleEvent` maps it to this type, because a colon is not allowed in an event type.
  - `src/index.ts:102-112` `handleEvent`: validate `role ∈ {brief,code,fix}` and integer `round`, then call `sendEvent({ type: turnEventType(role, round), payload })`. A `sendEvent` throw (instance not running) becomes 409.
  - `src/workflow.ts:119-152` `waitForTurn` takes the typed event and the `run_id` that the turn step returns. Capture it at `:221`, `:264` and `:326`/`:398`; the code and fix step results are discarded today. On a payload whose `run_id` differs, continue the chunk loop.
  - Today every turn waits on plain `turn_done` (`:130-133`), so a late brief or fix event unblocks the next wait.
- **Stop on expiry.** When a wait fully expires, run `step.do("stop:<role>:<round>", STEP_TABLE.stop, …)` → `adapterStopTurn` (`adapter.ts:157-167`) before the build step. This prevents the run from editing the workspace while `build` pulls it, and closes its `agent_runs` row as interrupted (`turn.ts:288-315`).
  - Add an explicit `STEP_TABLE.stop = { retries: { limit: 3, delay: "5 seconds" }, timeout: "30 seconds" }` (§2.5 C9). Stopping a stopped run is a no-op, so this step needs no fence.
- **Cancel.** The workflow records the run on the **user**-keyed room (`workflow.ts:157-159,227-231`; `room.ts:113-115`), where the owner queue also lives. `handleCancel` reads `/cancel` from the **job**-keyed room (`index.ts:118-124`), so `run_id` is always null, the turn is never stopped and the queue slot is never released.
  - Fix: `terminateJobWorkflow(jobId, userId)` (`apps/web/lib/create/job.ts:309-310`) sends `{user_id}`.
  - `handleCancel` sends `/cancel` to `idFromName(user_id)` when present, and falls back to the job room.
- **Findings shape.**
  - `app/api/internal/create/build/route.ts:62,80` returns rule strings, but `workflow.ts:312-313` reads `f.rule`. That is always undefined, so `tests.locked-removed` never triggers and fix turns get no findings.
  - Return `findings: [{rule, severity}]` (still CF5-safe) and keep `adapter.ts:94-99` typed to match. `failedIds` stay strings for `TurnRequest.findings` (`adapter.ts:83`).
- **Build step.**
  - `adapterBuild(env, jobId, round)` sends `round`.
  - Change `STEP_TABLE.build` (`workflow.ts:47`) to `{ retries: { limit: 5, delay: "15 seconds", backoff: "exponential" }, timeout: "10 minutes" }`. The 409 from step 6 is retryable.
  - The `claimBuild` row `job-<job_id>-r<round>` (step 6), written before any compile or upload, is the durable pre-side-effect fence that §2.5 C9 requires: a restarted step replays the stored result instead of building again.
- **Bridge headers (§2.5 C1).** airv2-app's public `fetch` strips every inbound `x-air-*` header, so `x-air-ts`/`x-air-sig` never reach `/api/internal/create/*` on Cloudflare, whether through `CONTROL_PLANE_ORIGIN` or the `APP` binding below.
  - Rename them to `air-bridge-ts`/`air-bridge-sig` on both sides in one PR: `apps/web/lib/create/bridge.ts:19-20` (read by `lib/create/adapter.ts`) and `src/sign.ts:16-17` (read by `src/adapter.ts`). air-create is undeployed, so no dual-name window is needed.
- **Service binding (optional).** Add `"services": [{ "binding": "APP", "service": "airv2-app" }]`. `adapterPost` (`adapter.ts:31-36`) uses `env.APP.fetch` when bound, which makes the stale `https://air.wzrd.tech` comment at `wrangler.jsonc:10` moot.
- **Leave as-is:**
  - The admit poll loop (`workflow.ts:175-199`) and the 30 s chunking (`:52`) only cost steps, well inside Paid's 10k steps per instance.
  - `progress()` outside steps (`:101-113`) re-fires on replay, but its facts are overwrites and the room clamps percent (`room.ts` `broadcast`). The effect is cosmetic (verify the facts route).

*8. `/api/internal/create/turn` durable report (the `create.turn_done` continuation of `run.finalize`, §2.5 C7)*
- `app/api/internal/create/turn/route.ts:70-114,158-172`: replace `after(consumeAndReport)`, which holds the SSE for up to 800 s (`:37`), with R-CF-07's `run.finalize`, the only mechanism that waits for a Hermes run outside a request. No `create.turn.report` kind exists.
  - Call `startCreateTurn(..., { budget, finalizeThen: { type: "create.turn_done", jobId: job.id, role, round } })` (R-CF-07's option). `role` comes from the body (`:133-142`); parse an integer `round` from the body too (`:47`; unused today).
  - Set the finalizer's `deadlineAt` = now + the role's wait (`BRIEF_WAIT_S`/`CODE_WAIT_S`/`FIX_WAIT_S` from the job) + 60 s.
  - Delete the `after()` at `:172` and `consumeAndReport` (`:70-114`). Drop the file from R-CF-06's `after-inventory.test.ts` allowlist (inventory row 19), and `app/api/create/build/route.ts` with it (row 18).
- Continuation `createTurnDone` in `lib/create/deferred.ts`, added as type `create.turn_done` to R-CF-07's `then` continuation table in `lib/runs/finalize.ts`. R-CF-07's finalizer polls the run, **one poll per delivery**, through R-CF-06's `pollRunOnce` and `getRun` (§2.5 C6), on its own `delaySeconds` schedule. It calls the continuation once, on a terminal status, on `lost`, or at the deadline:
  - Terminal set: `{completed, failed, cancelled, interrupted}` (R-CF-06's `lib/hermes/runStatus.ts`; Hermes `api_server_run_idempotency.TERMINAL_STATUSES`; verify on the deployed Box image).
  - `lost` (a stopped Box) means the run is not live: treat it as `failed`.
  - Deadline passed → stop the run without waking the Box: `peekUserBox` (`lib/orchestrator/boxes.ts:212`), then `stopRun` (`lib/hermes/client.ts:212`) when it returns a box. Outcome `interrupted`.
- **The continuation:** call **`closeCreateRunRow`** (`turn.ts:319-336`), the side effect that `route.ts:102-103` performs today. Map the status to today's `TerminalOutcome` vocabulary (`lib/hermes/terminal.ts:9`: `completed` → `completed`; else `failed`; deadline → `interrupted`). Then post the correlated `turn_done:<role>:<round>` event (§2.5 C7): `bridgePost` `/v1/jobs/<id>/events` with `{type:"turn_done", role, round, run_id, outcome}`. `handleEvent` turns it into `turnEventType(role, round)` (step 7).
- **Idempotent:** the row close is guarded by `.is("ended_at", null)` (`turn.ts:330`), and duplicate typed events are inert.
- **Per-run token (follow-up, only if Hermes gains a run-completion hook; verify).**
  - The Box must never hold `CREATE_BRIDGE_SECRET`, the CF1 secret that authorizes job create, cancel and retry.
  - Mint `mintSignedToken({job, run, role, round, exp})` (`lib/create/bridge.ts:169`; `infra/workers/create/src/sign.ts:114`) under the key `HMAC(CREATE_BRIDGE_SECRET, "air.turn-token.v1")`. `exp` is the turn deadline.
  - Pass it in run `metadata` (`turn.ts:248`), never in `input` or `instructions`, which the model sees.
  - Verify it at a separate `POST /v1/jobs/:id/turn-events` with `verifySignedToken` (`sign.ts:131`).

*9. Box CLI*
- `infra/template/skills/create-miniapp/scripts/air-create:674`: the compile body `"{"appname":$(json_string "$name")}"` expands to invalid JSON `{appname:"x"}`. `compile/route.ts:46` then reads `null`, `validateAppName("")` throws, and every `air-create compile` gets a 400 today.
  - Fix it to `"{\"appname\":$(json_string "$name")}"`, as in `cmd_build` (`:258`).
  - No `x-air-skill` bump (`:112`): the skill version is unchanged (the routes keep reading `x-air-skill` as a fallback to the header added below), and Boxes pick up the fix on their next `sync-box.sh` (`infra/template/sync-box.sh:36-39`).
- **Skill header (§2.5 C1).** airv2-app's public `fetch` strips every inbound `x-air-*` header, so on Cloudflare the skill gate (`compile/route.ts:38,50`, `go/route.ts:42,70`) never sees `x-air-skill` and answers 426 to every Box.
  - `air-create` `api()` (`:119`, `:125`) also sends `air-skill-version: $SKILL_VERSION`.
  - Both routes read `air-skill-version` first and fall back to `x-air-skill` (Vercel, and Boxes not yet synced).
  - A Box that has not run `sync-box.sh` gets 426 `skill_update_queued` on Cloudflare until it does. Compile already fails for every Box today (above), so this is no regression.

*Route list (`app/api/create/**`, 37 routes; `app/api/internal/create/**`, 7 routes)*

| Route | Change in R-CF-10 | Elsewhere |
|---|---|---|
| `create/build` POST | `trackedBuild` (`:87`) → `claimBuild("b-"+uuid)` + `BuildBackend`. On CF: `defer("create.build",{build_id},{key:"build:"+build_id})`, then poll the ledger row every 1 s for ≤ `HOLD_MS` (`:35`) → 200/4xx (body from the row; `slug`/`url`/`preview_url` recomputed; status from `error_status`) or `202 {build_id}`. The consumer records the `create.build` ops event (`:96-106`). Removes `after()` (`:112`). The CLI already polls on 202 (`air-create:258-294`; 60 × 5 s). | R-CF-06 `defer` and queue (`max_batch_size` 1, §2.5 C7) |
| `create/compile` POST | **Stays synchronous.** Auth, skill gate, open-run check and cap unchanged (`:41-105`), except that the gate reads `air-skill-version` first (step 9). Pull (`:107-121`) → `pushWorkspaceToStore`. `compileWorkspace` (`:122`) → `BUILD /v1/compile mode:"compile"`. Same `{ok, findings, sizes}` body (`:123-132`); never 202. | — |
| `create/drop` POST | `storeBundle` via the `MEDIA` binding (r2.ts) | R-CF-09 zip memory |
| `create/events/[runId]` GET | none | R-CF-07 |
| `create/files` GET/PUT | imports from `workspace.ts`/`workspaceBox.ts` (`:18-24`) | R-CF-05 bounded wake |
| `create/finalize` POST | `mirror.ts:33` → `workspaceBox.ts`. Mirror keeps its base64 pull (`mirror.ts:441`), capped at `WORKSPACE_MAX_BYTES`. | R-CF-09 memory |
| `create/functions/approve`, `create/functions/kill` POST | `loadRelease`/`storeBundle` via the binding. Deploys stay gated (`deploy.ts:270`). | — |
| `create/functions` GET/POST, `create/functions/rotate`, `create/functions/secrets` | none (the lane is gated) | — |
| `create/github`, `create/github/connect`, `create/github/setup`, `create/github/repos` | none | — |
| `create/go` POST | Skill gate reads `air-skill-version` first (step 9); nothing else. V13 stays gated: `ready.ts:37` `lane_env` = `appOriginLaneReady()`, and the worker health probe (`ready.ts:66-82`) fails because air-create is not deployed. | — |
| `create/icon` POST | Images resizer (step 5); `WORKSPACE_ROOT` from `workspace.ts` | R-CF-09 lazy HEIC; R-CF-03 send on the generate path |
| `create/import` POST/GET/DELETE | POST: `uploadVersion` via the binding. GET/DELETE: none. | — |
| `create/intake`, `create/jobs/[id]`, `create/jobs/[id]/retry`, `create/jobs/[id]/live-token`, `create/preview-link`, `create/qa`, `create/qr`, `create/tier`, `create/projects` | none (`preview-link` stays null: `preview.ts:16`) | R-CF-12 lazy imports |
| `create/jobs/[id]/cancel` POST | `terminateJobWorkflow(job.id, job.user_id)` (step 7) | — |
| `create/jobs/[id]/request` POST | `workspacePath` from `workspaceBox.ts` (`:21`) | R-CF-05 |
| `create/plan/deliver` POST | `plan.ts:15` → `workspace.ts` | R-CF-03 sender |
| `create/progress` GET | `progress.ts:16` → `buildLedger.ts` | — |
| `create/push` POST | `uploadVersion` via the binding. Dedupe: skip staging when an `ops_events` row `kind:"create.push", ref:"<link.id>:<claims.sha>"` exists; record it after a successful stage (the pattern of `compile/route.ts:88-105`). | — |
| `create/release`, `create/rollback` POST | `loadRelease` via the binding. Dev stays 503 (`release.ts:165-167`). | — |
| `create/status` GET | `buildLedger.ts` (`:25`); reports `build.backend` | — |
| `create/turn` POST | bundled prompt and `kitVersion` (step 2); fires `BUILD /v1/warm` | R-CF-05 bounded wake |
| `create/turn/[runId]/stop` POST | none | R-CF-05 |
| `internal/create/build` POST | Body `{job_id, round?, dry?}`; `round` defaults to `create_jobs.round`. `claimBuild("job-<id>-r<round>")`; synchronous. `dry` → compile mode with no ledger row and no `uploadVersion` (bug at `:42-57`: `dry` skips only `openBuild` while `buildApp` still stages). Findings as objects (`:62,80`). | — |
| `internal/create/turn` POST | `finalizeThen: {type:"create.turn_done", jobId, role, round}` instead of `after()` (step 8); typed `turn_done` payload | R-CF-07 `run.finalize`; R-CF-06 `pollRunOnce`/`getRun` |
| `internal/create/tests` POST | `workspace.ts`/`workspaceBox.ts` (`:19`) | R-CF-05 |
| `internal/create/publish-dev` POST | binding reads; still 503 while WfP is gated | — |
| `internal/create/notify` POST | none | R-CF-03 |
| `internal/create/dev-expire`, `internal/create/facts` POST | none | — |

**Acceptance.**
- [ ] The M0 gate passes and is recorded in the PR: 0 `exceededMemory` in a 50-build soak, CPU p95 ≤ 15 s, 100 % golden parity.
- [ ] `npm run cf:build`, which sets `AIR_BUILD_TARGET=cloudflare` for `next build` (§2.5 C17), has no `esbuild/lib/main.js` and no `tailwindcss/dist/lib` in the output; R-CF-13's size gate fails on either. App CSS from `app/globals.css` still contains Tailwind utilities.
- [ ] On airv2-app (workers.dev), `POST /api/create/turn` starts a run (2xx). The run's instructions begin with the 35,026-byte Kit prompt, and `kit version` is not `unknown`.
- [ ] `air-create compile <app>` from a test Box against Cloudflare returns 2xx `{ok, findings, sizes}` synchronously, passing the skill gate through `air-skill-version`. The findings equal Vercel's for the same workspace.
- [ ] A workspace over 24 MiB gives 413 from both `compile` and `build`, as on Vercel.
- [ ] `air-create build <app>` gets 200, or 202 followed by `status: succeeded`. `create_builds.backend = 'wasm'`, and the bundle is under `air-media/apps/<slug>/<version>/`.
- [ ] Two `POST /api/internal/create/build` calls with the same `(job_id, round)` produce one `create_builds` row and one `miniapp_versions` row. The second response carries the first version.
- [ ] A takeover after a simulated mid-upload crash ends with exactly one version, at `planned_version`.
- [ ] Workflow: a stale `turn_done-brief-0`, or a `turn_done-code-0` with a foreign `run_id`, does not unblock the code wait. A cancel stops the recorded run.
- [ ] An internal turn longer than 30 s still closes its `agent_runs` row with the terminal outcome and delivers a typed `turn_done`, through `run.finalize` and the `create.turn_done` continuation (tail shows `deferred.done kind=run.finalize`). `app/api/internal/create/turn/route.ts` has no `after(`.
- [ ] Tier B is read only from `air-build/kit/restricted/`. After the owner removes the public copy (§6), `curl -sI https://media.wzrd.tech/_platform/kit/restricted/<version>.tgz` → 404. Bucket `air-build` has no public access.
- [ ] `/api/create/icon` on Cloudflare returns `resized: true` with 512 and 180 PNGs.
- [ ] WfP stays off: `appOriginLaneReady()` is false in prod, no dispatch API calls happen, and air-create is not deployed.
- [ ] Rollback: with no `BUILD` binding (Vercel), the legacy build path passes `build.test.ts` and `build-app.test.ts` unchanged.

**Tests.**
- `apps/web/lib/create/compile/vfs.test.ts` NEW. Covers:
  - relative, extension and index probing;
  - `./kit/<source>/<name>` from depth, `@kit/*`, restricted, and Tier B unavailable;
  - `path-escape`, `missing-import`, absolute refused;
  - vendor table hit/miss and the `sideEffects` flag;
  - parity with `resolveSandboxFile` and `resolveKitFile` on the same trees.
- `apps/web/lib/create/compile/golden.test.ts` NEW (Node).
  - **Fixtures:** the 6 templates; the `build.test.ts` workspace; and negatives: foreign specifier, https import, escape, missing entry, lite violation, `.module.css`, image asset, `functions/` module, locked-tests shrink. These mirror `build.test.ts:160-430`.
  - **Comparison:** legacy `build.ts` `compileWorkspace` vs `compile/core` + VFS + native esbuild. Assert identical file sha256s, findings `(rule, file, severity, line)`, sizes and manifest.
  - **Snapshot:** write `__golden__/<fixture>.json`.
- `apps/web/lib/create/compile/boundary.test.ts` NEW. Walks the **transitive** static value imports of `compile/**` (`import type` excluded) and fails on `../env`, `node:fs`, `node:os`, `esbuild`, `@supabase/*`, `storage/r2` or `miniapps/publish`.
- `infra/workers/build/test/golden.test.ts` NEW (vitest-pool-workers; per the worker-bundler README, esbuild-wasm needs workerd).
  - Runs the same fixtures through esbuild-wasm against the committed `__golden__` snapshots, with a 30 s timeout for the first test (wasm compile).
  - Pattern: `infra/workers/muse/vitest.config.ts`. That includes `miniflare: { compatibilityDate }` pinned below pool-workers 0.22's bundled workerd date.
- `infra/workers/build/test/versions.test.ts` NEW. Asserts that the `esbuild-wasm` version equals `apps/web` esbuild, and that the precompile `sbom_digest` equals the R2 key prefix.
- `infra/workers/build/test/src.test.ts` NEW. Covers the HEAD caps: missing → 404, empty → 400, cap+1 → 413. Also: a repeat key with the same digest returns the stored `result.json` and does not compile again.
- `apps/web/lib/create/buildLedger.test.ts` NEW. Covers:
  - claim/insert;
  - conflict → terminal result;
  - live lease → 409;
  - expired lease → takeover reusing `planned_version`;
  - takeover with pointer already moved → success, no upload;
  - takeover with an orphan `miniapp_versions` row → tombstone, then upload.
  - Use the mock style of `build-app.test.ts:8-80`.
- `apps/web/lib/create/workspaceBox.test.ts` NEW. Covers the command string (quoting, cap+1), exit 3 → 404, and a curl failure → 502.
- `apps/web/lib/storage/r2.test.ts` (add or extend; mock `cfEnv` from `@/lib/runtime/platform`): `mediaBucket()` returns null off Cloudflare and when `R2_BUCKET` ≠ `air-media`; the binding path is used when bound.
- `apps/web/app/api/create/compile/route.test.ts` NEW. Covers 401, 426, 409 `no_open_run`, 429 cap, and the 200 body shape with a stub `BuildBackend`; never 202.
- `apps/web/app/api/internal/create/build/route.test.ts` NEW. Covers `dry` (no row, no upload), the idempotent replay, object findings, and the `round` default.
- `apps/web/app/api/internal/create/turn/route.test.ts` NEW. Asserts that `startCreateTurn` gets `finalizeThen` with jobId, role and round plus the role-based `deadlineAt`, and that no `after()` is used.
- `apps/web/lib/create/deferred.test.ts` NEW (`FakeSupabase`, mocked `bridgePost`):
  - `createTurnDone`: terminal → close row + typed event; `lost` → `failed`; deadline → `peekUserBox` + `stopRun` (never `ensureBoxAwake`) + `interrupted`; a replay closes nothing twice.
  - The `create.build` row: schema, `maxHops` 0, and `defer` called with `key: build:<id>`.
- `apps/web/lib/create/turn.test.ts`: add a `createSystemPrompt` case with `vi.mock("node:fs")` throwing.
- `apps/web/app/api/create/build/route.test.ts`: add a CF-mode case (defer, then a 202 after the hold; then 4xx with `error_status` from the row).
- `apps/web/lib/create/skill.test.ts`: assert that `cmd_compile` in `air-create` contains `"{\"appname\":$(json_string "$name")}"`, and that `api()` sends `air-skill-version:` next to `x-air-skill:` (`:77`). The file already reads the CLI at `:23`.
- Skill header: in `apps/web/app/api/create/compile/route.test.ts` (above) and `apps/web/app/api/create/go/route.test.ts` NEW, `air-skill-version` alone passes the gate and `x-air-skill` alone still passes.
- Bridge rename: update `infra/workers/create/test/sign.test.ts`, `apps/web/lib/create/adapterReplay.test.ts` and `apps/web/app/api/internal/create/notify/route.test.ts` to `air-bridge-ts`/`air-bridge-sig`.
- `infra/workers/create/test/turnEvents.test.ts` NEW. Pure, in the existing Node vitest like `sign.test.ts`. Covers `turnEventType` and the run_id filter.
  - Optional `introspectWorkflowInstance` + `mockEvent` stale-event case. This needs vitest 4.1 + pool-workers 0.22, as in muse; the existing `vitest ^2.1.0` must move to 4.1.0 for it.
  - Use a test-only wrangler config without `browser`/`dispatch_namespaces` if miniflare rejects them (verify).
- Manual probes:
  1. Terminal A: `cd infra/workers/build && npx wrangler dev`. Seed with `npx wrangler r2 object put air-build/src/t1.tgz --local --file <template.tgz>`, then `curl -XPOST localhost:8787/v1/compile -d '{"key":"t1","mode":"build","version":"v1700000000000"}'`.
  2. Terminal B: `cd apps/web && npx opennextjs-cloudflare preview`. `BUILD` resolves through the local dev registry.
  3. On a test Box: `OPENAI_BASE_URL=https://airv2-app.<sub>.workers.dev/api/gateway/v1 air-create compile <app>`, then `air-create build <app>`.
  4. `npx wrangler tail air-build --format json`, and watch `outcome` and CPU time.

**Risks & notes.**
- **Memory is the binding risk (128 MB per isolate on Paid too).** Go linear memory only grows, and the lucide barrel brings in ~2,000 modules.
  - Mitigations: one build per isolate; vendor LRU ≤ 24 MiB; sources over 8 MiB go to the Container; retry once on the Container after an isolate death.
  - Optional, measured in M0: a lucide named-import rewrite. Use it only if golden parity holds.
- **airv2-app memory.** The Mirror (`mirror.ts:441`) and Box `drop` paths still pull base64 into airv2-app, with a peak of about 3× the archive at the 24 MiB cap. Track it under R-CF-09's bounded-memory work. If it fails, route Mirror through `pushWorkspaceToStore` plus a streamed `BUILD` read.
- **Resolver divergence.** Recorded resolutions (`resolve.json`) replace reimplementing Node resolution. One intended behaviour change: a vendor deep subpath that is not a package entry, not imported by the Kit and not used by a template is now refused. List these in the PR.
- **Cold start.** Each new isolate pays the esbuild-wasm compile (12.1 MB) plus Go init; worker-bundler notes this flaked 5 s CI timeouts. Prewarm with `/v1/warm` from turn start, and size test timeouts to match.
- **Deferred build latency.** The `create.build` hold-and-poll relies on the `air-deferred` consumer picking messages up within seconds. R-CF-06's consumer uses `max_batch_size` 1 (§2.5 C7), so one message fills a batch and is delivered without waiting for `max_batch_timeout`; R-CF-10 adds no queue settings. If tail shows slow pickup, builds answer 202, which the CLI already handles.
- **Box upload.**
  - The Box needs egress to `<account>.r2.cloudflarestorage.com` and `curl`. `curl` is present in `infra/template/setup.sh`; verify `infra/template-macos`.
  - The presigned URL is visible in the Box process list for ≤ 300 s. It covers one key, PUT only, in the private `air-build` bucket.
- **Bundle bytes** still pass once through airv2-app for `uploadVersion` (bounded by `sizes.total`). The workspace archive no longer does.
- **Container cost.** `basic` is billed on 1 GiB provisioned while running, including `sleepAfter`.
  - That is ≈120 GiB-s per cold build. The two always-warm relays already use the whole 25 GiB-h memory allotment (R-CF-03: 365 GiB-h), so every build bills ≈ $0.0003 of memory, plus disk and active vCPU.
  - Cold start is 1–3 s or more, and there is no uptime guarantee.
- **Tailwind.** v4 `build()` accumulates candidates. Caching the compiler would leak one app's classes into the next, so compile per build.
- **`air-create compile` today.** It has likely returned 400 for every Box since skill v5 (`air-create:674`), so turns self-checked nothing. Expect more compile findings once fixed.
- **air-create stays undeployed.** Its `dispatch_namespaces` (`infra/workers/create/wrangler.jsonc:26`) needs Workers for Platforms (a $25/mo add-on, not on the account). `deploy-create` (`workers.yml:127-143`) still runs on main pushes; R-CF-14.1a gates it behind `vars.WFP_ENABLED`, and disabling a CI deploy job is owner-only (§2.5 C22). The V13 fixes land as code and tests only. Draft/dev lanes stay gated by `appOriginLaneReady()` (`apps/web/lib/functions/deploy.ts:74-80`); static mini-apps keep the R2 lane.
- **P6 cleanup** ships as one follow-up PR, `R-CF-10.P6`, which the §4 P6 exit lists: delete the legacy `build.ts` `compileWorkspace`, the `kit.ts` disk extractors (`:293-345`, `:393-434`, `:487-507`) and the dead `/api/create/turn` tracing include (`next.config.ts:23-26`).

> Note for owner: Tier B must be "a private R2 object read only by the Build Service" (`packages/create-kit/restricted/README.md`). But `kit.ts:22,383` reads it from `R2_BUCKET` (default `air-media`, `lib/env.ts:594`), which `lib/storage/r2.ts:1-3` documents as public read via media.wzrd.tech. Check with `curl -sI https://media.wzrd.tech/_platform/kit/restricted/<KIT_RESTRICTED_VERSION>.tgz`. If it returns 200, the owner copies it to the new private bucket `air-build` (`kit/restricted/<version>.tgz`), deletes the public copy (deleting R2 objects is owner-only, §2.5 C22), and treats it as a licence exposure. Bucket `air-build` does not exist yet (`r2_buckets_list` 2026-10-28); R-CF-13's `ensure-resources` job creates it (§2.5 C18). It must exist before air-build deploys. Its scoped R2 token and the `## secret @air-build` values are owner actions (§6), pushed right after air-build's first deploy and before the airv2-app `BUILD` wiring merges.

**Depends on.** R-CF-01 (`## secret @air-build` format, `cf:env -- push --worker`, `env.example.test.ts`), R-CF-02 (custom entry, `wrangler.jsonc`, generated `worker-configuration.d.ts`), R-CF-06 (`defer`, the `deferHandlers.ts` table, Queue `air-deferred`, `delaySeconds`, `pollRunOnce`/`getRun`), R-CF-07 (`run.finalize`, its `then` continuations and `startCreateTurn`'s `finalizeThen`), R-CF-09 (Images resizer, `MEDIA` binding and the `r2.ts` binding path), R-CF-12 (`lib/runtime/platform.ts` `cfEnv`/`cfWaitUntil`, lazy poison imports) and R-CF-13 (`AIR_BUILD_TARGET`, size gate, `ensure-resources`, the air-build `check` row and `deploy-build` job). **Phase P3**, after R-CF-06 and R-CF-07.
