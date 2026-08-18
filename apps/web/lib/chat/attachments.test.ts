/**
 * V8 chat uploads: names are sanitized before they become box paths, and the
 * run-input marker mirrors the iMessage attachment shape — a reference, not
 * content (C4).
 */
import { describe, expect, it } from "vitest";
import {
  attachmentMarker,
  inboxPath,
  sanitizeAttachmentName,
} from "./attachments";

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
