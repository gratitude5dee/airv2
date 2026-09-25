import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HermesApiError,
  loadConversationHistory,
  loadConversationTranscript,
} from "./client";

const target = {
  hostedUrl: "https://box.example",
  hostedToken: "cookie",
  apiServerKey: "key",
};

function respond(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }))
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

  it("reports zero rows when the box has no transcript", async () => {
    respond({ messages: [] });
    expect(await loadConversationTranscript(target, "air-main")).toEqual({
      rows: 0,
      history: [],
    });
  });

  it("treats a 404 as an unhydrated session, not a load failure", async () => {
    respond({ detail: "no such session" }, 404);
    expect(await loadConversationTranscript(target, "air-main")).toEqual({
      rows: 0,
      history: [],
    });
  });

  it("fails loudly instead of degrading to an empty transcript", async () => {
    respond({ detail: "state store unavailable" }, 503);
    await expect(
      loadConversationTranscript(target, "air-main")
    ).rejects.toThrow(HermesApiError);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("socket hang up");
      })
    );
    await expect(
      loadConversationTranscript(target, "air-main")
    ).rejects.toThrow("socket hang up");
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
