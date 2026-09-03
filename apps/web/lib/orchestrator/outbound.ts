/**
 * Outbound marker lanes for ordinary agent replies.
 *
 * Media (SOUL.md "Sending photos"): the agent saves an image on its own
 * computer and writes a `[send-file: /home/user/...]` marker in its reply;
 * the flush strips the marker from the streamed text and, after the stream
 * ends, pulls the bytes out of the box and sends them as a native iMessage
 * attachment. Bytes come from OUR box over the box command channel — a
 * provider or web URL is never forwarded as an attachment source.
 *
 * Cards (SOUL.md "Mini-app cards"): a `[card: <kind>]` marker asks the
 * control plane to drop the matching mini-app card into the owner's thread
 * after the text — the same mint/rate-limit path as POST /api/cards/<kind>,
 * minus the terminal round-trip the agent used to need.
 */
import { command } from "../box/client";
import type { SpectrumSender } from "../spectrum/sender";

export const SEND_FILE_MARKER = /\[send-file:\s*([^\]\n]+)\]/g;
export const CARD_MARKER = /\[card:\s*([a-z0-9-]+)\s*\]/gi;

const MARKER_PREFIXES = ["[send-file:", "[card:"];

/** iMessage attachments should stay small; 6 MB of raw bytes ≈ 8 MB base64. */
const MAX_FILE_BYTES = 6 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  gif: "image/gif",
  heic: "image/heic",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mov: "video/quicktime",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  webp: "image/webp",
};

/** Only files the agent itself can write are sendable; anything outside the
 * box home (or path-traversal shaped) is ignored. */
export function isSendablePath(path: string): boolean {
  return (
    /^\/(?:home|Users)\/[^/]+\//.test(path) &&
    !path.includes("..") &&
    !path.includes("\n")
  );
}

/** POSIX single-quoting: safe against `"`, `$`, backticks, and newlines. */
function shellQuote(path: string): string {
  return `'${path.replaceAll("'", `'\\''`)}'`;
}

export interface StrippedStream {
  /** Deltas with complete `[send-file: …]` and `[card: …]` markers removed. */
  deltas: AsyncGenerator<string>;
  /** Marker paths in order of appearance; stable after the stream ends. */
  files: string[];
  /** Card kinds (lowercased, deduplicated) in order of first appearance. */
  cards: string[];
}

/** Longest text we hold back waiting for a marker's closing bracket. */
const MARKER_HOLDBACK = 512;

/**
 * Strip send-file and card markers from a delta stream without leaking
 * partial marker text: a suffix that could still become a marker is held
 * back until it either completes (stripped, recorded) or disproves itself.
 */
export function stripSendFileMarkers(
  source: AsyncIterable<string>
): StrippedStream {
  const files: string[] = [];
  const cards: string[] = [];

  /** Index from which `buffer` could still be the start of a marker. */
  function holdFrom(buffer: string): number {
    const open = buffer.lastIndexOf("[");
    if (open === -1) return buffer.length;
    const tail = buffer.slice(open);
    if (tail.includes("]") || tail.includes("\n")) return buffer.length;
    if (tail.length > MARKER_HOLDBACK) return buffer.length;
    const lowered = tail.toLowerCase();
    const couldOpen = MARKER_PREFIXES.some((probe) => {
      const overlap = Math.min(lowered.length, probe.length);
      return lowered.slice(0, overlap) === probe.slice(0, overlap);
    });
    return couldOpen ? open : buffer.length;
  }

  function extract(buffer: string): string {
    return buffer
      .replace(SEND_FILE_MARKER, (_, path: string) => {
        const trimmed = path.trim();
        if (trimmed) files.push(trimmed);
        return "";
      })
      .replace(CARD_MARKER, (_, kind: string) => {
        const slug = kind.toLowerCase();
        if (!cards.includes(slug)) cards.push(slug);
        return "";
      });
  }

  async function* deltas(): AsyncGenerator<string> {
    let buffer = "";
    for await (const chunk of source) {
      buffer = extract(buffer + chunk);
      const keep = holdFrom(buffer);
      if (keep > 0) {
        yield buffer.slice(0, keep);
        buffer = buffer.slice(keep);
      }
    }
    buffer = extract(buffer);
    if (buffer) yield buffer;
  }

  return { deltas: deltas(), files, cards };
}

/**
 * Pull each marked file out of the box and send it as a native attachment.
 * Best-effort per file: one unreadable path never blocks the others or the
 * turn. Returns how many attachments were sent.
 */
export async function deliverSendFiles(
  sender: SpectrumSender,
  boxId: string,
  spaceId: string,
  phone: string,
  files: string[]
): Promise<number> {
  let sent = 0;
  for (const path of files.slice(0, 4)) {
    if (!isSendablePath(path)) continue;
    try {
      const quoted = shellQuote(path);
      // `wc -c < file` and unwrapped base64 work on both GNU and BSD tools;
      // `stat -c` / `base64 -w0` are GNU-only and fail on macOS boxes.
      const size = await command(boxId, `wc -c < ${quoted}`);
      if (size.exitCode !== 0) continue;
      if (Number.parseInt(size.stdout.trim(), 10) > MAX_FILE_BYTES) continue;
      const encoded = await command(
        boxId,
        `base64 < ${quoted} | tr -d '\\n'`,
        120
      );
      if (encoded.exitCode !== 0) continue;
      const data = Buffer.from(encoded.stdout.trim(), "base64");
      if (data.length === 0) continue;
      const name = path.split("/").pop() ?? "file";
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      await sender.sendAttachment(spaceId, phone, data, {
        name,
        mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
      });
      sent += 1;
    } catch {
      // best-effort: skip this file
    }
  }
  return sent;
}
