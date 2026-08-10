import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./secretbox";

const KEY = "a".repeat(64);

describe("secretbox", () => {
  it("round-trips a secret", () => {
    const sealed = sealSecret("dash-password-123", KEY);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("dash-password-123");
    expect(openSecret(sealed, KEY)).toBe("dash-password-123");
  });

  it("rejects a wrong key", () => {
    const sealed = sealSecret("secret", KEY);
    expect(() => openSecret(sealed, "b".repeat(64))).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const sealed = sealSecret("secret", KEY);
    const parts = sealed.split(":");
    const data = parts[3] ?? "";
    parts[3] = data.replace(/^../, data.startsWith("00") ? "11" : "00");
    expect(() => openSecret(parts.join(":"), KEY)).toThrow();
  });

  it("rejects a short key", () => {
    expect(() => sealSecret("secret", "abcd")).toThrow(/32 bytes/);
  });

  it("rejects an unknown format", () => {
    expect(() => openSecret("v2:aa:bb:cc", KEY)).toThrow(/format/);
  });
});
