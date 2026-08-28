import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  composeInput,
  dropQuickAckMarker,
  hermesDeltas,
  isCancelled,
  runFlush,
} from "./flush";
import {
  createRun,
  ensureSession,
  loadConversationHistory,
  runEvents,
} from "../hermes/client";
import { createSpectrumSender } from "../spectrum/sender";
import { ensureBoxAwake } from "./boxes";
import { probeForTapback } from "../spectrum/tapbacks";

vi.mock("../spectrum/sender", () => ({ createSpectrumSender: vi.fn() }));
vi.mock("../box/client", () => ({ command: vi.fn(), writeFile: vi.fn() }));
vi.mock("../hermes/client", () => ({
  createRun: vi.fn(),
  ensureSession: vi.fn(),
  loadConversationHistory: vi.fn(),
  MAIN_SESSION: "air-main",
  MAIN_SESSION_TITLE: "Air",
  runEvents: vi.fn(),
  stopRun: vi.fn(),
}));
vi.mock("../bots/client", () => ({
  botTarget: vi.fn(),
  BOT_CHAT_SESSION: "bot-chat",
  BOT_CHAT_TITLE: "Bot Chat",
}));
vi.mock("../bots/mentions", () => ({ parseMention: vi.fn(() => null) }));
vi.mock("../bots/store", () => ({ listBots: vi.fn().mockResolvedValue([]) }));
vi.mock("../spectrum/tapbacks", () => ({ probeForTapback: vi.fn() }));
vi.mock("../creative/imessage", () => ({
  maybeRunCreativeLane: vi.fn().mockResolvedValue(false),
}));
vi.mock("../miniapps/imessageCommand", () => ({
  maybeSendMiniAppLink: vi.fn().mockResolvedValue(false),
  MiniAppRegistryLookupError: class extends Error {},
}));
vi.mock("./boxes", () => ({
  armStopAfter: vi.fn().mockResolvedValue(undefined),
  ensureBoxAwake: vi.fn(),
}));

