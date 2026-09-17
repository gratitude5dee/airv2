/**
 * Visual recording of Kit components (goal-create-v12 §11.4 evidence).
 *
 *   KIT_PLAYWRIGHT=… KIT_CHROMIUM=… npx tsx packages/create-kit/scripts/visual.ts \
 *     --out docs/reports/visual/<date>/kit [--seconds 3] [--lite] <id> [<id> …]
 *
 * Bundles each component the way the harness does (vendored React, no network),
 * serves it on a loopback port under the Air shell, and drives the installed
 * Chromium through playwright-core: a WebM per component (390×760, full motion,
 * reduced-motion off) plus screenshots at 0.4 s, half-way and the end, and a
 * manifest.json with the render errors observed. Nothing here touches kit/ or
 * the lock; it is evidence, not harvest.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { COMPONENTS } from "./lib/catalog.ts";
import { bundle } from "./lib/measure.ts";
import { extractVendor } from "./lib/vendor.ts";
import { HARNESS_DIR, KIT_DIR, KIT_ROOT } from "./lib/paths.ts";
import { writeText } from "./lib/fsx.ts";

const argv = process.argv.slice(2);
const opt = (name: string, fallback: string): string => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback;
};
const lite = argv.includes("--lite");
const ids = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--out" && argv[i - 1] !== "--seconds");
const OUT = path.resolve(opt("out", `docs/reports/visual/${new Date().toISOString().slice(0, 10)}/kit`));
const SECONDS = Number(opt("seconds", "3"));
if (ids.length === 0) {
  console.error("visual.ts: name at least one component id (e.g. arlan/shutter-type)");
  process.exit(2);
}
const specs = ids.map((id) => {
  const s = COMPONENTS.find((c) => c.id === id);
  if (!s) throw new Error(`unknown component ${id}`);
  return s;
});

function loadPlaywright(): { chromium: { launch(o: Record<string, unknown>): Promise<any> } } {
  const req = createRequire(import.meta.url);
  const candidates = [process.env.KIT_PLAYWRIGHT, "playwright-core", "playwright"].filter(Boolean) as string[];
  const npx = path.join(os.homedir(), ".npm", "_npx");
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) candidates.push(path.join(npx, d, "node_modules", "playwright-core"));
  for (const c of candidates) {
    try {
      return req(c);
    } catch {
      /* next */
    }
  }
  throw new Error("playwright-core not found; set KIT_PLAYWRIGHT");
}

function entrySource(): string {
  const imports = specs.map((s, i) => `import * as m${i} from "../kit/${s.id}/${s.entry ?? "index.tsx"}";`).join("\n");
  const table = specs
    .map((s, i) => `  ${JSON.stringify(s.id)}: { mod: m${i}, pick: ${JSON.stringify(s.demoExport ?? "")}, props: ${JSON.stringify(s.demo ?? {})} },`)
    .join("\n");
  return `import React from "react";
import { createRoot } from "react-dom/client";
import "../kit/air/theme.css";
import "../kit/air/shell.css";
${imports}
const TABLE = {
${table}
};
const w = window;
w.__kitErrors = [];
w.__kitReady = false;
window.addEventListener("error", (e) => w.__kitErrors.push("error: " + (e.message || String(e))));
window.addEventListener("unhandledrejection", (e) => w.__kitErrors.push("rejection: " + String(e.reason)));
const id = decodeURIComponent(location.hash.slice(1));
const entry = TABLE[id];
const root = document.getElementById("root");
const isComponent = (v) => typeof v === "function" || (typeof v === "object" && v !== null && "$$typeof" in v);
function pick(mod, name) {
  if (name && isComponent(mod[name])) return mod[name];
  if (isComponent(mod.default)) return mod.default;
  for (const k of Object.keys(mod)) if (/^[A-Z]/.test(k) && isComponent(mod[k])) return mod[k];
  return null;
}
if (!entry) w.__kitErrors.push("unknown id " + id);
else {
  const C = pick(entry.mod, entry.pick);
  if (!C) w.__kitErrors.push("no component export in " + id);
  else {
    createRoot(root).render(React.createElement(C, entry.props));
    requestAnimationFrame(() => requestAnimationFrame(() => { w.__kitReady = true; }));
  }
}
`;
}

