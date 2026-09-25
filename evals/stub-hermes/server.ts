/**
 * Stub Hermes + fake internet for the contract-eval lane (R-EV-07).
 *
 * One process serves every external surface the control plane talks to:
 *
 *   api_server (boxes.hosted_url + _port_auth/API_SERVER_KEY auth):
 *     GET  /health
 *     POST /v1/runs {input, session_id, conversation_history?, metadata?}
 *     GET  /v1/runs/{id}/events          (SSE: tool.started/message.delta/run.completed)
 *     POST /v1/runs/{id}/stop | /approval
 *     GET|POST /api/sessions             (POST {id,title} → 200 | 409)
 *     GET  /api/sessions/{id}/messages   → {messages: [{role, content, created_at}]}
 *     GET|POST /api/jobs, GET|PATCH|DELETE /api/jobs/{id},
 *     POST /api/jobs/{id}/run|pause|resume
 *
 *   Box provider API (BOX_API_BASE):
 *     GET /boxes/{id} → {ok, box:{id,state:"ready"}}
 *     POST /boxes/{id}/commands {command,timeoutSeconds} → {exitCode,stdout,stderr}
 *     PUT /boxes/{id}/files {path,content}
 *     POST /boxes/{id}/resume|stop|desktop
 *
 *   Model provider (MODEL_PROVIDER_BASE_URL → this stub):
 *     POST /v1/chat/completions → OpenAI-shaped completion
 *     POST /v1/responses        → Responses-API shape
 *
 *   wzrdmail (WZRDMAIL_BASE_URL → this stub):
 *     GET /v0/inboxes/{inbox}/drafts/{draft} → registered fixture draft
 *     (everything else under /v0 → {})
 *
 *   PostgREST proxy (second listener, SUPABASE_URL → here):
 *     /rest/v1/* → PGRST_UPSTREAM/*  (table + rpc calls alike)
 *
 *   Eval control plane (no auth — localhost only):
 *     POST /__eval__/fixture {case_id, lane, steps[]}
 *     GET  /__eval__/runs
 *     POST /__eval__/draft {inbox_id, draft_id, data}
 *     POST /__eval__/reset
 *
 * A run replays one fixture: an ordered list of steps. "sse" steps emit SSE
 * events on the events stream; "call" steps fire the recorded side-effect
 * HTTP request at the real control plane (WEB_ORIGIN) while the stream is
 * open, which is exactly when owner-initiated checks (open agent_runs /
 * in-flight flush_jobs) hold true.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, readdirSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const config = {
  port: Number(process.env.STUB_PORT ?? 4470),
  supaPort: Number(process.env.STUB_SUPA_PORT ?? 4499),
  webOrigin: (process.env.WEB_ORIGIN ?? "http://127.0.0.1:3099").replace(/\/+$/, ""),
  gatewayToken: process.env.STUB_GATEWAY_TOKEN ?? "eval-gateway-token",
  sessionCookie: process.env.STUB_SESSION_COOKIE ?? "",
  pgrstUpstream: (process.env.PGRST_UPSTREAM ?? "http://127.0.0.1:3010").replace(/\/+$/, ""),
  streamsDir: process.env.STREAMS_DIR ?? join(HERE, "streams"),
  /** Everything the stub sees is appended here as JSONL for postmortems. */
  logFile: process.env.STUB_LOG ?? "",
};

interface SseStep {
  sse: Record<string, unknown>;
}
interface CallStep {
  call: {
    method: string;
    path: string;
    body?: unknown;
    /** "gateway" (Bearer boxes.gateway_token, default), "session" (air_session
     * cookie), or "none". */
    auth?: string;
  };
}
interface DelayStep {
  delay_ms: number;
}
interface CommentStep {
  comment: string;
}
type Step = SseStep | CallStep | DelayStep | CommentStep;

interface Fixture {
  case_id: string;
  lane: string;
  steps: Step[];
  /** Optional pre-seeded transcript for the run's session. */
  history?: { role: string; content: string }[];
}

interface RunRecord {
  run_id: string;
  case_id: string;
  lane: string;
  session_id?: string;
  input: string;
  status: "pending" | "streaming" | "completed" | "failed";
  events: Record<string, unknown>[];
  calls: { method: string; path: string; status: number; body?: unknown }[];
  created_at: string;
}

