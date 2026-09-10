/**
 * Relabel contract: bearer auth against ADMIN_API_KEY, every box whose owner
 * has a username is renamed `air-<username>`, boxes without a username or a
 * provider id are skipped, and a provider rename failure is counted rather
 * than aborting the run.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { renameBox } from "@/lib/box/client";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { message: string }>,
}));

vi.mock("@/lib/box/client", () => ({ renameBox: vi.fn() }));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "eq", "not", "order", "range", "limit"]) {
      chain[method] = vi.fn(self);
    }
    chain["then"] = (resolve: (value: unknown) => unknown) => {
      const error = db.errors[table] ?? null;
      return Promise.resolve({
        data: error ? null : (db.rows[table] ?? []),
        error,
      }).then(resolve);
    };
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

import { POST } from "./route";

const base = "https://air.test/api/admin/boxes/relabel";
const authed = () =>
  new NextRequest(base, {
    method: "POST",
    headers: { authorization: "Bearer admin-key" },
  });

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.rows = {};
  db.errors = {};
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/admin/boxes/relabel", () => {
  it("401s without the admin key", async () => {
    const response = await POST(new NextRequest(base, { method: "POST" }));
    expect(response.status).toBe(401);
    expect(renameBox).not.toHaveBeenCalled();
  });

  it("renames every box whose owner has a username and skips the rest", async () => {
    db.rows = {
      users: [
        { id: "u1", username: "gratitude" },
        { id: "u2", username: "gopal" },
        { id: "u3", username: null },
      ],
      boxes: [
        { user_id: "u1", provider_box_id: "bx_one" },
        { user_id: "u2", provider_box_id: "tk_two" },
        { user_id: "u3", provider_box_id: "bx_three" },
        { user_id: "u4", provider_box_id: "bx_four" },
        { user_id: "u1", provider_box_id: null },
      ],
    };
    vi.mocked(renameBox).mockResolvedValue({} as never);
    const response = await POST(authed());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      relabeled: 2,
      skipped: 3,
      failed: 0,
      failures: [],
    });
    expect(vi.mocked(renameBox).mock.calls).toEqual([
      ["bx_one", "air-gratitude"],
      ["tk_two", "air-gopal"],
    ]);
  });

  it("counts a provider rename failure and keeps going", async () => {
    db.rows = {
      users: [
        { id: "u1", username: "one" },
        { id: "u2", username: "two" },
      ],
      boxes: [
        { user_id: "u1", provider_box_id: "bx_one" },
        { user_id: "u2", provider_box_id: "bx_two" },
      ],
    };
    vi.mocked(renameBox)
      .mockRejectedValueOnce(new Error("provider 502"))
      .mockResolvedValueOnce({} as never);
    const body = await (await POST(authed())).json();
    expect(body).toEqual({
      relabeled: 1,
      skipped: 0,
      failed: 1,
      failures: [{ provider_box_id: "bx_one", error: "provider 502" }],
    });
    expect(
      vi.mocked(console.error).mock.calls.map(
        (call) => JSON.parse(call[0] as string).msg,
      ),
    ).toEqual(["box rename failed"]);
  });

  it("500s without renaming anything when the user read fails", async () => {
    db.rows = { boxes: [{ user_id: "u1", provider_box_id: "bx_one" }] };
    db.errors = { users: { message: "boom" } };
    const response = await POST(authed());
    expect(response.status).toBe(500);
    expect(renameBox).not.toHaveBeenCalled();
  });
});
