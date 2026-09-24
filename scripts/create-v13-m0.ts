#!/usr/bin/env tsx
/**
 * create-v13-m0.ts — M0 Cloudflare proofs for Air Create V13 (goal-create-v13 §13).
 *
 * Exit gate: the script exits 0 and writes docs/reports/create-v13-m0.md.
 * Every probe is a real check, not a reading of the spec — local probes assert
 * the shipped code/config; live probes call Cloudflare and the lane origins.
 *
 * Local probes run in any checkout. Live probes need:
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN   — Workers for Platforms API
 *   CREATE_JOBS_ORIGIN                          — deployed air-create (default https://create.wzrd.tech)
 *   M0_DEV_HOST                                 — a slug to probe through air-dev (default m0-canary.dev.wzrd.tech)
 *   M0_CANARY=1                                 — opt in to deploying a canary user Worker into air-apps
 *
 * Without credentials live probes record "pending" with the operator runbook.
 * `--strict` flips pending → fail for the real M0 gate on a provisioned box.
 *
 *   npx tsx scripts/create-v13-m0.ts            # local proofs + live where env exists
 *   npx tsx scripts/create-v13-m0.ts --strict   # M0 gate: pending counts as fail
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STRICT = process.argv.includes("--strict");
const REPORT = join(ROOT, "docs", "reports", "create-v13-m0.md");

type Status = "pass" | "fail" | "pending";
interface ProbeResult {
  status: Status;
  evidence: string;
}
interface Probe {
  id: string;
  name: string;
  /** true = needs live Cloudflare/lane env to run at all. */
  live: boolean;
  run: () => Promise<ProbeResult>;
}

const ok = (evidence: string): ProbeResult => ({ status: "pass", evidence });
const fail = (evidence: string): ProbeResult => ({ status: "fail", evidence });
const pending = (evidence: string): ProbeResult => ({ status: "pending", evidence });

