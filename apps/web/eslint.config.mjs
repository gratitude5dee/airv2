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
      "public/creator-os/freeze-studio.js", "public/creator-os/draw-studio.js",
      // Vendored web-component bundle (committed, not lintable source).
      "public/creator-os/fx.js",
      "lib/miniapps/client/backgrounds/**",
    ],
  },
  {
    rules: {
      // `_name` marks intentionally unused params/vars (mock signatures,
      // rest-sibling omissions) — it is not a license to drop the rule.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },
  {
    // Mini-app clients are esbuild IIFE bundles rendered inside the box —
    // next/image is not available there, so plain <img> is correct.
    files: ["lib/miniapps/client/**/*.{ts,tsx}"],
    rules: { "@next/next/no-img-element": "off" },
  },
];

export default config;
