/**
 * R-CONN-01: the same connect/sync/disconnect lifecycle running on WZRD
 * Connect. Pending rows mirror OAuth connection requests — a "connected"
 * request swaps the row's external id to the granted appId, extends the
 * user's runtime-token grant list, and installs the wzrd MCP endpoint;
 * failed/expired/gone requests flip pending rows back to revoked. Rows
 * from the composio side reconcile in the same pass untouched.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabase, type Row } from "../testing/fakeSupabase";

const createOAuthRequest = vi.fn(
  async (options: { service: string; connectionName: string }) => ({
    authorizationUrl: `https://provider.example/authorize?req=${options.service}`,
    connectionRequestId: `cr-${options.service}`,
    status: "initiated",
    expiresAt: "2026-10-05T23:00:00Z",
  })
);
const getConnectionRequest = vi.fn();
const disconnectConnection = vi.fn(async () => undefined);
const listAllConnectedAccounts = vi.fn(async (): Promise<unknown[]> => []);
vi.mock("../wzrdconnect/client", () => ({
  createOAuthRequest: (...args: unknown[]) =>
    createOAuthRequest(
      ...(args as [{ service: string; connectionName: string }])
    ),
  getConnectionRequest: (...args: unknown[]) =>
    getConnectionRequest(...(args as [string])),
  disconnectConnection: (...args: unknown[]) =>
    disconnectConnection(...(args as [never])),
  WzrdConnectApiError: class extends Error {
    status: number;
    constructor(status: number, message: string, _code: string | null = null) {
      super(message);
      this.name = "WzrdConnectApiError";
      this.status = status;
    }
  },
}));
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
  listAllConnectedAccounts: () => listAllConnectedAccounts(),
}));

const grantWzrdConnection = vi.fn(async () => undefined);
const revokeWzrdConnection = vi.fn(async () => undefined);
vi.mock("../wzrdconnect/tokens", () => ({
  grantWzrdConnection: (...args: unknown[]) =>
    grantWzrdConnection(...(args as [never, string, string])),
  revokeWzrdConnection: (...args: unknown[]) =>
    revokeWzrdConnection(...(args as [never, string, string])),
}));

const installComposioMcp = vi.fn(async () => undefined);
const installWzrdConnectMcp = vi.fn(async () => undefined);
const writeConnectedToolsFile = vi.fn(async () => undefined);
vi.mock("../provisioning/connectors", () => ({
  ensureComposioSession: vi.fn(),
  installComposioMcp: (...args: unknown[]) =>
    installComposioMcp(...(args as [])),
  installWzrdConnectMcp: (...args: unknown[]) =>
    installWzrdConnectMcp(...(args as [])),
  writeConnectedToolsFile: (...args: unknown[]) =>
    writeConnectedToolsFile(...(args as [])),
}));

import { beginConnect, disconnectToolkit, syncConnections } from "./manage";

const db = new FakeSupabase();

function makeSupabase(rows: Row[]): SupabaseClient {
  db.tables["connections"] = rows.map((row) => ({ user_id: "user-1", ...row }));
  db.tables["users"] = [{ id: "user-1" }];
  return db.client();
}

const updates = () => db.updates.filter((u) => u.table === "connections");

beforeEach(() => {
  vi.stubEnv("CONNECTOR_PROVIDER", "wzrd");
  db.reset();
  createOAuthRequest.mockClear();
  getConnectionRequest.mockReset();
  disconnectConnection.mockClear();
  grantWzrdConnection.mockClear();
  revokeWzrdConnection.mockClear();
  installComposioMcp.mockClear();
  installWzrdConnectMcp.mockClear();
  writeConnectedToolsFile.mockClear();
});

describe("beginConnect on wzrd", () => {
  it("mints an OAuth request under the deterministic alias and a pending row", async () => {
    const supabase = makeSupabase([]);
    const { redirect_url } = await beginConnect(
      supabase,
      "user-1",
      "gmail",
      "https://air.test/callback"
    );
    expect(createOAuthRequest).toHaveBeenCalledWith({
      service: "gmail",
      connectionName: "air-user-1",
    });
    expect(redirect_url).toBe("https://provider.example/authorize?req=gmail");
    expect(db.rows("connections")[0]).toMatchObject({
      user_id: "user-1",
      provider: "wzrd_connect",
      toolkit: "gmail",
      status: "pending",
      external_account_id: "cr-gmail",
    });
  });

  it("translates tiktok to upstream's tiktok_business service id", async () => {
    const supabase = makeSupabase([]);
    await beginConnect(supabase, "user-1", "tiktok", "https://air.test/cb");
    expect(createOAuthRequest).toHaveBeenCalledWith({
      service: "tiktok_business",
      connectionName: "air-user-1",
    });
    expect(db.rows("connections")[0]?.["toolkit"]).toBe("tiktok");
  });
});

describe("syncConnections on wzrd", () => {
  it("activates a pending row on connected, swaps in appId, grants + installs", async () => {
    getConnectionRequest.mockResolvedValueOnce({
      connectionRequestId: "cr-1",
      status: "connected",
      appId: "app-1",
    });
    const supabase = makeSupabase([
      {
        id: "row-1",
        provider: "wzrd_connect",
        toolkit: "gmail",
        status: "pending",
        external_account_id: "cr-1",
      },
    ]);
    await syncConnections(supabase, "user-1");
    expect(getConnectionRequest).toHaveBeenCalledWith("cr-1");
    expect(updates()[0]?.patch).toMatchObject({
      status: "active",
      external_account_id: "app-1",
    });
    expect(grantWzrdConnection).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "app-1"
    );
    expect(installWzrdConnectMcp).toHaveBeenCalledTimes(1);
    expect(installComposioMcp).not.toHaveBeenCalled();
    expect(writeConnectedToolsFile).toHaveBeenCalledTimes(1);
  });

  it("revokes a pending row whose request failed", async () => {
    getConnectionRequest.mockResolvedValueOnce({
      connectionRequestId: "cr-1",
      status: "failed",
      appId: null,
    });
    const supabase = makeSupabase([
      {
        id: "row-1",
        provider: "wzrd_connect",
        toolkit: "gmail",
        status: "pending",
        external_account_id: "cr-1",
      },
    ]);
    await syncConnections(supabase, "user-1");
    expect(updates()).toEqual([
      { table: "connections", patch: { status: "revoked" } },
    ]);
    expect(installWzrdConnectMcp).not.toHaveBeenCalled();
  });

  it("leaves an in-flight initiated request pending", async () => {
    getConnectionRequest.mockResolvedValueOnce({
      connectionRequestId: "cr-1",
      status: "initiated",
      appId: null,
    });
    const supabase = makeSupabase([
      {
        id: "row-1",
        provider: "wzrd_connect",
        toolkit: "gmail",
        status: "pending",
        external_account_id: "cr-1",
      },
    ]);
    await syncConnections(supabase, "user-1");
    expect(updates()).toEqual([]);
    expect(installWzrdConnectMcp).not.toHaveBeenCalled();
  });
});

describe("disconnectToolkit on wzrd", () => {
  it("revokes at the worker by alias and ungrants the token", async () => {
    const supabase = makeSupabase([
      {
        id: "row-1",
        provider: "wzrd_connect",
        toolkit: "gmail",
        status: "active",
        external_account_id: "app-1",
      },
    ]);
    const result = await disconnectToolkit(supabase, "user-1", "gmail");
    expect(result).toBe("ok");
    expect(disconnectConnection).toHaveBeenCalledWith({
      service: "gmail",
      connectionName: "air-user-1",
    });
    expect(revokeWzrdConnection).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "app-1"
    );
    expect(db.rows("connections")[0]?.["status"]).toBe("revoked");
  });

  it("ignores the composio row for the same toolkit", async () => {
    const supabase = makeSupabase([
      {
        id: "row-c",
        provider: "composio",
        toolkit: "gmail",
        status: "active",
        external_account_id: "ca-1",
      },
      {
        id: "row-w",
        provider: "wzrd_connect",
        toolkit: "gmail",
        status: "active",
        external_account_id: "app-1",
      },
    ]);
    await disconnectToolkit(supabase, "user-1", "gmail");
    const composioRow = db
      .rows("connections")
      .find((r) => r["id"] === "row-c");
    const wzrdRow = db.rows("connections").find((r) => r["id"] === "row-w");
    expect(composioRow?.["status"]).toBe("active");
    expect(wzrdRow?.["status"]).toBe("revoked");
  });
});
