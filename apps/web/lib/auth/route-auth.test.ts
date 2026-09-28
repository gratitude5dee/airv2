/**
 * R-ARCH-01 repo guard: API route files must not carry a credential check
 * of their own — `gateway_token` lookups and direct `CRON_SECRET` reads
 * belong to lib/auth (requireBox / requireCron). Any new route that
 * hand-rolls one fails here.
 *
 * Routes still holding a legacy mechanism while a later migration PR lands
 * are pinned in ALLOWLIST below. An entry is also required to still match a
 * forbidden pattern — a stale entry fails the test, so the list can only
 * shrink, never silently go stale.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const API_DIR = fileURLToPath(new URL("../../app/api", import.meta.url));

const FORBIDDEN = [
  /\bgateway_token\b/,
  /process\.env\s*(?:\[\s*["']|\.)\s*CRON_SECRET\b/,
];

/** Routes still holding a legacy credential check, awaiting migration. */
const ALLOWLIST: readonly string[] = [];

function routeFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(path));
    else if (entry.name === "route.ts") files.push(path);
  }
  return files;
}

function violates(source: string): boolean {
  return FORBIDDEN.some((pattern) => pattern.test(source));
}

describe("route auth (R-ARCH-01)", () => {
  it("fails on gateway_token or CRON_SECRET reads in app/api/**/route.ts", () => {
    const violations = routeFiles(API_DIR)
      .map((path) => relative(API_DIR, path))
      .filter((rel) => violates(readFileSync(join(API_DIR, rel), "utf8")) && !ALLOWLIST.includes(rel));
    expect(violations).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still violates", () => {
    for (const rel of ALLOWLIST) {
      expect(
        violates(readFileSync(join(API_DIR, rel), "utf8")),
        `${rel} is allowlisted but no longer carries a forbidden pattern — remove it`
      ).toBe(true);
    }
  });
});
