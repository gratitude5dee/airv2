/**
 * Eval-only Spectrum sender. When EVAL_SPECTRUM_RECORD_URL is set, the
 * createSpectrumSender factory returns this fake instead of a real
 * spectrum-ts client: every outbound action is recorded as one JSON event
 * POSTed to the harness listener, in send order. Used by the iMessage-path
 * eval (evals/agent-suite/imessage.ts) to measure time-to-first-bubble and
 * time-to-final-bubble without a Spectrum project. Reads (getAttachment,
 * getSharedLocation) stay silent — they are not outbound bubbles.
 */
import type { SpectrumSender } from "./sender";

export function createRecordingSpectrumSender(recordUrl: string): SpectrumSender {
  // Serialized delivery so the listener sees events in send order.
  let tail: Promise<void> = Promise.resolve();
  const record = (event: Record<string, unknown>): Promise<void> => {
    const next = tail.then(async () => {
      try {
        await fetch(recordUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...event, at: new Date().toISOString() }),
        });
      } catch (error) {
        // The harness listener is local to the run; a dead listener degrades
        // the eval's timing data, never the send path itself.
        console.warn(
          JSON.stringify({
            msg: "eval spectrum record failed",
            error: String(error),
          })
        );
      }
    });
    tail = next;
    return next;
  };

  return {
    startTyping: async (spaceId, phone) => {
      await record({ kind: "typing", spaceId, phone });
    },
    markRead: async (spaceId, phone, messageId) => {
      await record({ kind: "markRead", spaceId, phone, messageId });
    },
    sendText: async (spaceId, phone, body) => {
      await record({ kind: "sendText", spaceId, phone, body });
    },
    sendReply: async (spaceId, phone, messageId, body) => {
      await record({ kind: "sendReply", spaceId, phone, messageId, body });
      return true;
    },
    react: async (spaceId, phone, messageId, emoji) => {
      await record({ kind: "react", spaceId, phone, messageId, emoji });
      return true;
    },
    streamText: async (spaceId, phone, stream) => {
      let chunkIndex = 0;
      for await (const chunk of stream) {
        await record({ kind: "streamText", spaceId, phone, chunkIndex, text: chunk });
        chunkIndex += 1;
      }
    },
    sendApp: async (spaceId, phone, url, layout) => {
      await record({ kind: "sendApp", spaceId, phone, url: await url(), layout });
      return undefined;
    },
    editApp: async (spaceId, phone, session, url, layout) => {
      await record({
        kind: "editApp",
        spaceId,
        phone,
        url: await url(),
        layout,
        sessionId: session.sessionId,
      });
      return undefined;
    },
    sendAttachment: async (spaceId, phone, data, options) => {
      await record({
        kind: "sendAttachment",
        spaceId,
        phone,
        name: options.name,
        mimeType: options.mimeType,
        bytes: data.length,
      });
    },
    sendRichLink: async (spaceId, phone, url) => {
      await record({ kind: "sendRichLink", spaceId, phone, url });
    },
    getAttachment: async () => undefined,
    requestLocation: async (spaceId, phone, address, clientMessageId) => {
      await record({ kind: "requestLocation", spaceId, phone, address, clientMessageId });
      return undefined;
    },
    getSharedLocation: async () => undefined,
    close: async () => {
      await tail;
    },
  };
}
