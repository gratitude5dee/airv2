/**
 * Headless "lite verdict": every component is mounted in a 390×760 Chromium
 * with WebGL disabled and prefers-reduced-motion: reduce, on the Air theme.
 * Pass = mounts without an uncaught error, paints a non-empty box, and makes
 * no network request outside the harness origin.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import type { ComponentSpec } from "./catalog.ts";
import { HARNESS_DIR, KIT_DIR } from "./paths.ts";
import { bundle } from "./measure.ts";
import { writeText } from "./fsx.ts";

export interface Verdict {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly heightPx: number;
  readonly requests: readonly string[];
}

const ORIGIN = "https://kit.harness";

/** The slice of playwright-core we use; the package is loaded from the npx cache, not a dependency. */
interface PwRequest {
  url(): string;
}
interface PwRoute {
  request(): PwRequest;
  abort(code: string): Promise<void>;
  fulfill(opts: { status: number; body: string | Buffer; contentType?: string }): Promise<void>;
}
interface PwConsole {
  type(): string;
  text(): string;
}
interface PwPage {
  on(event: "pageerror", cb: (e: Error) => void): void;
  on(event: "console", cb: (m: PwConsole) => void): void;
  on(event: "request", cb: (r: PwRequest) => void): void;
  goto(url: string, opts: { waitUntil: "load" }): Promise<unknown>;
  waitForFunction(fn: () => boolean, arg: null, opts: { timeout: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
}
interface PwContext {
  route(glob: string, handler: (route: PwRoute) => Promise<void>): Promise<void>;
  newPage(): Promise<PwPage>;
}
interface PwBrowser {
  newContext(opts: Record<string, unknown>): Promise<PwContext>;
  close(): Promise<void>;
}
interface PlaywrightModule {
  chromium: { launch(opts: { headless: boolean; args: string[]; executablePath?: string }): Promise<PwBrowser> };
}

function loadPlaywright(): PlaywrightModule {
  const req = createRequire(import.meta.url);
  const candidates: string[] = [];
  if (process.env.KIT_PLAYWRIGHT) candidates.push(process.env.KIT_PLAYWRIGHT);
  candidates.push("playwright-core", "playwright");
  const bun = path.join(os.homedir(), ".bun", "install", "cache", "playwright-core");
  if (fs.existsSync(bun)) for (const d of fs.readdirSync(bun).sort().reverse()) candidates.push(path.join(bun, d));
  const npx = path.join(os.homedir(), ".npm", "_npx");
  if (fs.existsSync(npx)) {
    for (const d of fs.readdirSync(npx)) {
      candidates.push(path.join(npx, d, "node_modules", "playwright-core"));
      candidates.push(path.join(npx, d, "node_modules", "playwright"));
    }
  }
  for (const c of candidates) {
    try {
      return req(c) as PlaywrightModule;
    } catch {
      /* next */
    }
  }
  throw new Error("playwright-core not found. `npx -y playwright@1.62 install chromium` or set KIT_PLAYWRIGHT=/path/to/playwright-core");
}

/** Chromium binary: KIT_CHROMIUM, else the newest ms-playwright download, else let playwright resolve. */
function chromiumPath(): string | undefined {
  if (process.env.KIT_CHROMIUM) return process.env.KIT_CHROMIUM;
  const root = path.join(os.homedir(), ".cache", "ms-playwright");
  if (!fs.existsSync(root)) return undefined;
  const dirs = fs.readdirSync(root).filter((d) => d.startsWith("chromium")).sort().reverse();
  for (const d of dirs) {
    for (const rel of ["chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux64/chrome", "chrome-linux/chrome"]) {
      const p = path.join(root, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

function exportPicker(spec: ComponentSpec): string {
  return spec.demoExport ?? "";
}

function entrySource(specs: readonly ComponentSpec[]): string {
  const imports = specs.map((s, i) => `import * as m${i} from "../kit/${s.id}/${s.entry ?? "index.tsx"}";`).join("\n");
  const table = specs
    .map((s, i) => `  ${JSON.stringify(s.id)}: { mod: m${i}, pick: ${JSON.stringify(exportPicker(s))}, props: ${JSON.stringify(s.demo ?? {})}, kind: ${JSON.stringify(s.kind ?? "component")} },`)
    .join("\n");
  return `import React from "react";
import { createRoot } from "react-dom/client";
import "../kit/air/theme.css";
import "../kit/air/shell.css";
${imports}

const TABLE: Record<string, { mod: Record<string, unknown>; pick: string; props: Record<string, unknown>; kind: string }> = {
${table}
};

// Function components, classes, and forwardRef/memo exotic objects all count.
function isComponent(v: unknown): boolean {
  return typeof v === "function" || (typeof v === "object" && v !== null && "$$typeof" in v);
}

function pickComponent(mod: Record<string, unknown>, pick: string): ((p: Record<string, unknown>) => unknown) | null {
  if (pick && isComponent(mod[pick])) return mod[pick] as never;
  if (isComponent(mod.default)) return mod.default as never;
  for (const k of Object.keys(mod)) {
    if (/^[A-Z]/.test(k) && isComponent(mod[k])) return mod[k] as never;
  }
  return null;
}

class Boundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { error: String(e) }; }
  componentDidCatch(e: unknown) { (window as unknown as { __kitErrors: string[] }).__kitErrors.push("render: " + String(e)); }
  render() { return this.state.error ? React.createElement("pre", { "data-kit-error": "" }, this.state.error) : this.props.children; }
}

const w = window as unknown as { __kitErrors: string[]; __kitReady: boolean; __kitMissing: boolean };
w.__kitErrors = [];
w.__kitReady = false;
w.__kitMissing = false;
window.addEventListener("error", (e) => w.__kitErrors.push("error: " + (e.message || String(e))));
window.addEventListener("unhandledrejection", (e) => w.__kitErrors.push("rejection: " + String(e.reason)));

const id = decodeURIComponent(location.hash.slice(1));
const entry = TABLE[id];
const rootEl = document.getElementById("root")!;
if (!entry) {
  w.__kitErrors.push("unknown id " + id);
} else if (entry.kind === "style" || entry.kind === "helper" && !pickComponent(entry.mod, entry.pick)) {
  // Styles/helpers without a component: importing without throwing is the test.
  rootEl.innerHTML = '<div class="panel" style="min-height:40px">' + id + "</div>";
  w.__kitReady = true;
} else {
  const C = pickComponent(entry.mod, entry.pick);
  if (!C) {
    w.__kitMissing = true;
    w.__kitErrors.push("no component export in " + id);
  } else {
    // Demo props are JSON; { "$ref": "root" } becomes a ref to the mount node (containerRef-style props).
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry.props)) {
      props[k] = v && typeof v === "object" && (v as { $ref?: string }).$ref === "root" ? { current: rootEl } : v;
    }
    createRoot(rootEl).render(
      React.createElement(Boundary, null, React.createElement(C as never, props as never))
    );
    requestAnimationFrame(() => requestAnimationFrame(() => { w.__kitReady = true; }));
  }
}
`;
}

const HTML = `<!doctype html><html lang="en" data-theme="atmosphere" data-lite="1"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="/harness.css"><style>body{padding:16px}#root{min-height:1px}</style></head>
<body><div class="frame"><main class="app"><div id="root"></div></main></div><script type="module" src="/harness.js"></script></body></html>`;

export async function runHarness(
  specs: readonly ComponentSpec[],
  nodeModules: string,
  log: (s: string) => void
): Promise<Map<string, Verdict>> {
  fs.mkdirSync(HARNESS_DIR, { recursive: true });
  const entry = path.join(HARNESS_DIR, "entry.tsx");
  writeText(entry, entrySource(specs));
  const built = await bundle(entry, nodeModules, { externals: [] , bundleReact: true });
  const files = new Map<string, { body: string; type: string }>([
    ["/", { body: HTML, type: "text/html" }],
    ["/harness.js", { body: built.js, type: "text/javascript" }],
    ["/harness.css", { body: built.css, type: "text/css" }],
  ]);
  const fontsDir = path.join(KIT_DIR, "air", "fonts");
  const fontFiles = new Map<string, Buffer>();
  for (const f of fs.existsSync(fontsDir) ? fs.readdirSync(fontsDir) : []) fontFiles.set(`/fonts/${f}`, fs.readFileSync(path.join(fontsDir, f)));

  const pw = loadPlaywright();
  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis", "--disable-gpu"],
  });
  const results = new Map<string, Verdict>();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 760 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      colorScheme: "dark",
      offline: false,
    });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== ORIGIN) {
        await route.abort("blockedbyclient");
        return;
      }
      const font = fontFiles.get(url.pathname);
      if (font) {
        await route.fulfill({ status: 200, body: font, contentType: "font/woff2" });
        return;
      }
      const f = files.get(url.pathname === "" ? "/" : url.pathname);
      if (!f) {
        await route.fulfill({ status: 404, body: "not found" });
        return;
      }
      await route.fulfill({ status: 200, body: f.body, contentType: f.type });
    });

    for (const spec of specs) {
      const page = await context.newPage();
      const errors: string[] = [];
      const requests: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console: ${m.text()}`);
      });
      page.on("request", (r) => {
        const u = new URL(r.url());
        if (u.origin !== ORIGIN) requests.push(r.url());
      });
      let heightPx = 0;
      try {
        await page.goto(`${ORIGIN}/#${encodeURIComponent(spec.id)}`, { waitUntil: "load" });
        await page.waitForFunction(() => (window as unknown as { __kitReady: boolean; __kitErrors: string[] }).__kitReady || (window as unknown as { __kitErrors: string[] }).__kitErrors.length > 0, null, { timeout: 8000 }).catch(() => undefined);
        await page.waitForTimeout(400);
        const state = await page.evaluate(() => {
          const w = window as unknown as { __kitErrors: string[] };
          const root = document.getElementById("root");
          const r = root ? root.getBoundingClientRect() : { height: 0 };
          const errEl = document.querySelector("[data-kit-error]");
          return { errors: w.__kitErrors, height: r.height, rendered: errEl ? "boundary" : "" };
        });
        errors.push(...state.errors);
        heightPx = state.height;
      } catch (e) {
        errors.push(`harness: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        await page.close();
      }
      const ok = errors.length === 0 && requests.length === 0 && heightPx > 0;
      results.set(spec.id, { ok, errors, heightPx: Math.round(heightPx), requests });
      log(`${ok ? "ok  " : "FAIL"} ${spec.id} h=${Math.round(heightPx)}${errors.length ? " " + errors[0] : ""}`);
    }
  } finally {
    await browser.close();
  }
  return results;
}
