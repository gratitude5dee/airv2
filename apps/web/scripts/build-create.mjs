/**
 * Bundles the Create studio island (lib/miniapps/client/create/index.tsx)
 * into public/creator-os/create.js so a shell page can hydrate it same-origin
 * under its script-src 'self' CSP (V11 §5.1). Runs automatically before
 * `next build` (prebuild).
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [
    { in: join(root, "lib/miniapps/client/create/index.tsx"), out: "create" },
  ],
  outdir: join(root, "public/creator-os"),
  // R-PERF-07: the entry stays a tiny shell — react-dom and the studio
  // land in chunks/create/ and hydrate behind a dynamic import.
  chunkNames: "chunks/create/[name]-[hash]",
  bundle: true,
  minify: true,
  format: "esm",
  splitting: true,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": root },
  logLevel: "info",
});
