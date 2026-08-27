import { describe, expect, it } from "vitest";
import {
  HISTORY_MESSAGE_LIMIT,
  parseRawMessages,
  sanitizeConversation,
} from "./history";

describe("parseRawMessages", () => {
  it("accepts a bare array", () => {
    expect(parseRawMessages([{ role: "user", content: "hi" }])).toHaveLength(1);
  });

  it("accepts wrapped payloads", () => {
    expect(
      parseRawMessages({ messages: [{ role: "user", content: "hi" }] })
    ).toHaveLength(1);
    expect(
      parseRawMessages({ data: [{ role: "user", content: "hi" }] })
    ).toHaveLength(1);
  });

  it("degrades to empty on junk", () => {
    expect(parseRawMessages("nope")).toEqual([]);
    expect(parseRawMessages(null)).toEqual([]);
  });
});

describe("sanitizeConversation", () => {
  it("keeps only user/assistant rows with string content", () => {
    const out = sanitizeConversation([
      { role: "system", content: "prompt" },
      { role: "user", content: "find flights to SFO" },
      { role: "assistant", content: { tool: true } },
      { role: "tool", content: "result" },
      { role: "assistant", content: "cheapest is $612" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "find flights to SFO" },
      { role: "assistant", content: "cheapest is $612" },
    ]);
  });

  it("merges consecutive same-role rows to preserve alternation", () => {
    const out = sanitizeConversation([
      { role: "user", content: "one" },
      { role: "user", content: "two" },
      { role: "assistant", content: "reply" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "one\n\ntwo" },
      { role: "assistant", content: "reply" },
    ]);
  });

  it("drops a leading assistant message and a trailing user message", () => {
    const out = sanitizeConversation([
      { role: "assistant", content: "welcome!" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hey" },
      { role: "user", content: "pending question" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hey" },
    ]);
  });

  it("caps the window and keeps user-first / assistant-last after the cut", () => {
    const raw: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 100; i += 1) {
      raw.push({ role: "user", content: `u${i}` });
      raw.push({ role: "assistant", content: `a${i}` });
    }
    const out = sanitizeConversation(raw);
    expect(out.length).toBeLessThanOrEqual(HISTORY_MESSAGE_LIMIT);
    expect(out[0]?.role).toBe("user");
    expect(out[out.length - 1]?.role).toBe("assistant");
    expect(out[out.length - 1]?.content).toBe("a99");
  });

  it("skips empty content", () => {
    expect(
      sanitizeConversation([
        { role: "user", content: "  " },
        { role: "user", content: "real" },
        { role: "assistant", content: "ok" },
      ])
    ).toEqual([
      { role: "user", content: "real" },
      { role: "assistant", content: "ok" },
    ]);
  });
});
