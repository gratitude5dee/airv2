import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../../infra/template/skills/", import.meta.url));

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
