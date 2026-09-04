/**
 * The create-miniapp Box skill (V11 §8.3, CR9/CR10): the agent stages and the
 * owner publishes, so the skill text must never let the agent claim an app is
 * published; the CLI must zip with python (no `zip` binary) and pull nothing
 * to storage itself.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const skillDir = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "infra",
  "template",
  "skills",
  "create-miniapp"
);
const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
const cli = readFileSync(join(skillDir, "scripts", "air-create"), "utf8");

/** Prose only: fenced blocks and inline code carry literal API values. */
function prose(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

describe("create-miniapp skill", () => {
  it("never claims an app is published", () => {
    expect(prose(skill)).not.toMatch(/\bpublished\b/i);
    expect(cli).not.toMatch(/\bpublished\b/i);
  });

  it("frames publishing as the owner's decision and sends the draft card", () => {
    expect(skill).toMatch(/only the owner|the owner does|THEY flip/i);
    // The marker carries the API's full slug (<username>-<appname>), not the app name.
    expect(skill).toContain("[card: app alice-promo]");
    expect(skill).not.toMatch(/\[card: app promo\]/);
    for (const marker of skill.matchAll(/\[card: app ([^\]]+)\]/g)) {
      expect(marker[1]).toMatch(/^(?:[a-z0-9_]{2,24}-[a-z0-9-]+|<slug>)$/);
    }
    expect(skill).toContain("Needs-you");
  });

  it("recognizes hosting phrasings and declines images and videos", () => {
    for (const phrase of ["host this", "put this up", "make this live", "share this as a page"]) {
      expect(skill.toLowerCase().replace(/\s+/g, " ")).toContain(phrase);
    }
    expect(skill).toContain("/api/media/publish");
    expect(cli).toContain("/api/media/publish");
    expect(cli).toMatch(/\*\.png\|\*\.jpg/);
  });

  it("supports new, build, qa, drop, status, and publish only (skill v2)", () => {
    const subcommands = [...cli.matchAll(/^\s{2}(\w+)\) shift; cmd_\w+/gm)].map((m) => m[1]);
    expect(subcommands.sort()).toEqual(["build", "drop", "new", "publish", "qa", "status"]);
  });

  it("builds through the control plane and never installs or resolves the Kit itself", () => {
    expect(cli).toContain("/api/create/build");
    expect(cli).toContain("/api/create/preview-link");
    expect(cli).toContain("/api/create/qa");
    expect(cli).not.toMatch(/npm install|npx |esbuild|node_modules/);
    expect(skill).toMatch(/never run `npm install`/);
  });

  it("records and resolves the active project", () => {
    expect(cli).toContain('ACTIVE_FILE="$CREATE_ROOT/.active"');
    expect(skill).toContain("~/.hermes/create/.active");
  });

  it("frames the draft as awaiting approval, with findings quoted verbatim", () => {
    expect(skill).toContain("ready for your approval");
    expect(skill).toMatch(/verbatim/);
    expect(skill).toContain("[card: app alice-countdown]");
  });

  it("zips folders with python and never assumes a zip binary", () => {
    expect(cli).toContain("python3 -m zipfile -c");
    expect(cli).not.toMatch(/^\s*zip\s+-/m);
  });

  it("uses the gateway base and token from the Box env, and only control-plane routes", () => {
    expect(cli).toContain("${BASE_URL%/api/gateway/v1}");
    expect(cli).toContain("/api/create/drop");
    expect(cli).toContain("/api/create/status");
    expect(cli).toContain("/api/miniapps/publish");
    expect(cli).not.toMatch(/r2\.cloudflarestorage|amazonaws|s3:\/\//);
    expect(cli).not.toMatch(/publish\/status/);
  });

  it("is executable", () => {
    expect(statSync(join(skillDir, "scripts", "air-create")).mode & 0o111).not.toBe(0);
  });
});
