import { describe, expect, it } from "vitest";
import { mintCandidate, verifyCandidate, verifyLive } from "../src/tokens";

const SECRET = "cand-secret";

describe("candidate tokens (CF4)", () => {
  it("verifies for the right slug and names the version", async () => {
    const token = await mintCandidate(SECRET, "u-app", "v20260924120000");
    const claims = await verifyCandidate(SECRET, token, "u-app");
    expect(claims?.version).toBe("v20260924120000");
  });

  it("rejects for another slug", async () => {
    const token = await mintCandidate(SECRET, "u-app", "v1");
    expect(await verifyCandidate(SECRET, token, "other-app")).toBeNull();
  });

  it("rejects when expired", async () => {
    const token = await mintCandidate(SECRET, "u-app", "v1", -1);
    expect(await verifyCandidate(SECRET, token, "u-app")).toBeNull();
  });
});

describe("live tokens", () => {
  it("rejects for another job", async () => {
    const { mintSignedToken } = await import("../src/sign");
    const token = await mintSignedToken(SECRET, { job: "j1", user: "u1", exp: Math.floor(Date.now() / 1000) + 60 });
    expect(await verifyLive(SECRET, token, "j2")).toBeNull();
  });
});
