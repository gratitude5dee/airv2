/**
 * Bundles the switchable-backdrop entry (lib/miniapps/client/backgrounds/
 * entry.jsx) into public/creator-os/bg/ so mini-app shells can serve it
 * same-origin under their script-src 'self' CSP. Code splitting keeps the
 * download to the one chosen effect's chunk (the three.js effects are heavy).
 * Runs automatically before `next build` (prebuild).
 */
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "public/creator-os/bg");

await rm(outdir, { recursive: true, force: true });
await build({
  entryPoints: { bg: join(root, "lib/miniapps/client/backgrounds/entry.jsx") },
  outdir,
  chunkNames: "chunks/[name]-[hash]",
  bundle: true,
  minify: true,
  format: "esm",
  splitting: true,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});
