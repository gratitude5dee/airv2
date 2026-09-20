import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      // vitest-pool-workers 0.22 ships a workerd binary that predates the
      // Worker compatibility date. This affects local emulation only; the
      // deploy config remains at the current date in wrangler.toml.
      miniflare: { compatibilityDate: "2026-08-22" }
    })
  ],
  test: {
    include: ["test/**/*.test.ts"]
  }
});
