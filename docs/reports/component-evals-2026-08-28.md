# Component evals — task router, memory recall, learning/RL substrate (2026-08-28)

Environment: clean local harness reproducing the box services from `infra/template`
(taskrouter on `127.0.0.1:1917` with the pinned Qwen2.5-1.5B-Instruct q4_k_m GGUF,
a heuristic-only instance on `:1918`, OpenViking on `127.0.0.1:1933`,
`air-learningd` on its Unix socket). All data stayed local; no message bytes
touched Postgres or any external store (C4).

## 1. Task router — what it does today

`infra/template/taskrouter/taskrouter.py` is a loopback-only, advisory-only shadow
classifier. `POST /route {"text": ...}` returns a proposal
`{tier: fast|balanced|deep, tools[], needs_approval, confidence, source: model|heuristic}`.
The GGUF model output is validated against closed enums; any deviation, a missing
model, or a load failure falls back to deterministic keyword heuristics. Every
decision is appended to `~/.taskrouter/decisions.jsonl` (box filesystem only).
Nothing consumes the output yet: the control plane / gateway remains the sole
authorizer of entitlements, trust tiers, spend caps, and the approval queue.

## 2. GGUF eval — 24 labeled cases (model vs heuristic)

| metric | model (GGUF) | heuristic |
|---|---|---|
| tier accuracy | 50.0% (12/24) | 62.5% (15/24) |
| approval accuracy | 66.7% (16/24) | 83.3% (20/24) |
| tool recall | 70.6% | 41.2% |
| latency p50 / p95 | 1425 / 2175 ms | 0 / 1 ms |

Model↔heuristic agreement: tier 45.8%, approval 83.3%. Sources: 24/24 `model`
on :1917, 24/24 `heuristic` on :1918 (fallback path confirmed by removing the model).

Failure modes:
- **Tier collapse**: every one of the model's 12 tier misses was `balanced` — it
  under-uses both `fast` (8 misses on trivial messages like "thanks!") and `deep`
  (4 misses on genuinely deep tasks like multi-city tour planning).
- **Payment approval false-negatives (safety-relevant)**: both routers said
  `needs_approval=false` for "wire $500 to alex" and "renew my domain, it's on the
  saved card"; the model additionally missed "buy 2 tickets", "order my usual from
  doordash", and "cancel my comcast subscription". Approval must stay a
  deterministic control-plane decision (it does today — shadow mode).
- Model tool proposals are its one clear win (70.6% vs 41.2% recall).

Verdict: **works mechanically (PASS), not promotable as-is**. Too slow (~1.4 s p50
inline) and less accurate than free heuristics on tier/approval.

## 3. Memory recall (OpenViking) — version-gated bug found

Test: ingest a synthetic iMessage-history resource at
`viking://resources/context/imessage-history` (thread with a ZIP, a venue, a
budget, a contact), then run 4 semantic recall queries.

- **openviking 0.4.13 (the version pinned on every box)**: ingestion OK, tree OK,
  direct read OK, `grep` OK — but semantic `find`/`search` returned **0/4**,
  status flipped to `is_healthy: false` / `"retrieval has errors"`, retrieval
  metrics showed a 100% zero-result rate, and the server logged
  `Error reading existing record before partial update: Strings must be encoded
  before hashing`.
- **openviking 0.4.16, identical config**: **4/4 recall** (ZIP 94587, The Chapel,
  $3200 budget, Sarah/guest list), 9–80 ms per query, zero hashing errors.

Verdict: storage/AGFS PASS; **semantic retrieval FAIL on the fleet-pinned 0.4.13,
fixed by 0.4.16**. Deep memory recall on production boxes is currently degraded to
exact-match/grep. This PR bumps the pin in `setup.sh` and `sync-box.sh`; a fleet
release + sync (canary → rolling, same flow as `UPGRADE.md` §7) picks it up
without re-forking.

## 4. Learning / RL substrate (`air-learningd`) — full lifecycle PASS

Exercised over the Unix socket via `learningctl` (the only surface):

- `status` / `settings.set` (mode observe→suggest) — OK, receipts emitted.
- `turn.completed` → episode collected; `feedback.record` → feedback row — OK.
- `experiment.run` with a valid `air.experiment.v1` spec: kernel validated the
  spec, selected the native backend, and **failed closed** with typed
  `twin_unavailable` ("no synthetic taskset fixtures provisioned yet") — the
  documented M0/M2 state; experiment marked `failed`, receipts
  `experiment_started`/`experiment_failed` emitted. No unisolated execution.
- Guardrails: `mode=observe` correctly rejects `experiment.run`
  (`mode_forbids_evaluation`); kill-switch path present.
- PolicyOverlay candidates: valid manifest accepted; `approval_bypass` field
  **rejected** (allowlist); embedded `http://` **rejected** (banned content).
- `candidate.approve` → atomic activation to `~/.hermes/learning/active-profile.json`
  (`prof_2236b8c8024d415c`); `profile.rollback` restored the baseline.
- Receipt stream stayed content-free: only event types, IDs, timestamps.
- Repo pytest suite: 26/26 passed (earlier this session).

Blocked (by design, not a bug): real experiment execution needs the M2 twin
substrate + M0 synthetic fixtures; HUD/Harbor adapters are stubs behind the same
typed-error contract.

## 5. Recommendations — putting the router to better use

Keep it advisory; make the shadow useful:

1. **Log-join for calibration**: extend `decisions.jsonl` entries with an opaque
   run/trace ID so the learning plane can join router proposals against actual
   control-plane decisions and outcomes — router-vs-policy disagreement becomes a
   content-free receipt metric. This is the cheapest path to real eval data.
2. **Heuristics-first, model-on-ambiguity**: serve the heuristic instantly; only
   invoke the GGUF when heuristic confidence is low *and* the run isn't
   latency-sensitive. At 1.4 s p50 the model can't sit inline on the fast path.
3. **Use the model where it wins**: tool *prefetch hints* (warm the likely
   plugin/skill) — a wrong hint costs a warm cache, never a capability.
4. **Never for approval**: both engines produced payment false-negatives.
   `needs_approval` stays a deterministic control-plane rule (spend caps, trust
   tiers, approval queue). Router approval output should only feed the
   disagreement metric.
5. **Promotion gate**: a golden labeled set (this 24-case set as seed, grown from
   shadow logs) with regression thresholds — e.g. tier ≥ heuristic baseline,
   0 payment approval false-negatives, p95 within budget — enforced before any
   consumer treats the proposal as more than a hint. Consider a smaller/distilled
   model or constrained decoding to fix the balanced-collapse and latency.

## 6. Scorecard

| component | status |
|---|---|
| taskrouter GGUF path (`/route`, schema, closed enums, decisions.jsonl) | PASS |
| taskrouter heuristic fallback | PASS |
| taskrouter model quality vs heuristic | FAIL (tier/approval below baseline, 1.4 s p50) |
| OpenViking ingestion / tree / read / grep | PASS |
| OpenViking semantic recall @ 0.4.13 (fleet pin) | FAIL (0/4, retrieval errors) |
| OpenViking semantic recall @ 0.4.16 | PASS (4/4) — pin bumped in this PR |
| air-learningd socket protocol (status/settings/turn/feedback/receipts) | PASS |
| EvaluationKernel spec validation + mode/kill-switch gates | PASS |
| native adapter fail-closed (`twin_unavailable`) | PASS (by-design block: M2 twin, M0 fixtures) |
| PolicyOverlay allowlist + banned-content rejection | PASS |
| candidate approve → atomic activate → rollback | PASS |
| learning pytest suite | PASS (26/26) |
