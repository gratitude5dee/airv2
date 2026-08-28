/**
 * Hosted-approval link tokens: HMAC round trip, tamper/expiry/scope
 * rejection, and domain separation from fill tickets — an approval link
 * must never verify as a fill ticket, and vice versa.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  APPROVAL_LINK_TTL_MINUTES,
  mintApprovalToken,
  mintApprovalUrl,
  verifyApprovalToken,
  type ApprovalLinkClaims,
} from "./token";
import { mintFillTicket, verifyFillTicket } from "../vault/tickets";

beforeAll(() => {
  process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
});

describe("approval link tokens", () => {
  it("round-trips claims for the named decision", () => {
    const token = mintApprovalToken("user-1", "dec-1");
    const claims = verifyApprovalToken(token, "dec-1");
    expect(claims?.userId).toBe("user-1");
    expect(claims?.decisionId).toBe("dec-1");
    expect(claims?.use).toBe("approval_link");
  });

  it("rejects a token presented for another decision", () => {
    const token = mintApprovalToken("user-1", "dec-1");
    expect(verifyApprovalToken(token, "dec-2")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = mintApprovalToken("user-1", "dec-1");
    const dot = token.lastIndexOf(".");
    const claims = JSON.parse(
      Buffer.from(token.slice(0, dot), "base64url").toString("utf8")
    ) as ApprovalLinkClaims;
    claims.userId = "user-2";
    const forged = `${Buffer.from(JSON.stringify(claims)).toString("base64url")}${token.slice(dot)}`;
    expect(verifyApprovalToken(forged, "dec-1")).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = mintApprovalToken("user-1", "dec-1", -1);
    expect(verifyApprovalToken(token, "dec-1")).toBeNull();
  });

  it("caps the TTL at one hour", () => {
    const token = mintApprovalToken("user-1", "dec-1", 999);
    const claims = verifyApprovalToken(token, "dec-1");
    expect(claims!.exp).toBeLessThanOrEqual(
      Math.floor(Date.now() / 1000) + 60 * 60
    );
  });

  it("rejects garbage", () => {
    expect(verifyApprovalToken("", "dec-1")).toBeNull();
    expect(verifyApprovalToken("nope", "dec-1")).toBeNull();
    expect(verifyApprovalToken("a.b", "dec-1")).toBeNull();
  });

  it("never verifies as a fill ticket, and vice versa", () => {
    const approval = mintApprovalToken("user-1", "dec-1");
    expect(verifyFillTicket(approval, "user-1")).toBeNull();
    const { token: ticket } = mintFillTicket(
      "user-1",
      "item-1",
      "amazon.com",
      "under $25"
    );
    expect(verifyApprovalToken(ticket, "dec-1")).toBeNull();
    expect(verifyApprovalToken(ticket, "item-1")).toBeNull();
  });

  it("mints the hosted deep link with the token attached", () => {
    const url = mintApprovalUrl("user-1", "dec-9");
    expect(url).toMatch(/\/approve\/dec-9\?k=.+\./);
    const token = new URL(url).searchParams.get("k")!;
    const claims = verifyApprovalToken(token, "dec-9");
    expect(claims?.userId).toBe("user-1");
    expect(claims!.exp).toBeLessThanOrEqual(
      Math.floor(Date.now() / 1000) + APPROVAL_LINK_TTL_MINUTES * 60
    );
  });
});