const pendingFixtures: Fixture[] = [];
const runs = new Map<string, RunRecord>();
const sessions = new Map<string, { title: string; messages: { role: string; content: string; created_at: number }[] }>();
const drafts = new Map<string, Record<string, unknown>>();
const jobs = new Map<string, Record<string, unknown>>();
let runCounter = 0;

function log(entry: Record<string, unknown>): void {
  if (!config.logFile) return;
  try {
    mkdirSync(dirname(config.logFile), { recursive: true });
    appendFileSync(config.logFile, `${JSON.stringify(entry)}\n`);
  } catch {
    /* recording is best-effort */
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(text);
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fire the recorded side-effect at the real control plane. */
async function fireCall(
  run: RunRecord,
  step: CallStep["call"]
): Promise<void> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if ((step.auth ?? "gateway") === "gateway") {
    headers.authorization = `Bearer ${config.gatewayToken}`;
  } else if (step.auth === "session") {
    headers.cookie = `air_session=${config.sessionCookie}`;
  }
  let status = 0;
  try {
    const response = await fetch(`${config.webOrigin}${step.path}`, {
      method: step.method,
      headers,
      ...(step.body !== undefined ? { body: JSON.stringify(step.body) } : {}),
    });
    status = response.status;
    // Read the body to completion so the request is not left dangling.
    await response.arrayBuffer().catch(() => undefined);
  } catch (error) {
    status = -1;
    log({ at: "call_failed", run: run.run_id, step, error: String(error) });
  }
  run.calls.push({ method: step.method, path: step.path, status, body: step.body });
  log({ at: "call", run: run.run_id, method: step.method, path: step.path, status });
}

async function createRunRecord(
  body: Record<string, unknown>
): Promise<RunRecord | null> {
  const fixture = pendingFixtures.shift();
  if (!fixture) return null;
  const runId = `eval-run-${++runCounter}`;
  const run: RunRecord = {
    run_id: runId,
    case_id: fixture.case_id,
    lane: fixture.lane,
    session_id: typeof body.session_id === "string" ? body.session_id : undefined,
    input: typeof body.input === "string" ? body.input : "",
    status: "pending",
    events: [],
    calls: [],
    created_at: new Date().toISOString(),
  };
  (run as { fixture?: Fixture }).fixture = fixture;
  runs.set(runId, run);
  // Transcript bookkeeping: the input becomes a user message on the session.
  const sessionId = run.session_id;
  if (sessionId) {
    const session = sessions.get(sessionId) ?? { title: sessionId, messages: [] };
    if (!sessions.has(sessionId) && fixture.history) {
      for (const [index, message] of fixture.history.entries()) {
        session.messages.push({ role: message.role, content: message.content, created_at: index });
      }
    }
    session.messages.push({ role: "user", content: run.input, created_at: session.messages.length });
    sessions.set(sessionId, session);
  }
  return run;
}

async function streamRunEvents(
  run: RunRecord,
  res: ServerResponse
): Promise<void> {
  const fixture = (run as { fixture?: Fixture }).fixture;
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  run.status = "streaming";
  const steps = fixture?.steps ?? [
    { sse: { event: "run.completed", output: "" } } satisfies Step,
  ];
  for (const step of steps) {
    if ("delay_ms" in step) {
      await sleep(step.delay_ms);
      continue;
    }
    if ("comment" in step) continue;
    if ("call" in step) {
      await fireCall(run, step.call);
      continue;
    }
    if ("sse" in step) {
      const event = step.sse;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      run.events.push(event);
      if (event.event === "run.completed" || event.event === "run.failed") {
        run.status = event.event === "run.completed" ? "completed" : "failed";
        const sessionId = run.session_id;
        const session = sessionId ? sessions.get(sessionId) : undefined;
        if (session) {
          session.messages.push({
            role: "assistant",
            content: typeof event.output === "string" ? event.output : "",
            created_at: session.messages.length,
          });
        }
      }
    }
  }
  if (run.status === "streaming") run.status = "completed";
  res.end();
}

// ── api_server surface ──────────────────────────────────────────────────────

async function handleApiServer(
  request: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === "/health" && request.method === "GET") {
    json(res, 200, { ok: true });
    return true;
  }
  if (pathname === "/v1/runs" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)).toString() || "{}");
    const run = await createRunRecord(body);
    if (!run) {
      json(res, 503, { error: "no fixture registered for this run" });
      return true;
    }
    log({ at: "run_created", run_id: run.run_id, case_id: run.case_id, input: run.input.slice(0, 80) });
    json(res, 200, { run_id: run.run_id });
    return true;
  }
  const runMatch = /^\/v1\/runs\/([^/]+)\/(events|stop|approval)$/.exec(pathname);
  if (runMatch) {
    const runId = runMatch[1]!;
    const action = runMatch[2]!;
    const run = runs.get(runId);
    if (!run) {
      json(res, 404, { error: "unknown run" });
      return true;
    }
    if (action === "events" && request.method === "GET") {
      await streamRunEvents(run, res);
      return true;
    }
    if (action === "stop" && request.method === "POST") {
      run.status = "completed";
      json(res, 200, { ok: true });
      return true;
    }
    if (action === "approval" && request.method === "POST") {
      await readBody(request);
      json(res, 200, { ok: true });
      return true;
    }
  }
  if (pathname === "/api/sessions") {
    if (request.method === "GET") {
      json(res, 200, {
        sessions: [...sessions.entries()].map(([id, s]) => ({
          id,
          title: s.title,
          message_count: s.messages.length,
        })),
      });
      return true;
    }
    if (request.method === "POST") {
      const body = JSON.parse((await readBody(request)).toString() || "{}");
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) {
        json(res, 400, { error: "id required" });
        return true;
      }
      if (sessions.has(id)) {
        json(res, 409, { error: "session exists" });
        return true;
      }
      sessions.set(id, {
        title: typeof body.title === "string" ? body.title : id,
        messages: [],
      });
      json(res, 200, { created: true });
      return true;
    }
  }
  const messagesMatch = /^\/api\/sessions\/([^/]+)\/messages$/.exec(pathname);
  if (messagesMatch && request.method === "GET") {
    const session = sessions.get(decodeURIComponent(messagesMatch[1]!));
    json(res, 200, { messages: session?.messages ?? [] });
    return true;
  }
  if (pathname === "/api/jobs") {
    if (request.method === "GET") {
      json(res, 200, { jobs: [...jobs.values()] });
      return true;
    }
    if (request.method === "POST") {
      const body = JSON.parse((await readBody(request)).toString() || "{}");
      const id = `job-${jobs.size + 1}`;
      const job = { id, enabled: true, ...body };
      jobs.set(id, job);
      json(res, 200, job);
      return true;
    }
  }
  const jobMatch = /^\/api\/jobs\/([^/]+)(?:\/(run|pause|resume))?$/.exec(pathname);
  if (jobMatch) {
    const job = jobs.get(decodeURIComponent(jobMatch[1]!));
    if (!job) {
      json(res, 404, { error: "unknown job" });
      return true;
    }
    if (request.method === "GET") {
      json(res, 200, job);
      return true;
    }
    if (request.method === "PATCH") {
      Object.assign(job, JSON.parse((await readBody(request)).toString() || "{}"));
      json(res, 200, job);
      return true;
    }
    if (request.method === "DELETE") {
      jobs.delete(decodeURIComponent(jobMatch[1]!));
      json(res, 200, { ok: true });
      return true;
    }
    if (request.method === "POST" && jobMatch[2]) {
      json(res, 200, { job });
      return true;
    }
  }
  return false;
}

