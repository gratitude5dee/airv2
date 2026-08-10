import { describe, expect, it } from "vitest";
import {
  contentType,
  deliveryKey,
  masterKey,
  normalizeExt,
  userPrefix,
} from "./keys";

describe("asset storage keys", () => {
  it("normalizes known extensions and rejects everything else", () => {
    expect(normalizeExt("PNG")).toBe("png");
    expect(normalizeExt("jpeg")).toBe("jpeg");
    expect(normalizeExt("exe")).toBeNull();
    expect(normalizeExt("../png")).toBeNull();
    expect(normalizeExt("")).toBeNull();
  });

  it("maps content types", () => {
    expect(contentType("mp4")).toBe("video/mp4");
    expect(contentType("unknown")).toBe("application/octet-stream");
  });

  it("builds content-addressed master keys under the user prefix", () => {
    const key = masterKey("user-1", "abc123", "png");
    expect(key).toBe("user-1/masters/abc123.png");
    expect(key.startsWith(userPrefix("user-1"))).toBe(true);
  });

  it("mints unguessable delivery keys", () => {
    const a = deliveryKey("user-1", "mp4");
    const b = deliveryKey("user-1", "mp4");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^user-1\/deliveries\/[a-f0-9]{32}\.mp4$/);
  });
});
