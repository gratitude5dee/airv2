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
  entryPoints: [join(root, "lib/miniapps/client/freeze-studio.tsx")],
  outfile: join(root, "public/creator-os/freeze-studio.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": root },
  logLevel: "info",
});
