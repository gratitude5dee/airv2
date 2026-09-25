/**
 * Create eval runner — the §0.2 golden paths against a real Box.
 *
 * Each case is one owner turn in the `air-create-<appname>` session: POST
 * /api/create/turn on the mini origin, follow GET /api/create/events/<runId>
 * to terminal, then read GET /api/create/status?app=<appname> (draft
 * version, findings, QA score, budget meter, and since V12 the intake stage,
 * the dev release and the test counts) plus GET /api/create/intake?app= (the
 * question / revision counters) for what the turn left behind. Cases run in
 * file order and share workspaces on purpose:
 *
 *   C01–C04  MC4 Vibe: scaffold, two iterations, a `create_budget` refusal,
 *            all on `countdown`.
 *   C20–C30  V12 §19: intake → plan → confirm → dev → finalize on `tour26`
 *            (C20 leaves a second, ambiguous intake at `asking`), the two
 *            GitHub-URL paths, a spent budget, and the non-owner sender —
 *            which the runner cannot drive over the store cookie and
 *            therefore reports as skipped, never as passed.
 *
 *   npx tsx evals/agent-suite/create/run.ts
 *
 * Required env (the suite skips — exit 0 — when any is missing, so it is
 * safe in CI without a Box): EVAL_MINI_BASE_URL (mini origin), and
 * EVAL_STORE_COOKIE (value of the `mini_store` cookie for the test owner).
 * Optional: EVAL_ONLY=C01,C02, EVAL_TIMEOUT_MS, EVAL_DELAY_MS,
 * EVAL_RESULTS_STAMP.
 *
 * Nothing from the Box workspace is persisted here beyond redacted tool
 * previews and the agent's transcript — the status and intake routes are
 * content-free by construction (log tail, counts, scores, stage names), so
 * the result files are too.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createSseParser,
  redact,
  sleep,
  PREVIEW_MAX,
  type ToolEvent,
} from "../lib";

const HERE = new URL(".", import.meta.url).pathname;
const TIMEOUT_MS = Number(process.env["EVAL_TIMEOUT_MS"] ?? 600_000);
const DELAY_MS = Number(process.env["EVAL_DELAY_MS"] ?? 15_000);
const STATUS_SETTLE_MS = Number(process.env["EVAL_SETTLE_MS"] ?? 10_000);

export const CREATE_TIERS = ["fast", "balanced", "deep"] as const;
export type CreateTier = (typeof CREATE_TIERS)[number];
/**
 * `golden|iteration|budget` are the MC4 Vibe steps; the rest are the V12
 * §19 steps, one per stage of the §5.1 machine the case drives the intake
 * through (`import` is the GitHub-URL path, §8.1).
 */
export const CREATE_STEPS = [
  "golden",
  "iteration",
  "budget",
  "intake",
  "plan",
  "confirm",
  "dev",
  "finalize",
  "import",
] as const;
export type CreateStep = (typeof CREATE_STEPS)[number];

/**
 * §4 Stage vocabulary, copied rather than imported: the harness runs
 * standalone under `tsx` and must not pull `apps/web` in. Keep in step with
 * `INTAKE_STAGES` in `apps/web/lib/create/intake.ts`.
 */
export const CREATE_INTAKE_STAGES = [
  "asking",
  "planning",
  "plan_sent",
  "revising",
  "confirmed",
  "building",
  "qa",
  "testing",
  "dev_ready",
  "finalizing",
  "decision_sent",
  "production",
  "abandoned",
  "failed",
] as const;
export type CreateIntakeStage = (typeof CREATE_INTAKE_STAGES)[number];

/** Same shape as the skill and the turn route enforce (§9.2). */
export const APPNAME_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;

