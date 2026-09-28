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
const CLAIMS = { sub: "user-1", sid: "sess-1", exp };

describe("session tokens", () => {
  beforeEach(() => {
    process.env["SESSION_SECRET"] = SECRET;
  });
  afterEach(() => {
    delete process.env["SESSION_SECRET"];
    vi.useRealTimers();
  });

  it("round-trips a token it issued", () => {
    const issued = createSessionToken("user-1", "sess-1");
    expect(verifySessionToken(issued)).toEqual({
      userId: "user-1",
      sessionId: "sess-1",
    });
  });

  it("rejects a token after it expires", () => {
    const issued = createSessionToken("user-1", "sess-1");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 86_400_000);
    expect(verifySessionToken(issued)).toBeUndefined();
  });

  it("rejects a tampered signature", () => {
    const issued = createSessionToken("user-1", "sess-1");
    const forged = token(
      { alg: "HS256", typ: "JWT" },
      { sub: "user-9", sid: "sess-9", exp },
      "b".repeat(32)
    );
    expect(verifySessionToken(forged)).toBeUndefined();
    const [header, body] = issued.split(".");
    expect(
      verifySessionToken(`${header}.${body}.${"0".repeat(43)}`)
    ).toBeUndefined();
  });

  it("rejects a wrong algorithm header even when correctly signed", () => {
    const none = token({ alg: "none" }, CLAIMS);
    expect(verifySessionToken(none)).toBeUndefined();
    const hs512 = token({ alg: "HS512" }, CLAIMS);
    expect(verifySessionToken(hs512)).toBeUndefined();
  });

  it("rejects a token with no sub or no sid", () => {
    const noSub = token({ alg: "HS256", typ: "JWT" }, { sid: "sess-1", exp });
    expect(verifySessionToken(noSub)).toBeUndefined();
    // A pre-SEC-07 token (sub + exp, no sid) verifies false by design: it has
    // no session row to check against.
    const noSid = token({ alg: "HS256", typ: "JWT" }, { sub: "user-1", exp });
    expect(verifySessionToken(noSid)).toBeUndefined();
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("not-a-token")).toBeUndefined();
    expect(verifySessionToken("")).toBeUndefined();
  });
});
