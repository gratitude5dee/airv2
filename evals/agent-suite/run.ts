/**
 * Agent eval runner. For each case in messages.jsonl: start a real run on the
 * test user's box through the control plane (POST /api/chat), capture the SSE
 * stream (GET /api/chat/<runId>/events), wait for terminal, then read the
 * side-effect evidence back out of Postgres (agent_runs + decisions).
 *
 * Sequential by design — one box, one Hermes, one filesystem — with a
 * per-case timeout and a cooldown between cases. Resumable: a case whose
 * result file already exists in the target directory is skipped, so an
 * overnight run survives box flaps and restarts.
 *
 *   npx tsx evals/agent-suite/run.ts
 *
 * Required env: EVAL_BASE_URL, EVAL_SESSION_COOKIE, EVAL_USER_ID,
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. See README.md.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createSseParser,
  loadCases,
  num,
  redact,
  requireEnv,
  skillFromPreview,
  sleep,
  supaSelect,
  PREVIEW_MAX,
  type AgentRunRow,
  type CaseResult,
  type DecisionRow,
  type EvalCase,
  type Supa,
  type ToolEvent,
} from "./lib";

const HERE = new URL(".", import.meta.url).pathname;
const TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS ?? 480_000);
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 20_000);
/** How long to wait for the control plane to close out the agent_runs row. */
const SETTLE_MS = Number(process.env.EVAL_SETTLE_MS ?? 20_000);

interface Config {
  baseUrl: string;
  cookie: string;
  userId: string;
  supa: Supa;
  resultsDir: string;
  only: Set<string> | null;
}

function config(): Config {
  const baseUrl = (process.env.EVAL_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const stamp = process.env.EVAL_RESULTS_STAMP ?? new Date().toISOString().replace(/[:.]/g, "-");
  const resultsDir = join(HERE, "results", stamp);
  const only = process.env.EVAL_ONLY
    ? new Set(process.env.EVAL_ONLY.split(",").map((s) => s.trim()).filter(Boolean))
    : null;
  return {
    baseUrl,
    cookie: requireEnv("EVAL_SESSION_COOKIE"),
    userId: requireEnv("EVAL_USER_ID"),
    supa: { url: requireEnv("SUPABASE_URL").replace(/\/$/, ""), key: requireEnv("SUPABASE_SERVICE_ROLE_KEY") },
    resultsDir,
    only,
  };
}

/**
 * Stop a run that never reached terminal. Returns a note for the result's
 * error field: whether the runaway run was actually cut matters when reading
 * the next case's cost, so it is evidence, not a detail to swallow.
 */
async function stopRun(cfg: Config, runId: string): Promise<string> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/chat/${runId}/stop`, {
      method: "POST",
      headers: { Cookie: `air_session=${cfg.cookie}` },
    });
    return res.ok ? "; run stopped" : `; stop returned ${res.status}`;
  } catch (error) {
    return `; stop failed: ${redact(String(error)).slice(0, 120)}`;
  }
}

async function startRun(cfg: Config, input: string): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `air_session=${cfg.cookie}`,
    },
    body: JSON.stringify({ input, via: "web" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST /api/chat ${res.status}: ${text.slice(0, 300)}`);
  const body = JSON.parse(text) as { run_id?: string };
  if (!body.run_id) throw new Error(`POST /api/chat returned no run_id: ${text.slice(0, 300)}`);
  return body.run_id;
}

interface StreamResult {
  status: "completed" | "failed" | "timeout" | "stream_error";
  tools: string[];
  toolEvents: ToolEvent[];
  skillsViewed: string[];
  output: string;
  error: string | null;
}

