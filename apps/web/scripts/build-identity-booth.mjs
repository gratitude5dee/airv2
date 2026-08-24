/**
 * Bundles the photo-booth client (lib/miniapps/client/identity-booth.tsx)
 * into public/creator-os/identity-booth.js so the onboarding selfies/twin
 * slides can serve it same-origin under their script-src 'self' CSP. Runs
 * automatically before `next build` (prebuild).
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "lib/miniapps/client/identity-booth.tsx")],
  outfile: join(root, "public/creator-os/identity-booth.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": root },
  logLevel: "info",
});
