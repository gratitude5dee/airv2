/**
 * V12 §5.4 Create surface — recorded visual run of the Plan / Progress /
 * Release panes at phone width (390×760).
 *
 *   node scripts/visual/create-surface.mjs
 *
 * 1. bundles the island (scripts/build-create.mjs → public/creator-os/create.js),
 * 2. serves public/ plus a shell page on 127.0.0.1:3457 with the Air tokens
 *    and the shell primitives the store page gets from app/globals.css,
 * 3. drives headless Chromium through Playwright (PLAYWRIGHT_MODULE, CHROMIUM),
 * 4. answers every /api/create/** call from an in-memory fixture that walks
 *    the intake stages as the panes are clicked (plan_sent → confirmed →
 *    building/qa/testing → dev_ready → finalizing),
 * 5. screenshots each stage, asserts the visible copy, records a video and
 * 6. writes a manifest next to the artifacts. No real control plane, Box or
 *    model is touched; nothing here is content an owner typed.
 */
import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..", "..");
const repo = resolve(web, "..", "..");
const PUBLIC = join(web, "public");
const OUT = join(repo, "docs/reports/visual/2026-09-17/create-surface");
const HOST = "127.0.0.1";
const PORT = 3457;
const VIEWPORT = { width: 390, height: 760 };
const STEP_TIMEOUT_MS = 15_000;

const PLAYWRIGHT_MODULE =
  process.env.PLAYWRIGHT_MODULE ?? "/home/user/pwtools/node_modules/playwright";
const CHROMIUM = process.env.CHROMIUM ?? "/opt/pw-browsers/chromium";

/* ------------------------------------------------------------- 1. bundle */

