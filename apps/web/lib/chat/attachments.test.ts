/**
 * V8 chat uploads: names are sanitized before they become box paths, and the
 * run-input marker mirrors the iMessage attachment shape — a reference, not
 * content (C4).
 */
import { describe, expect, it } from "vitest";
import {
  attachmentMarker,
  inboxPath,
  INBOX_PATH_RE,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_CHUNKS,
  sanitizeAttachmentName,
  UPLOAD_CHUNK_B64_LEN,
  UPLOAD_CHUNK_BYTES,
} from "./attachments";

describe("chunked upload invariants", () => {
  it("chunk size is a multiple of 3 so padless base64 pieces concatenate", () => {
    expect(UPLOAD_CHUNK_BYTES % 3).toBe(0);
    const chunk = Buffer.alloc(UPLOAD_CHUNK_BYTES, 7).toString("base64");
    expect(chunk.endsWith("=")).toBe(false);
    // The append offset check relies on this exact accumulator arithmetic.
    expect(chunk.length).toBe(UPLOAD_CHUNK_B64_LEN);
  });

  it("chunk count covers the full upload ceiling", () => {
    expect(MAX_UPLOAD_CHUNKS * UPLOAD_CHUNK_BYTES).toBeGreaterThanOrEqual(
      MAX_UPLOAD_BYTES
    );
    expect(MAX_UPLOAD_BYTES).toBe(100 * 1024 * 1024);
  });

  it("concatenated chunk base64 decodes back to the original bytes", () => {
    const original = Buffer.concat([
      Buffer.alloc(6, 1),
      Buffer.alloc(6, 2),
      Buffer.alloc(4, 3), // final chunk may be padded
    ]);
    const joined =
      original.subarray(0, 6).toString("base64") +
      original.subarray(6, 12).toString("base64") +
      original.subarray(12).toString("base64");
    expect(Buffer.from(joined, "base64").equals(original)).toBe(true);
  });

  it("upload keys only match real inbox paths", () => {
    expect(INBOX_PATH_RE.test(inboxPath("a.png", 1755500000000))).toBe(true);
    expect(INBOX_PATH_RE.test("../../etc/passwd")).toBe(false);
    expect(INBOX_PATH_RE.test(".hermes/inbox/1-a.png; rm -rf /")).toBe(false);
    expect(INBOX_PATH_RE.test(".hermes/inbox/1-a/../../x")).toBe(false);
  });
});

describe("chat attachment names", () => {
  it("strips path separators and traversal", () => {
    expect(sanitizeAttachmentName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeAttachmentName("..\\..\\win\\cmd.exe")).toBe("cmd.exe");
    expect(sanitizeAttachmentName("a/b/c.png")).toBe("c.png");
  });

  it("replaces shell-hostile characters", () => {
    expect(sanitizeAttachmentName("pay; rm -rf $(HOME).png")).toBe(
      "pay__rm_-rf___HOME_.png"
    );
    // "/" also acts as a path separator, so only the last segment survives.
    expect(sanitizeAttachmentName("<script>alert(1)</script>.jpg")).toBe(
      "script_.jpg"
    );
    expect(sanitizeAttachmentName("<img onerror=x>.png")).toBe(
      "_img_onerror_x_.png"
    );
  });

  it("never returns an empty name and caps length", () => {
    expect(sanitizeAttachmentName("")).toBe("file");
    expect(sanitizeAttachmentName("///")).toBe("file");
    expect(sanitizeAttachmentName("x".repeat(500)).length).toBeLessThanOrEqual(
      120
    );
  });

  it("builds inbox paths that match the /api/chat reference validator", () => {
    const path = inboxPath("Photo Of Us.HEIC", 1755500000000);
    expect(path).toBe(".hermes/inbox/1755500000000-Photo_Of_Us.HEIC");
    expect(path).toMatch(/^\.hermes\/inbox\/\d+-[A-Za-z0-9._-]+$/);
  });

  it("marker mirrors the iMessage attachment line — path, never bytes", () => {
    const marker = attachmentMarker("image/png", ".hermes/inbox/1-a.png");
    expect(marker).toBe(
      "[The user sent an attachment (image/png); it is saved at /home/user/.hermes/inbox/1-a.png]"
    );
  });
});
