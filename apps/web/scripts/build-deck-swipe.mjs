/**
 * Bundles the deck swipe-navigation client (lib/miniapps/client/deck-swipe.ts)
 * into public/creator-os/deck-swipe.js so the onboarding deck can serve it
 * same-origin under its script-src 'self' CSP. Runs automatically before
 * `next build` (prebuild).
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "lib/miniapps/client/deck-swipe.ts")],
  outfile: join(root, "public/creator-os/deck-swipe.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": root },
  logLevel: "info",
});
