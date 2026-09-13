/**
 * Provider/model bench — compares latency (TTFT + total) and token cost of
 * GMI-served models against the current OpenAI-direct fleet, using payloads
 * shaped like real Hermes turns (long system+history context, tool-bearing
 * calls, delegation children).
 *
 *   GMI_CLOUD_API_KEY=… OPENAI_API_KEY=… npx tsx evals/model-bench/bench.ts
 *
 * Env:
 *   BENCH_N          reps per cell (default 3)
 *   BENCH_ONLY       comma-separated workload ids (short,longctx,toolcall,plan,child,orch)
 *   BENCH_MODELS     comma-separated cell ids (see CELLS)
 *   BENCH_OUT        results JSON path (default results/<stamp>.json)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;

interface Provider {
  baseUrl: string;
  key: string;
}

const PROVIDERS: Record<string, () => Provider> = {
  gmi: () => ({
    baseUrl: "https://api.gmi-serving.com/v1",
    key: requireEnv("GMI_CLOUD_API_KEY"),
  }),
  openai: () => ({
    baseUrl: "https://api.openai.com/v1",
    key: requireEnv("OPENAI_API_KEY"),
  }),
};

interface Cell {
  id: string;
  provider: "gmi" | "openai";
  model: string;
  /** USD per 1M tokens for the cost model; null = publish price TBD. */
  priceIn: number | null;
  priceOut: number | null;
  /** Send reasoning.effort where the API accepts it. */
  effort?: string;
  /** Use /responses instead of /chat/completions (OpenAI lane parity). */
  responses?: boolean;
}

const CELLS: Cell[] = [
  // Current production lanes (OpenAI direct). Luna serves fast+balanced,
  // terra serves deep, both at fast-tier xhigh reasoning via /responses.
  { id: "openai/luna-fast", provider: "openai", model: "gpt-5.6-luna",
    priceIn: 0.4, priceOut: 2.4, effort: "xhigh", responses: true },
  { id: "openai/terra-deep", provider: "openai", model: "gpt-5.6-terra",
    priceIn: 4, priceOut: 24, effort: "xhigh", responses: true },
  // Proposed GMI cells.
  { id: "gmi/astra", provider: "gmi", model: "openai/gpt-6-astra",
    priceIn: 10, priceOut: 50 }, // OpenAI list; GMI console price TBD
  { id: "gmi/luna", provider: "gmi", model: "openai/gpt-5.6-luna",
    priceIn: 0.4, priceOut: 2.4 }, // assume parity w/ OpenAI until confirmed
  { id: "gmi/glm-flash", provider: "gmi", model: "zai-org/GLM-5.3-Flash",
    priceIn: 0.15, priceOut: 0.5 }, // list; promo is $0.075/$0.25
  { id: "gmi/glm-flash-low", provider: "gmi", model: "zai-org/GLM-5.3-Flash",
    priceIn: 0.15, priceOut: 0.5, effort: "low" },
];

// ── Workloads ──────────────────────────────────────────────────────────────

interface Call {
  messages: unknown[];
  tools?: unknown[];
  maxTokens: number;
}

/** ~20k-token synthetic history: mirrors the measured ~22K-token average
 * prompt of a real agent-suite turn (see agent-suite report). */
function longHistory(): unknown[] {
  const msgs: unknown[] = [
    {
      role: "system",
      content:
        "You are a personal agent. You have the owner's calendar, contacts, " +
        "mail, memory, and files. Prefer doing over describing. " +
        "Side effects are staged for approval.",
    },
  ];
  let est = 0;
  let i = 0;
  while (est < 19_000) {
    const turn =
      `Turn ${i}: the owner asked about scheduling around travel, CRM notes ` +
      `for vendors, a draft email to the venue, and a checklist update. ` +
      `Details: load-bearing context line with names, dates, addresses, ` +
      `amounts, and prior decisions the agent must respect. ` +
      `Reference ids: evt_${1000 + i}, msg_${2000 + i}, task_${3000 + i}.`;
    msgs.push({ role: i % 2 ? "assistant" : "user", content: turn.repeat(6) });
    est += turn.length * 6 / 4;
    i++;
  }
  return msgs;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "calendar_list",
      description: "List calendar events in a time range",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string" },
          end: { type: "string" },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "email_create_draft",
      description: "Create an email draft for owner review",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_read",
      description: "Read the owner's memory file",
      parameters: { type: "object", properties: { path: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "task_update",
      description: "Update a task on the owner's list",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string" },
        },
        required: ["id", "status"],
      },
    },
  },
];

