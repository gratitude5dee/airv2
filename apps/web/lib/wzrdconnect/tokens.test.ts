/**
 * R-CONN-01: per-user runtime-token lifecycle — ensure mints one token per
 * user starting from the deny-all placeholder grant (empty = unrestricted
 * upstream), grant merges connection ids into the live policy, revoke
 * re-seeds the placeholder rather than ever storing an empty list.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabase } from "../testing/fakeSupabase";

const createRuntimeToken = vi.fn(async (...args: unknown[]) => ({
  token: `oct_${String(args[0])}`,
  record: { id: `tok-${String(args[0])}`, name: args[0] },
}));
const listRuntimeTokens = vi.fn(
  async (): Promise<
    Array<{
      id: string;
      allowedConnections?: string[];
      allowedActions?: string[];
      blockedActions?: string[];
      allowedProxies?: string[];
      allowedTriggers?: string[];
    }>
  > => []
);
const updateRuntimeToken = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("./client", () => ({
  createRuntimeToken: (...args: unknown[]) => createRuntimeToken(...args),
  listRuntimeTokens: () => listRuntimeTokens(),
  updateRuntimeToken: (...args: unknown[]) => updateRuntimeToken(...args),
}));

import {
  ensureWzrdConnectToken,
  grantWzrdConnection,
  revokeWzrdConnection,
} from "./tokens";

const db = new FakeSupabase();

function makeSupabase(user?: Record<string, unknown>): SupabaseClient {
  db.tables["users"] = [{ id: "user-1", ...user }];
  return db.client();
}

beforeEach(() => {
  db.reset();
  createRuntimeToken.mockClear();
  listRuntimeTokens.mockClear();
  updateRuntimeToken.mockClear();
});

describe("ensureWzrdConnectToken", () => {
  it("returns the stored token without re-minting", async () => {
    const supabase = makeSupabase({
      wzrd_connect_token: "oct_existing",
      wzrd_connect_token_id: "tok-1",
    });
    const result = await ensureWzrdConnectToken(supabase, "user-1");
    expect(result).toEqual({ token: "oct_existing", tokenId: "tok-1" });
    expect(createRuntimeToken).not.toHaveBeenCalled();
  });

  it("mints a token starting from the deny-all placeholder grant", async () => {
    const supabase = makeSupabase();
    const result = await ensureWzrdConnectToken(supabase, "user-1");
    expect(result.token).toBe("oct_air-user-1");
    expect(createRuntimeToken).toHaveBeenCalledWith("air-user-1", {
      allowedConnections: ["__ungranted__"],
    });
    expect(db.rows("users")[0]).toMatchObject({
      wzrd_connect_token: "oct_air-user-1",
      wzrd_connect_token_id: "tok-air-user-1",
    });
  });
});

describe("grantWzrdConnection", () => {
  it("merges the app id into the live policy, dropping the placeholder", async () => {
    const supabase = makeSupabase({
      wzrd_connect_token: "oct_1",
      wzrd_connect_token_id: "tok-1",
    });
    listRuntimeTokens.mockResolvedValueOnce([
      { id: "tok-1", allowedConnections: ["__ungranted__"] },
    ]);
    await grantWzrdConnection(supabase, "user-1", "app-1");
    // PUT replaces the whole policy upstream — every list ships back.
    expect(updateRuntimeToken).toHaveBeenCalledWith("tok-1", {
      allowedConnections: ["app-1"],
      allowedActions: [],
      blockedActions: [],
      allowedProxies: [],
      allowedTriggers: [],
    });
  });

  it("keeps existing grants and other policy lists when adding another", async () => {
    const supabase = makeSupabase({
      wzrd_connect_token: "oct_1",
      wzrd_connect_token_id: "tok-1",
    });
    listRuntimeTokens.mockResolvedValueOnce([
      {
        id: "tok-1",
        allowedConnections: ["app-1"],
        blockedActions: ["dangerous.*"],
        allowedProxies: ["github"],
      },
    ]);
    await grantWzrdConnection(supabase, "user-1", "app-2");
    expect(updateRuntimeToken).toHaveBeenCalledWith("tok-1", {
      allowedConnections: ["app-1", "app-2"],
      allowedActions: [],
      blockedActions: ["dangerous.*"],
      allowedProxies: ["github"],
      allowedTriggers: [],
    });
  });

  it("is a no-op when the grant already exists", async () => {
    const supabase = makeSupabase({
      wzrd_connect_token: "oct_1",
      wzrd_connect_token_id: "tok-1",
    });
    listRuntimeTokens.mockResolvedValueOnce([
      { id: "tok-1", allowedConnections: ["app-1"] },
    ]);
    await grantWzrdConnection(supabase, "user-1", "app-1");
    expect(updateRuntimeToken).not.toHaveBeenCalled();
  });
});

describe("revokeWzrdConnection", () => {
  it("removes the grant but keeps siblings", async () => {
    const supabase = makeSupabase({ wzrd_connect_token_id: "tok-1" });
    listRuntimeTokens.mockResolvedValueOnce([
      { id: "tok-1", allowedConnections: ["app-1", "app-2"] },
    ]);
    await revokeWzrdConnection(supabase, "user-1", "app-1");
    expect(updateRuntimeToken).toHaveBeenCalledWith("tok-1", {
      allowedConnections: ["app-2"],
      allowedActions: [],
      blockedActions: [],
      allowedProxies: [],
      allowedTriggers: [],
    });
  });

  it("re-seeds the placeholder instead of storing an empty list", async () => {
    const supabase = makeSupabase({ wzrd_connect_token_id: "tok-1" });
    listRuntimeTokens.mockResolvedValueOnce([
      { id: "tok-1", allowedConnections: ["app-1"] },
    ]);
    await revokeWzrdConnection(supabase, "user-1", "app-1");
    // An empty allowedConnections means UNRESTRICTED upstream — the
    // placeholder keeps the token deny-all.
    expect(updateRuntimeToken).toHaveBeenCalledWith("tok-1", {
      allowedConnections: ["__ungranted__"],
      allowedActions: [],
      blockedActions: [],
      allowedProxies: [],
      allowedTriggers: [],
    });
  });

  it("does nothing for a user with no token", async () => {
    const supabase = makeSupabase();
    await revokeWzrdConnection(supabase, "user-1", "app-1");
    expect(updateRuntimeToken).not.toHaveBeenCalled();
  });
});
