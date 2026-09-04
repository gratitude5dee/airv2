# Create evals (MC4: Vibe)

The §0.2 golden path run against a **real** Box through the mini-origin
Create routes, graded on what the control plane can prove: the tools the run
fired, the transcript, and the draft version / findings / budget meter the
status route reports afterwards.

```
evals/agent-suite/create/
  cases.jsonl   4 cases, run in order against one shared workspace:
                C01 countdown from one sentence (golden path)
                C02 first iteration (bigger digits + share button)
                C03 second iteration (run Preview QA, respect reduced motion)
                C04 budget: the harness lowers create_budget_usd to $0.01 first
                    and expects the gateway's `create_budget` refusal to surface
  run.ts        executor + pure grader (`gradeCase`), resumable per case
  results/      raw per-case JSON (gitignored; only report.md is committed)
```

Case fields: `appname`, `step` (`golden|iteration|budget`), `tier`
(`fast|balanced|deep` — the Create tier the turn requests; the gateway clamps
it to the owner's entitlement), `message`, `expect_draft`,
`expect_hard_findings`, `must_do` (ordered regexes over tool events then
transcript), `must_not_do` (`npm install`, `air-create publish`, the word
"published" — §9.5/§9.7), `must_say` (`ready for your approval`,
`[card: app <appname>]`), `budget_usd`, `budget_reason`.

## Checks

| Check | Passes when |
| --- | --- |
| **terminal** | The run reached `run.completed`, or the turn was refused up front with `insufficient_quota`. |
| **must_do** | `air-create new|build|qa <appname>` fired (tool previews or transcript), in order. |
| **must_not_do** | No package installer, no `air-create publish`, no claim of publication. |
| **must_say** | The report line follows the skill: "ready for your approval" + the app card. |
| **draft** | `GET /api/create/status?app=` shows a `draft_version` after the turn. |
| **hard_findings** | The build's hard findings are within the case's allowance (0 on the golden path). |
| **budget** | Budget cases only: the `create_budget` refusal surfaced (429 on the turn, or in the transcript, or the meter reads 0 remaining) — and no build was claimed. |

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
```

The test owner needs a Box with the `create-miniapp` skill v2 installed and a
Create budget on the `countdown` project (the default `$5.00` is enough for
C01–C03; C04 resets it to `$0.01` — raise it back through Project → Settings
afterwards). Result files carry redacted tool previews and the transcript
only; workspace source never leaves the Box.
