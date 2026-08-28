# Task-router hardening — eval score sheet (2026-08-28)

Implements the five recommendations from `component-evals-2026-08-28.md`:
trace-ID log-join, heuristics-first / model-on-ambiguity, tool prefetch
hints, deterministic-only `needs_approval`, and a golden-set promotion gate.
Scored on the same 24-case labeled set (now checked in as
`infra/template/taskrouter/golden.jsonl`).

## Before → after

| metric | before: model-always | before: heuristic-only | **after: pipeline** |
|---|---|---|---|
| tier accuracy | 50.0% | 62.5% | **66.7%** |
| approval accuracy | 66.7% | 83.3% | **87.5%** |
| payment approval false-negatives | 5 | 2 | **0** |
| tool/prefetch recall | 70.6% | 41.2% | 41.2% (heuristic) — model union when consulted |
| latency p50 / p95 | 1425 / 2175 ms | 0 / 1 ms | **0 / 0 ms** (model consulted on 1/24 cases) |
| promotion gate | n/a | n/a | **PASS** (0 failures) |

Improved on every gated axis. The old model-always path was strictly worse
than free heuristics on tier and approval; the new pipeline serves the
heuristic instantly and only pays the ~2.3 s model cost on genuinely
ambiguous input (heuristic confidence < 0.6 and latency budget ≥ 3 s) —
1 of 24 golden cases.

Why approval jumped: `needs_approval` is now a single deterministic rule
(`SIDE_EFFECT_RE` ∪ new `PAYMENT_RE` covering money movement — "wire $500",
"renew … saved card", "subscription", `$<amount>`), and the response field
can never be model-derived. The two remaining approval misses are
false-*positives* ("send an email to my landlord…", "draft a reply … and
send it") — conservative direction; the approval queue, spend caps, and
trust tiers in the control plane remain the real authorizer regardless.

## What changed (`infra/template/taskrouter/`)

- **`taskrouter.py`** — `route()` pipeline:
  - `POST /route` accepts optional `trace_id` (opaque, ≤64 chars; minted as
    `tr_<hex>` if absent) and `latency_budget_ms`.
  - Heuristic answers first with a signal-strength confidence; the GGUF is
    consulted only when confidence < 0.6 **and** budget ≥ 3000 ms.
  - `prefetch_tools` = union of both engines' tool proposals (warm-cache
    hints only; a wrong hint never grants a capability).
  - `needs_approval` in the response is always `deterministic_needs_approval()`;
    the model's approval opinion is logged only for the disagreement metric.
  - `decisions.jsonl` lines carry `trace_id`, `text_len`, both engines'
    tier/approval/confidence, and `model_consulted` — **no message text** —
    so the learning plane can join proposals against actual control-plane
    decisions/outcomes as a content-free receipt metric.
- **`golden.jsonl`** — the 24 labeled cases (6 flagged `payment`), the seed
  set to grow from shadow logs.
- **`promotion_gate.py`** — regression gate any future consumer must pass:
  pipeline tier accuracy ≥ heuristic baseline, **zero** payment approval
  false-negatives, approval accuracy ≥ 0.85, latency p95 ≤ 3000 ms.
  Exit code 1 on any failure. Current run: PASS.
- **`tests/test_taskrouter.py`** — 14 tests (all passing): deterministic
  approval incl. model-can-never-flip-approval, model gating by ambiguity
  and latency budget, invalid-model-output fallback, prefetch union,
  trace-ID echo/minting, content-free log records, gate thresholds.

Verified live over HTTP: payment text with `latency_budget_ms=200` returned
instantly from the heuristic with `needs_approval=true` and the caller's
`trace_id` echoed; an ambiguous no-signal message consulted the model
(2.3 s, logged `model_consulted: true` with both engines' opinions).

## Still open

- Tier accuracy ceiling is the heuristics' 66.7%; the model is now only
  invoked on 1/24 golden cases, so a better model would barely move this
  set. Next lever: grow `golden.jsonl` from shadow-log trace-joins where the
  control plane's actual tier disagreed with the proposal, then revisit a
  smaller/distilled model or constrained decoding for the ambiguous slice.
- No consumer reads the proposal yet (still shadow). First integration
  should be the prefetch hint (harmless), joined by `trace_id` in the
  learning plane's receipts.
