import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cutRelease, type TemplateRelease } from "./releases";
import { isChannelName, setChannelRelease } from "./channels";
import { hermesCommands, syncCommand } from "./sync";

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

/**
 * In-memory box_channels row plus the release lookup, shaped like the
 * PostgREST builder chains setChannelRelease uses. Update filters on
 * release_id decide whether the row matches, as the database would.
 */
function fakeChannelStore(initialRelease: string | null) {
  const row = { name: "prod", release_id: initialRelease };
  const supabase = {
    from(table: string) {
      if (table === "template_releases") {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({
                data: id === release.id ? release : null,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { ...row }, error: null }),
          }),
        }),
        update(patch: { release_id: string }) {
          let matches = true;
          const builder = {
            eq(col: string, value: string) {
              if (col === "release_id" && row.release_id !== value) {
                matches = false;
              }
              return builder;
            },
            is(col: string, value: null) {
              if (col === "release_id" && row.release_id !== value) {
                matches = false;
              }
              return builder;
            },
            async select() {
              if (!matches) return { data: [], error: null };
              row.release_id = patch.release_id;
              return { data: [{ name: row.name }], error: null };
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { supabase, row };
}

describe("setChannelRelease", () => {
  it("moves the pointer unconditionally when no expectation is given", async () => {
    const { supabase, row } = fakeChannelStore("rel-0");
    await setChannelRelease(supabase, "prod", release.id);
    expect(row.release_id).toBe(release.id);
  });

  it("moves the pointer when it still reads the expected release", async () => {
    const { supabase, row } = fakeChannelStore("rel-0");
    await setChannelRelease(supabase, "prod", release.id, "rel-0");
    expect(row.release_id).toBe(release.id);
  });

  it("treats null as 'no release yet' and matches an empty pointer", async () => {
    const { supabase, row } = fakeChannelStore(null);
    await setChannelRelease(supabase, "prod", release.id, null);
    expect(row.release_id).toBe(release.id);
  });

  it("refuses with 409 and leaves the pointer alone when it moved meanwhile", async () => {
    const { supabase, row } = fakeChannelStore("rel-other");
    await expect(
      setChannelRelease(supabase, "prod", release.id, "rel-0")
    ).rejects.toMatchObject({
      status: 409,
      message: "channel prod moved to rel-other since it was read",
    });
    expect(row.release_id).toBe("rel-other");
  });

  it("refuses when a release appeared where none was expected", async () => {
    const { supabase, row } = fakeChannelStore("rel-other");
    await expect(
      setChannelRelease(supabase, "prod", release.id, null)
    ).rejects.toMatchObject({ status: 409 });
    expect(row.release_id).toBe("rel-other");
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

  it("clears a stale fetch lock before fetching, but only when no git is running", () => {
    const checkout = hermesCommands("b".repeat(40))[0] ?? "";
    const lockGuard = checkout.indexOf("pgrep -x git >/dev/null || rm -f .git/shallow.lock");
    expect(lockGuard).toBeGreaterThan(-1);
    expect(lockGuard).toBeLessThan(checkout.indexOf("git fetch"));
  });

  it("keeps every step independent so each fits the provider's 600s command cap", () => {
    const steps = hermesCommands("b".repeat(40));
    expect(steps.length).toBeGreaterThan(1);
    for (const step of steps) {
      expect(step).toContain("cd ~/hermes-agent");
    }
  });
});
