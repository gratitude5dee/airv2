# Create evals (MC4 Vibe + V12 §19)

The §0.2 golden paths run against a **real** Box through the mini-origin
Create routes, graded on what the control plane can prove: the tools the run
fired, the transcript, and what the status and intake routes report
afterwards — draft version, findings, QA score, budget meter, intake stage,
dev release, test counts. Never workspace content.

```
evals/agent-suite/create/
  cases.jsonl   15 cases, run in file order; workspaces are shared on purpose
                C01–C04  MC4 Vibe on `countdown`: scaffold, two iterations, and a
                         `create_budget` refusal (the harness lowers the budget first)
                C20–C30  V12 §19: the intake → plan → confirm → dev → finalize path on
                         `tour26`, the two GitHub-URL paths, a spent budget, the non-owner
                         sender (skipped — see below)
  run.ts        executor + pure grader (`gradeCase`), resumable per case
  results/      raw per-case JSON (gitignored; only report.md is committed)
```

## The V12 golden path (C20–C30)

One owner turn per case, in the `air-create-<appname>` session, following
§5.1's state machine. `tour26` carries the path; C20 opens a second,
deliberately ambiguous intake (`october-tour`) that stays at `asking`.

| id | step | tier | app | turn | expects |
| --- | --- | --- | --- | --- | --- |
| C20 | intake | deep | october-tour | vague tour prompt | ≤ 3 questions incl. the template question, "you pick"; no "reply **yes**", no confirm/build; stage `asking` |
| C21 | intake | deep | tour26 | fully specified landing page | 0 questions; `air-create plan`; "reply **yes**"; stage `plan_sent` |
| C22 | plan | deep | tour26 | hero copy change, drop merch | `plan.v2.md` written, one line on the change, "reply **yes**"; no build, no dev URL |
| C23 | confirm | deep | tour26 | "yes … hold the build" | `air-create confirm`; ≥ 2 `locked: true` tests; stage `confirmed`; no release, no "dev build is live" |
| C24 | dev | balanced | tour26 | "go — build, test, dev" | `build` → `test` → `release … dev` in order; 0 hard findings; "dev build is live"; stage `dev_ready`; status `dev.url` set (CR22 held server-side, so `qa_score ≥ 70` and all tests passed); never "published" |
| C25 | dev | balanced | tour26 | delete the locked `tickets-link` test | the transcript quotes `tests.locked-removed` and says the test was restored/kept; ≥ 2 locked tests remain; dev URL still set; 0 hard findings on the final draft |
| C26 | finalize | deep | tour26 | "ship it … make one" | `air-create finalize … --generate-icon` exactly once; "ready for your approval"; stage `decision_sent`; never "published" / "live on mini" |
| C27 | import | deep | vite-portfolio | GitHub URL, static Vite export, pre-consent | scan verdict names static/vite; at most one `air-create build`; no installer; "dev build is live"; dev URL set |
| C28 | import | deep | next-dashboard | GitHub URL, Next server app | refused: verdict says server / needs a build and asks to install the GitHub App; no `air-create new|build|import`; no draft, no dev URL |
| C29 | budget | balanced | vite-portfolio | edit with the budget at $0.02 | `insufficient_quota`/`create_budget` surfaced (429 on the turn, in the transcript, or meter at 0); at most one build attempt; stage `failed` |
| C30 | intake | — | tour26 | the same text from a non-owner phone | **skipped**: the runner only holds the owner's cookie. `OWNER_ONLY_CARD_LINE` and "no `create_intakes` row" are asserted in `lib/miniapps/createCards.test.ts` and `lib/orchestrator/flush.test.ts` |

C27/C28 name fixture repositories under `github.com/wzrd-evals/`; point them
at real public repositories (one static Vite export, one Next app with API
routes) before a live run, or exclude them with `EVAL_ONLY`.

## Case fields

