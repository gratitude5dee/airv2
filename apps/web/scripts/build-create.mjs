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
  entryPoints: [join(root, "lib/miniapps/client/create/index.tsx")],
  outfile: join(root, "public/creator-os/create.js"),
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": root },
  logLevel: "info",
});