// ── Box provider API ────────────────────────────────────────────────────────

async function handleBoxProvider(
  request: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  const match = /^\/boxes\/([^/]+)(\/(commands|files|resume|stop|desktop|fork))?$/.exec(
    pathname
  );
  if (!match) return false;
  const boxId = match[1]!;
  const action = match[3] ?? "";
  if (request.method === "GET" && !action) {
    json(res, 200, { ok: true, id: boxId, box: { id: boxId, state: "ready" } });
    return true;
  }
  if (request.method === "POST" && action === "commands") {
    const body = JSON.parse((await readBody(request)).toString() || "{}");
    const command = typeof body.command === "string" ? body.command : "";
    log({ at: "box_command", box: boxId, command: command.slice(0, 300) });
    // The host-route registration command is the only one whose stdout the
    // control plane parses — answer it with a synthetic hosted URL that points
    // back at this stub so a refresh keeps targeting the fake.
    if (command.includes("host url")) {
      json(res, 200, {
        exitCode: 0,
        stdout: `https://stub-8642.on.ascii.dev?_token=stub-token\n`,
        stderr: "",
      });
      return true;
    }
    json(res, 200, { exitCode: 0, stdout: "", stderr: "" });
    return true;
  }
  if (request.method === "PUT" && action === "files") {
    await readBody(request);
    json(res, 200, { ok: true });
    return true;
  }
  if (request.method === "POST" && (action === "resume" || action === "stop")) {
    json(res, 200, {
      ok: true,
      id: boxId,
      box: { id: boxId, state: action === "resume" ? "ready" : "stopped" },
    });
    return true;
  }
  if (request.method === "POST" && action === "desktop") {
    json(res, 200, { ok: true, desktopUrl: "http://127.0.0.1/unused" });
    return true;
  }
  if (request.method === "POST" && action === "fork") {
    json(res, 200, { ok: true, id: "bx_fork_stub", box: { id: "bx_fork_stub", state: "ready" } });
    return true;
  }
  if (request.method === "PATCH" && !action) {
    await readBody(request);
    json(res, 200, { ok: true, id: boxId, box: { id: boxId, state: "ready" } });
    return true;
  }
  if (request.method === "DELETE" && !action) {
    json(res, 200, { ok: true });
    return true;
  }
  return false;
}

