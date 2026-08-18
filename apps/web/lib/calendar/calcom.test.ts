import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  calcomDedupeKey,
  isStale,
  STALENESS_WINDOW_MS,
  verifyCalcomSignature,
} from "./calcom";

const SECRET = "shh-webhook-secret";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("verifyCalcomSignature", () => {
  const body = JSON.stringify({ triggerEvent: "BOOKING_CREATED" });

  it("accepts a valid HMAC over the raw body", () => {
    expect(verifyCalcomSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(verifyCalcomSignature(body, null, SECRET)).toBe(false);
  });

  it("rejects a tampered body", () => {
    expect(verifyCalcomSignature(body + "x", sign(body), SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const wrong = createHmac("sha256", "other").update(body).digest("hex");
    expect(verifyCalcomSignature(body, wrong, SECRET)).toBe(false);
  });

  it("rejects malformed / truncated signatures", () => {
    expect(verifyCalcomSignature(body, "deadbeef", SECRET)).toBe(false);
    expect(verifyCalcomSignature(body, "", SECRET)).toBe(false);
  });
});

describe("isStale", () => {
  const now = Date.parse("2026-08-18T12:00:00Z");

  it("accepts a fresh payload", () => {
    expect(isStale("2026-08-18T11:55:00Z", now)).toBe(false);
  });

  it("rejects payloads outside the window", () => {
    const old = new Date(now - STALENESS_WINDOW_MS - 1000).toISOString();
    expect(isStale(old, now)).toBe(true);
  });

  it("rejects unparseable timestamps", () => {
    expect(isStale("not-a-date", now)).toBe(true);
  });

  it("passes payloads without a timestamp (dedupe still applies)", () => {
    expect(isStale(undefined, now)).toBe(false);
  });
});

describe("calcomDedupeKey", () => {
  it("is stable across replays of the same event", () => {
    const envelope = {
      triggerEvent: "BOOKING_CREATED",
      createdAt: "2026-08-18T11:55:00Z",
      payload: { uid: "book_1" },
    };
    expect(calcomDedupeKey(envelope)).toBe(calcomDedupeKey({ ...envelope }));
  });

  it("differs across distinct bookings", () => {
    const base = {
      triggerEvent: "BOOKING_CREATED",
      createdAt: "2026-08-18T11:55:00Z",
    };
    expect(calcomDedupeKey({ ...base, payload: { uid: "a" } })).not.toBe(
      calcomDedupeKey({ ...base, payload: { uid: "b" } })
    );
  });
});
