/**
 * Box replacement contract: bearer auth, user_id + box_id are required, a
 * user with no box is a 404, a box_id that no longer matches the row is a
 * 409, the row is claimed (replace_claimed_at) before the fork so an
 * overlapping call is a 409 while a claim old enough to be dead is taken
 * over, and an existing box is rebuilt in its own environment (falling back
 * to the default when the row predates the column). The claim is released on
 * every exit; a setup failure after the row moved reports the new box.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type BoxRow = {
  user_id: string;
  provider_box_id: string;
  environment: string | null;
  state: string;
  replace_claimed_at: string | null;
};

const db = vi.hoisted(() => ({
  box: null as BoxRow | null,
  error: null as { message: string } | null,
  updates: [] as Array<{
    values: Record<string, unknown>;
    filters: string[];
  }>,
}));

const switchEnvironment = vi.hoisted(() => vi.fn());
const SwitchSetupError = vi.hoisted(
  () =>
    class SwitchSetupError extends Error {
      constructor(readonly boxId: string) {
        super(`box ${boxId} is live but its setup failed: skills`);
      }
    },
);

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: () => {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      const described: string[] = [];
      let pending: Record<string, unknown> | null = null;
      const chain: Record<string, unknown> = {};
      const applyUpdate = () => {
        if (!pending) return [];
        const row = db.box as unknown as Record<string, unknown> | null;
        db.updates.push({ values: pending, filters: [...described] });
        if (row && filters.every((f) => f(row))) {
          Object.assign(row, pending);
          return [{ provider_box_id: row["provider_box_id"] }];
        }
        return [];
      };
      chain["select"] = vi.fn(() => {
        if (pending) {
          return Promise.resolve({ data: applyUpdate(), error: null });
        }
        return chain;
      });
      chain["update"] = vi.fn((values: Record<string, unknown>) => {
        pending = values;
        return chain;
      });
      chain["eq"] = vi.fn((col: string, value: unknown) => {
        described.push(`${col}=eq.${String(value)}`);
        filters.push((row) => row[col] === value);
        return chain;
      });
      chain["or"] = vi.fn((clause: string) => {
        described.push(`or(${clause})`);
        const terms = clause.split(",").map((term) => {
          const [col, op, ...rest] = term.split(".");
          const value = rest.join(".");
          return (row: Record<string, unknown>) => {
            const actual = row[col as string];
            if (op === "is" && value === "null") return actual == null;
            if (op === "lt") return actual != null && String(actual) < value;
            throw new Error(`unsupported or() term ${term}`);
          };
        });
        filters.push((row) => terms.some((t) => t(row)));
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

vi.mock("@/lib/provisioning/provision", () => ({
  switchEnvironment,
  SwitchSetupError,
}));

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

const row = (overrides: Partial<BoxRow> = {}): BoxRow => ({
  user_id: "u1",
  provider_box_id: "bx_old",
  environment: "ubuntu",
  state: "ready",
  replace_claimed_at: null,
  ...overrides,
});

const claimUpdates = () =>
  db.updates.filter((u) => typeof u.values["replace_claimed_at"] === "string");
const releaseUpdates = () =>
  db.updates.filter((u) => u.values["replace_claimed_at"] === null);

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
    db.box = row({ provider_box_id: "bx_new" });
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(409);
    expect(switchEnvironment).not.toHaveBeenCalled();
    expect(db.updates).toEqual([]);
  });

  it("409s while another call holds a live claim, whatever state says", async () => {
    const live = new Date(Date.now() - 60_000).toISOString();
    db.box = row({ state: "starting", replace_claimed_at: live });
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "box is already being replaced",
    });
    expect(switchEnvironment).not.toHaveBeenCalled();
    expect(db.box.replace_claimed_at).toBe(live);
  });

  it("takes over a claim older than any request could still hold", async () => {
    const dead = new Date(Date.now() - 11 * 60_000).toISOString();
    db.box = row({ replace_claimed_at: dead });
    switchEnvironment.mockResolvedValue(result("ubuntu"));
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(200);
    expect(switchEnvironment).toHaveBeenCalledTimes(1);
  });

  it("claims the row, rebuilds the box in its own environment, then releases", async () => {
    db.box = row({ environment: "omarchy", state: "idle" });
    switchEnvironment.mockImplementation(async () => {
      expect(db.box?.replace_claimed_at).toEqual(expect.any(String));
      expect(db.box?.state).toBe("idle");
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
    expect(claimUpdates()).toHaveLength(1);
    expect(releaseUpdates()).toHaveLength(1);
    expect(db.box.replace_claimed_at).toBeNull();
  });

  it("only releases its own claim", async () => {
    db.box = row();
    switchEnvironment.mockImplementation(async () => {
      db.box!.replace_claimed_at = "2099-01-01T00:00:00.000Z";
      return result("ubuntu");
    });
    await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(db.box.replace_claimed_at).toBe("2099-01-01T00:00:00.000Z");
    expect(releaseUpdates()[0]?.filters).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^replace_claimed_at=eq\./),
      ]),
    );
  });

  it("falls back to the default environment on a pre-migration row", async () => {
    db.box = row({ environment: null });
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

  it("500s when the fork fails and releases the claim", async () => {
    db.box = row({ state: "stopped" });
    switchEnvironment.mockRejectedValue(new Error("fork failed"));
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fork failed" });
    expect(db.box.state).toBe("stopped");
    expect(db.box.replace_claimed_at).toBeNull();
    expect(releaseUpdates()).toHaveLength(1);
  });

  it("reports the committed box when setup fails after the row moved", async () => {
    db.box = row();
    switchEnvironment.mockImplementation(async () => {
      db.box!.provider_box_id = "bx_new";
      throw new SwitchSetupError("bx_new");
    });
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "box bx_new is live but its setup failed: skills",
      committed: true,
      previous_box_id: "bx_old",
      box_id: "bx_new",
    });
    expect(db.box.replace_claimed_at).toBeNull();
  });
});
