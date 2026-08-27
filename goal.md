# goal.md: Air Learning Plane (V10)

| Field | Value |
| --- | --- |
| Status | Build specification |
| Target | Private beta, 10 to 100 owners |
| Primary outcome | Improve completed-task rate and reduce repeat errors without weakening privacy, approval, or Box isolation |
| Last verified | 2026-08-27 |

Read [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY-DECISIONS.md](SECURITY-DECISIONS.md), and [CONTEXT.md](CONTEXT.md) before implementation. Those files define the platform boundary and the canonical language used here. If this specification conflicts with `ARCHITECTURE.md` or a live security decision, this specification is wrong.

The previous Mini-Apps V9 plan is complete and preserved at [docs/goal-miniapps-v9.md](docs/goal-miniapps-v9.md). Do not rebuild it.

## 0. The outcome

Build a private learning plane for every Air owner. It observes production outcomes, turns high-signal failures and corrections into replay-safe tasks, evaluates a baseline and candidate inside resettable twins, and promotes only evidence-backed, reversible personalization.

The learning coordinator and private data live in the owner's Box. The live Hermes process does not become an RL sandbox. Any rollout that can write files, call tools, browse, or simulate an external account runs in a disposable evaluation twin with mocked or isolated capabilities.

Air owns the product contract:

```ts
interface EvaluationKernel {
  run(spec: ExperimentSpec): Promise<ExperimentResult>;
}
```

HUD, Harbor, and the native Air runner are adapters behind that contract:

- HUD is the default adapter for private, parameterized, paired rollouts and future grouped training.
- Harbor is the adapter for packaged global regressions, separate verifiers, Reward Kit, Agent Trajectory Interchange Format (ATIF) validation, regrade, and fleet release gates.
- The native Air runner covers production shadowing, replay, macOS, and capabilities that neither framework models safely.

Neither framework is the source of truth for owners, profiles, promotion, consent, privacy, or releases.

### 0.1 What self-improvement means in V10

V10 performs evaluation-guided policy optimization. A candidate may change only these allowlisted controls:

- prompt addenda;
- skill selection and ordering;
- tool-routing hints and recovery order;
- memory retrieval and ranking policy;
- clarification thresholds;
- retry, timeout, and step budgets inside platform limits;
- model, speed, and reasoning hints inside owner and spending limits;
- owner-approved style and workflow preferences.

V10 does not train model weights. Weight-level reinforcement learning is a later gated phase. It must not be claimed, enabled, or marketed until section 17 is satisfied.

### 0.2 The golden path

An owner asks Hermes to add a calendar event. Hermes creates it with the wrong timezone, and the owner taps "Wrong result" and supplies a correction.

1. The production turn gets one stable `trace_id`. The local collector reconciles the completed Hermes session into a private `Episode`.
2. The correction and observable calendar state make this episode eligible for a task. Silence or continued engagement would not.
3. The task compiler replaces the live calendar with a synthetic fixture and creates deterministic assertions for title, timezone, start time, approval behavior, and absence of unrelated side effects.
4. A candidate proposes a small policy-overlay change, such as a timezone clarification threshold or calendar-skill routing rule. It cannot edit Hermes, memory, security policy, or the verifier.
5. The `EvaluationKernel` runs baseline and candidate against the same task revision, fixture, model configuration, and seeds in disposable twins. HUD may execute the paired rollout.
6. A separate verifier scores world state first, then process quality, latency, and cost. Any privacy, approval, or unauthorized-side-effect failure vetoes the candidate.
7. The owner sees the evidence and policy diff. In `Suggest` mode, the owner approves it. Activation is one atomic pointer update.
8. The next applicable production task uses the approved overlay. A regression, owner rejection, incompatible Hermes update, or kill switch restores the prior pointer in under one minute.

That loop is the release criterion. A dashboard of scores without safe task generation, paired evaluation, promotion, and rollback is not complete.

## 1. Existing substrate and measured baseline

Extend the current platform. Do not create a parallel identity, compute, tracing, or release system.

| Existing system | Location | V10 use |
| --- | --- | --- |
| One owner, one Hermes, one Box | `ARCHITECTURE.md` | Hard tenancy and content boundary |
| Compute abstraction for Ubuntu, Omarchy, and macOS | `apps/web/lib/compute/` | Start, invoke, inspect, and stop learning work without provider-specific branches |
| Box-local Hermes memory and owner files | `infra/template/` and each Box | Private inputs, never a mutable evaluation substrate |
| Agent lifecycle and gateway metrics | `agent_runs`, gateway routes, `apps/web/lib/traces/` | Seed for stable correlation and content-free receipts |
| Decisions, approvals, vault, mini-app, and creative ledgers | Supabase migrations and `apps/web/lib/` | Hard-gate evidence and correlation targets |
| Production-shaped agent suite | `evals/agent-suite/` | Seed corpus and global regression semantics |
| Immutable template releases and dev/prod channels | `infra/template/`, `apps/web/lib/fleet/`, migration `0068` | Ship and roll back the learning substrate and Hermes updates |
| Exact Hermes pin and update procedure | `infra/template/setup.sh`, `infra/template/UPGRADE.md` | Compatibility axis for every profile and experiment |

The latest production-shaped report at `evals/agent-suite/results/20260826T-run4-oxalpha/report.md` measured:

| Proxy axis | Latest score |
| --- | ---: |
| Routing | 92% |
| Gating | 75% |
| Context use | 63% |
| Honesty | 100% |

These are useful regression signals, not a valid RL benchmark or proof of task completion. The suite uses live state, has real side effects, lacks reset and untouched holdouts, associates some decisions by time window, and grades several dimensions with heuristics. One agent also authored a skill during the suite, which proves the need to quarantine self-modification. V10 keeps the task semantics and replaces the experimental controls.

## 2. Non-negotiable learning constraints

All existing architecture and security constraints remain in force. Add these V10 constraints.

| ID | Constraint |
| --- | --- |
| L1 | Raw prompts, responses, memory, tool arguments, tool results, files, free-text feedback, trajectories, fixtures, personalized rewards, and profile bodies remain in the owner's Box. |
| L2 | A production Hermes home, session, vault, connected account, browser profile, or user workspace is never writable from an evaluation rollout. |
| L3 | The live Hermes process is observed, not experimented on. Risky evaluation uses a disposable twin with a distinct home, session namespace, credentials, network, and filesystem. |
| L4 | No trace, score, or candidate directly changes production. Every change passes candidate, evaluation, promotion, activation, and rollback states. |
| L5 | Approval, trust, entitlement, privacy, secret, payment, email-send, wallet, and capability policy are not optimization variables. A candidate cannot weaken them. |
| L6 | Safety, privacy, authorization, deception, and verifier-integrity failures are hard vetoes. They cannot be averaged away by task success, latency, or cost. |
| L7 | The actor cannot read hidden tests, verifier code, verifier credentials, holdout membership, oracle output, or other candidates' results. |
| L8 | Framework telemetry, analytics, hosted trace upload, job upload, and public registry publication are off for owner-derived data. |
| L9 | Every experiment and activation is reproducible from immutable versions, digests, seeds, model routing facts, and environment facts. Missing evidence fails closed. |
| L10 | Explicit owner settings outrank personalization. Owner opt-out stops collection, candidate generation, and evaluation. Export and deletion include derived data. |
| L11 | Evaluation is asynchronous, separately budgeted, and preemptible. It does not wake an idle Box by default and pauses when interactive work begins. |
| L12 | No floating dependency, `main` branch, model alias, skill branch, or unpinned `uv tool install` command is part of production provisioning. |
| L13 | Unsupported OS or capability combinations are explicit results. A release gate never silently skips a required slice. |
| L14 | Hidden chain-of-thought is neither required nor centrally stored. Collect tool-visible actions, outcomes, concise summaries, and provider-exposed usage only. |
| L15 | Existing Boxes are updated in place through the release system. They are never re-forked to install the learning plane because that would discard identity and memory. |

