/**
 * Bundles the Freeze Studio client (lib/miniapps/client/freeze-studio.tsx)
 * into public/creator-os/freeze-studio.js so the freeze mini-app can serve
 * it same-origin under script-src 'self'. Runs automatically before
 * `next build` (prebuild).
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [
    { in: join(root, "lib/miniapps/client/freeze-studio.tsx"), out: "freeze-studio" },
  ],
  outdir: join(root, "public/creator-os"),
  // R-PERF-07: `three` (~660 KB) rides an async chunk loaded only when the
  // 3D stage mounts. chunks/freeze/ is committed alongside freeze-studio.js.
  chunkNames: "chunks/freeze/[name]-[hash]",
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