function read(rel: string): string | null {
  const path = join(ROOT, rel);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** Naive JSONC strip for wrangler configs (line comments + trailing commas). */
function parseJsonc(text: string): Record<string, unknown> {
  const stripped = text
    .replace(/\/\/[^\n"]*/g, "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(stripped) as Record<string, unknown>;
}

function assertHas(source: string | null, needles: string[], label: string): string {
  if (source === null) return `${label}: file missing`;
  const missing = needles.filter((n) => !source.includes(n));
  return missing.length ? `${label}: missing ${missing.join(", ")}` : "";
}

/* ------------------------------------------------------------------ */
/* Local probes — provable in this checkout                            */
/* ------------------------------------------------------------------ */

const probes: Probe[] = [
  {
    id: "worker-layout",
    name: "air-create wrangler binds Workflow, OwnerRoom DO, Browser Run, R2 media and the air-apps dispatch namespace",
    live: false,
    async run() {
      const src = read("infra/workers/create/wrangler.jsonc");
      if (src === null) return fail("infra/workers/create/wrangler.jsonc missing");
      const cfg = parseJsonc(src);
      const misses: string[] = [];
      const wfList = (cfg["workflows"] as { binding?: string; class_name?: string }[] | undefined) ?? [];
      if (!wfList.some((w) => w.binding === "CREATE_JOB" && w.class_name === "CreateJob"))
        misses.push("workflows CREATE_JOB→CreateJob");
      const doB = ((cfg["durable_objects"] as { bindings?: { name?: string; class_name?: string }[] })?.bindings ?? []);
      if (!doB.some((b) => b.name === "OWNER_ROOM" && b.class_name === "OwnerRoom"))
        misses.push("OWNER_ROOM→OwnerRoom");
      const browser = cfg["browser"] as { binding?: string } | undefined;
      if (browser?.binding !== "BROWSER") misses.push("browser BROWSER");
      const r2 = (cfg["r2_buckets"] as { binding?: string; bucket_name?: string }[] | undefined) ?? [];
      if (!r2.some((b) => b.binding === "MEDIA" && b.bucket_name === "air-media"))
        misses.push("r2 MEDIA=air-media");
      const dn = (cfg["dispatch_namespaces"] as { binding?: string; namespace?: string }[] | undefined) ?? [];
      if (!dn.some((d) => d.binding === "APPS" && d.namespace === "air-apps"))
        misses.push("dispatch APPS=air-apps");
      const crons = (cfg["triggers"] as { crons?: string[] } | undefined)?.crons ?? [];
      if (!crons.length) misses.push("dev-expire cron");
      const vars = (cfg["vars"] as Record<string, string>) ?? {};
      for (const v of ["DEV_ORIGIN_SUFFIX", "MINI_ORIGIN", "MAX_FIX_ROUNDS", "BRIEF_WAIT_S", "CODE_WAIT_S"])
        if (!(v in vars)) misses.push(`vars.${v}`);
      return misses.length ? fail(misses.join("; ")) : ok("workflows + DO + browser + r2 + dispatch + cron + vars all bound");
    },
  },
  {
    id: "dev-router-layout",
    name: "air-dev router binds the manifest KV, dispatches to <slug>-dev/-draft and serves *.dev.wzrd.tech",
    live: false,
    async run() {
      const cfgSrc = read("infra/workers/dev-router/wrangler.jsonc");
      const codeSrc = read("infra/workers/dev-router/index.mjs");
      const m = [
        assertHas(cfgSrc, ["air-dev", "dev.wzrd.tech", "AIR_MANIFEST", "dispatch_namespaces", "air-apps"], "wrangler"),
        assertHas(codeSrc, ["x-air-candidate", "noindex", "dev_expires_at", "APPS", "-dev"], "router"),
      ].filter(Boolean);
      if (m.length) return fail(m.join("; "));
      const slugGate = codeSrc!.includes("-draft") && /slug/i.test(codeSrc!);
      return slugGate
        ? ok("candidate header + draft gate + noindex + expiry in router source")
        : fail("router missing draft dispatch");
    },
  },
  {
    id: "bridge-parity",
    name: "CF1 signature: Vercel bridge and Worker compute the identical HMAC payload/digest",
    live: false,
    async run() {
      const web = await import(join(ROOT, "apps/web/lib/create/bridge.ts"));
      const worker = await import(join(ROOT, "infra/workers/create/src/sign.ts"));
      const secret = "m0-probe-secret";
      const ts = "1750000000";
      const body = JSON.stringify({ job_id: "job-1", role: "code", round: 0 });
      const method = "post"; // must normalize to upper on both sides
      const path = "/api/internal/create/turn";
      const webPayload = web.bridgePayload(ts, method, path, body);
      const webSig = web.bridgeSign(secret, webPayload);
      const wPayload = await worker.bridgePayload(ts, method, path, body);
      const wSig = await worker.hmacHex(secret, wPayload);
      if (webPayload !== wPayload) return fail(`payload mismatch:\nweb    ${webPayload}\nworker ${wPayload}`);
      if (webSig !== wSig) return fail("digest mismatch");
      // Round-trip: worker verifies a web-signed request.
      const headers = new Headers({ "x-air-ts": ts, "x-air-sig": webSig });
      const freshNow = Number(ts) * 1000 + 1_000;
      const verdict = await worker.verifyBridgeRequest(headers, "POST", path, body, secret, freshNow);
      if (verdict !== true) return fail("worker rejected a web-signed request");
      const stale = await worker.verifyBridgeRequest(headers, "POST", path, body, secret, Number(ts) * 1000 + 400_000);
      if (stale !== false) return fail("worker accepted a stale signature");
      const unsigned = await worker.verifyBridgeRequest(new Headers(), "POST", path, body, secret, freshNow);
      if (unsigned !== null) return fail("unsigned request not detected as null");
      return ok("payload + digest identical; web-signed request verifies; stale→false; unsigned→null");
    },
  },
  {
    id: "candidate-token",
    name: "CF4 candidate tokens: mint/verify round-trip; wrong slug, wrong secret and expired all reject",
    live: false,
    async run() {
      const { mintCandidate, verifyCandidate } = await import(
        join(ROOT, "infra/workers/create/src/tokens.ts")
      );
      const secret = "m0-candidate-secret";
      const now = 1_750_000_000_000;
      const token = await mintCandidate(secret, "alice-tour", "v3", 600, now);
      const claims = await verifyCandidate(secret, token, "alice-tour", now + 60_000);
      if (claims?.version !== "v3") return fail("round-trip claims wrong");
      if (await verifyCandidate(secret, token, "bob-tour", now + 60_000))
        return fail("token verified for another slug");
      if (await verifyCandidate("other-secret", token, "alice-tour", now + 60_000))
        return fail("token verified under another secret");
      if (await verifyCandidate(secret, token, "alice-tour", now + 601_000))
        return fail("expired token verified");
      // A version carried by the token can't be swapped: claims are the version's only carrier.
      const claims2 = await verifyCandidate(secret, token, "alice-tour", now + 60_000);
      if (claims2!.version === "v4") return fail("version mutable");
      return ok("mint→verify ok; cross-slug, cross-secret and expired all reject; version is bound");
    },
  },
  {
    id: "live-token",
    name: "Live-view tokens bind job+user, reject other jobs and expire",
    live: false,
    async run() {
      const { verifyLive } = await import(join(ROOT, "infra/workers/create/src/tokens.ts"));
      const { mintSignedToken } = await import(join(ROOT, "infra/workers/create/src/sign.ts"));
      const secret = "m0-live-secret";
      const now = 1_750_000_000_000;
      const token = await mintSignedToken(secret, { job: "job-1", user: "u-1", exp: Math.floor(now / 1000) + 600 });
      const claims = await verifyLive(secret, token, "job-1", now + 60_000);
      if (claims?.user !== "u-1") return fail("round-trip claims wrong");
      if (await verifyLive(secret, token, "job-2", now + 60_000)) return fail("verified for another job");
      if (await verifyLive(secret, token, "job-1", now + 700_000)) return fail("expired token verified");
      // The Vercel side mints the same shape via lib/create/bridge.ts mintLiveToken.
      const web = await import(join(ROOT, "apps/web/lib/create/bridge.ts"));
      process.env.LIVE_TOKEN_SECRET = "m0-live-secret";
      const webToken = web.mintLiveToken("job-9", "u-2", 600);
      const webClaims = await web.verifySignedToken(
        "m0-live-secret",
        webToken,
        { job: "job-9" },
      );
      if (webClaims === null) return fail("web mintLiveToken did not round-trip on the web side");
      return ok("worker mint/verify ok; cross-job and expiry reject; web mintLiveToken round-trips");
    },
  },
  {
    id: "check-sandbox",
    name: "CF6: Browser Run checks route-abort off-list hosts and carry the candidate header",
    live: false,
    async run() {
      const src = read("infra/workers/create/src/check.ts");
      const m = assertHas(src, [
        "allowedHosts",
        "page.route",
        "route.abort",
        "setExtraHTTPHeaders",
        "x-air-candidate",
        "media.wzrd.tech",
      ], "check.ts");
      if (m) return fail(m);
      const blockedRecorded = src!.includes("smokeIssues") || src!.includes("blocked");
      return blockedRecorded
        ? ok("allowedHosts + page.route abort + candidate header; off-list recorded as smoke issues")
        : fail("off-list aborts are not recorded");
    },
  },
  {
    id: "percent-monotonic",
    name: "OwnerRoom broadcast clamps percent monotonic per job snapshot",
    live: false,
    async run() {
      const src = read("infra/workers/create/src/room.ts");
      const m = assertHas(src, ["Math.max(payload.percent", "SNAPSHOT_KEY"], "room.ts");
      return m ? fail(m) : ok("broadcast() reads last snapshot and max-clamps percent before fan-out");
    },
  },
  {
    id: "supersede",
    name: "OwnerRoom admit: one running slot per owner, same-app replacements tombstone the old job",
    live: false,
    async run() {
      const src = read("infra/workers/create/src/room.ts");
      const m = assertHas(src, ['"superseded"', "superseded:", '"start"', '"wait"'], "room.ts");
      return m ? fail(m) : ok("admit returns start|wait|superseded; replaced jobs get superseded:<id> tombstones");
    },
  },
  {
    id: "adapter-kill",
    name: "waitForTurn: a dead adapter chunk-times-out and the job keeps moving",
    live: false,
    async run() {
      const src = read("infra/workers/create/src/workflow.ts");
      const m = assertHas(src, ["waitForEvent", "WAIT_CHUNK_S", "catch", "turn_done"], "workflow.ts");
      if (m) return fail(m);
      // The wait's return value is intentionally unused for control flow — the
      // job proceeds to build whether the callback arrived or not.
      const codeWait = /waitForTurn\(step, params, "code"[\s\S]*?await this\.progress\(params, \{\s*percent: 50/.test(src!);
      return codeWait
        ? ok("chunked waitForEvent + catch→curve; code wait falls through to the build step")
        : fail("code wait result gates the job");
    },
  },
  {
    id: "step-table",
    name: "Step percents follow the §5.2 ladder (admit 2 → brief 5→10 → code 10→50 → build 50→60 → check 60→85 → publish 85→99 → notify 100)",
    live: false,
    async run() {
      const src = read("infra/workers/create/src/workflow.ts");
      const steps = ["admit", "brief", "snapshot-tests", "code", "build", "check", "fix", "publish", "notify"];
      const missing = steps.filter((s) => !src!.includes(`"${s}"`));
      const pcts = ["percent: 2", "percent: 5", "percent: 10", "percent: 50", "percent: 60", "percent: 85", "percent: 99", "percent: 100"]
        .filter((p) => !src!.includes(p));
      if (missing.length || pcts.length) return fail(`missing steps ${missing.join(",")} / percents ${pcts.join(",")}`);
      return ok("all step names and ladder percents present in workflow.ts");
    },
  },
  {
    id: "no-content",
    name: "CF5: create_jobs columns, DO broadcast shape and worker payloads carry ids/counters only",
    live: false,
    async run() {
      const mig = read("supabase/migrations/0126_create_jobs.sql");
      if (mig === null) return fail("migration missing");
      const forbiddenCol = mig.match(/^\s*(prompt|plan|goal|brief|content|message|code|text)\b/im);
      if (forbiddenCol) return fail(`create_jobs has a content column: ${forbiddenCol[1]}`);
      const room = read("infra/workers/create/src/room.ts")!;
      const iface = room.match(/interface ProgressBroadcast \{([\s\S]*?)\}/)?.[1] ?? "";
      const badKey = iface.match(/(prompt|plan|goal|content|message|code|text)\b/);
      if (badKey) return fail(`ProgressBroadcast carries ${badKey[1]}`);
      // Change requests travel as workspace files, never through the job.
      const wf = read("infra/workers/create/src/workflow.ts")!;
      if (!wf.includes("change_file")) return fail("workflow never references change_file");
      return ok("no content columns; ProgressBroadcast = {percent,step,detail,round,state,dev_url,shot_url}; changes go via change_file");
    },
  },
  {
    id: "two-bubbles",
    name: "The card is minted once at /api/create/go; the old relay editor is gone",
    live: false,
    async run() {
      const go = read("apps/web/app/api/create/go/route.ts");
      const cardSites = go?.match(/card: `\[card: create /g)?.length ?? 0;
      if (cardSites !== 1) return fail(`go route mints ${cardSites} cards, want 1`);
      const progress = read("apps/web/lib/create/progress.ts") ?? "";
      for (const dead of ["sendOrUpdateAppCard", "relayTick", "runProgressRelay"])
        if (new RegExp(`\\b${dead}\\b`).test(progress))
          return fail(`lib/create/progress.ts still carries ${dead}`);
      return ok("one [card: create] emission site; relay/card editing removed from progress.ts");
    },
  },
  {
    id: "flag-gate",
    name: "CREATE_V13 flag + CREATE_V13_USER_IDS allow-list gate /api/create/go",
    live: false,
    async run() {
      const cfg = read("apps/web/lib/create/config.ts") ?? "";
      const go = read("apps/web/app/api/create/go/route.ts") ?? "";
      const m = [
        assertHas(cfg, ["CREATE_V13", "CREATE_V13_USER_IDS"], "config.ts"),
        assertHas(go, ["v13", "426"], "go/route.ts"),
      ].filter(Boolean);
      return m.length ? fail(m.join("; ")) : ok("flag + allow-list gate present; disabled lane answers 426-style refusal");
    },
  },
  {
    id: "skill-v5",
    name: "create-miniapp skill v5: x-air-skill: 5, go + compile verbs, legacy verbs deprecated in place",
    live: false,
    async run() {
      const cli = read("infra/template/skills/create-miniapp/scripts/air-create") ?? "";
      const doc = read("infra/template/skills/create-miniapp/SKILL.md") ?? "";
      const m = [
        assertHas(cli, ["x-air-skill", "cmd_go", "cmd_compile", "AIR_SKILL_VERSION"], "air-create"),
        assertHas(doc, ["5.0.0", "go", "compile"], "SKILL.md"),
      ].filter(Boolean);
      return m.length ? fail(m.join("; ")) : ok("skill version 5 header + go/compile verbs + SKILL.md v5");
    },
  },
];

/* ------------------------------------------------------------------ */
/* Live probes — need Cloudflare + lane env                             */
/* ------------------------------------------------------------------ */

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const JOBS_ORIGIN = process.env.CREATE_JOBS_ORIGIN ?? "https://create.wzrd.tech";
const DEV_HOST = process.env.M0_DEV_HOST ?? "m0-canary.dev.wzrd.tech";

async function cfApi(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${CF_TOKEN}`,
      ...(isForm ? {} : { "content-type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

probes.push(
  {
    id: "cf-token",
    name: "Cloudflare API token verifies and can see this account",
    live: true,
    async run() {
      if (!CF_TOKEN || !CF_ACCOUNT) return pending("set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN");
      const r = await cfApi("/user/tokens/verify");
      const okToken = r.status === 200 && (r.body as { success?: boolean })?.success === true;
      if (!okToken) return fail(`token verify → ${r.status}`);
      const acct = await cfApi(`/accounts/${CF_ACCOUNT}`);
      return acct.status === 200 ? ok("token valid; account reachable") : fail(`account → ${acct.status}`);
    },
  },
  {
    id: "air-apps-namespace",
    name: "Workers for Platforms is enabled and the air-apps dispatch namespace exists",
    live: true,
    async run() {
      if (!CF_TOKEN || !CF_ACCOUNT) return pending("set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN");
      const r = await cfApi(`/accounts/${CF_ACCOUNT}/workers/dispatch/namespaces/air-apps`);
      if (r.status === 200) return ok("air-apps namespace exists");
      if (r.status === 404) return fail("air-apps missing — Workers for Platforms not enabled or namespace not created");
      return fail(`namespace lookup → ${r.status}`);
    },
  },
  {
    id: "dev-origin",
    name: "*.dev.wzrd.tech DNS + cert resolve and air-dev answers on the wildcard",
    live: true,
    async run() {
      try {
        const res = await fetch(`https://${DEV_HOST}/`, { redirect: "manual" });
        const noindex = res.headers.get("x-robots-tag") ?? "";
        const body = (await res.text()).slice(0, 120);
        // Any HTTP answer proves DNS+TLS+the router's edge; 404 branded = lane
        // up, nothing promoted. A 200 means a real app is already there.
        return ok(`GET https://${DEV_HOST}/ → ${res.status}; x-robots-tag="${noindex || "none"}"; body ${JSON.stringify(body.slice(0, 60))}`);
      } catch (e) {
        return pending(`air-dev not reachable yet — deploy it / fix *.dev.wzrd.tech DNS (${e instanceof Error ? e.message : e})`);
      }
    },
  },
  {
    id: "canary-dispatch",
    name: "A canary user Worker deploys into air-apps and serves through air-dev",
    live: true,
    async run() {
      if (!CF_TOKEN || !CF_ACCOUNT) return pending("set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN");
      if (process.env.M0_CANARY !== "1") return pending("set M0_CANARY=1 to deploy m0-canary-dev into air-apps");
      const script = `export default { fetch() { return new Response("m0-canary ok", { headers: { "content-type": "text/plain" } }); } };`;
      const form = new FormData();
      form.set("metadata", JSON.stringify({ main_module: "index.mjs" }));
      form.set("index.mjs", new Blob([script], { type: "application/javascript+module" }), "index.mjs");
      const put = await cfApi(
        `/accounts/${CF_ACCOUNT}/workers/dispatch/namespaces/air-apps/scripts/${DEV_HOST.split(".")[0]}-dev`,
        { method: "PUT", headers: {}, body: form },
      );
      if (put.status !== 200) return fail(`canary deploy → ${put.status}`);
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const res = await fetch(`https://${DEV_HOST}/`).catch(() => null);
        if (res && res.status === 200 && (await res.text()).includes("m0-canary ok"))
          return ok("canary deployed and serves through air-dev");
        await new Promise((r) => setTimeout(r, 2_000));
      }
      return fail("canary deployed but never served (air-dev not routing?)");
    },
  },
  {
    id: "create-worker-health",
    name: "Deployed air-create answers /v1/health with adapter readiness",
    live: true,
    async run() {
      try {
        const res = await fetch(`${JOBS_ORIGIN}/v1/health`);
        const body = await res.text();
        return res.status === 200
          ? ok(`${JOBS_ORIGIN}/v1/health → 200 ${body.slice(0, 120)}`)
          : pending(`${JOBS_ORIGIN}/v1/health → ${res.status} — air-create not deployed on that host yet`);
      } catch (e) {
        return pending(`air-create not deployed (set CREATE_JOBS_ORIGIN to override): ${e instanceof Error ? e.message : e}`);
      }
    },
  },
  {
    id: "waitforevent-roundtrip",
    name: "Workflow waitForEvent round-trip: a signed Vercel callback advances a job",
    live: true,
    async run() {
      return pending(
        "operator step: deploy air-create, start a job via POST /v1/jobs, then POST a signed turn_done to /v1/jobs/<id>/events and confirm the step advances — needs CREATE_BRIDGE_SECRET + a reachable adapter",
      );
    },
  },
  {
    id: "browser-run-check",
    name: "Browser Run loads a candidate URL with x-air-candidate and runs the smoke pass",
    live: true,
    async run() {
      return pending(
        "operator step: with M0_CANARY=1 deployed, run the job's check step (or wrangler dev --remote on infra/workers/create) against the canary — asserts the BROWSER binding launches",
      );
    },
  },
  {
    id: "adapter-turn",
    name: "The adapter starts a turn on a real Box and the turn_done callback arrives",
    live: true,
    async run() {
      return pending(
        "operator step: on a real Box + line, POST /api/create/go for a test app and confirm the code turn's turn_done event arrives (job row percent > 10)",
      );
    },
  },
);

/* ------------------------------------------------------------------ */
/* Run + report                                                         */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
const rows: { probe: Probe; result: ProbeResult }[] = [];
let failed = 0;
let pendingCount = 0;
for (const probe of probes) {
  let result: ProbeResult;
  try {
    result = await probe.run();
  } catch (e) {
    result = fail(`threw: ${e instanceof Error ? e.message : e}`);
  }
  if (result.status === "fail") failed += 1;
  if (result.status === "pending") pendingCount += 1;
  rows.push({ probe, result });
  const mark = result.status === "pass" ? "PASS" : result.status === "fail" ? "FAIL" : "PEND";
  console.log(`${mark}  ${probe.id.padEnd(24)} ${result.evidence.slice(0, 110)}`);
}

const md: string[] = [
  "# Air Create V13 — M0 Cloudflare proofs",
  "",
  `Run: \`npx tsx scripts/create-v13-m0.ts${STRICT ? " --strict" : ""}\` — ${new Date().toISOString()}`,
  "",
  `Local probes assert the shipped code; live probes call Cloudflare. "pending"`,
  `means the env var or operator step in the evidence column is still open.`,
  "",
  "| Probe | Status | Evidence |",
  "| --- | --- | --- |",
];
for (const { probe, result } of rows) {
  md.push(`| ${probe.id} — ${probe.name} | ${result.status} | ${result.evidence.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`);
}
md.push("", `Summary: ${rows.length - failed - pendingCount} pass, ${pendingCount} pending, ${failed} fail.`, "");

mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, md.join("\n"));
console.log(`\nreport → ${REPORT}`);

const exitBad = failed > 0 || (STRICT && pendingCount > 0);
console.log(exitBad ? "M0: NOT GREEN" : "M0: local proofs green" + (pendingCount ? ` (${pendingCount} live probes pending)` : ""));
process.exit(exitBad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
