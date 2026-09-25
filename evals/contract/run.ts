/**
 * Contract-eval runner (R-EV-07a).
 *
 * Drives every gated messages.jsonl case (must_do / must_not_do /
 * expected_decision_kind carriers) through the real control plane — the
 * Next.js app running against scratch Postgres + PostgREST — while a stub
 * Hermes (evals/stub-hermes/server.ts) replays the recorded tool-event
 * stream and fires the recorded control-plane calls mid-run.
 *
 *   web lane:      POST /api/chat (minted air_session cookie), then consume
 *                  /api/chat/{run_id}/events to terminal — the terminal
 *                  scanner only closes agent_runs once the stream is read.
 *   imessage lane: POST /api/inbound/imessage with a valid v0 HMAC, then
 *                  poll the stub until the replayed run settles.
 *
 * Assertions per (case, lane):
 *   - the stub run reached run.completed (the stream terminated cleanly);
 *   - must_do regexes match the run's action evidence IN ORDER — tool
 *     previews plus the control-plane calls the replay fired;
 *   - no must_not_do regex matches that same evidence;
 *   - expected_decision_kind !== "none" → a decisions row of that kind is
 *     pending inside the case window;
 *   - expected_decision_kind === "none" on a non-adversarial case → zero
 *     decisions were filed in the window (adversarial cases tolerate
 *     decisions — the gate is "no forbidden action", not "no decision");
 *   - per-case write assertions below (agent_schedules, payment_requests…);
 *   - imessage lane also asserts the recording sender put at least one
 *     reply on the line.
 *
 * Env: WEB_ORIGIN, STUB_URL, EVAL_SUPA_URL (+SUPABASE_SERVICE_ROLE_KEY),
 * SESSION_SECRET, SPECTRUM_WEBHOOK_SECRET, STUB_GATEWAY_TOKEN,
 * EVAL_USER_ID, EVAL_USER_PHONE, EVAL_LINE_PHONE, OUTBOX, RESULTS_DIR,
 * LANES ("web,imessage"), CASES (comma subset for debugging).
 */
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSseParser,
  loadCases,
  redact,
  sleep,
  supaSelect,
  type DecisionRow,
  type EvalCase,
  type SseEvent,
} from "../agent-suite/lib";

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_PATH = join(HERE, "../agent-suite/messages.jsonl");
const STREAMS_DIR = join(HERE, "../stub-hermes/streams");

const config = {
  webOrigin: (process.env.WEB_ORIGIN ?? "http://127.0.0.1:3099").replace(/\/+$/, ""),
  stubUrl: (process.env.STUB_URL ?? "http://127.0.0.1:4470").replace(/\/+$/, ""),
  supa: {
    url: (process.env.EVAL_SUPA_URL ?? "http://127.0.0.1:3010").replace(/\/+$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eval-anon",
  },
  userId: process.env.EVAL_USER_ID ?? "",
  userPhone: process.env.EVAL_USER_PHONE ?? "+15555550199",
  linePhone: process.env.EVAL_LINE_PHONE ?? "+15555550100",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  webhookSecret: process.env.SPECTRUM_WEBHOOK_SECRET ?? "",
  outbox: process.env.OUTBOX ?? "",
  resultsDir: process.env.RESULTS_DIR ?? join(HERE, "results", new Date().toISOString().replace(/[:.]/g, "-")),
  lanes: (process.env.LANES ?? "web,imessage").split(",").map((s) => s.trim()).filter(Boolean),
  cases: (process.env.CASES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  /** imessage flush latency budget: debounce (~2.5s) + wake + stream. */
  imessageTimeoutMs: Number(process.env.EVAL_IMESSAGE_TIMEOUT_MS ?? 120_000),
  webTimeoutMs: Number(process.env.EVAL_WEB_TIMEOUT_MS ?? 60_000),
  settleMs: Number(process.env.EVAL_SETTLE_MS ?? 1_500),
};

if (!config.userId) throw new Error("EVAL_USER_ID is required (see lane.sh)");
if (!config.sessionSecret) throw new Error("SESSION_SECRET is required");
if (!config.webhookSecret) throw new Error("SPECTRUM_WEBHOOK_SECRET is required");

// ── harness plumbing ────────────────────────────────────────────────────────

function sessionCookie(userId: string): string {
  const b64 = (value: string) => Buffer.from(value).toString("base64url");
  const payload = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })
  )}`;
  const sig = createHmac("sha256", config.sessionSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function spectrumSignature(rawBody: string): { signature: string; timestamp: string } {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", config.webhookSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex");
  return { signature: `v0=${signature}`, timestamp };
}

interface Step {
  sse?: Record<string, unknown>;
  call?: { method: string; path: string; body?: unknown; auth?: string };
  delay_ms?: number;
  comment?: string;
}

function loadSteps(caseId: string): Step[] {
  const file = join(STREAMS_DIR, `${caseId}.jsonl`);
  if (!existsSync(file)) throw new Error(`missing stream fixture ${file}`);
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Step);
}

async function stubFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${config.stubUrl}${path}`, init);
}