const HTML = `<!doctype html><html lang="en" data-theme="atmosphere"${lite ? ' data-lite="1"' : ""}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="/visual.css"><style>body{margin:0;padding:16px;background:var(--canvas)}#root{min-height:1px}</style></head>
<body><div class="frame"><main class="app"><div id="root"></div></main></div><script type="module" src="/visual.js"></script></body></html>`;

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(HARNESS_DIR, { recursive: true });
  const nodeModules = extractVendor(() => {});
  const entry = path.join(HARNESS_DIR, "visual-entry.tsx");
  writeText(entry, entrySource());
  const built = await bundle(entry, nodeModules, { externals: [], bundleReact: true });
  const files = new Map<string, { body: string | Buffer; type: string }>([
    ["/", { body: HTML, type: "text/html" }],
    ["/visual.js", { body: built.js, type: "text/javascript" }],
    ["/visual.css", { body: built.css, type: "text/css" }],
  ]);
  const fontsDir = path.join(KIT_DIR, "air", "fonts");
  for (const f of fs.existsSync(fontsDir) ? fs.readdirSync(fontsDir) : []) files.set(`/fonts/${f}`, { body: fs.readFileSync(path.join(fontsDir, f)), type: "font/woff2" });
  const server = http.createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0]!;
    const hit = files.get(url) ?? files.get("/");
    res.writeHead(200, { "content-type": hit!.type, "cache-control": "no-store" });
    res.end(hit!.body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;

  const pw = loadPlaywright();
  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: process.env.KIT_CHROMIUM,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const manifest: Record<string, unknown>[] = [];
  for (const spec of specs) {
    const name = spec.id.replace("/", "--");
    const dir = path.join(OUT, name);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 760 },
      deviceScaleFactor: 2,
      reducedMotion: "no-preference",
      recordVideo: { dir, size: { width: 390, height: 760 } },
    });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/#${encodeURIComponent(spec.id)}`);
    await page.waitForFunction("window.__kitReady === true || window.__kitErrors.length > 0", null, { timeout: 15_000 });
    const shots: string[] = [];
    const marks = [0.4, SECONDS / 2, SECONDS];
    let elapsed = 0;
    for (const m of marks) {
      await page.waitForTimeout(Math.max(0, (m - elapsed) * 1000));
      elapsed = m;
      const file = path.join(dir, `t${m.toFixed(1).replace(".", "_")}s.png`);
      await page.screenshot({ path: file, fullPage: false });
      shots.push(path.relative(OUT, file));
    }
    const errors = (await page.evaluate("window.__kitErrors")) as string[];
    const height = (await page.evaluate("document.getElementById('root').getBoundingClientRect().height")) as number;
    const video = page.video();
    await ctx.close();
    const videoPath = video ? await video.path() : null;
    let finalVideo: string | null = null;
    if (videoPath) {
      finalVideo = path.join(dir, "motion.webm");
      fs.renameSync(videoPath, finalVideo);
    }
    manifest.push({ id: spec.id, lite: spec.litePolicy !== "never", seconds: SECONDS, heightPx: Math.round(height), errors, screenshots: shots, video: finalVideo ? path.relative(OUT, finalVideo) : null });
    console.log(`${spec.id.padEnd(28)} h=${Math.round(height)} errors=${errors.length} → ${path.relative(KIT_ROOT, dir)}`);
  }
  await browser.close();
  server.close();
  writeText(path.join(OUT, "manifest.json"), JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), viewport: "390x760@2x", lite, components: manifest }, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
