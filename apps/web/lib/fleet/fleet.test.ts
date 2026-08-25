import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cutRelease, type TemplateRelease } from "./releases";
import { isChannelName } from "./channels";
import { hermesCommand, syncCommand } from "./sync";

vi.mock("../storage/r2", () => ({
  putObject: vi.fn().mockResolvedValue(undefined),
  presignGet: vi
    .fn()
    .mockReturnValue("https://r2.example/artifact.tgz?X-Amz-Signature=abc"),
}));

const fakeSupabase = {} as SupabaseClient;

const release: TemplateRelease = {
  id: "rel-1",
  version: "2026.08.24-abc1234",
  git_sha: "a".repeat(40),
  artifact_key: "_platform/templates/template-x.tgz",
  checksum: "c".repeat(64),
  hermes_ref: "b".repeat(40),
  notes: null,
  created_at: new Date().toISOString(),
};

describe("cutRelease validation", () => {
  it("rejects a bad version before touching storage", async () => {
    await expect(
      cutRelease(fakeSupabase, {
        version: "not ok!",
        gitSha: "a".repeat(40),
        artifactBase64: Buffer.from("x").toString("base64"),
      })
    ).rejects.toThrow("invalid version");
  });

  it("rejects a bad git sha", async () => {
    await expect(
      cutRelease(fakeSupabase, {
        version: "1.0.0",
        gitSha: "zzz",
        artifactBase64: Buffer.from("x").toString("base64"),
      })
    ).rejects.toThrow("invalid git sha");
  });

  it("rejects an empty artifact", async () => {
    await expect(
      cutRelease(fakeSupabase, {
        version: "1.0.0",
        gitSha: "a".repeat(40),
        artifactBase64: "",
      })
    ).rejects.toThrow("artifact empty or too large");
  });
});

describe("isChannelName", () => {
  it("accepts only dev and prod", () => {
    expect(isChannelName("dev")).toBe(true);
    expect(isChannelName("prod")).toBe(true);
    expect(isChannelName("staging")).toBe(false);
    expect(isChannelName(undefined)).toBe(false);
  });
});

describe("syncCommand", () => {
  it("downloads, checksums, syncs, and health-gates", () => {
    const cmd = syncCommand(release);
    expect(cmd).toContain("curl -fsSL 'https://r2.example/artifact.tgz");
    expect(cmd).toContain(`echo "${release.checksum}  /tmp/air-template.tgz" | sha256sum -c -`);
    expect(cmd).toContain("bash /tmp/air-template/template/sync-box.sh");
    expect(cmd).toContain("bash /tmp/air-template/template/verify-box.sh");
  });
});

describe("hermesCommand", () => {
  it("re-pins in place per the upgrade runbook and restarts services", () => {
    const cmd = hermesCommand("b".repeat(40));
    expect(cmd).toContain(`git fetch --depth 1 origin '${"b".repeat(40)}'`);
    expect(cmd).toContain("git checkout --force FETCH_HEAD");
    expect(cmd).toContain("git rev-parse HEAD > ~/.hermes/.template-hermes-ref");
    expect(cmd).toContain(
      "sudo systemctl restart hermes-gateway hermes-dashboard hermes-host"
    );
  });
});
