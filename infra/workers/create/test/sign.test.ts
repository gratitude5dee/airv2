/**
 * CF1 bridge signing — the worker's half of the same scheme
 * `apps/web/lib/create/bridge.ts` implements (matching test vectors there).
 */
import { describe, expect, it } from "vitest";
import {
  bridgePayload,
  bridgeSign,
  hmacHex,
  mintSignedToken,
  verifyBridgeRequest,
  verifySignedToken,
} from "../src/sign";

const SECRET = "test-bridge-secret";

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("bridge signing", () => {
  it("payload is ts.method.path.sha256(body)", async () => {
    const payload = await bridgePayload("1700000000", "post", "/v1/jobs", "{\"a\":1}");
    const bodyHash = await sha256Hex("{\"a\":1}");
    expect(payload).toBe(`1700000000.POST./v1/jobs.${bodyHash}`);
  });

  it("verifies its own signature", async () => {
    const body = JSON.stringify({ job_id: "x" });
    const { ts, sig } = await bridgeSign(SECRET, "POST", "/v1/jobs", body);
    const headers = new Headers({ "x-air-ts": ts, "x-air-sig": sig });
    expect(await verifyBridgeRequest(headers, "POST", "/v1/jobs", body, SECRET)).toBe(true);
  });

  it("rejects a wrong signature", async () => {
    const { ts } = await bridgeSign(SECRET, "POST", "/v1/jobs", "{}");
    const headers = new Headers({ "x-air-ts": ts, "x-air-sig": "0".repeat(64) });
    expect(await verifyBridgeRequest(headers, "POST", "/v1/jobs", "{}", SECRET)).toBe(false);
  });

  it("rejects a stale timestamp", async () => {
    const stale = Math.floor(Date.now() / 1000) - 301;
    const body = "{}";
    const sig = await hmacHex(SECRET, await bridgePayload(String(stale), "POST", "/v1/jobs", body));
    const headers = new Headers({ "x-air-ts": String(stale), "x-air-sig": sig });
    expect(await verifyBridgeRequest(headers, "POST", "/v1/jobs", body, SECRET)).toBe(false);
  });

  it("returns null when unsigned", async () => {
    expect(await verifyBridgeRequest(new Headers(), "GET", "/v1/health", "", SECRET)).toBe(null);
  });
});

describe("signed tokens", () => {
  it("mints and verifies with claims", async () => {
    const token = await mintSignedToken(SECRET, { job: "j1", user: "u1", exp: Math.floor(Date.now() / 1000) + 60 });
    const claims = await verifySignedToken(SECRET, token, { job: "j1" });
    expect(claims).not.toBeNull();
    expect(claims!["user"]).toBe("u1");
  });

  it("rejects a claim mismatch", async () => {
    const token = await mintSignedToken(SECRET, { job: "j1", exp: Math.floor(Date.now() / 1000) + 60 });
    expect(await verifySignedToken(SECRET, token, { job: "j2" })).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await mintSignedToken(SECRET, { job: "j1", exp: Math.floor(Date.now() / 1000) - 1 });
    expect(await verifySignedToken(SECRET, token)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await mintSignedToken(SECRET, { job: "j1", exp: Math.floor(Date.now() / 1000) + 60 });
    const [payload] = token.split(".");
    const forged = `${payload}.${"A".repeat(43)}`;
    expect(await verifySignedToken(SECRET, forged)).toBeNull();
  });
});
