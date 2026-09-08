import { describe, expect, it } from "vitest";
import { resolveLegacyThreads } from "./archiveMigration";
import { mergeThreadArchive } from "./archive";
const legacy = { chat: "Friends", ts: "2026-09-01T00:00:00Z", from: "Sam", is_from_me: false, text: "Hello" };

describe("legacy thread migration preflight", () => {
  it("resolves a unique catalogue identity and merges with reimported GUIDs", () => {
    const result = resolveLegacyThreads([legacy], [{ id: "thread-1", label: "Friends" }]);
    expect(result.unresolved).toEqual([]);
    const merged = mergeThreadArchive(null, [...result.messages, { ...legacy, id: "message-1", chat_id: "thread-1" }]);
    expect(merged.messages).toHaveLength(1);
    expect(merged.messages[0]?.id).toBe("message-1");
    expect(legacy).not.toHaveProperty("chat_id");
  });
  it("reports missing and ambiguous labels instead of guessing", () => {
    const result = resolveLegacyThreads([legacy, { ...legacy, chat: "Deleted chat" }], [
      { id: "thread-2", label: "Friends" }, { id: "thread-1", label: "Friends" },
    ]);
    expect(result.messages).toEqual([legacy, { ...legacy, chat: "Deleted chat" }]);
    expect(result.unresolved).toEqual([
      { label: "Deleted chat", candidates: [] },
      { label: "Friends", candidates: ["thread-1", "thread-2"] },
    ]);
  });
  it("does not replace an existing ID or treat repeated catalogue entries as ambiguity", () => {
    const result = resolveLegacyThreads([legacy, { ...legacy, chat_id: "original" }], [
      { id: "thread-1", label: "Friends" }, { id: "thread-1", label: "Friends" },
    ]);
    expect(result.unresolved).toEqual([]);
    expect(result.messages.map((message) => message.chat_id)).toEqual(["thread-1", "original"]);
  });
});
