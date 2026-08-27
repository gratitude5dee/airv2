/**
 * Same-origin mutation guard: a cross-site request cannot ride the session
 * cookie, while non-browser callers (no Origin) still get through.
 */
import { describe, expect, it } from "vitest";
import { isAllowedMutationOrigin } from "./origin";

const base = {
  forwardedHost: null,
  forwardedProto: null,
  host: null,
  origin: null,
  requestUrl: "https://air.example.com/api/vault",
};

describe("isAllowedMutationOrigin", () => {
  it("allows a missing origin", () => {
    expect(isAllowedMutationOrigin(base)).toBe(true);
  });

  it("allows the request's own origin", () => {
    expect(
      isAllowedMutationOrigin({ ...base, origin: "https://air.example.com" })
    ).toBe(true);
  });

  it("allows the proxy-forwarded origin", () => {
    expect(
      isAllowedMutationOrigin({
        ...base,
        forwardedHost: "air.example.com, internal.vercel.app",
        forwardedProto: "https,http",
        origin: "https://air.example.com",
        requestUrl: "http://10.0.0.4:3000/api/vault",
      })
    ).toBe(true);
  });

  it("allows the Host header origin", () => {
    expect(
      isAllowedMutationOrigin({
        ...base,
        host: "air.example.com",
        forwardedProto: "https",
        origin: "https://air.example.com",
        requestUrl: "http://10.0.0.4:3000/api/vault",
      })
    ).toBe(true);
  });

  it("rejects a cross-site, downgraded or malformed origin", () => {
    for (const origin of [
      "https://evil.example.com",
      "https://air.example.com.evil.com",
      "http://air.example.com",
      "https://air.example.com:8443",
      "null",
      "not a url",
    ]) {
      expect(isAllowedMutationOrigin({ ...base, origin })).toBe(false);
    }
  });
});