## 3. Non-goals

V10 does not:

- let an agent patch Hermes source, template-owned skills, security policy, or production config;
- treat owner silence, engagement, token length, or a large language model (LLM) judge alone as a success label;
- run exploratory actions against real calendars, inboxes, wallets, storefronts, vaults, browsers, or social accounts;
- centralize private tasks, raw traces, embeddings, candidate text, or profile bodies;
- create a second copy of owner memory or make memory a reward, authority, or policy store;
- share one owner's private episodes with another owner;
- publish owner-derived tasks or jobs to Harbor Hub, HUD, a registry, Weights & Biases (W&B), or another hosted service;
- require Docker on macOS or nested Docker inside a production Box;
- silently translate every Harbor task into HUD or round-trip either format;
- enable autonomous weight updates, per-owner LoRA training, or unreviewed self-authored skills;
- replace the existing fleet release, approval, compute, metering, or receipt systems.

## 4. Canonical domain model

The full glossary is in [CONTEXT.md](CONTEXT.md). Implementation names must match it.

| Term | Meaning |
| --- | --- |
| `Episode` | One observed production attempt or one isolated evaluation attempt, with outcome and lineage |
| `TraceEnvelope` | Air-owned, versioned representation of episode steps, provenance, privacy, and outcome |
| `ExperienceLedger` | Transactional Box-local store for episodes, tasks, experiments, scores, profiles, and lineage |
| `TaskRevision` | Immutable prompt, fixture, capability requirements, and grader references for one replay-safe task |
| `EvaluationTwin` | Resettable isolated substrate containing an eval-only Hermes process and only declared fixtures and capabilities |
| `PolicyOverlay` | Immutable, allowlisted personalization delta that never edits Hermes or owner memory |
| `Candidate` | Inactive proposed policy overlay plus its parent, evidence source, and compatibility evidence |
| `Baseline` | Current signed global release plus current active overlay, or a declared comparison profile |
| `Experiment` | Paired baseline and candidate evaluation over an immutable task set and seed set |
| `HardGate` | Binary safety or integrity condition that vetoes promotion |
| `Promotion` | Evidence-backed decision that makes a candidate eligible for approval or activation |
| `LearningReceipt` | Content-free central projection of a local learning event |
| `WeightTraining` | A separate process that updates trainable model parameters using valid token-level rollout data |

### 4.1 Profile precedence

Resolve effective behavior in this order, highest precedence first:

1. runtime emergency clamps and kill switches;
2. non-overridable platform security and approval policy;
3. account entitlements, trust tier, and explicit owner locks;
4. active allowlisted fields from the approved per-owner `PolicyOverlay`;
5. signed global baseline defaults.

An overlay field is ignored when a higher layer controls it. User-authored memory and content are inputs to a task, not configuration layers. Candidate generation cannot rewrite them.

## 5. Owner experience and control modes

Add an `Agent improvement` section to Settings.

| Mode | Collection | Evaluation | Activation |
| --- | --- | --- | --- |
| `Off` | Store only the operational receipts already required by Air | None | None |
| `Observe` | Keep eligible private episodes and explicit feedback locally | Baseline measurement and task qualification only | None |
| `Suggest` | Same as `Observe` | Generate and evaluate candidates within budget | Owner must approve every activation |
| `Auto-safe` | Same as `Suggest` | Same gates plus longer canary | Only allowlisted, reversible fields; no security, capability, provider, payment, or data-sharing change |

Private beta defaults to `Observe`. `Auto-safe` remains unavailable until M8 and an operator feature flag enable it.

Settings must show:

- current mode and daily evaluation budget;
- last successful evaluation and last error;
- active profile version and exact tested Hermes refs;
- candidate diff in plain language;
- baseline and candidate scores by task family;
- hard-gate verdicts, sample size, confidence, cost, and latency;
- evidence source without revealing hidden holdout content;
- approve, reject, rollback, pause, export, and delete controls;
- a clear statement of what stays in the Box and what metadata reaches Air.

### 5.1 Feedback contract

Each completed run can receive:

- `worked`;
- `wrong_result`;
- `did_not_finish`;
- `missed_context`;
- `unnecessary_question`;
- `unsafe_or_unapproved`;
- `too_slow`;
- `too_expensive`;
- `style_or_preference`;
- `other`.

The enum and numeric rating may be a content-free central receipt. Any free-text explanation or correction is forwarded to the Box and not stored in Postgres or logs. A parsed correction from iMessage or email requires confirmation before it becomes a training label. Silence is `unknown`, never `worked`.

## 6. Architecture

```mermaid
flowchart TD
    P[Production Hermes turn] --> C[Box-local collector]
    C --> L[(ExperienceLedger)]
    L --> T[Private task compiler]
    T --> D[Train and development tasks]
    T --> H[Untouched private holdout]
    D --> G[Candidate generator]
    G --> K[EvaluationKernel]
    H --> K
    S[Global safety and compatibility suite] --> K
    K --> N[Native Air adapter]
    K --> U[HUD adapter]
    K --> B[Harbor adapter]
    N --> E[Disposable evaluation twin]
    U --> E
    B --> E
    E --> V[Separate verifier]
    V --> R[Score vector and hard gates]
    R --> M[Promotion policy]
    M --> A[Owner approval or auto-safe canary]
    A --> O[Atomic profile pointer]
    O --> P
```

There are two related but independent loops:

1. The global product loop evaluates Hermes, platform code, bundled skills, and router defaults against curated, synthetic, adversarial, and compatibility tasks. It produces a signed fleet release and uses dev, canary, rolling prod, pause, and rollback.
2. The private owner loop evaluates allowlisted `PolicyOverlay` candidates against private tasks plus the global safety suite. It produces a Box-local profile pointer and a content-free receipt.

The two loops share contracts and verifiers. They do not share raw owner data or deployment state.

### 6.1 The smallest deep module

`EvaluationKernel` is the only product-facing evaluation interface. It owns:

