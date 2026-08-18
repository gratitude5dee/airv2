/**
 * Web chat uploads (V8): files land in the box inbox exactly like iMessage
 * attachments (lib/orchestrator/flush.ts materializeAttachments) and are
 * referenced in the run input — bytes never touch Postgres (C4).
 */

/** Mirror of the iMessage attachment cap; a chat upload is not a file drive. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

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