// ── model provider ──────────────────────────────────────────────────────────

function completionBody(model: string, content: string): Record<string, unknown> {
  return {
    id: "chatcmpl-eval",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
  };
}

async function handleModelProvider(
  request: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === "/v1/chat/completions" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)).toString() || "{}");
    json(res, 200, completionBody(String(body.model ?? "stub"), "Acknowledged."));
    return true;
  }
  if (pathname === "/v1/responses" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)).toString() || "{}");
    json(res, 200, {
      id: "resp-eval",
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      model: String(body.model ?? "stub"),
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Acknowledged." }],
        },
      ],
      output_text: "Acknowledged.",
      usage: { input_tokens: 8, output_tokens: 4, total_tokens: 12 },
    });
    return true;
  }
  if (pathname === "/v1/models" && request.method === "GET") {
    json(res, 200, { object: "list", data: [{ id: "stub-model", object: "model" }] });
    return true;
  }
  return false;
}

// ── wzrdmail ────────────────────────────────────────────────────────────────

async function handleMail(
  request: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  const draftMatch = /^\/v0\/inboxes\/([^/]+)\/drafts\/([^/]+)$/.exec(pathname);
  if (draftMatch && request.method === "GET") {
    const key = `${decodeURIComponent(draftMatch[1]!)}/${decodeURIComponent(draftMatch[2]!)}`;
    const draft = drafts.get(key);
    if (!draft) {
      json(res, 404, { error: "draft not found" });
      return true;
    }
    json(res, 200, draft);
    return true;
  }
  if (pathname.startsWith("/v0/")) {
    await readBody(request).catch(() => undefined);
    json(res, 200, { ok: true });
    return true;
  }
  return false;
}

// ── eval control API ────────────────────────────────────────────────────────