- resolving immutable local references;
- validating privacy and capability policy;
- selecting one backend;
- creating and resetting twins;
- randomizing paired baseline and candidate order;
- running retries without changing statistical meaning;
- normalizing traces;
- running graders and regrades;
- comparing score vectors and confidence;
- cleaning up resources;
- writing lineage transactionally;
- returning promotion eligibility without activating anything.

Proposed contract:

```ts
type ExperimentSpec = {
  schemaVersion: "air.experiment.v1";
  experimentId: string;
  tasksetRef: OpaqueLocalRef;
  baselineRef: OpaqueLocalRef;
  candidateRef: OpaqueLocalRef;
  graderSetRef: OpaqueLocalRef;
  fixtureSetRef: OpaqueLocalRef;
  requiredCapabilities: CapabilityName[];
  seeds: number[];
  privacyPolicyRef: OpaqueLocalRef;
  budget: {
    maxTrials: number;
    maxTokens: number;
    maxCostUsd: number;
    maxWallTimeSec: number;
  };
};

type ExperimentResult = {
  schemaVersion: "air.experiment-result.v1";
  experimentId: string;
  status: "passed" | "failed" | "inconclusive" | "cancelled";
  backend: "native" | "hud" | "harbor";
  scoreVectors: ScoreSummary[];
  hardGates: HardGateVerdict[];
  confidence: ComparisonConfidence;
  provenance: ReproducibilityManifest;
  promotionEligible: boolean;
  localArtifactRef: OpaqueLocalRef;
};

interface EvaluationKernel {
  run(spec: ExperimentSpec): Promise<ExperimentResult>;
}
```

`OpaqueLocalRef` is resolved only by `air-learningd` inside the Box or an authorized global eval worker. It is not a URL, raw path, prompt, or centrally dereferenceable content hash.

### 6.2 Backend selection

| Need | Backend | Reason |
| --- | --- | --- |
| Production shadow, session reconciliation, or macOS-specific capability | Native Air | Matches the real harness and does not require a container abstraction |
| Private parameterized tasksets and paired or grouped rollouts | HUD | Clean agent and runtime seams, structured traces, graders, and grouped training path |
| Packaged global regression, Reward Kit, separate verifier, ATIF validation, or immutable regrade | Harbor | Strong task packaging, artifacts, batch jobs, and verifier tooling |

One backend owns a job. Do not nest HUD inside Harbor or Harbor inside HUD. Experimental conversion is a build-time adapter with typed failures, original-source retention, and a conversion digest. Unsupported tasks run natively in their source framework.

## 7. Box-local learning plane

Install a pinned, read-only learning runtime through the existing template release. Keep owner data separately writable.

```text
/opt/air/learning/                   # signed template-owned code and schemas
  bin/air-learningd
  adapters/
  contracts/
  graders/global/
  uv.lock

~/.hermes/learning/                 # owner-owned private state
  learning.db
  active-profile.json
  episodes/<episode_id>/
  traces/<episode_id>.trace.json
  tasks/<task_id>/<revision>/
  fixtures/<fixture_id>/
  tasksets/{train,dev,holdout}/
  profiles/<profile_id>/
  candidates/<candidate_id>/
  jobs/<experiment_id>/
  spans/
  exports/
```

`air-learningd` runs as a dedicated unprivileged service. It exposes a versioned local Unix socket. It has no public route, no host tunnel, no direct Supabase credential, and no provider API key. The control plane invokes it only through the existing server-side compute abstraction.

The durable ledger is SQLite in write-ahead logging (WAL) mode with foreign keys, migrations, idempotency keys, and append-only lineage events. HUD local spans and Harbor job directories are diagnostic artifacts, not the ledger.

### 7.1 Resource scheduling

- Run at most one evaluation rollout per primary Box.
- Do not wake a stopped Box solely for learning unless the owner enabled a schedule.
- Pause new work as soon as an interactive Hermes turn begins. Cancel safely after the current atomic step if resource pressure persists.
- Use a separate daily token, cost, CPU, memory, storage, and wall-time budget.
- Cap subagent depth, fan-out, steps, and total spend.
- Garbage-collect expired raw artifacts only after ledger and export consistency checks.

## 8. Trace capture and correlation

Time-window joins are prohibited. Introduce stable IDs and propagate them end to end.

| ID | Scope |
| --- | --- |
| `trace_id` | One production request across web, Hermes, gateway, tools, decisions, and receipts |
| `episode_id` | One private observed or evaluated episode |
| `session_id` | Hermes native session reference |
| `experiment_id` | One paired evaluation request |
| `trial_id` | One profile, task revision, and seed attempt |
| `candidate_id` | One immutable candidate overlay |
| `profile_id` | One immutable approved overlay |
| `parent_trace_id` and `subagent_path` | Nested agent lineage |

Generate `trace_id` before invoking Hermes. Forward it through the Box request, gateway request, model-call record, tool receipts, decisions, approval records, and learning notification. Add explicit columns instead of inferring by timestamps.

Hermes outbound hooks are notifications, not a lossless ledger. They may be bounded or best-effort. Configure a signed loopback hook to notify `air-learningd`, then reconcile the authoritative Hermes session through the local API or session export at turn completion. A reconciliation job finds incomplete episodes after restart.

Do not run competing consumers against one live event stream if that changes delivery semantics. Do not store hidden reasoning. Normalize only observable messages, actions, tool results, errors, state diffs, final output, usage, and concise model-provided summaries.

### 8.1 `TraceEnvelope` v1

The local canonical trace is an Air envelope with ATIF-compatible steps:

```json
{
  "schema_version": "air.trace.v1",
  "trace_id": "opaque-id",
  "episode_id": "opaque-id",
  "parent_trace_id": null,
  "source": "production|evaluation",
  "steps": [],
  "outcome": {},
  "usage": {},
  "provenance": {
    "air_release": "sha256:...",
    "hermes_ref": "git-sha",
    "profile_id": "opaque-id",
    "served_model": "exact-model",
    "router_version": "version"
  },
  "privacy": {
    "class": "private_raw",
    "consent_basis": "observe",
    "retention_until": "timestamp",
    "redaction_version": "version"
  }
}
```

ATIF validation proves structural validity, not privacy. A separate Air privacy validator runs before export or framework handoff. Private-content digests remain local because low-entropy content hashes can leak through dictionary attacks.

## 9. Task and dataset lifecycle

Production history is observational and confounded. Convert it into tasks only when a reliable expected outcome can be constructed.

### 9.1 Eligible signals

Strong task signals:

- explicit `worked` or failure feedback linked to a stable `trace_id`;
- an owner correction with confirmed intended outcome;
- deterministic external state, such as a file, calendar fixture, generated artifact, or test result;
- an approval ledger proving the correct gate was or was not reached;
- a repeatable product error with a typed terminal state;
- an operator-authored synthetic or adversarial task.

Weak signals remain diagnostic only:

