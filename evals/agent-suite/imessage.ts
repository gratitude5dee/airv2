/**
 * iMessage-path eval runner (TC-21 / LAT-15). For each case in
 * messages.jsonl: POST a signed Spectrum webhook to /api/inbound/imessage,
 * wait out the debounce and the turn, then read the outbound bubbles the
 * control plane's recording Spectrum sender posted to the listener below.
 *
 * The control plane under test must be started with
 * EVAL_SPECTRUM_RECORD_URL pointed at this listener (default
 * http://127.0.0.1:8787), which swaps every createSpectrumSender() call for
 * the recording fake in apps/web/lib/spectrum/recording.ts.
 *
 *   npx tsx evals/agent-suite/imessage.ts
 *
 * Required env: EVAL_IMS_SIGNING_SECRET (the control plane's
 * SPECTRUM_WEBHOOK_SECRET), EVAL_IMS_SPACE_ID, EVAL_IMS_PHONE,
 * EVAL_IMS_SENDER_ID — the webhook routes like any real inbound iMessage,
 * so the sender id must resolve through handles to the eval user (tier 0).
 * See README.md.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { loadCases, redact, requireEnv, sleep, type EvalCase } from "./lib";
import {
  buildSignedInboundWebhook,
  summarizeTimings,
  timingFromEvents,
  type RecordedSenderEvent,
  type WebhookTarget,
} from "./imessage-lib";

const HERE = new URL(".", import.meta.url).pathname;
const TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS ?? 120_000);
const QUIET_MS = Number(process.env.EVAL_IMS_QUIET_MS ?? 10_000);
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 2_000);
const POLL_MS = 100;

interface Config extends WebhookTarget {
  baseUrl: string;
  recordPort: number;
  resultsDir: string;
  only: Set<string> | null;
}

function config(): Config {
  return {
    baseUrl: (process.env.EVAL_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, ""),
    signingSecret: requireEnv("EVAL_IMS_SIGNING_SECRET"),
    spaceId: requireEnv("EVAL_IMS_SPACE_ID"),
    phone: requireEnv("EVAL_IMS_PHONE"),
    senderId: requireEnv("EVAL_IMS_SENDER_ID"),
    recordPort: Number(process.env.EVAL_RECORD_PORT ?? 8787),
    resultsDir: join(
      HERE,
      "results",
      `imessage-${process.env.EVAL_RESULTS_STAMP ?? new Date().toISOString().replace(/[:.]/g, "-")}`
    ),
    only: process.env.EVAL_ONLY
      ? new Set(process.env.EVAL_ONLY.split(",").map((s) => s.trim()).filter(Boolean))
      : null,
  };
}

interface Listener {
  server: Server;
  events: RecordedSenderEvent[];
}

/** Harness-side sink for recording-sender POSTs; stamps arrival time. */
function startListener(port: number): Promise<Listener> {
  const events: RecordedSenderEvent[] = [];
  const server = createServer((req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 404;
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const receivedMs = Date.now();
      try {
        const event = JSON.parse(
          Buffer.concat(chunks).toString("utf8")
        ) as RecordedSenderEvent;
        event.received_ms = receivedMs;
        events.push(event);
      } catch {
        res.statusCode = 400;
        res.end();
        return;
      }
      res.statusCode = 204;
      res.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, events }));
  });
}

async function postWebhook(
  cfg: Config,
  kase: EvalCase
): Promise<{ status: number; postedAtMs: number; messageId: string }> {
  const webhook = buildSignedInboundWebhook(cfg, kase.message);
  const postedAtMs = Date.now();
  const res = await fetch(`${cfg.baseUrl}/api/inbound/imessage`, {
    method: "POST",
    headers: webhook.headers,
    body: webhook.rawBody,
  });
  // The route answers 200 {ok:true} on accept; anything else still gets timed so the
  // report shows a rejected webhook rather than a silent skip.
  await res.arrayBuffer().catch(() => undefined);
  return { status: res.status, postedAtMs, messageId: webhook.messageId };
}

interface CaseOutcome {
  status: number;
  firstBubbleMs: number | null;
  finalBubbleMs: number | null;
  firstReactionMs: number | null;
  bubbles: number;
  reactions: number;
  events: RecordedSenderEvent[];
}

/** Wait out the debounce and the turn: settle once the stream has been
 * quiet for QUIET_MS — after the first bubble, or after
 * NO_BUBBLE_SETTLE_MS when the turn produced none — else at the timeout. */
const NO_BUBBLE_SETTLE_MS = Number(process.env.EVAL_IMS_NO_BUBBLE_MS ?? 45_000);