const WORKLOADS: Record<string, () => Call> = {
  short: () => ({
    messages: [
      { role: "system", content: "You are a terse personal agent." },
      { role: "user", content: "Reply with exactly: on it." },
    ],
    // Headroom over the target output — GLM-5.3-Flash bills mandatory
    // reasoning inside the same cap, so a tight cap starves the answer.
    maxTokens: 200,
  }),
  longctx: () => ({
    messages: [
      ...longHistory(),
      {
        role: "user",
        content:
          "Summarize in three bullets what is still open from this week.",
      },
    ],
    maxTokens: 900,
  }),
  toolcall: () => ({
    messages: [
      {
        role: "system",
        content:
          "You are a personal agent with tools. Call the right tool; do not answer from memory.",
      },
      {
        role: "user",
        content:
          "What's on my calendar tomorrow morning? Then draft Dana an email proposing Thursday 3pm instead.",
      },
    ],
    tools: TOOLS,
    maxTokens: 1600,
  }),
  plan: () => ({
    messages: [
      {
        role: "system",
        content:
          "You are the orchestrator. Decompose the owner's request into 4 " +
          "independent subtasks for parallel child agents. Respond ONLY with " +
          'JSON: {"subtasks":[{"id":"s1","instruction":"…"}, …]}. Each ' +
          "instruction is self-contained.",
      },
      {
        role: "user",
        content:
          "Research four candidate venues for a 40-person product dinner in " +
          "San Francisco next month: capacity, rough cost, availability " +
          "signals, and one line on vibe.",
      },
    ],
    maxTokens: 1200,
  }),
  child: () => ({
    messages: [
      {
        role: "system",
        content:
          "You are a child agent. Execute the subtask and return a compact " +
          "result: 3 bullets, each under 20 words.",
      },
      {
        role: "user",
        content:
          "Subtask: profile venue candidate 'The Pearl SF' — capacity, rough " +
          "cost, how to check availability, one line on vibe.",
      },
    ],
    maxTokens: 700,
  }),
};

// ── Engine ─────────────────────────────────────────────────────────────────