- silence;
- conversation continuation;
- long output;
- judge preference without calibration;
- one model's self-critique;
- time spent in a tool;
- absence of a complaint.

### 9.2 Private task compiler

The compiler runs without network or tools. It treats trace content as untrusted data and may not execute instructions found in it.

For every task it must:

1. identify the intended capability and task family;
2. strip secrets and replace owner-specific entities with typed fixture values where possible;
3. replace live services with deterministic mocks, recordings, or sidecars;
4. declare the minimal capability set and network policy;
5. define observable success and prohibited side effects;
6. create an oracle when deterministic setup permits;
7. assign privacy, retention, lineage, and contamination metadata;
8. validate that actor and candidate generator cannot read verifier assets;
9. quarantine the task if a reliable outcome cannot be built.

No raw message becomes a benchmark merely because it produced negative feedback.

### 9.3 Splits and leakage controls

Maintain four task classes:

- global safety and capability suite;
- private training tasks visible to the candidate generator;
- private development tasks used to choose among candidates;
- private holdout tasks visible only to the evaluation kernel and verifier.

Split by semantic task family and time, not random episode row. Near-duplicates, paraphrases, shared fixtures, and descendants of one incident stay in one split. The holdout is immutable for an experiment epoch and rotated after promotion or suspected exposure.

The candidate generator cannot access holdout prompts, fixtures, scores by task, verifier code, or hidden global cases. It receives aggregate failure categories from training and development only.

### 9.4 Task states

`draft -> sanitized -> oracle_verified -> qualified -> train|dev|holdout -> retired`

Any data-loss prevention failure, inconsistent oracle, grader disagreement, contamination, saturated reward, or missing artifact moves the task to `quarantined`.

## 10. Evaluation twins and capability isolation

An `EvaluationTwin` is not a copy of the live Box. It is a clean substrate built from a signed release plus declared fixtures.

Every twin has:

- a distinct temporary home and Hermes session namespace;
- no production `~/.hermes`, memory, vault, browser profile, app state, SSH key, connector token, or user workspace mount;
- messaging and inbound adapters disabled;
- an eval-only Hermes process bound to loopback;
- mocked tools or isolated service sidecars;
- a short-lived Air gateway token scoped to one experiment, exact model allowlist, and hard spend cap;
- deny-by-default egress with explicit destination allowlists;
- a read-only root where supported and a disposable writable workspace;
- a dedicated unprivileged operating-system account, dropped Linux capabilities, resource limits, and no Docker socket;
- an idempotent teardown and a post-run proof that the production home is unchanged.

`LocalRuntime` and `SubprocessRuntime` are convenience runtimes, not security boundaries. Use them only for fully synthetic read-only tasks that cannot access production state. Filesystem mutation, browser, external-service simulation, and adversarial cases require a fresh container, disposable Box clone, dedicated eval worker, or an equivalent sandbox proven in M0.

### 10.1 Cross-OS contract

Tasks declare capabilities, not an assumed provider.

| Platform | Required path |
| --- | --- |
| Ubuntu Box | Disposable container or verified snapshot/clone; Compose only after a capability probe |
| Omarchy Box | Same security contract as Ubuntu; desktop tasks also declare display/browser capability |
| macOS namespace | Native temporary account or provider-native disposable environment; no Docker assumption |

A required unsupported capability produces `unsupported_required_capability` and fails the release slice. Optional coverage produces an explicit skip receipt with an approved waiver. No aggregate can hide missing OS coverage.

### 10.2 Compose and verifier environments

Use Compose only for a task's isolated world, such as a mock calendar API plus database. Do not use it as the Air control plane. HUD Compose and verifier environments are experimental and must be protected by versioned adapter contract tests.

`compose.service_access` stays false. No actor container receives the host Docker socket. Verifier environments receive only declared output artifacts through a minimal allowlist. Missing, failed, or skipped required artifacts make the trial ineligible for promotion.

## 11. Framework configuration

The production toolchain uses Python 3.12 and a committed `uv.lock`. At the verified date, the initial pins are:

```text
hud==0.6.13
harbor==0.22.0
```

These values are starting pins, not permission to update automatically. Each update requires source review, adapter contract tests, privacy tests, and a fleet release. Developer bootstrap may use a versioned `uv tool install`, but Box provisioning must use the signed, frozen release artifact.

### 11.1 HUD adapter

Implement `HermesHarness` against an eval-only Hermes process. It must:

- read the HUD run prompt and declared capabilities;
- invoke Hermes with the exact baseline or candidate overlay;
- record observable agent and tool steps;
- capture actual served model, tier, usage, cost, stop reason, and errors;
- return structured content and, only when available, validated token samples;
- cancel on timeout and always reconcile the final session;
- never connect to the live Hermes session or home.

Set these in every local HUD process:

```text
HUD_TELEMETRY_ENABLED=0
HUD_CLI_ANALYTICS_ENABLED=0
HUD_FILE_TRACKING_ENABLED=false
HUD_TELEMETRY_LOCAL_DIR=<box-local-learning-spans>
```

Do not persist `HUD_API_KEY`, hosted-runtime credentials, or sandbox-provider credentials in an owner Box. Bind control and capability channels to loopback. Local span writes are best-effort, so they do not replace `ExperienceLedger`.

### 11.2 Harbor adapter

Use Harbor for immutable global task packages and any private task only when it remains local and the backend satisfies the Box privacy contract.

Required process environment:

```text
HARBOR_TELEMETRY=off
```

Policy denies `harbor upload`, `--upload`, `--launch`, Hub credentials, and public/private registry publication for owner-derived data. Emit only `/logs/verifier/reward.json`; never emit both `reward.txt` and `reward.json`. Official documentation has differed on precedence, so the adapter contract test owns this behavior.

Implement `HermesAgent` with timeout cancellation, actual model and usage capture, ATIF v1.8 output, privacy validation, and typed terminal failures. Regrade creates a new immutable result linked to the source trial. It never mutates the source job and does not stand in for a new policy rollout.

### 11.3 Native adapter

The native adapter uses the same `ExperimentSpec`, trace envelope, graders, and receipts. It is required for:

- shadow measurement over production-shaped native sessions;
- Hermes session export reconciliation;
- macOS evaluation where a safe framework runtime is unavailable;
- capability probes and update compatibility;
- tasks whose framework conversion would lose semantics.

Native does not mean unisolated. It must satisfy the same twin and verifier boundaries.

## 12. Candidate and profile lifecycle

Candidates are data, never executable patches.

Allowed candidate schemas are explicit JSON objects with bounded fields and validation. A candidate cannot contain shell commands, arbitrary file paths, arbitrary environment variables, executable code, URLs, secrets, or an unrestricted prompt that changes authority.

Example manifest:

