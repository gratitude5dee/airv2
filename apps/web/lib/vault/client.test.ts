/**
 * V1 transport hygiene: values ride the inbox file (never argv), logs and
 * Postgres writes carry ids/metadata only, and the CLI's machine-readable
 * failures surface as typed errors.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { command, writeFile } from "../box/client";
import { serviceClient } from "../supabase";
import {
  applyBatch,
  listItems,
  reveal,
  totp,
  VaultCliError,
} from "./client";

vi.mock("../box/client", () => ({ command: vi.fn(), writeFile: vi.fn() }));
vi.mock("../supabase", () => ({ serviceClient: vi.fn() }));

const PLANTED = "vlt-web-planted-secret-3fQ9xZ7kW1pY";

function cliOk(stdout: string) {
  return { exitCode: 0, stdout, stderr: "" };
}

interface Row {
  [key: string]: unknown;
}

function fakeSupabase() {
  const inserts: { table: string; row: Row }[] = [];
  const upserts: { table: string; row: Row }[] = [];
  const updates: { table: string; row: Row }[] = [];
  const from = (table: string) => ({
    insert: (row: Row) => {
      inserts.push({ table, row });
      return Promise.resolve({ error: null });
    },
    upsert: (row: Row) => {
      upserts.push({ table, row });
      return Promise.resolve({ error: null });
    },
    update: (row: Row) => ({
      eq: () => ({
        eq: () => {
          updates.push({ table, row });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  });
  return { client: { from }, inserts, upserts, updates };
}

describe("vault control-plane client", () => {
  let logs: string[];
  let supabase: ReturnType<typeof fakeSupabase>;

  beforeEach(() => {
    logs = [];
    supabase = fakeSupabase();
    vi.mocked(serviceClient).mockReturnValue(
      supabase.client as unknown as ReturnType<typeof serviceClient>
    );
    vi.spyOn(console, "log").mockImplementation((line: string) => {
      logs.push(String(line));
    });
    vi.spyOn(console, "error").mockImplementation((line: string) => {
      logs.push(String(line));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(command).mockReset();
    vi.mocked(writeFile).mockReset();
  });

  it("listItems returns metadata and never issues value-bearing argv", async () => {
    vi.mocked(command).mockResolvedValue(
      cliOk(
        JSON.stringify({
          version: 1,
          items: [
            {
              id: "item-1",
              kind: "api_key",
              name: "OpenAI",
              masked: "sk-…1234",
              env_var: "MY_KEY",
              totp_enabled: false,
              created_at: null,
              updated_at: null,
            },
          ],
        })
      )
    );
    const items = await listItems("bx_1");
    expect(items).toHaveLength(1);
    expect(items[0]?.masked).toBe("sk-…1234");
    expect(vi.mocked(command)).toHaveBeenCalledWith(
      "bx_1",
      "air-vault list --masked"
    );
  });

  it("applyBatch sends values via the inbox file, not argv, and mirrors metadata", async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(command)
      .mockResolvedValueOnce(cliOk("")) // mkdir
      .mockResolvedValueOnce(
        cliOk(
          JSON.stringify({
            ok: true,
            results: [
              {
                op: "create",
                id: "item-9",
                status: "created",
                item: {
                  id: "item-9",
                  kind: "api_key",
                  name: "Planted",
                  masked: "vlt…3fQ9",
                  env_var: "PLANTED_VAR",
                  totp_enabled: false,
                  created_at: null,
                  updated_at: null,
                },
              },
            ],
          })
        )
      );

    const results = await applyBatch("bx_1", "user-1", [
      {
        op: "create",
        item: { kind: "api_key", name: "Planted", fields: { value: PLANTED } },
      },
    ]);
    expect(results[0]?.id).toBe("item-9");

    // The value went ONLY into the inbox file body.
    const written = vi.mocked(writeFile).mock.calls[0];
    expect(written?.[1]).toMatch(/^\.hermes\/vault\/\.inbox\/[a-f0-9]{32}\.json$/);
    expect(written?.[2]).toContain(PLANTED);
    for (const call of vi.mocked(command).mock.calls) {
      expect(call[1]).not.toContain(PLANTED);
    }

    // Metadata mirror + audit row, both value-free.
    expect(supabase.upserts).toHaveLength(1);
    expect(supabase.upserts[0]?.table).toBe("vault_items");
    expect(JSON.stringify(supabase.upserts[0])).not.toContain(PLANTED);
    expect(supabase.inserts).toHaveLength(1);
    expect(supabase.inserts[0]?.table).toBe("vault_events");
    expect(supabase.inserts[0]?.row.action).toBe("create");
    expect(JSON.stringify(supabase.inserts[0])).not.toContain(PLANTED);
  });

  it("applyBatch delete tombstones the mirror row and frees env_var", async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(command)
      .mockResolvedValueOnce(cliOk(""))
      .mockResolvedValueOnce(
        cliOk(
          JSON.stringify({
            ok: true,
            results: [{ op: "delete", id: "item-9", status: "deleted" }],
          })
        )
      );
    await applyBatch("bx_1", "user-1", [{ op: "delete", id: "item-9" }]);
    expect(supabase.updates).toHaveLength(1);
    expect(supabase.updates[0]?.row.env_var).toBeNull();
    expect(supabase.updates[0]?.row.deleted_at).toBeTruthy();
    expect(supabase.inserts[0]?.row.action).toBe("delete");
  });

  it("applyBatch never writes the payload when inbox preparation fails", async () => {
    vi.mocked(command).mockResolvedValueOnce({
      exitCode: 1,
      stdout: "",
      stderr: "chmod: permission denied",
    });
    await expect(
      applyBatch("bx_1", "user-1", [
        {
          op: "create",
          item: { kind: "api_key", name: "P", fields: { value: PLANTED } },
        },
      ])
    ).rejects.toMatchObject({ code: "inbox_unavailable" });
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
    expect(vi.mocked(command)).toHaveBeenCalledTimes(1);
  });

  it("applyBatch erases the inbox file when the CLI fails, without values in argv", async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(command)
      .mockResolvedValueOnce(cliOk("")) // mkdir
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: JSON.stringify({ error: "key_missing", message: "no key" }),
      })
      .mockResolvedValueOnce(cliOk("")); // cleanup
    await expect(
      applyBatch("bx_1", "user-1", [
        {
          op: "create",
          item: { kind: "api_key", name: "P", fields: { value: PLANTED } },
        },
      ])
    ).rejects.toMatchObject({ code: "key_missing" });
    const calls = vi.mocked(command).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[2]?.[1]).toMatch(/shred -u .*\.inbox\/[a-f0-9]{32}\.json/);
    for (const call of calls) {
      expect(call[1]).not.toContain(PLANTED);
    }
  });

  it("applyBatch chmods the inbox file to 600 before the CLI reads it", async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(command)
      .mockResolvedValueOnce(cliOk(""))
      .mockResolvedValueOnce(
        cliOk(JSON.stringify({ ok: true, results: [] }))
      );
    await applyBatch("bx_1", "user-1", [{ op: "delete", id: "item-9" }]);
    const apply = vi.mocked(command).mock.calls[1]?.[1];
    expect(apply).toMatch(/^chmod 600 ".*\.inbox\/[a-f0-9]{32}\.json" && air-vault apply /);
  });

  it("applyBatch logs when inbox cleanup exits non-zero", async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(command)
      .mockResolvedValueOnce(cliOk("")) // mkdir
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: JSON.stringify({ error: "key_missing", message: "no key" }),
      })
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "rm: failed" });
    await expect(
      applyBatch("bx_1", "user-1", [{ op: "delete", id: "item-9" }])
    ).rejects.toMatchObject({ code: "key_missing" });
    expect(logs.join("\n")).toContain("vault inbox cleanup failed");
  });

  it("reveal returns the value, audits it, and never logs it", async () => {
    vi.mocked(command).mockResolvedValue(cliOk(PLANTED));
    const value = await reveal("bx_1", "user-1", "item-9", "password", "web");
    expect(value).toBe(PLANTED);
    expect(supabase.inserts[0]?.row.action).toBe("reveal");
    expect(logs.join("\n")).not.toContain(PLANTED);
  });

  it("reveal rejects shell-unsafe ids before any box call", async () => {
    await expect(
      reveal("bx_1", "user-1", "item-9; rm -rf /", "password")
    ).rejects.toBeInstanceOf(VaultCliError);
    expect(vi.mocked(command)).not.toHaveBeenCalled();
  });

  it("totp returns the code and audits as reveal", async () => {
    vi.mocked(command).mockResolvedValue(cliOk("123456\n"));
    await expect(totp("bx_1", "user-1", "item-9")).resolves.toBe("123456");
    expect(supabase.inserts[0]?.row.action).toBe("reveal");
  });

  it("surfaces machine-readable CLI failures as typed errors", async () => {
    vi.mocked(command).mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: JSON.stringify({ error: "item_not_found", message: "no item" }),
    });
    await expect(
      reveal("bx_1", "user-1", "item-9", "password")
    ).rejects.toMatchObject({ code: "item_not_found" });
  });
});
