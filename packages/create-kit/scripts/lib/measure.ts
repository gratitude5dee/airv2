/**
 * Weight measurement with esbuild against the vendored packages. Two numbers:
 *  - own: the component's files, minified, vendor packages external (what the
 *    component adds to an app that already has react/motion/…);
 *  - full: own + everything it pulls from vendor except react/react-dom
 *    (what it costs an app that has nothing but React).
 * All sizes are gzip level 9, in KiB rounded up to 0.1.
 */
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";
import { KIT_DIR } from "./paths.ts";

export interface Weight {
  readonly js: number;
  readonly css: number;
  readonly jsFull: number;
}

export function gzKb(text: string | Uint8Array): number {
  const buf = typeof text === "string" ? Buffer.from(text) : Buffer.from(text);
  return Math.ceil((gzipSync(buf, { level: 9 }).length / 1024) * 10) / 10;
}

export interface BundleResult {
  readonly js: string;
  readonly css: string;
  readonly inputs: readonly string[];
  readonly warnings: readonly string[];
}

const ALWAYS_EXTERNAL = ["react", "react-dom", "react/jsx-runtime", "react-dom/client"];

/** Pin every bare vendor import to the snapshot so the repo's own node_modules can never leak in (one React). */
function vendorAliases(nodeModules: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(nodeModules)) return out;
  for (const name of fs.readdirSync(nodeModules)) {
    if (name.startsWith(".")) continue;
    if (name.startsWith("@")) {
      for (const sub of fs.readdirSync(path.join(nodeModules, name))) out[`${name}/${sub}`] = path.join(nodeModules, name, sub);
    } else out[name] = path.join(nodeModules, name);
  }
  return out;
}

export async function bundle(
  entry: string,
  nodeModules: string,
  opts: { readonly externals: readonly string[]; readonly bundleReact?: boolean; readonly define?: Record<string, string> }
): Promise<BundleResult> {
  const externals = new Set([...(opts.bundleReact ? [] : ALWAYS_EXTERNAL), ...opts.externals]);
  // Runs before the alias map, so a vendored package can still be left out of the bundle.
  const externalPlugin: esbuild.Plugin = {
    name: "kit-externals",
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        const pkg = args.path.startsWith("@") ? args.path.split("/").slice(0, 2).join("/") : args.path.split("/")[0]!;
        return externals.has(pkg) || externals.has(args.path) ? { path: args.path, external: true } : null;
      });
    },
  };
  const result = await esbuild.build({
    entryPoints: [entry],
    plugins: [externalPlugin],
    bundle: true,
    write: false,
    minify: true,
    format: "esm",
    platform: "browser",
    target: ["es2020", "safari15"],
    jsx: "automatic",
    metafile: true,
    logLevel: "silent",
    legalComments: "none",
    outdir: "/out",
    nodePaths: [nodeModules],
    alias: vendorAliases(nodeModules),
    define: { "process.env.NODE_ENV": '"production"', ...opts.define },
    loader: { ".woff2": "empty", ".png": "empty", ".svg": "dataurl", ".md": "text" },
    absWorkingDir: KIT_DIR,
  });
  let js = "";
  let css = "";
  for (const f of result.outputFiles) {
    if (f.path.endsWith(".css")) css += f.text;
    else js += f.text;
  }
  // Strip esbuild's "use client" directive-preservation warnings; they are expected.
  const warnings = result.warnings.filter((w) => !/directive/i.test(w.text)).map((w) => `${w.location?.file ?? ""}: ${w.text}`);
  const inputs = Object.keys(result.metafile.inputs).map((p) => p.split(path.sep).join("/"));
  return { js, css, inputs, warnings };
}

export async function measureComponent(entry: string, nodeModules: string, vendorNames: readonly string[]): Promise<Weight> {
  const own = await bundle(entry, nodeModules, { externals: vendorNames });
  const full = await bundle(entry, nodeModules, { externals: [] });
  return { js: gzKb(own.js), css: gzKb(own.css), jsFull: gzKb(full.js) };
}