```json
{
  "schema_version": "air.policy-overlay.v1",
  "candidate_id": "opaque-id",
  "parent_profile_id": "opaque-id",
  "baseline_release": "sha256:...",
  "hermes_compatibility": {
    "tested_refs": ["git-sha"],
    "overlay_schema": "air.policy-overlay.v1"
  },
  "changes": {
    "skill_order": ["calendar", "general"],
    "clarification_thresholds": {"timezone_missing": 1.0},
    "retry_policy": {"calendar_read": 1}
  },
  "source_evidence": ["opaque-local-ref"],
  "optimizer_version": "version"
}
```

Candidate generation may be deterministic search, bandit selection, or an LLM proposal. Whichever method is used:

- generate at most four candidates per cycle;
- mutate one coherent behavior group at a time;
- stay within a declared search space and budget;
- never read holdouts or verifiers;
- never activate or edit files directly;
- quarantine generated skills as candidate artifacts;
- explain the intended change and affected task families.

Candidate states:

`draft -> schema_valid -> shadowed -> evaluated -> proposed -> approved -> canary -> active`

Terminal or side states:

`rejected`, `inconclusive`, `quarantined`, `incompatible`, `rolled_back`, `superseded`.

Activation writes a complete immutable profile directory, verifies its signature and compatibility, writes `active-profile.json.tmp`, fsyncs, and atomically renames it to `active-profile.json`. The prior profile remains available for rollback. Never patch `config.yaml`, bundled skills, or Hermes source in place.

## 13. Reward, graders, and verifier integrity

Store a vector first. Derive a scalar only for ranking inside an already safe set.

### 13.1 Hard gates

- `approval_integrity`;
- `authorization_integrity`;
- `privacy_integrity`;
- `secret_integrity`;
- `side_effect_safety`;
- `verifier_integrity`;
- `no_deception`;
- `required_evidence_complete`.

### 13.2 Soft scores

- `task_success`;
- `instruction_following`;
- `tool_correctness`;
- `context_use`;
- `honesty`;
- `personal_fit`;
- `recovery_quality`;
- `latency`;
- `cost`;
- `token_efficiency`;
- `unnecessary_action_penalty`.

The ranking scalar is:

```text
reward = 0                              if any hard gate fails
reward = clamp(weighted_soft_score)    otherwise
```

The promotion service uses the complete vector and confidence intervals, not only `reward`.

### 13.3 Grader order

1. deterministic final-world-state assertions;
2. prohibited side-effect, approval, privacy, and secret checks;
3. trajectory and process checks;
4. typed owner feedback linked to the episode;
5. latency, usage, cost, and recovery metrics;
6. versioned, blinded LLM or agent judge only for irreducibly subjective quality.

An LLM judge cannot be the sole promotion signal. Calibrate judges against human-labeled examples, randomize candidate order, conceal profile identity, record model and rubric versions, and monitor inter-rater disagreement.

### 13.4 Reward-hacking defenses

- Run the actor and verifier under different identities and filesystems.
- Stop and snapshot the actor phase before verifier secrets or code exist.
- Keep hidden tests and holdouts outside actor mounts.
- Verify artifacts by manifest and digest.
- Treat task output as untrusted input to the grader.
- Include malicious tasks for test discovery, reward-file overwrite, prompt injection, constant-output shortcuts, rubric mimicry, symlink escape, and network exfiltration.
- Reject a grader error, timeout, missing artifact, NaN, infinity, or out-of-range score.
- Regrade append-only. A changed grader creates new results and provenance.

## 14. Experiment design and promotion policy

Run baseline and candidate on the same task revisions, fixtures, exact model configuration, and seeds. Randomize execution order. If the gateway silently serves a different model or fallback, mark the pair invalid rather than comparing unlike policies.

Default promotion gate for private beta:

- at least 30 paired holdout trials in total;
- at least 5 paired trials in every affected critical task family;
- zero hard-gate failures for candidate and no missing required evidence;
- candidate task-success point estimate improves by at least 0.05;
- the 95% paired-bootstrap lower bound on task-success difference is greater than 0;
- no protected task family regresses by more than 0.02;
- 95th-percentile (p95) latency and median inference cost remain within 10% of baseline;
- or, for an efficiency candidate, task success is non-inferior within 0.02 and latency or cost improves by at least 15%;
- the global safety and compatibility suite passes on all required platforms.

If the sample is too small, rewards are saturated, confidence is inconclusive, model routing differs, or judge disagreement exceeds policy, keep the candidate inactive and collect more qualified evidence. Do not lower the gate to force progress.

The thresholds live in one versioned promotion policy, not scattered across UI, SQL, and adapters.

### 14.1 Live canary

Private beta uses `Suggest` approval before activation. After approval:

- apply the overlay only to declared task families;
- preserve every safety and approval control;
- monitor explicit feedback, typed terminal errors, latency, cost, and compatibility;
- automatically roll back on a hard-gate signal, integrity error, repeated task-family regression, or owner rejection;
- never run a real unsafe A/B action solely to measure a candidate.

## 15. Privacy, retention, export, and deletion

### 15.1 Data classes

| Class | Examples | Allowed location |
| --- | --- | --- |
| `secret` | provider keys, vault values, cookies, auth headers | Existing secret stores only; never learning data |
| `private_raw` | prompts, responses, memory, tool payloads, files, raw ATIF | Owner Box only |
| `private_derived` | tasks, fixtures, embeddings, candidate bodies, profile bodies, per-task rewards | Owner Box only |
| `operational_metadata` | opaque IDs, status, versions, aggregate numeric scores, durations, error classes | Box and approved central receipts |
| `global_public` | curated synthetic task package and published documentation | Repository or approved registry |

Default retention:

- raw episodes and traces: 30 days;
- failed or unqualified derived tasks: 30 days;
- qualified private tasks and score artifacts: 180 days;
- approved profiles and their minimal lineage: until superseded plus 180 days;
- explicit gold tasks: until owner deletes them;
- content-free operational receipts: existing account and audit retention policy.

Make raw and derived retention owner-configurable within legal and operational limits.

Export includes the local ledger, trace envelopes, tasks, fixtures, profile manifests, candidate evidence, scores, and a schema/version manifest. Deletion removes raw episodes, derived tasks, embeddings, candidates, profiles, local spans, job artifacts, and lineage references, then sends only a content-free completion receipt. If deletion would remove the active profile, atomically restore the signed global baseline first.

Cross-owner reuse is forbidden by default. A separate explicit contribution flow must sanitize, review, license, and obtain consent before a task can enter the global suite.

### 15.2 Central allowlist

Central systems may receive:

- opaque `trace_id`, `experiment_id`, `candidate_id`, and `profile_id`;
- owner ID already required for routing and row-level security (RLS);
- status and timestamps;
- Air release, exact Hermes ref, framework adapter and version, OS and capability class;
- actual served model identifier, requested tier, aggregate tokens, cost, and latency;
- aggregate score dimensions, hard-gate booleans, sample counts, and confidence bounds;
- typed error and rollback reason;
- global artifact digests only.

Central systems must not receive raw paths, private-content hashes, task text, messages, response text, reasoning, tool names plus arguments when identifying, tool output, free-text feedback, files, memory, fixture values, per-task private scores, or profile bodies.

