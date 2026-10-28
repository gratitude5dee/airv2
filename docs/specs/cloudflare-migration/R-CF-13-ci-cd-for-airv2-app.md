# R-CF-13 — CI/CD for airv2-app

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-13: …`.

**Why.** No pipeline builds or deploys `airv2-app`:
- `.github/workflows/workers.yml:30-160` covers only `infra/workers/**`.
- `ci.yml`'s `web` job (`ci.yml:49-66`) runs `next build`, but never `opennextjs-cloudflare build` or a wrangler dry-run.
- `ci.yml:11-13` sets `cancel-in-progress: true`, so a deploy step must never live there.
- Local OpenNext output is linted and typechecked today, because `eslint.config.mjs:8-25` and `tsconfig.json:30-31` do not exclude `.open-next/` or `.wrangler/`.

Seven other hazards need explicit guards:
- **Hostname re-take.** In non-TTY CI, wrangler 4.149.0 publishes custom domains with `override_existing_origin=true` and `override_existing_dns_record=true`, after a `changeset?replace_state=true` check (`wrangler-dist/cli.js:164150-164250`). It does this only for hosts listed in `routes[]` (`cli.js:164924-164935`). A deploy during Rollback B would silently re-take `app.wzrd.tech` from Vercel.
- **Shell re-parsing.** `wrangler deploy` in an OpenNext project delegates to `opennextjs-cloudflare deploy` unless `OPEN_NEXT_DEPLOY` is set, `--config` is passed, or the run is a dry-run (`cli.js:295631-295653,295721`). OpenNext re-invokes wrangler with `shell: true` (`dist/cli/commands/utils/run-wrangler.js:74`), which re-parses `--message`/`--define` quoting.
- **Fork safety.** `workflow_run` on a fork PR's CI runs with base-repo secrets.
- **Wrong smoke host.** Before P4, `app.wzrd.tech` is Vercel.
- **Stale deploys.** An older SHA must never be deployed over a newer one.
- **Secret leaks.** Builds must never see `.env*` files (R-CF-01 guard).
- **Missing bind targets.** wrangler rejects a deploy that binds a queue or Worker that does not exist yet (R-CF-02), and no job deploys `air-sidecar` or `air-build` (§2.5 C18).

**Deltas.**
- `.github/workflows/airv2-app.yml` — NEW:
  ```yaml
  name: airv2-app
  # R-CF-13: build + deploy apps/web to the airv2-app Worker after CI is green on main.
  # CI holds only CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID + public NEXT_PUBLIC_* vars; app env ships via R-CF-01.
  on:
    workflow_run: { workflows: [CI], types: [completed], branches: [main] }
    workflow_dispatch:
      inputs:
        mode: { type: choice, options: [deploy, rollback], default: deploy }
        sha: { type: string, required: false, description: "main commit (default: tip of main)" }
        rollback_to: { type: string, required: false, description: "Worker version id (mode=rollback)" }
        attach_domains: { type: boolean, default: false, description: "OWNER ONLY: allow attaching routes[].custom_domain hosts not yet on airv2-app (R-CF-14 fallback when the dashboard attach fails)" }
        force_smoke_failure: { type: boolean, default: false, description: "add a must-404 path to the smoke set to exercise auto-rollback" }
  permissions: { contents: read, actions: read }
  concurrency: { group: airv2-app-deploy, cancel-in-progress: false }
  env:
    OPEN_NEXT_DEPLOY: "true"            # plain wrangler deploy: no shell re-quoting, no populateCache (no incremental cache configured)
    NEXT_TELEMETRY_DISABLED: "1"
    SMOKE_URL: ${{ vars.AIRV2_SMOKE_URL }}   # origin only; steps append /api/version. P1-P3: https://airv2-app.gratitude-8f4.workers.dev ; from P4: https://app.wzrd.tech
  jobs:
    ensure-resources:
      # §2.5 C18: queues and buckets airv2-app binds exist, and every Worker it binds has a deployment.
      if: >-
        vars.AIRV2_ROLLBACK_B != 'true' && (
          (github.event_name == 'workflow_dispatch' && inputs.mode == 'deploy' && github.ref == 'refs/heads/main') ||
          (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' &&
           github.event.workflow_run.event == 'push' &&
           github.event.workflow_run.head_repository.full_name == github.repository))
      runs-on: ubuntu-latest
      timeout-minutes: 15
      environment: airv2-app
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        SHA: ${{ inputs.sha || github.event.workflow_run.head_sha || github.sha }}
      steps:
        - uses: actions/checkout@v4
          with: { ref: "${{ env.SHA }}", fetch-depth: 0 }
        - name: On main
          run: git merge-base --is-ancestor "$SHA" origin/main || { echo "::error::$SHA not on main"; exit 1; }
        - uses: actions/setup-node@v4
          with: { node-version-file: .nvmrc, cache: npm }
        - run: npm ci
        - name: Create queues/buckets, wait for bound Workers
          working-directory: apps/web
          run: npx tsx scripts/cf-ensure-resources.ts
    deploy:
      needs: ensure-resources
      if: vars.AIRV2_ROLLBACK_B != 'true'      # repeated on purpose (§2.5 C21); the trigger conditions are on ensure-resources
      runs-on: ubuntu-latest
      timeout-minutes: 40
      environment: airv2-app
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        SHA: ${{ inputs.sha || github.event.workflow_run.head_sha || github.sha }}
        NEXT_PUBLIC_THIRDWEB_CLIENT_ID: ${{ vars.NEXT_PUBLIC_THIRDWEB_CLIENT_ID }}
      steps:
        - uses: actions/checkout@v4
          with: { ref: "${{ env.SHA }}", fetch-depth: 0 }
        - id: gate
          name: On main, CI green, not older than live
          env: { GH_TOKEN: "${{ github.token }}" }
          run: |
            git merge-base --is-ancestor "$SHA" origin/main || { echo "::error::$SHA not on main"; exit 1; }
            if [ "${{ github.event_name }}" = workflow_dispatch ]; then
              n=$(gh run list --workflow CI --commit "$SHA" --json conclusion,event \
                  --jq '[.[]|select(.event=="push" and .conclusion=="success")]|length')
              [ "$n" -gt 0 ] || { echo "::error::CI not green for $SHA"; exit 1; }
            fi
            v=$(curl -fsS --max-time 10 "$SMOKE_URL/api/version" || true)
            live=$(jq -r '.sha // empty' <<<"$v" 2>/dev/null || true)
            echo "env_digest=$(jq -r '.env_digest // empty' <<<"$v" 2>/dev/null || true)" >> "$GITHUB_OUTPUT"
            if [ -n "$live" ] && [ "$live" != "$SHA" ] && git merge-base --is-ancestor "$SHA" "$live" 2>/dev/null; then
              echo "skip=true" >> "$GITHUB_OUTPUT"; echo "::notice::live $live is newer than $SHA — skipping"
            fi
        - if: steps.gate.outputs.skip != 'true'
          uses: actions/setup-node@v4
          with: { node-version-file: .nvmrc, cache: npm }
        - if: steps.gate.outputs.skip != 'true'
          run: npm ci
        - if: steps.gate.outputs.skip != 'true'
          name: Domain guard (never re-take a hostname, e.g. during Rollback B)
          working-directory: apps/web
          env: { ATTACH_DOMAINS: "${{ inputs.attach_domains }}" }
          run: npx tsx scripts/cf-domain-guard.ts
        - if: steps.gate.outputs.skip != 'true'
          name: OpenNext build (leak guards pre/post, AIR_BUILD_TARGET=cloudflare)
          working-directory: apps/web
          run: npm run cf:build
        - if: steps.gate.outputs.skip != 'true'
          name: Dry-run bundle + size gate
          working-directory: apps/web
          run: npm run cf:dry-run
        - if: steps.gate.outputs.skip != 'true'
          id: prev
          working-directory: apps/web
          run: echo "version=$(npx wrangler deployments status --json | jq -r '.versions | max_by(.percentage) | .version_id')" >> "$GITHUB_OUTPUT"
        - if: steps.gate.outputs.skip != 'true'
          id: deploy
          working-directory: apps/web
          env: { WRANGLER_OUTPUT_FILE_PATH: "${{ runner.temp }}/wrangler-out.ndjson" }
          run: |
            set -o pipefail
            built_at=$(date -u +%FT%TZ)
            npx wrangler deploy --tag "$SHA" --message "airv2 ${SHA:0:12} run $GITHUB_RUN_ID" \
              --define "__AIR_BUILD_SHA__:\"$SHA\"" --define "__AIR_BUILT_AT__:\"$built_at\"" | tee "$RUNNER_TEMP/deploy.log"
            echo "version=$(jq -r 'select(.type=="deploy") | .version_id' "$WRANGLER_OUTPUT_FILE_PATH" | tail -1)" >> "$GITHUB_OUTPUT"
            ms=$(grep -oE 'Worker Startup Time: [0-9]+ ms' "$RUNNER_TEMP/deploy.log" | grep -oE '[0-9]+' | tail -1 || true)
            echo "startup_time_ms=${ms:-unknown}" >> "$GITHUB_STEP_SUMMARY"
            if [ -n "$ms" ] && [ "$ms" -gt 800 ]; then echo "::warning::startup_time_ms=$ms > 800 (platform limit 1 s)"; fi
        - if: steps.gate.outputs.skip != 'true'
          name: Smoke
          run: |
            for i in $(seq 1 20); do
              v=$(curl -fsS --max-time 10 "$SMOKE_URL/api/version" || true)
              [ "$(jq -r '.sha // empty' <<<"$v" 2>/dev/null)" = "$SHA" ] && break
              [ "$i" = 20 ] && { echo "::error::/api/version never reported $SHA"; exit 1; }
              sleep 6
            done
            paths="/login /mini"
            [ "${{ inputs.force_smoke_failure }}" = true ] && paths="$paths /__air_smoke_must_404"
            if [ "$(jq -r .target <<<"$v")" = cloudflare ] || [ "$(jq -r .switch_host <<<"$v")" = false ]; then
              for p in $paths; do
                c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$SMOKE_URL$p")
                [ "$c" = 200 ] || { echo "::error::$p -> $c"; exit 1; }
              done
            fi
            echo "deployed $SHA (${{ steps.deploy.outputs.version }})" >> "$GITHUB_STEP_SUMMARY"
        - if: failure() && steps.deploy.outcome == 'success'
          name: Roll back to the pre-deploy version
          working-directory: apps/web
          run: |
            prev="${{ steps.prev.outputs.version }}"
            [ -n "$prev" ] && [ "$prev" != null ] || { echo "::error::no previous version recorded"; exit 1; }
            npx wrangler rollback "$prev" -m "smoke failed ${SHA:0:12}" -y
            echo "rolled back ${{ steps.deploy.outputs.version }} -> $prev" >> "$GITHUB_STEP_SUMMARY"
            want="${{ steps.gate.outputs.env_digest }}"; d=""
            for i in 1 2 3 4 5 6; do
              d=$(curl -fsS --max-time 10 "$SMOKE_URL/api/version" | jq -r '.env_digest // empty' || true)
              [ "$d" = "$want" ] && break; sleep 5
            done
            [ "$d" = "$want" ] || echo "::error::rollback restored different env packs ($d != $want) — owner: run npm run cf:env -- push"
    rollback:
      if: github.event_name == 'workflow_dispatch' && inputs.mode == 'rollback' && inputs.rollback_to != ''
      runs-on: ubuntu-latest
      timeout-minutes: 10
      environment: airv2-app
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version-file: .nvmrc, cache: npm }
        - run: npm ci
        - working-directory: apps/web
          run: |
            npx wrangler rollback "${{ inputs.rollback_to }}" -m "manual rollback run $GITHUB_RUN_ID" -y
            curl -fsS "$SMOKE_URL/api/version" | tee -a "$GITHUB_STEP_SUMMARY"
  ```
  - **Secrets scope.** The Cloudflare secrets are set at job level in all three jobs, where the `airv2-app` environment's secrets resolve.
  - **Ordering.**
    - Schema lands first. `workflow_run` fires only after CI completes, including `deploy-migrations` (`ci.yml:151-166`, `environment: production` approval). A pending approval delays the deploy. A rejected one fails CI, so nothing deploys.
    - Bind targets come next (§2.5 C18). `ensure-resources` creates the queues and buckets `wrangler.jsonc` names and waits until every bound Worker has a deployment. `deploy` starts only after it succeeds, and it is skipped when `ensure-resources` is skipped.
  - **Tagging.**
    - The version tag is the full SHA (`--tag "$SHA"`). If the API rejects 40 chars, use `${SHA:0:12}` (verify).
    - The message carries the run id.
    - The bundle bakes `__AIR_BUILD_SHA__` (R-CF-02, §2.5 C5), which survives `cf-env push` versions.
    - `__AIR_BUILT_AT__` carries the deploy time (UTC ISO-8601) for R-CF-12's `buildDeployedAt()`. It goes through R-CF-02's `build-info.ts`, like the SHA. No code reads an undeclared define, so the flag is harmless before those land. `--define` splits on the first `:` (R-CF-02), so the colons in the timestamp survive.
    - The new version id comes from `WRANGLER_OUTPUT_FILE_PATH` (the ND-JSON `deploy` entry, developers.cloudflare.com/workers/wrangler/system-environment-variables/). The previous one comes from `deployments status --json` (`cli.js:360069-360095`, `.versions[].version_id/percentage`).
  - **Startup time.** The deploy step records `startup_time_ms` in the job summary and warns above 800 ms; the platform limit is 1 s (R-CF-15 budget table). It parses wrangler's `Worker Startup Time: N ms` line. Verify that wording in 4.149.0, and prefer a field of the ND-JSON `deploy` entry if it has one. `set -o pipefail` keeps the `tee` from hiding a failed deploy, because the default `bash -e` shell does not set it.
  - **Rollback in CI.** `wrangler rollback -y` proceeds even when secrets changed since the target version. In non-interactive mode `confirm2` returns `true` (`cli.js:139587-139596`, `360319-360345`). The old packs come back with it, hence the `env_digest` check. Re-pushing is owner-only (§2.5 C22).
  - **Dropped design gate.** The Vercel commit-status gate from the design is dropped: the Vercel team is blocked, so it would block every deploy. `/_switch` GET reports both SHAs instead (R-CF-02; switch semantics in §2.5 C12).
- `apps/web/scripts/cf-ensure-resources.ts` — NEW, run with `tsx` (§2.5 C18).
  - It reads `wrangler.jsonc` with `experimental_readRawConfig`, as the domain guard does. `planResources(raw)` returns three lists:
    - `queues`: every `queues.producers[].queue`, `queues.consumers[].queue` and `consumers[].dead_letter_queue`, each name once. Today there are none; R-CF-06 adds `air-deferred` and `air-deferred-dlq`.
    - `buckets`: every `r2_buckets[].bucket_name`. That is `air-media`, plus R-CF-09's private thumb bucket if R-CF-09 picks R2.
    - `services`: every `services[].service` except `airv2-app` itself, so `SELF` is skipped. That covers `air-sidecar` (R-CF-03) and `air-build` (R-CF-10).
  - For each queue it runs `wrangler queues create <q> || true`, and then `wrangler queues info <q>` must exit 0.
  - For each bucket it runs `wrangler r2 bucket create <b> || true`, and then `wrangler r2 bucket info <b>` must exit 0. Verify both `info` subcommands in 4.149.0.
  - A create that fails because the resource already exists is the normal re-run path. The `info` check catches a real failure, such as a missing token scope.
  - For each service it polls `wrangler deployments status --name <w>` every 30 s for up to 10 min.
    - This covers a PR that both scaffolds a side Worker and binds it: that PR's `workers.yml` deploy runs while CI is still going.
    - On timeout it fails with `::error::<w> has no deployment — its workers.yml deploy job must succeed first (§2.5 C18)`.
  - Workflows, DO classes and containers need no pre-creation, because `wrangler deploy` creates them from config.
  - It never deletes anything (§2.5 C22).
  - Export `planResources(raw)` and `ensureResources(plan, run, opts)` for tests. `run(args) → Promise<{ code }>` and the clock are injectable.
- `apps/web/scripts/cf-domain-guard.ts` — NEW, run with `tsx`.
  - Read `routes[]` entries with `custom_domain: true` via `experimental_readRawConfig({ config: "wrangler.jsonc" })`, exported by wrangler 4.149.0 (`cli.js:3699`).
  - For each hostname, call `GET https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains?hostname=<h>` (verify filter params) and require a record with `service == "airv2-app"`.
  - Otherwise fail with `refusing to attach <h>: not currently on airv2-app (Rollback B, or the attach is not done yet) — owner: attach it in the dashboard (R-CF-14 runbook step 4), or dispatch with attach_domains=true as the fallback`, unless `ATTACH_DOMAINS=true`.
  - With no custom-domain routes it is a no-op; wrangler only publishes listed domains.
  - An API error fails closed.
  - Export `checkDomains(rawConfig, fetchFn, attach)` for tests.
- **Rollback B contract (CI side).**
  - The owner sets repo variable `AIRV2_ROLLBACK_B=true` (§2.5 C21, C22) before detaching the domain and restoring the Vercel CNAME. `ensure-resources` and `deploy` are then skipped.
  - R-CF-14's runbook sets and unsets exactly this name. No other freeze variable and no second `if:` exist.
  - The domain guard independently refuses re-attachment.
  - The owner clears the variable only after one of two things:
    - the `routes` entry has been removed from `wrangler.jsonc`;
    - the host has been deliberately re-attached by the R-CF-14 cutover runbook: the dashboard attach, with an `attach_domains=true` dispatch as its fallback.
- `.github/workflows/ci.yml` — NEW `cf-build` job, for PRs and pushes, with no deploy:
  ```yaml
    cf-build:
      # R-CF-13: the exact OpenNext build airv2-app.yml deploys, as a dry run.
      runs-on: ubuntu-latest
      timeout-minutes: 30
      env: { NEXT_TELEMETRY_DISABLED: "1", CLOUDFLARE_ACCOUNT_ID: ci-dry-run,
             NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "${{ vars.NEXT_PUBLIC_THIRDWEB_CLIENT_ID }}" }
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version-file: .nvmrc, cache: npm }
        - run: npm ci
        - name: OpenNext build (leak guards pre/post, AIR_BUILD_TARGET=cloudflare)
          working-directory: apps/web
          run: npm run cf:build
        - name: wrangler types are current
          working-directory: apps/web
          run: npx wrangler types --check --env-interface CloudflareEnv worker/worker-configuration.d.ts
        - name: Dry-run bundle + size gate
          working-directory: apps/web
          run: npm run cf:dry-run
  ```
  - This mirrors `workers.yml:64-73`. `cf-build` is part of CI, so its failure fails the `workflow_run` conclusion and blocks the deploy.
  - A dry-run skips the `secrets.required` check (`cli.js:180410-180418`).
  - The types step enforces §2.5 C4. An item that adds a binding regenerates `worker/worker-configuration.d.ts` with `npm run cf:types` in the same PR. A hand edit, or a binding added without regenerating, fails here.
- `apps/web/scripts/cf-guard.ts` — add `size <outdir> [<metafile>]` (R-CF-01 added `pre`/`post`). Export `checkSize(dir, assetsDir, limits, meta)` so tests pass small thresholds and fixture metafiles.
  - **Bundle.** Raw = the sum of the bytes in `<outdir>`, excluding `*.map`; this is wrangler's "Total Upload".
    - Fail at raw > 60 MiB; the limit is 64 MiB uncompressed on Paid.
    - Warn at raw > 48 MiB.
    - Gzip is reported only. The compressed 10 MB limit was removed on 2026-09-04 (developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/; developers.cloudflare.com/workers/platform/limits/#worker-size).
  - **Assets.** For `.open-next/assets`:
    - fail when the file count is > 90,000 (Paid limit 100,000 per version);
    - fail when any file is > 25 MiB.
  - **Forbidden modules (§2.5 C17).** `FORBIDDEN_MODULES` rows have the shape `{ match, owner, enforce }`. Each `match` is a substring tested against the metafile's input paths.
    - `node_modules/esbuild/lib/main.js` and `node_modules/tailwindcss/dist/lib` are owned by R-CF-10. Its `AIR_BUILD_TARGET` aliasing removes them.
    - The report-only rows are `node_modules/ffmpeg-static/`, `node_modules/sharp/` and `node_modules/heic-convert/`, owned by R-CF-09.
    - A hit on an `enforce: true` row fails the gate. A hit on an `enforce: false` row prints `::warning::`.
    - Both R-CF-10 rows ship with `enforce: false`. Today's server graph still reaches esbuild and tailwind (Appendix A: 19 entries), so failing on them would block every P1–P2 deploy. R-CF-10 sets both rows to `enforce: true` in the PR that adds the aliasing. From then on the gate fails on them, as C17 requires. R-CF-09 decides whether to promote its own rows.
    - Without a metafile, the check falls back to scanning the bundle text for esbuild's `// <path>` module comments.
  - **Report.** Print the 15 largest modules, ranked by the metafile's `bytesInOutput`, to `$GITHUB_STEP_SUMMARY` when it is set. This catches traced binaries such as `ffmpeg-static` (`next.config.ts:13,30`) or native `esbuild` leaking into the bundle; R-CF-09 and R-CF-10 remove them. Large bundles also eat into the 1 s startup limit.
- `.github/workflows/workers.yml:37-42` — add `- { name: app-switch, dir: infra/workers/app-switch }` to the `check` matrix. This is the dry-run-only check of the copy that R-CF-02 vendors (§2.5 C19):
  - `src/index.js`;
  - a `wrangler.jsonc` with KV `HOSTING`, vars `UPSTREAM_CF`/`UPSTREAM_VERCEL` and no `routes`;
  - the live routes, recorded only in its `README.md`.

  The dir has no `package.json`, `tsconfig` or tests, so `npm ci`, `tsc` and `vitest` skip and only the dry-run runs (`:48-74`). Add no app-switch deploy job: every app-switch deploy is owner-only (§2.5 C19, C22).
- `.github/workflows/workers.yml` — NEW `deploy-sidecar` and `deploy-build` jobs (§2.5 C18). R-CF-13 owns both. Each needs `check`, reuses the `if:` of `deploy-create` (`:130`), and starts with a presence step, so the jobs can land in P1 before the dirs exist:
  ```yaml
    deploy-sidecar:
      # R-CF-13: air-sidecar Worker + Containers (R-CF-03, R-CF-09). Docker on the runner builds the images.
      name: deploy air-sidecar
      needs: check
      if: github.event_name != 'pull_request' && (github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch')
      runs-on: ubuntu-latest
      timeout-minutes: 30
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      steps:
        - uses: actions/checkout@v4
        - id: present
          run: |
            if [ -f infra/workers/sidecar/wrangler.jsonc ]; then echo "ok=true" >> "$GITHUB_OUTPUT";
            else echo "::notice::infra/workers/sidecar not scaffolded yet (R-CF-03)"; fi
        - if: steps.present.outputs.ok == 'true'
          uses: actions/setup-node@v4
          with: { node-version-file: .nvmrc }
        - if: steps.present.outputs.ok == 'true'
          working-directory: infra/workers/sidecar
          run: docker info >/dev/null && npm ci && npx wrangler deploy
    deploy-build:
      # R-CF-13: air-build (R-CF-10). The build steps inside this job are R-CF-10's.
      name: deploy air-build
      needs: check
      if: github.event_name != 'pull_request' && (github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch')
      runs-on: ubuntu-latest
      timeout-minutes: 20
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      steps:
        - uses: actions/checkout@v4
        - id: present
          run: |
            if [ -f infra/workers/build/wrangler.jsonc ]; then echo "ok=true" >> "$GITHUB_OUTPUT";
            else echo "::notice::infra/workers/build not scaffolded yet (R-CF-10)"; fi
        - if: steps.present.outputs.ok == 'true'
          uses: actions/setup-node@v4
          with: { node-version-file: .nvmrc, cache: npm }
        - if: steps.present.outputs.ok == 'true'
          run: npm ci --ignore-scripts          # root: tsx, apps/web esbuild 0.25.0, packages/create-kit (R-CF-10)
        - if: steps.present.outputs.ok == 'true'
          working-directory: infra/workers/build
          run: |
            npx wrangler r2 bucket create air-build || true   # §2.5 C18; lifecycle rules are R-CF-10's
            npm ci && npm run precompile                       # R-CF-10
            # R-CF-10 vendor upload: npx wrangler r2 object put air-build/kit/vendor/<sbom16>/<file> --file <f> --remote, per generated/vendor file
            npx wrangler deploy
  ```
  - R-CF-10 supplies the build steps inside `deploy-build` and adds no other deploy job. R-CF-03 and R-CF-09 add no deploy job.
  - The `sidecar` and `build` rows of the `check` matrix come with the PRs that create those dirs (R-CF-03, R-CF-10). A row whose dir is missing fails `check`.
  - **First deploy of a side Worker.**
    1. The deploy job creates the Worker.
    2. The owner runs `npm run cf:env -- push --worker air-sidecar`. R-CF-01 refuses that push until a deployment exists, and running it is owner-only (§2.5 C22).
    3. The keep-warm alarm restarts the container with the secrets (R-CF-03).

    `air-build` and `## secret @air-build` follow the same order. The scoped R2 API token for `air-build` is created by the owner (§6); CI only creates the bucket.
  - **Merge order.** airv2-app deploys only after the Workers it binds exist (§2.5 C18). Prefer landing a side Worker in its own PR before the PR that binds it. When one PR does both, `ensure-resources` waits for the `workers.yml` deploy.
  - **Docker.** `ubuntu-latest` ships Docker. `wrangler deploy` builds and pushes the container images (verify whether the `check` row's `--dry-run` also needs Docker).
- `apps/web/package.json` — canonical script set.
  - Who lands what:
    - `cf:env`, `cf:build` and `cf:preview` land with R-CF-01, which owns `cf-guard pre`/`post`.
    - `typecheck` and `cf:types` land with R-CF-02.
    - R-CF-13 adds `cf:dry-run` and makes `cf:build` set `AIR_BUILD_TARGET=cloudflare` (§2.5 C17; R-CF-13 owns the flag):
  ```json
  "typecheck": "tsc --noEmit && tsc -p worker/tsconfig.json --noEmit",
  "cf:env": "tsx scripts/cf-env.mjs",
  "cf:types": "wrangler types --env-interface CloudflareEnv worker/worker-configuration.d.ts",
  "cf:build": "tsx scripts/cf-guard.ts pre && AIR_BUILD_TARGET=cloudflare opennextjs-cloudflare build && tsx scripts/cf-guard.ts post",
  "cf:dry-run": "wrangler deploy --dry-run --outdir .wrangler/dist --metafile .wrangler/meta.json && tsx scripts/cf-guard.ts size .wrangler/dist .wrangler/meta.json",
  "cf:preview": "opennextjs-cloudflare preview"
  ```
  - **`AIR_BUILD_TARGET`.** It is build-time only: never a Worker var and never an md name (§2.5 C17). `opennextjs-cloudflare build` passes it to the `next build` it spawns, which is where R-CF-10's `next.config.ts` aliasing reads it. The Vercel `build` never sets it. The inline `VAR=… cmd` form needs a POSIX shell (CI and owner machines).
  - **Metafile.** It is written outside `--outdir`, so it does not count toward "Total Upload" (verify `--metafile` on `deploy` in 4.149.0).
  - **Do not pass extra args to `cf:dry-run`.** `npm run x -- args` appends them to the last command, here the guard. A dry-run never delegates to OpenNext, so it needs no `OPEN_NEXT_DEPLOY`.
  - **`build` stays `next build`** (`package.json:7`). `opennextjs-cloudflare build` invokes it, including `prebuild` (`:12`), and must not recurse.
  - **No `cf:deploy`.** Local deploys would bypass the gates and ship `__AIR_BUILD_SHA__ = "dev"`. Use the workflow's dispatch mode; the only exception is the one-off before this item lands (R-CF-02).
  - **Version bumps.** The wrangler range bump (`:68` `^4.0.0` → `^4.148.0`) and the next bump (`:29`) belong to R-CF-12. OpenNext 1.20.10 declares the peer ranges `wrangler ^4.148.0` and `next >=15.5.27`.
- `apps/web/tsconfig.json:31` → `"exclude": ["node_modules", "worker", ".open-next", ".wrangler"]`.
  - TS still checks `worker/env-pack.ts` through imports from `scripts/`, which is why it must stay pure.
  - R-CF-02 lands this, the worker tsconfig and the `eslint` ignores below in its own PR (R-CF-02 Deltas). R-CF-13 specifies them and checks them in `cf-build`.
- `apps/web/worker/tsconfig.json` — NEW, created in R-CF-02's PR with this content: `{ "compilerOptions": { "target": "ES2022", "module": "esnext", "moduleResolution": "bundler", "lib": ["ES2023"], "types": ["node"], "strict": true, "noEmit": true, "skipLibCheck": true, "isolatedModules": true, "verbatimModuleSyntax": true }, "include": ["./**/*.ts"] }`.
  - `worker-configuration.d.ts` supplies `CloudflareEnv` and the runtime types, including `cloudflare:workers` (§2.5 C4).
  - The generated `../.open-next/worker.js` imports carry `@ts-expect-error`, so typecheck passes with or without a build.
