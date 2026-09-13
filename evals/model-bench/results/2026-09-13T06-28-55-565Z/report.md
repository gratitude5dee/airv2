# Model bench — report

Run: `2026-09-13T06-28-55-565Z` · cells: `openai/*` via api.openai.com, `gmi/*` via api.gmi-serving.com · 3 reps/cell (mean shown)

Workloads: `short` (1-turn ping), `longctx` (~18.3K-token synthetic history + summary ask), `toolcall` (5 tools, pick one), `orch` (1 parent plan call + 4 parallel child calls — the delegation pattern `delegation.model: "fast"` produces on a box).

## Headline

| Pair (parent → child) | orch latency | orch cost | vs astra→astra |
| --- | --- | --- | --- |
| gmi/astra → gmi/astra | 75.4s | $0.1258 | 1.0× |
| gmi/astra → gmi/glm-flash-low | 33.0s | $0.0446 | **2.3× faster, 2.8× cheaper** |
| openai/luna-fast → openai/luna-fast | 16.7s | $0.0085 | 4.5× faster, 14.8× cheaper |

## Per-cell results

| Cell | Workload | n | fail | latency | TTFT | prompt tok | completion tok | cost/req |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| openai/luna-fast | short | 3 | 0 | 1.1s | — | 24 | 7 | $0.0000 |
| openai/luna-fast | longctx | 3 | 0 | 3.9s | — | 18,331 | 284 | $0.0080 |
| openai/luna-fast | toolcall | 3 | 0 | 3.2s | — | 186 | 232 | $0.0006 |
| openai/terra-deep | short | 3 | 0 | 1.0s | — | 24 | 7 | $0.0003 |
| openai/terra-deep | longctx | 3 | 0 | 4.4s | — | 18,331 | 235 | $0.0790 |
| openai/terra-deep | toolcall | 3 | 0 | 3.8s | — | 186 | 288 | $0.0077 |
| gmi/luna | short | 3 | 0 | 4.8s | 4.7s | 24 | 6 | $0.0000 |
| gmi/luna | longctx | 2 | 1 | 5.3s | 4.2s | 18,331 | 115 | $0.0076 |
| gmi/luna | toolcall | 2 | 1 | 4.9s | 4.7s | 226 | 124 | $0.0004 |
| gmi/astra | short | 3 | 0 | 12.0s | 11.8s | 24 | 7 | $0.0006 |
| gmi/astra | longctx | 3 | 0 | 30.6s | 29.1s | 18,331 | 233 | $0.1950 |
| gmi/astra | toolcall | 1 | 2 | 3.7s | 3.7s | 186 | 14 | $0.0026 |
| gmi/glm-flash | short | 3 | 0 | 3.1s | 3.0s | 27 | 38 | $0.0000 |
| gmi/glm-flash | longctx | 3 | 0 | 18.3s | 9.1s | 18,266 | 835 | $0.0032 |
| gmi/glm-flash | toolcall | 3 | 0 | 16.5s | 16.4s | 423 | 525 | $0.0003 |
| gmi/glm-flash-low | short | 3 | 0 | 1.1s | 1.0s | 27 | 6 | $0.0000 |
| gmi/glm-flash-low | longctx | 3 | 0 | 5.0s | 2.3s | 18,266 | 256 | $0.0029 |
| gmi/glm-flash-low | toolcall | 3 | 0 | 5.8s | 5.6s | 423 | 104 | $0.0001 |

`-low` = `reasoning_effort: "low"` sent upstream (GLM's reasoning is mandatory; the effort floor collapses `reasoning_tokens` to ~1 — 3.7× faster and ~8× fewer output tokens on longctx).

## What the orchestration split buys

Astra→GLM-low vs Astra→Astra on the same 4-child fan-out: **33.0s vs 75.4s (-56%)** and **$0.0446 vs $0.1258 (-65%)**. That is the entire case for the `gmi` family's tier mapping — the parent thinks on Luna/Astra while every delegated child lands on GLM-Flash at $0.15/$0.50 list ($0.075/$0.25 promo).

Honest caveat: on this shallow fan-out, `luna→luna` is still faster (16.7s) and cheaper ($0.0085) than any GMI pairing — Astra's TTFT (~11–29s) dominates short parent calls. The Astra parent only earns its price when the *plan* itself is hard; the GLM child lane is unambiguously right regardless.

## Operational notes

- `gmi/astra` + tools + `reasoning_effort` 400s upstream — the gmi lane stays on `/chat/completions` with the field stripped (2/3 toolcall reps failed before the strip; the surviving rep is shown).
- `gmi/luna` 400s on small `max_tokens` (GMI normalizes to `max_completion_tokens` with a floor) — the gateway renames the field for `openai/*` slugs.
- GLM returns `reasoning_content`; metering keys on the served slug since GLM:Astra list pricing spans ~130×.
- OpenAI cells priced at list (luna $0.40/$2.40, terra $4/$24); gmi/luna priced same as openai (same weights, promo TBD); GLM at list $0.15/$0.50.

## Reproduce

```sh
cd evals/model-bench
GMI_CLOUD_API_KEY=... OPENAI_API_KEY=... npx tsx bench.ts
```

Raw rows: `results/2026-09-13T06-28-55-565Z.json` (gitignored).

## Follow-up: routine-turn lane check (Phase 2, 2026-09-13)

Re-ran the `toolcall` workload (the turn type the gateway's `gmiRoutineTurn` rule now routes to the fast lane), 2 reps:

| cell | workload | mean total | mean TTFT | in tok | out tok | cost |
|---|---|---|---|---|---|---|
| gmi/luna | toolcall | 6.0s | 5.9s | 267 | 152 | $0.0005 |
| gmi/glm-flash-low | toolcall | 4.2s | 2.6s | 426 | 92 | $0.0001 |

Routine turns on GLM-low are faster *and* ~5× cheaper than Luna — the task-type rule pays on both axes.

Separately: the deterministic-command change (`directCreativePlan` for `/imagine`+`/animate`) removes one Groq `openai/gpt-oss-20b` compile call (~1–2s, ~1K tokens) per creative command — deterministic, so nothing to bench.