/** Read the run's SSE stream to its terminal event (or the case timeout). */
async function streamRun(cfg: Config, runId: string): Promise<StreamResult> {
  const tools: string[] = [];
  const toolEvents: ToolEvent[] = [];
  const skillsViewed: string[] = [];
  let deltas = "";
  let completedOutput = "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.baseUrl}/api/chat/${runId}/events`, {
      headers: { Cookie: `air_session=${cfg.cookie}`, Accept: "text/event-stream" },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      return {
        status: "stream_error",
        tools,
        toolEvents,
        skillsViewed,
        output: "",
        error: `events ${res.status}: ${(await res.text()).slice(0, 300)}`,
      };
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
          const skill = skillFromPreview(event);
          if (skill && !skillsViewed.includes(skill)) skillsViewed.push(skill);
        }
        if (event.event === "message.delta" && event.delta) deltas += event.delta;
        if (event.event === "run.completed") {
          completedOutput = event.output ?? "";
          await reader.cancel().catch(() => undefined);
          return {
            status: "completed",
            tools,
            toolEvents,
            skillsViewed,
            output: deltas || completedOutput,
            error: null,
          };
        }
        if (event.event === "run.failed") {
          await reader.cancel().catch(() => undefined);
          return {
            status: "failed",
            tools,
            toolEvents,
            skillsViewed,
            output: deltas || completedOutput,
            error: "run.failed",
          };
        }
      }
    }
    // Stream ended without a terminal frame: the box dropped the connection.
    return {
      status: "stream_error",
      tools,
      toolEvents,
      skillsViewed,
      output: deltas || completedOutput,
      error: "stream closed before terminal event",
    };
  } catch (error) {
    const aborted = controller.signal.aborted;
    return {
      status: aborted ? "timeout" : "stream_error",
      tools,
      toolEvents,
      skillsViewed,
      output: deltas || completedOutput,
      error: aborted ? `no terminal event within ${TIMEOUT_MS}ms` : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

interface RawRun {
  hermes_run_id: string | null;
  trigger: string | null;
  outcome: string | null;
  started_at: string;
  ended_at: string | null;
  cost_usd: string | number | null;
  box_seconds: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  speed_tier: string | null;
  model: string | null;
  requested_model: string | null;
  reasoning_effort: string | null;
  latency_ms: number | null;
}

function toRunRow(row: RawRun): AgentRunRow {
  return {
    hermes_run_id: row.hermes_run_id,
    trigger: row.trigger,
    outcome: row.outcome,
    started_at: row.started_at,
    ended_at: row.ended_at,
    cost_usd: row.cost_usd === null ? null : num(row.cost_usd),
    box_seconds: row.box_seconds === null ? null : num(row.box_seconds),
    prompt_tokens: row.prompt_tokens === null ? null : num(row.prompt_tokens),
    completion_tokens: row.completion_tokens === null ? null : num(row.completion_tokens),
    speed_tier: row.speed_tier ?? null,
    model: row.model ?? null,
    requested_model: row.requested_model ?? null,
    reasoning_effort: row.reasoning_effort ?? null,
    latency_ms: row.latency_ms === null ? null : num(row.latency_ms),
  };
}

const RUN_COLS =
  "hermes_run_id,trigger,outcome,started_at,ended_at,cost_usd,box_seconds," +
  "prompt_tokens,completion_tokens,speed_tier,model,requested_model," +
  "reasoning_effort,latency_ms";

/**
 * Every agent_runs row the case produced: the chat row the relay opened plus
 * the trigger=null `gateway_completion` rows the inference gateway inserts
 * per model call, which is where token cost actually lands.
 */
async function readRuns(
  cfg: Config,
  windowStart: string,
  windowEnd: string
): Promise<AgentRunRow[]> {
  const rows = await supaSelect<RawRun>(
    cfg.supa,
    "agent_runs",
    `user_id=eq.${cfg.userId}&started_at=gte.${encodeURIComponent(windowStart)}` +
      `&started_at=lt.${encodeURIComponent(windowEnd)}` +
      `&select=${RUN_COLS}&order=started_at.asc`
  );
  return rows.map(toRunRow);
}

interface RawDecision {
  kind: string;
  status: string;
  label: string | null;
  platform: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
}

/**
 * Decisions created inside the run window. Only the shape is kept — payloads
 * hold draft bodies, contact handles, and refs, so we persist their keys and
 * drop the values (the scorer only needs kind/status).
 */
async function readDecisions(
  cfg: Config,
  windowStart: string,
  windowEnd: string
): Promise<DecisionRow[]> {
  const rows = await supaSelect<RawDecision>(
    cfg.supa,
    "decisions",
    `user_id=eq.${cfg.userId}&created_at=gte.${encodeURIComponent(windowStart)}` +
      `&created_at=lt.${encodeURIComponent(windowEnd)}` +
      `&select=kind,status,label,platform,created_at,payload&order=created_at.asc`
  );
  return rows.map((row) => ({
    kind: row.kind,
    status: row.status,
    label: row.label ? redact(row.label) : null,
    platform: row.platform,
    created_at: row.created_at,
    payload_keys: row.payload ? Object.keys(row.payload).sort() : [],
  }));
}

async function runCase(cfg: Config, testCase: EvalCase): Promise<CaseResult> {
  // Two seconds of slack absorbs clock skew between this host and Postgres,
  // so a decision written in the first instant of the run is not missed.
  const windowStart = new Date(Date.now() - 2_000).toISOString();
  const startedAt = Date.now();
  const base: CaseResult = {
    id: testCase.id,
    category: testCase.category,
    message: testCase.message,
    expected_skill: testCase.expected_skill,
    expected_decision_kind: testCase.expected_decision_kind,
    safety_note: testCase.safety_note,
    must_do: testCase.must_do,
    must_not_do: testCase.must_not_do,
    window_start: windowStart,
    window_end: null,
    run_id: null,
    status: "start_error",
    error: null,
    tools: [],
    tool_events: [],
    skills_viewed: [],
    output: "",
    elapsed_ms: 0,
    run_row: null,
    window_runs: [],
    cost_usd: 0,
    box_seconds: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    decisions: [],
  };

  let runId: string;
  try {
    runId = await startRun(cfg, testCase.message);
  } catch (error) {
    return { ...base, error: redact(String(error)), elapsed_ms: Date.now() - startedAt };
  }

  const stream = await streamRun(cfg, runId);
  // Aborting our end of the SSE stream does not stop the run: the box keeps
  // working, and its later metering rows and decisions would land inside the
  // *next* case's window and be scored against that case. Cut the run first.
  const stopNote = stream.status === "completed" || stream.status === "failed"
    ? ""
    : await stopRun(cfg, runId);
  // The relay closes out agent_runs as the terminal event passes; give that
  // write (and the gateway's metering inserts) a moment to land.
  await sleep(SETTLE_MS);
  const windowEnd = new Date().toISOString();

  let windowRuns: AgentRunRow[] = [];
  let decisions: DecisionRow[] = [];
  let readError: string | null = null;
  try {
    windowRuns = await readRuns(cfg, windowStart, windowEnd);
    decisions = await readDecisions(cfg, windowStart, windowEnd);
  } catch (error) {
    readError = redact(String(error));
  }

  return {
    ...base,
    run_id: runId,
    window_end: windowEnd,
    status: stream.status,
    error: stream.error ? `${redact(stream.error)}${stopNote}` : readError,
    tools: stream.tools,
    tool_events: stream.toolEvents,
    skills_viewed: stream.skillsViewed,
    output: redact(stream.output),
    elapsed_ms: Date.now() - startedAt,
    run_row: windowRuns.find((r) => r.hermes_run_id === runId) ?? null,
    window_runs: windowRuns,
    cost_usd: windowRuns.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0),
    box_seconds: windowRuns.reduce((sum, r) => sum + (r.box_seconds ?? 0), 0),
    prompt_tokens: windowRuns.reduce((sum, r) => sum + (r.prompt_tokens ?? 0), 0),
    completion_tokens: windowRuns.reduce((sum, r) => sum + (r.completion_tokens ?? 0), 0),
    decisions,
  };
}

async function main(): Promise<void> {
  const cfg = config();
  const cases = loadCases(join(HERE, "messages.jsonl"));
  mkdirSync(cfg.resultsDir, { recursive: true });
  const done = new Set(
    readdirSync(cfg.resultsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
  );
  const queue = cases.filter(
    (c) => !done.has(c.id) && (!cfg.only || cfg.only.has(c.id))
  );
  console.log(
    `[eval] results dir ${cfg.resultsDir} — ${queue.length} of ${cases.length} case(s) to run` +
      (done.size ? `, ${done.size} already present (resume)` : "")
  );

  for (const [index, testCase] of queue.entries()) {
    const label = `${testCase.id} (${index + 1}/${queue.length}, ${testCase.category})`;
    console.log(`[eval] ${label} → ${testCase.message.slice(0, 72)}`);
    const result = await runCase(cfg, testCase);
    const path = join(cfg.resultsDir, `${testCase.id}.json`);
    // Written even on failure: a start_error/timeout case is a real result,
    // and persisting it keeps the resume honest instead of retrying forever.
    writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
    console.log(
      `[eval] ${label} ${result.status} — ${result.tools.length} tool(s), ` +
        `${result.skills_viewed.length ? `skills [${result.skills_viewed.join(" ")}], ` : ""}` +
        `${result.decisions.length} decision(s), $${result.cost_usd.toFixed(4)}, ` +
        `${result.prompt_tokens + result.completion_tokens} tok, ` +
        `${Math.round(result.elapsed_ms / 1000)}s` +
        (result.error ? ` — ${result.error.slice(0, 160)}` : "")
    );
    if (index < queue.length - 1) await sleep(DELAY_MS);
  }

  // Snapshot the suite alongside the raw results so a report can always be
  // rescored against the exact cases that ran. Written once per results dir:
  // a resume's `ran` count covers only the remaining queue, so rewriting it
  // would erase the original run's counts.
  const suitePath = join(cfg.resultsDir, "suite.json");
  if (!existsSync(suitePath)) {
    writeFileSync(
      suitePath,
      `${JSON.stringify({ count: cases.length, ran: queue.length, at: new Date().toISOString() }, null, 2)}\n`
    );
  }
  console.log(`[eval] done — score with: npx tsx evals/agent-suite/score.ts ${cfg.resultsDir}`);
}

void main().catch((error: unknown) => {
  console.error(`[eval] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
