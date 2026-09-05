/**
 * Provisioning branches per environment: ubuntu (default) and omarchy fork a
 * template box on ascii.dev, macos builds a Namespace instance from the
 * bootstrap URL — and every environment gets the same connector install.
 * P1-8 (bound_phone canonical form) rides on the failing-fork rollback test.
 *
 * Fleet position: a fork from the channel's current release (baked Hermes ref
 * matches) records baseline_version and skips the hub installs the template
 * already carries; any other fork re-asserts them and stays unsynced. A
 * replacement keeps the old box's channel. replaceBox leases the row so two
 * overlapping replacements can't fork two boxes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
const inserts: Record<string, Row[]> = {};
const upserts: Record<string, Row[]> = {};
/** Rows the fake supabase serves to select().eq()...maybeSingle(). */
const tables: Record<string, Row[]> = {};
/** Every update() applied to `boxes`, with the filters it carried. */
const boxUpdates: Array<{ values: Row; filters: string[] }> = [];
/** When set, a `boxes` update carrying these values fails with this message. */
let failBoxUpdate: { when: (values: Row) => boolean; message: string } | null =
  null;

type Filter = (row: Row) => boolean;

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => f(row));
}

/** Parses PostgREST's `col.op.value,col.op.value` or() clause. */
function orFilter(clause: string): Filter {
  const terms = clause.split(",").map((term) => {
    const [col, op, ...rest] = term.split(".");
    const value = rest.join(".");
    return (row: Row) => {
      const actual = row[col as string];
      if (op === "is" && value === "null") return actual == null;
      if (op === "lt") return actual != null && String(actual) < value;
      throw new Error(`unsupported or() term ${term}`);
    };
  });
  return (row) => terms.some((t) => t(row));
}

