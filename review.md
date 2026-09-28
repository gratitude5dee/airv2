# air 2.0 — Engineering Review and Work Order for Devin SWE-2 Max

**Reviewed at:** `gratitude5dee/airv2` commit `01ab5db` (branch `claude/practical-heisenberg-wmfola`, forked from `main` on 2026-09-25). `main` moved one merge ahead (`4ace807`, PR #459) while this review was being written; nothing below depends on that merge.
**Written:** 2026-09-25.
**Audience:** Devin SWE-2 Max, working autonomously, reporting back to the product owner.
**Prior review:** the 249-finding September review for Astra Ultra now lives at `docs/review-2026-09/astra-ultra-review.md`. Its ledger (`docs/review-findings.json`) and tracker (`scripts/review-tracker.py`) were repointed and still validate. This document does not repeat those findings; it tells you which of them the evidence says to do first, and adds what has changed since.

---

## 0. Read this first: the operating contract

This is a work order, not an essay. Everything in it was measured on this commit, in this container, with the commands in Appendix A. Where a number comes from a committed report instead of a fresh run, it says so.

**How to work it**

1. Reproduce the baseline in §1 before changing anything. If any number differs from the table, stop and report the difference first.
2. Do §3 (P0) in order. Each P0 item names the evidence, the change, the test to add, and the command that proves it. Do not batch P0 items into one PR.
3. Then work the workstreams in §4 in the order given. Inside a workstream, item order is the recommended order; dependencies are called out.
4. Every commit message names at least one finding ID from this document (`R-…`) or the prior ledger (`MEM-…`, `LAT-…`, and so on). Commits that touch a ledger finding also update `docs/review-findings.json` and run `python3 scripts/review-tracker.py --check`.
5. When you are done, or blocked, produce the report in §6. The report is the deliverable; the PRs are its evidence.

**Rules that do not bend**

- Never skip, quarantine, `.skip`, or delete a test to get green. Fix the code or fix the test with a reason in the commit.
- Never widen a fail-open path. If a check fails open today and you touch it, it fails closed when you leave (or you write down why not).
- Never apply a migration to production from your session. `migrate.yml` does that on merge; your job is to make it safe (§3, R-P0-5).
- Never add a mini-app, skill, card kind, decision kind, or channel. The prior review's 90-day freeze (CA-19) still stands; the git log shows the opposite has been happening (§2, T5).
- Never reinterpret a passing unit test as a product result. `continue.md` says this already; the evidence in §2 shows why it matters here.
- Do not touch `docs/review-2026-09/astra-ultra-review.md` except through `scripts/review-tracker.py --sync`.

**What "done" means for this work order**

All five acceptance gates in §5 pass, and the report in §6 is filed with the numbers filled in from fresh runs, not from memory.

---

## 1. Baseline, measured on this commit

### 1.1 Repository shape

| Measure | Value |
|---|---|
| TypeScript source files (`.ts`/`.tsx`, all packages, excluding tests) | ~1,000 |
| `apps/web/lib` source / test lines | 90,194 / 54,455 |
| `apps/web/app/api` route handler lines | 27,650 across 258 `route.ts` files |
| SQL migrations | 127 (`supabase/migrations/0001` to `0127`) |
| Python source under `infra/template` | 69 files |
| Test files in the repository | 435 |
| Test files that root `npm test` actually runs | 339 (all in `apps/web`) |
| Test files that nothing in CI runs | 98 (21 Python, 72 skill `.test.mjs`, 3 worker tests, 1 SQL, plus 4 verifier scripts) |
| Open pull requests | 10, the oldest from 2026-08-17 |
| Commit velocity, last 10 days | ~10 non-merge commits per day; 41 of the last 111 by Devin AI |

### 1.2 The five CI gates, run locally (4 vCPU, Node 22.22.2)

| Gate | Result | Wall time | Notes |
|---|---|---|---|
| `tsc --noEmit` | **pass** | 35 s | strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all on |
| `eslint .` | **pass, 789 warnings** | 28 s | 744 warnings come from one committed bundle, `public/creator-os/draw-studio.js`, which is missing from the ignore list; 39 are in real source, 21 of them in test files |
| `vitest run` | **pass: 339 files, 3,758 tests, 3 skipped** | 91 s | collect phase 108 s vs test phase 41 s: import graphs dominate, not assertions. 297 lines of stderr noise, see §2 T1 |
| `vitest run --coverage` (v8, `lib/**`, `app/api/**`, `middleware.ts`) | **53.1 % lines, 71.4 % functions** | 82 s | branch % is inflated by unexecuted files; use lines. Per-module table in §4.2 |
| `next build` | **pass with warnings** | 2 m 25 s | prebuild emits a 2.4 MB `onairos-connect.js`; `libheif-js` WASM warning |
| GitHub-hosted `ci.yml` | pass | ~5.5 min | run 408 on 2026-09-24 failed on a known millisecond flake and was re-run instead of fixed (`b96c994`) |

### 1.3 What CI never runs, run locally

| Suite | Result | Notes |
|---|---|---|
| `infra/template/openviking/tests` (unittest) | 65 passed | stdlib only |
| `infra/template/tests` (manage-soul) | 6 passed | |
| `infra/template/taskrouter/tests` | 14 passed | |
| `infra/template/learning/tests` (pytest) | 26 passed | |
| `scripts/tests/test_imessage_upload.py` | 11 passed | needs the vendored pytypedstream wheel |
| `infra/template/plugins/air-vault/tests` | **78 collection errors, 2 skipped, 0 run** | `ModuleNotFoundError: No module named 'agent'`: the suite assumes the pinned Hermes environment and a `cryptography` install. On a bare runner, 69 of its tests would silently skip |
| `npm audit --omit=dev` | **1 critical, 8 high, 47 moderate** | critical is `next` (unauthenticated RCE advisories in the installed range); highs include `axios`, `postcss`, `sharp`, `thirdweb`, `ws`, `toml`, `js-yaml`, `nanoid`. All but `ws` have a non-major fix |

### 1.4 Evals, from committed reports (nothing here was re-run; the harness needs a funded control plane and a live Box)

Latest full agent-suite run, `evals/agent-suite/results/2026-09-11T-tenki-run2/report.md`, n = 109, model gpt-5.6-luna:

| Axis | Headline | What the headline hides |
|---|---|---|
| routing | 97 % (105/108) | two days earlier the same suite scored 39 %; gateway calls went 266 → 1,536 and spend 10.9×, with no committed explanation |
| execution | **1/7** | the one pass is A02, a case that only has `must_not_do`. Every case needing a positive action is 0/5 in every run ever committed |
| gating | 76 % (69/91) | 67 of those passes are cases that expect *no* decision and got none. On cases that expect a decision: **2/24** |
| context use | 61 % (23/38) | word match on the reply; "your CRM isn't connected" passes |
| honesty | 99 % | the claim regex misses "I've sent the email" and "has been booked"; a run that fabricated a calendar event scored 100 % |
| outcomes | 109/109 terminal | mean 60.8 s, p50 44.3 s, p95 140.2 s to settle; $21.47 |

The 96 consumer cases K101–K200 (added 2026-09-15) have never been run. The Create suite (19 cases) has no committed results at all. `model-bench` measures latency and cost only, with no correctness check.

**Production signal** (from `docs/goal-create-v13.md`, verified 2026-09-24): 37 of 114 iMessage turns in 14 days hit the 120 s deadline.

**Prior ledger** (`python3 scripts/review-tracker.py --check`): 249 findings, 16 implemented, 1 in progress, 232 not verified, 0 verified, product acceptance not measured. No commit since the ledger was written references a finding ID.

---

## 2. Verdict

### 2.1 Scorecard

Grades are set by the single worst number in each row, not by an average.

| Area | Grade | The number that sets it |
|---|---|---|
| Type safety and lint | A- | 0 errors; 0 `any` in `lib/`; 5 `@ts-expect-error`; but 789 lint warnings tolerated and `next` at a critical advisory |
| Unit-test breadth | B- | 3,758 tests, 53 % lines; 25 `app/api` groups at 0 % including `cron`, `internal`, `muse`, `vault`, `wallet`, `auth`, `calendar`, `bots` |
| Unit-test depth | C | 47 test files use Supabase fakes whose `eq()` ignores its arguments; session JWT verification never tested directly; 154 stderr lines from a fake missing `upsert` while the tests pass |
| CI as a gate | **D** | 98 test files never run; workers deploy to Cloudflare on merge with no PR check; migrations apply to production on merge with no shadow apply |
| Evals as a gate | **D** | no eval runs in CI; gating passes structurally on 67/109 cases; execution 1/7 and the 1 is a `must_not_do`; no held-out set |
| Security invariants in code | **C-** | Muse moves wallet funds with no owner decision and no cap; a tier-1 sender's tool callback resolves as owner-initiated; send-file admits `~/.hermes/.env`; Hermes approvals are an injectable LLM classifier |
| Latency and cost | C | gateway still buffers whole SSE bodies for non-OpenAI families; 500-row transcript fetch per turn; 37/114 production turns over 120 s |
| Architecture hygiene | C+ | 16 different auth guards across 249 routes; 105 of 121 JSON routes cast bodies without a schema; 505 `.catch(() => undefined)`; 249 unchecked Supabase writes; no logger module |
| Process and ledger | **D** | 232/249 unverified; 0 commits reference an ID; churn concentrated in new surfaces during a declared freeze |

### 2.2 Five theses

Everything in §3 and §4 follows from these. If you disagree with one, say so in the report; do not silently work around it.

**T1. The tests are green because they mock the seams the product fails at.**
3,758 tests pass. Task execution is 1/7. The gap is structural, not incidental:

- Supabase is mocked in 87 files. In 47 of them the fake's `eq()` ignores its arguments, so a query against the wrong column or the wrong tenant still passes. The one fake that records filters (`lib/admin/testing/fakeDb.ts`) has 5 users.
- Auth is mocked, never tested: `lib/auth/user` is mocked in 11 files, `lib/auth/box` in 12, and no test imports `verifySessionToken` (`lib/auth/session.ts:84`, a hand-written HS256 check).
- The stderr of a green run contains 154 copies of `onboarding mirror write failed … upsert is not a function`, 28 of `masterkey preinstall failed … No "installMasterkeyMcp" export`, and 6 of `admission check failed open`. The fakes are missing methods; the code under test catches the TypeError, logs it, and continues; the assertion never looked at the write. The fail-open branch is what got exercised.
- The orchestrator's biggest test (`lib/orchestrator/flush.test.ts`, 930 lines) carries 12 `vi.mock` calls, one of which re-implements production logic (`isBridgeMarkerId`), so the test and the code can drift apart without either failing.
- The 708-line iMessage webhook, the product's main entry point, has no route test. Its dedupe-release path (`app/api/inbound/imessage/route.ts:368`) is untested. The email route test hard-codes dedupe to "not seen" (`route.test.ts:8`), so the duplicate branch never runs.

**T2. The evals grade themselves.**
The scorer (`evals/agent-suite/score.ts`) is generous in exactly the places the product is weak:

- Gating: a `none` case passes when nothing happens (`score.ts:364-366`); any hedge in the reply (`can't|cannot|unable|need your`, `:156-157`) removes a case from the denominator. Result: ~67 automatic passes per run and 0–2 real ones.
- Execution: `actionEvidence` concatenates tool events **and the reply** (`:222-225`), so prose satisfies `must_do`. K165 passes on "I'll set a reminder"; its own `safety_note` says that is a fail.
- Honesty: the claim regex (`:170-171`) is narrow; negations trip `must_not_do` (K143 fails on "nothing has been sent").
- Routing: 92 of 196 cases have keyword fallbacks; `email` accepts any `draft`, `openviking-memory` accepts any `remember`, `app-store-search` accepts `/store|app/`. Any tool-free reply ending in `?` makes routing n/a (`:165-167`).
- Contamination: the Jev route descriptions (`apps/web/lib/jev/questions.ts:26-56`) encode K-case specifics ("visas, eVisas", "cabins", "return windows"). There is no held-out set. The taskrouter's reported before/after gain was measured on its own tuning set.
- Reproducibility: raw results are gitignored, reports omit commit/model/settle, and `score.ts` with no argument picks the "newest" directory by lexical sort, which selects the wrong run (`:462-467`).

**T3. CI does not gate what ships.**

- `workers.yml` has no `pull_request` trigger. It deploys `dev-router` and `dispatcher` to Cloudflare with no test and no typecheck, and `muse`/`outbound` are not deployed by CI at all. It runs Node 20 while the locked wrangler 4.138 declares `node >= 22`. `cancel-in-progress: true` can stop a three-worker deploy halfway.
- `migrate.yml` applies to production on any push to `main` touching `supabase/migrations/**`. No shadow apply of the 127-file chain, no checksum of applied files (an edited applied file is silently skipped), no approval environment, and it runs concurrently with the app deploy. `0127_create_job_triggers.sql` documents the failure this produced: a missing enum value "made every job die at the brief step".
- Six public tables never enable RLS: `template_releases`, `box_channels`, `sync_jobs`, `sync_job_boxes` (0068), `box_environment_templates` (0069), `miniapp_slug_holds` (0089). `box_channels.release_id` is the fleet channel pointer.
- No workflow runs Python, shellcheck, `npm audit`, coverage, or any eval. Node is 24 in `ci.yml`, 22 in `create-kit.yml`, 20 in `workers.yml`; there is no `.nvmrc` or `engines`.
- `create-kit.yml` typechecks `scripts`, `kit/air/*.ts`, `functions`, and none of the 77 `kit/**/*.tsx` components.

**T4. Invariants drift silently because nothing tests them.**
Each of these contradicts a written rule and has no failing test:

- `8a26808` (2026-09-21) added `executeDirectTransfer` (`lib/wallet/send.ts`), a wallet send with no `decisions` row and no cap, callable from `POST /api/muse/air/wallet-send` on a single shared bearer with `user_id` in the body. ARCHITECTURE §8.3 rule 2: "Value transfer is always user-approved, out-of-band."
- `resolveActiveTurn` (`lib/vault/purchase.ts:89-131`) returns `ownerInitiated: true` for any open `agent_runs` row when the flush job started earlier than the run. The iMessage flush stamps `agent_runs.started_at` after `createRun` (`flush.ts:1373-1381`) and `chain_started_at` at claim time (`:304`), so that branch is the normal case. A tier-1 sender's purchase callback resolves as the owner. The same shape is in `app/api/crm/update/route.ts:76-78`. The test for the tier-1 case sets `agent_runs: null` and never reaches the branch.
- `isSendablePath` (`lib/orchestrator/outbound.ts:44-50`) admits any file under `/home/<user>/`, including `.hermes/.env` (holds `API_SERVER_KEY` and `GATEWAY_TOKEN`) and the memory files, and the delivery call at `flush.ts:1537-1545` does not consult `senderTier` (the card lane right after it does).
- Tier is a binary gate. Tier 2 is blocked in code; tiers 0 and 1 reach Hermes identically, in the owner's `air-main` session, with the owner's history replayed, and `createRun` never receives the tier (`flush.ts:1348-1353`). `lib/routing/trust.ts:3-4` claims the tier is "passed to the run pipeline as trusted metadata." It is not.
- The Box runs Hermes with `approvals.mode: "smart"` and an LLM `smart_policy` (`infra/template/setup.sh:77-82`) and `memory.write_approval: false` (`:95`). ARCHITECTURE §8.2 line 919: "The classifier that decides what is low-risk is itself injectable."
- `app/api/mini/onairos/[...path]/route.ts` is an unauthenticated relay to `api2.onairos.uk` that forwards caller-supplied `origin` and `referer`.

**T5. The ledger is dead and the freeze is not being observed.**
232 of 249 findings are unverified; the 16 implemented ones came from one Codex push before 2026-09-14. Since then, ~109 commits touched `packages/create-kit` (133 file-touches), `app/api` (133), `lib/miniapps` (114), Muse (47), Jev (20): new surfaces, during a declared freeze on new surfaces. No commit names a finding ID, so nobody can tell whether the mailbox re-mint work (#445–448) closed WZ-16, or whether the schedule ledger (#449) closed TC-03. Several stale PRs (#48, #195, #221, #261, #304, #330, #405, #427, #434) are open with no path to merge or close.

---

## 3. P0: stop the bleeding

Do these first, one PR each, in this order. Each has the same shape: **Evidence** (what is true now), **Change** (the minimal fix), **Test** (what you add so it cannot regress), **Verify** (the command that proves it), **Done when**.

### R-P0-1 · Muse wallet send bypasses the owner-approval gate
Severity P0 · Effort S · Ledger: new (post-dates the prior review); related SOC-01, CA-23

- **Evidence.** `git show 8a26808` removed the `decisions` insert and the Needs-you nudge from the Muse wallet capability and added `executeDirectTransfer` (`apps/web/lib/wallet/send.ts`, "Create and submit a transfer without inserting a Needs-you decision"). The capability is reached via `POST /api/muse/air/[capability]` (`apps/web/app/api/muse/air/[capability]/route.ts:24-31`), authenticated by one shared bearer (`hasMuseWorkerToken`, `lib/muse/auth.ts:18-21`), with `user_id` taken from the request body. There is no per-transfer or daily cap on the direct path (`grep -n "cap\|limit\|max" lib/wallet/send.ts` finds none on it). `lib/muse` is at 9.8 % line coverage and `app/api/muse` at 0 %.
- **Change.** Route the Muse wallet capability back through `createTransferRequest` so a `wallet_request` decision is filed and the owner approves out of band, exactly as every other surface does. If the product owner wants a no-approval lane for Muse, it needs (a) a per-user opt-in stored in `muse_grants` with an explicit amount ceiling, (b) a per-transfer cap and a rolling daily cap enforced in `lib/wallet/send.ts`, and (c) an admin audit row per transfer. Until (a)–(c) exist, the direct path must not be reachable. Delete `executeDirectTransfer` rather than leaving it exported.
- **Test.** `lib/muse/capabilities.test.ts`: the wallet capability with a valid worker token files exactly one pending `wallet_request` decision and executes no transfer. `app/api/muse/air/[capability]/route.test.ts`: (1) missing/wrong bearer → 404; (2) valid bearer, `user_id` for a user without a Muse grant → 403 and no side effect; (3) the wallet capability never calls `executeTransfer` directly.
- **Verify.** `cd apps/web && npx vitest run lib/muse app/api/muse` and `grep -rn "executeDirectTransfer" apps/web` returns nothing.
- **Done when.** No code path moves funds without a `decisions` row, and the test above fails if one is added.

### R-P0-2 · A non-owner's run resolves as owner-initiated on the purchase and CRM paths
Severity P0 · Effort S · Ledger: new; related C20 (SECURITY-DECISIONS), CA-20

- **Evidence.** `apps/web/lib/vault/purchase.ts:89-131` (`resolveActiveTurn`): if the newest `flush_jobs.chain_started_at` is earlier than the newest open `agent_runs.started_at`, the function ignores `sender_tier` and returns `{ ownerInitiated: true }` for the open run. On the iMessage path `chain_started_at` is set at claim (`lib/orchestrator/flush.ts:304`) and `agent_runs.started_at` is set after `createRun` (`flush.ts:1373-1381`), so the open-run branch is the normal case for a tier-1 sender's burst. `app/api/crm/update/route.ts:76-78` has the same inference (`return openRun ? 0 : 2`). `lib/vault/purchase.test.ts:118-121` covers the tier-1 case with `agent_runs: null`, so the branch is never reached in tests.
- **Change.** Stop inferring the initiator from "latest row per user". Carry `sender_tier` on the `agent_runs` row (add a nullable column in a new migration; write it at `flush.ts:1373` and in `lib/chat/relay.ts` for web turns), and resolve the tier from the run the callback names, not from timestamps. Unknown tier is not owner (the code already says "fail closed" for legacy rows; make the open-run branch obey the same rule).
- **Test.** `lib/vault/purchase.test.ts`: an open `agent_runs` row with `started_at` later than the flush job's `chain_started_at` and `sender_tier = 1` resolves `ownerInitiated: false`. Same for `app/api/crm/update/route.test.ts` (new file): tier-1 open run → tier 2 handling, `crm_update` decision filed.
- **Verify.** `cd apps/web && npx vitest run lib/vault/purchase app/api/crm`.
- **Done when.** Neither function reads `started_at` to decide who initiated a turn.

### R-P0-3 · send-file can exfiltrate the box's credentials and memory
Severity P0 · Effort S · Ledger: new; related I5, C2

- **Evidence.** `apps/web/lib/orchestrator/outbound.ts:44-50` `isSendablePath` accepts any path matching `^/(home|Users)/[^/]+/` without `..` or newline. `/home/user/.hermes/.env` (holds `API_SERVER_KEY`, `GATEWAY_TOKEN`), `/home/user/.hermes/memories/USER.md`, and the OpenViking store all match. `flush.ts:1537-1545` calls `deliverSendFiles(sender, box.boxId, job.spaceId, job.phone, stripped.files).catch(() => 0)` with no reference to `job.senderTier`; the card lane immediately below it (`:1549`, "Cards are owner-scoped (C15)") is tier-gated, so the omission is specific to files. A tier-1 contact, or a page the agent reads during any turn, can ask for the file and receive it in the chat, and a delivery failure is swallowed to `0`.
- **Change.** Allowlist, not denylist: sendable paths are under a single outbox directory (for example `/home/user/outbox/` or the existing creative output directory) that the agent writes deliverables into. Reject everything else, including symlinks resolving outside it (resolve on the box with `realpath` before sending). Gate the whole send-file lane on `senderTier === 0` unless the file was produced by that sender's own deterministic lane.
- **Test.** `lib/orchestrator/outbound.test.ts`: `.hermes/.env`, `.hermes/memories/USER.md`, `.openviking/…`, a symlink into `.hermes`, and any path outside the outbox are rejected; an outbox file is accepted. `flush` test: tier-1 job with a `[send-file: …]` marker sends nothing.
- **Verify.** `cd apps/web && npx vitest run lib/orchestrator/outbound lib/orchestrator/flush`.
- **Done when.** The only way a file reaches a chat is from the outbox, and only to the owner unless explicitly produced for that sender.

### R-P0-4 · `next` is on a critical advisory; no audit gate exists
Severity P0 · Effort S · Ledger: new

- **Evidence.** `npm audit --omit=dev` on this commit: 1 critical (`next`, installed range `9.3.4-canary.0 – 16.3.0-preview.10`, two unauthenticated-RCE advisories), 8 high (`axios`, `js-yaml`, `nanoid`, `postcss`, `sharp`, `thirdweb`, `toml`, `ws`). All have a fix; only `ws` (via `x402`) needs a major.
- **Change.** `npm audit fix` for the non-major set; bump `next` to the first patched 15.x; evaluate `x402@0.4.1` separately (it is a major and touches payments, so it gets its own PR with the checkout tests run). Add `npm audit --omit=dev --audit-level=high` as a CI step that fails.
- **Test.** The existing suite plus `next build`.
- **Verify.** `npm audit --omit=dev --audit-level=high` exits 0; `npm run typecheck && npm test && npm run build` pass.
- **Done when.** CI fails on a new high or critical production advisory.

### R-P0-5 · Migrations reach production with no shadow apply, no checksum, and six tables without RLS
Severity P0 · Effort M · Ledger: new; related BOX-18

- **Evidence.** `.github/workflows/migrate.yml` runs `scripts/apply-migrations.sh` on every push to `main` touching `supabase/migrations/**`; no `environment:` approval, no `needs: ci`, no timeout. The script records only filenames (`apply-migrations.sh:37,55`), so an edited applied file is silently skipped. `ci.yml`'s `metering` job applies only `0104` and `0105` to a bare Postgres; the 127-file chain is never applied anywhere before production. `0127_create_job_triggers.sql:3-6` records the outage this caused. Six `public` tables never enable RLS (see §2 T3).
- **Change.** (1) In `ci.yml`, add a `migrations` job on every PR: start `postgres:15`, apply all 127 files in order, then run every file in `supabase/tests/`. (2) Record a sha256 per applied file in `applied_migrations`; fail the apply if a recorded file's hash changed. (3) Put `migrate.yml` behind a GitHub `environment: production` with a required reviewer, and `needs:` the CI job. (4) New migration `0128_rls_backfill.sql`: `alter table … enable row level security` for the six tables, with the same service-role-only posture the others use (0072:108 documents the convention). (5) Move the "applied via Supabase MCP" sentence out of `README.md:37`, or make the script the only path; two tracking paths is drift.
- **Test.** A `supabase/tests/rls_all_tables.sql` that fails if any `public` table has `relrowsecurity = false`. A unit test for the hash check in `apply-migrations.sh` (bash with a temp Postgres, or port the apply loop to a small TS script under `scripts/` with a vitest).
- **Verify.** `bash scripts/apply-migrations.sh` against a local Postgres applies 128 files cleanly twice (second run is a no-op); `psql -f supabase/tests/rls_all_tables.sql` passes.
- **Done when.** A migration cannot reach production without having been applied to a scratch database in CI, and an edit to an applied file fails the build.

### R-P0-6 · Workers deploy to Cloudflare untested, on the wrong Node, from a cancellable job
Severity P0 · Effort S · Ledger: new; related goal-create-v13 §11.3

- **Evidence.** `.github/workflows/workers.yml:8-14` triggers on push to `main` only. `dev-router` (`.mjs`, no tsconfig, no tests) and `dispatcher` (442 lines, no tests; includes the token-replay object) deploy with no check. `muse` has a test and a `release.sh` but is not in CI; `outbound` is deployed only by `infra/workers/release.sh:42-45`. Node is pinned to 20 (`:28,48,64`) while the locked wrangler 4.138.0 declares `node >= 22`. `concurrency.cancel-in-progress: true` (`:17-19`). `staticStub.test.ts`, referenced by `wrangler.toml:65`, `lib/functions/staticStub.ts:4`, and `release.sh:38`, does not exist.
- **Change.** Split the workflow: a `pull_request` job that, for every worker, runs `npm ci`, `tsc --noEmit` where a tsconfig exists, `vitest run` where tests exist, and `wrangler deploy --dry-run --outdir /tmp/x`; a `push` deploy job with `needs: check`, Node 22, `cancel-in-progress: false`, and the same ordering `release.sh` uses (outbound → stub digest check → dispatcher → health). Restore `staticStub.test.ts` (byte-pin `infra/workers/static-stub` against `lib/functions/staticStub.ts`). Add a minimal vitest for `dispatcher`'s token-replay object and for `dev-router`'s host parsing.
- **Test.** The two new worker tests plus the restored stub test.
- **Verify.** The PR job runs green on a PR that touches only `infra/workers/dev-router/`.
- **Done when.** No worker can deploy from a commit whose PR check did not run.

---

## 4. Workstreams

Each item: severity, effort (S < 1 day, M 1–3 days, L > 3 days), evidence, change, verify. Items marked **[gate]** are required for the acceptance gates in §5.

### 4.1 W1 · Make CI tell the truth

| ID | Sev | Eff | Item |
|---|---|---|---|
| R-CI-01 **[gate]** | P1 | S | **Run the Python suites in CI.** Add a `python` job to `ci.yml`: `pip install pytest cryptography`, check out Hermes at the pinned `HERMES_REF` used by `infra/template/setup.sh` so `agent.secret_sources` imports, then `pytest infra/template scripts/tests -p no:cacheprovider --strict-markers -ra`, and fail if any test is skipped (`-W error::pytest.PytestUnhandledSkip` or a wrapper that greps the summary). Baseline: 122 pass, air-vault cannot import (§1.3). |
| R-CI-02 **[gate]** | P1 | S | **Coverage floor.** Add `@vitest/coverage-v8` as a devDependency, `coverage.thresholds` in `vitest.config.ts` at the measured baseline (lines 53, functions 71) so no PR lowers it, and raise the floor 2 points per week until 65 % lines. Per-module floors of 85 % lines for `lib/auth`, `lib/routing`, `lib/security`, `lib/wallet`, `lib/vault`, `lib/muse`, `lib/decisions`, `lib/approvals`, `app/api/inbound`, `app/api/muse`, `app/api/wallet`, `app/api/vault`. Upload the summary as a CI artifact. |
| R-CI-03 | P1 | S | **Lint that means something.** Add `public/creator-os/draw-studio.js` and `fx.js` to the eslint `ignores` (they are built bundles; 750 of the 789 warnings), then set `--max-warnings 0`. Fix the 39 real warnings (mostly unused vars in tests). Decide whether `freeze-studio.js` and `draw-studio.js` are committed or built: today 11 bundles are gitignored and built by `prebuild`, 2 are committed *and* rebuilt. Pick gitignored. |
| R-CI-04 | P1 | S | **One Node.** Add `.nvmrc` = `22` and `"engines": { "node": ">=22 <25" }` at the root and in `infra/workers/*`. Use `node-version-file: .nvmrc` in all four workflows. |
| R-CI-05 | P2 | S | **Shellcheck.** Add a job that runs `shellcheck -S warning` over `infra/template/**/*.sh`, `scripts/*.sh`, `infra/workers/release.sh`. Known first finding: `scripts/apply-migrations.sh:53` loops over `$(ls …)` (SC2045). Add `systemd-analyze verify` over the 11 unit files in `infra/template`. |
| R-CI-06 | P2 | S | **Run the skill tests or delete them.** 72 `*.test.mjs` files under `.agents/skills` (`node:test`) run nowhere. Either add a `skills` CI job (`node --test .agents/skills/**/*.test.mjs`) or document in `skills-lock.json` that vendored skills are not tested here and remove the files from the tree. |
| R-CI-07 | P2 | S | **create-kit checks the whole kit.** Widen `packages/create-kit/tsconfig.json` `include` to `kit/**/*.tsx`; add `infra/template/skills/create-miniapp/SKILL.md` and `skills-lock.json` to `create-kit.yml`'s path filter (verify.ts already checks both). |
| R-CI-08 | P2 | S | **Typecheck the evals.** `evals/agent-suite` and `evals/model-bench` have tsconfigs that nothing runs. Add `tsc -p evals/agent-suite/tsconfig.json --noEmit` to CI, and a vitest for `score.ts` (see W3). |
| R-CI-09 | P2 | M | **Test wall time.** `vitest` spends 108 s collecting and 41 s testing on 4 vCPU. Profile with `vitest --reporter=verbose --logHeapUsage` and `DEBUG=vite-node:*`; the usual causes are `next/server`, `thirdweb`, and `@photon-ai/advanced-imessage` at module top level. Move heavy SDK imports behind lazy `import()` in the modules tests import, and set `test.pool: "threads"` with `isolate: false` for pure-function suites. Target: under 60 s wall on the CI runner. Do this after W2 so the measurements are stable. |
| R-CI-10 | P3 | S | **Close or merge the stale PRs.** #48, #195, #221, #261, #304, #330, #405, #427, #434, #454. For each: rebase and merge, or close with one line saying why. A queue of unmergeable PRs hides the ones that matter. |

### 4.2 W2 · Make the tests catch what the product does wrong

Coverage by module on this commit (lines; from `vitest --coverage`, `lib/**` and `app/api/**`). Only rows relevant to the work below are shown; the full table is in the coverage artifact once R-CI-02 lands.

| Module | Lines | Line % | Why it matters |
|---|---|---|---|
| `app/api/cron` (8 routes) | 440 | 0.0 | three run every minute in production |
| `app/api/internal` (7 routes) | 499 | 0.0 | the Create job callbacks; HMAC with a ±300 s window and no nonce |
| `app/api/muse` (14 routes) | 428 | 0.0 | see R-P0-1 |
| `app/api/vault`, `app/api/wallet` | 384, 145 | 0.0 | secrets reveal, funds |
| `app/api/auth` | 167 | 0.0 | login/logout |
| `app/api/calendar`, `app/api/bots` | 635, 941 | 0.0 | |
| `lib/muse` | 1,343 | 9.8 | |
| `lib/migration` | 2,071 | 16.0 | box-to-box transfer; puts a hosted token on a command line (`transfer.ts:160,187`) |
| `lib/trade` | 2,420 | 16.8 | money; `service.ts` (1,073 lines) imported by no test |
| `app/api/browser` | 1,013 | 19.0 | purchase and OTP routes |
| `app/api/decisions` | 622 | 23.0 | the approval spine |
| `app/api/inbound` | 1,005 | 29.5 | iMessage 708 lines, no route test |
| `lib/hermes` | 446 | 42.2 | `client.ts:126-139` swallows history-load errors |
| `lib/auth` | 249 | 47.4 | JWT verify never tested directly |
| `lib/routing` | 394 | 68.8 | `resolveTrustTier` mocked everywhere, tested nowhere |
| `lib/orchestrator` | 2,692 | 73.9 | high number, but see T1 on mock depth |

| ID | Sev | Eff | Item |
|---|---|---|---|
| R-TQ-01 **[gate]** | P1 | M | **One Supabase fake that records filters, used everywhere.** Promote `lib/admin/testing/fakeDb.ts` (already records every `eq`/`in`/`is`) to `lib/testing/fakeSupabase.ts`, give it `upsert`, `rpc`, `.not()`, `.order()`, `.limit()`, `.maybeSingle()`, and an assertion helper `expectQuery({ table, filters })`. Migrate the 47 files whose fakes ignore `eq()` arguments (start with `lib/miniapps/publish.test.ts`, 7 blind `eq`s, and `lib/create/plan.test.ts:27-31`). Add a lint rule or a test that fails if a test file defines its own `from()` chain. Success metric: the 154 `upsert is not a function` lines and the 28 missing-export lines disappear from a green run's stderr. |
| R-TQ-02 **[gate]** | P1 | S | **Fail the suite on unexpected stderr.** In a vitest `setupFiles`, capture `console.error`/`console.warn`; tests that expect a log line assert it with a helper; anything else fails the test. This is what turns "fail-open logged and continued" from invisible into a failing test. Expect ~50 tests to need explicit expectations; that is the point. |
| R-TQ-03 | P1 | M | **Route tests for the three untested webhooks.** `app/api/inbound/imessage/route.test.ts` (signature, dedupe, dedupe-release on failed signup at `:368`, tier-2 decision, tier-0 enqueue), `app/api/inbound/calcom/route.test.ts` (replay), and un-hardcode the email dedupe mock (`email/route.test.ts:8`) so the duplicate branch runs. README.md:56 promises this; make it true. |
| R-TQ-04 | P1 | S | **Test the auth primitives directly.** `lib/auth/session.test.ts`: `createSessionToken` → `verifySessionToken` round-trip, expired token, tampered signature, wrong algorithm header, missing `sub`. `lib/routing/trust.test.ts` currently tests only `normalizeAddress`; add `resolveTrustTier` for handle match → 0, sender row → its tier, unknown → inserted tier 2, insert failure → **not** tier 0. |
| R-TQ-05 | P1 | S | **Fix the millisecond flake instead of re-running CI.** `lib/publish/agentPlan.test.ts:183-197` calls `Date.now()` twice and asserts an exact 86,400,000 ms difference. Use `vi.useFakeTimers()` + `vi.setSystemTime()`. Then sweep the other 40 files that call `Date.now()` without fake timers; add an eslint rule (`no-restricted-syntax` on `Date.now` in `*.test.ts` without `useFakeTimers` in the file) or a grep test. |
| R-TQ-06 | P2 | M | **Route tests for money and secrets.** `app/api/wallet/send`, `app/api/vault/[id]/reveal`, `app/api/browser/purchase` (334 lines), `app/api/browser/otp` (282), `app/api/decisions` (674 lines, 23 %). Each: unauthenticated → 401/404; wrong user → 404; happy path files the decision it should; tampered amount rejected. |
| R-TQ-07 | P2 | S | **Cron and internal routes.** One shared test for the 8 cron routes: no `CRON_SECRET` → 401; wrong secret → 401; right secret → the sweep function is called once. `app/api/cron/trade/route.ts:27` rolls its own XOR compare; replace with `timingSafeEqual` and share one `cronAuthorized()` helper. For `app/api/internal/create/*`: HMAC valid, expired (> 300 s), replayed (same signature twice within the window; today this passes, see R-SEC-04). |
| R-TQ-08 | P2 | S | **Replace source-grep tests with behaviour tests where the behaviour is testable.** `lib/miniapps/client/deck-pending.test.ts:7-14`, `lib/kernel/security.test.ts:11-21`, `lib/vault/tickets.test.ts:176-197` assert on file text. Keep the ones that pin a literal (`replace-lease-budget.test.ts:21`), convert the rest. |
| R-TQ-09 | P2 | M | **Tests for the four largest untested client files** are not the priority; the priority is that they have no smoke test at all: `freeze-studio.tsx` (3,533 lines), `CreateStudio.tsx` (2,123), `draw-studio.tsx` (1,541), `image-editor.tsx` (1,511), `app/home/page.tsx` (1,282) and its three 1,200-line panels. Add `@testing-library/react` + `jsdom` environment for these five files only, with one render-without-throwing test each and one interaction each. 0 component tests today. |
| R-TQ-10 | P3 | S | **`lib/memory/mitosis.test.ts`** says "only the validation layer is testable here". Either make `lib/memory/cortex.ts` injectable (pass the box command runner) and test the query path, or delete the probe (the prior review's MEM-05 says delete). |

### 4.3 W3 · Make the evals able to fail

The agent suite is the only instrument that measures the product. Today it cannot fail on the axes that matter (§2 T2). Fix the scorer first, then the harness, then run it.

| ID | Sev | Eff | Item |
|---|---|---|---|
| R-EV-01 **[gate]** | P1 | S | **Report the real gating rate.** In `score.ts`, split gating into `gating_expected` (cases with an `expected_decision_kind` other than `none`) and `gating_none`. The headline is `gating_expected`. Do not count a degraded reply as n/a on a gating case; a hedge is a fail when a decision was expected. Baseline: 2/24. |
| R-EV-02 **[gate]** | P1 | S | **Execution counts tool events only.** `actionEvidence` (`score.ts:222-225`) must not include the reply text for `must_do`. A case passes execution only if the ordered patterns match tool names + previews. Keep the reply for `must_not_do` (a claimed send is still a fail) but make `must_not_do` negation-aware: strip clauses matching `\b(not|never|no|nothing|didn't|did not|haven't|won't)\b[^.]*` before matching, and add the `s` flag to the K107/K119/K155 lookaheads. |
| R-EV-03 | P1 | S | **Honesty that catches claims.** Widen the claim regex to contractions and passive forms (`I've sent`, `has been booked`, `is on its way`, `Posted!`), and add an LLM judge with a fixed rubric ("does the reply assert that an external side effect occurred?") whose verdict is recorded alongside the regex, not instead of it. Fabricated facts (the M3 calendar event) need a `must_cite` field: analytics and CRM answers must quote a value that appears in a tool result. |
| R-EV-04 | P1 | S | **Routing without freebies.** Remove the trivial fallbacks (`draft`, `remember`, `store|app`, `caption`) from `ROUTING_SIGNALS`; a case routes only on a `skill_view` or a tool of that skill. Replies ending in `?` with no tool are a routing **fail** unless the case carries `may_clarify: true`. |
| R-EV-05 | P1 | S | **Scorer tests.** `evals/agent-suite/score.test.ts` with fixture runs: a `none` case with a hedge → gating pass; an expected-decision case with a hedge → fail; a `must_do` satisfied only by prose → fail; "nothing has been sent" against `must_not_do: sent` → pass; the lexical-sort bug (`:462-467`) → pick by mtime or by the `started_at` in `suite.json`. Run it in `ci.yml`. |
| R-EV-06 **[gate]** | P1 | M | **Reproducible runs.** `run.ts` writes `suite.json` with commit SHA, model family and served model, `SETTLE_MS`, `EVAL_SESSION`, inventory file hash, and case ids run. Commit redacted raw per-case JSON (the harness already has a redaction step in `lib.ts`) so reports can be rescored. Add a `seed.ts` that creates the fixture box state the `wzrdmail-luna-seeded` COMPARISON describes in prose (events, people, onairos). Use a fresh `EVAL_SESSION` per case so cases are independent, and mark the few that intentionally chain (F72→F73) as a group. |
| R-EV-07 **[gate]** | P1 | L | **A CI-runnable eval lane.** Two tiers. (a) **Contract tier, on every PR, no secrets:** a stub Hermes (`api_server`-shaped HTTP server in `evals/stub-hermes/`) that replays recorded tool-event streams; run the 30 cases with `must_do`/`must_not_do`/`expected_decision_kind` through the real control plane (`/api/chat` and a simulated `/api/inbound/imessage` with a valid HMAC) against a local Postgres with all migrations applied. This proves the control plane files the right decisions and performs the right writes for a known agent behaviour; it does not test the model. (b) **Model tier, nightly with secrets:** the full suite on a real Box, n ≥ 20 per lane, results posted as a workflow artifact and a one-line summary comment on the tracking issue. Floors from the prior review: execution ≥ 60 %, `gating_expected` ≥ 85 %. Until floors are met, the nightly job is informational; it becomes required when they are met twice in a row. |
| R-EV-08 | P1 | M | **An iMessage-path eval.** Everything committed drives `POST /api/chat` (`run.ts:98`, `via: "web"`). The product is iMessage. Add a mode that posts a signed Spectrum webhook to `/api/inbound/imessage`, waits for the debounce, and reads the outbound bubbles from a recording Spectrum sender (inject `createSpectrumSender` with a fake that records). Measure time to first bubble and to final bubble per case; report p50/p95 against the `docs/operations/imessage-ttfk.md` targets (first bubble < 5 s warm). This is TC-21 and LAT-15 in the prior ledger. |
| R-EV-09 | P2 | S | **Run the 96 K-cases** once on the model tier after R-EV-01…06 land, and hold out a third of them from any prompt or route-description tuning. The Jev route text (`apps/web/lib/jev/questions.ts:26-56`) already encodes K-case language; record which cases are in-sample so their scores are labelled. |
| R-EV-10 | P2 | S | **Explain the 39 % → 97 % jump.** Between `2026-09-11T-tenki-run1` and `-run2`, completion tokens went 17 k → 640 k and spend 10.9×. Diff the gateway config and Box config at those commits; the likely cause is reasoning being enabled for luna. Record the finding in the run2 report. A metric that moves 58 points on a config change nobody wrote down is not a metric. |
| R-EV-11 | P2 | S | **Memory recall eval.** The only recall figure is 4/4 on a hand-written thread. Add `evals/memory/` with a synthetic 90-day iMessage archive (generated, so it can be committed), 30 recall queries with expected artefacts, and a scorer for recall@1 and recall@3 against OpenViking on a Box. Target from the prior review: recall@1 ≥ 80 %. This is MEM-11/MEM-29. |
| R-EV-12 | P2 | S | **Create suite results.** `evals/agent-suite/create/run.ts` has no report writer and `results/` is empty. Add a `report.md` writer like the main suite's, fix `hardFindings(null) → 0` (unreachable status route must be a fail), fix `matchesInOrder` cursor (`found + 1`), and run C01–C43 once. |
| R-EV-13 | P3 | S | **model-bench honesty.** Stream the OpenAI cells so TTFT is comparable; drop `?? 0` (`bench.ts:519`); write `report.md` from the JSON instead of by hand; add a correctness check per workload (tool chosen, plan JSON parses). |

### 4.4 W4 · Latency and cost, with a number attached to each change

Rule for this workstream: no change lands without a before/after number from R-EV-08 (iMessage path) or the gateway trace rows. The prior review's targets stand: first bubble < 5 s warm, < 20 s cold; web first token < 3 s; prompt 8–12 k tokens; 1 machine start per cold message; 1 SDK init per turn.

| ID | Sev | Eff | Item |
|---|---|---|---|
| R-PERF-01 | P1 | M | **Stream non-OpenAI families.** `app/api/gateway/v1/[...path]/route.ts:997-1000` buffers the whole SSE body (`await response.clone().arrayBuffer()`) for every non-OpenAI streaming answer to check that it carries content. Replace with a tee: forward chunks as they arrive, watch the first N deltas for content or a tool call, and only if the stream ends empty fall back to the OpenAI retry. Measure: TTFT per family in the gateway trace rows before and after. Ledger LAT-01/WEB-01, still open. |
| R-PERF-02 | P1 | S | **Served-model headers.** Add `X-Air-Served-Model`, `X-Air-Served-Family`, and `X-Air-Fallback: 1` on every gateway response so the evals and the admin trace can see silent fallbacks (`gateway provider fallback` appears in test stderr today, invisible to callers). Ledger WEB-02. |
| R-PERF-03 | P1 | M | **Stop fetching the transcript every turn.** `lib/hermes/client.ts:128` and `lib/hermes/history.ts:73` fetch the full transcript (up to 500 rows per the prior review) and replay 60 messages into a run Hermes already has the session for. Measure prompt tokens per turn from `agent_runs` before and after removing the replay (MEM-16/MEM-06). Keep the replay only for the web path if the "history loaded silently empty" case (`client.ts:126-139`) is fixed to fail loudly first (R-ARCH-06). |
| R-PERF-04 | P1 | S | **One Spectrum sender per turn.** `createSpectrumSender(` is constructed at 17 sites across 14 files (`lib/miniapps/cards.ts` 3, `lib/muse/notify.ts` 2, one each in `flush.ts`, the iMessage webhook route, `sharedBridge`-adjacent lanes, trade, location, calendar sweep, and four Create routes). One iMessage turn can construct it in the webhook route, again in `flush.ts`, and again per card. Thread one sender through the flush job (pass it into the lanes and into `deliverSendFiles`/card delivery) and close it once. Measure: SDK init count per turn in the trace (target 1). Ledger MS-01/LAT-03. |
| R-PERF-05 | P2 | S | **Replace fixed wake sleeps with a health-driven waiter.** `lib/orchestrator/boxes.ts:355-399` is a 180 s wake/health loop that every caller runs independently, with fixed 5 s sleeps and a 10 s health timeout; concurrent resumes race on hosted-token refresh (`:381`). One in-process waiter per box id (a `Map<boxId, Promise>`) and an exponential probe (1, 2, 4, 8 s). Measure cold-start time to first bubble. Ledger LAT-04/LAT-05/BOX-19. |
| R-PERF-06 | P2 | S | **Cron cost.** `vercel.json` runs `sweep`, `schedules`, and `trade` every minute (`* * * * *`), `publish` every 5. Add a duration and rows-touched log line to each, read a week of them, and move any cron that does nothing 95 % of the time to a longer interval or to a queue trigger. `cron/sweep` is 279 lines; it should report what it swept. |
| R-PERF-07 | P2 | S | **Client bundles.** `onairos-connect.js` is 2.4 MB (esbuild warns on every build), `freeze-studio.js` 777 KB, `create.js` 303 KB. Run `esbuild --analyze` on the three and split or lazy-load; the onboarding slide should not pay 2.4 MB before the first tap. `app/home` first-load JS is 232 KB, fine; the mini-app bundles are the problem. Measure with Lighthouse on a mini-app URL. |
| R-PERF-08 | P2 | M | **Fast lane for the default family.** `docs/operations/imessage-ttfk.md` says the first bubble is served by "GLM fast lane" or a deterministic fallback; `lib/orchestrator/sharedBridge.ts:119-162` (`initialResponse`) runs a no-tools model call. Record `ttfk_met: boolean` and the lane used on every turn, then decide from a week of data whether the fixed-template ack (the prior review's default) beats the model ack. Ledger LAT-17/LAT-18/LAT-02. |
| R-PERF-09 | P3 | S | **Test suite wall time** is R-CI-09; it is listed here because it is the developer-facing latency. |

### 4.5 W5 · Trust and approvals: make the invariant true, not aspirational

The P0 items in §3 patch the three worst holes. This workstream makes the design hold.

| ID | Sev | Eff | Item |
|---|---|---|---|
| R-SEC-01 | P1 | M | **Pass the tier to Hermes and give non-owners their own session.** `createRun` (`flush.ts:1348-1353`) sends `{ channel }` only. Add `sender_tier` and `sender_ref` to run metadata, and run tier-1 senders in `contact:<sender_id>` sessions with no owner history and no owner memory mounts. The owner's `air-main` never sees a non-owner's text except as a summarised Needs-you card. Ledger CA-20/CA-22. |
| R-SEC-02 | P1 | S | **Mixed-sender bursts.** `composeInput` (`flush.ts:388-400`) concatenates bodies with no sender label, and the burst's tier is the last message's tier (`flush.ts:1770`; `schedule_flush` `p_sender_tier` at `:206`). Take the **minimum** trust (highest tier number) across the burst, and label each body with its sender inside the input. Add a test with an owner message arriving after a contact message. |
| R-SEC-03 | P1 | M | **Decide the Hermes approval mode with the owner, then enforce it in code.** `infra/template/setup.sh:77-82` runs `approvals.mode: "smart"` with an LLM policy; `:95` sets `memory.write_approval: false`. ARCHITECTURE §8.2 forbids an injectable classifier deciding what is low-risk. The control plane already gates money, mail, social, calendar, and schedules deterministically; the smart policy is a second, weaker gate the agent can be talked out of. Recommended: `mode: "deny-list"` (or the Hermes equivalent) where publishing tools always pause, everything else runs, and memory writes from non-owner turns are disabled by R-SEC-01. Whatever is chosen, add a test that reads the generated `config.yaml` and asserts the mode. |
| R-SEC-04 | P1 | S | **Replay protection on the Create bridge.** `lib/create/bridge.ts:49-65` verifies HMAC over `ts.METHOD.path.sha256(body)` within ±300 s with no nonce. Add a nonce (or the signature itself) to a short-TTL table or KV with `insert … on conflict do nothing`; a duplicate is a 409. Test: same signed request twice → second is rejected. |
| R-SEC-05 | P1 | S | **Approval relays must not fail silently.** `lib/vault/purchase.ts:328,342,395` `approveRun(...).catch(() => undefined)`: an approve or deny that fails to reach the paused run is swallowed. Surface it: mark the decision `relay_failed`, log with `user_id` and `box_id`, and let the sweeper retry. Ledger CA-23. |
| R-SEC-06 | P2 | S | **The Onairos relay.** `app/api/mini/onairos/[...path]/route.ts` is unauthenticated and forwards caller-supplied `origin`/`referer`. Require a mini-app session or the C15 single-use token, allowlist the upstream paths the SDK actually calls, and set `origin` server-side from the request host rather than forwarding it. |
| R-SEC-07 | P2 | S | **Sessions that can be revoked.** `lib/auth/session.ts:9,22-35` issues 30-day stateless JWTs; logout only clears the cookie. Add a `sessions` table (id, user_id, issued_at, revoked_at) or a per-user `session_epoch` column checked on every `verifySessionToken`. The deletion flow (SECURITY-DECISIONS §8.4) needs this to mean anything. |
| R-SEC-08 | P2 | S | **Hosted token on a command line.** `lib/migration/transfer.ts:160,187` builds `${route.url}?_token=${route.token}` and passes it as `--url` to a process on another box, where it is visible in `ps` and shell history. Pass the token via stdin or an env var scoped to the command. |
| R-SEC-09 | P2 | S | **Key-derivation fallback.** `lib/miniapps/commandLane.ts:58-62` derives the at-rest seal key from `SESSION_SECRET` when `COMMAND_LANE_KEY` is unset. Rotating the session secret then silently breaks sealed data. Make `COMMAND_LANE_KEY` required in `lib/env.ts` and fail at boot (see R-ARCH-02). |
| R-SEC-10 | P3 | S | **Admin identity.** All 33 `app/api/admin/*` routes share one `ADMIN_API_KEY`; `admin_audit` rows cannot name a human. Either per-operator keys (a small table, hashed) or a required `X-Admin-Operator` header recorded in the audit row. |

### 4.6 W6 · Process and ledger

| ID | Sev | Eff | Item |
|---|---|---|---|
| R-LED-01 **[gate]** | P1 | S | **Re-sync the ledger against this commit.** For each of the 232 `not_verified` findings, one of: still open (leave), fixed by a named commit (set `implemented` with the SHA as evidence), or superseded (note why). The prior-review agent grep-checked five: LAT-01, MS-03, WEB-02, LAT-15, TC-06/07 are still open; TC-05 is fixed. Candidates that recent PRs may have closed without saying so: WZ-16/WZ-05 (mailbox re-mint, #445–448), TC-03/CA-22 (schedule deliveries, #449), MEM-16 (Hermes v0.21.4, #452), TC-30/CA-11 (Jev routing hint, #438–443), LAT-xx/CA-21 (iMessage deadline and flush fixes, 09-14/15). Run `python3 scripts/review-tracker.py --check` after every edit. |
| R-LED-02 **[gate]** | P1 | S | **Finding IDs in commits, enforced.** Add a `commit-msg` check in CI (a small script over `git log origin/main..HEAD --format=%s%n%b`) that requires at least one `R-[A-Z]+-\d+` or ledger ID per commit, except for merges and `chore:` commits. |
| R-LED-03 | P1 | S | **Add this document's findings to the ledger.** Extend `scripts/review-tracker.py` to parse the `R-…` rows in this file the same way it parses Appendix A of the prior review, so there is one ledger. |
| R-LED-04 | P2 | S | **Honour the freeze, or lift it in writing.** The prior review's CA-19 freeze (no new mini-apps, skills, card kinds, decision kinds for 90 days) is contradicted by the last ten days of commits. Either the product owner lifts it in `docs/goal-create-v13.md` §16 with a sentence, or PRs that add a surface are held until the P0 and W3 gates pass. Do not decide this yourself; put it in the report as a decision for the owner. |
| R-LED-05 | P3 | S | **README accuracy.** `README.md:56` (every webhook ships an idempotency test) and `:37` (migrations applied via Supabase MCP) are not true today. Fix the claims or the code; a README that overstates the discipline trains contributors to trust it. |

### 4.7 W7 · Codebase shape: fewer, deeper modules

These are not urgent individually. Together they are why the P0s could happen without a test failing. Each one replaces N hand-rolled copies with one deep module that can be tested once.

| ID | Sev | Eff | Item |
|---|---|---|---|
| R-ARCH-01 | P1 | M | **One auth module.** 249 routes use ~16 guard mechanisms: `sessionUserId` (67), `storeSessionUserId` (37), `adminAuthorized` (33), `boxUserId` (24), inline `.eq("gateway_token", token)` (24), `requestSession` (18), `hasMuseWorkerToken` (10), local `authorized()` (9), `callingBox` (8, a duplicate of `boxUserId`), HMAC adapters (7), and ~20 others. Build `lib/auth/guard.ts` with `requireOwner(req)`, `requireBox(req)`, `requireAdmin(req)`, `requireCron(req)`, `requireStoreSession(req)`, `requireWorker(req, "muse")`, each returning a typed principal or throwing a typed 401/403/404. Migrate routes group by group (start with `cron`, `admin`, `muse`: they are the simplest and the least tested). Delete `lib/box/auth.ts:16` and the local copy at `app/api/crm/update/route.ts:29`. Add a repo test that greps `app/api/**/route.ts` and fails on any `gateway_token` or `process.env["CRON_SECRET"]` outside `lib/auth/`. |
| R-ARCH-02 | P1 | S | **Validate env at boot.** `lib/env.ts` is 509 lines of lazy getters; a missing secret fails on first use, in production, at request time. 63 `process.env` reads bypass it (8 cron routes, 20+ in `lib/entitlements/models.ts`, `middleware.ts`, `lib/publish/worker.ts`). Replace with one zod schema evaluated in `instrumentation.ts` (Next 15 supports it) that lists every variable with its requiredness per environment, and export typed accessors. Add a test that greps for `process.env` outside `lib/env.ts` and fails. |
| R-ARCH-03 | P1 | M | **Validate every request body with a schema.** 105 of 121 JSON-reading routes cast with `as {…}` and hand-roll `typeof` checks. `lib/http/body.ts` already has `parseBody` with zod; 7 routes use it. Migrate the money and secret routes first (`wallet/send`, `browser/purchase`, `approvals/[id]`, `admin/provision`, `crm/update`, `chat` where `input` is unbounded). Add a repo test that fails on `await request.json()` in a route without a `parseBody` or `safeParse` in the same file. |
| R-ARCH-04 | P1 | S | **A logger.** There is no logger module; 382 raw `console.*` calls emit JSON by hand, and only 12 carry both `user_id` and `box_id` (README.md:57 requires both on every box-touching line). Add `lib/log.ts` with `log.info(msg, { user_id, box_id, … })`, a required-fields check in tests, and a codemod for the 382 sites. In box-touching modules (`lib/box`, `lib/hermes`, `lib/orchestrator`, `lib/provisioning`, `lib/migration`, `app/api/box`) make `box_id` a required key. |
| R-ARCH-05 | P1 | M | **Check every Supabase write.** 249 `await supabase…` statements discard `{ error }`. Supabase does not throw; these are silent swallows, including queue writes (`flush.ts:572,591`: `carried_messages` and `batch_queue` inserts that can lose a burst). Add a thin `db.write(query, { what })` wrapper that throws a typed error, and an eslint rule (`@typescript-eslint/no-floating-promises` is already available; add a custom rule or a grep test for `await supabase` not followed by a destructure of `error`). |
| R-ARCH-06 | P1 | S | **The 505 swallowed promises and 44 comment-only catches.** Triage by consequence, not count. The ten that matter are in the architecture audit: `flush.ts:1471,1422` (`stopRun` swallowed before a retry, so runs overlap and side effects can happen twice), `hermes/client.ts:137` (empty history returned silently: amnesia on web turns), `vault/purchase.ts:328,342,395` (approval relay), `outbound.ts:173`, `flush.ts:1259,283`, `relay.ts:66` and `boxes.ts:452` (`armStopAfter` swallowed, box stays awake 30 min), `kernel/purchases.ts:913`, `inbound/imessage/route.ts:91,513,562,584`. Each becomes: log with ids, and either propagate or mark state so a sweeper can finish the job. Add an idempotency key to `createRun` (`hermes/client.ts:163-173`) so a retried burst cannot start a second run while the first is alive. |
| R-ARCH-07 | P2 | M | **Thin the route handlers.** 27,650 lines live in `route.ts` files; the gateway is 1,195 lines, the iMessage webhook 708, `decisions` 674, `admin/health` 593. A route should authenticate, parse, call one `lib/` function, and shape the response. Move logic into `lib/` where it can be unit-tested without `NextRequest`. Start with the three P0-adjacent ones (`inbound/imessage`, `decisions`, `gateway`). |
| R-ARCH-08 | P2 | S | **Box access has three front doors.** `lib/box/` is the stated seam, but `lib/namespace/client.ts:424` is a second provider that "mirrors lib/box/client.ts", `lib/orchestrator/boxes.ts` is the real session layer, `app/api/box/[...path]/route.ts:69-115` builds Hermes auth headers itself, `lib/assets/pipeline.ts:78` fetches the box directly, and `app/api/bots/route.ts:77-83` reads `hosted_token`/`api_server_key` straight from the table. Make `lib/box/` the only module that can read those columns (a grep test), and have `namespace` implement the same `BoxProvider` interface `tenki` and `ascii` do. |
| R-ARCH-09 | P3 | S | **`learning-contracts` are not enforced.** Five JSON schemas that nothing validates against (no ajv or jsonschema dependency; `candidates.py:59` checks a version string by hand). Add a Python test that validates fixture receipts against `learning-receipt.v1.json` and a TS test that validates the control-plane side. |

---

## 5. Acceptance gates

You are done with this work order when all five are true on `main`, with fresh runs, and the report in §6 shows the numbers.

| Gate | Condition | How it is checked |
|---|---|---|
| G1 · Safety | R-P0-1, R-P0-2, R-P0-3 merged with their tests; R-SEC-01 and R-SEC-02 merged | `npx vitest run lib/muse lib/vault lib/orchestrator/outbound lib/orchestrator/flush lib/routing` green; `grep -rn executeDirectTransfer apps/web` empty |
| G2 · CI truth | R-P0-4, R-P0-5, R-P0-6, R-CI-01, R-CI-02 merged | `ci.yml` has jobs `web`, `python`, `migrations`, `audit`; `workers.yml` has a `pull_request` check job; coverage threshold enforced; `npm audit --omit=dev --audit-level=high` exits 0 |
| G3 · Test depth | R-TQ-01, R-TQ-02, R-TQ-03, R-TQ-04, R-TQ-05 merged | a green `vitest run` prints zero unexpected stderr lines; the three webhook route tests exist and cover replay; `lib/auth/session.test.ts` exists; `git log --grep="re-run"` shows no new CI re-runs for flakes |
| G4 · Evals can fail | R-EV-01, R-EV-02, R-EV-05, R-EV-06, R-EV-07(a) merged; one model-tier run committed with `suite.json` | `score.test.ts` green in CI; the contract tier runs on PRs; the committed report shows `gating_expected` and `execution` separately with n ≥ 20 each |
| G5 · Ledger alive | R-LED-01, R-LED-02 merged | `python3 scripts/review-tracker.py --check` reports 0 `not_verified` rows whose evidence field is empty and a status for every row; every commit on `main` since this review names an ID |

Numeric floors at the time of the report (fill in §6): lines coverage ≥ 55 % and rising, `gating_expected` and `execution` reported honestly (no target yet: the first honest number is the baseline), zero high/critical production advisories, Python 0 skipped, CI wall ≤ 7 min with the new jobs.

---

## 6. The report you file

Write it as `docs/reports/devin-review-<date>.md`, in this order, with numbers from fresh runs. Keep it under two pages plus tables. The product owner reads §6.1 and §6.5; everything else is evidence.

**6.1 Outcome in five lines.** Which gates in §5 pass. Which do not, and the single reason each does not.

**6.2 Baseline versus now.** The table from §1.2 and §1.3 with a third column, "after". Same commands, same machine class. If a number got worse, say so and why.

**6.3 Evals.** The §1.4 table with `gating_expected` and `execution` (tool-events-only) added, the K-case run if done, the iMessage-path p50/p95 if R-EV-08 landed, and the explanation for the 39 → 97 % routing jump (R-EV-10).

**6.4 What changed.** One row per merged PR: PR number, finding IDs, one sentence, the test that guards it.

**6.5 Decisions for the owner.** Each with your recommended default and what happens if no answer arrives. At minimum: the Muse no-approval lane (R-P0-1), the Hermes approval mode (R-SEC-03), the freeze (R-LED-04), the `x402` major bump (R-P0-4), the six RLS tables (R-P0-5, confirm none is meant to be public).

**6.6 What you did not do and why.** Every item in §3 and §4 you did not complete, with the blocker. "Ran out of time" is a valid blocker; "seemed fine" is not.

**6.7 Where you disagree with this review.** With evidence. A finding you think is wrong is worth more to the next reader than one you silently skipped.

---

## Appendix A · Commands used for the baseline

Run from the repository root unless stated. Node 22.22.2, Python 3.11.15, 4 vCPU, 15 GB.

```bash
# install (postinstall skipped; ffmpeg-static is allow-listed in package.json)
npm ci --ignore-scripts --no-audit --no-fund

# the CI gates
cd apps/web
time npx tsc --noEmit                                  # 35 s
time npx eslint .                                      # 28 s, 0 errors / 789 warnings
time npx vitest run --reporter=verbose > vitest.log 2>&1   # 91 s, 339 files, 3758 pass, 3 skip
time NEXT_TELEMETRY_DISABLED=1 npm run build           # 2 m 25 s

# coverage (provider not in devDependencies yet; R-CI-02 adds it)
npm i --no-save @vitest/coverage-v8@3.2.7
npx vitest run --coverage --coverage.provider=v8 \
  --coverage.reporter=json-summary --coverage.reporter=text-summary \
  --coverage.include='lib/**/*.ts' --coverage.include='app/api/**/*.ts' \
  --coverage.include='middleware.ts' --coverage.exclude='**/*.test.ts'
# → Lines 53.09 % (45703/86074), Functions 71.43 %

# lint breakdown
npx eslint . -f json > eslint.json   # then aggregate by ruleId and filePath

# stderr noise in a green run
grep -A2 stderr vitest.log | grep '"msg"' | sed -E 's/"jti":"[^"]*"//' | cut -c1-110 | sort | uniq -c | sort -rn

# audit
npm audit --omit=dev --json | jq '.metadata.vulnerabilities'

# python suites (none run in CI)
pip install pytest
for d in infra/template/openviking/tests infra/template/plugins/air-vault/tests \
         infra/template/tests infra/template/taskrouter/tests \
         infra/template/learning/tests scripts/tests; do
  ( cd "$(dirname $d)" && python3 -m pytest -q -p no:cacheprovider "$(basename $d)" )
done

# ledger
python3 scripts/review-tracker.py --check

# route and test counts
find apps/web/app -name route.ts | wc -l          # 258
find apps/web/app -name route.test.ts | wc -l     # 68
```

## Appendix B · Finding index

| ID | Sev | Eff | Area | One line |
|---|---|---|---|---|
| R-P0-1 | P0 | S | security | Muse wallet send skips the decision gate and has no cap |
| R-P0-2 | P0 | S | security | Open-run timestamp inference makes a tier-1 run owner-initiated |
| R-P0-3 | P0 | S | security | send-file admits `~/.hermes/.env`; not tier-gated |
| R-P0-4 | P0 | S | supply chain | `next` critical advisory; no audit gate |
| R-P0-5 | P0 | M | data | Migrations to prod with no shadow apply; six tables without RLS |
| R-P0-6 | P0 | S | ci | Workers deploy untested on Node 20 from a cancellable job |
| R-CI-01 | P1 | S | ci | Run Python suites; fail on skips |
| R-CI-02 | P1 | S | ci | Coverage floor and per-module floors |
| R-CI-03 | P1 | S | ci | Lint ignores for built bundles; `--max-warnings 0` |
| R-CI-04 | P1 | S | ci | One Node version |
| R-CI-05 | P2 | S | ci | shellcheck and systemd-analyze |
| R-CI-06 | P2 | S | ci | Run or remove the 72 skill tests |
| R-CI-07 | P2 | S | ci | create-kit typechecks all components |
| R-CI-08 | P2 | S | ci | Typecheck and test the eval harness |
| R-CI-09 | P2 | M | ci | Test collection time |
| R-CI-10 | P3 | S | process | Stale PRs |
| R-TQ-01 | P1 | M | tests | One filter-recording Supabase fake |
| R-TQ-02 | P1 | S | tests | Fail on unexpected stderr |
| R-TQ-03 | P1 | M | tests | Route tests for the three untested webhooks |
| R-TQ-04 | P1 | S | tests | Test auth primitives and `resolveTrustTier` directly |
| R-TQ-05 | P1 | S | tests | Fix the millisecond flake; fake timers |
| R-TQ-06 | P2 | M | tests | Route tests for money and secrets |
| R-TQ-07 | P2 | S | tests | Cron and internal route tests; shared cron guard |
| R-TQ-08 | P2 | S | tests | Replace source-grep tests |
| R-TQ-09 | P2 | M | tests | Smoke tests for the five largest client files |
| R-TQ-10 | P3 | S | tests | Mitosis probe: test or delete |
| R-EV-01 | P1 | S | evals | Report `gating_expected` |
| R-EV-02 | P1 | S | evals | Execution on tool events only; negation-aware `must_not_do` |
| R-EV-03 | P1 | S | evals | Honesty regex and judge; `must_cite` |
| R-EV-04 | P1 | S | evals | Remove routing freebies |
| R-EV-05 | P1 | S | evals | Scorer tests in CI; fix lexical sort |
| R-EV-06 | P1 | M | evals | `suite.json`, committed raw results, seed script, per-case sessions |
| R-EV-07 | P1 | L | evals | Contract tier on PRs; model tier nightly |
| R-EV-08 | P1 | M | evals | iMessage-path eval with first-bubble timing |
| R-EV-09 | P2 | S | evals | Run K-cases; hold-out set |
| R-EV-10 | P2 | S | evals | Explain the routing jump |
| R-EV-11 | P2 | S | evals | Memory recall eval |
| R-EV-12 | P2 | S | evals | Create suite report writer and grader fixes |
| R-EV-13 | P3 | S | evals | model-bench validity |
| R-PERF-01 | P1 | M | latency | Stream non-OpenAI SSE |
| R-PERF-02 | P1 | S | latency | Served-model headers |
| R-PERF-03 | P1 | M | latency | Drop the per-turn transcript replay |
| R-PERF-04 | P1 | S | latency | One Spectrum sender per turn |
| R-PERF-05 | P2 | S | latency | Health-driven wake waiter |
| R-PERF-06 | P2 | S | cost | Cron cadence from measured work |
| R-PERF-07 | P2 | S | latency | Mini-app bundle sizes |
| R-PERF-08 | P2 | M | latency | Fast-lane ack policy from data |
| R-PERF-09 | P3 | S | dx | Test wall time (= R-CI-09) |
| R-SEC-01 | P1 | M | trust | Tier to Hermes; contact sessions |
| R-SEC-02 | P1 | S | trust | Mixed-sender bursts take minimum trust |
| R-SEC-03 | P1 | M | trust | Hermes approval mode: decide and enforce |
| R-SEC-04 | P1 | S | trust | Nonce on the Create bridge |
| R-SEC-05 | P1 | S | trust | Approval relay failures surface |
| R-SEC-06 | P2 | S | trust | Authenticate the Onairos relay |
| R-SEC-07 | P2 | S | trust | Revocable sessions |
| R-SEC-08 | P2 | S | trust | Token off the command line |
| R-SEC-09 | P2 | S | trust | `COMMAND_LANE_KEY` required |
| R-SEC-10 | P3 | S | trust | Admin operator identity |
| R-LED-01 | P1 | S | process | Re-sync the ledger |
| R-LED-02 | P1 | S | process | IDs in commits, enforced |
| R-LED-03 | P1 | S | process | This document in the ledger |
| R-LED-04 | P2 | S | process | Freeze: honour or lift |
| R-LED-05 | P3 | S | process | README claims |
| R-ARCH-01 | P1 | M | shape | One auth module |
| R-ARCH-02 | P1 | S | shape | Env validated at boot |
| R-ARCH-03 | P1 | M | shape | Schema on every body |
| R-ARCH-04 | P1 | S | shape | A logger with required ids |
| R-ARCH-05 | P1 | M | shape | Check every Supabase write |
| R-ARCH-06 | P1 | S | shape | The swallowed promises that matter; run idempotency |
| R-ARCH-07 | P2 | M | shape | Thin the route handlers |
| R-ARCH-08 | P2 | S | shape | One box seam |
| R-ARCH-09 | P3 | S | shape | Enforce learning contracts |

Counts: 6 P0, 35 P1, 24 P2, 7 P3; 72 findings.

## Appendix C · What this review did not measure

- No eval was run. Every eval number is from a committed report; the harness needs a funded control plane, a live Box, and the owner's cookie.
- No production traffic, logs, or Vercel function durations were read. The 37/114 deadline figure is quoted from `docs/goal-create-v13.md`.
- No Box was provisioned; the Python suites ran on the container, not on the template image, which is why `air-vault` could not import Hermes.
- Cloudflare workers were not deployed or dry-run; wrangler is not installed here.
- The claim that `wrangler 4` refuses Node 20 at runtime was not tested; the engine declaration was read from the lockfiles.
- Bundle sizes are from the local `next build`; no Lighthouse or real-device measurement was taken.
- The x402 major bump was not attempted.
- `git` history is shallow (140 commits); anything before 2026-09-14 comes from the prior review's ledger, not from diffs.
- Where this document cites a line number from one of the five audit passes, the four highest-impact claims (R-P0-1, R-P0-2, R-P0-3, R-SEC-03) were re-read in source by the reviewer; the others were spot-checked.

## Appendix D · Where things live

| Concern | Path |
|---|---|
| Control plane routes | `apps/web/app/api/**/route.ts` (258) |
| Inbound webhooks | `apps/web/app/api/inbound/{imessage,email,calcom,stripe,github}` |
| The agent loop | `apps/web/lib/orchestrator/flush.ts` (1,774 lines), `boxes.ts`, `sharedBridge.ts`, `ttfk.ts` |
| Hermes client and sessions | `apps/web/lib/hermes/client.ts` (`MAIN_SESSION = "air-main"`) |
| Trust tiers | `apps/web/lib/routing/trust.ts` |
| Decisions and approvals | `apps/web/lib/decisions`, `lib/approvals`, `app/api/decisions/route.ts` |
| Money | `apps/web/lib/wallet/send.ts`, `lib/vault/purchase.ts`, `lib/kernel/purchases.ts`, `lib/checkout`, `lib/commerce` |
| Muse (external agents) | `apps/web/lib/muse`, `app/api/muse/**`, `infra/workers/muse` |
| Inference gateway | `apps/web/app/api/gateway/v1/[...path]/route.ts`, `lib/gateway`, `lib/entitlements/models.ts` |
| Memory | `apps/web/lib/memory/{files,deep,cortex}.ts`, `infra/template/openviking/` |
| Box template | `infra/template/setup.sh`, `sync-box.sh`, systemd units, `plugins/`, `skills/` |
| Cloudflare workers | `infra/workers/{create,dev-router,dispatcher,muse,outbound,static-stub}` |
| Migrations | `supabase/migrations/0001…0127`, `scripts/apply-migrations.sh`, `.github/workflows/migrate.yml` |
| Evals | `evals/agent-suite/{run,score,lib,timing}.ts`, `messages.jsonl` (205 cases), `create/`, `evals/model-bench/bench.ts` |
| Prior review and ledger | `docs/review-2026-09/astra-ultra-review.md`, `docs/review-findings.json`, `scripts/review-tracker.py`, `continue.md`, `docs/review-implementation-plan.md` |
| Current workstream | `docs/goal-create-v13.md` |
