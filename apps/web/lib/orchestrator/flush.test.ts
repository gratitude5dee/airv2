import { describe, expect, it } from "vitest";
import { composeInput, hermesDeltas, isCancelled } from "./flush";

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
