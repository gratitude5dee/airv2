/**
 * The replacement lease must outlive every route that can hold it. Next.js
 * needs `maxDuration` to be a literal, so the routes can't import the
 * constant; this pins them to it instead.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LONGEST_REPLACE_CALLER_SECONDS,
  REPLACE_CLAIM_TTL_MS,
} from "./provision";

const APP_DIR = path.resolve(__dirname, "..", "..", "app");
const REPLACE_CALLER_ROUTES = [
  "mini/[app]/route.ts",
  "api/admin/boxes/reprovision/route.ts",
];

function maxDurationOf(route: string): number {
  const source = fs.readFileSync(path.join(APP_DIR, route), "utf8");
  const match = /export const maxDuration = (\d+);/.exec(source);
  if (!match) throw new Error(`${route} declares no maxDuration`);
  return Number(match[1]);
}

describe("replacement lease vs caller budgets", () => {
  it.each(REPLACE_CALLER_ROUTES)(
    "%s fits inside LONGEST_REPLACE_CALLER_SECONDS",
    (route) => {
      expect(maxDurationOf(route)).toBeLessThanOrEqual(
        LONGEST_REPLACE_CALLER_SECONDS
      );
    }
  );

  it("the lease is at least twice the longest caller budget", () => {
    expect(REPLACE_CLAIM_TTL_MS).toBeGreaterThanOrEqual(
      2 * LONGEST_REPLACE_CALLER_SECONDS * 1000
    );
  });
});
