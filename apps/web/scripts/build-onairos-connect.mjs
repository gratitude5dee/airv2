/**
 * Bundles the native Onairos connect entry (lib/miniapps/client/
 * onairos-connect.tsx) into public/creator-os/onairos-connect.js so the
 * onboarding mini-app can serve it same-origin under its script-src 'self'
 * CSP. Runs automatically before `next build` (prebuild).
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "lib/miniapps/client/onairos-connect.tsx")],
  outfile: join(root, "public/creator-os/onairos-connect.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".png": "dataurl" },
  logLevel: "info",
});
