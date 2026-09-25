import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
const alias = { "@": root };

/**
 * Pure-function suites listed in vitest.pure-tests.txt share one module
 * graph per worker (isolate: false) so their imports are evaluated once per
 * worker instead of once per file — the dominant cost in the collect phase.
 * Everything else stays isolated.
 */
const pureTests = readFileSync(
  new URL("./vitest.pure-tests.txt", import.meta.url),
  "utf-8"
)
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));

export default defineConfig({
  test: {
    pool: "threads",
    projects: [
      {
        resolve: { alias },
        test: {
          name: "pure",
          include: pureTests,
          poolOptions: { threads: { isolate: false } },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "unit",
          exclude: [...configDefaults.exclude, ...pureTests],
        },
      },
    ],
  },
});
