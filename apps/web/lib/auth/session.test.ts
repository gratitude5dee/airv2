import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

const SECRET = "a".repeat(32);
const b64url = (value: string) => Buffer.from(value).toString("base64url");
const sign = (payload: string, secret = SECRET) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

const token = (header: object, claims: object, secret = SECRET) => {
  const payload = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  return `${payload}.${sign(payload, secret)}`;
};

const exp = Math.floor(Date.now() / 1000) + 3600;

describe("session tokens", () => {
  beforeEach(() => {
    process.env["SESSION_SECRET"] = SECRET;
  });
  afterEach(() => {
    delete process.env["SESSION_SECRET"];
    vi.useRealTimers();
  });

  it("round-trips a token it issued", () => {
    const issued = createSessionToken("user-1");
    expect(verifySessionToken(issued)).toBe("user-1");
  });

  it("rejects a token after it expires", () => {
    const issued = createSessionToken("user-1");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 86_400_000);
    expect(verifySessionToken(issued)).toBeUndefined();
  });

  it("rejects a tampered signature", () => {
    const issued = createSessionToken("user-1");
    const forged = token(
      { alg: "HS256", typ: "JWT" },
      { sub: "user-9", exp },
      "b".repeat(32)
    );
    expect(verifySessionToken(forged)).toBeUndefined();
    const [header, body] = issued.split(".");
    expect(
      verifySessionToken(`${header}.${body}.${"0".repeat(43)}`)
    ).toBeUndefined();
  });

  it("rejects a wrong algorithm header even when correctly signed", () => {
    const none = token({ alg: "none" }, { sub: "user-1", exp });
    expect(verifySessionToken(none)).toBeUndefined();
    const hs512 = token({ alg: "HS512" }, { sub: "user-1", exp });
    expect(verifySessionToken(hs512)).toBeUndefined();
  });

  it("rejects a token with no sub", () => {
    const noSub = token({ alg: "HS256", typ: "JWT" }, { exp });
    expect(verifySessionToken(noSub)).toBeUndefined();
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("not-a-token")).toBeUndefined();
    expect(verifySessionToken("")).toBeUndefined();
  });
});
