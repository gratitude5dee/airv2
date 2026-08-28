/**
 * Bundles the Get started clipboard client (lib/miniapps/client/prompt-copy.ts)
 * into public/creator-os/prompt-copy.js so the onboarding Get started slide
 * can serve it same-origin under its script-src 'self' CSP. Runs
 * automatically before `next build` (prebuild).
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "lib/miniapps/client/prompt-copy.ts")],
  outfile: join(root, "public/creator-os/prompt-copy.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": root },
  logLevel: "info",
});