function bundle() {
  const result = spawnSync(process.execPath, [join(web, "scripts/build-create.mjs")], {
    cwd: web,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("build-create.mjs failed");
}

/* -------------------------------------------------------------- 2. shell */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

// The tokens and primitives from app/globals.css the studio leans on, plus
// the handful of Tailwind utilities its markup uses — enough for the panes
// to lay out as they do on the store page, single column at 390px.
const SHELL_CSS = `
:root{--bg:#fafafa;--surface:#ffffff;--surface-2:#f4f4f5;--ring:rgba(0,0,0,.08);--border:#e6e8ec;--text:#1a1a1a;--muted:#8a8a8e;--muted-2:#5f5f66;--accent:#2b7fff;--accent-soft:rgba(43,127,255,.12);--danger:#dc2626;--outline:rgba(26,26,26,.85);--hard:rgba(26,26,26,.18);--shadow-hard:2px 2px 0 var(--hard);--font-chrome:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--panel-bg:var(--surface)}
*{box-sizing:border-box}
html{color-scheme:light}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;letter-spacing:-.12px;-webkit-font-smoothing:antialiased}
main{padding:16px}
a{color:var(--accent);text-decoration:none}
input,select,button,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.panel{background:var(--surface);border:1px solid var(--outline);border-radius:10px;box-shadow:var(--shadow-hard);padding:20px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 12px;background:var(--text);color:var(--bg);border:1px solid var(--outline);border-radius:7px;font-family:var(--font-chrome);font-size:10px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:var(--shadow-hard)}
.btn:disabled{opacity:.4;cursor:default}
.btn-ghost{background:transparent;color:var(--muted-2);border-color:var(--ring);box-shadow:none}
.text-muted{color:var(--muted)}
.text-red-500{color:var(--danger)}
.flex{display:flex}.inline-block{display:inline-block}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.flex-1{flex:1 1 0%}
.items-center{align-items:center}.justify-between{justify-content:space-between}.self-start{align-self:flex-start}.ml-auto{margin-left:auto}
.gap-1{gap:4px}.gap-2{gap:8px}.gap-3{gap:12px}.gap-4{gap:16px}
.m-0{margin:0}.p-0{padding:0}.p-2{padding:8px}.\\!p-4{padding:16px!important}
.mb-0\\.5{margin-bottom:2px}.mb-2{margin-bottom:8px}.mb-3{margin-bottom:12px}.mb-4{margin-bottom:16px}
.mt-1{margin-top:4px}.mt-2{margin-top:8px}.mt-3{margin-top:12px}
.px-1{padding-left:4px;padding-right:4px}.px-1\\.5{padding-left:6px;padding-right:6px}.px-2{padding-left:8px;padding-right:8px}.px-3{padding-left:12px;padding-right:12px}
.py-0\\.5{padding-top:2px;padding-bottom:2px}.py-1{padding-top:4px;padding-bottom:4px}.py-1\\.5{padding-top:6px;padding-bottom:6px}.py-2{padding-top:8px;padding-bottom:8px}
.pt-2{padding-top:8px}.pt-3{padding-top:12px}
.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.text-\\[12px\\]{font-size:12px}.text-\\[13px\\]{font-size:13px}
.text-left{text-align:left}.text-right{text-align:right}.font-mono{font-family:var(--font-chrome)}.leading-snug{line-height:1.375}
.underline{text-decoration:underline}.break-all{word-break:break-all}.whitespace-pre-wrap{white-space:pre-wrap}
.list-none{list-style:none}
.rounded{border-radius:4px}.rounded-xl{border-radius:12px}.rounded-full{border-radius:9999px}
.border{border:1px solid currentColor}.border-t{border-top:1px solid currentColor}
.border-current{border-color:currentColor}.border-current\\/20{border-color:rgba(26,26,26,.2)}.border-current\\/10{border-color:rgba(26,26,26,.1)}
.bg-transparent{background:transparent}.bg-current{background:currentColor}.bg-current\\/10{background:rgba(26,26,26,.1)}.bg-current\\/5{background:rgba(26,26,26,.05)}
.w-full{width:100%}.w-40{width:160px}.h-1{height:4px}.h-2{height:8px}.h-full{height:100%}
.min-h-\\[44px\\]{min-height:44px}.min-h-\\[66px\\]{min-height:66px}.min-h-\\[320px\\]{min-height:320px}
.max-h-32{max-height:128px}.max-h-40{max-height:160px}.max-w-\\[92\\%\\]{max-width:92%}
.overflow-hidden{overflow:hidden}.overflow-auto{overflow:auto}.overflow-y-auto{overflow-y:auto}
.grid{display:grid}.transition-\\[width\\]{transition:width 150ms linear}
iframe{max-width:100%;border:1px solid var(--ring);border-radius:8px}
`;

const SHELL_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Create surface</title>
<style>${SHELL_CSS}</style>
</head><body>
<main><div id="create" data-payload='{"slug":"alice-tour"}'></div></main>
<script src="/creator-os/create.js"></script>
</body></html>`;

function serve() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
    if (url.pathname === "/create-visual.html") {
      res.writeHead(200, { "content-type": TYPES[".html"] });
      res.end(SHELL_HTML);
      return;
    }
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = join(PUBLIC, rel);
    if (!file.startsWith(PUBLIC)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      res.writeHead(200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
        "content-length": info.size,
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    }
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(PORT, HOST, () => ok(server));
  });
}

/* ------------------------------------------------------------ 4. fixture */

const APP = {
  slug: "alice-tour",
  appname: "tour",
  name: "Alice tour",
  url: "https://mini.wzrd.tech/alice/tour",
  devUrl: "https://link.wzrd.tech/alice/tour",
  version: "v3",
};
const DAY_MS = 86_400_000;
const T0 = "2026-09-17T12:00:00.000Z";

/** The progress triples the pane sees on successive polls (§8.2). */
const PROGRESS = [
  { percent: 15, stage: "building", detail: "build queued" },
  { percent: 45, stage: "building", detail: "build succeeded" },
  { percent: 65, stage: "qa", detail: "qa 92" },
  { percent: 85, stage: "testing", detail: "tests 3/3" },
  { percent: 100, stage: "dev_ready", detail: "dev live" },
];

function makeFixture() {
  const fx = {
    stage: "plan_sent",
    revisions: 0,
    builds: 0,
    polls: 0,
    dev: null,
    events: [],
    releases: [],
    confirmedAt: null,
    devReadyAt: null,
    finalize: null,
    icons: 0,
  };
  const now = () => new Date().toISOString();
  const intake = () => ({
    appname: APP.appname,
    stage: fx.stage,
    template: "landing",
    source: "imessage",
    questions_asked: 2,
    revisions: fx.revisions,
    plan_version: ["asking", "planning"].includes(fx.stage) ? null : fx.revisions + 1,
    builds: fx.builds,
    failed_builds: 0,
    timestamps: {
      opened_at: T0,
      confirmed_at: fx.confirmedAt,
      dev_ready_at: fx.devReadyAt,
      production_at: null,
      last_owner_message_at: T0,
      updated_at: now(),
    },
  });
  const status = () => ({
    slug: APP.slug,
    appname: APP.appname,
    name: APP.name,
    status: "draft",
    visibility: "private",
    lane: "vibe",
    url: APP.url,
    preview_url: null,
    live: null,
    draft: { version: APP.version, findings: [], bytes: 48_211, files: 9, qa_score: 92 },
    draft_version: APP.version,
    qa_score: 92,
    build: {
      id: "build-3",
      status: fx.builds > 0 && fx.polls < PROGRESS.length ? "running" : "succeeded",
      version: APP.version,
      error: null,
      findings: [],
      sizes: { total: 48_211, js_gzip: 21_004, css_gzip: 3_120 },
      log: ["pull workspace", "install kit", "compile air.json", "bundle v3", "qa 92", "tests 3/3"],
      started_at: T0,
      finished_at: T0,
    },
    budget: { budget_usd: 5, spent_usd: 1.2, remaining_usd: 3.8 },
    versions: [
      {
        version: APP.version,
        lane: "vibe",
        findings: 0,
        qa_score: 92,
        created_at: T0,
        published_at: null,
        retired_at: null,
      },
    ],
    dev: fx.dev,
  });
  const release = () => ({
    channel: "dev",
    version: fx.dev?.version ?? null,
    url: fx.dev?.url ?? null,
    expires_at: fx.dev?.expires_at ?? null,
  });

  /** Answer one routed request; returns { status, body }. */
  async function answer(route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    // A multipart body (the icon upload) is not JSON; the fixture reads none of it.
    let body = {};
    if (method === "POST") {
      try {
        body = req.postDataJSON() ?? {};
      } catch {
        body = {};
      }
    }

    if (path === "/api/create/projects") {
      return {
        status: 200,
        body: {
          projects: [
            {
              slug: APP.slug,
              appname: APP.appname,
              name: APP.name,
              status: "draft",
              lane: "vibe",
              draft: APP.version,
              live: null,
            },
          ],
        },
      };
    }
    if (path === "/api/create/tier") return { status: 200, body: { speed_tier: "balanced" } };
    if (path === "/api/create/status") {
      if (url.searchParams.get("slug") !== APP.slug) return { status: 404, body: { error: "not found" } };
      return { status: 200, body: status() };
    }
    if (path === "/api/create/intake" && method === "GET") {
      if (url.searchParams.get("app") !== APP.appname) return { status: 404, body: { error: "intake not found" } };
      return { status: 200, body: intake() };
    }
    if (path === "/api/create/intake" && method === "POST") {
      if (body.appname !== APP.appname) return { status: 404, body: { error: "intake not found" } };
      fx.events.push(String(body.event));
      if (body.event === "confirm" && ["plan_sent", "revising"].includes(fx.stage)) {
        fx.stage = "confirmed";
        fx.confirmedAt = now();
      } else if (body.event === "revise" && ["plan_sent", "revising"].includes(fx.stage)) {
        fx.stage = "revising";
        fx.revisions += 1;
      } else if (body.event === "owner_reply" && fx.stage === "asking") {
        fx.stage = "planning";
      } else {
        return { status: 409, body: { error: "illegal_transition", from: fx.stage, event: body.event } };
      }
      return { status: 200, body: intake() };
    }
    if (path === "/api/create/progress") {
      if (url.searchParams.get("app") !== APP.appname) return { status: 404, body: { error: "not found" } };
      const i = Math.min(fx.polls, PROGRESS.length - 1);
      fx.polls += 1;
      const step = PROGRESS[i];
      if (fx.builds === 0) fx.builds = 1;
      if (fx.stage !== step.stage && !["finalizing", "decision_sent", "production"].includes(fx.stage)) {
        fx.stage = step.stage;
      }
      if (step.stage === "dev_ready" && !fx.dev) {
        fx.devReadyAt = now();
        fx.dev = {
          version: APP.version,
          url: APP.devUrl,
          expires_at: new Date(Date.now() + 14 * DAY_MS + 60_000).toISOString(),
        };
      }
      return {
        status: 200,
        body: { slug: APP.slug, percent: step.percent, stage: step.stage, detail: step.detail, updated_at: now() },
      };
    }
    if (path === "/api/create/icon" && method === "POST") {
      // Multipart from the form; the fixture only checks the field arrived.
      fx.icons += 1;
      return { status: 200, body: { icon_key: "apps/alice-tour/icon/" + "ab".repeat(32) + ".png", generated: false } };
    }
    if (path === "/api/create/finalize" && method === "POST") {
      if (body.app !== APP.appname) return { status: 404, body: { error: "not found" } };
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return { status: 400, body: { error: "invalid", issues: ["name"] } };
      }
      if (typeof body.description !== "string" || body.description.trim() === "") {
        return { status: 400, body: { error: "invalid", issues: ["description"] } };
      }
      fx.finalize = {
        name: body.name,
        description: body.description,
        mirror: body.mirror,
        store: body.store,
        icon_key: typeof body.icon_key === "string" ? body.icon_key : null,
      };
      fx.stage = "decision_sent";
      return {
        status: 200,
        body: { decision_id: "decision-1", stage: "decision_sent", store: body.store, mirror: body.mirror },
      };
    }
    if (path === "/api/create/release" && method === "POST") {
      if (body.app !== APP.appname || body.channel !== "dev") return { status: 400, body: { error: "invalid channel" } };
      fx.releases.push(String(body.action));
      if (body.action === "renew") {
        if (!fx.dev) return { status: 409, body: { error: "no dev release" } };
        fx.dev = { ...fx.dev, expires_at: new Date(Date.now() + 14 * DAY_MS + 60_000).toISOString() };
        // The fixture's walk: the owner said "ship it" right after renewing.
        fx.stage = "finalizing";
        return { status: 200, body: release() };
      }
      if (body.action === "revoke") {
        const was = release();
        fx.dev = null;
        return { status: 200, body: { channel: "dev", version: was.version, url: null, expires_at: null } };
      }
      return { status: 400, body: { error: "invalid action" } };
    }
    return { status: 404, body: { error: "not found" } };
  }

  return { fx, answer };
}

/* ---------------------------------------------------------------- 5. run */

async function main() {
  bundle();
  await mkdir(OUT, { recursive: true });
  // A previous run's artifacts would otherwise be listed as this run's.
  for (const stale of await readdir(OUT)) {
    if (/\.(webm|png|json)$/.test(stale)) await rm(join(OUT, stale));
  }
  const server = await serve();
  const require = createRequire(import.meta.url);
  const { chromium } = require(PLAYWRIGHT_MODULE);
  const { fx, answer } = makeFixture();
  let assertions = 0;
  const screenshots = [];

  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    recordVideo: { dir: OUT, size: VIEWPORT },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route("**/api/create/**", async (route) => {
    const reply = await answer(route);
    await route.fulfill({
      status: reply.status,
      contentType: "application/json",
      body: JSON.stringify(reply.body),
    });
  });

  const expectText = async (text) => {
    await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    assertions += 1;
  };
  const expectEqual = (actual, expected, what) => {
    if (actual !== expected) {
      throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    assertions += 1;
  };
  const shot = async (name) => {
    const file = join(OUT, name);
    await page.screenshot({ path: file, fullPage: true });
    screenshots.push(file);
  };
  const tab = (name) => page.getByRole("tab", { name, exact: true });

  try {
    await page.goto(`http://${HOST}:${PORT}/create-visual.html`, { waitUntil: "load" });
    await tab("Plan").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    await page
      .locator('section[aria-label="Project"] strong', { hasText: APP.name })
      .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    assertions += 1;

    // Plan — plan_sent, revision 1
    await tab("Plan").click();
    await expectText("plan sent");
    await expectText("plan v1");
    await expectText("0 revisions");
    await expectText("Build this");
    await expectText("Ask for changes");
    await expectText(`${APP.appname}-plan.md`);
    await shot("plan.png");

    // Build this → confirmed
    await page.getByRole("button", { name: "Build this", exact: true }).click();
    await expectText("confirmed");
    await expectText("The build is under way in Progress");
    expectEqual(fx.events.at(-1), "confirm", "intake event after Build this");
    expectEqual(fx.stage, "confirmed", "fixture stage after Build this");

    // Progress — 15 / 45 / 65 / 85 / 100 on successive polls
    await tab("Progress").click();
    await expectText("building · 45%");
    await expectText("build succeeded");
    await shot("progress-45.png");
    await expectText("dev ready · 100%");
    await expectText("dev live");
    await shot("progress-100.png");
    expectEqual(fx.stage, "dev_ready", "fixture stage after the last poll");

    // Release — dev url, expiry, Renew / Revoke
    await tab("Release").click();
    await expectText("link.wzrd.tech/alice/tour");
    await expectText("expires in 14 days");
    await expectText("Renew");
    await expectText("Revoke");
    await expectText("Request publish");
    await shot("release-dev.png");

    // Renew → finalizing
    await page.getByRole("button", { name: "Renew", exact: true }).click();
    await expectText("finalizing");
    await expectText("The decision is approved in");
    await expectText("Needs-you");
    await expectText("Mirror the source to GitHub");
    await shot("release-finalize.png");
    expectEqual(fx.releases.at(-1), "renew", "release action after Renew");
    expectEqual(fx.stage, "finalizing", "fixture stage after Renew");

    // Request publish → the finalize route files the decision (§9.3)
    await page.locator('[data-test="finalize-description"]').fill("A walking tour of the city, one stop at a time.");
    // A 1×1 PNG stands in for the owner's icon; the upload precedes finalize (§9.2).
    await page.locator('[data-test="finalize-icon"]').setInputFiles({
      name: "icon.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64"
      ),
    });
    await expectText("icon.png · upload lands when publish is requested");
    const publish = page.getByRole("button", { name: "Request publish", exact: true });
    expectEqual(await publish.isDisabled(), false, "Request publish enabled once name and description are set");
    await publish.click();
    await expectText("decision sent");
    expectEqual(fx.icons, 1, "icon uploaded once before finalize");
    expectEqual(typeof fx.finalize?.icon_key, "string", "finalize carries the icon key");
    expectEqual(fx.finalize?.store, "listed", "finalize store");
    expectEqual(fx.finalize?.mirror, true, "finalize mirror");
    expectEqual(fx.stage, "decision_sent", "fixture stage after Request publish");
    await shot("release-decision.png");
    expectEqual(pageErrors.length, 0, "page errors");
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    server.close();
    const videoPath = video ? await video.path() : null;
    const files = await readdir(OUT);
    const videos = files.filter((f) => f.endsWith(".webm")).map((f) => join(OUT, f));
    let bytes = 0;
    for (const f of [...videos, ...screenshots]) bytes += (await stat(f)).size;
    const manifest = {
      videos: videoPath && !videos.includes(videoPath) ? [videoPath, ...videos] : videos,
      screenshots,
      assertions,
      bytes,
      viewport: VIEWPORT,
      page_errors: pageErrors.length,
    };
    await writeFile(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify(manifest));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
