import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Source .tsx follows Next's automatic JSX runtime; without this esbuild
  // lowers JSX to React.createElement and components fail with
  // "React is not defined" under vitest.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