async function handleEvalControl(
  request: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === "/__eval__/fixture" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)).toString() || "{}");
    pendingFixtures.push({
      case_id: String(body.case_id ?? ""),
      lane: String(body.lane ?? "web"),
      steps: Array.isArray(body.steps) ? (body.steps as Step[]) : [],
      history: Array.isArray(body.history) ? body.history : undefined,
    });
    json(res, 200, { pending: pendingFixtures.length });
    return true;
  }
  if (pathname === "/__eval__/draft" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)).toString() || "{}");
    const key = `${body.inbox_id}/${body.draft_id}`;
    drafts.set(key, body.data ?? { to: [], subject: "" });
    json(res, 200, { ok: true });
    return true;
  }
  if (pathname === "/__eval__/session" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)).toString() || "{}");
    config.sessionCookie = typeof body.cookie === "string" ? body.cookie : "";
    json(res, 200, { ok: true });
    return true;
  }
  if (pathname === "/__eval__/runs" && request.method === "GET") {
    json(res, 200, {
      runs: [...runs.values()].map((run) => ({
        run_id: run.run_id,
        case_id: run.case_id,
        lane: run.lane,
        session_id: run.session_id,
        status: run.status,
        events: run.events,
        calls: run.calls,
        input: run.input.slice(0, 120),
        created_at: run.created_at,
      })),
      pending: pendingFixtures.length,
    });
    return true;
  }
  if (pathname === "/__eval__/reset" && request.method === "POST") {
    pendingFixtures.length = 0;
    runs.clear();
    json(res, 200, { ok: true });
    return true;
  }
  if (pathname === "/__eval__/drain" && request.method === "POST") {
    // Drop only the queued fixtures: a drive that errored before createRun
    // leaves its fixture pending, and FIFO popping would then serve it to the
    // NEXT case's run — one early failure cascading into every later drive.
    pendingFixtures.length = 0;
    json(res, 200, { ok: true });
    return true;
  }
  return false;
}

// ── servers ─────────────────────────────────────────────────────────────────

const apiServer = createServer(async (request, res) => {
  const pathname = new URL(request.url ?? "/", "http://stub").pathname;
  try {
    if (await handleEvalControl(request, res, pathname)) return;
    if (await handleApiServer(request, res, pathname)) return;
    if (await handleBoxProvider(request, res, pathname)) return;
    if (await handleModelProvider(request, res, pathname)) return;
    if (await handleMail(request, res, pathname)) return;
    json(res, 404, { error: `stub has no route for ${request.method} ${pathname}` });
  } catch (error) {
    log({ at: "stub_error", path: pathname, error: String(error) });
    json(res, 500, { error: String(error) });
  }
});

/** PostgREST proxy: {SUPA_URL}/rest/v1/* → {PGRST_UPSTREAM}/* */
const supaProxy = createServer(async (request, res) => {
  const url = new URL(request.url ?? "/", "http://stub");
  const upstreamPath = url.pathname.replace(/^\/rest\/v1/, "") + url.search;
  try {
    const headers = { ...(request.headers as Record<string, string>) };
    delete headers.host;
    // supabase-js sends `Authorization: Bearer <service-role-key>`; upstream
    // PostgREST has no JWT secret configured, so a bearer it cannot verify
    // becomes "Server lacks JWT secret". The lane's anon role is the
    // postgres superuser — drop the header and let it apply.
    delete headers.authorization;
    const upstream = await fetch(`${config.pgrstUpstream}${upstreamPath}`, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method ?? "GET")
        ? undefined
        : new Uint8Array(await readBody(request)),
      duplex: "half",
    });
    const responseHeaders: Record<string, string> = {};
    upstream.headers.forEach((value, key) => {
      if (key !== "transfer-encoding" && key !== "connection") {
        responseHeaders[key] = value;
      }
    });
    res.writeHead(upstream.status, responseHeaders);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    log({ at: "supa_proxy_error", path: url.pathname, error: String(error) });
    json(res, 502, { error: `postgrest upstream unreachable: ${String(error)}` });
  }
});

apiServer.listen(config.port, "127.0.0.1", () => {
  console.log(`stub-hermes listening on 127.0.0.1:${config.port}`);
});
supaProxy.listen(config.supaPort, "127.0.0.1", () => {
  console.log(`stub postgrest proxy on 127.0.0.1:${config.supaPort} → ${config.pgrstUpstream}`);
});

// Pre-register fixtures so a drive can start before the runner loads them.
if (process.env.STUB_PRELOAD === "1") {
  for (const file of readdirSync(config.streamsDir).filter((f) => f.endsWith(".jsonl"))) {
    const steps = readFileSync(join(config.streamsDir, file), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as Step);
    const header = steps.find((s): s is CommentStep => "comment" in s);
    pendingFixtures.push({
      case_id: file.replace(/\.jsonl$/, ""),
      lane: "web",
      steps,
      history: undefined,
    });
    void header;
  }
}
