/**
 * MA4 addition to C18: R2 credentials are server-side only. This gate keeps
 * the live-box sweep runbook scanning for R2 key patterns, and asserts the
 * media guard rejects the credential shapes at the write boundary.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { textContainsSecrets } from "../storage/guard";

const sweep = readFileSync(
  join(__dirname, "../../../../scripts/c18-box-sweep.sh"),
  "utf8"
);

describe("C18 sweep — R2 key patterns", () => {
  it("the box sweep scans for R2 credential patterns", () => {
    for (const pattern of [
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_ACCOUNT_ID",
      "r2\\.cloudflarestorage\\.com",
    ]) {
      expect(sweep).toContain(pattern);
    }
  });
  it("the public-media guard rejects R2/AWS credential shapes in text", () => {
    expect(textContainsSecrets("R2_SECRET_ACCESS_KEY=abc")).not.toBeNull();
    expect(textContainsSecrets("AKIAABCDEFGHIJKLMNOP")).not.toBeNull();
  });
});
