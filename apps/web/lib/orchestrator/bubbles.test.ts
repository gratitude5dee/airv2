import { describe, expect, it } from "vitest";
import { MAX_BUBBLES, streamBubbles } from "./bubbles";
import type { SpectrumSender } from "../spectrum/sender";

async function* deltas(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) yield chunk;
}

function fakeSender(): {
  sender: SpectrumSender;
  bubbles: string[];
} {
  const bubbles: string[] = [];
  const sender = {
    streamText: async (
      _space: string,
      _phone: string,
      stream: AsyncIterable<string>
    ) => {
      let text = "";
      for await (const chunk of stream) text += chunk;
      bubbles.push(text);
    },
    sendText: async (_space: string, _phone: string, body: string) => {
      bubbles.push(body);
    },
  } as unknown as SpectrumSender;
  return { sender, bubbles };
}

describe("streamBubbles", () => {
  it("keeps a short single-paragraph reply as one streamed bubble", async () => {
    const { sender, bubbles } = fakeSender();
    await streamBubbles(sender, "s", "p", deltas(["hey — ", "on it!"]));
    expect(bubbles).toEqual(["hey — on it!"]);
  });

  it("splits paragraphs into separate bubbles", async () => {
    const { sender, bubbles } = fakeSender();
    await streamBubbles(
      sender,
      "s",
      "p",
      deltas(["first part\n", "\nsecond part\n\n", "third part"])
    );
    expect(bubbles).toEqual(["first part", "second part", "third part"]);
  });

  it("handles paragraph breaks split across deltas", async () => {
    const { sender, bubbles } = fakeSender();
    await streamBubbles(sender, "s", "p", deltas(["a\n", "\nb"]));
    expect(bubbles).toEqual(["a", "b"]);
  });

  it("folds overflow past the cap into the final bubble", async () => {
    const { sender, bubbles } = fakeSender();
    const paragraphs = Array.from({ length: 9 }, (_, i) => `para ${i + 1}`);
    await streamBubbles(sender, "s", "p", deltas([paragraphs.join("\n\n")]));
    expect(bubbles).toHaveLength(MAX_BUBBLES);
    expect(bubbles.slice(0, MAX_BUBBLES - 1)).toEqual(paragraphs.slice(0, 4));
    expect(bubbles[MAX_BUBBLES - 1]).toBe(paragraphs.slice(4).join("\n\n"));
  });

  it("sends nothing for a whitespace-only stream", async () => {
    const { sender, bubbles } = fakeSender();
    await streamBubbles(sender, "s", "p", deltas(["  \n", "\n  "]));
    expect(bubbles).toEqual([]);
  });

  it("skips blank paragraphs from repeated newlines", async () => {
    const { sender, bubbles } = fakeSender();
    await streamBubbles(sender, "s", "p", deltas(["a\n\n\n\nb"]));
    expect(bubbles).toEqual(["a", "b"]);
  });
});