function tableApi(table: string) {
  const filters: Filter[] = [];
  const described: string[] = [];
  const builder: Record<string, unknown> = {
    eq(key: string, value: unknown) {
      described.push(`${key}=eq.${String(value)}`);
      filters.push((row) => row[key] === value);
      return builder;
    },
    is() {
      return builder;
    },
    async maybeSingle() {
      const row = (tables[table] ?? []).find((r) => matches(r, filters));
      return { data: row ? { ...row } : null, error: null };
    },
  };
  /**
   * update(): rows matching every filter are mutated in place and returned
   * by select(), so a conditional claim sees exactly the rows it won.
   */
  function updateApi(values: Row) {
    const apply = () => {
      const rows = (tables[table] ?? []).filter((r) => matches(r, filters));
      if (table === "boxes") {
        boxUpdates.push({ values, filters: [...described] });
      }
      for (const row of rows) Object.assign(row, values);
      return rows.map((row) => ({ ...row }));
    };
    const chain: Record<string, unknown> = {
      eq(key: string, value: unknown) {
        described.push(`${key}=eq.${String(value)}`);
        filters.push((row) => row[key] === value);
        return chain;
      },
      or(clause: string) {
        described.push(`or(${clause})`);
        filters.push(orFilter(clause));
        return chain;
      },
      is: () => ({
        select: async () => ({ data: [{ id: "line-1" }], error: null }),
      }),
      select: async () => ({ data: apply(), error: null }),
      then(
        resolve: (value: { error: { message: string } | null }) => unknown
      ) {
        if (table === "boxes" && failBoxUpdate?.when(values)) {
          return Promise.resolve({
            error: { message: failBoxUpdate.message },
          }).then(resolve);
        }
        apply();
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return chain;
  }
  return {
    select: () => builder,
    insert(row: Row) {
      (inserts[table] ??= []).push(row);
      return Object.assign(Promise.resolve({ error: null }), {
        select: () => ({
          single: async () => ({ data: { id: "user-1" }, error: null }),
        }),
      });
    },
    upsert(row: Row) {
      (upserts[table] ??= []).push(row);
      return Promise.resolve({ error: null });
    },
    update: (values: Row) => updateApi(values),
    delete: () => ({ eq: async () => ({ error: null }) }),
  };
}

const fakeSupabase = {
  from: (table: string) => tableApi(table),
} as unknown as SupabaseClient;

vi.mock("../supabase", () => ({ serviceClient: () => fakeSupabase }));

const fork = vi.fn(async () => ({ id: "box-new" }));
/**
 * What the fake fork's template stamped on itself: the release it was built
 * from (~/.hermes/.template-release) and the hub skills setup.sh managed to
 * install (~/.hermes/.template-skills). Tests set these per scenario.
 */
const templateStamp = { release: "", skills: [] as string[] };
function stampTemplate(release: string, skills: readonly string[]) {
  templateStamp.release = release;
  templateStamp.skills = [...skills];
}
const boxCommand = vi.fn(async (_id: string, cmd: string) => {
  if (cmd.includes(".template-hermes-ref")) {
    return { exitCode: 0, stdout: "sha-1\n", stderr: "" };
  }
  if (cmd.includes(".template-release")) {
    return {
      exitCode: 0,
      stdout: `${templateStamp.release}\n---template-skills---\n${templateStamp.skills.join("\n")}\n`,
      stderr: "",
    };
  }
  if (cmd.includes("hash_password")) {
    return { exitCode: 0, stdout: "hash-1\n", stderr: "" };
  }
  if (cmd.includes("/.ascii/host url")) {
    return {
      exitCode: 0,
      stdout:
        "https://box-8642.on.ascii.dev?_token=aa11\nhttps://box-9119.on.ascii.dev?_token=bb22\n",
      stderr: "",
    };
  }
  return { exitCode: 0, stdout: "", stderr: "" };
});
vi.mock("../box/client", () => ({
  command: (...args: unknown[]) => boxCommand(...(args as [string, string])),
  deleteBox: vi.fn(),
  fork: (...args: unknown[]) => fork(...(args as [])),
  stop: vi.fn(),
  waitForBox: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

const createMacInstance = vi.fn(async () => ({ id: "mac-1", state: "RUNNING", ports: {} }));
const bridgeCommand = vi.fn(async (_c: unknown, cmd: string) => {
  if (cmd.includes(".template-hermes-ref")) {
    return { exitCode: 0, stdout: "sha-mac\n", stderr: "" };
  }
  if (cmd.includes("hash_password")) {
    return { exitCode: 0, stdout: "hash-mac\n", stderr: "" };
  }
  return { exitCode: 0, stdout: "", stderr: "" };
});
vi.mock("../namespace/client", () => ({
  BRIDGE_PORT: 8722,
  DASHBOARD_PORT: 9119,
  HERMES_PORT: 8642,
  createMacInstance: (...args: unknown[]) => createMacInstance(...(args as [])),
  waitForInstance: vi.fn(),
  waitForBridge: vi.fn(),
  publishMacIngress: vi.fn(async () => ({
    8642: { name: "hermes", url: "https://mac-hermes.ns.dev" },
    9119: { name: "dashboard", url: "https://mac-dash.ns.dev" },
    8722: { name: "bridge", url: "https://mac-bridge.ns.dev" },
  })),
  bridgeCommand: (...args: unknown[]) =>
    bridgeCommand(...(args as [unknown, string])),
  bridgeReadFile: vi.fn(),
  bridgeWriteFile: vi.fn(),
  suspendInstance: vi.fn(),
  destroyInstance: vi.fn(),
  wakeInstance: vi.fn(),
}));

const installComposioMcp = vi.fn();
vi.mock("./connectors", () => ({
  installComposioMcp: (...args: unknown[]) =>
    installComposioMcp(...(args as [])),
}));
vi.mock("./daytona", () => ({ provisionDaytona: vi.fn() }));
const installBaseSkills = vi.fn();
const BASE_SKILLS = ["official/research/duckduckgo-search", "browser-harness"];
vi.mock("../skills/hub", () => ({
  baseSkillsFor: () => BASE_SKILLS,
  installBaseSkills: (...args: unknown[]) => installBaseSkills(...(args as [])),
}));
vi.mock("../crypto/secretbox", () => ({ sealSecret: vi.fn() }));
vi.mock("../env", () => ({
  env: {
    boxTemplateId: () => "template-ubuntu",
    omarchyTemplateId: () => null,
    macBootstrapUrl: () => null,
    appOrigin: () => "https://air.test",
    boxDashboardAuthKey: () => null,
  },
}));

import {
  LONGEST_REPLACE_CALLER_SECONDS,
  provisionUser,
  REPLACE_CLAIM_TTL_MS,
  replaceBox,
  ReplaceInProgressError,
  switchEnvironment,
  SwitchSetupError,
} from "./provision";
import * as boxClient from "../box/client";

/** A channel pointing at a release, by default the one the fake fork's template is stamped with. */
function pointChannelAtCurrentRelease(
  channel: "dev" | "prod",
  hermesRef: string | null = "sha-1",
  stamp: { version?: string; gitSha?: string } | null = {}
) {
  tables["box_channels"] = [
    ...(tables["box_channels"] ?? []),
    { name: channel, release_id: `rel-${channel}`, template_box_id: `tpl-${channel}` },
  ];
  tables["template_releases"] = [
    ...(tables["template_releases"] ?? []),
    {
      id: `rel-${channel}`,
      version: `2026.09.05-${channel}`,
      git_sha: `sha-${channel}`,
      hermes_ref: hermesRef,
    },
  ];
  if (stamp) {
    stampTemplate(
      `version=${stamp.version ?? `2026.09.05-${channel}`}\ngit_sha=${stamp.gitSha ?? `sha-${channel}`}\nhermes_ref=sha-1\n`,
      BASE_SKILLS
    );
  }
}

beforeEach(() => {
  for (const store of [inserts, upserts, tables]) {
    for (const key of Object.keys(store)) delete store[key];
  }
  boxUpdates.length = 0;
  failBoxUpdate = null;
  stampTemplate("", []);
  fork.mockClear();
  createMacInstance.mockClear();
  installComposioMcp.mockClear();
  installBaseSkills.mockReset();
  vi.mocked(boxClient.waitForBox)
    .mockReset()
    .mockResolvedValue({ id: "box-new" } as Awaited<
      ReturnType<typeof boxClient.waitForBox>
    >);
  vi.mocked(boxClient.stop).mockClear();
  vi.mocked(boxClient.deleteBox).mockClear();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("provisionUser environments", () => {
  it("defaults to ubuntu and forks the ubuntu template", async () => {
    const result = await provisionUser();
    expect(result.environment).toBe("ubuntu");
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-ubuntu" })
    );
    expect(createMacInstance).not.toHaveBeenCalled();
    expect(upserts["boxes"]?.[0]).toMatchObject({
      environment: "ubuntu",
      provider: "ascii",
      provider_box_id: "box-new",
    });
    expect(installComposioMcp).toHaveBeenCalled();
  });

  it("explicit ubuntu behaves exactly like the default", async () => {
    const result = await provisionUser({ environment: "ubuntu" });
    expect(result.environment).toBe("ubuntu");
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-ubuntu" })
    );
  });

  it("omarchy forks the registered omarchy template box", async () => {
    tables["box_environment_templates"] = [
      { channel: "prod", environment: "omarchy", template_ref: "template-omarchy" },
    ];
    const result = await provisionUser({ environment: "omarchy" });
    expect(result.environment).toBe("omarchy");
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-omarchy" })
    );
    expect(createMacInstance).not.toHaveBeenCalled();
    expect(upserts["boxes"]?.[0]).toMatchObject({
      environment: "omarchy",
      provider: "ascii",
    });
    expect(installComposioMcp).toHaveBeenCalled();
  });

  it("omarchy with no registered template fails instead of forking ubuntu", async () => {
    await expect(provisionUser({ environment: "omarchy" })).rejects.toThrow(
      /no omarchy template registered/
    );
    expect(fork).not.toHaveBeenCalled();
  });

  it("macos builds a Namespace instance from the bootstrap URL", async () => {
    tables["box_environment_templates"] = [
      {
        channel: "prod",
        environment: "macos",
        template_ref: "https://air.test/mac-bootstrap.sh",
      },
    ];
    const result = await provisionUser({ environment: "macos" });
    expect(result.environment).toBe("macos");
    expect(fork).not.toHaveBeenCalled();
    expect(createMacInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        bootstrapUrl: "https://air.test/mac-bootstrap.sh",
      })
    );
    expect(upserts["boxes"]?.[0]).toMatchObject({
      environment: "macos",
      provider: "namespace",
      provider_box_id: "mac-1",
      control_url: "https://mac-bridge.ns.dev",
    });
    expect(upserts["boxes"]?.[0]?.["control_token"]).toEqual(expect.any(String));
    expect(installComposioMcp).toHaveBeenCalled();
  });
});

describe("provisionUser rollback", () => {
  it("a failed readiness wait destroys the just-forked box", async () => {
    vi.mocked(boxClient.waitForBox).mockRejectedValueOnce(
      new Error("box never became ready")
    );
    await expect(provisionUser()).rejects.toThrow("box never became ready");
    expect(boxClient.stop).toHaveBeenCalledWith("box-new");
    expect(boxClient.deleteBox).toHaveBeenCalledWith("box-new");
    expect(upserts["boxes"]).toBeUndefined();
  });
});

describe("switchEnvironment", () => {
  beforeEach(() => {
    tables["boxes"] = [
      { user_id: "user-1", provider_box_id: "box-old", environment: "ubuntu" },
    ];
  });

  it("repoints the row at the new box, then tears the old one down", async () => {
    const result = await switchEnvironment(fakeSupabase, "user-1", "ubuntu");
    expect(result.boxId).toBe("box-new");
    expect(upserts["boxes"]?.[0]).toMatchObject({
      user_id: "user-1",
      provider_box_id: "box-new",
    });
    expect(boxClient.stop).toHaveBeenCalledWith("box-old");
    expect(boxClient.deleteBox).toHaveBeenCalledWith("box-old");
    expect(boxClient.deleteBox).not.toHaveBeenCalledWith("box-new");
  });

  it("a setup failure after the row moved still retires the old box and names the new one", async () => {
    installBaseSkills.mockRejectedValueOnce(new Error("hub unreachable"));
    const failure = await switchEnvironment(fakeSupabase, "user-1", "ubuntu").catch(
      (error: unknown) => error
    );
    expect(failure).toBeInstanceOf(SwitchSetupError);
    expect((failure as SwitchSetupError).boxId).toBe("box-new");
    expect((failure as Error).message).toMatch(/hub unreachable/);
    expect(upserts["boxes"]?.[0]).toMatchObject({ provider_box_id: "box-new" });
    expect(boxClient.deleteBox).toHaveBeenCalledWith("box-old");
    expect(boxClient.deleteBox).not.toHaveBeenCalledWith("box-new");
  });

  it("a fork that never becomes ready destroys only the new box", async () => {
    vi.mocked(boxClient.waitForBox).mockRejectedValueOnce(new Error("never ready"));
    await expect(switchEnvironment(fakeSupabase, "user-1", "ubuntu")).rejects.toThrow(
      "never ready"
    );
    expect(upserts["boxes"]).toBeUndefined();
    expect(boxClient.deleteBox).toHaveBeenCalledWith("box-new");
    expect(boxClient.deleteBox).not.toHaveBeenCalledWith("box-old");
  });
});

describe("fleet position of a fresh fork", () => {
  it("a fork of unknown provenance installs the hub skills and stays unsynced", async () => {
    await provisionUser();
    expect(installBaseSkills).toHaveBeenCalledTimes(1);
    expect(upserts["boxes"]?.[0]).toMatchObject({
      channel: "prod",
      baseline_version: null,
      baseline_synced_at: null,
      template_version: "sha-1",
    });
  });

  it("a fork stamped with the channel's release and every base skill skips the hub installs and records the baseline", async () => {
    pointChannelAtCurrentRelease("prod");
    await provisionUser();
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "tpl-prod" })
    );
    expect(installBaseSkills).not.toHaveBeenCalled();
    expect(installComposioMcp).toHaveBeenCalled();
    expect(upserts["boxes"]?.[0]).toMatchObject({
      channel: "prod",
      baseline_version: "2026.09.05-prod",
      baseline_synced_at: expect.any(String),
    });
  });

  it("a verified fork still installs the base skills the template failed to bake", async () => {
    pointChannelAtCurrentRelease("prod");
    stampTemplate(
      "version=2026.09.05-prod\ngit_sha=sha-prod\nhermes_ref=sha-1\n",
      ["official/research/duckduckgo-search"]
    );
    await provisionUser();
    expect(installBaseSkills).toHaveBeenCalledTimes(1);
    expect(installBaseSkills).toHaveBeenCalledWith(expect.anything(), [
      "browser-harness",
    ]);
    expect(upserts["boxes"]?.[0]).toMatchObject({
      baseline_version: "2026.09.05-prod",
    });
  });

  it("a matching Hermes ref alone never claims a release: an unstamped template takes the full setup", async () => {
    pointChannelAtCurrentRelease("prod", "sha-1", null);
    await provisionUser();
    expect(installBaseSkills).toHaveBeenCalledTimes(1);
    expect(installBaseSkills).toHaveBeenCalledWith(expect.anything());
    expect(upserts["boxes"]?.[0]).toMatchObject({
      baseline_version: null,
      baseline_synced_at: null,
    });
  });

  it("a template stamped with a different release than the channel points at is not claimed", async () => {
    pointChannelAtCurrentRelease("prod", "sha-1", { version: "2026.09.01-old" });
    await provisionUser();
    expect(installBaseSkills).toHaveBeenCalledTimes(1);
    expect(upserts["boxes"]?.[0]).toMatchObject({ baseline_version: null });
  });

  it("a stamp whose git sha disagrees with the release row is not claimed", async () => {
    pointChannelAtCurrentRelease("prod", "sha-1", { gitSha: "sha-elsewhere" });
    await provisionUser();
    expect(installBaseSkills).toHaveBeenCalledTimes(1);
    expect(upserts["boxes"]?.[0]).toMatchObject({ baseline_version: null });
  });

  it("a release whose Hermes ref the template does not carry is not claimed", async () => {
    pointChannelAtCurrentRelease("prod", "sha-newer");
    await provisionUser();
    expect(installBaseSkills).toHaveBeenCalledTimes(1);
    expect(upserts["boxes"]?.[0]).toMatchObject({
      baseline_version: null,
      baseline_synced_at: null,
    });
  });

  it("a channel with no release yet behaves like unknown provenance", async () => {
    tables["box_channels"] = [
      { name: "prod", release_id: null, template_box_id: "tpl-prod" },
    ];
    await provisionUser();
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "tpl-prod" })
    );
    expect(installBaseSkills).toHaveBeenCalledTimes(1);
    expect(upserts["boxes"]?.[0]).toMatchObject({ baseline_version: null });
  });
});

