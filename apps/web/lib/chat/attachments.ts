/**
 * Web chat uploads (V8): files land in the box inbox exactly like iMessage
 * attachments (lib/orchestrator/flush.ts materializeAttachments) and are
 * referenced in the run input — bytes never touch Postgres (C4).
 */

/** Upload ceiling; a chat upload is still not a file drive. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Raw bytes per upload chunk. A multiple of 3 so each chunk's padless base64
 * concatenates cleanly on the box, and small enough that a chunk request
 * stays under the platform's ~4.5 MB request-body ceiling.
 */
export const UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024;

export const MAX_UPLOAD_CHUNKS = Math.ceil(
  MAX_UPLOAD_BYTES / UPLOAD_CHUNK_BYTES
);

/** Server-side shape check for a client-echoed upload key (an inbox path). */
export const INBOX_PATH_RE = /^\.hermes\/inbox\/\d+-[A-Za-z0-9._-]{1,120}$/;

/** Same character policy as the iMessage path: anything shell-risky → "_". */
export function sanitizeAttachmentName(name: string): string {
  const trimmed = name.trim() || "file";
  // Take the basename in case a path sneaks into the filename field.
  const base = trimmed.split(/[\\/]/).pop() || "file";
  return (base.replace(/[^A-Za-z0-9._-]/g, "_") || "file").slice(0, 120);
}

/** Box-relative inbox path (writeFile roots at /home/user). */
export function inboxPath(name: string, now: number): string {
  return `.hermes/inbox/${now}-${sanitizeAttachmentName(name)}`;
}

/** The run-input reference line — same shape the iMessage path emits. */
export function attachmentMarker(mimeType: string, path: string): string {
  return `[The user sent an attachment (${mimeType}); it is saved at /home/user/${path}]`;
}