- `apps/web/eslint.config.mjs:8-25` — add `".open-next/**"`, `".wrangler/**"` and `"worker/worker-configuration.d.ts"` to `ignores`.
- `apps/web/vitest.config.ts:53` — the unit `exclude` gets `".open-next/**"` and `".wrangler/**"`. `vitest.pure-tests.txt` must list `worker/env-pack.test.ts` and `scripts/env-md.test.ts`; R-CF-01 adds them, so check that they are present.
- **Repo and environment settings (owner).**
  - GitHub environment `airv2-app` holds `CLOUDFLARE_API_TOKEN`, or reuses the repo-level secrets (`workers.yml:8`). `workers.yml`'s `deploy-sidecar` and `deploy-build` use the repo-level secrets, so that token needs every scope below. Token scopes (verify):
    - Workers Scripts Edit;
    - Account Settings Read;
    - Queues Edit (for `ensure-resources`, once R-CF-06 lands) and Workflows Edit (once R-CF-08 lands);
    - Workers R2 Storage Edit, for `ensure-resources` and for `deploy-build`'s bucket create and `r2 object put`;
    - Containers Edit, for `deploy-sidecar` (verify the permission's name; older UIs call it Cloudchamber);
    - from P4, Workers Routes Edit + DNS Edit on zone wzrd.tech.
  - Repo variables:
    - `AIRV2_SMOKE_URL`: origin only; the workflow appends `/api/version`.
    - `AIRV2_ROLLBACK_B`: an owner-held lever (§2.5 C21, C22).
    - `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`: set by `cf:env -- public`.

**Acceptance.**
- [ ] A PR touching `apps/web` runs `cf-build`: guard pre/post, OpenNext build with `AIR_BUILD_TARGET=cloudflare`, `wrangler types --check`, dry-run, and a size table in the job summary. Planting `apps/web/.env.local` makes it fail at `cf-guard pre`.
- [ ] While the R-CF-10 rows are `enforce: false`, the `cf-build` summary lists the forbidden-module hits (`esbuild/lib/main.js`, `tailwindcss/dist/lib`) as warnings, and the job stays green.
- [ ] A main push with all CI jobs green deploys exactly once. `wrangler deployments status` shows the version tagged with the SHA, and `$SMOKE_URL/api/version` reports that SHA within 2 min. The job summary shows `startup_time_ms`.
- [ ] A failed or cancelled CI run does not deploy.
- [ ] Two pushes 30 s apart never leave the older SHA live; the log shows the gate's skip notice.
- [ ] Dispatching `mode=deploy` with `force_smoke_failure=true` triggers `wrangler rollback` to the recorded previous version. The job is red and the summary lists both version ids.
- [ ] Rollback B guards:
  - `airv2-app-workflow.test.ts` pins the `AIRV2_ROLLBACK_B` guard on `ensure-resources` and `deploy`.
  - In the owner's drill, `AIRV2_ROLLBACK_B=true` skips both jobs (§2.5 C22).
  - With the variable unset, a `routes[]` custom domain that is not on airv2-app fails the domain guard before `wrangler deploy`. The unit tests show this, and so does the owner's rollback B drill on the canary (R-CF-14.1b).
- [ ] After R-CF-06's queue config merges, the first deploy creates `air-deferred` and `air-deferred-dlq` before `wrangler deploy`, and a re-run is a no-op.
- [ ] A `services[]` target with no deployment fails `ensure-resources` after the 10-min wait, and `deploy` does not start.
- [ ] Before `infra/workers/sidecar` or `infra/workers/build` exists, `deploy-sidecar` and `deploy-build` log a notice and pass. A main push that touches `infra/workers/sidecar` deploys `air-sidecar` with its container image.
- [ ] `grep -n 'secrets\.' .github/workflows/airv2-app.yml` shows only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- [ ] `npm run typecheck` and `npm run lint` pass both with and without a local `.open-next/`.

**Tests.**
- `apps/web/scripts/cf-guard.test.ts` — tmpdir fixtures calling the exported functions:
  - `pre`: `.env.production` at the root fails; `.env.local` in the app fails; `.env.airv2.md` + `.dev.vars` alone pass.
  - `post`: a `next-env.mjs` with `{}`×3 passes; one with a key fails; the canary value found under `.open-next/` fails.
  - `size`: warn and fail thresholds via small injected limits; `*.map` ignored; asset-count and per-file limits enforced.
  - `size`, forbidden modules:
    - a fixture metafile with `node_modules/esbuild/lib/main.js` warns under `enforce: false` and fails under `enforce: true`;
    - report-only rows never fail;
    - the 15-largest table is ordered by `bytesInOutput`;
    - without a metafile, the `// <path>` comment scan finds the same hit.
- `apps/web/scripts/cf-domain-guard.test.ts` — injected `fetchFn`:
  - no custom domains → no-op;
  - a hostname attached to `airv2-app` passes;
  - a hostname that is absent or attached to `app-switch` fails;
  - `ATTACH_DOMAINS=true` passes;
  - an API error fails closed.
- `apps/web/scripts/cf-ensure-resources.test.ts` — injected `run` and clock:
  - `planResources` collects producer, consumer and DLQ queue names once each, every bucket, and every non-self service;
  - a failed `create` followed by a passing `info` passes; a failing `info` fails;
  - a service that never reports a deployment fails after 10 fake minutes;
  - `airv2-app` itself is never polled;
  - no `delete` command is ever issued.
- `apps/web/scripts/airv2-app-workflow.test.ts` — a text test over `new URL("../../../.github/workflows/airv2-app.yml", import.meta.url)`:
  - the `ensure-resources` and `deploy` job blocks each contain `vars.AIRV2_ROLLBACK_B != 'true'`;
  - `deploy` has `needs: ensure-resources`;
  - `AIRV2_DNS_ROLLBACK` appears nowhere;
  - `secrets.` references only the two Cloudflare names.

  This is the local stand-in for the owner-only freeze drill (§2.5 C22).
- Manual probes:
  - `npm run cf:build && npm run cf:dry-run` locally. Check that `.wrangler/meta.json` exists and that the summary table lists the forbidden-module warnings.
  - After merge, dispatch `airv2-app` (`mode=deploy`) on main and watch `npx wrangler tail airv2-app`.
  - Dispatch `mode=rollback` with the previous version id from `npx wrangler deployments list`, and confirm `/api/version` shows the old SHA.
  - After R-CF-06 merges, confirm with `npx wrangler queues list` that both queues exist.
  - Owner: set `AIRV2_ROLLBACK_B=true`, re-run, confirm the skip, then delete the variable (§2.5 C22).

**Risks & notes.**
- **Fork safety.** `workflow_run` workflows run from the default branch's copy, so `airv2-app.yml` triggers only after it is on main.
  - `branches: [main]` also matches a fork branch named `main`.
  - Fork-PR CI runs carry base-repo secrets. The `event == 'push'` and `head_repository == github.repository` checks on `ensure-resources` keep them from deploying, because `deploy` needs that job.
- **Double build.** The CF build re-runs `next build` (`prebuild` included) in both `cf-build` and the deploy job. That costs extra CI minutes; accept it rather than passing artifacts across a `workflow_run` boundary.
- **Every CI job gates deploys**, including unrelated ones (`contract-eval`, `python`). A flaky job blocks deploys; re-run it. A `mode=deploy` dispatch still requires green CI for that SHA.
- **Rollback and env.** `wrangler rollback` across a `cf-env push` restores the older packs (see Deltas). The step compares `env_digest` and tells the owner to re-push (§2.5 C22).
- **No populateCache.** `OPEN_NEXT_DEPLOY=true` skips OpenNext's `populateCache`. If an R2/KV incremental cache is ever configured in `open-next.config.ts`, switch to `opennextjs-cloudflare deploy`. Then pass `--message`/`--define` without spaces or quotes, because it re-parses them with `shell: true`.
- **Smoke host.** It must be served by this Worker: workers.dev until P4, then `app.wzrd.tech`, where `/api/version` is answered before the switch.
  - Deep probes run only when the target is `cloudflare` or the host is not a switch host.
  - After P6 sets `workers_dev:false`, `AIRV2_SMOKE_URL` must already be `https://app.wzrd.tech`, as an origin with no path.
- **First custom-domain attach (P4/P5).** The owner attaches the host in the dashboard (R-CF-14 runbook step 4), after writing `target=cloudflare` to KV (R-CF-02 owner note; both are owner-only, §2.5 C22).
  - The 14.x merge deploy then passes the domain guard, because the host is already on airv2-app.
  - Dispatch with `attach_domains=true` is the owner's fallback only when step 4 fails. In CI, wrangler then overrides the existing Vercel CNAME without prompting (R-CF-14).
- **Staged forbidden modules.** Until R-CF-10 flips its two rows, native esbuild and tailwind still ship in the bundle, and the gate only warns about them. R-CF-12 makes them lazy imports, so they cost bytes and startup time, not correctness. If R-CF-10 forgets the flip, C17 is unmet; its acceptance checks the gate.
- **Bind-target wait.** `ensure-resources` can add up to 10 min when a side Worker's deploy lags. A failed side deploy blocks every airv2-app deploy until it is fixed. That is intended: it fails closed instead of letting wrangler reject the binding mid-deploy.
- **Startup parsing.** If wrangler changes the `Worker Startup Time` wording, the summary shows `unknown` and no warning fires. Recheck the line after any wrangler bump.

**Depends on.** R-CF-01 (cf-guard `pre`/`post`, `cf:build`/`cf:preview`, packs and `env_digest`), R-CF-02 (entry, `/api/version`, `build-info.ts` defines, worker tsconfig and generated types, vendored app-switch).
