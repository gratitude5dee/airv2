/**
 * Provisioning branches per environment: ubuntu (default) and omarchy fork a
 * template box on ascii.dev, macos builds a Namespace instance from the
 * bootstrap URL — and every environment gets the same connector install.
 * P1-8 (bound_phone canonical form) rides on the failing-fork rollback test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
const inserts: Record<string, Row[]> = {};
const upserts: Record<string, Row[]> = {};
/** Rows the fake supabase serves to select().eq()...maybeSingle(). */
const tables: Record<string, Row[]> = {};

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([key, value]) => row[key] === value);
}

function tableApi(table: string) {
  const filters: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = {
    eq(key: string, value: unknown) {
      filters.push([key, value]);
      return builder;
    },
    is() {
      return builder;
    },
    async maybeSingle() {
      const row = (tables[table] ?? []).find((r) => matches(r, filters));
      return { data: row ?? null, error: null };
    },
  };
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
    update: () => ({
      eq: () =>
        Object.assign(Promise.resolve({ error: null }), {
          is: () => ({ select: async () => ({ data: [{ id: "line-1" }], error: null }) }),
          eq: async () => ({ error: null }),
        }),
    }),
    delete: () => ({ eq: async () => ({ error: null }) }),
  };
}

const fakeSupabase = {
  from: (table: string) => tableApi(table),
} as unknown as SupabaseClient;

vi.mock("../supabase", () => ({ serviceClient: () => fakeSupabase }));

const fork = vi.fn(async () => ({ id: "box-new" }));
const boxCommand = vi.fn(async (_id: string, cmd: string) => {
  if (cmd.includes(".template-hermes-ref")) {
    return { exitCode: 0, stdout: "sha-1\n", stderr: "" };
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
vi.mock("../skills/hub", () => ({ installBaseSkills: vi.fn() }));
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

import { provisionUser } from "./provision";
import * as boxClient from "../box/client";

beforeEach(() => {
  for (const store of [inserts, upserts, tables]) {
    for (const key of Object.keys(store)) delete store[key];
  }
  fork.mockClear();
  createMacInstance.mockClear();
  installComposioMcp.mockClear();
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
    expect(upserts.boxes?.[0]).toMatchObject({
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
    tables.box_environment_templates = [
      { channel: "prod", environment: "omarchy", template_ref: "template-omarchy" },
    ];
    const result = await provisionUser({ environment: "omarchy" });
    expect(result.environment).toBe("omarchy");
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-omarchy" })
    );
    expect(createMacInstance).not.toHaveBeenCalled();
    expect(upserts.boxes?.[0]).toMatchObject({
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
    tables.box_environment_templates = [
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
    expect(upserts.boxes?.[0]).toMatchObject({
      environment: "macos",
      provider: "namespace",
      provider_box_id: "mac-1",
      control_url: "https://mac-bridge.ns.dev",
    });
    expect(upserts.boxes?.[0]?.control_token).toEqual(expect.any(String));
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
    expect(upserts.boxes).toBeUndefined();
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
    expect(upserts.boxes).toBeUndefined();
  });
});
