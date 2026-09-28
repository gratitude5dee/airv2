import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";
import {
  DEVICE_TOKEN_TTL_SECONDS,
  mintDeviceToken,
  mintPairingToken,
  pairDevice,
  verifyDeviceToken,
  verifyPairingToken,
} from "./desktop";

const db = new FakeSupabase();

beforeAll(() => {
  process.env["SESSION_SECRET"] = "test-session-secret";
  delete process.env["DESKTOP_SIGNING_KEY"];
});

beforeEach(() => {
  db.reset();
  // A pairing token redeems exactly once: the unique index on pairing_jti
  // makes the replayed insert a 23505.
  db.uniques["desktop_devices"] = ["pairing_jti"];
});

describe("desktop credentials", () => {
  it("round-trips a pairing token", () => {
    const { token, expiresIn } = mintPairingToken("user-1");
    expect(expiresIn).toBeGreaterThan(0);
    expect(verifyPairingToken(token)?.userId).toBe("user-1");
  });

  it("round-trips a device token", () => {
    const { token, expiresIn } = mintDeviceToken("user-1", "device-1");
    expect(expiresIn).toBe(DEVICE_TOKEN_TTL_SECONDS);
    const claims = verifyDeviceToken(token);
    expect(claims).toEqual({ userId: "user-1", deviceId: "device-1" });
  });

  it("does not accept a pairing token as a device token, or the reverse", () => {
    expect(verifyDeviceToken(mintPairingToken("user-1").token)).toBeUndefined();
    expect(
      verifyPairingToken(mintDeviceToken("user-1", "device-1").token)
    ).toBeUndefined();
  });

  it("rejects a tampered device token", () => {
    const { token } = mintDeviceToken("user-1", "device-1");
    const [payload, mac] = token.split(".");
    const claims = JSON.parse(
      Buffer.from(payload as string, "base64url").toString()
    ) as { userId: string };
    claims.userId = "user-2";
    const forged = `${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${mac}`;
    expect(verifyDeviceToken(forged)).toBeUndefined();
  });

  it("rejects a token signed with a different key", () => {
    const { token } = mintDeviceToken("user-1", "device-1");
    process.env["DESKTOP_SIGNING_KEY"] = "rotated";
    try {
      expect(verifyDeviceToken(token)).toBeUndefined();
    } finally {
      delete process.env["DESKTOP_SIGNING_KEY"];
    }
  });

  it("rejects garbage", () => {
    expect(verifyDeviceToken("")).toBeUndefined();
    expect(verifyPairingToken("not-a-token")).toBeUndefined();
  });

  it("pairs a device once and rejects the replay", async () => {
    const { token } = mintPairingToken("user-1");
    const paired = await pairDevice(db.client(), token, "MacBook");
    const deviceId = db.rows("desktop_devices")[0]?.["id"] as string;
    expect(paired).toEqual({ userId: "user-1", deviceId });
    expect(await pairDevice(db.client(), token, "MacBook")).toBeUndefined();
    expect(db.rows("desktop_devices")).toHaveLength(1);
  });

  it("refuses to pair on an invalid token without touching the database", async () => {
    expect(await pairDevice(db.client(), "bogus", undefined)).toBeUndefined();
    expect(db.queries).toHaveLength(0);
  });
});
