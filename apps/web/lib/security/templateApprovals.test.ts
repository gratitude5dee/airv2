/**
 * R-SEC-03 — the box template's generated ~/.hermes/config.yaml must pin the
 * deterministic approval posture the owner chose ("deny-list": a fixed list
 * where publishing-type tools always pause and everything else runs).
 * Pinned Hermes v0.21.4 supports only manual/smart/off
 * (tools/approval_context.py::_VALID_MODES), so the template carries it as
 * "manual" — its fixed gate rules decide what pauses, with no injectable
 * guardian-LLM policy the agent can be talked out of (ARCHITECTURE §8.2).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const setupPath = fileURLToPath(
  new URL("../../../../infra/template/setup.sh", import.meta.url)
);

/** The config.yaml the template heredoc writes to ~/.hermes/config.yaml. */
function generatedConfig(): string {
  const source = readFileSync(setupPath, "utf8");
  const match = source.match(
    /cat > "\$HOME_DIR\/\.hermes\/config\.yaml" <<'YAML'\n([\s\S]*?)\nYAML/
  );
  expect(match, "setup.sh must generate ~/.hermes/config.yaml").not.toBeNull();
  return match![1] as string;
}

/** One top-level config section (a key at column 0 plus its indented body). */
function section(config: string, key: string): string {
  const match = config.match(
    new RegExp(`^${key}:\\n(?:^[ \\t]+[^\\n]*\\n?)*`, "m")
  );
  expect(match, `generated config must have a ${key}: section`).not.toBeNull();
  return match![0] as string;
}

describe("R-SEC-03: generated config.yaml approval mode", () => {
  it('runs approvals in "manual" — the deny-list equivalent in pinned Hermes', () => {
    const approvals = section(generatedConfig(), "approvals");
    expect(approvals).toContain('mode: "manual"');
  });

  it("carries no smart_policy — no injectable classifier gates risk", () => {
    const approvals = section(generatedConfig(), "approvals");
    expect(approvals).not.toContain("smart_policy");
    expect(approvals).not.toContain('mode: "smart"');
  });

  it("keeps memory writes ungated (local file edits, not public actions)", () => {
    expect(section(generatedConfig(), "memory")).toContain(
      "write_approval: false"
    );
  });
});