const sse = (frames: object[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(frame)}\n\n`)
        );
      }
      controller.close();
    },
  });
};

const collect = async (
  stream: AsyncGenerator<string>
): Promise<string[]> => {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
};

describe("composeInput", () => {
  it("prepends carried messages as history", () => {
    const carried = [{ id: "1", message_id: "m1", body: "earlier text" }];
    const fresh = [
      { id: "2", message_id: "m2", body: "hey" },
      { id: "3", message_id: "m3", body: "actually — the real question" },
    ];
    expect(composeInput(carried, fresh)).toBe(
      "[Earlier message] earlier text\nhey\nactually — the real question"
    );
  });

  it("is just the batch when nothing was carried", () => {
    expect(composeInput([], [{ id: "1", message_id: "m", body: "hi" }])).toBe(
      "hi"
    );
  });
});

describe("isCancelled", () => {
  const chainStartedAt = "2026-08-07T12:00:00.000Z";

  it("ignores a stale flag from before this chain started", () => {
    expect(isCancelled("2026-08-07T11:59:59.000Z", chainStartedAt)).toBe(false);
  });

  it("honors a cancellation stamped after the chain started", () => {
    expect(isCancelled("2026-08-07T12:00:01.000Z", chainStartedAt)).toBe(true);
  });

  it("is false when never cancelled", () => {
    expect(isCancelled(null, chainStartedAt)).toBe(false);
  });
});

/**
 * The re-ask regression: a bare follow-up value ("94587") only makes sense
 * with the question that preceded it, so the turn must ship the prior
 * transcript as `conversation_history`.
 */
describe("runFlush history replay", () => {
  const target = {
    hostedUrl: "https://box.example",
    hostedToken: "t",
    apiServerKey: "k",
  };
  const job = {
    spaceId: "space-1",
    userId: "user-1",
    phone: "+15551234567",
    attempts: 0,
    senderTier: 0,
  };

  function fakeSupabase(queueRows: Array<Record<string, unknown>>) {
    return {
      from: (table: string) => ({
        select: () => {
          const rows = table === "batch_queue" ? queueRows : [];
          const chain = {
            eq: () => chain,
            limit: () => chain,
            order: () => Promise.resolve({ data: rows, error: null }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          };
          return chain;
        },
        delete: () => {
          const chain = {
            eq: () => chain,
            in: () => Promise.resolve({ error: null }),
            then: (resolve: (value: { error: null }) => void) =>
              resolve({ error: null }),
          };
          return chain;
        },
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        insert: () => Promise.resolve({ error: null }),
      }),
    } as unknown as SupabaseClient;
  }

  beforeEach(() => {
    vi.mocked(createRun).mockClear();
    vi.mocked(ensureSession).mockClear();
    vi.mocked(loadConversationHistory).mockClear();
    vi.mocked(createSpectrumSender).mockResolvedValue({
      sendText: vi.fn().mockResolvedValue(undefined),
      streamText: vi.fn(async (_space, _phone, chunks) => {
        for await (const _chunk of chunks) void _chunk;
      }),
      react: vi.fn().mockResolvedValue(true),
      sendReply: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(ensureBoxAwake).mockResolvedValue({
      boxId: "box-1",
      target,
    } as never);
    vi.mocked(ensureSession).mockResolvedValue({ created: false });
    vi.mocked(createRun).mockResolvedValue({ run_id: "run-1" });
    vi.mocked(runEvents).mockResolvedValue(
      sse([{ event: "run.completed", output: "thanks!" }]) as never
    );
    vi.mocked(probeForTapback).mockResolvedValue({
      buffered: "thanks!",
      ended: true,
    });
  });

  it("replays prior turns for a bare follow-up value", async () => {
    const history = [
      { role: "user" as const, content: "here's the ZIP" },
      { role: "assistant" as const, content: "what ZIP code should I use?" },
    ];
    vi.mocked(loadConversationHistory).mockResolvedValue(history);
    await runFlush(
      fakeSupabase([{ id: "q1", message_id: "m1", body: "94587" }]),
      job,
      new Date().toISOString()
    );
    expect(vi.mocked(ensureSession).mock.calls[0]?.slice(1)).toEqual([
      "air-main",
      "Air",
    ]);
    expect(vi.mocked(loadConversationHistory)).toHaveBeenCalledWith(
      target,
      "air-main"
    );
    expect(vi.mocked(createRun).mock.calls[0]?.[1]).toMatchObject({
      input: "94587",
      sessionId: "air-main",
      conversationHistory: history,
    });
  });

  it("retries once, then holds the burst when an existing session replays empty", async () => {
    vi.mocked(loadConversationHistory).mockResolvedValue([]);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await runFlush(
      fakeSupabase([{ id: "q1", message_id: "m1", body: "94587" }]),
      job,
      new Date().toISOString()
    );
    expect(
      errors.mock.calls.some((call) =>
        String(call[0]).includes("history replay empty on existing session")
      )
    ).toBe(true);
    errors.mockRestore();
    // Load attempted twice (retry), and the amnesiac run never started.
    expect(vi.mocked(loadConversationHistory)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createRun)).not.toHaveBeenCalled();
  });

  it("runs blank rather than dropping the burst once retries are exhausted", async () => {
    vi.mocked(loadConversationHistory).mockResolvedValue([]);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await runFlush(
      fakeSupabase([{ id: "q1", message_id: "m1", body: "94587" }]),
      { ...job, attempts: 5 },
      new Date().toISOString()
    );
    errors.mockRestore();
    expect(vi.mocked(createRun).mock.calls[0]?.[1].conversationHistory).toEqual(
      []
    );
  });
});

describe("dropQuickAckMarker", () => {
  it("deletes exactly the marker row for the space", async () => {
    const del = { eq: vi.fn() };
    del.eq.mockReturnValueOnce(del).mockResolvedValueOnce({ error: null });
    const supabase = {
      from: vi.fn(() => ({ delete: vi.fn(() => del) })),
    } as unknown as SupabaseClient;
    await dropQuickAckMarker(supabase, "space-1", "bridge:ack-123");
    expect(vi.mocked(supabase.from)).toHaveBeenCalledWith("carried_messages");
    expect(del.eq).toHaveBeenNthCalledWith(1, "space_id", "space-1");
    expect(del.eq).toHaveBeenNthCalledWith(2, "message_id", "bridge:ack-123");
  });
});

describe("hermesDeltas", () => {
  it("yields message deltas and stops at run.completed", async () => {
    const stream = sse([
      { event: "message.delta", delta: "Hel" },
      { event: "message.delta", delta: "lo" },
      { event: "run.completed", output: "Hello" },
    ]);
    expect(await collect(hermesDeltas(stream))).toEqual(["Hel", "lo"]);
  });

  it("falls back to the final output when no deltas arrived", async () => {
    const stream = sse([{ event: "run.completed", output: "PONG" }]);
    expect(await collect(hermesDeltas(stream))).toEqual(["PONG"]);
  });

  it("throws on run.failed", async () => {
    const stream = sse([{ event: "run.failed", error: "HTTP 500" }]);
    await expect(collect(hermesDeltas(stream))).rejects.toThrow("HTTP 500");
  });
});
