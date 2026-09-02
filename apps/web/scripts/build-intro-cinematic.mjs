/**
 * Bundles the cinematic welcome-intro client (lib/miniapps/client/intro-cinematic.ts)
 * into public/creator-os/intro-cinematic.js so the onboarding deck can serve it
 * same-origin under its script-src 'self' CSP. Runs automatically before
 * `next build` (prebuild).
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "lib/miniapps/client/intro-cinematic.ts")],
  outfile: join(root, "public/creator-os/intro-cinematic.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": root },
  logLevel: "info",
});
