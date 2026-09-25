import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**", "node_modules/**", "next-env.d.ts",
      // esbuild bundles emitted by the prebuild scripts (git-ignored).
      "public/creator-os/onairos-connect.js", "public/creator-os/identity-booth.js",
      "public/creator-os/image-editor.js", "public/creator-os/prompt-copy.js",
      "public/creator-os/deck-swipe.js", "public/creator-os/calendar-month.js",
      "public/creator-os/deck-pending.js", "public/creator-os/deck-timing.js", "public/creator-os/intro-cinematic.js",
      "public/creator-os/create.js", "public/creator-os/bg/**",
      "public/creator-os/freeze-studio.js",
      // code-split chunks emitted beside the bundles (vendored library code).
      "public/creator-os/chunks/**",
      "lib/miniapps/client/backgrounds/**",
    ],
  },
];

export default config;