async function collectCase(
  cfg: Config,
  kase: EvalCase,
  allEvents: RecordedSenderEvent[],
  from: number
): Promise<CaseOutcome> {
  const posted = await postWebhook(cfg, kase);
  const deadline = posted.postedAtMs + TIMEOUT_MS;
  for (;;) {
    const events = allEvents.slice(from);
    const timing = timingFromEvents(events, posted.postedAtMs);
    const now = Date.now();
    const lastEventAt = allEvents.at(-1)?.received_ms ?? posted.postedAtMs;
    const quiet = now - lastEventAt >= QUIET_MS;
    const settled =
      quiet &&
      (timing.bubbles > 0 || now - posted.postedAtMs >= NO_BUBBLE_SETTLE_MS);
    if (settled || now >= deadline) {
      return { status: posted.status, events, ...timing };
    }
    await sleep(POLL_MS);
  }
}

function writeReport(dir: string, outcomes: { id: string; outcome: CaseOutcome }[]): void {
  const summary = summarizeTimings(
    outcomes.map(({ outcome }) => ({
      firstBubbleMs: outcome.firstBubbleMs,
      finalBubbleMs: outcome.finalBubbleMs,
      firstReactionMs: outcome.firstReactionMs,
      bubbles: outcome.bubbles,
      reactions: outcome.reactions,
    }))
  );
  const ms = (v: number | null) => (v === null ? "n/a" : `${(v / 1000).toFixed(2)}s`);
  const verdict = (v: number | null, target: number) =>
    v === null ? "n/a" : v < target ? "pass" : "FAIL";
  // Targets from docs/operations/imessage-ttfk.md.
  const lines = [
    "# iMessage-path eval report",
    "",
    `${summary.cases} cases, ${summary.answered} produced a bubble.`,
    "",
    "| metric | p50 | p95 | target | verdict |",
    "| --- | --- | --- | --- | --- |",
    `| first tapback reaction | ${ms(summary.firstReactionP50Ms)} | ${ms(summary.firstReactionP95Ms)} | <1s | ${verdict(summary.firstReactionP95Ms, 1_000)} |`,
    `| first bubble | ${ms(summary.firstBubbleP50Ms)} | ${ms(summary.firstBubbleP95Ms)} | <5s warm | ${verdict(summary.firstBubbleP95Ms, 5_000)} |`,
    `| final bubble | ${ms(summary.finalBubbleP50Ms)} | ${ms(summary.finalBubbleP95Ms)} | n/a | — |`,
    "",
    "Per-case detail lives in the sibling `*.json` files.",
    "",
  ];
  writeFileSync(join(dir, "report.md"), lines.join("\n"));
  writeFileSync(join(dir, "suite.json"), JSON.stringify(summary, null, 2));
}

async function main(): Promise<void> {
  const cfg = config();
  const listener = await startListener(cfg.recordPort);
  const cases = loadCases(join(HERE, "messages.jsonl")).filter(
    (kase) => !cfg.only || cfg.only.has(kase.id)
  );
  mkdirSync(cfg.resultsDir, { recursive: true });
  const done = new Set(
    existsSync(cfg.resultsDir)
      ? readdirSync(cfg.resultsDir)
          .filter((name) => name.endsWith(".json") && name !== "suite.json")
          .map((name) => name.slice(0, -".json".length))
      : []
  );

  const outcomes: { id: string; outcome: CaseOutcome }[] = [];
  try {
    for (const kase of cases) {
      if (done.has(kase.id)) continue;
      const from = listener.events.length;
      const outcome = await collectCase(cfg, kase, listener.events, from);
      // Persist redacted — recorded bubbles are model output and can carry
      // addresses/phones the suite never needs to keep on disk.
      const persisted = {
        ...outcome,
        events: JSON.parse(
          redact(JSON.stringify(outcome.events))
        ) as RecordedSenderEvent[],
      };
      writeFileSync(
        join(cfg.resultsDir, `${kase.id}.json`),
        JSON.stringify({ case: kase.id, ...persisted }, null, 2)
      );
      outcomes.push({ id: kase.id, outcome });
      const first =
        outcome.firstBubbleMs === null
          ? "no bubble"
          : `first ${(outcome.firstBubbleMs / 1000).toFixed(2)}s`;
      console.log(`${kase.id}: ${first} (${outcome.bubbles} bubbles, http ${outcome.status})`);
      await sleep(DELAY_MS);
    }
    // Fold resumed cases into the report so an interrupted run still grades.
    for (const name of done) {
      if (!cases.some((kase) => kase.id === name)) continue;
      const persisted = JSON.parse(
        readFileSync(join(cfg.resultsDir, `${name}.json`), "utf8")
      ) as Partial<CaseOutcome>;
      outcomes.push({ id: name, outcome: persisted as CaseOutcome });
    }
    writeReport(cfg.resultsDir, outcomes);
    console.log(`report: ${cfg.resultsDir}/report.md`);
  } finally {
    listener.server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