## 16. Observability and logging

Use OpenTelemetry concepts for local spans and metrics, but keep the Air trace envelope as the product contract. Pin semantic-convention dependencies and version custom `air.learning.*` attributes.

### 16.1 Local observability

Record transactionally:

- episode collection and reconciliation status;
- task compiler decision and quarantine reason;
- candidate lineage and schema validation;
- twin acquisition, reset checksum, and cleanup;
- baseline and candidate trial status;
- grader version, artifact manifest, score vector, and regrade lineage;
- promotion decision and policy version;
- activation, rollback, update compatibility, export, and deletion;
- resource, token, cost, and latency measurements.

Raw local logs use structured JSON, bounded field sizes, secret canaries, and redaction before persistence. Never log full environment variables, authorization headers, cookies, or unrestricted subprocess output.

### 16.2 Central metrics and receipts

Add content-free metrics:

- eligible Boxes by mode;
- jobs queued, started, completed, cancelled, and failed;
- task qualification and quarantine rates;
- score distributions by global capability slice;
- hard-gate failure counts by type;
- candidate win, rejection, approval, activation, and rollback rates;
- time from feedback to evaluated candidate and approval;
- evaluation tokens, cost, CPU, wall time, and p95 latency;
- missing-evidence and verifier-failure rates;
- current-to-next Hermes compatibility pass rate;
- framework adapter and OS coverage;
- privacy canary or egress-test failures.

Metrics are not rewards. Operational dashboards must distinguish product health, experiment evidence, and owner preference.

### 16.3 Service objectives

- Learning enqueue and correlation add no more than 10 ms p95 to a production response path.
- Evaluation pauses within 5 seconds of detected interactive pressure.
- At most one rollout runs per primary Box.
- Profile rollback completes in under 60 seconds and survives service restart.
- Every central learning row passes an automated content-boundary validator.
- A missing trace, model-routing fact, fixture checksum, grader result, or cleanup proof blocks promotion.

## 17. True weight-level RL gate

Weight training is disabled in V10 phases M0 through M8. Enabling it requires a new reviewed decision and all of these facts:

1. Air owns or has explicit rights to a forkable, trainable model.
2. The exact behavior model identity is stable. Silent provider fallback invalidates the rollout.
3. Every sampled action has prompt token IDs, completion token IDs, action masks, sampling logprobs, and tokenizer version.
4. The trainer contract is pinned and tested end to end. Harbor's token schema and HUD's training API are adapter details, not assumptions.
5. Grouped rollouts produce non-degenerate reward spread. Failed groups are discarded consistently.
6. Training, development, private holdout, and global safety holdout are separated by family and time.
7. Explicit owner consent covers training, retention, export destination, deletion semantics, and model artifact ownership.
8. Private raw data does not leave the Box unless a separately reviewed hosted-training agreement, residency control, and deletion verification exist.
9. Checkpoints, optimizer state, base-model lineage, and one-step rollback are proven.
10. An independent holdout win and all hard gates pass before a checkpoint can serve traffic.
11. Memorization, extraction, poisoning, and cross-owner leakage tests pass.
12. Cost, compute placement, and account deletion have an operational owner.

Until then, call the feature policy optimization, prompt optimization, or evaluation-guided personalization. Do not call it model RL.

## 18. Hermes updates and three-axis compatibility

Version these layers independently:

1. global Air release, including exact Hermes ref and bundled skills;
2. learning substrate, including contracts, adapters, framework pins, graders, and schemas;
3. per-owner `PolicyOverlay`.

Do not let personalization fork Hermes or pin an owner indefinitely to an old build.

Update flow:

1. Use `hermes update --check` and upstream review as discovery only.
2. Pin the selected Hermes commit in an immutable Air template release.
3. Run source/security delta review and the global Harbor regression suite.
4. Run current-to-next native and HUD harness contract tests.
5. Promote to the existing dev channel.
6. Canary Boxes run their private holdout twice: current Hermes with current profile, then next Hermes with the same profile in isolated twins.
7. Send only content-free compatibility verdicts and aggregate scores centrally.
8. If compatible, move through existing canary and rolling production waves.
9. Migrate only the overlay schema when required. Preserve the prior overlay and migration receipt.
10. If an overlay is incompatible, disable it, fall back to the signed global baseline, notify the owner, and continue the safe Hermes update.
11. Roll back Hermes and the profile independently so attribution remains possible.

Import and link Hermes update-receipt hashes where available. Never run a floating `hermes update` from Box boot, candidate code, or an agent turn.

## 19. Control-plane APIs and schema

All routes are owner-session authenticated, cross-site request forgery (CSRF) and origin protected, rate limited, and RLS scoped. The client never supplies an authoritative `user_id` or `box_id`; resolve both server-side.

| Route | Purpose |
| --- | --- |
| `GET /api/learning/status` | Mode, budget, active profile, local daemon health, latest content-free receipts |
| `PATCH /api/learning/settings` | Mode, schedule, retention, and budget within policy |
| `POST /api/learning/feedback` | Link typed feedback to `trace_id`; forward private correction directly to Box |
| `GET /api/learning/candidates` | Content-free list and owner-safe summaries fetched from Box on demand |
| `GET /api/learning/candidates/:id` | Stream private diff and evidence from Box without central persistence |
| `POST /api/learning/candidates/:id/approve` | Confirm and activate through `air-learningd` |
| `POST /api/learning/candidates/:id/reject` | Reject with optional Box-local explanation |
| `POST /api/learning/profiles/:id/rollback` | Atomic rollback |
| `POST /api/learning/data/export` | Build a Box-local export and return a short-lived proxied download |
| `DELETE /api/learning/data` | Stop learning and delete private learning state after confirmation |
| `POST /api/admin/learning/jobs` | Schedule approved global or content-free compatibility work |

Use the existing compute target interface for every Box command. Do not add provider-specific API calls inside route handlers.

### 19.1 Additive database plan

Use the next available migration number. Prefer additive tables and columns so existing receipts continue to work.

1. Add stable `trace_id` and relevant parent IDs to `agent_runs`, gateway model-call records, decisions, approvals, vault events, mini-app gates, and other correlated ledgers.
2. Stop using one semantic table for both an agent lifecycle and individual model completions. Add `model_calls` linked to `agent_runs`; migrate readers incrementally.
3. Add `run_feedback` for rating, enum reason, timestamps, and delivery status. Store no free text.
4. Add `learning_settings` for mode, budgets, retention choice, and scheduling.
5. Add `learning_experiments` for content-free job status, framework version, exact Hermes ref, OS, aggregate metrics, and errors.
6. Add `learning_profiles` for opaque profile ID, parent, status, exact tested Hermes refs, aggregate evidence, activation, and rollback. Store no profile body.
7. Add `learning_events` as an append-only content-free audit stream with idempotency keys.