interface Result {
  cell: string;
  workload: string;
  rep: number;
  ok: boolean;
  ttftMs: number | null;
  totalMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
  toolCalls: number;
  error?: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing ${name}`);
  return v;
}

/** chat/completions (non-streaming) or /responses, timed. */
async function oneCall(p: Provider, cell: Cell, call: Call): Promise<Result["ttftMs"] extends never ? never : {
  totalMs: number; ttftMs: number | null; prompt: number; completion: number; toolCalls: number;
}> {
  const t0 = performance.now();
  if (cell.responses) {
    const input = (call.messages as { role: string; content: string }[]).map(
      (m) => ({ role: m.role, content: m.content })
    );
    const res = await fetch(`${p.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cell.model,
        input,
        store: false,
        max_output_tokens: call.maxTokens,
        ...(call.tools ? { tools: call.tools.map((t) => {
          const fn = (t as { function: Record<string, unknown> }).function;
          return {
            type: "function",
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
          };
        }) } : {}),
        ...(cell.effort ? { reasoning: { effort: cell.effort } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = await res.json() as Record<string, unknown>;
    const usage = (json.usage ?? {}) as Record<string, number>;
    const output = (json.output ?? []) as Record<string, unknown>[];
    return {
      totalMs: performance.now() - t0,
      ttftMs: null,
      prompt: usage.input_tokens ?? 0,
      completion: usage.output_tokens ?? 0,
      toolCalls: output.filter((o) => o.type === "function_call").length,
    };
  }

  // Streaming chat/completions so TTFT is real.
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cell.model,
      messages: call.messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: call.maxTokens,
      ...(call.tools ? { tools: call.tools } : {}),
      ...(cell.effort ? { reasoning_effort: cell.effort } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let ttft: number | null = null;
  let prompt = 0, completion = 0;
  const toolCallIndexes = new Set<number>();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep = buf.indexOf("\n\n");
    while (sep >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data) as {
            usage?: { prompt_tokens?: number; completion_tokens?: number };
            choices?: {
              delta?: {
                content?: string;
                tool_calls?: { index?: number }[];
              };
            }[];
          };
          const d = ev.choices?.[0]?.delta;
          if (d && (d.content || (d.tool_calls && d.tool_calls.length > 0)) && ttft === null) {
            ttft = performance.now() - t0;
          }
          // A streamed call arrives as many deltas sharing one index —
          // count distinct indexes, not chunks. An indexless provider gets
          // the delta array position as the stable fallback so repeats of
          // the same call don't accrete.
          for (const [position, tc] of (d?.tool_calls ?? []).entries()) {
            toolCallIndexes.add(tc.index ?? position);
          }
          if (ev.usage) {
            prompt = ev.usage.prompt_tokens ?? prompt;
            completion = ev.usage.completion_tokens ?? completion;
          }
        } catch { /* keepalive */ }
      }
      sep = buf.indexOf("\n\n");
    }
  }
  return {
    totalMs: performance.now() - t0,
    ttftMs: ttft,
    prompt,
    completion,
    toolCalls: toolCallIndexes.size,
  };
}

function cost(cell: Cell, prompt: number, completion: number): number | null {
  if (cell.priceIn === null || cell.priceOut === null) return null;
  return (prompt * cell.priceIn + completion * cell.priceOut) / 1_000_000;
}

