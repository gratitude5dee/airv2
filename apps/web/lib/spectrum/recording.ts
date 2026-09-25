/**
 * Recording Spectrum senders for the contract-eval lane (R-EV-07). When
 * SPECTRUM_RECORD_OUTBOX points at a file, createSpectrumSender and
 * createFastReactionSender return these fakes instead of live Spectrum
 * clients: every outbound iMessage action lands as a JSON line the eval
 * asserts on. No network, no credentials — the file IS the outbox.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SpectrumSender } from "./sender";
import type { FastReactionSender } from "./fast-reaction";

function record(path: string, method: string, args: unknown): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(
      path,
      `${JSON.stringify({ ts: new Date().toISOString(), method, args })}\n`
    );
  } catch {
    // A failed record degrades the send to a no-op rather than breaking the
    // turn — identical failure mode to a dropped Spectrum send.
  }
}

export function createRecordingSpectrumSender(path: string): SpectrumSender {
  return {
    startTyping: async (spaceId, phone) =>
      record(path, "startTyping", { spaceId, phone }),
    markRead: async (spaceId, phone, messageId) =>
      record(path, "markRead", { spaceId, phone, messageId }),
    sendText: async (spaceId, phone, body) =>
      record(path, "sendText", { spaceId, phone, body }),
    sendReply: async (spaceId, phone, messageId, body) => {
      record(path, "sendReply", { spaceId, phone, messageId, body });
      return true;
    },
    react: async (spaceId, phone, messageId, emoji) => {
      record(path, "react", { spaceId, phone, messageId, emoji });
      return true;
    },
    streamText: async (spaceId, phone, stream) => {
      let body = "";
      for await (const chunk of stream) body += chunk;
      record(path, "streamText", { spaceId, phone, body });
    },
    sendApp: async (spaceId, phone, url, layout) => {
      const resolved = await url();
      record(path, "sendApp", { spaceId, phone, url: resolved, layout });
      return undefined;
    },
    editApp: async (spaceId, phone, session, url, layout) => {
      const resolved = await url();
      record(path, "editApp", { spaceId, phone, url: resolved, layout });
      return session;
    },
    sendAttachment: async (spaceId, phone, data, options) =>
      record(path, "sendAttachment", {
        spaceId,
        phone,
        bytes: data.length,
        name: options.name,
        mimeType: options.mimeType,
      }),
    sendRichLink: async (spaceId, phone, url) =>
      record(path, "sendRichLink", { spaceId, phone, url }),
    getAttachment: async () => undefined,
    requestLocation: async (spaceId, phone, address, clientMessageId) => {
      record(path, "requestLocation", {
        spaceId,
        phone,
        address,
        clientMessageId,
      });
      return undefined;
    },
    getSharedLocation: async () => undefined,
    close: async () => record(path, "close", {}),
  };
}

export function createRecordingFastReactionSender(
  path: string
): FastReactionSender {
  return {
    react: async (spaceId, messageId, emoji) => {
      record(path, "fastReact", { spaceId, messageId, emoji });
      return true;
    },
    close: async () => record(path, "fastClose", {}),
  };
}