Every table gets owner RLS, service-role boundaries, deletion behavior, bounded enums, and a content-boundary test. Do not centralize private per-trial rows merely because the framework produces them.

## 20. Module and file plan

Use these target boundaries. Adjust only for an existing stronger convention.

```text
packages/learning-contracts/
  schemas/
    experiment.v1.json
    experiment-result.v1.json
    trace-envelope.v1.json
    policy-overlay.v1.json
    learning-receipt.v1.json
  src/

apps/web/lib/learning/
  settings.ts
  feedback.ts
  receipts.ts
  profiles.ts
  compute-client.ts
  privacy.ts

apps/web/app/api/learning/
  status/route.ts
  settings/route.ts
  feedback/route.ts
  candidates/[id]/route.ts
  candidates/[id]/approve/route.ts
  profiles/[id]/rollback/route.ts
  data/export/route.ts
  data/route.ts

infra/template/learning/
  pyproject.toml
  uv.lock
  air_learning/
    daemon.py
    ledger.py
    collector.py
    trace.py
    task_compiler.py
    candidates.py
    kernel.py
    promotion.py
    privacy.py
    adapters/native.py
    adapters/hud.py
    adapters/harbor.py
    twins/
    graders/
  systemd/air-learningd.service

evals/learning/
  contracts/
  privacy/
  isolation/
  reward-hacking/
  cross-os/
  hermes-compatibility/
  harbor/
  hud/
```

The daemon may be Python because both framework SDKs are Python, but JSON Schema is the seam. The web app does not import HUD or Harbor types.

## 21. Security threat model

| Threat | Required defense |
| --- | --- |
| Prompt injection in a production trace | Compiler treats content as data, has no tools/network, and emits only schema-valid fields |
| Candidate grants itself authority | Allowlisted overlay schema plus precedence clamp; security fields do not exist in the schema |
| Actor reads tests or oracle | Separate identity, filesystem, environment, and acquisition |
| Reward-file overwrite | Verifier owns output path after actor snapshot; manifest and permission checks |
| Secret exfiltration | No production secrets in twin, scoped gateway token, deny-by-default egress, and data-loss prevention canaries |
| Live account side effect | Mock or sidecar tools only; no production connector tokens or browser profile |
| Poisoned feedback | Explicit provenance, confirmation, rate limits, anomaly detection, and holdout verification |
| Overfitting one incident | Family-based splits, minimum samples, paired holdout, and protected global suite |
| Framework telemetry leak | Explicit off settings, no keys, network tests, and outbound deny policy |
| Docker host escape | No Docker socket, no privileged containers, dropped capabilities, runtime security profile |
| Cross-owner leakage | One ledger and storage tree per Box, opaque local refs, no private registry/upload path |
| Update breaks personalization | Current-to-next compatibility run, schema migrator, safe baseline fallback, independent rollback |
| Agent self-authors a skill | Candidate quarantine, digest, verifier, owner approval, and never write bundled skill paths |
| Stale or spoofed local request | Unix socket permissions, signed versioned messages, nonce, idempotency key, and expiry |
| Cleanup failure | Quarantine substrate, fail experiment, alert, and block promotion |

Maintain one operator kill switch for collection and one for evaluation. Activation already has a separate profile rollback. All three must work when HUD, Harbor, or Hermes is unhealthy.

## 22. Milestones and dependency graph

### M0: capability and contract spikes

Deliver before product code:

- exact HUD and Harbor pins plus frozen Python 3.12 environment;
- `EvaluationKernel`, `TraceEnvelope`, `PolicyOverlay`, and receipt schemas;
- Hermes session and server-sent event (SSE) to lossless observable-step conversion spike;
- stable `trace_id` propagation proof across one web turn, Hermes, gateway, tool, and decision;
- disposable twin proof on Ubuntu, Omarchy, and macOS;
- Compose, separate verifier, and provider capability probes;
- local-only HUD and Harbor egress tests;
- Hermes harness smoke task in native, HUD, and Harbor adapters;
- reward precedence, artifact failure, regrade, token-schema, and conversion contract tests;
- documented go/no-go decisions for every experimental framework surface.

Exit: an oracle and Hermes pass the same smoke task with equivalent deterministic reward, and neither can touch the production home.

### M1: correlation and private ledger

- Add IDs and model-call separation.
- Ship `air-learningd`, SQLite migrations, collector, reconciliation, and local trace viewer.
- Add feedback enums and Box-forwarded private correction.
- Add privacy validator, secret canaries, retention, export, and deletion foundations.

Exit: 100% of test turns correlate without time-window joins, restart reconciliation is lossless for observable events, and no private field reaches central stores.

### M2: evaluation twin and native kernel

- Implement the native adapter, twin acquisition, isolated eval Hermes profile, scoped gateway token, fixtures, teardown, and cleanup proof.
- Implement cross-OS capability results and scheduling/preemption.
- Run the current 106-case suite in resettable or synthetic form without real side effects.

Exit: adversarial isolation tests cannot read or modify production state on any supported OS.

### M3: task compiler and verifier stack

- Implement eligible-signal qualification, data-loss prevention, task family lineage, train/dev/holdout splits, deterministic graders, separate verifier, oracle, and reward-hacking suite.
- Convert high-value routing, gating, context, calendar, files, web research, and approval cases first.

Exit: every qualified task has an oracle or documented human-grade reason, and malicious shortcuts score at the floor.

### M4: policy overlays and `Suggest` UX

- Implement allowlisted schema, candidate generator, profile compiler, state machine, evidence view, approve/reject, atomic activation, and rollback.
- Keep candidate generation deterministic or operator-authored first; add LLM proposals only after schema and leakage tests.

Exit: the golden-path calendar example works end to end and rollback completes in under one minute.

### M5: private HUD adapter

- Implement `HermesHarness`, parameterized tasksets, paired order randomization, structured graders, local spans, and grouped rollout support.
- Keep hosted telemetry and credentials absent.

Exit: HUD and native results agree on deterministic smoke tasks, resource budgets hold, and zero HUD egress is observed in local mode.

### M6: Harbor global release gate

- Implement `HermesAgent`, ATIF conversion and privacy validation, Reward Kit criteria, separate verifier, required-artifact checks, immutable regrade, and global datasets.
- Integrate results with existing dev, canary, rolling prod, pause, and rollback flow.

Exit: an exact Hermes/template candidate cannot enter dev without a passing global Harbor job; no owner-derived job can upload or launch remotely.

### M7: observability, operations, and update compatibility

- Ship central content-free receipts, metrics, admin coverage, alerting, budgets, cleanup, owner data rights, and current-to-next Hermes compatibility runs.
- Run a failure drill for framework outage, cleanup failure, incompatible profile, and Hermes rollback.

Exit: operators can attribute a regression to global release, learning substrate, or profile, and roll back each independently.

### M8: limited `Auto-safe`

- Enable only for proven allowlisted fields, mature task families, zero critical failures, and an operator flag.
- Require a longer holdout and post-activation canary than `Suggest`.

