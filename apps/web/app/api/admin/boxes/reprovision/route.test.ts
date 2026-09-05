/**
 * Box replacement contract: bearer auth, a user_id is required, a user with
 * no box is a 404, and an existing box is rebuilt in its own environment
 * (falling back to the default when the row predates the column).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  box: null as Record<string, unknown> | null,
  error: null as { message: string } | null,
}));

const switchEnvironment = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain["select"] = vi.fn(() => chain);
      chain["eq"] = vi.fn(() => chain);
      chain["maybeSingle"] = vi.fn(async () => ({
        data: db.error ? null : db.box,
        error: db.error,
      }));
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

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.box = null;
  db.error = null;
  switchEnvironment.mockReset();
});

describe("POST /api/admin/boxes/reprovision", () => {
  it("401s without the admin key", async () => {
    expect((await POST(post({ user_id: "u1" }, "Bearer nope"))).status).toBe(
      401,
    );
    expect(switchEnvironment).not.toHaveBeenCalled();
  });

  it("400s without a user_id", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect(switchEnvironment).not.toHaveBeenCalled();
  });

  it("404s when the user has no box", async () => {
    expect((await POST(post({ user_id: "u1" }))).status).toBe(404);
    expect(switchEnvironment).not.toHaveBeenCalled();
  });

  it("rebuilds the box in its own environment", async () => {
    db.box = { provider_box_id: "bx_old", environment: "omarchy" };
    switchEnvironment.mockResolvedValue({
      userId: "u1",
      boxId: "bx_new",
      hostedUrl: "https://h",
      dashboardUrl: "https://d",
      environment: "omarchy",
    });
    const response = await POST(post({ user_id: "u1" }));
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
  });

  it("falls back to the default environment on a pre-migration row", async () => {
    db.box = { provider_box_id: "bx_old", environment: null };
    switchEnvironment.mockResolvedValue({
      userId: "u1",
      boxId: "bx_new",
      hostedUrl: "https://h",
      dashboardUrl: "https://d",
      environment: "ubuntu",
    });
    expect((await POST(post({ user_id: "u1" }))).status).toBe(200);
    expect(switchEnvironment).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "ubuntu",
    );
  });

  it("500s when the rebuild throws", async () => {
    db.box = { provider_box_id: "bx_old", environment: "ubuntu" };
    switchEnvironment.mockRejectedValue(new Error("fork failed"));
    const response = await POST(post({ user_id: "u1" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fork failed" });
  });
});
