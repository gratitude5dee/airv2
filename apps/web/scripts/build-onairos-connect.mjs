/**
 * Bundles the native Onairos connect entry (lib/miniapps/client/
 * onairos-connect.tsx) into public/creator-os/onairos-connect.js so the
 * onboarding mini-app can serve it same-origin under its script-src 'self'
 * CSP. Runs automatically before `next build` (prebuild).
 */
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The Onairos API sends no CORS headers, so direct browser calls to
// api2.onairos.uk are blocked on our origins. Point the SDK at the
// same-origin relay (app/api/mini/onairos/[...path]/route.ts) instead.
const rewriteOnairosBase = {
  name: "rewrite-onairos-base",
  setup(pluginBuild) {
    pluginBuild.onLoad(
      { filter: /node_modules[\\/]onairos[\\/].*\.[cm]?js$/ },
      async (args) => {
        const source = await readFile(args.path, "utf8");
        return {
          contents: source.replaceAll(
            "https://api2.onairos.uk",
            "/api/mini/onairos"
          ),
          loader: "js",
        };
      }
    );
  },
};

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
  alias: { "@": root },
  plugins: [rewriteOnairosBase],
  logLevel: "info",
});
