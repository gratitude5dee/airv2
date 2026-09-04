/**
 * Admin box usage contract: bearer auth against ADMIN_API_KEY, window
 * validation, per-user box state joined with start/stop and box_seconds, and
 * identity labels (username, phone/handles, provider box id) with a handles
 * read failure degrading to empty handles rather than a 500.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { message: string }>,
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of [
      "select",
      "eq",
      "gte",
      "not",
      "order",
      "range",
      "limit",
    ]) {
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

import { GET } from "./route";

const base = "https://air.test/api/admin/boxes";
const authed = (url = base) =>
  new NextRequest(url, { headers: { authorization: "Bearer admin-key" } });

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.rows = {};
  db.errors = {};
});

describe("GET /api/admin/boxes", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("rejects a bad window", async () => {
    expect((await GET(authed(`${base}?days=0`))).status).toBe(400);
    expect((await GET(authed(`${base}?days=1.5`))).status).toBe(400);
  });

  it("reports box state, wake/stop counts, and box_seconds per user", async () => {
    db.rows = {
      boxes: [
        {
          user_id: "u1",
          provider: "ascii",
          provider_box_id: "bx_one",
          state: "ready",
          channel: "prod",
          template_version: "v9",
          baseline_version: "2026.09.04-ba5b7a5",
          baseline_synced_at: "2026-09-04T19:10:32Z",
          last_active_at: "2026-08-20T00:00:00Z",
          stop_after: null,
          created_at: "2026-08-01T00:00:00Z",
        },
        { user_id: "u2", provider: "ascii", state: "stopped" },
      ],
      box_state_events: [
        { user_id: "u1", state: "ready" },
        { user_id: "u1", state: "keepawake" },
        { user_id: "u1", state: "stopped" },
        { user_id: "u2", state: "ready" },
      ],
      agent_runs: [
        { user_id: "u1", box_seconds: 120 },
        { user_id: "u1", box_seconds: null },
        { user_id: "u2", box_seconds: 30 },
      ],
    };
    const body = (await (await GET(authed(`${base}?days=7`))).json()) as {
      window_days: number;
      totals: {
        boxes: number;
        by_state: Record<string, number>;
        starts: number;
        stops: number;
        box_seconds: number;
      };
      users: Array<Record<string, unknown>>;
    };
    expect(body.window_days).toBe(7);
    expect(body.totals.boxes).toBe(2);
    expect(body.totals.by_state).toEqual({ ready: 1, stopped: 1 });
    expect(body.totals).toMatchObject({
      starts: 3,
      stops: 1,
      box_seconds: 150,
    });
    expect(body.users[0]).toMatchObject({
      user_id: "u1",
      state: "ready",
      provider_box_id: "bx_one",
      channel: "prod",
      template_version: "v9",
      baseline_version: "2026.09.04-ba5b7a5",
      baseline_synced_at: "2026-09-04T19:10:32Z",
      starts: 2,
      stops: 1,
      runs: 2,
      box_seconds: 120,
    });
  });

  it("labels each box with the user's username and verified handles", async () => {
    db.rows = {
      boxes: [
        { user_id: "u1", state: "ready", provider_box_id: "bx_one" },
        { user_id: "u2", state: "stopped", provider_box_id: "bx_two" },
      ],
      users: [
        { id: "u1", username: "gratitude" },
        { id: "u2", username: null },
        { id: "ghost", username: "nobox" },
      ],
      handles: [
        { user_id: "u1", platform: "imessage", address: "+15551234567" },
        { user_id: "u1", platform: "email", address: "gopal@example.com" },
        { user_id: "ghost", platform: "email", address: "orphan@example.com" },
      ],
    };
    const body = (await (await GET(authed())).json()) as {
      users: Array<Record<string, unknown>>;
    };
    expect(body.users).toHaveLength(2);
    expect(body.users.find((row) => row["user_id"] === "u1")).toMatchObject({
      username: "gratitude",
      phone: "+15551234567",
      provider_box_id: "bx_one",
      handles: [
        { platform: "imessage", address: "+15551234567" },
        { platform: "email", address: "gopal@example.com" },
      ],
    });
    expect(body.users.find((row) => row["user_id"] === "u2")).toMatchObject({
      username: null,
      phone: null,
      provider_box_id: "bx_two",
      handles: [],
    });
  });

  it("degrades to empty handles when the handles read fails", async () => {
    db.rows = {
      boxes: [{ user_id: "u1", state: "ready" }],
      users: [{ id: "u1", username: "gratitude" }],
    };
    db.errors = { handles: { message: "boom" } };
    const response = await GET(authed());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users[0]).toMatchObject({
      username: "gratitude",
      phone: null,
      handles: [],
    });
  });

  it("is idempotent — repeated reads return the same snapshot shape", async () => {
    db.rows = { boxes: [{ user_id: "u1", state: "idle" }] };
    const first = (await (await GET(authed())).json()) as { users: unknown[] };
    const second = (await (await GET(authed())).json()) as { users: unknown[] };
    expect(second.users).toEqual(first.users);
  });
});