async function runCell(cell: Cell, workload: string, rep: number): Promise<Result> {
  const p = PROVIDERS[cell.provider]();
  const call = WORKLOADS[workload]();
  try {
    const r = await oneCall(p, cell, call);
    return {
      cell: cell.id, workload, rep, ok: true,
      ttftMs: r.ttftMs, totalMs: r.totalMs,
      promptTokens: r.prompt, completionTokens: r.completion,
      costUsd: cost(cell, r.prompt, r.completion),
      toolCalls: r.toolCalls,
    };
  } catch (e) {
    return {
      cell: cell.id, workload, rep, ok: false, ttftMs: null, totalMs: 0,
      promptTokens: 0, completionTokens: 0, costUsd: null, toolCalls: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Orchestration sim: plan on parent cell, 4 children in parallel on child cell. */
async function runOrch(parent: Cell, child: Cell, rep: number): Promise<Result> {
  const t0 = performance.now();
  const planRes = await runCell(parent, "plan", rep);
  let subtasks = 4; // fixed fan-out; plan JSON parse is informational
  try {
    // count not needed — children are fixed-work
    void subtasks;
  } catch { /* default 4 */ }
  const children = await Promise.all(
    [0, 1, 2, 3].map(() => runCell(child, "child", rep))
  );
  const totalMs = performance.now() - t0;
  const all = [planRes, ...children];
  const promptTokens = all.reduce((s, r) => s + r.promptTokens, 0);
  const completionTokens = all.reduce((s, r) => s + r.completionTokens, 0);
  const costUsd = all.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  return {
    cell: `${parent.id}→${child.id}`,
    workload: "orch", rep,
    ok: planRes.ok && children.every((c) => c.ok),
    ttftMs: planRes.ttftMs, totalMs,
    promptTokens, completionTokens, costUsd, toolCalls: 0,
    ...(planRes.ok ? {} : { error: planRes.error }),
  };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

async function main(): Promise<void> {
  const n = Number(process.env.BENCH_N ?? 3);
  const onlyWl = process.env.BENCH_ONLY
    ? new Set(process.env.BENCH_ONLY.split(","))
    : null;
  const onlyCells = process.env.BENCH_MODELS
    ? new Set(process.env.BENCH_MODELS.split(","))
    : null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = process.env.BENCH_OUT ?? join(HERE, "results", `${stamp}.json`);

  const cells = CELLS.filter((c) => !onlyCells || [...onlyCells].some((p) => c.id.startsWith(p)));
  const singles = ["short", "longctx", "toolcall"].filter((w) => !onlyWl || onlyWl.has(w));
  const results: Result[] = [];

  for (const w of singles) {
    for (const c of cells) {
      for (let rep = 0; rep < n; rep++) {
        const r = await runCell(c, w, rep);
        results.push(r);
        console.log(
          `${w.padEnd(8)} ${c.id.padEnd(26)} rep${rep} ` +
          `${r.ok ? `${(r.totalMs / 1000).toFixed(1)}s ttft=${r.ttftMs ? (r.ttftMs / 1000).toFixed(1) + "s" : "—"} ` +
          `${r.promptTokens}→${r.completionTokens} tok ${r.costUsd !== null ? "$" + r.costUsd.toFixed(4) : "$?"} tools=${r.toolCalls}` : `ERR ${r.error}`}`
        );
      }
    }
  }

  if (!onlyWl || onlyWl.has("orch")) {
    const pairs: [Cell, Cell][] = [
      // Proposed: Astra orchestrates, GLM-Flash children.
      [CELLS.find((c) => c.id === "gmi/astra")!, CELLS.find((c) => c.id === "gmi/glm-flash-low")!],
      // Status quo shape: Luna parent, Luna children (fast tier today).
      [CELLS.find((c) => c.id === "openai/luna-fast")!, CELLS.find((c) => c.id === "openai/luna-fast")!],
      // Upper bound: Astra everywhere.
      [CELLS.find((c) => c.id === "gmi/astra")!, CELLS.find((c) => c.id === "gmi/astra")!],
    ];
    for (const [parent, child] of pairs) {
      for (let rep = 0; rep < n; rep++) {
        const r = await runOrch(parent, child, rep);
        results.push(r);
        console.log(
          `orch     ${r.cell.padEnd(44)} rep${rep} ` +
          `${r.ok ? `${(r.totalMs / 1000).toFixed(1)}s ${r.promptTokens}→${r.completionTokens} tok $${r.costUsd?.toFixed(4)}` : `ERR ${r.error}`}`
        );
      }
    }
  }

  mkdirSync(join(HERE, "results"), { recursive: true });
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nwrote ${outPath}`);

  // Compact aggregate printout.
  console.log("\n=== mean by cell × workload ===");
  const keys = [...new Set(results.map((r) => `${r.cell}|${r.workload}`))];
  for (const k of keys) {
    const rs = results.filter((r) => `${r.cell}|${r.workload}` === k && r.ok);
    if (!rs.length) continue;
    const [cell, w] = k.split("|");
    console.log(
      `${w.padEnd(8)} ${cell.padEnd(44)} ` +
      `${(mean(rs.map((r) => r.totalMs)) / 1000).toFixed(1)}s ` +
      `ttft=${(mean(rs.map((r) => r.ttftMs ?? 0)) / 1000).toFixed(1)}s ` +
      `in=${Math.round(mean(rs.map((r) => r.promptTokens)))} out=${Math.round(mean(rs.map((r) => r.completionTokens)))} ` +
      `cost=$${mean(rs.map((r) => r.costUsd ?? 0)).toFixed(4)}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