async function registerFixture(caseId: string, lane: string, steps: Step[]): Promise<void> {
  // $LANE lets one fixture file serve both drives while keeping ids unique
  // (draft refs, idempotency keys).
  const substituted = JSON.stringify(steps).replaceAll("$LANE", lane);
  const res = await stubFetch("/__eval__/fixture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ case_id: caseId, lane, steps: JSON.parse(substituted) }),
  });
  if (!res.ok) throw new Error(`fixture register failed: ${res.status}`);
}

/** Every drafts/review call needs the draft served from /v0 first. */
async function registerDrafts(caseId: string, lane: string, steps: Step[]): Promise<void> {
  for (const step of steps) {
    if (!step.call || step.call.path !== "/api/email/drafts/review") continue;
    const body = step.call.body as { draft_id?: string; inbox_id?: string };
    const draftId = (body.draft_id ?? "").replaceAll("$LANE", lane);
    const inboxId = (body.inbox_id ?? "inbox-eval").replaceAll("$LANE", lane);
    await stubFetch("/__eval__/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inbox_id: inboxId,
        draft_id: draftId,
        data: {
          draft_id: draftId,
          inbox_id: inboxId,
          to: ["eval@example.com"],
          subject: `eval draft ${caseId}`,
          body: "Recorded reply text.",
        },
      }),
    });
  }
}

interface StubRun {
  run_id: string;
  case_id: string;
  lane: string;
  status: string;
  events: SseEvent[];
  calls: { method: string; path: string; status: number; body?: unknown }[];
}

async function stubRuns(): Promise<{ runs: StubRun[] }> {
  const res = await stubFetch("/__eval__/runs");
  return (await res.json()) as { runs: StubRun[] };
}

// ── drives ──────────────────────────────────────────────────────────────────

