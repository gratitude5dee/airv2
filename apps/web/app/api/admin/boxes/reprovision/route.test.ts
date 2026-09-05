/**
 * Box replacement contract: bearer auth, user_id + box_id are required, a
 * user with no box is a 404, a box_id that no longer matches the row is a
 * 409, and the rebuild goes through replaceBox — the shared row lease — with
 * the box named by the caller and the row's own environment (falling back to
 * the default when the row predates the column). A lease held by another
 * call is a 409; a setup failure after the row moved reports the new box.
 * The lease mechanics themselves are covered in lib/provisioning.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type BoxRow = {
  user_id: string;
  provider_box_id: string;
  environment: string | null;
  state: string;
};

const db = vi.hoisted(() => ({
  box: null as BoxRow | null,
  error: null as { message: string } | null,
}));

const replaceBox = vi.hoisted(() => vi.fn());
const SwitchSetupError = vi.hoisted(
  () =>
    class SwitchSetupError extends Error {
      constructor(readonly boxId: string) {
        super(`box ${boxId} is live but its setup failed: skills`);
      }
    },
);
const ReplaceInProgressError = vi.hoisted(
  () =>
    class ReplaceInProgressError extends Error {
      constructor(readonly boxId: string) {
        super(`box ${boxId} is already being replaced`);
      }
    },
);

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain["select"] = vi.fn(() => chain);
      chain["eq"] = vi.fn(() => chain);
      chain["maybeSingle"] = vi.fn(async () => ({
        data: db.error || !db.box ? null : { ...db.box },
        error: db.error,
      }));
      return chain;
    },
  }),
}));

vi.mock("@/lib/provisioning/provision", () => ({
  replaceBox,
  SwitchSetupError,
  ReplaceInProgressError,
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
  ...overrides,
});

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.box = null;
  db.error = null;
  replaceBox.mockReset();
});

describe("POST /api/admin/boxes/reprovision", () => {
  it("401s without the admin key", async () => {
    expect(
      (await POST(post({ user_id: "u1", box_id: "bx_old" }, "Bearer nope")))
        .status,
    ).toBe(401);
    expect(replaceBox).not.toHaveBeenCalled();
  });

  it("400s without a user_id or box_id", async () => {
    expect((await POST(post({ box_id: "bx_old" }))).status).toBe(400);
    expect((await POST(post({ user_id: "u1" }))).status).toBe(400);
    expect(replaceBox).not.toHaveBeenCalled();
  });

  it("404s when the user has no box", async () => {
    expect((await POST(post({ user_id: "u1", box_id: "bx_old" }))).status).toBe(
      404,
    );
    expect(replaceBox).not.toHaveBeenCalled();
  });

  it("500s when the box lookup fails", async () => {
    db.error = { message: "db down" };
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
    expect(replaceBox).not.toHaveBeenCalled();
  });

  it("409s when box_id is not the user's current box", async () => {
    db.box = row({ provider_box_id: "bx_new" });
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(409);
    expect(replaceBox).not.toHaveBeenCalled();
  });

  it("409s while another call holds the replacement lease, whatever state says", async () => {
    db.box = row({ state: "starting" });
    replaceBox.mockRejectedValue(new ReplaceInProgressError("bx_old"));
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "box is already being replaced",
    });
  });

  it("rebuilds the named box in its own environment through the lease", async () => {
    db.box = row({ environment: "omarchy", state: "idle" });
    replaceBox.mockResolvedValue(result("omarchy"));
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user_id: "u1",
      previous_box_id: "bx_old",
      box_id: "bx_new",
      environment: "omarchy",
    });
    expect(replaceBox).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "bx_old",
      "omarchy",
    );
  });

  it("falls back to the default environment on a pre-migration row", async () => {
    db.box = row({ environment: null });
    replaceBox.mockResolvedValue(result("ubuntu"));
    expect((await POST(post({ user_id: "u1", box_id: "bx_old" }))).status).toBe(
      200,
    );
    expect(replaceBox).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "bx_old",
      "ubuntu",
    );
  });

  it("500s when the fork fails before the row moves", async () => {
    db.box = row({ state: "stopped" });
    replaceBox.mockRejectedValue(new Error("fork failed"));
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fork failed" });
  });

  it("reports the committed box when setup fails after the row moved", async () => {
    db.box = row();
    replaceBox.mockRejectedValue(new SwitchSetupError("bx_new"));
    const response = await POST(post({ user_id: "u1", box_id: "bx_old" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "box bx_new is live but its setup failed: skills",
      committed: true,
      previous_box_id: "bx_old",
      box_id: "bx_new",
    });
  });
});
