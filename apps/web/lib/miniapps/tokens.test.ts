import { beforeAll, describe, expect, it } from "vitest";
import { mintToken, verifyToken } from "./tokens";

beforeAll(() => {
  process.env.MINIAPP_SIGNING_KEY = "test-signing-key";
});

describe("mini-app tokens", () => {
  it("round-trips valid claims", () => {
    const token = mintToken("user-1", "kanban", "default");
    const claims = verifyToken(token, "kanban");
    expect(claims?.userId).toBe("user-1");
    expect(claims?.resourceId).toBe("default");
  });

  it("rejects a token presented at a different app path", () => {
    const token = mintToken("user-1", "kanban", "default");
    expect(verifyToken(token, "todo")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = mintToken("user-1", "kanban", "default");
    const [payload, mac] = token.split(".");
    const claims = JSON.parse(
      Buffer.from(payload!, "base64url").toString("utf8")
    ) as { userId: string };
    claims.userId = "user-2";
    const forged = `${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${mac}`;
    expect(verifyToken(forged, "kanban")).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = mintToken("user-1", "todo", "default", -1);
    expect(verifyToken(token, "todo")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyToken("not-a-token", "kanban")).toBeNull();
    expect(verifyToken("", "kanban")).toBeNull();
  });
});
