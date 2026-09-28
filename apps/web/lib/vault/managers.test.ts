/**
 * BYO secret-manager control plane: env merges ride one-shot files through
 * the box files API (never argv), Postgres mirrors value-free summaries, and
 * a failed gateway restart flips the row to error without hiding it. Box I/O
 * is mocked at ../box/client; vault_managers / vault_events run against the
 * shared FakeSupabase.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";
import {
  MANAGER_IDS,
  ManagerInputError,
  disableManager,
  enableManager,
  listManagers,
  mergeBoxEnv,
  refreshManager,
  removeBoxEnvKeys,
  restartGateway,
} from "./managers";

const box = vi.hoisted(() => ({
  command: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("../box/client", () => ({
  command: box.command,
  writeFile: box.writeFile,
}));

const db = new FakeSupabase();
const managerUpserts = () =>
  db.upserts.filter((u) => u.table === "vault_managers").map((u) => u.row);
const eventRows = () =>
  db.inserts.filter((i) => i.table === "vault_events").map((i) => i.row);

const OK = { exitCode: 0, stdout: "", stderr: "" };

beforeEach(() => {
  db.reset();
  box.command.mockReset().mockResolvedValue(OK);
  box.writeFile.mockReset().mockResolvedValue(undefined);
});

describe("mergeBoxEnv", () => {
  it("rejects env keys that are not SCREAMING_CASE names", async () => {
    await expect(
      mergeBoxEnv("box-1", { "bad-key;rm -rf /": "x".repeat(8) })
    ).rejects.toBeInstanceOf(ManagerInputError);
    await expect(
      mergeBoxEnv("box-1", { VALID_KEY: "has\nnewline" })
    ).rejects.toBeInstanceOf(ManagerInputError);
    expect(box.writeFile).not.toHaveBeenCalled();
  });

  it("writes one-shot file, sed-merges into .env, and always shreds", async () => {
    await mergeBoxEnv("box-1", { BWS_ACCESS_TOKEN: "tok-tok-tok" });
    const written = box.writeFile.mock.calls[0]!;
    expect(written[0]).toBe("box-1");
    expect(String(written[1])).toMatch(/^\.hermes\/\.env\.mgr-/);
    expect(written[2]).toBe("BWS_ACCESS_TOKEN=tok-tok-tok\n");
    const mergeCmd = String(box.command.mock.calls[0]![1]);
    expect(mergeCmd).toContain("/^BWS_ACCESS_TOKEN=/d");
    expect(mergeCmd).toContain("chmod 600");
    const cleanup = String(box.command.mock.calls.at(-1)![1]);
    expect(cleanup).toContain("shred -u");
  });

  it("surfaces a failed merge and still runs cleanup", async () => {
    box.command
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "boom" })
      .mockResolvedValueOnce(OK);
    await expect(
      mergeBoxEnv("box-1", { BWS_ACCESS_TOKEN: "tok-tok-tok" })
    ).rejects.toThrow("env merge failed");
    expect(box.command).toHaveBeenCalledTimes(2);
  });
});

describe("removeBoxEnvKeys", () => {
  it("skips the box call when every key is invalid", async () => {
    await removeBoxEnvKeys("box-1", ["not a key", "x=1"]);
    expect(box.command).not.toHaveBeenCalled();
  });
});

describe("restartGateway", () => {
  it("throws the scrubbed stderr on failure", async () => {
    box.command.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "nope" });
    await expect(restartGateway("box-1")).rejects.toThrow(
      "gateway restart failed"
    );
  });
});

describe("listManagers", () => {
  it("returns all three managers, off by default, row fields when present", async () => {
    db.tables["vault_managers"] = [
      {
        user_id: "user-1",
        manager: "onepassword",
        enabled: true,
        status: "configured",
        provenance_count: 7,
        warnings: null,
        last_synced_at: "2026-09-28T00:00:00Z",
      },
    ];
    const list = await listManagers(db.client(), "user-1");
    expect(list.map((m) => m.manager)).toEqual(MANAGER_IDS);
    const op = list.find((m) => m.manager === "onepassword")!;
    expect(op).toMatchObject({
      enabled: true,
      status: "configured",
      provenance_count: 7,
    });
    const bw = list.find((m) => m.manager === "bitwarden")!;
    expect(bw).toMatchObject({ enabled: false, status: "off" });
  });
});

describe("enableManager", () => {
  it("requires a token for bitwarden and validates its format", async () => {
    await expect(
      enableManager(db.client(), "user-1", "box-1", { manager: "bitwarden" })
    ).rejects.toBeInstanceOf(ManagerInputError);
    await expect(
      enableManager(db.client(), "user-1", "box-1", {
        manager: "bitwarden",
        token: "short",
      })
    ).rejects.toBeInstanceOf(ManagerInputError);
  });

  it("requires a helper command for the command manager", async () => {
    await expect(
      enableManager(db.client(), "user-1", "box-1", { manager: "command" })
    ).rejects.toBeInstanceOf(ManagerInputError);
    await expect(
      enableManager(db.client(), "user-1", "box-1", {
        manager: "command",
        helper_command: "x".repeat(1001),
      })
    ).rejects.toBeInstanceOf(ManagerInputError);
  });

  it("rejects mappings with invalid env var names", async () => {
    await expect(
      enableManager(db.client(), "user-1", "box-1", {
        manager: "onepassword",
        token: "valid-token-123",
        mappings: { "bad name": "op://x/y" },
      })
    ).rejects.toBeInstanceOf(ManagerInputError);
  });

  it("merges env, patches config, mirrors a configured row, restarts", async () => {
    box.command.mockResolvedValue({ ...OK, stdout: "onepassword: 12 secrets loaded" });
    const list = await enableManager(db.client(), "user-1", "box-1", {
      manager: "onepassword",
      token: "service-token-12345",
      mappings: { TAVILY_API_KEY: "op://vault/tavily/key" },
    });
    // config patch carried the mapped binding
    const cfgFile = box.writeFile.mock.calls.map((c) => String(c[2]));
    expect(cfgFile.some((c) => c.includes("TAVILY_API_KEY"))).toBe(true);
    // status mirrored configured with parsed provenance count
    expect(
      managerUpserts().some(
        (r) => r["status"] === "configured" && r["provenance_count"] === 12
      )
    ).toBe(true);
    expect(eventRows().some((r) => r["action"] === "manager_enabled")).toBe(
      true
    );
    expect(box.command.mock.calls.some((c) => String(c[1]).includes("systemctl restart"))).toBe(
      true
    );
    expect(list.find((m) => m.manager === "onepassword")).toBeDefined();
  });

  it("marks the row error and rethrows when the gateway restart fails", async () => {
    box.command.mockImplementation((_b: string, cmd: string) =>
      Promise.resolve(
        cmd.includes("systemctl restart")
          ? { exitCode: 1, stdout: "", stderr: "restart boom" }
          : OK
      )
    );
    await expect(
      enableManager(db.client(), "user-1", "box-1", {
        manager: "command",
        helper_command: "echo hi",
      })
    ).rejects.toThrow("gateway restart failed");
    expect(
      managerUpserts().some((r) => r["status"] === "error")
    ).toBe(true);
  });
});

describe("disableManager", () => {
  it("patches config off, strips the env key, and mirrors an off row", async () => {
    const list = await disableManager(db.client(), "user-1", "box-1", "bitwarden");
    const cmds = box.command.mock.calls.map((c) => String(c[1]));
    expect(cmds.some((c) => c.includes("/^BWS_ACCESS_TOKEN=/d"))).toBe(true);
    expect(
      managerUpserts().some(
        (r) => r["status"] === "off" && r["enabled"] === false
      )
    ).toBe(true);
    expect(
      eventRows().some((r) => r["action"] === "manager_disabled")
    ).toBe(true);
    expect(list.every((m) => MANAGER_IDS.includes(m.manager))).toBe(true);
  });

  it("does not touch .env for the command manager", async () => {
    await disableManager(db.client(), "user-1", "box-1", "command");
    const cmds = box.command.mock.calls.map((c) => String(c[1]));
    expect(cmds.some((c) => c.includes("sed -i"))).toBe(false);
  });
});

describe("refreshManager", () => {
  it("parses the journal summary into the mirrored row", async () => {
    box.command.mockResolvedValue({
      exitCode: 0,
      stdout: "bitwarden: 4 secrets resolved\nbitwarden: conflict skipped",
      stderr: "",
    });
    await refreshManager(db.client(), "user-1", "box-1", "bitwarden");
    const row = managerUpserts().at(-1)!;
    expect(row["provenance_count"]).toBe(4);
    expect(String(row["warnings"])).toContain("conflict skipped");
  });
});
