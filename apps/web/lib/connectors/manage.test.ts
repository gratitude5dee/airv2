/**
 * Connector sync lifecycle: a completed hosted Connect Link flips the mirror
 * row active (and installs the MCP endpoint once), while a Connect Link that
 * died before authorization (EXPIRED/FAILED at Composio) flips its pending
 * row back to revoked so the UI offers a fresh Connect instead of an
 * eternal "pending".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectedAccount } from "../composio/client";
import { FakeSupabase, type Row } from "../testing/fakeSupabase";

const listAllConnectedAccounts = vi.fn(
  async (): Promise<ConnectedAccount[]> => []
);
vi.mock("../composio/client", () => ({
  ComposioApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  createLinkSession: vi.fn(),
  deleteConnectedAccount: vi.fn(),
  listAllConnectedAccounts: (...args: unknown[]) =>
    listAllConnectedAccounts(...(args as [])),
}));

const installComposioMcp = vi.fn(async () => undefined);
const writeConnectedToolsFile = vi.fn(async () => undefined);
vi.mock("../provisioning/connectors", () => ({
  ensureComposioSession: vi.fn(),
  installComposioMcp: (...args: unknown[]) =>
    installComposioMcp(...(args as [])),
  writeConnectedToolsFile: (...args: unknown[]) =>
    writeConnectedToolsFile(...(args as [])),
}));

import { syncConnections } from "./manage";

const db = new FakeSupabase();

function makeSupabase(rows: Row[]): SupabaseClient {
  // user_id is the tenant filter the code narrows on — it must exist on the
  // seeded rows or the blind read silently returns everything.
  db.tables["connections"] = rows.map((row) => ({
    user_id: "user-1",
    provider: "composio",
    ...row,
  }));
  return db.client();
}

const updates = () => db.updates.filter((u) => u.table === "connections");

beforeEach(() => {
  db.reset();
  listAllConnectedAccounts.mockClear();
  installComposioMcp.mockClear();
  writeConnectedToolsFile.mockClear();
});

describe("syncConnections", () => {
  it("activates a pending row whose account is ACTIVE and installs MCP", async () => {
    listAllConnectedAccounts.mockResolvedValueOnce([
      { id: "ca_new", toolkit: { slug: "gmail" }, status: "ACTIVE" },
    ]);
    const supabase = makeSupabase([
      {
        id: "row-1",
        toolkit: "gmail",
        status: "pending",
        external_account_id: "ca_new",
      },
    ]);
    await syncConnections(supabase, "user-1");
    expect(updates()).toHaveLength(1);
    expect(updates()[0]?.patch).toMatchObject({
      status: "active",
      external_account_id: "ca_new",
    });
    expect(db.rows("connections")[0]?.["status"]).toBe("active");
    expect(installComposioMcp).toHaveBeenCalledTimes(1);
    expect(writeConnectedToolsFile).toHaveBeenCalledTimes(1);
  });

  it("marks a pending row revoked when its Connect Link expired", async () => {
    listAllConnectedAccounts.mockResolvedValueOnce([
      { id: "ca_dead", toolkit: { slug: "gmail" }, status: "EXPIRED" },
    ]);
    const supabase = makeSupabase([
      {
        id: "row-1",
        toolkit: "gmail",
        status: "pending",
        external_account_id: "ca_dead",
      },
    ]);
    await syncConnections(supabase, "user-1");
    expect(updates()).toEqual([
      { table: "connections", patch: { status: "revoked" } },
    ]);
    expect(db.rows("connections")[0]?.["status"]).toBe("revoked");
    expect(installComposioMcp).not.toHaveBeenCalled();
    expect(writeConnectedToolsFile).toHaveBeenCalledTimes(1);
  });

  it("marks a pending row revoked when its account no longer exists", async () => {
    listAllConnectedAccounts.mockResolvedValueOnce([]);
    const supabase = makeSupabase([
      {
        id: "row-1",
        toolkit: "gmail",
        status: "pending",
        external_account_id: "ca_gone",
      },
    ]);
    await syncConnections(supabase, "user-1");
    expect(updates()).toEqual([
      { table: "connections", patch: { status: "revoked" } },
    ]);
  });

  it("keeps a pending row whose Connect Link is still INITIATED", async () => {
    listAllConnectedAccounts.mockResolvedValueOnce([
      { id: "ca_live", toolkit: { slug: "gmail" }, status: "INITIATED" },
    ]);
    const supabase = makeSupabase([
      {
        id: "row-1",
        toolkit: "gmail",
        status: "pending",
        external_account_id: "ca_live",
      },
    ]);
    await syncConnections(supabase, "user-1");
    expect(updates()).toHaveLength(0);
  });

  it("keeps a pending row whose Connect Link is still INITIALIZING", async () => {
    listAllConnectedAccounts.mockResolvedValueOnce([
      { id: "ca_fresh", toolkit: { slug: "gmail" }, status: "INITIALIZING" },
    ]);
    const supabase = makeSupabase([
      {
        id: "row-1",
        toolkit: "gmail",
        status: "pending",
        external_account_id: "ca_fresh",
      },
    ]);
    await syncConnections(supabase, "user-1");
    expect(updates()).toHaveLength(0);
    expect(writeConnectedToolsFile).not.toHaveBeenCalled();
  });

  it("does not activate from a non-ACTIVE account status", async () => {
    listAllConnectedAccounts.mockResolvedValueOnce([
      { id: "ca_x", toolkit: { slug: "gmail" }, status: "FAILED" },
    ]);
    const supabase = makeSupabase([
      {
        id: "row-1",
        toolkit: "gmail",
        status: "revoked",
        external_account_id: "ca_x",
      },
    ]);
    await syncConnections(supabase, "user-1");
    expect(updates()).toHaveLength(0);
    expect(installComposioMcp).not.toHaveBeenCalled();
  });
});
