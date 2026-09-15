import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../../infra/template/skills/", import.meta.url));
const templateRoot = fileURLToPath(
  new URL("../../../../infra/template/", import.meta.url)
);

describe("TC-05: template skills treat credentials as data", () => {
  for (const directory of readdirSync(root, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const source = readFileSync(`${root}/${directory.name}/SKILL.md`, "utf8");
    it(`${directory.name} never sources the Hermes environment`, () => {
      expect(source).not.toMatch(/(?:^|[;\n]\s*)\s*(?:source|\.)\s+[^;\n]*hermes\/\.env/m);
      expect(source).not.toMatch(/eval\s+[^\n]*hermes\/\.env/);
    });
  }
});

describe("Kernel shopping browser contract", () => {
  it("installs the Kernel helper and CDP relay when existing boxes sync", () => {
    const sync = readFileSync(`${templateRoot}/sync-box.sh`, "utf8");
    const verify = readFileSync(`${templateRoot}/verify-box.sh`, "utf8");

    expect(sync).toContain(
      'sudo install -m 755 "$TEMPLATE_DIR/kernel-cdp-relay.js" /usr/local/lib/air/kernel-cdp-relay.js'
    );
    expect(sync).toContain(
      'sudo install -m 755 "$TEMPLATE_DIR/air-kernel" /usr/local/bin/air-kernel'
    );
    expect(sync).toContain(
      'mkdir -p "$HOME_DIR/.hermes/kernel" && chmod 700 "$HOME_DIR/.hermes/kernel"'
    );
    expect(verify).toContain('check "air-kernel" command -v air-kernel');
    expect(verify).toContain(
      'check "kernel-cdp-relay" test -x /usr/local/lib/air/kernel-cdp-relay.js'
    );
    expect(verify).toContain(
      'check "skill-kernel-browser" test -f "$HOME_DIR/.hermes/skills/kernel-browser/SKILL.md"'
    );
  });

  it("selects Kernel before the local browser for interactive shopping", () => {
    const shopping = readFileSync(
      `${root}/shopping-checkout/SKILL.md`,
      "utf8"
    );
    const kernelFirst = shopping.indexOf("air-kernel browser create");
    const localFallback = shopping.indexOf("Open this computer's browser");

    expect(kernelFirst).toBeGreaterThanOrEqual(0);
    expect(localFallback).toBeGreaterThanOrEqual(0);
    expect(kernelFirst).toBeLessThan(localFallback);
  });
});
