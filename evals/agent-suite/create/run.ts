/**
 * Create (MC4: Vibe) eval runner — the §0.2 golden path against a real Box.
 *
 * Each case is one owner turn in the `air-create-<appname>` session: POST
 * /api/create/turn on the mini origin, follow GET /api/create/events/<runId>
 * to terminal, then read GET /api/create/status?app=<appname> for the draft
 * version, findings, QA score and budget meter the turn left behind. Cases
 * run in file order and share one workspace on purpose — C02/C03 iterate on
 * the app C01 scaffolded, C04 lowers the project budget first and expects the
 * gateway's `create_budget` refusal to surface instead of a build.
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
 * previews and the agent's transcript — the status route is content-free by
 * construction (log tail, counts, scores), so the result files are too.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
export const CREATE_STEPS = ["golden", "iteration", "budget"] as const;
export type CreateStep = (typeof CREATE_STEPS)[number];

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
}

export type CheckVerdict = "pass" | "fail" | "n/a";
export type CheckName =
  | "terminal"
  | "must_do"
  | "must_not_do"
  | "must_say"
  | "budget"
  | "draft"
  | "hard_findings";
export type CaseChecks = Record<CheckName, CheckVerdict>;

export interface CreateCaseResult {
  id: string;
  appname: string;
  step: CreateStep;
  tier: CreateTier;
  message: string;
  run_id: string | null;
  session: string | null;
  /** "completed" | "failed" | "timeout" | "start_error" | "stream_error" | "budget_refused" */
  status: string;
  error: string | null;
  tools: string[];
  tool_events: ToolEvent[];
  output: string;
  elapsed_ms: number;
  status_after: CreateStatus | null;
  checks: CaseChecks;
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
    cursor = found;
  }
  return true;
}

export function hardFindings(status: CreateStatus | null): number {
  const findings = status?.build?.findings ?? [];
  return findings.filter((f) => (f.severity ?? "hard") === "hard").length;
}

/**
 * Grade one result. Pure so the checks can be unit-tested without a Box;
 * `n/a` marks axes the case does not carry.
 */
export function gradeCase(
  c: CreateCase,
  r: Omit<CreateCaseResult, "checks">,
): CaseChecks {
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
    hard_findings:
      hardFindings(r.status_after) <= c.expect_hard_findings ? "pass" : "fail",
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
  base.status_after = await fetchStatus(cfg, c.appname).catch(() => null);
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
