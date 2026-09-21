// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("deck pending recovery", () => {
  it("releases a busy native form when navigation never replaces the document", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./deck-pending.ts", import.meta.url)),
      "utf8"
    );
    expect(source).toContain("NAVIGATION_RECOVERY_MS");
    expect(source).toContain("window.setTimeout(clearPending, NAVIGATION_RECOVERY_MS)");
    expect(source).toContain('window.addEventListener("pageshow", clearPending)');
  });
});
