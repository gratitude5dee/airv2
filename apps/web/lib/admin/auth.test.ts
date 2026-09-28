/**
 * R-SEC-10 — adminAuthorized requires both the shared bearer AND a
 * well-formed X-Admin-Operator; the returned operator is what audit rows
 * record.
 */
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { adminAuthorized } from "./auth";

const req = (headers: Record<string, string>) =>
  new NextRequest("https://air.test/api/admin/x", { headers });

afterEach(() => {
  delete process.env["ADMIN_API_KEY"];
});

describe("adminAuthorized", () => {
  it("returns null without an operator header even with a good key", () => {
    process.env["ADMIN_API_KEY"] = "admin-key";
    expect(adminAuthorized(req({ authorization: "Bearer admin-key" }))).toBeNull();
  });

  it("returns null for an empty or malformed operator", () => {
    process.env["ADMIN_API_KEY"] = "admin-key";
    expect(
      adminAuthorized(
        req({ authorization: "Bearer admin-key", "x-admin-operator": "  " })
      )
    ).toBeNull();
    expect(
      adminAuthorized(
        req({ authorization: "Bearer admin-key", "x-admin-operator": "bad op!" })
      )
    ).toBeNull();
  });

  it("returns null on a bad bearer even with an operator", () => {
    process.env["ADMIN_API_KEY"] = "admin-key";
    expect(
      adminAuthorized(
        req({ authorization: "Bearer nope", "x-admin-operator": "carol" })
      )
    ).toBeNull();
  });

  it("returns the operator when key and header are both valid", () => {
    process.env["ADMIN_API_KEY"] = "admin-key";
    expect(
      adminAuthorized(
        req({ authorization: "Bearer admin-key", "x-admin-operator": "carol@ops" })
      )
    ).toBe("carol@ops");
  });
});
