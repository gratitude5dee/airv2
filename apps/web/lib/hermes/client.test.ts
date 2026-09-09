import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConversationHistory, loadConversationTranscript } from "./client";

const target = {
  hostedUrl: "https://box.example",
  hostedToken: "cookie",
  apiServerKey: "key",
};

function respond(body: unknown, ok = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => body }))
  );
}

describe("loadConversationTranscript", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports raw rows separately from the replayable history", async () => {
    respond([{ role: "user", content: "hi, are you there?" }]);
    expect(await loadConversationTranscript(target, "air-main")).toEqual({
      rows: 1,
      history: [],
    });
  });

  it("counts rows of every role, replays the sanitised window", async () => {
    respond({
      messages: [
        { role: "system", content: "prompt" },
        { role: "user", content: "hi" },
        { role: "tool", content: "lookup" },
        { role: "assistant", content: "hey" },
      ],
    });
    expect(await loadConversationTranscript(target, "air-main")).toEqual({
      rows: 4,
      history: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hey" },
      ],
    });
  });

  it("reports zero rows when the box has no transcript or the load fails", async () => {
    respond({ messages: [] });
    expect(await loadConversationTranscript(target, "air-main")).toEqual({ rows: 0, history: [] });
    respond({}, false);
    expect(await loadConversationTranscript(target, "air-main")).toEqual({ rows: 0, history: [] });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await loadConversationTranscript(target, "air-main")).toEqual({ rows: 0, history: [] });
  });

  it("keeps loadConversationHistory as the history-only view", async () => {
    respond([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hey" },
    ]);
    expect(await loadConversationHistory(target, "air-main")).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hey" },
    ]);
  });
});
