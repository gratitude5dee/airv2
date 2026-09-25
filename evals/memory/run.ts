/**
 * Live memory-recall runner (R-EV-11) — DEFERRED: needs a funded control
 * plane and a live box; has not been executed. Everything offline —
 * generation and scoring — is validated by the vitest suite instead.
 *
 * What it does when run:
 *   1. Mints an iMessage-ingest ticket via GET /api/me/imessage-history
 *      (owner session cookie), then POSTs evals/memory/archive/messages.jsonl
 *      to /api/me/imessage-history in ≤4 MB chunks — the control plane writes
 *      the archive onto the box and indexes it into OpenViking, exactly like
 *      the real extractor path.
 *   2. For each query in archive/queries.jsonl, runs `find` on the box's
 *      OpenViking via the ascii.dev box-command API and records the ranked
 *      artefact URIs.
 *   3. Scores with score.ts (recall@1 ≥ 80% target) into
 *      results/memory-<stamp>/report.md.
 *
 *   EVAL_BASE_URL=… EVAL_SESSION_COOKIE=… EVAL_USER_ID=… \
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *   BOX_API_BASE=… BOX_API_KEY=… \
 *   npx tsx evals/memory/run.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Manifest } from "./generate";
import {
  loadManifest,
  loadQueries,
  loadResults,
  renderReport,
  scoreResults,
  type RecallResult,
} from "./score";

const HERE = new URL(".", import.meta.url).pathname;
const ARCHIVE_DIR = join(HERE, "archive");
/** Upload chunk budget — a little under the route's 4 MB cap. */
const CHUNK_BYTES = 3 * 1024 * 1024;
const INDEX_SETTLE_MS = Number(process.env.EVAL_INDEX_SETTLE_MS ?? 60_000);
const RESULTS_LIMIT = 8;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing env: ${name}`);
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Config {
  baseUrl: string;
  cookie: string;
  userId: string;
  supaUrl: string;
  supaKey: string;
  boxApiBase: string;
  boxApiKey: string;
  resultsDir: string;
}

function config(): Config {
  const stamp =
    process.env.EVAL_RESULTS_STAMP ??
    new Date().toISOString().replace(/[:.]/g, "-");
  return {
    baseUrl: (process.env.EVAL_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, ""),
    cookie: requireEnv("EVAL_SESSION_COOKIE"),
    userId: requireEnv("EVAL_USER_ID"),
    supaUrl: requireEnv("SUPABASE_URL").replace(/\/$/, ""),
    supaKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    boxApiBase: requireEnv("BOX_API_BASE").replace(/\/$/, ""),
    boxApiKey: requireEnv("BOX_API_KEY"),
    resultsDir: join(HERE, "results", `memory-${stamp}`),
  };
}

/** Ticket comes back inside the owner-facing ingest command string. */
async function mintTicket(cfg: Config): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/api/me/imessage-history`, {
    headers: { Cookie: `air_session=${cfg.cookie}` },
  });
  if (!res.ok) {
    throw new Error(`ingest GET ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const body = (await res.json()) as { command?: string };
  const ticket = /air-ingest\.sh (\S+)/.exec(body.command ?? "")?.[1];
  if (!ticket) throw new Error("ingest GET returned no ticket command");
  return ticket;
}

/** Upload archive/messages.jsonl to the real ingest endpoint in chunks. */
async function uploadArchive(cfg: Config): Promise<void> {
  const ticket = await mintTicket(cfg);
  const lines = readFileSync(join(ARCHIVE_DIR, "messages.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean);
  let index = 0;
  while (index < lines.length) {
    const chunk: string[] = [];
    let bytes = 0;
    while (index < lines.length && bytes + lines[index]!.length < CHUNK_BYTES) {
      chunk.push(lines[index]!);
      bytes += lines[index]!.length;
      index += 1;
    }
    const res = await fetch(`${cfg.baseUrl}/api/me/imessage-history`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ticket}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ messages: chunk.map((l) => JSON.parse(l)) }),
    });
    if (res.status === 503 || res.status === 429) {
      const retryAfter =
        Number(res.headers.get("retry-after")) || 60;
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`ingest POST ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    console.log(`uploaded ${index}/${lines.length} messages`);
  }
}

/** The eval user's box id, via PostgREST like the agent suite does. */
async function evalBoxId(cfg: Config): Promise<string> {
  const res = await fetch(
    `${cfg.supaUrl}/rest/v1/boxes?user_id=eq.${cfg.userId}&select=id&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: cfg.supaKey,
        authorization: `Bearer ${cfg.supaKey}`,
      },
    }
  );
  if (!res.ok) throw new Error(`supa boxes ${res.status}`);
  const rows = (await res.json()) as { id: string }[];
  if (!rows[0]?.id) throw new Error(`no box for ${cfg.userId}`);
  return rows[0].id;
}

/** One `find` call on the box's OpenViking, returning ranked URIs. */
async function findOnBox(
  cfg: Config,
  boxId: string,
  query: string
): Promise<string[]> {
  const script = [
    "from openviking_sdk import SyncHTTPClient",
    "import json,sys",
    'c=SyncHTTPClient(url="http://127.0.0.1:1933",timeout=30)',
    "c.initialize()",
    `q=${JSON.stringify(query)}`,
    `rows=c.find(q, limit=${RESULTS_LIMIT})`,
    "print(json.dumps([r.get('uri') for r in (rows if isinstance(rows,list) else rows.get('results',[]))]))",
  ].join("; ");
  const res = await fetch(`${cfg.boxApiBase}/boxes/${boxId}/commands`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.boxApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      command: `python3 -c ${JSON.stringify(script)}`,
      timeoutSeconds: 60,
    }),
  });
  if (!res.ok) throw new Error(`box command ${res.status}`);
  const out = (await res.json()) as { exitCode: number | null; stdout: string };
  if (out.exitCode !== 0) throw new Error(`find failed: ${out.stdout.slice(0, 200)}`);
  return JSON.parse(out.stdout.trim().split("\n").at(-1) ?? "[]") as string[];
}

async function main(): Promise<void> {
  const cfg = config();
  const manifest: Manifest = loadManifest();
  const queries = loadQueries();
  mkdirSync(cfg.resultsDir, { recursive: true });

  const resultsPath = join(cfg.resultsDir, "results.jsonl");
  const doneIds = new Set(
    existsSync(resultsPath)
      ? loadResults(resultsPath).map((r) => r.id)
      : []
  );
  if (doneIds.size === 0) {
    await uploadArchive(cfg);
    console.log(`settling index for ${INDEX_SETTLE_MS / 1000}s`);
    await sleep(INDEX_SETTLE_MS);
  }
  const boxId = await evalBoxId(cfg);
  for (const query of queries) {
    if (doneIds.has(query.id)) continue;
    const retrieved = await findOnBox(cfg, boxId, query.query).catch(
      (error: unknown) => {
        console.warn(`${query.id}: find failed — ${String(error).slice(0, 120)}`);
        return [] as string[];
      }
    );
    const result: RecallResult = { id: query.id, retrieved };
    writeFileSync(resultsPath, JSON.stringify(result) + "\n", { flag: "a" });
    console.log(`${query.id}: ${retrieved.length} artefacts`);
    await sleep(500);
  }
  const report = scoreResults(queries, loadResults(resultsPath), manifest);
  writeFileSync(join(cfg.resultsDir, "report.md"), renderReport(report));
  console.log(`recall@1 ${(report.recallAt1 * 100).toFixed(1)}% — report: ${cfg.resultsDir}/report.md`);
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