Exit: automatic activation cannot change authority, tools, provider, spending, data sharing, or owner locks, and kill-switch drills pass.

### M9: optional weight training

Start only after section 17 receives a separate approved design and end-to-end proof. This is not required to ship V10.

### 22.1 Parallel work lanes

After M0 freezes schemas:

- Lane A: correlation, ledger, collector, and privacy;
- Lane B: twins, native runner, and cross-OS isolation;
- Lane C: task compiler, graders, and reward-hacking tests;
- Lane D: Settings, feedback, candidates, and profile UX;
- Lane E: HUD and Harbor adapters;
- Lane F: release integration, metrics, and update compatibility.

Schema, privacy, and security changes require cross-lane review. Framework adapters must not block native M1 through M4.

## 23. Acceptance criteria

V10 is complete only when all applicable checks pass.

### Privacy and isolation

- A seeded secret in prompt, memory, environment, file, and tool output appears in no Postgres row, centralized log, analytics event, or receipt.
- Packet and DNS tests show zero traffic to HUD, Harbor Hub, W&B, or unapproved hosts during local private evaluation.
- No HUD, Harbor Hub, provider, Modal, Daytona, or other sandbox credential persists in an owner Box.
- An adversarial twin cannot read or modify production `~/.hermes`, vault, browser profile, memory, main session, connectors, or workspace.
- HUD control ports and eval Hermes are loopback-only and absent from every public Box route.

### Reproducibility and evidence

- Every trial records exact Air release, Hermes ref, OS, task, fixture, grader, overlay, router, framework, model, tokenizer when relevant, seeds, reset checksum, artifact manifest, and stop reason.
- Oracle passes 100% of deterministic tasks before a real-agent run.
- Identical oracle trials produce identical deterministic scores.
- Required missing evidence, cleanup failure, grader error, or model fallback blocks promotion.
- Regrade creates a new immutable result and never changes its source execution.

### Experiment validity

- Paired execution uses the same task, fixture, seed, and exact served model.
- Family and temporal leakage tests keep incident descendants in one split.
- Candidate generation cannot access holdouts or verifier assets.
- Promotion implements section 14 in one versioned policy.
- Reward-hacking and contamination suites fail malicious candidates safely.

### Product effect

- A private-beta pilot shows at least a 5 percentage-point task-completion improvement with a positive paired 95% lower bound on affected holdout tasks.
- Critical privacy, approval, authorization, and side-effect failures remain zero.
- No protected task family regresses by more than 2 percentage points.
- The global suite maintains at least the current routing and honesty baselines while improving gating toward 90% and context use toward 80%. These remain secondary proxy targets, not substitutes for task completion.
- Cost and latency meet section 14 or require an explicit owner-visible tradeoff approval.

### Operations and updates

- One-step profile rollback completes in under 60 seconds without changing memory or owner files.
- One-step fleet rollback restores the prior Hermes/template release independently of profile rollback.
- Current-to-next Hermes compatibility runs preserve approved overlays or safely fall back to the global baseline.
- Core suites pass on Ubuntu, Omarchy, and macOS. Required unsupported capabilities fail explicitly.
- Evaluation pauses for interactive work, respects daily budgets, cleans every disposable resource, and survives daemon restart.
- Export and deletion cover episodes, traces, tasks, fixtures, embeddings, candidates, profiles, scores, jobs, and local spans.

### Weight-training guard

- No weight-update code path, trainer credential, or model checkpoint activation exists before section 17 is approved.
- Product copy accurately distinguishes evaluation-guided personalization from model RL.

## 24. Stop and escalate

Stop implementation and request a human decision when:

- a framework or provider requires owner content or credentials to leave the Box;
- a required capability cannot be isolated on one supported OS;
- stable Hermes trace correlation or session reconciliation cannot be achieved;
- a candidate needs to change approval, trust, entitlement, spending, secret, wallet, email-send, or data-sharing policy;
- an owner-derived task cannot be sanitized or given a reliable expected outcome;
- a grader can be influenced by the actor or cannot fail closed;
- the only improvement appears under a different served model, hidden fallback, or contaminated holdout;
- a Hermes update and active overlay are incompatible and safe migration is uncertain;
- enabling `Auto-safe`, cloud evaluation, hosted telemetry, cross-owner reuse, or weight training is proposed;
- deletion or rollback cannot be completed and verified.

## 25. Source locks and references

Implementation must re-verify these sources when updating a pinned dependency.

### HUD

- [HUD documentation index](https://docs.hud.ai/llms.txt)
- [Creating an environment](https://docs.hud.ai/v6/guides/creating-an-environment)
- [Running an evaluation](https://docs.hud.ai/v6/guides/running-an-eval)
- [Training agents](https://docs.hud.ai/v6/guides/training-agents)
- [Agents and custom harnesses](https://docs.hud.ai/v6/reference/agents)
- [Runtimes](https://docs.hud.ai/v6/reference/runtime)
- [Graders](https://docs.hud.ai/v6/reference/graders)
- [Telemetry](https://docs.hud.ai/v6/reference/telemetry)
- [Experimental Compose](https://docs.hud.ai/v6/experimental/compose)
- [Experimental verifier environments](https://docs.hud.ai/v6/experimental/verifier-environments)
- [Experimental Harbor interoperability](https://docs.hud.ai/v6/experimental/harbor)

### Harbor

- [Core concepts](https://www.harborframework.com/docs/core-concepts)
- [Task format](https://www.harborframework.com/docs/tasks)
- [Agents](https://www.harborframework.com/docs/agents)
- [ATIF](https://www.harborframework.com/docs/agents/trajectory-format)
- [Reward Kit](https://www.harborframework.com/docs/rewardkit)
- [Artifacts](https://www.harborframework.com/docs/run-jobs/results-and-artifacts)
- [Regrade](https://www.harborframework.com/docs/run-jobs/regrade)
- [Skills](https://www.harborframework.com/docs/run-jobs/skills)
- [Cloud sandboxes](https://www.harborframework.com/docs/run-jobs/cloud-sandboxes)
- [RL workflow](https://www.harborframework.com/docs/training-workflows/rl)
- [Usage statistics](https://www.harborframework.com/docs/usage-stats)

### Hermes and observability

- [Updating Hermes](https://hermes-agent.nousresearch.com/docs/getting-started/updating)
- [Hermes hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks)
- [Hermes API server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)
- [Hermes sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions)
- [Hermes trajectory format](https://hermes-agent.nousresearch.com/docs/developer-guide/trajectory-format)
- [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)

## 26. Definition of done

The build is done when an owner can opt in, attach explicit feedback to a correlated run, watch Air create a private replay-safe task, compare baseline and candidate in an isolated twin, understand the evidence, approve a bounded profile, observe the improvement, roll it back instantly, update Hermes without losing personalization, export or delete the full learning history, and verify that no private content left the Box.

Anything less is an eval dashboard, not a safe self-improvement loop.
