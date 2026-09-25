/**
 * R-ARCH-02: the env contract tests — the grep guard (no `process.env`
 * reads outside lib/env.ts), the boot-time validateEnv semantics, and the
 * manifest/accessor coherence check.
 */
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  envSchema,
  OPTIONAL_ENV,
  REQUIRED_ENV,
  REQUIRED_GROUPS,
  validateEnv,
} from "./env";

const WEB_ROOT = join(__dirname, "..");
const API_DIRS = ["app", "components", "lib"];
const ROOT_FILES = ["middleware.ts", "instrumentation.ts"];

/**
 * Files allowed to read `process.env` directly (besides lib/env.ts itself).
 * The migration allowlist: entries may only be REMOVED, not added — the next
 * env PRs shrink this list to zero.
 *
 * - lib/create/config.ts: the Create lane's own lazy-read accessor module
 *   (same contract as lib/env — call-time reads with defaults); its vars are
 *   in OPTIONAL_ENV so the manifest still describes them.
 */
const ALLOWLIST: readonly string[] = ["lib/create/config.ts"];

/** Reads that are legitimately outside the manifest: build-time client vars
 * and the runtime's own NODE_ENV switch. */
const EXEMPT_VAR = /^(NODE_ENV|NEXT_PUBLIC_)/;

const ENV_READ = /process\.env\s*(?:\[\s*["'`]([A-Z0-9_]+)["'`]\s*\]|\.([A-Z0-9_]+))/g;

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* sourceFiles(path);
    } else if (/\.(ts|tsx|mts|mjs|js|jsx)$/.test(entry) && !/\.test\./.test(entry)) {
      yield path;
    }
  }
}

function envReads(path: string): string[] {
  const names: string[] = [];
  for (const match of readFileSync(path, "utf8").matchAll(ENV_READ)) {
    const name = match[1] ?? match[2];
    if (name && !EXEMPT_VAR.test(name)) names.push(name);
  }
  return names;
}

describe("env grep guard", () => {
  it("finds no process.env reads outside lib/env.ts and the allowlist", () => {
    const violations: string[] = [];
    const files = [
      ...API_DIRS.flatMap((dir) => [...sourceFiles(join(WEB_ROOT, dir))]),
      ...ROOT_FILES.map((file) => join(WEB_ROOT, file)),
    ];
    for (const path of files) {
      const rel = relative(WEB_ROOT, path);
      if (rel === "lib/env.ts" || ALLOWLIST.includes(rel)) continue;
      for (const name of envReads(path)) {
        violations.push(`${rel}: ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still reads process.env", () => {
    for (const rel of ALLOWLIST) {
      const path = join(WEB_ROOT, rel);
      expect(
        envReads(path).length,
        `${rel} no longer reads process.env — remove it from the allowlist`
      ).toBeGreaterThan(0);
    }
  });
});

describe("env manifest coherence", () => {
  const source = readFileSync(join(WEB_ROOT, "lib/env.ts"), "utf8");
  const MANIFEST = new Set<string>([
    ...REQUIRED_ENV,
    ...OPTIONAL_ENV,
    ...REQUIRED_GROUPS.flat(),
  ]);

  const readNames = new Set<string>();
  for (const re of [
    /required\("([A-Z0-9_]+)"/g,
    /optional\("([A-Z0-9_]+)"/g,
    /process\.env\["([A-Z0-9_]+)"\]/g,
  ]) {
    for (const match of source.matchAll(re)) {
      const name = match[1];
      if (name) readNames.add(name);
    }
  }

  it("declares every variable env.ts reads", () => {
    for (const name of readNames) {
      expect(
        MANIFEST.has(name),
        `${name} is read by an accessor but missing from REQUIRED_ENV/OPTIONAL_ENV`
      ).toBe(true);
    }
  });

  it("marks every throwing accessor as required (or a required group)", () => {
    const required = new Set<string>([
      ...REQUIRED_ENV,
      ...REQUIRED_GROUPS.flat(),
    ]);
    for (const match of source.matchAll(/required\("([A-Z0-9_]+)"/g)) {
      const name = match[1];
      if (!name) continue;
      expect(
        required.has(name),
        `required("${name}") throws when missing but is not declared required`
      ).toBe(true);
    }
  });

  it("keeps the manifest disjoint", () => {
    const req: ReadonlySet<string> = new Set(REQUIRED_ENV);
    const opt: ReadonlySet<string> = new Set(OPTIONAL_ENV);
    expect([...req].filter((name) => opt.has(name))).toEqual([]);
  });
});

function fullEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const name of REQUIRED_ENV) env[name] = "test-value";
  for (const group of REQUIRED_GROUPS) env[group[0]] = "test-value";
  return env;
}

describe("validateEnv", () => {
  it("passes when every required variable is set", () => {
    expect(() => validateEnv(fullEnv(), "production")).not.toThrow();
  });

  it("lists every missing required variable on a production boot", () => {
    const env = fullEnv();
    delete env["ADMIN_API_KEY"];
    delete env["STRIPE_SECRET_KEY"];
    expect(() => validateEnv(env, "production")).toThrow(
      /Missing required env var\(s\): .*ADMIN_API_KEY.*STRIPE_SECRET_KEY/
    );
  });

  it("counts an empty string as missing", () => {
    const env = fullEnv();
    env["SESSION_SECRET"] = "";
    expect(() => validateEnv(env, "production")).toThrow(/SESSION_SECRET/);
  });

  it("accepts any member of a fallback group", () => {
    const env = fullEnv();
    delete env["MODEL_PROVIDER_API_KEY"];
    env["OPENROUTER_API_KEY"] = "test-value";
    expect(() => validateEnv(env, "production")).not.toThrow();
  });

  it("fails a fallback group when no member is set", () => {
    const env = fullEnv();
    delete env["MODEL_PROVIDER_API_KEY"];
    delete env["OPENROUTER_API_KEY"];
    delete env["STT_API_KEY"];
    expect(() => validateEnv(env, "production")).toThrow(
      /one of MODEL_PROVIDER_API_KEY/
    );
  });

  it("warns but does not throw outside production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(() => validateEnv({ NODE_ENV: "test" }, "test")).not.toThrow();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Missing required env var(s)")
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("passes unknown variables through", () => {
    const env = { ...fullEnv(), RANDOM_OPS_VAR: "x" };
    expect(envSchema.safeParse(env).success).toBe(true);
  });
});
