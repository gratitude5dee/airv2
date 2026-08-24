/**
 * Bundles the Image Studio client editor (lib/miniapps/client/image-editor.tsx)
 * into public/creator-os/image-editor.js so the image mini-app can serve it
 * same-origin under its script-src 'self' CSP. Runs automatically before
 * `next build` (prebuild).
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "lib/miniapps/client/image-editor.tsx")],
  outfile: join(root, "public/creator-os/image-editor.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": root },
  logLevel: "info",
});
