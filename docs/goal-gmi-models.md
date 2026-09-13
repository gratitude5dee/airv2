# goal: GMI Cloud chat models — onboarding, Hermes lanes, and the Astra/GLM orchestration split

| Field | Value |
| --- | --- |
| Status | Plan + measured bench (evals/model-bench); not yet implemented |
| Primary outcome | Any Air owner can pick GMI Cloud models (GPT-6-Astra, GPT-5.6-Luna, GLM-5.3-Flash) during onboarding and in Settings; the inference gateway serves them; delegated children ride a fixed cheap lane |
| Last verified | 2026-09-13 against `gratitude5dee/airv2` @ `26a82b6e` and the live GMI catalog (`GET /v1/models` → 85 models) |

Read [ARCHITECTURE.md](../ARCHITECTURE.md) §2.5a before implementation. Every claim below about tiers, families, and where model IDs resolve traces to it.

## 0. What exists today (verified)

The platform is **already 80% wired for this**. What exists:

- **Provider plumbing.** `providerForFamily()` maps `minimax-m3`/`minimax-m2.7` to the `gmi` provider; the gateway's `case "gmi"` dispatches to `env.gmiInferenceBaseUrl()` (`https://api.gmi-serving.com/v1`) with `env.gmiCloudApiKey()` or a personal `gmi` key. `provider_keys` already accepts `'gmi'`, and Settings already has a GMI key field.
- **Metering.** Every completion lands in `agent_runs` with `latency_ms`, `prompt_tokens`, `completion_tokens`, `cost_usd`, `model`, `model_family`, `requested_model`, `speed_tier`, `fallback_from`.
- **The delegation seam.** Boxes pin `delegation.model: "fast"` (`infra/template/setup.sh`, `max_concurrent_children: 4`, `max_spawn_depth: 1`); the gateway honors `model:"fast"` as a **downgrade-only** request. This is the subagent lane the Astra/GLM split rides on.
- **The eval surface.** `evals/agent-suite/` produces per-category latency/cost/token tables from `agent_runs` rows, and `wzrdmail-m3-gmi` already ran 109 cases on `MiniMaxAI/MiniMax-M3` via GMI (mean 29.8s/case, $0.75 total).
- **GMI serves the whole current fleet.** Live catalog check: `openai/gpt-6-astra`, `openai/gpt-5.6-luna`, `openai/gpt-5.6-terra`, `zai-org/GLM-5.3-Flash`, both MiniMax models — 85 models total. GMI is a *native* Hermes provider upstream (`provider: "gmi"`), but boxes still never hold keys — they talk to our gateway (C2 stands).

## 1. Design: one `gmi` family, tier-mapped

Two precedents compete:

- **Fixed families** (`minimax-m3`): one family → one slug. Adding three GMI models means three families — and no tier awareness, so delegated children would inherit whatever the parent uses. Rejected.
- **Menu families** (`openrouter`, `venice`): one family → `*_model` column picks from a catalog; tier falls back to a default. Closer, but a pinned `gmi_model` would price every delegation child at the parent's rate.

**Chosen: a hybrid.** `gmi` resolves **per tier** like `openai` does — this is the cheapest correct home for the orchestration split, because `delegation.model: "fast"` already exists on every box:

| Speed & Intelligence tier | `openai` family today | `gmi` family |
| --- | --- | --- |
| fast (incl. every delegated child) | gpt-5.6-luna | **zai-org/GLM-5.3-Flash** |
| balanced | gpt-5.6-luna | **openai/gpt-5.6-luna** |
| deep | gpt-5.6-terra | **openai/gpt-6-astra** |

Plus `entitlements.gmi_model` (nullable) as an explicit pin for the parent's own tier — mirroring `openrouter_model`/`venice_model`. **The pin applies to the owner-visible tier only; a box's `model:"fast"` request always resolves to GLM-5.3-Flash** under the `gmi` family (env override `GMI_FAST_MODEL` for ops). That is the invariant that keeps subagent spend bounded regardless of what the owner picked.

