import { describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import {
  parseMiniAppCardSession,
  readMiniAppCardSession,
} from "./cardSessions";

const VALID = {
  chatGuid: "chat-guid",
  messageGuid: "message-guid",
  sessionId: "session-id",
  targetMessageGuid: "target-message-guid",
};

describe("parseMiniAppCardSession", () => {
  it("accepts a complete provider session", () => {
    expect(parseMiniAppCardSession(VALID)).toEqual(VALID);
  });

  for (const field of Object.keys(VALID)) {
    it(`rejects a missing ${field}`, () => {
      const value = { ...VALID };
      delete value[field as keyof typeof value];
      expect(parseMiniAppCardSession(value)).toBeUndefined();
    });

    it(`rejects a non-string ${field}`, () => {
      expect(
        parseMiniAppCardSession({ ...VALID, [field]: 123 })
      ).toBeUndefined();
    });
  }
});

describe("readMiniAppCardSession", () => {
  it("returns undefined for a row with drifted session data", async () => {
    const db = new FakeSupabase();
    db.tables["miniapp_card_sessions"] = [
      {
        user_id: "user-1",
        kind: "vault",
        resource_id: "default",
        session: { ...VALID, sessionId: null },
      },
    ];
    await expect(
      readMiniAppCardSession(db.client(), "user-1", "vault", "default")
    ).resolves.toBeUndefined();
  });
});
