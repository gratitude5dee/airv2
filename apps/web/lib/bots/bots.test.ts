import { describe, expect, it } from "vitest";
import {
  BOT_CHAT_SESSION,
  BOT_CHAT_TITLE,
  botTarget,
  isValidBotName,
} from "./client";
import { parseMention } from "./mentions";
import {
  displayRoutineName,
  isBotRoutineJob,
  needsUserLine,
  routineJobName,
  routinePrompt,
} from "./routines";
import { toPublic, type BotRow } from "./store";
import {
  ROOM_MAX_MEMBERS,
  ROOM_MAX_MESSAGES,
  ROOM_MAX_ROUNDS,
  ROOM_MIN_MEMBERS,
  roomSessionId,
} from "./rooms";

const row: BotRow = {
  id: "b-1",
  user_id: "u-1",
  name: "researcher",
  title: "Researcher",
  description: null,
  avatar_kind: "geometric",
  avatar_ref: null,
  model_tier: "fast",
  api_server_key: "sk-bot-secret",
  status: "ready",
  group_label: null,
  created_at: "2026-01-01T00:00:00Z",
};

describe("bot names", () => {
  it("accepts [a-z0-9-]{2,32}", () => {
    expect(isValidBotName("researcher")).toBe(true);
    expect(isValidBotName("a1")).toBe(true);
    expect(isValidBotName("my-bot-2")).toBe(true);
  });

  it("rejects reserved and malformed names", () => {
    expect(isValidBotName("default")).toBe(false);
    expect(isValidBotName("rooms")).toBe(false);
    expect(isValidBotName("a")).toBe(false);
    expect(isValidBotName("A-Bot")).toBe(false);
    expect(isValidBotName("has space")).toBe(false);
    expect(isValidBotName("x".repeat(33))).toBe(false);
    expect(isValidBotName("../etc")).toBe(false);
  });
});

describe("botTarget", () => {
  const box = {
    hostedUrl: "https://box.example",
    hostedToken: "route-token",
    apiServerKey: "default-key",
  };

  it("prefixes /p/<name> and swaps in the bot's own key", () => {
    const target = botTarget(box, "researcher", "bot-key");
    expect(target.hostedUrl).toBe("https://box.example/p/researcher");
    expect(target.hostedToken).toBe("route-token");
    expect(target.apiServerKey).toBe("bot-key");
  });

  it("refuses invalid profile names", () => {
    expect(() => botTarget(box, "../default", "k")).toThrow();
    expect(() => botTarget(box, "", "k")).toThrow();
  });
});

describe("toPublic", () => {
  it("never exposes the api_server_key", () => {
    const publicBot = toPublic(row);
    expect(JSON.stringify(publicBot)).not.toContain("sk-bot-secret");
    expect(publicBot).not.toHaveProperty("api_server_key");
    expect(publicBot).not.toHaveProperty("id");
    expect(publicBot.name).toBe("researcher");
  });
});

describe("parseMention", () => {
  const roster = ["researcher", "coder"];

  it("recognizes a roster mention and strips the prefix", () => {
    expect(parseMention("@researcher find papers", roster)).toEqual({
      bot: "researcher",
      input: "find papers",
    });
  });

  it("recognizes a mid-text mention", () => {
    const hit = parseMention("hey @coder can you fix this", roster);
    expect(hit?.bot).toBe("coder");
  });

  it("passes unknown @words through as text", () => {
    expect(parseMention("@stranger hello", roster)).toBeNull();
    expect(parseMention("email me @ home", roster)).toBeNull();
    expect(parseMention("plain text", roster)).toBeNull();
  });
});

describe("routines", () => {
  it("namespaces job names as [bot:<name>] <routine>", () => {
    expect(routineJobName("researcher", "daily digest")).toBe(
      "[bot:researcher] daily digest"
    );
    expect(isBotRoutineJob("researcher", "[bot:researcher] daily digest")).toBe(
      true
    );
    expect(isBotRoutineJob("researcher", "[bot:coder] daily digest")).toBe(
      false
    );
    expect(
      displayRoutineName("researcher", "[bot:researcher] daily digest")
    ).toBe("daily digest");
  });

  it("appends the exact escalation instruction once", () => {
    const withMarker = routinePrompt("summarize news", "sam");
    expect(withMarker).toContain(
      "if this needs sam, say `[NEEDS-USER] <one line>`"
    );
    expect(routinePrompt(withMarker, "sam")).toBe(withMarker);
  });

  it("extracts the one-line escalation from output", () => {
    expect(needsUserLine("all done")).toBeNull();
    expect(needsUserLine("did stuff\n[NEEDS-USER] approve the draft\nmore")).toBe(
      "approve the draft"
    );
    expect(needsUserLine(null)).toBeNull();
  });
});

describe("bot chat contract", () => {
  it("uses the canonical pinned session and exact probe title", () => {
    expect(BOT_CHAT_SESSION).toBe("bot-chat");
    expect(BOT_CHAT_TITLE).toBe("Bot Chat");
  });
});

describe("rooms caps", () => {
  it("hard-codes the reference caps", () => {
    expect(ROOM_MIN_MEMBERS).toBe(2);
    expect(ROOM_MAX_MEMBERS).toBe(6);
    expect(ROOM_MAX_ROUNDS).toBe(3);
    expect(ROOM_MAX_MESSAGES).toBe(10);
    expect(roomSessionId("abc")).toBe("room-abc");
  });
});