async function driveWeb(laneCase: EvalCase): Promise<StubRun | null> {
  const cookie = sessionCookie(config.userId);
  const started = await fetch(`${config.webOrigin}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `air_session=${cookie}`,
    },
    body: JSON.stringify({ input: laneCase.message }),
  });
  if (!started.ok) {
    throw new Error(`POST /api/chat → ${started.status}: ${(await started.text()).slice(0, 200)}`);
  }
  const { run_id } = (await started.json()) as { run_id?: string };
  if (!run_id) throw new Error("POST /api/chat returned no run_id");

  // Consume the re-streamed events to terminal — this is what flips
  // agent_runs.outcome and fires the fixture's recorded calls mid-stream.
  const parser = createSseParser();
  const deadline = Date.now() + config.webTimeoutMs;
  const eventsRes = await fetch(`${config.webOrigin}/api/chat/${run_id}/events`, {
    headers: { cookie: `air_session=${cookie}` },
  });
  if (!eventsRes.ok || !eventsRes.body) {
    throw new Error(`GET /api/chat/${run_id}/events → ${eventsRes.status}`);
  }
  const reader = eventsRes.body.getReader();
  const decoder = new TextDecoder();
  let terminal = false;
  while (Date.now() < deadline) {
    const { done, value } = await Promise.race([
      reader.read(),
      sleep(1000).then(() => ({ done: false, value: undefined as Uint8Array | undefined })),
    ]);
    if (done) break;
    if (!value) continue;
    for (const event of parser(decoder.decode(value, { stream: true }))) {
      if (event.event === "run.completed" || event.event === "run.failed") {
        terminal = true;
      }
    }
    if (terminal) break;
  }
  await reader.cancel().catch(() => undefined);
  if (!terminal) throw new Error(`web run ${run_id} never reached a terminal event`);

  await sleep(config.settleMs);
  const { runs } = await stubRuns();
  return runs.findLast((run) => run.case_id === laneCase.id && run.lane === "web") ?? null;
}

async function driveImessage(laneCase: EvalCase): Promise<StubRun | null> {
  const rawBody = JSON.stringify({
    event: "messages",
    space: { id: `chat-${laneCase.id}`, phone: config.linePhone, platform: "imessage" },
    message: {
      id: `eval-${laneCase.id}-${Date.now()}`,
      direction: "inbound",
      platform: "imessage",
      sender: { id: config.userPhone },
      content: { type: "text", text: laneCase.message },
    },
  });
  const { signature, timestamp } = spectrumSignature(rawBody);
  const res = await fetch(`${config.webOrigin}/api/inbound/imessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-spectrum-event": "messages",
      "x-spectrum-signature": signature,
      "x-spectrum-timestamp": timestamp,
      "x-spectrum-webhook-id": `wh-${laneCase.id}`,
    },
    body: rawBody,
  });
  if (res.status !== 200) {
    throw new Error(`POST /api/inbound/imessage → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const deadline = Date.now() + config.imessageTimeoutMs;
  let run: StubRun | undefined;
  while (Date.now() < deadline) {
    const { runs } = await stubRuns();
    run = runs.findLast((entry) => entry.case_id === laneCase.id && entry.lane === "imessage");
    if (run && (run.status === "completed" || run.status === "failed")) break;
    await sleep(500);
  }
  if (!run) throw new Error(`imessage drive for ${laneCase.id} never reached the stub`);
  if (run.status !== "completed" && run.status !== "failed") {
    throw new Error(`imessage run ${run.run_id} stuck in ${run.status} past ${config.imessageTimeoutMs}ms`);
  }
  await sleep(config.settleMs);
  return run;
}

// ── assertions ──────────────────────────────────────────────────────────────

function actionEvidence(run: StubRun): string {
  const toolEvidence = run.events
    .filter((event) => event.event === "tool.started")
    .map((event) => `${event.tool ?? ""} ${event.preview ?? ""}`);
  const deltas = run.events
    .filter((event) => event.event === "message.delta")
    .map((event) => String(event.delta ?? ""));
  const completed = run.events.find((event) => event.event === "run.completed");
  const callEvidence = run.calls.map(
    (call) => `${call.method} ${call.path} ${call.status} ${JSON.stringify(call.body ?? {})}`
  );
  return [
    toolEvidence.join("\n"),
    callEvidence.join("\n"),
    deltas.join(""),
    typeof completed?.output === "string" ? completed.output : "",
  ].join("\n");
}

function firstMissingInOrder(patterns: string[], evidence: string): string | null {
  let offset = 0;
  for (const pattern of patterns) {
    const match = new RegExp(pattern, "i").exec(evidence.slice(offset));
    if (!match) return pattern;
    offset += match.index + match[0].length;
  }
  return null;
}

function firstForbidden(patterns: string[], evidence: string): string | null {
  for (const pattern of patterns) {
    if (new RegExp(pattern, "i").test(evidence)) return pattern;
  }
  return null;
}

interface OutboxEntry {
  ts: string;
  method: string;
  args: unknown;
}

function outboxEntries(): OutboxEntry[] {
  if (!config.outbox || !existsSync(config.outbox)) return [];
  return readFileSync(config.outbox, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboxEntry);
}

const OUTBOUND_METHODS = new Set([
  "sendText",
  "sendReply",
  "streamText",
  "sendApp",
  "sendRichLink",
  "sendAttachment",
]);

interface ExtraAssert {
  /** PostgREST table + query fragment asserting a write the case demands. */
  table: string;
  query: string;
  note: string;
}

/**
 * Writes the contract asserts beyond the decisions row. K165's reminder
 * must land as an agent_schedules row; A106's event-tied one_shot is the
 * known product gap the lane surfaces honestly (the box cannot reach the
 * session-only /api/calendar/remind route).
 */
const CASE_EXTRA_ASSERTS: Record<string, ExtraAssert[]> = {
  A106: [
    {
      table: "agent_schedules",
      query: "one_shot=eq.true&source=eq.calendar",
      note: "event-tied one-shot reminder persisted (POST /api/calendar/remind)",
    },
  ],
  K165: [
    {
      table: "agent_schedules",
      query: "",
      note: "reminder persisted as an automation",
    },
  ],
  F105: [
    {
      table: "payment_requests",
      query: "",
      note: "spend request filed as a payment_request row",
    },
  ],
  K155: [
    {
      table: "agent_schedules",
      query: "",
      note: "price watch persisted as an automation",
    },
  ],
  K170: [
    {
      table: "agent_schedules",
      query: "",
      note: "conditional follow-up watch persisted",
    },
  ],
};

interface LaneResult {
  case_id: string;
  lane: string;
  pass: boolean;
  /** The drive failed inside the known product gaps below — reported, non-fatal. */
  xfail: boolean;
  failures: string[];
  run_id: string | null;
  run_status: string | null;
  calls: { method: string; path: string; status: number }[];
  decisions: DecisionRow[];
  error: string | null;
}

/**
 * Product bugs the lane surfaces — a drive failing ONLY with these listed
 * gaps is reported as XFAIL and does not fail the suite. Anything else
 * failing, or a listed gap unexpectedly passing (XPASS — the bug got fixed
 * and the baseline needs updating), fails CI.
 *
 * - A106: `POST /api/calendar/remind` is session-cookie-only, so the box has
 *   no credential path to file an event-tied one-shot reminder — it 401s and
 *   no agent_schedules row lands. The route needs a box-token path.
 * - K196: `vault_fill` is a legal decision kind but the kernel_actions filer
 *   is disabled by default — a vault-fill turn files nothing.
 */
const KNOWN_GAPS: Record<string, string> = {
  "A106:web":
    "POST /api/calendar/remind rejects box credentials (session-cookie-only) — no filer for one-shot reminders",
  "A106:imessage":
    "POST /api/calendar/remind rejects box credentials (session-cookie-only) — no filer for one-shot reminders",
  "K196:web":
    "decision kind 'vault_fill' has no control-plane filer (kernel_actions path is off by default)",
  "K196:imessage":
    "decision kind 'vault_fill' has no control-plane filer (kernel_actions path is off by default)",
};

async function assertDrive(
  laneCase: EvalCase,
  lane: string,
  run: StubRun | null,
  windowStart: string
): Promise<LaneResult> {
  const failures: string[] = [];
  const windowEnd = new Date().toISOString();
  const result: LaneResult = {
    case_id: laneCase.id,
    lane,
    pass: false,
    xfail: false,
    failures,
    run_id: run?.run_id ?? null,
    run_status: run?.status ?? null,
    calls: (run?.calls ?? []).map(({ method, path, status }) => ({ method, path, status })),
    decisions: [],
    error: null,
  };
  if (!run) {
    failures.push("no stub run observed for this drive");
    return result;
  }
  if (run.status !== "completed") {
    failures.push(`run did not complete (status=${run.status})`);
  }

  const evidence = actionEvidence(run);
  const missing = firstMissingInOrder(laneCase.must_do, evidence);
  if (missing) failures.push(`must_do unmet: /${missing}/ never matched in order`);
  const forbidden = firstForbidden(laneCase.must_not_do, evidence);
  if (forbidden) failures.push(`must_not_do hit: /${forbidden}/ matched evidence`);

  const decisions = await supaSelect<DecisionRow>(
    config.supa,
    "decisions",
    `user_id=eq.${config.userId}&created_at=gte.${windowStart}&created_at=lte.${windowEnd}&select=kind,status,label,platform,ref,created_at`
  );
  result.decisions = decisions.map((row) => ({ ...row, payload_keys: [] }));

  const expected = laneCase.expected_decision_kind;
  if (expected !== "none") {
    const pending = decisions.filter(
      (row) => row.kind === expected && /pending/i.test(row.status ?? "")
    );
    if (pending.length === 0) {
      failures.push(
        `no pending decisions row with kind=${expected} (saw ${JSON.stringify(
          decisions.map((row) => `${row.kind}:${row.status}`)
        )})`
      );
    }
  } else if (laneCase.category !== "adversarial" && decisions.length > 0) {
    failures.push(
      `expected zero decisions; found ${JSON.stringify(
        decisions.map((row) => `${row.kind}:${row.status}`)
      )}`
    );
  }

  for (const extra of CASE_EXTRA_ASSERTS[laneCase.id] ?? []) {
    const joiner = extra.query ? `&${extra.query}` : "";
    const rows = await supaSelect<Record<string, unknown>>(
      config.supa,
      extra.table,
      `user_id=eq.${config.userId}&created_at=gte.${windowStart}&created_at=lte.${windowEnd}${joiner}&select=*`
    ).catch(() => [] as Record<string, unknown>[]);
    if (rows.length === 0) failures.push(`write missing: ${extra.table} — ${extra.note}`);
  }

  if (lane === "imessage") {
    const sent = outboxEntries().filter(
      (entry) => entry.ts >= windowStart && OUTBOUND_METHODS.has(entry.method)
    );
    if (sent.length === 0) {
      failures.push("no outbound iMessage reply recorded on the line");
    }
  }

  result.pass = failures.length === 0;
  return result;
}

/** A drive fails INSIDE a known gap only when every failure is the gap itself. */
function matchesKnownGap(laneCase: EvalCase, lane: string, result: LaneResult): boolean {
  const gap = KNOWN_GAPS[`${laneCase.id}:${lane}`];
  if (!gap || result.pass) return false;
  // The gap manifests as exactly the listed write/decision absence — a second
  // failure mode (drive error, must_not_do hit, extra missing write) is real.
  return result.failures.every(
    (failure) =>
      failure.includes("agent_schedules") ||
      failure.includes("decisions row") ||
      failure.includes("write missing")
  );
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const gated = loadCases(CASES_PATH).filter(
    (laneCase) => laneCase.must_do.length > 0 || laneCase.must_not_do.length > 0
  );
  const selected = config.cases.length
    ? gated.filter((laneCase) => config.cases.includes(laneCase.id))
    : gated;
  if (selected.length === 0) throw new Error("no gated cases selected");
  console.log(`contract eval: ${selected.length} cases × lanes ${config.lanes.join("+")}`);

  // Tell the stub which air_session cookie the recorded "session"-auth calls
  // should replay under (none in the current streams — the seam exists for
  // honesty, not use).
  await stubFetch("/__eval__/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cookie: sessionCookie(config.userId) }),
  }).catch(() => undefined);

  mkdirSync(config.resultsDir, { recursive: true });
  const results: LaneResult[] = [];

  for (const laneCase of selected) {
    for (const lane of config.lanes) {
      const steps = loadSteps(laneCase.id);
      await registerDrafts(laneCase.id, lane, steps);
      await registerFixture(laneCase.id, lane, steps);
      const windowStart = new Date().toISOString();
      let result: LaneResult;
      try {
        const run = lane === "imessage"
          ? await driveImessage(laneCase)
          : await driveWeb(laneCase);
        result = await assertDrive(laneCase, lane, run, windowStart);
        result.xfail = matchesKnownGap(laneCase, lane, result);
      } catch (error) {
        // A drive that errored before createRun leaves its fixture queued —
        // the next POST /v1/runs would pop it and misalign every later case.
        await stubFetch("/__eval__/drain", { method: "POST" }).catch(() => undefined);
        result = {
          case_id: laneCase.id,
          lane,
          pass: false,
          xfail: false,
          failures: [`drive error: ${error instanceof Error ? error.message : String(error)}`],
          run_id: null,
          run_status: null,
          calls: [],
          decisions: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
      // XPASS: a listed gap went green — the product bug was fixed and the
      // KNOWN_GAPS baseline is stale; fail loudly so the list gets updated.
      const gap = KNOWN_GAPS[`${laneCase.id}:${lane}`];
      if (result.pass && gap) {
        result.xfail = false;
        result.pass = false;
        result.failures.push(`unexpected pass — known gap closed, remove it from KNOWN_GAPS: ${gap}`);
      }
      results.push(result);
      const mark = result.pass ? "PASS" : result.xfail ? "XFAIL" : "FAIL";
      console.log(
        `${mark} ${result.case_id} (${lane})${
          result.failures.length ? ` — ${result.failures.join(" | ")}` : ""
        }`
      );
    }
  }

  const summary = {
    started: results[0] ? new Date().toISOString() : null,
    cases: selected.length,
    lanes: config.lanes,
    runs: results.length,
    passed: results.filter((result) => result.pass).length,
    xfailed: results.filter((result) => result.xfail).length,
    failed: results.filter((result) => !result.pass && !result.xfail).length,
    known_gaps: KNOWN_GAPS,
    results: results.map((result) => ({
      ...result,
      decisions: result.decisions.map((row) => ({
        kind: row.kind,
        status: row.status,
        label: row.label ? redact(row.label).slice(0, 120) : null,
      })),
    })),
  };
  const out = join(config.resultsDir, "results.json");
  writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(
    `\n${summary.passed}/${summary.runs} drive assertions passed` +
      (summary.xfailed ? `, ${summary.xfailed} expected-fail (known gaps)` : "") +
      ` → ${out}`
  );
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`contract eval runner failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
