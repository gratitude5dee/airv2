/**
 * The Date.now() flake class (R-TQ-05): two fixture calls straddling a
 * millisecond boundary produce an off-by-one delta — the agentPlan cadence
 * assertion flaked this way. Any *.test.ts that reads Date.now() must pin
 * the clock with vi.useFakeTimers() so fixture and impl calls agree.
 *
 * LEGACY lists the files that predate the rule and were audited benign
 * (wide-margin fixtures, self-consistent fake clocks, unique ids). Convert
 * one and remove its entry — never add new entries.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..", "..");
const SELF = fileURLToPath(import.meta.url);

const LEGACY = new Set([
  "app/api/admin/boxes/stop-idle/route.test.ts",
  "app/api/admin/create/route.test.ts",
  "app/api/admin/deployments/route.test.ts",
  "app/api/admin/health/route.test.ts",
  "app/api/admin/onboarding/route.test.ts",
  "app/api/admin/timeseries/route.test.ts",
  "app/api/browser/otp/route.test.ts",
  "app/api/content/plan/route.test.ts",
  "app/api/create/github/setup/route.test.ts",
  "app/api/create/status/route.test.ts",
  "app/api/inbound/github/route.test.ts",
  "app/api/mini/grant/route.test.ts",
  "app/mini/loader.test.ts",
  "lib/ads/metrics.test.ts",
  "lib/approvals/token.test.ts",
  "lib/box/tenki.test.ts",
  "lib/commerce/commerce.test.ts",
  "lib/create/intake.test.ts",
  "lib/create/turn.test.ts",
  "lib/functions/redteam.test.ts",
  "lib/functions/tokens.test.ts",
  "lib/github/app.test.ts",
  "lib/imessage/ingest.test.ts",
  "lib/location/location-store.test.ts",
  "lib/miniapps/actionLog.test.ts",
  "lib/miniapps/apps/checkout.test.tsx",
  "lib/miniapps/cardSends.test.ts",
  "lib/miniapps/commandLane.test.ts",
  "lib/miniapps/draw-admission.test.ts",
  "lib/miniapps/freeze.test.ts",
  "lib/onairos/sync.test.ts",
  "lib/payments/x402.test.ts",
  "lib/plugin/auth.test.ts",
  "lib/provisioning/provision.test.ts",
  "lib/routing/spectrum.test.ts",
  "lib/routing/svix.test.ts",
  "lib/storage/sweep.test.ts",
  "lib/vault/tickets.test.ts",
]);

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "coverage"]);

function* testFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* testFiles(path);
    } else if (/\.test\.tsx?$/.test(entry.name)) {
      yield path;
    }
  }
}

describe("no bare Date.now() in test files", () => {
  it("Date.now() appears only in files that pin the clock or listed legacies", () => {
    const violations: string[] = [];
    const stale: string[] = [];
    for (const file of testFiles(ROOT)) {
      if (file === SELF) continue;
      const rel = relative(ROOT, file);
      const source = readFileSync(file, "utf8");
      const usesDateNow = source.includes("Date.now");
      const pinsClock = source.includes("useFakeTimers");
      if (usesDateNow && !pinsClock && !LEGACY.has(rel)) {
        violations.push(rel);
      }
      if (LEGACY.has(rel) && (pinsClock || !usesDateNow)) {
        stale.push(rel);
      }
    }
    expect(
      violations,
      `test files reading Date.now() without vi.useFakeTimers(): ${violations.join(", ")}`
    ).toEqual([]);
    expect(
      stale,
      `legacies that now pin the clock — remove them from LEGACY: ${stale.join(", ")}`
    ).toEqual([]);
  });
});