User-facing story stays in the product's vocabulary: pick family "GMI Cloud", then speed — fast = GLM Flash, balanced = Luna, deep = Astra. No model IDs, no API keys, §2.5a intact.

### 1.1 Changes

1. **Migration `0111_model_family_gmi.sql`**
   - Widen `entitlements_model_family_check` to include `'gmi'`.
   - `alter table entitlements add column if not exists gmi_model text;`
   - (`provider_keys` needs nothing — `'gmi'` is already in its check constraint.)

2. **`lib/entitlements/models.ts`**
   - `ModelFamily` += `"gmi"`; `isModelFamily` updated; `ModelProvider` already includes `"gmi"`.
   - `providerForFamily("gmi")` → `"gmi"` (new branch; minimax entries unchanged).
   - New `GMI_MODELS: CatalogModel[]` — the three slugs above, each tier-tagged, with pricing for metering (GLM-Flash $0.15/$0.50 list; **Astra/Luna on GMI: pull console price before shipping — see §4**).
   - `GMI_TIER_MODELS` map + `defaultGmiModelForTier(tier)`; `modelForSelection("gmi", tier, sel)` → `tier === "fast" ? GMI_TIER_MODELS.fast : (isGmiModel(sel.gmiModel) ? sel.gmiModel : GMI_TIER_MODELS[tier])`.
   - `costUsd` needs the gmi branch to price by *served slug* (GLM vs Astra are 100× apart), like the openrouter/venice catalog lookup — not a flat family rate.
   - `isReasoningModel`: today `/^(gpt-5|o[0-9])/` misses prefixed ids (`openai/gpt-6-astra`, `openai/gpt-5.6-luna` on GMI). **Decision: keep the GMI lane on `/chat/completions`** (probe `POST /responses` on GMI Astra before ever translating — the `include: reasoning.encrypted_content` round-trip is OpenAI-specific). GLM-Flash accepts `reasoning_effort` on chat/completions (verified live: `"low"` collapses `reasoning_tokens` to ~1) — send `reasoning_effort:"low"` for `model:"fast"` requests under the gmi family only, via a `GMI_FAST_EFFORT` env default; never on the parent's tier.

3. **`lib/settings/account.ts`** — `MODEL_FAMILIES` += `"gmi"`; `MODEL_FAMILY_LABELS["gmi"] = "GMI Cloud"`.

4. **`lib/miniapps/apps/settings.tsx`** — a "GMI Cloud model" card mirroring the OpenRouter/Venice cards: `<select>` of `GMI_MODELS`, action `set_gmi_model` → validate `isGmiModel`, write `gmi_model` + `model_family='gmi'`. The GMI provider-key field already exists in the BYOK section.

5. **`lib/miniapps/apps/onboarding.tsx`** — `ONBOARDING_FAMILIES` += `"gmi"` (one button, label "GMI Cloud"). When `snapshot.modelFamily === "gmi"`, render the three-model picker (sets `gmi_model` via a `set_gmi_model` action) — optional per the minimal-diff route, since the tier buttons already choose among the three GMI models implicitly.

6. **Gateway `route.ts`** — `entitlements.select(...)` adds `gmi_model`; `selection.gmiModel` passed through. Provider `case "gmi"`, personal-key path, platform key, and the openai fallback already handle everything else.

7. **Tests** — `provider-models.test.ts` (catalog coverage, family→provider, tier resolution incl. the fast-lane invariant), `models.test.ts` (isModelFamily), `route.test.ts`/`route.create.test.ts` (gmi dispatch + metering + fallback, pin semantics: `model:"fast"` under `gmi` + pinned `gmi_model=astra` still serves GLM to children).

### 1.2 Explicit non-goals

- `create-*` stays OpenAI-only (goal-create-v11 pins it; loosening is a separate decision).
- No Responses-API translation for GMI at launch (§1.1.2 probe first).
- No box/template change: delegation already pins `"fast"`; sync-box needs nothing.

## 2. The Astra→GLM orchestration split

**The ask**: Astra as orchestrator, GLM-5.3-Flash taking actions via subagents — faster and cheaper.

