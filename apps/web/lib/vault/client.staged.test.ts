/**
 * K196: applyStagedFile applies an agent-staged inbox payload on the box —
 * chmod 600 + `air-vault apply` only, then mirrors metadata + audit events.
 * The path is argv: every segment must be shell-inert.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { command } from "../box/client";
import { serviceClient } from "../supabase";
import { applyStagedFile, VaultCliError } from "./client";

vi.mock("../box/client", () => ({
  command: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("../supabase", () => ({ serviceClient: vi.fn() }));

const STAGED = ".hermes/vault/.inbox/agent-3f9a1c2e-8b7d-4e5f-9a6b-0c1d2e3f4a5b.json";

interface Row {
  [key: string]: unknown;
}

function fakeSupabase() {
  const inserts: { table: string; row: Row }[] = [];
  const upserts: { table: string; row: Row }[] = [];
  const updates: { table: string; patch: Row }[] = [];
  const from = (table: string) => ({
    insert: (row: Row) => {
      inserts.push({ table, row });
      return Promise.resolve({ error: null });
    },
    upsert: (row: Row) => {
      upserts.push({ table, row });
      return Promise.resolve({ error: null });
    },
    update: (patch: Row) => {
      updates.push({ table, patch });
      const eq = () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) });
      return { eq } as unknown as ReturnType<typeof eq>;
    },
  });
  return { client: { from }, inserts, upserts, updates };
}

const APPLY_OK = JSON.stringify({
  results: [
    {
      op: "create",
      id: "item-1",
      status: "created",
      item: {
        id: "item-1",
        kind: "identity",
        name: "passport",
        masked: "****1234",
        env_var: null,
        totp_enabled: false,
      },
    },
  ],
});

describe("applyStagedFile (K196)", () => {
  let supabase: ReturnType<typeof fakeSupabase>;

  beforeEach(() => {
    supabase = fakeSupabase();
    vi.mocked(serviceClient).mockReturnValue(
      supabase.client as unknown as ReturnType<typeof serviceClient>
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(command).mockReset();
  });

  it("chmod 600s then runs air-vault apply on the staged path", async () => {
    vi.mocked(command).mockResolvedValue({
      exitCode: 0,
      stdout: APPLY_OK,
      stderr: "",
    });
    const results = await applyStagedFile("box-1", "user-1", STAGED);
    expect(results).toHaveLength(1);
    const cmdline = vi.mocked(command).mock.calls[0]?.[1] as string;
    expect(cmdline).toContain("chmod 600");
    expect(cmdline).toContain("air-vault apply");
    expect(cmdline).toContain(`/home/user/${STAGED}`);
    // The mirror + audit rows landed metadata-only.
    expect(supabase.upserts[0]).toMatchObject({
      table: "vault_items",
      row: { id: "item-1", user_id: "user-1", kind: "identity" },
    });
    expect(supabase.inserts[0]).toMatchObject({
      table: "vault_events",
      row: { user_id: "user-1", item_id: "item-1", action: "create" },
    });
  });

  it("CLI refusal throws the parsed VaultCliError and mirrors nothing", async () => {
    vi.mocked(command).mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: JSON.stringify({ error: "inbox_corrupt", message: "bad json" }),
    });
    await expect(applyStagedFile("box-1", "user-1", STAGED)).rejects.toMatchObject({
      code: "inbox_corrupt",
    });
    expect(supabase.upserts).toHaveLength(0);
    expect(supabase.inserts).toHaveLength(0);
  });

  it.each([
    ".hermes/vault/.inbox/agent-$(id).json",
    ".hermes/vault/.inbox/agent-a;rm -rf /.json",
    "..\\etc\\passwd",
  ])("rejects shell-active path %s before touching the box", async (ref) => {
    await expect(applyStagedFile("box-1", "user-1", ref)).rejects.toBeInstanceOf(
      VaultCliError
    );
    expect(vi.mocked(command)).not.toHaveBeenCalled();
  });

  it("marks deleted ops' mirror rows deleted instead of upserting", async () => {
    vi.mocked(command).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        results: [{ op: "delete", id: "item-9", status: "deleted" }],
      }),
      stderr: "",
    });
    await applyStagedFile("box-1", "user-1", STAGED);
    expect(supabase.updates[0]).toMatchObject({
      table: "vault_items",
      patch: { env_var: null },
    });
    expect(supabase.updates[0]?.patch["deleted_at"]).toBeTruthy();
    expect(supabase.upserts).toHaveLength(0);
  });
});
