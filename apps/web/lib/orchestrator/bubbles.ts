/**
 * Multi-bubble delivery for streamed replies. One long agent answer lands
 * as a handful of iMessage bubbles split on paragraph boundaries instead of
 * a single wall of text: the first paragraph streams into a live-edited
 * bubble (text appears as it generates), each later paragraph is sent the
 * moment it completes, and everything past the bubble cap is folded into
 * the final bubble so a rambling answer can never flood the chat.
 */
import type { SpectrumSender } from "../spectrum/sender";

export const MAX_BUBBLES = 5;

/**
 * Deliver a delta stream as up to MAX_BUBBLES bubbles. Whitespace-only
 * streams send nothing.
 */
export async function streamBubbles(
  sender: SpectrumSender,
  spaceId: string,
  phone: string,
  source: AsyncIterable<string>
): Promise<void> {
  const iterator = source[Symbol.asyncIterator]();
  let buffer = "";
  let done = false;

  async function pull(): Promise<void> {
    const next = await iterator.next();
    if (next.done) done = true;
    else buffer += next.value;
  }

  // Prime: skip leading whitespace so an empty stream sends no bubble.
  while (!done && buffer.trim() === "") {
    buffer = "";
    await pull();
  }
  buffer = buffer.replace(/^\s+/, "");
  if (buffer.trim() === "" && done) return;

  // First bubble: stream live, holding back a trailing newline that may
  // still become a paragraph break, and stop at the first blank line.
  async function* firstBubble(): AsyncGenerator<string> {
    for (;;) {
      const split = buffer.indexOf("\n\n");
      if (split !== -1) {
        const head = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        if (head) yield head;
        return;
      }
      if (done) {
        if (buffer) yield buffer;
        buffer = "";
        return;
      }
      const keep = buffer.endsWith("\n") ? buffer.length - 1 : buffer.length;
      if (keep > 0) {
        yield buffer.slice(0, keep);
        buffer = buffer.slice(keep);
      }
      await pull();
    }
  }
  await sender.streamText(spaceId, phone, firstBubble());

  /** Next completed paragraph, or null when the stream is exhausted. */
  async function nextParagraph(): Promise<string | null> {
    for (;;) {
      const split = buffer.indexOf("\n\n");
      if (split !== -1) {
        const paragraph = buffer.slice(0, split).trim();
        buffer = buffer.slice(split + 2);
        if (paragraph) return paragraph;
        continue;
      }
      if (done) {
        const paragraph = buffer.trim();
        buffer = "";
        return paragraph ? paragraph : null;
      }
      await pull();
    }
  }

  // Later paragraphs go out as they complete; overflow past the cap is
  // folded into one final bubble.
  let sent = 1;
  const overflow: string[] = [];
  for (;;) {
    const paragraph = await nextParagraph();
    if (paragraph === null) break;
    if (sent < MAX_BUBBLES - 1) {
      await sender.sendText(spaceId, phone, paragraph);
      sent += 1;
    } else {
      overflow.push(paragraph);
    }
  }
  if (overflow.length > 0) {
    await sender.sendText(spaceId, phone, overflow.join("\n\n"));
  }
}