**What the platform already gives us**: the split is a *tier* split, not a topology change. Under `gmi`, parent runs at the owner's tier (Luna/Astra), every delegated child lands on GLM-Flash at $0.15/$0.50 list ($0.075/$0.25 promo through the current Z.ai launch window). Children are already parallel (4-way) and depth-1 — so the "orchestration agent" is a routing policy, not new machinery.

**Where it wins**: agent-suite data shows turns are **prompt-bound** — ~22K input vs ~80–300 output tokens per case. GLM-Flash's input price is 2.7–5× under Luna's, ~65–130× under Astra's; 1M context means a child never truncates. Where it doesn't win: GLM's reasoning is mandatory (effort floored at `low`), so trivial calls still burn reasoning tokens — keep `max_tokens` headroom and force `reasoning_effort:"low"` on the fast lane.

**Phase-2 leverage — shipped in this PR:**

- **Deterministic slash commands.** All three creative commands now plan without a model call: `directCreativePlan` in `lib/creative/router.ts` ships the user's words plus structurally-read params (aspect ratio, duration, attachment role) for `/imagine` and `/animate`, same as `/zap` always did — the renderer expands and screens the prompt itself. Each command skips the Groq compile turn (~1–2s, ~1K tokens per command). The Groq compile (`routeExplicitCommand`) stays exported for callers that want a model-written expansion. `/mini-apps` commands (`/image`, `/todo`, …) were already deterministic — `parseMiniAppCommand` → signed card, zero model.
- **Task-type routing, gateway half.** Under `gmi`, a turn whose opening user message is short and free of depth cues (research/analyze/plan/…) and money-or-publish cues (wire/$/publish/…) resolves to the fast lane — routine work rides GLM-5.3-Flash even when the owner entitled deep+Astra or pinned `gmi_model`. The rule only ever downgrades, so spend stays entitlement-bounded; mid-turn continuations (last message is a tool result) keep the entitled model, so Astra still writes the final synthesis on multi-turn tasks. `GMI_ROUTINE_FAST=off` disables. This is the deterministic half of the box's shadow taskrouter (`infra/template/taskrouter`) ported control-plane-side; per-turn pinning of *continuation* tool turns still needs a consumer inside hermes — the box's router already produces `{tier}` proposals at `127.0.0.1:1917` for that upstream wiring.
- `GMI_BALANCED_MODEL`/`GMI_DEEP_MODEL` env overrides for ops, mirroring `MODEL_FAST`/`MODEL_BALANCED`/`MODEL_DEEP` (already shipped — `gmiTierOverride`).

## 3. Evals

Two tiers:

1. **`evals/model-bench/` (this PR, committed)** — direct provider bench: identical hermes-shaped payloads (short turn, ~20K-token long-context turn, tool-call turn) against OpenAI-direct Luna/Terra (as served today, `/responses` + xhigh) vs GMI Astra/Luna/GLM-Flash; TTFT, total latency, token counts, modeled cost. Plus the orchestration sim: plan + 4 parallel children for `Astra→GLM`, `Luna→Luna`, `Astra→Astra`. Results in `evals/model-bench/report.md`.
2. **`evals/agent-suite` full run (post-merge, needs a live box)** — pin the eval user to `gmi` and rerun the 106-case suite the same way `wzrdmail-m3-gmi` was run; compare against the `wzrdmail-luna` baseline. This is the honest end-to-end answer (skill routing, gating, honesty axes) since bench only measures raw calls.

## 4. Open items before implementation

- **GMI pricing for `openai/gpt-6-astra` and `openai/gpt-5.6-luna` on GMI** — not in the public tables; pull console pricing to finish `GMI_MODELS[].pricing` and the metered `costUsd`.
- **GMI `/responses` support for astra** — probe `POST /responses` + a two-turn reasoning echo before deciding whether the GMI lane ever translates.
- **Spend-cap interplay** — `gmi` meters real USD into `agent_runs`; confirm `monthly_cap_usd` defaults still bound it like the other families.
- **Luna-on-GMI vs Luna-on-OpenAI parity** — same slug; if GMI prices it under OpenAI, `gmi` family `balanced` is also a cost play for existing Luna users.
