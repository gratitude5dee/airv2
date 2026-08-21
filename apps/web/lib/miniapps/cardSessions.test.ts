import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
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
    const builder = {
      eq: () => builder,
      maybeSingle: async () => ({
        data: { session: { ...VALID, sessionId: null } },
        error: null,
      }),
    };
    const client = {
      from: (table: string) => {
        expect(table).toBe("miniapp_card_sessions");
        return {
          select: () => builder,
        };
      },
    } as unknown as SupabaseClient;
    await expect(
      readMiniAppCardSession(client, "user-1", "vault", "default")
    ).resolves.toBeUndefined();
  });
});