export interface CreateCase {
  id: string;
  appname: string;
  step: CreateStep;
  tier: CreateTier;
  message: string;
  /** A draft version must exist on the project after the turn. */
  expect_draft: boolean;
  /** Hard findings tolerated on the resulting draft (0 for the golden path). */
  expect_hard_findings: number;
  /** Regexes matched in order against tool events then transcript — the build the case is about. */
  must_do: string[];
  /** Regexes that must not appear anywhere: `npm install`, `air-create publish`, "published". */
  must_not_do: string[];
  /** Regexes the final transcript must contain (§9.5 reporting rules). */
  must_say: string[];
  /** Budget the harness sets on the project before the turn (PATCH /api/create/projects). */
  budget_usd: number | null;
  /** When set, the turn is expected to hit the gateway's `insufficient_quota` with this reason. */
  budget_reason: string | null;
  /**
   * V12: the §4 stage the intake must have reached after the turn (status
   * `intake_stage`, else GET /api/create/intake). "Reached" because §5.1
   * chains `confirmed → building → … → dev_ready` inside one owner turn: a
   * later stage on the golden path passes, `abandoned`/`failed` match exactly.
   */
  expect_stage: CreateIntakeStage | null;
  /** V12: the Planner may have asked at most this many questions (§5.2: ≤ 3; 0 when fully specified). */
  expect_questions_max: number | null;
  /** V12: at least this many `locked: true` tests must exist after the turn (§8.3: ≥ 2 on confirm). */
  expect_locked_tests_min: number | null;
  /** V12: `true` — status `dev.url` must be set (CR22 held server-side); `false` — it must not; `null` — not graded. */
  expect_dev_url: boolean | null;
  /** When set the runner does not drive the case and records it as `skipped` with this reason (C30). */
  skip_reason: string | null;
  /** V13: status `job.state` must equal this after the turn (the card's job). */
  expect_job_state: string | null;
  /** V13: the transcript must carry `[card: create <slug> job=<id>]` exactly once — two bubbles per build. */
  expect_card: boolean | null;
}

export interface CreateStatus {
  slug: string;
  appname: string;
  status: string;
  draft_version: string | null;
  qa_score: number | null;
  build: {
    id: string;
    status: string;
    version: string | null;
    error: string | null;
    findings: Array<{ severity?: string; code?: string }>;
    log: string[];
  } | null;
  budget: { budget_usd: number; spent_usd: number; remaining_usd: number };
  versions: Array<{
    version: string;
    findings: number;
    qa_score: number | null;
  }>;
  /** V13 §9.1 — the live CreateJob for the app (null = none). */
  job?: {
    id: string;
    state: string;
    step: string | null;
    percent: number | null;
    dev_url: string | null;
  } | null;
  /** V13 flag (CREATE_V13 + allow-list) as the control plane reports it. */
  v13?: boolean;
  /** V12 §14.1 extensions; absent on a pre-V12 control plane. */
  intake_stage?: string | null;
  dev?: {
    version: string | null;
    url: string | null;
    expires_at: string | null;
  } | null;
  tests?: {
    total: number | null;
    passed: number | null;
    failed_ids?: string[];
    /** Count of `locked: true` ids on the draft, when the control plane reports it. */
    locked?: number | null;
  } | null;
}

/** `GET /api/create/intake?app=` (§14.1) — counters only, never content. */
export interface CreateIntake {
  appname: string | null;
  stage: string;
  template: string | null;
  questions_asked: number;
  revisions: number;
  plan_version: number | null;
  builds: number;
  failed_builds: number;
}

export type CheckVerdict = "pass" | "fail" | "n/a";
export type CheckName =
  | "terminal"
  | "must_do"
  | "must_not_do"
  | "must_say"
  | "budget"
  | "draft"
  | "hard_findings"
  | "stage"
  | "questions"
  | "locked_tests"
  | "dev_url"
  | "job_state"
  | "card";
export type CaseChecks = Record<CheckName, CheckVerdict>;

export const CHECK_NAMES: readonly CheckName[] = [
  "terminal",
  "must_do",
  "must_not_do",
  "must_say",
  "budget",
  "draft",
  "hard_findings",
  "stage",
  "questions",
  "locked_tests",
  "dev_url",
  "job_state",
  "card",
];

export interface CreateCaseResult {
  id: string;
  appname: string;
  step: CreateStep;
  tier: CreateTier;
  message: string;
  run_id: string | null;
  session: string | null;
  /** "completed" | "failed" | "timeout" | "start_error" | "stream_error" | "budget_refused" | "skipped" */
  status: string;
  error: string | null;
  tools: string[];
  tool_events: ToolEvent[];
  output: string;
  elapsed_ms: number;
  status_after: CreateStatus | null;
  /** V12: the intake counters after the turn; null when the route is missing (404) or unreachable. */
  intake_after: CreateIntake | null;
  checks: CaseChecks;
}

