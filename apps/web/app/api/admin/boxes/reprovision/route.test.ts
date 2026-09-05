/**
 * Box replacement contract: bearer auth, user_id + box_id are required, a
 * user with no box is a 404, a box_id that no longer matches the row is a
 * 409, the row is claimed before the fork so an overlapping call is a 409,
 * and an existing box is rebuilt in its own environment (falling back to the
 * default when the row predates the column). A failed fork hands the claim
 * back.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  box: null as {
    user_id: string;
    provider_box_id: string;
    environment: string | null;
    state: string;
  } | null,
  error: null as { message: string } | null,
  updates: [] as Array<{
    values: Record<string, unknown>;
    filters: Array<[string, string, unknown]>;
  }>,
}));

const switchEnvironment = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: () => {
      const filters: Array<[string, string, unknown]> = [];
      let pending: Record<string, unknown> | null = null;
      const chain: Record<string, unknown> = {};
      const applyUpdate = () => {
        if (!pending) return [];
        const row = db.box;
        const matches =
          row !== null &&
          filters.every(([op, col, value]) => {
            const actual = (row as Record<string, unknown>)[col];
            return op === "eq" ? actual === value : actual !== value;
          });
        db.updates.push({ values: pending, filters: [...filters] });
        if (matches && row) {
          Object.assign(row, pending);
          return [{ provider_box_id: row.provider_box_id }];
        }
        return [];
      };
      chain["select"] = vi.fn(() => {
        if (pending) {
          const data = applyUpdate();
          return Promise.resolve({ data, error: null });
        }
        return chain;
      });
      chain["update"] = vi.fn((values: Record<string, unknown>) => {
        pending = values;
        return chain;
      });
      chain["eq"] = vi.fn((col: string, value: unknown) => {
        filters.push(["eq", col, value]);
        return chain;
      });
      chain["neq"] = vi.fn((col: string, value: unknown) => {
        filters.push(["neq", col, value]);
        return chain;
      });
      chain["maybeSingle"] = vi.fn(async () => ({
        data: db.error || !db.box ? null : { ...db.box },
        error: db.error,
      }));
      chain["then"] = (
        resolve: (value: { data: unknown; error: null }) => unknown,
      ) => resolve({ data: applyUpdate(), error: null });
      return chain;
    },
  }),
}));

vi.mock("@/lib/provisioning/provision", () => ({ switchEnvironment }));

import { POST } from "./route";

const base = "https://air.test/api/admin/boxes/reprovision";
const post = (body: unknown, auth = "Bearer admin-key") =>
  new NextRequest(base, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const result = (environment: string) => ({
  userId: "u1",
  boxId: "bx_new",
  hostedUrl: "https://h",
  dashboardUrl: "https://d",
  environment,
});

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.box = null;
  db.error = null;
  db.updates = [];
  switchEnvironment.mockReset();
});

describe("POST /api/admin/boxes/reprovision", () => {
  it("401s without the admin key", async () => {
    expect(
      (await POST(post({ user_id: "u1", box_id: "bx_old" }, "Bearer nope")))
        .status,
    ).toBe(401);
    expect(switchEnvironment).not.toHaveBeenCalled();
  });

  it("400s without a user_id or box_id", async () => {
    expect((await POST(post({ box_id: "bx_old" }))).status).toBe(400);
    expect((await POST(post({ user_id: "u1" }))).status).toBe(400);
    expect(switchEnvironment).not.toHaveBeenCalled();
  });

  it("404s when the user has no box", async () => {
    expect((await POST(post({ user_id: "u1", box_id: "bx_old" }))).status).toBe(
      404,
    );
    expect(switchEnvironment).not.toHaveBeenCalled();
  });

  it("409s when box_id is not the user's current box", async () => {
    db.box = {
      user_id: "u1",
      provider_box_id: "bx_new",
      environment: "ubuntu",
      state: "ready",
    };
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(409);
    expect(switchEnvironment).not.toHaveBeenCalled();
    expect(db.updates).toEqual([]);
  });

  it("409s when the box is already claimed", async () => {
    db.box = {
      user_id: "u1",
      provider_box_id: "bx_old",
      environment: "ubuntu",
      state: "provisioning",
    };
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "box is already being replaced",
    });
    expect(switchEnvironment).not.toHaveBeenCalled();
  });

  it("claims the row, then rebuilds the box in its own environment", async () => {
    db.box = {
      user_id: "u1",
      provider_box_id: "bx_old",
      environment: "omarchy",
      state: "idle",
    };
    switchEnvironment.mockImplementation(async () => {
      expect(db.box?.state).toBe("provisioning");
      return result("omarchy");
    });
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user_id: "u1",
      previous_box_id: "bx_old",
      box_id: "bx_new",
      environment: "omarchy",
    });
    expect(switchEnvironment).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "omarchy",
    );
    expect(db.updates).toHaveLength(1);
  });

  it("falls back to the default environment on a pre-migration row", async () => {
    db.box = {
      user_id: "u1",
      provider_box_id: "bx_old",
      environment: null,
      state: "ready",
    };
    switchEnvironment.mockResolvedValue(result("ubuntu"));
    expect((await POST(post({ user_id: "u1", box_id: "bx_old" }))).status).toBe(
      200,
    );
    expect(switchEnvironment).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "ubuntu",
    );
  });

  it("500s when the rebuild throws and hands the claim back", async () => {
    db.box = {
      user_id: "u1",
      provider_box_id: "bx_old",
      environment: "ubuntu",
      state: "stopped",
    };
    switchEnvironment.mockRejectedValue(new Error("fork failed"));
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fork failed" });
    expect(db.box.state).toBe("stopped");
    expect(db.updates).toHaveLength(2);
  });
});
