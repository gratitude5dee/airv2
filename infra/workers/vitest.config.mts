import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": fileURLToPath(
        new URL("./test/helpers/cloudflare-workers.mjs", import.meta.url)
      ),
    },
  },
  test: {
    include: ["test/**/*.test.mts"],
    environment: "node",
  },
});
