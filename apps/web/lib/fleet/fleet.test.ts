import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { cutRelease, type TemplateRelease } from "./releases";
import { isChannelName, setChannelRelease } from "./channels";
import { hermesCommands, syncCommand } from "./sync";

vi.mock("../storage/r2", () => ({
  putObject: vi.fn().mockResolvedValue(undefined),
  presignGet: vi
    .fn()
    .mockReturnValue("https://r2.example/artifact.tgz?X-Amz-Signature=abc"),
}));

const db = new FakeSupabase();
const fakeSupabase = db.client();

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

/**
 * A box_channels row plus the release lookup in the shared fake: the CAS
 * update's filters on release_id decide whether the row matches, as the
 * database would.
 */
function fakeChannelStore(initialRelease: string | null) {
  db.reset();
  db.tables["template_releases"] = [{ ...release }];
  db.tables["box_channels"] = [
    {
      name: "prod",
      release_id: initialRelease,
      template_box_id: null,
      updated_at: new Date().toISOString(),
    },
  ];
  const supabase = db.client();
  const row = () => db.rows("box_channels")[0]!;
  return { supabase, row };
}

describe("setChannelRelease", () => {
  it("moves the pointer unconditionally when no expectation is given", async () => {
    const { supabase, row } = fakeChannelStore("rel-0");
    await setChannelRelease(supabase, "prod", release.id);
    expect(row()["release_id"]).toBe(release.id);
  });

  it("moves the pointer when it still reads the expected release", async () => {
    const { supabase, row } = fakeChannelStore("rel-0");
    await setChannelRelease(supabase, "prod", release.id, "rel-0");
    expect(row()["release_id"]).toBe(release.id);
  });

  it("treats null as 'no release yet' and matches an empty pointer", async () => {
    const { supabase, row } = fakeChannelStore(null);
    await setChannelRelease(supabase, "prod", release.id, null);
    expect(row()["release_id"]).toBe(release.id);
  });

  it("refuses with 409 and leaves the pointer alone when it moved meanwhile", async () => {
    const { supabase, row } = fakeChannelStore("rel-other");
    await expect(
      setChannelRelease(supabase, "prod", release.id, "rel-0")
    ).rejects.toMatchObject({
      status: 409,
      message: "channel prod moved to rel-other since it was read",
    });
    expect(row()["release_id"]).toBe("rel-other");
  });

  it("refuses when a release appeared where none was expected", async () => {
    const { supabase, row } = fakeChannelStore("rel-other");
    await expect(
      setChannelRelease(supabase, "prod", release.id, null)
    ).rejects.toMatchObject({ status: 409 });
    expect(row()["release_id"]).toBe("rel-other");
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

describe("hermesCommands", () => {
  it("re-pins in place per the upgrade runbook and restarts services", () => {
    const steps = hermesCommands("b".repeat(40));
    const all = steps.join(" && ");
    expect(all).toContain(`git fetch --depth 1 origin '${"b".repeat(40)}'`);
    expect(all).toContain("git checkout --force FETCH_HEAD");
    expect(all).toContain("git rev-parse HEAD > ~/.hermes/.template-hermes-ref");
    expect(all).toContain(
      "sudo systemctl restart hermes-gateway hermes-dashboard hermes-host"
    );
  });

  it("clears stale git locks before fetching without consulting the process table", () => {
    const checkout = hermesCommands("b".repeat(40))[0] ?? "";
    const lockGuard = checkout.indexOf("find .git -maxdepth 1 -name '*.lock'");
    expect(lockGuard).toBeGreaterThan(-1);
    expect(lockGuard).toBeLessThan(checkout.indexOf("git fetch"));
    expect(checkout).toContain("rm -f .git/shallow.lock");
    expect(checkout.indexOf("rm -f .git/shallow.lock")).toBeLessThan(lockGuard);
    expect(checkout).not.toContain("pgrep");
  });

  it("clears shallow.lock unconditionally — a fetch killed by the command cap leaves one younger than any age threshold — while other fresh locks survive", () => {
    const checkout = hermesCommands("b".repeat(40))[0] ?? "";
    const guard = checkout
      .split(" && ")
      .slice(1, 3)
      .join(" && ");
    expect(guard).toContain("rm -f .git/shallow.lock");
    expect(guard).toContain("find .git");

    const repo = mkdtempSync(join(tmpdir(), "hermes-lock-"));
    mkdirSync(join(repo, ".git", "refs"), { recursive: true });
    const orphaned = join(repo, ".git", "shallow.lock");
    const live = join(repo, ".git", "index.lock");
    const nested = join(repo, ".git", "refs", "HEAD.lock");
    for (const path of [orphaned, live, nested]) writeFileSync(path, "");

    execFileSync("sh", ["-c", guard], { cwd: repo });

    expect(existsSync(orphaned)).toBe(false);
    expect(existsSync(live)).toBe(true);
    expect(existsSync(nested)).toBe(true);
  });

  it("keeps every step independent so each fits the provider's 600s command cap", () => {
    const steps = hermesCommands("b".repeat(40));
    expect(steps.length).toBeGreaterThan(1);
    for (const step of steps) {
      expect(step).toContain("cd ~/hermes-agent");
    }
  });
});
