import { describe, expect, it } from "vitest";
import { assertWithinQuota, type UserBucket } from "./buckets";
import { MediaGuardError } from "./guard";

const bucket = (used: number, quota: number): UserBucket => ({
  user_id: "u1",
  prefix: "u/alice/",
  bytes_used: used,
  quota_bytes: quota,
});

describe("assertWithinQuota", () => {
  it("allows writes under quota", () => {
    expect(() => assertWithinQuota(bucket(0, 100), 100)).not.toThrow();
    expect(() => assertWithinQuota(bucket(50, 100), 50)).not.toThrow();
  });
  it("refuses overflow with a clean 413", () => {
    try {
      assertWithinQuota(bucket(2_147_483_648 - 10, 2_147_483_648), 11);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MediaGuardError);
      expect((error as MediaGuardError).status).toBe(413);
    }
  });
});