function optionalInt(
  value: unknown,
  where: string,
  field: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${where}: bad ${field}`);
  }
  return value;
}

export function loadCreateCases(path: string): CreateCase[] {
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return lines.map((line, i) => {
    const parsed = JSON.parse(line) as Partial<CreateCase>;
    const where = `cases.jsonl line ${i + 1}`;
    if (!parsed.id || !parsed.appname || !parsed.message) {
      throw new Error(`${where}: missing id/appname/message`);
    }
    if (seen.has(parsed.id))
      throw new Error(`${where}: duplicate id ${parsed.id}`);
    seen.add(parsed.id);
    if (!APPNAME_RE.test(parsed.appname))
      throw new Error(`${where}: bad appname ${parsed.appname}`);
    if (!CREATE_STEPS.includes(parsed.step as CreateStep)) {
      throw new Error(`${where}: bad step ${parsed.step}`);
    }
    if (!CREATE_TIERS.includes(parsed.tier as CreateTier)) {
      throw new Error(`${where}: bad tier ${parsed.tier}`);
    }
    const patterns = [
      ...(parsed.must_do ?? []),
      ...(parsed.must_not_do ?? []),
      ...(parsed.must_say ?? []),
    ];
    for (const pattern of patterns) {
      try {
        new RegExp(pattern, "i");
      } catch {
        throw new Error(`${where}: bad regex ${pattern}`);
      }
    }
    if (parsed.budget_usd !== undefined && parsed.budget_usd !== null) {
      if (typeof parsed.budget_usd !== "number" || !(parsed.budget_usd >= 0)) {
        throw new Error(`${where}: bad budget_usd`);
      }
    }
    if (
      parsed.expect_stage !== undefined &&
      parsed.expect_stage !== null &&
      !CREATE_INTAKE_STAGES.includes(parsed.expect_stage as CreateIntakeStage)
    ) {
      throw new Error(`${where}: bad expect_stage ${parsed.expect_stage}`);
    }
    if (
      parsed.expect_dev_url !== undefined &&
      parsed.expect_dev_url !== null &&
      typeof parsed.expect_dev_url !== "boolean"
    ) {
      throw new Error(`${where}: bad expect_dev_url`);
    }
    if (
      parsed.skip_reason !== undefined &&
      parsed.skip_reason !== null &&
      (typeof parsed.skip_reason !== "string" || !parsed.skip_reason.trim())
    ) {
      throw new Error(`${where}: bad skip_reason`);
    }
    if (
      parsed.expect_job_state !== undefined &&
      parsed.expect_job_state !== null &&
      typeof parsed.expect_job_state !== "string"
    ) {
      throw new Error(`${where}: bad expect_job_state`);
    }
    if (
      parsed.expect_card !== undefined &&
      parsed.expect_card !== null &&
      typeof parsed.expect_card !== "boolean"
    ) {
      throw new Error(`${where}: bad expect_card`);
    }
    return {
      id: parsed.id,
      appname: parsed.appname,
      step: parsed.step as CreateStep,
      tier: parsed.tier as CreateTier,
      message: parsed.message,
      expect_draft: parsed.expect_draft ?? true,
      expect_hard_findings: parsed.expect_hard_findings ?? 0,
      must_do: parsed.must_do ?? [],
      must_not_do: parsed.must_not_do ?? [],
      must_say: parsed.must_say ?? [],
      budget_usd: parsed.budget_usd ?? null,
      budget_reason: parsed.budget_reason ?? null,
      expect_stage: (parsed.expect_stage as CreateIntakeStage | undefined) ?? null,
      expect_questions_max: optionalInt(
        parsed.expect_questions_max,
        where,
        "expect_questions_max",
      ),
      expect_locked_tests_min: optionalInt(
        parsed.expect_locked_tests_min,
        where,
        "expect_locked_tests_min",
      ),
      expect_dev_url: parsed.expect_dev_url ?? null,
      skip_reason: parsed.skip_reason?.trim() ?? null,
      expect_job_state:
        typeof parsed.expect_job_state === "string"
          ? parsed.expect_job_state
          : null,
      expect_card: parsed.expect_card ?? null,
    };
  });
}

/** Ordered `must_do` matching over the evidence lines, mirroring the parent suite's execution axis. */
export function matchesInOrder(
  patterns: string[],
  evidence: string[],
): boolean {
  let cursor = 0;
  for (const pattern of patterns) {
    const re = new RegExp(pattern, "i");
    let found = -1;
    for (let i = cursor; i < evidence.length; i += 1) {
      if (re.test(evidence[i] ?? "")) {
        found = i;
        break;
      }
    }
    if (found < 0) return false;
    cursor = found + 1;
  }
  return true;
}

export function hardFindings(status: CreateStatus | null): number {
  const findings = status?.build?.findings ?? [];
  return findings.filter((f) => (f.severity ?? "hard") === "hard").length;
}

/**
 * The §4 stage after the turn: the status route's `intake_stage` when the
 * project exists, else the intake route (an intake at `asking` has no
 * project yet, so status 404s). Null when neither reported one.
 */
export function intakeStage(
  r: Pick<CreateCaseResult, "status_after" | "intake_after">,
): string | null {
  const fromStatus = r.status_after?.intake_stage;
  if (typeof fromStatus === "string" && fromStatus) return fromStatus;
  const fromIntake = r.intake_after?.stage;
  return typeof fromIntake === "string" && fromIntake ? fromIntake : null;
}

/** Stages off the golden path; they never satisfy an on-path expectation and vice versa. */
const OFF_PATH_STAGES: ReadonlySet<string> = new Set(["abandoned", "failed"]);

/**
 * `expect_stage` semantics: `actual` is `expected`, or a later stage on the
 * §4 golden path (`asking → … → production`). §5.1 advances an intake
 * several stages inside one owner turn ("yes" → confirmed → building → qa →
 * testing → dev_ready), so an exact match would fail a correct run; the
 * `must_not_do` regexes catch a turn that went further than the owner asked.
 */
export function stageReached(
  actual: string | null,
  expected: CreateIntakeStage,
): boolean {
  if (actual === null) return false;
  if (actual === expected) return true;
  if (OFF_PATH_STAGES.has(expected) || OFF_PATH_STAGES.has(actual)) return false;
  const path = CREATE_INTAKE_STAGES as readonly string[];
  const at = path.indexOf(actual);
  return at >= 0 && at > path.indexOf(expected);
}

/**
 * Numbered lines ending in `?` — §5.2 questions arrive as one message of
 * `1.` … `3.` lines. Only the fallback when the intake route is unreachable;
 * a plan's numbered summary lines do not end in a question mark.
 */
export function countNumberedQuestions(output: string): number {
  const numbers = new Set<string>();
  for (const match of output.matchAll(/^\s*(\d{1,2})[.)]\s+[^\n]*\?\s*$/gm)) {
    numbers.add(match[1] ?? "");
  }
  return numbers.size;
}

/** Questions the Planner asked: the intake counter, else the transcript. */
export function questionsAsked(
  r: Pick<CreateCaseResult, "intake_after" | "output">,
): number {
  const counted = r.intake_after?.questions_asked;
  if (typeof counted === "number" && Number.isFinite(counted)) return counted;
  return countNumberedQuestions(r.output);
}

/**
 * `locked: true` tests after the turn: the status route's `tests.locked`
 * when the control plane counts them, else the `"locked": true` entries the
 * Planner wrote (goal.md `## Tests` / `air.json.tests[]`) that surfaced in
 * tool previews or the transcript.
 */
export function lockedTests(
  status: CreateStatus | null,
  evidence: string[],
): number {
  const counted = status?.tests?.locked;
  if (typeof counted === "number" && Number.isFinite(counted)) return counted;
  const all = evidence.join("\n");
  return (all.match(/\blocked"?\s*:\s*true\b/gi) ?? []).length;
}

/** The dev URL (`link.wzrd.tech/<u>/<a>`) the status route reports, or null. */
export function devUrl(status: CreateStatus | null): string | null {
  const url = status?.dev?.url;
  return typeof url === "string" && url ? url : null;
}

export const SKIPPED_CHECKS: CaseChecks = Object.fromEntries(
  CHECK_NAMES.map((name) => [name, "n/a"]),
) as CaseChecks;

/**
 * Grade one result. Pure so the checks can be unit-tested without a Box;
 * `n/a` marks axes the case does not carry. A skipped case (C30) carries no
 * axis at all: it is reported, never counted as a pass.
 */
export function gradeCase(
  c: CreateCase,
  r: Omit<CreateCaseResult, "checks">,
): CaseChecks {
  if (r.status === "skipped") return { ...SKIPPED_CHECKS };
  const evidence = [
    ...r.tool_events.map((e) => `${e.tool} ${e.preview}`),
    r.output,
  ];
  const all = evidence.join("\n");
  const common = {
    terminal:
      r.status === "completed" || r.status === "budget_refused"
        ? "pass"
        : "fail",
    must_do: c.must_do.length
      ? matchesInOrder(c.must_do, evidence)
        ? "pass"
        : "fail"
      : "n/a",
    must_not_do: c.must_not_do.length
      ? c.must_not_do.some((p) => new RegExp(p, "i").test(all))
        ? "fail"
        : "pass"
      : "n/a",
    must_say: c.must_say.length
      ? c.must_say.every((p) => new RegExp(p, "i").test(r.output))
        ? "pass"
        : "fail"
      : "n/a",
  } satisfies Partial<CaseChecks>;

  // V12 axes (§19): graded on every step that carries them, including the
  // budget step — C29 expects `insufficient_quota` *and* stage `failed`.
  const stage = intakeStage(r);
  const v12 = {
    stage: c.expect_stage
      ? stageReached(stage, c.expect_stage)
        ? "pass"
        : "fail"
      : "n/a",
    questions:
      c.expect_questions_max !== null
        ? questionsAsked(r) <= c.expect_questions_max
          ? "pass"
          : "fail"
        : "n/a",
    locked_tests:
      c.expect_locked_tests_min !== null
        ? lockedTests(r.status_after, evidence) >= c.expect_locked_tests_min
          ? "pass"
          : "fail"
        : "n/a",
    dev_url:
      c.expect_dev_url === null
        ? "n/a"
        : (devUrl(r.status_after) !== null) === c.expect_dev_url
          ? "pass"
          : "fail",
    // V13 axes (§15): the job the card points at, and the never-edited
    // [card: create …] marker — exactly once, no progress narration.
    job_state:
      c.expect_job_state === null
        ? "n/a"
        : r.status_after?.job?.state === c.expect_job_state
          ? "pass"
          : "fail",
    card:
      c.expect_card === null || c.expect_card === false
        ? "n/a"
        : (r.output.match(/\[card: create [a-z0-9-]+ job=[0-9a-f-]+\]/g) ?? []).length === 1
          ? "pass"
          : "fail",
  } satisfies Partial<CaseChecks>;

  if (c.budget_reason) {
    // A budget case passes when the refusal surfaced (gateway 429 → the agent
    // reports it) and the agent did not pretend a build happened.
    const refused =
      r.status === "budget_refused" ||
      new RegExp(c.budget_reason, "i").test(all) ||
      (r.status_after !== null && r.status_after.budget.remaining_usd <= 0);
    return {
      ...common,
      budget: refused ? "pass" : "fail",
      draft: "n/a",
      hard_findings: "n/a",
      ...v12,
    };
  }

  return {
    ...common,
    budget: "n/a",
    draft: c.expect_draft
      ? r.status_after?.draft_version
        ? "pass"
        : "fail"
      : "n/a",
    // An unreachable status route means there was nothing to grade — that
    // is a fail, not "0 findings pass".
    hard_findings:
      r.status_after === null
        ? "fail"
        : hardFindings(r.status_after) <= c.expect_hard_findings
          ? "pass"
          : "fail",
    ...v12,
  };
}

/** The result the runner records for a case it must not drive (`skip_reason`). */
export function skippedResult(c: CreateCase): CreateCaseResult {
  return {
    id: c.id,
    appname: c.appname,
    step: c.step,
    tier: c.tier,
    message: c.message,
    run_id: null,
    session: null,
    status: "skipped",
    error: c.skip_reason,
    tools: [],
    tool_events: [],
    output: "",
    elapsed_ms: 0,
    status_after: null,
    intake_after: null,
    checks: { ...SKIPPED_CHECKS },
  };
}

interface Config {
  baseUrl: string;
  cookie: string;
  resultsDir: string;
  only: Set<string> | null;
}

function config(): Config | null {
  const baseUrl = process.env["EVAL_MINI_BASE_URL"];
  const cookie = process.env["EVAL_STORE_COOKIE"];
  if (!baseUrl || !cookie) return null;
  const stamp =
    process.env["EVAL_RESULTS_STAMP"] ??
    new Date().toISOString().replace(/[:.]/g, "-");
  const only = process.env["EVAL_ONLY"]
    ? new Set(
        process.env["EVAL_ONLY"]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    cookie,
    resultsDir: join(HERE, "results", stamp),
    only,
  };
}

function headers(cfg: Config, json = false): Record<string, string> {
  return {
    Cookie: `mini_store=${cfg.cookie}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function fetchStatus(
  cfg: Config,
  appname: string,
): Promise<CreateStatus | null> {
  const res = await fetch(
    `${cfg.baseUrl}/api/create/status?app=${encodeURIComponent(appname)}`,
    {
      headers: headers(cfg),
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as CreateStatus;
}

/**
 * `GET /api/create/intake?app=` (§14.1). Tolerant of a 404 — no intake for
 * the app, or a control plane that predates the route — and of anything
 * else that is not a JSON object with a `stage`: both read as null and the
 * grader falls back to the status route and the transcript.
 */
async function fetchIntake(
  cfg: Config,
  appname: string,
): Promise<CreateIntake | null> {
  const res = await fetch(
    `${cfg.baseUrl}/api/create/intake?app=${encodeURIComponent(appname)}`,
    {
      headers: headers(cfg),
    },
  );
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as Partial<CreateIntake> | null;
  if (!body || typeof body !== "object" || typeof body.stage !== "string") {
    return null;
  }
  return {
    appname: typeof body.appname === "string" ? body.appname : null,
    stage: body.stage,
    template: typeof body.template === "string" ? body.template : null,
    questions_asked:
      typeof body.questions_asked === "number" ? body.questions_asked : 0,
    revisions: typeof body.revisions === "number" ? body.revisions : 0,
    plan_version:
      typeof body.plan_version === "number" ? body.plan_version : null,
    builds: typeof body.builds === "number" ? body.builds : 0,
    failed_builds:
      typeof body.failed_builds === "number" ? body.failed_builds : 0,
  };
}

async function setBudget(
  cfg: Config,
  appname: string,
  budgetUsd: number,
): Promise<void> {
  const status = await fetchStatus(cfg, appname);
  if (!status)
    throw new Error(`cannot set budget: ${appname} has no project yet`);
  const res = await fetch(`${cfg.baseUrl}/api/create/projects`, {
    method: "PATCH",
    headers: headers(cfg, true),
    body: JSON.stringify({ slug: status.slug, create_budget_usd: budgetUsd }),
  });
  if (!res.ok)
    throw new Error(
      `PATCH /api/create/projects ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
}

async function startTurn(
  cfg: Config,
  c: CreateCase,
): Promise<{ run_id: string; session: string } | { refused: string }> {
  const res = await fetch(`${cfg.baseUrl}/api/create/turn`, {
    method: "POST",
    headers: headers(cfg, true),
    body: JSON.stringify({
      appname: c.appname,
      input: c.message,
      tier: c.tier,
    }),
  });
  const text = await res.text();
  if (res.status === 429) {
    const body = JSON.parse(text) as { reason?: string };
    return { refused: body.reason ?? "insufficient_quota" };
  }
  if (!res.ok)
    throw new Error(
      `POST /api/create/turn ${res.status}: ${text.slice(0, 300)}`,
    );
  const body = JSON.parse(text) as { run_id?: string; session?: string };
  if (!body.run_id || !body.session)
    throw new Error(`turn returned no run_id: ${text.slice(0, 300)}`);
  return { run_id: body.run_id, session: body.session };
}

interface StreamResult {
  status: "completed" | "failed" | "timeout" | "stream_error";
  tools: string[];
  toolEvents: ToolEvent[];
  output: string;
  error: string | null;
}

async function streamRun(cfg: Config, runId: string): Promise<StreamResult> {
  const tools: string[] = [];
  const toolEvents: ToolEvent[] = [];
  let deltas = "";
  let completedOutput = "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const finish = (
    status: StreamResult["status"],
    error: string | null,
  ): StreamResult => ({
    status,
    tools,
    toolEvents,
    output: deltas || completedOutput,
    error,
  });
  try {
    const res = await fetch(
      `${cfg.baseUrl}/api/create/events/${encodeURIComponent(runId)}`,
      {
        headers: { ...headers(cfg), Accept: "text/event-stream" },
        signal: controller.signal,
      },
    );
    if (!res.ok || !res.body) {
      return finish(
        "stream_error",
        `events ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    const parse = createSseParser();
    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parse(decoder.decode(value, { stream: true }))) {
        if (event.event === "tool.started" && event.tool) {
          if (tools[tools.length - 1] !== event.tool) tools.push(event.tool);
          toolEvents.push({
            tool: event.tool,
            preview: redact(event.preview ?? "").slice(0, PREVIEW_MAX),
          });
        }
        if (event.event === "message.delta" && event.delta)
          deltas += event.delta;
        if (event.event === "run.completed") {
          completedOutput = event.output ?? "";
          await reader.cancel().catch(() => undefined);
          return finish("completed", null);
        }
        if (event.event === "run.failed") {
          await reader.cancel().catch(() => undefined);
          return finish("failed", "run.failed");
        }
      }
    }
    return finish("stream_error", "stream closed before terminal event");
  } catch (error) {
    const aborted = controller.signal.aborted;
    return finish(
      aborted ? "timeout" : "stream_error",
      aborted ? `no terminal event within ${TIMEOUT_MS}ms` : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
}

async function runCase(cfg: Config, c: CreateCase): Promise<CreateCaseResult> {
  const started = Date.now();
  const base: Omit<CreateCaseResult, "checks"> = {
    id: c.id,
    appname: c.appname,
    step: c.step,
    tier: c.tier,
    message: c.message,
    run_id: null,
    session: null,
    status: "start_error",
    error: null,
    tools: [],
    tool_events: [],
    output: "",
    elapsed_ms: 0,
    status_after: null,
    intake_after: null,
  };
  try {
    if (c.budget_usd !== null) await setBudget(cfg, c.appname, c.budget_usd);
    const turn = await startTurn(cfg, c);
    if ("refused" in turn) {
      base.status = "budget_refused";
      base.error = turn.refused;
    } else {
      base.run_id = turn.run_id;
      base.session = turn.session;
      const stream = await streamRun(cfg, turn.run_id);
      base.status = stream.status;
      base.error = stream.error;
      base.tools = stream.tools;
      base.tool_events = stream.toolEvents;
      base.output = redact(stream.output);
    }
  } catch (error) {
    base.error = redact(String(error)).slice(0, 300);
  }
  await sleep(STATUS_SETTLE_MS);
  [base.status_after, base.intake_after] = await Promise.all([
    fetchStatus(cfg, c.appname).catch(() => null),
    fetchIntake(cfg, c.appname).catch(() => null),
  ]);
  base.elapsed_ms = Date.now() - started;
  return { ...base, checks: gradeCase(c, base) };
}

async function main(): Promise<void> {
  const cases = loadCreateCases(join(HERE, "cases.jsonl"));
  const cfg = config();
  if (!cfg) {
    console.log(
      `create evals: skipped (${cases.length} cases) — set EVAL_MINI_BASE_URL and EVAL_STORE_COOKIE to run against a Box`,
    );
    return;
  }
  mkdirSync(cfg.resultsDir, { recursive: true });
  let first = true;
  for (const c of cases) {
    if (cfg.only && !cfg.only.has(c.id)) continue;
    const file = join(cfg.resultsDir, `${c.id}.json`);
    if (existsSync(file)) {
      console.log(`${c.id}: exists, skipping`);
      continue;
    }
    if (c.skip_reason) {
      // Not driven, not passed: the result file says `skipped` and every
      // check reads `n/a`, so a report cannot count it toward the pass rate.
      writeFileSync(file, JSON.stringify(skippedResult(c), null, 2));
      console.log(`${c.id} [${c.step}/${c.tier}] skipped — ${c.skip_reason}`);
      continue;
    }
    if (!first) await sleep(DELAY_MS);
    first = false;
    console.log(`${c.id} [${c.step}/${c.tier}] ${c.message.slice(0, 70)}`);
    const result = await runCase(cfg, c);
    writeFileSync(file, JSON.stringify(result, null, 2));
    const verdict = Object.entries(result.checks)
      .filter(([, v]) => v !== "n/a")
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    console.log(
      `  → ${result.status} in ${Math.round(result.elapsed_ms / 1000)}s  ${verdict}`,
    );
  }
  const report = writeReport(cfg.resultsDir);
  if (report !== null) console.log(`[create] wrote ${report}`);
}

/**
 * report.md writer — the same shape as the main suite's: a per-check
 * pass-rate table over every check a case carries, then the per-case
 * appendix. Aggregates every case JSON on disk so a resumed run reports
 * the whole dir, not just the cases this invocation ran. Returns null when
 * there is nothing to report (empty dir).
 */
export function writeReport(dir: string): string | null {
  const results = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "suite.json")
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as CreateCaseResult);
  if (results.length === 0) return null;

  const byCheck = new Map<CheckName, { pass: number; fail: number; na: number }>();
  for (const name of CHECK_NAMES) byCheck.set(name, { pass: 0, fail: 0, na: 0 });
  const statuses = new Map<string, number>();
  for (const r of results) {
    statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
    for (const name of CHECK_NAMES) {
      const t = byCheck.get(name)!;
      const v = r.checks[name];
      if (v === "pass") t.pass += 1;
      else if (v === "fail") t.fail += 1;
      else t.na += 1;
    }
  }
  const totalSeconds = results.reduce((s, r) => s + r.elapsed_ms, 0) / 1000;

  const lines: string[] = [];
  lines.push("# Create suite — report", "");
  lines.push(
    `Cases: **${results.length}**  ·  results: \`${dir.split("/").slice(-1)[0]}\`  ·  ` +
      `outcomes: ${[...statuses.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}  ·  ` +
      `elapsed: **${Math.round(totalSeconds)}s**`,
    ""
  );
  lines.push("| Check | Pass rate | pass | fail | n/a |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const name of CHECK_NAMES) {
    const t = byCheck.get(name)!;
    const scored = t.pass + t.fail;
    lines.push(
      `| ${name} | ${scored === 0 ? "—" : `${Math.round((t.pass / scored) * 100)}%`} | ${t.pass} | ${t.fail} | ${t.na} |`
    );
  }
  lines.push("");

  const failing = results.filter((r) =>
    CHECK_NAMES.some((name) => r.checks[name] === "fail")
  );
  if (failing.length > 0) {
    lines.push("## Failures", "");
    for (const r of failing) {
      const fails = CHECK_NAMES.filter((name) => r.checks[name] === "fail").join(", ");
      lines.push(`- **${r.id}** [${r.step}/${r.tier}] ${r.status}: ${fails}`);
    }
    lines.push("");
  }

  lines.push("## Per-case detail", "");
  lines.push(
    `| id | step | tier | status | ${CHECK_NAMES.join(" | ")} | tools |`
  );
  lines.push(`| --- | --- | --- | --- | ${CHECK_NAMES.map(() => "---").join(" | ")} | --- |`);
  for (const r of results) {
    lines.push(
      `| ${r.id} | ${r.step} | ${r.tier} | ${r.status} | ` +
        `${CHECK_NAMES.map((name) => r.checks[name]).join(" | ")} | ` +
        `${r.tools.join(", ") || "—"} |`
    );
  }
  lines.push("");

  const report = join(dir, "report.md");
  writeFileSync(report, `${lines.join("\n")}`);
  return report;
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
