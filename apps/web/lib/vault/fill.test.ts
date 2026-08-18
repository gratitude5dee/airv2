/**
 * V5 fill transport hygiene (C19/C20): the control plane dispatches
 * `air-vault type` by id/field only, parses nothing but the safe receipt
 * line, audits refusals value-free, and the V6 fill-ticket seam refuses
 * every card fill.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { command } from "../box/client";
import { serviceClient } from "../supabase";
import { typeVaultField, typeVaultTotp } from "./fill";

vi.mock("../box/client", () => ({
  command: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("../supabase", () => ({ serviceClient: vi.fn() }));

const PLANTED = "vlt-web-planted-secret-3fQ9xZ7kW1pY";

interface Row {
  [key: string]: unknown;
}

function fakeSupabase() {
  const inserts: { table: string; row: Row }[] = [];
  const from = (table: string) => ({
    insert: (row: Row) => {
      inserts.push({ table, row });
      return Promise.resolve({ error: null });
    },
  });
  return { client: { from }, inserts };
}

describe("vault browser fill", () => {
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
  });

  it("dispatches by id/field only — the value never rides argv (C19)", async () => {
    vi.mocked(command).mockResolvedValue({
      exitCode: 0,
      stdout: "typed itm-1/password into github.com\n",
      stderr: "",
    });
    const receipt = await typeVaultField("box-1", "user-1", "itm-1", "password");
    expect(receipt).toEqual({
      item_id: "itm-1",
      field: "password",
      host: "github.com",
    });
    const [, cmd] = vi.mocked(command).mock.calls[0]!;
    expect(cmd).toBe("air-vault type itm-1 --field password");
    expect(cmd).not.toContain(PLANTED);
    expect(logs.join("\n")).not.toContain(PLANTED);
    const audit = supabase.inserts.find((e) => e.table === "vault_events");
    expect(JSON.stringify(audit ?? {})).not.toContain(PLANTED);
  });

  it("rejects unsafe argv characters before any box command", async () => {
    await expect(
      typeVaultField("box-1", "user-1", "itm-1; cat /etc/passwd", "password")
    ).rejects.toThrow();
    expect(vi.mocked(command)).not.toHaveBeenCalled();
  });

  it("audits a site-grant refusal value-free and rethrows the code", async () => {
    vi.mocked(command).mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: JSON.stringify({
        error: "site_not_granted",
        message: "host not granted for item",
      }),
    });
    await expect(
      typeVaultField("box-1", "user-1", "itm-1", "password")
    ).rejects.toMatchObject({ code: "site_not_granted" });
    const audit = supabase.inserts.find((e) => e.table === "vault_events");
    expect(audit?.row).toMatchObject({ action: "fill_denied" });
    expect(JSON.stringify(audit?.row)).not.toContain(PLANTED);
  });

  it("card fills without a ticket refuse, box-side (C20)", async () => {
    vi.mocked(command).mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: JSON.stringify({
        error: "fill_ticket_required",
        message: "card fields need a fill ticket",
      }),
    });
    await expect(
      typeVaultField("box-1", "user-1", "card-1", "number")
    ).rejects.toMatchObject({ code: "fill_ticket_required" });
  });

  it("totp typing returns the receipt, never the code", async () => {
    vi.mocked(command).mockResolvedValue({
      exitCode: 0,
      stdout: "typed itm-1/totp into github.com\n",
      stderr: "",
    });
    const receipt = await typeVaultTotp("box-1", "user-1", "itm-1");
    expect(receipt.field).toBe("totp");
    // A 6-digit code must not appear anywhere the model could read.
    expect(JSON.stringify(receipt)).not.toMatch(/\b\d{6}\b/);
    const [, cmd] = vi.mocked(command).mock.calls[0]!;
    expect(cmd).toBe("air-vault totp itm-1 --type");
  });

  it("a stdout without the receipt line is an error, not a passthrough", async () => {
    vi.mocked(command).mockResolvedValue({
      exitCode: 0,
      stdout: `${PLANTED}\n`, // hypothetical bug: CLI echoed a value
      stderr: "",
    });
    await expect(
      typeVaultField("box-1", "user-1", "itm-1", "password")
    ).rejects.toThrow("no receipt");
    // ...and nothing we logged or audited carried it onward.
    expect(logs.join("\n")).not.toContain(PLANTED);
    expect(JSON.stringify(supabase.inserts)).not.toContain(PLANTED);
  });
});