describe("switchEnvironment keeps the box's channel", () => {
  it("a dev box is rebuilt from the dev template and stays on dev", async () => {
    tables["boxes"] = [
      {
        user_id: "user-1",
        provider_box_id: "box-old",
        environment: "ubuntu",
        channel: "dev",
      },
    ];
    pointChannelAtCurrentRelease("prod", "sha-other");
    pointChannelAtCurrentRelease("dev");
    await switchEnvironment(fakeSupabase, "user-1", "ubuntu");
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "tpl-dev" })
    );
    expect(upserts["boxes"]?.[0]).toMatchObject({
      provider_box_id: "box-new",
      channel: "dev",
      baseline_version: "2026.09.05-dev",
    });
    expect(installBaseSkills).not.toHaveBeenCalled();
  });

  it("a row without a channel falls back to prod", async () => {
    tables["boxes"] = [
      { user_id: "user-1", provider_box_id: "box-old", environment: "ubuntu" },
    ];
    pointChannelAtCurrentRelease("prod");
    await switchEnvironment(fakeSupabase, "user-1", "ubuntu");
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "tpl-prod" })
    );
    expect(upserts["boxes"]?.[0]).toMatchObject({ channel: "prod" });
  });
});

describe("replaceBox", () => {
  const claimUpdates = () =>
    boxUpdates.filter((u) => typeof u.values["replace_claimed_at"] === "string");
  const releaseUpdates = () =>
    boxUpdates.filter((u) => u.values["replace_claimed_at"] === null);
  const boxRow = () => tables["boxes"]?.[0] as Row;

  beforeEach(() => {
    tables["boxes"] = [
      {
        user_id: "user-1",
        provider_box_id: "box-old",
        environment: "ubuntu",
        replace_claimed_at: null,
      },
    ];
  });

  it("claims the row on the named box, rebuilds, then releases only its own claim", async () => {
    const result = await replaceBox(fakeSupabase, "user-1", "box-old", "ubuntu");
    expect(result.boxId).toBe("box-new");
    expect(claimUpdates()).toHaveLength(1);
    expect(claimUpdates()[0]?.filters).toEqual(
      expect.arrayContaining([
        "user_id=eq.user-1",
        "provider_box_id=eq.box-old",
        expect.stringMatching(/^or\(replace_claimed_at\.is\.null,replace_claimed_at\.lt\./),
      ])
    );
    expect(releaseUpdates()).toHaveLength(1);
    expect(releaseUpdates()[0]?.filters).toEqual(
      expect.arrayContaining([
        "user_id=eq.user-1",
        expect.stringMatching(/^replace_claimed_at=eq\.\d{4}-/),
      ])
    );
    expect(boxRow()["replace_claimed_at"]).toBeNull();
    expect(boxClient.deleteBox).toHaveBeenCalledWith("box-old");
  });

  it("a live claim held by another call is a ReplaceInProgressError and forks nothing", async () => {
    const live = new Date(Date.now() - 60_000).toISOString();
    boxRow()["replace_claimed_at"] = live;
    await expect(
      replaceBox(fakeSupabase, "user-1", "box-old", "ubuntu")
    ).rejects.toBeInstanceOf(ReplaceInProgressError);
    expect(fork).not.toHaveBeenCalled();
    expect(boxRow()["replace_claimed_at"]).toBe(live);
    expect(releaseUpdates()).toHaveLength(0);
  });

  it("a claim as old as the longest caller budget is still live", async () => {
    const live = new Date(
      Date.now() - (LONGEST_REPLACE_CALLER_SECONDS * 1000 - 5_000)
    ).toISOString();
    boxRow()["replace_claimed_at"] = live;
    await expect(
      replaceBox(fakeSupabase, "user-1", "box-old", "ubuntu")
    ).rejects.toBeInstanceOf(ReplaceInProgressError);
    expect(fork).not.toHaveBeenCalled();
    expect(boxRow()["replace_claimed_at"]).toBe(live);
  });

  it("a claim older than any request could still hold is taken over", async () => {
    boxRow()["replace_claimed_at"] = new Date(
      Date.now() - REPLACE_CLAIM_TTL_MS - 60_000
    ).toISOString();
    const result = await replaceBox(fakeSupabase, "user-1", "box-old", "ubuntu");
    expect(result.boxId).toBe("box-new");
    expect(fork).toHaveBeenCalledTimes(1);
    expect(boxRow()["replace_claimed_at"]).toBeNull();
  });

  it("naming a box the row has moved on from forks nothing", async () => {
    await expect(
      replaceBox(fakeSupabase, "user-1", "box-stale", "ubuntu")
    ).rejects.toBeInstanceOf(ReplaceInProgressError);
    expect(fork).not.toHaveBeenCalled();
    expect(boxRow()["replace_claimed_at"]).toBeNull();
  });

  it("a fork failure releases the claim and rethrows", async () => {
    vi.mocked(boxClient.waitForBox).mockRejectedValueOnce(new Error("never ready"));
    await expect(
      replaceBox(fakeSupabase, "user-1", "box-old", "ubuntu")
    ).rejects.toThrow("never ready");
    expect(boxRow()["replace_claimed_at"]).toBeNull();
    expect(releaseUpdates()).toHaveLength(1);
  });

  it("a setup failure after the row moved still surfaces as SwitchSetupError with the claim released", async () => {
    installBaseSkills.mockRejectedValueOnce(new Error("hub unreachable"));
    const failure = await replaceBox(
      fakeSupabase,
      "user-1",
      "box-old",
      "ubuntu"
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SwitchSetupError);
    expect(boxRow()["replace_claimed_at"]).toBeNull();
  });

  it("a failed claim release never masks the switch's own outcome", async () => {
    failBoxUpdate = {
      when: (values) => values["replace_claimed_at"] === null,
      message: "connection reset",
    };
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await replaceBox(fakeSupabase, "user-1", "box-old", "ubuntu");
    expect(result.boxId).toBe("box-new");

    installBaseSkills.mockRejectedValueOnce(new Error("hub unreachable"));
    boxRow()["replace_claimed_at"] = null;
    const failure = await replaceBox(
      fakeSupabase,
      "user-1",
      "box-old",
      "ubuntu"
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SwitchSetupError);

    const releaseFailures = errorLog.mock.calls.filter((call) =>
      String(call[0]).includes("replace claim release failed")
    );
    expect(releaseFailures).toHaveLength(2);
    errorLog.mockRestore();
  });
});

describe("provisionUser bound_phone normalization (P1-8)", () => {
  it("stores bound_phone / handle / sender in canonical form and rolls back", async () => {
    fork.mockRejectedValueOnce(new Error("fork unavailable in test"));
    await expect(
      provisionUser({ boundPhone: "+1 (415) 555-0123" })
    ).rejects.toThrow("fork unavailable in test");

    expect(inserts["provisioning"]?.[0]).toMatchObject({
      bound_phone: "+14155550123",
    });
    expect(inserts["handles"]?.[0]).toMatchObject({
      platform: "imessage",
      address: "+14155550123",
    });
    expect(inserts["senders"]?.[0]).toMatchObject({
      platform: "imessage",
      address: "+14155550123",
      trust_tier: 0,
    });
    expect(upserts["boxes"]).toBeUndefined();
  });
});
