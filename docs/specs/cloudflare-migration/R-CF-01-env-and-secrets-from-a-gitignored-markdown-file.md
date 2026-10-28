# R-CF-01 — Env and secrets from a gitignored markdown file

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-01: …`.

**Why.** Missing values break requests. `instrumentation.ts:8-10` calls `validateEnv()`, which throws only when `environment === "production"` (`lib/env.ts:267-285`). That argument defaults to `source["NODE_ENV"] ?? "development"` (`lib/env.ts:269`). OpenNext never sets the runtime `NODE_ENV` on workerd, so today `validateEnv()` only warns there (R-CF-12 (n) confirms this in Workers Logs). PR #522's 500s on `/mini` and `/api/store/search` therefore most likely came from `required()` (`lib/env.ts:7-13`) throwing inside `serviceClient()` (`lib/supabase.ts:12`) at call time, because only 57 of about 90 prod values were set on `airv2-app`. That fits the 200/500 split of the probes. Diagnose from Workers Logs first (R-CF-12 (n)). Once R-CF-12 (n) passes the inlined `NODE_ENV`, a missing required name fails every route on that isolate, so `check` must pass on production values before that line ships. The manifest admits far more names than the Paid binding budget:
- the env inventory (§1.5) has 217 server names;
- R-CF-01/02/03 add 6 more to `apps/web/env.example.md`; later items add their own (R-CF-05 `TENKI_RELAY`, R-CF-08 four `CREATIVE_*`/`FAL_*` names, R-CF-10 a `## secret @air-build` section);
- 4 are Vercel-injected and never set;
- that leaves about 219 settable names before those later additions, against **128 vars+secrets per Worker, 5 KB each** on Workers Paid (developers.cloudflare.com/workers/platform/limits/#environment-variables; the limit counts "secrets + text" only).

Individual secrets are also fragile, for two reasons:
- OpenNext copies every string binding into `process.env` once per isolate (`@opennextjs/cloudflare` 1.20.10 `dist/cli/templates/init.js:25-38,87-92`, guarded by `initialized`).
- A secrets-only change "may reuse existing isolates" (developers.cloudflare.com/workers/runtime-apis/bindings/). So a rotated key can stay stale indefinitely.

The obvious alternatives leak values. OpenNext inlines `.env`, `.env.<mode>`, `.env.local` (except for `test`) and `.env.<mode>.local`, from both the app dir and the repo root, into `.open-next/cloudflare/next-env.mjs` for all three modes (`dist/cli/build/open-next/compile-env-files.js`, `dist/cli/utils/extract-project-env-vars.js`). Anyone with Workers Scripts:Read can download that bundle.

So all values are packed into 8 fixed secrets plus a digest. They are uploaded atomically from a local markdown file. R-CF-02's `applyEnv(env)` (`apps/web/worker/env-unpack.ts`) unpacks them with this item's `createApplier`, as the first statement of every entrypoint (§2.5 C3).

**Deltas.**
- `apps/web/.env.airv2.md` — the owner-local values file, never committed. Two rules already ignore it: `.gitignore:11` (`.env*`) and `.gitignore:40` (explicit). `.dev.vars` is ignored at `.gitignore:38`. Keep all three rules.
- **File format (normative; matches the committed, hand-edited `apps/web/env.example.md`, §2.5 C20).**
  - **Sections.** Only H2 lines (`## `) delimit sections. These headings are recognized exactly (case-sensitive, trailing spaces trimmed):
    - `## secret` (`env.example.md:36`): server secrets, packed into `AIR_ENV_*`.
    - `## plain` (`:161`): server non-secrets, also packed. Both sections ship as Worker secrets. The split is documentation, drives `check` redaction and limits the canary scan.
    - `## public` (`:488`): `NEXT_PUBLIC_*` only. These become GitHub repo variables inlined at build. Never packed.
    - `## secret @<worker>` (`:495`, e.g. `@air-sidecar`; R-CF-10 adds `@air-build`): individual (unpacked) secrets of one Worker. `<worker>` matches `^[a-z][a-z0-9-]{0,62}$`. Names may repeat names from server sections. `@airv2-app` is allowed and holds the secrets that must work without the packs (today only `SWITCH_TOKEN`, see R-CF-02).
    - Any other H2 is prose or reference: the `# …` title, `## How to use`, `## Rules`, and `## Vercel-injected (reference only…)` at `:503`. Fences there may hold only comment lines (`# NAME=`). A non-comment `KEY=` line under such a heading is an error, which catches typos like `## Secret`.
  - **Fences.** Each env section holds exactly one fenced block with info string `dotenv`. Text outside fences is ignored.
  - **Values.** Fence content is parsed with `dotenv@17` `parse()` semantics:
    - `KEY=value` and `#` comment lines;
    - single quotes are literal;
    - double quotes allow real newlines (PEM) and `\n` escapes;
    - no variable expansion, so a literal `$` survives.
    - Do NOT use `@dotenvx/dotenvx` `parse`. It expands `${…}` and runs command substitution (verify), which would corrupt secrets that contain `$`.
  - **Rejected value forms.**
    - An unquoted value containing `#` is an error. `dotenv` cuts an unquoted value at `#`, so `KEY=ab#cd` silently becomes `ab`. Quote it.
    - Duplicates are detected by a quote-aware line scanner before `parse()`, because `parse()` silently keeps the last value. The scanner skips continuation lines of an open quoted value, so base64 PEM lines never count as keys.
  - **Names.** Must match `^[A-Z][A-Z0-9_]*$`. `KEY=` with an empty value means "unset" and is dropped, never shipped as `""`, because `optional()` returns `""` instead of its fallback (`lib/env.ts:15-17`).
  - **Reserved names, rejected in every env section:**
    - `AIR_ENV_*`, `NODE_ENV`, `NEXTJS_ENV`, `CF_VERSION_METADATA`;
    - the build-owned `AIR_BUILD_*` and `AIR_BUILT_*` names: `AIR_BUILD_SHA`, which the entry sets from `BUILD_SHA` (§2.5 C5), `AIR_BUILD_TARGET`, which is build-time only (§2.5 C17), and any build timestamp such as `AIR_BUILT_AT`;
    - the OpenNext-owned `OPEN_NEXT_ORIGIN`, `__NEXT_PRIVATE_ORIGIN` and `DEPLOYMENT_ID` (`init.js:101-116`);
    - every binding name in `wrangler.jsonc` (`ASSETS`, `HOSTING`, `SELF`, …);
    - the names listed in the `## Vercel-injected` reference fence (`VERCEL_OIDC_TOKEN`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_CREATED_AT`, `VERCEL_REGION`);
    - any name containing `#`.
    - Do NOT reserve `VERCEL_*` wholesale: `VERCEL_AUTOMATION_BYPASS_SECRET` (`env.example.md:158`) is a real spec name.
  - **Section rules.**
    - A name may appear once across `## secret` + `## plain`.
    - `NEXT_PUBLIC_*` may appear only in `## public`, and `## public` holds only `NEXT_PUBLIC_*`.
- `apps/web/scripts/env-md.ts` — NEW, Node-only. `parseEnvMd(text) → { server: Map<string,{value,section}>, public: Map<string,string>, workers: Map<string, Map<string,string>>, errors: string[] }`, implementing the rules above. Error strings name line, section and key only, never values. Add `"dotenv": "17.4.2"` (already in the lockfile) to apps/web `devDependencies`.
- `apps/web/worker/env-pack.ts` — NEW. Pure: imports only `node:crypto`, and must typecheck under both the root and the worker tsconfig. Shared by the CLI and the Worker.
  - **Constants.** `PACK_SLOTS = ["AIR_ENV_00", …, "AIR_ENV_07"]`, `DIGEST_KEY = "AIR_ENV_DIGEST"`, `SLOT_BYTES = 4_800` (UTF-8 bytes of the serialized slot; headroom under 5 KB), `CHUNK_BYTES = 4_700`.
  - **`digest(values)`** = sha256 hex of `"air-env-v1\n" + JSON.stringify([...values].sort(byName))`. It hashes the logical name→value map, not the chunks.
  - **Packing** (deterministic: the same input gives byte-identical slots):
    1. Entry size `e = bytes(JSON.stringify(name)) + 1 + bytes(JSON.stringify(value))`, measured after JSON escaping (a PEM's `\n` costs 2 B).
    2. If `e > CHUNK_BYTES`, split the value by code point into `NAME#0..NAME#n-1`, each entry ≤ `CHUNK_BYTES`. Never split inside a surrogate pair.
    3. Sort entries by size descending, then by name ascending. Fill the 8 slots first-fit-decreasing. An entry fits when `used + e + (slotEmpty ? 0 : 1) + 2 ≤ SLOT_BYTES`.
    4. If an entry does not fit, throw `env too large: <total> B > capacity 38,384 B — add slots (and secrets.required)`. Capacity is 8 × 4,798.
    5. Serialize each slot with keys sorted. Unused slots are `"{}"`.
    - `serializeSlot(obj, { dotenvSafe })`: when `dotenvSafe` is set, also replace `'`, `` ` ``, `$` and `#` with `\u0027 \u0060 \u0024 \u0023`. The JSON stays valid and parses to the same value. Use this mode for `.dev.vars`, which wrangler reads with dotenv + dotenv-expand (wrangler 4.149.0 `cli.js:191036-191071`).
  - **`unpack(source)`:**
    - parse each slot as an object of strings;
    - reassemble `#i` chunks; indices must be contiguous from 0, and a bare `NAME` may not coexist with `NAME#i`;
    - recompute `digest` and require it to equal `source.AIR_ENV_DIGEST`;
    - throw on any defect, with a message that names the slot or key, never a value.
  - **`createApplier(target)`** returns `{ apply(source) → { changed: boolean, error: string | null }, names() → ReadonlySet<string> }`.
    - `applyEnv` calls `apply` on every invocation of every entrypoint (§2.5 C3), so the same-digest path must stay a string compare.
    - If the digest equals the last applied digest, `apply` does nothing. The sentinel starts as `undefined`, so a missing digest still errors.
    - Otherwise it unpacks, then sets `target[name] = value` for each name (overwrite, never `??=`). It deletes names it applied previously that are now absent, and leaves names it never set untouched.
    - It always deletes the `AIR_ENV_*` keys and the digest key from `target`.
    - On error it keeps the previous values and the previous `names()`, and returns the error.
- `apps/web/scripts/cf-env-lib.ts` — NEW. Typed implementation, exporting `main(argv, deps) → Promise<number>`. `deps` holds the injectable `spawn`, `fetch`, `cwd` and `stdin` prompt. It imports `./env-md`, `../worker/env-pack` and `../lib/env`. It never prints a value: output shows name, section, byte length and a sha256 fingerprint of 8 hex characters.
- `apps/web/scripts/cf-env.mjs` — NEW. Thin CLI shim with the name the contract fixes: `import { main } from "./cf-env-lib.ts"; process.exitCode = await main(process.argv.slice(2), realDeps);`. Run it with `tsx` (root devDep `tsx@4.20.6`). The logic lives in `.ts` because root `tsc` (`tsconfig.json:30` includes `**/*.ts`) cannot type a test's import of an `.mjs` file (TS7016 under `strict`). Devin implements and tests every subcommand against fixtures and fake `deps`. Runs against production values are the owner's (§2.5 C22, §6.8). Subcommands:
  - **`check [--file apps/web/.env.airv2.md]`.** These are errors:
    - parse errors;
    - unknown names: anything in a server section or in `@airv2-app` that is not in `REQUIRED_ENV ∪ OPTIONAL_ENV ∪ REQUIRED_GROUPS`;
    - a name in `## plain` that `env.example.md` lists under `## secret` (classification drift);
    - `validateEnv(serverValues, "production")` failures.
    - Then it runs a dry pack and prints the slot plan.
    - It warns when a name shadows a `wrangler.jsonc` `vars` key; the packed value wins (R-CF-02).
    - Exit 1 on any error.
  - **`pack [--stdout]`.** Runs `check`, then prints the slot plan and the digest prefix. `--stdout` writes the bulk JSON to stdout for piping, never to a file.
  - **`push [--yes] [--dry-run] [--prune-legacy] [--verify-url <origin>] [--worker <name> | --all]`.** Owner-only against production (§2.5 C22): the owner runs it, and Devin covers it in `cf-env.test.ts` with fake `deps`.
    1. `check`, then `pack`.
    2. Run `wrangler secret list --name airv2-app --format json`. Every secret that is not `AIR_ENV_*` and not listed in `## secret @airv2-app` is "legacy". Today's 57 individual secrets are such legacy names (verify).
    3. Legacy handling:
       - By default, legacy names are **kept** and listed. That way the first push (before R-CF-02 is live) does not break the running PR #522 code, and `secrets.required` is satisfied before R-CF-02's first deploy.
       - `--prune-legacy` adds them as `null` (delete). It refuses unless `<verify-url>/api/version` returns a non-null `env_digest`, which proves the R-CF-02 entry is live.
       - The owner runs `--prune-legacy` (§2.5 C22, §6.8) only after R-CF-02 has served for 24 h with A1 (R-CF-15) silent and a rotation drill has succeeded (the rotation check under Acceptance).
    4. Confirm (`--yes` skips the prompt), then spawn `wrangler secret bulk --name airv2-app` with the JSON on **stdin**, never on disk or argv. That is one PATCH and one new version (wrangler 4.149.0 `cli.js:310633-310661`). Stay at ≤ 100 entries; today it is 9 + ≤ 57 deletions.
    5. If `--verify-url` (default `$AIRV2_SMOKE_URL`) is set, poll `/api/version` until `env_digest` equals the new 12-hex prefix on 3 consecutive responses (≤ 90 s). A 404 means a pre-R-CF-02 build: skip the poll with a notice.
    - `--worker <name>` pushes the `## secret @<name>` section as individual secrets, with `wrangler secret bulk --name <name>`. It refuses when `wrangler deployments status --name <name>` reports no deployment, because bulk would otherwise create a draft Worker. `--all` pushes airv2-app packs and then every `@worker` section, `@airv2-app` included. It skips any `@worker` whose Worker is not deployed yet, names it, and exits 1.
    - **Order for a new side Worker** (`air-sidecar`, `air-build`):
      1. Its deploy job in `.github/workflows/workers.yml` deploys it (§2.5 C18).
      2. The owner runs `npm run cf:env -- push --worker <name>`.
      3. Only then does the airv2-app PR that binds it merge (§2.5 C18).
      - A container receives its secrets in `ctx.container.start({ env })` (R-CF-03). A container that started before the push keeps the old or missing values until it restarts. R-CF-03 owns that restart.
  - **`dev [-- <cmd…>]`.**
    - Writes **only** `apps/web/.dev.vars`. It holds exactly the 9 pack names, each as `NAME='<serializeSlot(…, { dotenvSafe: true })>'`. `secrets.required` makes `wrangler dev` load only listed keys from `.dev.vars` (`cli.js:191115-191122`), so raw names would be dropped.
    - With `-- <cmd>` (e.g. `next dev`), it spawns `<cmd>` with the server and public values merged into the **child process env**. Nothing else is written.
    - This is the supported way to run any Node command with the values, e.g. `npm run cf:env -- dev -- npx next start` for R-CF-05's Node-host migration.
    - It never creates any file whose basename starts with `.env`.
  - **`public [--dry-run]`.** For each `## public` name, runs `gh variable set <NAME> --repo gratitude5dee/airv2 --body <value>`. Refuses names that are not `NEXT_PUBLIC_*`. The owner runs it (§6.8).
- `apps/web/scripts/cf-guard.ts` — NEW leak guard, run with `tsx`. R-CF-13 adds `size` and runs `pre`/`post` around the build in its `cf:build` script.
  - `pre` fails if any of the 8 OpenNext-read files exists in `apps/web/` or the repo root: `.env`, `.env.local`, `.env.production`, `.env.production.local`, `.env.development`, `.env.development.local`, `.env.test`, `.env.test.local`.
    - `.env.airv2.md` and `.dev.vars` are not on OpenNext's list and are allowed.
    - A `vercel env pull` output must be converted into the md and then deleted.
  - `post` dynamic-imports `.open-next/cloudflare/next-env.mjs` and requires `production`, `development` and `test` to all be `{}`.
    - Locally, when `.env.airv2.md` exists, it also scans `.open-next/**` for every `## secret` and `## secret @*` value ≥ 12 chars. Any hit fails (secret canary).
  - Export the checks as functions (`checkPre(roots)`, `checkPost(outDir, canaries)`) so tests call them directly.
- `apps/web/wrangler.jsonc` — add `"secrets": { "required": ["AIR_ENV_00","AIR_ENV_01","AIR_ENV_02","AIR_ENV_03","AIR_ENV_04","AIR_ENV_05","AIR_ENV_06","AIR_ENV_07","AIR_ENV_DIGEST"] }`.
  - A deploy then fails if the owner never pushed (wrangler 4.149.0 inherit-bindings check, `cli.js:176159-176206`). A dry-run skips the check (`cli.js:180410-180418`).
  - Secrets survive `wrangler deploy`: "Secrets are never deleted by a deployment" (developers.cloudflare.com/workers/configuration/secrets/).
- `apps/web/lib/env.ts:60-230` (`OPTIONAL_ENV`) — add these, alphabetically:
  - The **27 unmanifested** names:
    - 6 read in `lib/env.ts` through multi-line `optional(` calls: `AGENT_EMAIL_DOMAIN` (:473), `CF_DISPATCH_HEALTH_URL` (:618), `GMI_REQUEST_QUEUE_URL` (:685), `IMESSAGE_EXTENSION_BUNDLE_ID` (:579), `NAMESPACE_COMPUTE_API` (:318), `WALLET_USDC_ADDRESS` (:436).
    - 21 read in `lib/create/config.ts:30-85` through `int/flag/text`: `CREATE_CANDIDATE_TTL_S`, `CREATE_COMPILE_MAX_PER_TURN`, `CREATE_DEV_MIN_QA`, `CREATE_DEV_ORIGIN_SUFFIX`, `CREATE_DEV_TTL_DAYS`, `CREATE_ICON_MODEL`, `CREATE_INTAKE_ABANDON_DAYS`, `CREATE_INTAKE_MAX_QUESTIONS`, `CREATE_LIVE_TOKEN_TTL_S`, `CREATE_MAX_BUILDER_TURNS`, `CREATE_MAX_FAILED_BUILDS`, `CREATE_MAX_FIX_ROUNDS`, `CREATE_MIRROR_ENABLED`, `CREATE_PLAN_MAX_REVISIONS`, `CREATE_PROGRESS_TEXT_MS`, `CREATE_PROGRESS_TICK_MS`, `CREATE_PUBLIC_ZIP_MAX_BYTES`, `CREATE_SKILL_VERSION_MIN`, `CREATE_V13`, `GMI_CREATE_BUILD_EFFORT`, `WZRD_CREATE_REPO`.
  - The 6 R-CF-01/02/03 names already in the template: `SWITCH_TOKEN`, `EDGE_PROXY_SECRET`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `UPSTREAM_VERCEL`, `IMESSAGE_TRANSPORT`, `PHOTON_IMESSAGE_HTTP_ADDRESS`. This item owns these 6 `OPTIONAL_ENV` entries. R-CF-02, R-CF-03 and R-CF-12 add only the accessors (for example `edgeProxySecret()`, `imessageTransport()`, `photonImessageHttpAddress()`) and never a second entry.
- `apps/web/lib/env.test.ts` — the coherence regexes miss multi-line calls.
  - Change `:96-97` to `/required\(\s*"([A-Z0-9_]+)"/g` and `/optional\(\s*"([A-Z0-9_]+)"/g`, and `:120` to `/required\(\s*"([A-Z0-9_]+)"/g`. No multi-line `required(` call exists today, so the required check stays green.
  - Also scan `lib/create/config.ts` with `/(?:int|flag|text)\(\s*"([A-Z0-9_]+)"/g`.
  - The claim at `:26-28` ("its vars are in OPTIONAL_ENV") then becomes true.
- `apps/web/env.example.md` — committed with this spec and hand-edited from here on. No generator exists or is added (§2.5 C20). Every later item that adds a name edits the file directly: in the right section, under the `# --- added by docs/specs/cloudflare-migration.md ---` block, with an `R-CF-NN:` tag comment. `lib/env.example.test.ts` enforces format and completeness. Edit it as follows:
  - Drop the 27 `unmanifested: add to OPTIONAL_ENV` tags, the `unmanifested` tag rule (`:27`) and the "27 of them are unmanifested" count line (`:33`).
  - Move `SWITCH_TOKEN=` and its comment (`:153-154`) into a new `## secret @airv2-app` section, placed before `## secret @air-sidecar`.
  - Update the "Counts at generation" lines (`:30-34`) and retitle them "Counts at R-CF-01 (<date>)". They are a dated snapshot: later items do not maintain them, and the test does not check them.
  - Re-point every `(lib/env.ts:N)` / `(lib/create/config.ts:N)` reference. Inserting 33 names into `OPTIONAL_ENV` shifts every `lib/env.ts` accessor line by +33. The new test (below) enforces this and prints the corrected citation for each stale one, so re-pointing stays a mechanical hand edit.
  - Keep the section order.
- `apps/web/lib/env.example.test.ts` — NEW (see Tests).
- `apps/web/package.json` — add `"cf:env": "tsx scripts/cf-env.mjs"` and devDep `"dotenv": "17.4.2"`. The other `cf:*` scripts are in R-CF-13: `cf:build` (which sets `AIR_BUILD_TARGET=cloudflare`, §2.5 C17), `cf:dry-run` and `cf:preview`.
- **Paid budget.**
  - **Bindings.** In steady state the text bindings are 9 packs + `SWITCH_TOKEN` (`@airv2-app`) + the 2 wrangler `vars` (`UPSTREAM_VERCEL`, `SWITCH_HOSTS` from R-CF-02, which also deletes `AIR_PUBLIC_ORIGIN`, §2.5 C1) = 12 of 128. Until `--prune-legacy`, the ~57 legacy secrets add to that, for ~69 of 128. KV/DO/queue/R2/service bindings do not count (the limit is "secrets + text").
  - **Capacity vs. estimate.** Capacity is 8 × 4,798 = 38,384 B. The estimate:
    - ~56 secrets × ~80 B ≈ 4.5 KB;
    - `GITHUB_APP_PRIVATE_KEY` PEM ≈ 1.7 KB;
    - ~60 set plain values × ~50 B ≈ 3 KB.
    - That is about 9-10 KB: 2-3 slots, with ~4× headroom.
  - **Why not 1 secret per name.** 219 > 128, and even the ~90 set today leave little growth room. Per-name rotation is unreliable (once-per-isolate copy). `wrangler secret bulk` takes ≤ 100 entries per atomic call.

**Acceptance.**
- [ ] `npm run cf:env -- check` exits 0 on a complete fixture md (dummy values that satisfy `validateEnv`). It exits 1, naming the problem, when:
  - `SUPABASE_URL` is removed;
  - a value sits under `## Secret`;
  - `NEXT_PUBLIC_X` is under `## plain`;
  - a value is `KEY=ab#cd` (unquoted).
  - The owner repeats the clean run on the real `.env.airv2.md` (§6.8).
- [ ] (owner-run; Devin supplies the command and expected output in the PR) `cf:env -- push` on the PR #522 code keeps every legacy secret: `wrangler secret list --name airv2-app` shows them plus `AIR_ENV_00..07` + `AIR_ENV_DIGEST`.
- [ ] (owner-run, with R-CF-02 live; Devin supplies the command and expected output in the PR) `cf:env -- push --prune-legacy` leaves exactly the 9 packs + `SWITCH_TOKEN`. Without a live `env_digest`, it refuses (`cf-env.test.ts` covers the refusal).
- [ ] No subcommand creates a file whose basename starts with `.env`. `dev` writes only `.dev.vars`, with exactly 9 keys.
- [ ] (owner-run, with R-CF-02 live; Devin supplies the command and expected output in the PR) Rotation without redeploy works: change one value, push, and `/api/version` `env_digest` flips to the new prefix within 90 s. Workers Logs show `{ "msg": "env.unpack", "digest": "<12hex>", "rotated": true }` (§2.5 C16) from already-warm isolates.
- [ ] (with R-CF-02 live, after the owner's `--prune-legacy`) On workers.dev, with only packs set, `/login` returns 200 and `/api/store/search?q=a` does not return 500 (the PR #522 repro).
- [ ] (owner runs `cf:env -- public`; the bundle check runs with R-CF-13's CI build) `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` exists as a repo variable, and the CF build's client bundle contains it.
- [ ] `tsx scripts/cf-guard.ts post` fails locally when a canary secret is planted in `apps/web/.env.local` (with `pre` skipped; build by hand as under Manual). (with R-CF-13) It passes in CI.
- [ ] `lib/env.test.ts` and `lib/env.example.test.ts` are green, and the 27 names are in `OPTIONAL_ENV`.

**Tests.**
- `apps/web/worker/env-pack.test.ts` — add it to `vitest.pure-tests.txt`. It mutates only a local target object, never `process.env`. Cases:
  - Round trip.
  - Empty values dropped.
  - Byte-identical output for permuted input.
  - A slot of exactly 4,800 B is accepted; 4,801 B spills to the next slot.
  - A 1.7 KB PEM with newlines round-trips.
  - A 12 KB allowlist (~330 UUIDs) is chunked to `#0..#2` and reassembled.
  - Emoji and non-ASCII are never split mid-code-point.
  - Over capacity throws with the total bytes.
  - A tampered slot gives a digest-mismatch error. A missing chunk and a bare+chunked collision each give an error. No error string contains a value.
  - `dotenvSafe` output contains no `' \` $ #` and `JSON.parse`s to the same object.
  - Applier:
    - The same digest is a no-op (`changed:false`).
    - A new digest overwrites a changed value, deletes a removed name, keeps unmanaged names, and updates `names()`.
    - `AIR_ENV_*` is removed from the target.
    - An error keeps the previous values and `names()`.
- `apps/web/scripts/env-md.test.ts` — add it to `vitest.pure-tests.txt`. Cases:
  - A template-shaped doc parses.
  - A prose-section `KEY=x` is an error.
  - A duplicate across `secret`/`plain` is an error.
  - A duplicate inside one fence is an error.
  - A PEM base64 line ending in `=` is not counted as a key.
  - `A='p$ss${X}'` and `A="p$ss${X}"` stay literal.
  - Unquoted `#` is an error.
  - Multi-line double-quoted PEM.
  - `## secret @air-sidecar` and `## secret @airv2-app` get their own maps.
  - Reference fences (`# VERCEL_REGION=`) are ignored.
  - `VERCEL_AUTOMATION_BYPASS_SECRET` is accepted; `VERCEL_REGION=` set in `## plain` is rejected.
  - `AIR_BUILD_SHA=` and `AIR_BUILT_AT=` set in `## plain` are rejected as reserved.
- `apps/web/scripts/cf-env.test.ts` — calls `main()` from `cf-env-lib.ts` with fake `deps`. Cases:
  - `dev` in a tmpdir writes only `.dev.vars`, whose keys are exactly the 9 packs.
  - `push`: the payload goes to stdin (never argv). Legacy names are absent by default and present as `null` with `--prune-legacy`. Prune refuses when the fake `/api/version` has no `env_digest`.
  - `push --worker <name>` refuses when the fake `wrangler deployments status` reports no deployment. `--all` skips that Worker, names it and exits 1.
  - `public` refuses non-`NEXT_PUBLIC_*` names.
- `apps/web/lib/env.example.test.ts`:
  - Parse `env.example.md` with `parseEnvMd`.
  - Every manifest name appears exactly once: as `NAME=` in `## secret`/`## plain`/`## secret @airv2-app`, or as `# NAME=` in a reference section.
  - Every non-reference, non-`@<other-worker>` name is in the manifest.
  - Every `NAME=` line has an empty value.
  - Every `REQUIRED_ENV` name's preceding comment contains `required`, and group members say `at least one of`.
  - No `unmanifested` tag remains.
  - Every `(lib/env.ts:N)` / `(lib/create/config.ts:N)` citation points at a line containing that name. The failure message lists each stale citation with its corrected line.
  - `## public` equals the set of `NEXT_PUBLIC_*` reads found with `ENV_READ` from `env.test.ts:36` over `app/`, `components/` and `lib/` (today `app/home/panels/wallet-panel.tsx:19`).
- `apps/web/lib/env.test.ts` — new case: a fixture string with a multi-line `optional(\n  "X",` call is detected.
- Manual:
  - Before R-CF-13 (no `cf:*` build scripts yet), in `apps/web`: `npm run cf:env -- check && npm run cf:env -- dev`, then `npx tsx scripts/cf-guard.ts pre && AIR_BUILD_TARGET=cloudflare npx opennextjs-cloudflare build && npx tsx scripts/cf-guard.ts post`.
  - With R-CF-02 and R-CF-13: `npm run cf:env -- check && npm run cf:env -- dev && npm run cf:build && npm run cf:preview`, then `curl -s localhost:8787/api/version | jq .env_digest`.
  - `npx wrangler tail airv2-app --format json` while the owner runs `cf:env -- push`, watching for `"msg":"env.unpack"` with `"rotated":true` (§2.5 C16).

**Risks & notes.**
- **Pushes are owner-only.** Devin never runs `push` against production, including `--prune-legacy`, `--worker` and `--all` (§2.5 C22). The PR supplies the commands and their expected output, and `cf-env.test.ts` covers the behaviour with fake `deps`.
- **Pushes ship on top of live code.** `wrangler secret bulk` creates and deploys a new version on top of the **live** code, so pushing while a bad version is live re-ships it. Do not push while an `airv2-app.yml` deploy is running.
- **Rollback restores old packs.** Worker versions snapshot secrets, so `wrangler rollback` to a version from before a push restores the old packs. In CI, wrangler auto-confirms the "secrets have changed" prompt: `confirm2` returns its fallback `true` when non-interactive (`cli.js:139587-139596`), then retries the rollback with the force flag (`cli.js:360319-360345`, code 10220). After any rollback, re-check `env_digest`; if it differs, the owner re-pushes (R-CF-13 automates the check).
- **Vercel "plain" secrets.** Vercel stores `APP_ORIGIN_SIGNING_KEY`, `CREATE_BRIDGE_SECRET` and `LIVE_TOKEN_SECRET` as type "plain". Keep them under `## secret` and consider rotating them during the migration. (`CANDIDATE_SECRET` is WfP-only and not in the manifest; do not copy it, §6.8.)
- **Vercel is not written.** `cf-env` does not write to Vercel. When the owner unblocks Vercel, `EDGE_PROXY_SECRET` (R-CF-02; read by `lib/http/edge.ts`, §2.5 C11) must also be set on the Vercel project by hand (§6.3).
- **Plaintext on disk.** `.dev.vars` and `.env.airv2.md` hold plaintext on the owner's disk. That is the accepted trade-off of owner decision 2. CI never sees values.
- **Single source of truth.** The md is it. `wrangler.jsonc` `vars` stay non-secret and committed.
- **Secret leaks via `next dev`.** It loads `.env*` files itself. None may exist (`cf-guard pre`), so `cf:env -- dev -- next dev` is the only supported dev path.

**Depends on.** none. Acceptance items marked "(with R-CF-02 …)" or "(with R-CF-13)" are checked once those items land. Both depend on this one, so they are not listed here.
