/**
 * Bundles the slide stepper client (lib/miniapps/client/deck-stepper.ts)
 * into public/creator-os/deck-stepper.js so multi-section onboarding slides
 * can serve it same-origin under their script-src 'self' CSP. Runs
 * automatically before `next build` (prebuild).
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "lib/miniapps/client/deck-stepper.ts")],
  outfile: join(root, "public/creator-os/deck-stepper.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": root },
  logLevel: "info",
});
