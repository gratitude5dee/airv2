import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const template = fileURLToPath(
  new URL("../../../../infra/template/", import.meta.url)
);

describe("Kernel box security invariants", () => {
  it("never prints the browser-create response containing cdp_url", () => {
    const helper = readFileSync(`${template}/air-kernel`, "utf8");
    expect(helper).not.toContain("printf '%s\\n' \"$out\"");
    expect(helper).toContain("session_id: value.session_id");
  });

  it("enforces the owner lease inside the CDP relay", () => {
    const relay = readFileSync(`${template}/kernel-cdp-relay.js`, "utf8");
    expect(relay).toContain("await leaseAllowsAgent(session)");
    expect(relay).toContain("await leaseAllowsAgent(loadSession())");
    expect(relay).toContain('req.url !== "/devtools/browser"');
  });
});