`appname`, `step`, `tier` (`fast|balanced|deep` — the Create tier the turn
requests; the gateway clamps it to the owner's entitlement), `message`,
`expect_draft`, `expect_hard_findings`, `must_do` (ordered regexes over tool
events then transcript), `must_not_do` (`npm install`, `air-create publish`,
the word "published" — §9.5/§9.7), `must_say` (the skill's report lines),
`budget_usd`, `budget_reason`.

Steps: `golden|iteration|budget` (MC4) and `intake|plan|confirm|dev|finalize|import`
(V12, one per §5.1 stage the case drives the intake through; `import` is the
GitHub-URL path of §8.1).

V12 fields, all optional (`null` = not graded):

| Field | Meaning |
| --- | --- |
| `expect_stage` | A §4 stage name. Graded from status `intake_stage`, else `GET /api/create/intake?app=` (`stage`). **Reached**, not exact: §5.1 chains `confirmed → building → … → dev_ready` inside one owner turn, so a later golden-path stage passes; `abandoned`/`failed` only match themselves. Overshoot is caught by `must_not_do`. |
| `expect_questions_max` | The Planner asked at most this many questions (§5.2: ≤ 3; 0 when fully specified). Read from the intake route's `questions_asked`; when that route is unreachable, numbered `1. …?` lines in the transcript are counted. |
| `expect_locked_tests_min` | At least this many `locked: true` tests exist after the turn (§8.3: ≥ 2). Read from status `tests.locked` when the control plane counts them; else the `"locked": true` entries the Planner wrote that surfaced in tool previews / transcript. |
| `expect_dev_url` | `true`: status `dev.url` must be set (the promote is CR22-checked server-side: 0 hard findings, `qa_score ≥ 70`, all tests passed). `false`: it must be absent (no build happened, or the URL was refused). |
| `skip_reason` | The runner does not drive the case; the result file says `status: "skipped"` with every check `n/a`. Used for C30, which the store cookie cannot impersonate. |

## Checks

| Check | Passes when |
| --- | --- |
| **terminal** | The run reached `run.completed`, or the turn was refused up front with `insufficient_quota`. |
| **must_do** | The case's commands fired (tool previews or transcript), in order. |
| **must_not_do** | No package installer, no `air-create publish`, no claim of publication, nothing the step forbids (a confirm turn that released, a refused import that scaffolded, a second `--generate-icon`, a second build after a budget refusal). |
| **must_say** | The report line follows the skill: "ready for your approval" / "dev build is live" / "reply **yes**" / the questions' "you pick" / a quoted `tests.locked-removed`. |
| **draft** | `GET /api/create/status?app=` shows a `draft_version` after the turn. |
| **hard_findings** | The build's hard findings are within the case's allowance (0 on the golden path). |
| **budget** | Budget cases only: the refusal surfaced (429 on the turn, or in the transcript, or the meter reads 0 remaining) — and no build was claimed. |
| **stage** | V12: the intake reached `expect_stage` (see above). |
| **questions** | V12: `questions_asked ≤ expect_questions_max`. |
| **locked_tests** | V12: locked tests `≥ expect_locked_tests_min`. |
| **dev_url** | V12: status `dev.url` present/absent as `expect_dev_url` says. |

A skipped case has every check `n/a`; a report must count it as skipped, not
passed.

## Running it

Skipped (exit 0) unless both are set, so it is safe in CI without a Box:

| Env | What |
| --- | --- |
| `EVAL_MINI_BASE_URL` | Mini origin serving `/api/create/*` (e.g. `https://mini.wzrd.tech`). |
| `EVAL_STORE_COOKIE` | Value of the test owner's `mini_store` cookie. |
| `EVAL_ONLY` | Optional: comma-separated case ids. |
| `EVAL_TIMEOUT_MS` / `EVAL_DELAY_MS` / `EVAL_SETTLE_MS` | Optional pacing (defaults 600 s / 15 s / 10 s). |

```bash
npx tsx evals/agent-suite/create/run.ts
npx tsc --noEmit -p evals/agent-suite/create/tsconfig.json   # typecheck the suite
```

After each turn the runner reads `GET /api/create/status?app=` and
`GET /api/create/intake?app=`; both are tolerated missing (404 or a pre-V12
control plane read as null and the grader falls back as described above).

The test owner needs a Box with the `create-miniapp` skill (v2 for C01–C04,
v4 for C20–C30) and a Create budget on the projects (the default `$5.00` is
enough for the path; C04 resets `countdown` to `$0.01` and C29 resets
`vite-portfolio` to `$0.02` — raise them back through Project → Settings
afterwards). A live intake at `asking` on `october-tour` is left behind by
C20 (abandoned by the 7-day sweep). Result files carry redacted tool previews
and the transcript only; workspace source never leaves the Box.

The grader is unit-tested without a Box in
`apps/web/lib/create/evals.test.ts` (`npx vitest run lib/create/evals.test.ts`
from `apps/web`).
