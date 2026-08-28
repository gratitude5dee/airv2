/**
 * Admin onboarding telemetry contract: bearer auth against ADMIN_API_KEY,
 * the step funnel from mirrored states, mirror warm/cold/stale totals, and
 * per-user progress rows joined with the onboarding card send.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ONBOARDING_STEPS } from "@/lib/miniapps/onboarding";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "eq", "gte", "order", "range", "limit"]) {
      chain[method] = vi.fn(self);
    }
    chain["then"] = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: db.rows[table] ?? [], error: null }).then(resolve);
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

import { GET } from "./route";

const base = "https://air.test/api/admin/onboarding";
const authed = () =>
  new NextRequest(base, { headers: { authorization: "Bearer admin-key" } });

function steps(overrides: Record<string, string>): Record<string, string> {
  const all: Record<string, string> = {};
  for (const step of ONBOARDING_STEPS) all[step] = "todo";
  return { ...all, ...overrides };
}

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.rows = {};
});

describe("GET /api/admin/onboarding", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("builds the funnel, totals, and per-user rows from the mirror", async () => {
    const fresh = new Date().toISOString();
    const old = new Date(Date.now() - 3600_000).toISOString();
    const allDone: Record<string, string> = {};
    for (const step of ONBOARDING_STEPS) allDone[step] = "done";
    db.rows = {
      users: [
        { id: "u1", username: "amy", created_at: "2026-01-01" },
        { id: "u2", username: "bob", created_at: "2026-01-02" },
        { id: "u3", username: null, created_at: "2026-01-03" },
      ],
      onboarding_status_mirror: [
        {
          user_id: "u1",
          state: { steps: steps({ welcome: "done", environment: "skipped" }) },
          refreshed_at: fresh,
        },
        { user_id: "u2", state: { steps: allDone }, refreshed_at: old },
      ],
      card_sends: [{ user_id: "u1", sent_at: "2026-02-01T00:00:00Z" }],
    };

    const body = (await (await GET(authed())).json()) as {
      steps: string[];
      totals: Record<string, number>;
      funnel: Record<string, Record<string, number>>;
      users: Array<Record<string, unknown>>;
    };

    expect(body.steps).toEqual([...ONBOARDING_STEPS]);
    expect(body.totals).toEqual({
      users: 3,
      mirrored: 2,
      cold: 1,
      stale: 1,
      completed: 1,
      cards_sent: 1,
    });
    expect(body.funnel["welcome"]).toEqual({ done: 2, skipped: 0, todo: 0 });
    expect(body.funnel["environment"]).toEqual({ done: 1, skipped: 1, todo: 0 });
    expect(body.funnel["username"]).toEqual({ done: 1, skipped: 0, todo: 1 });

    const u1 = body.users.find((row) => row["user_id"] === "u1");
    expect(u1).toMatchObject({
      username: "amy",
      done: 1,
      skipped: 1,
      todo: ONBOARDING_STEPS.length - 2,
      next_step: "username",
      card_sent_at: "2026-02-01T00:00:00Z",
    });
    const u2 = body.users.find((row) => row["user_id"] === "u2");
    expect(u2).toMatchObject({ done: ONBOARDING_STEPS.length, next_step: null });
    const u3 = body.users.find((row) => row["user_id"] === "u3");
    expect(u3).toMatchObject({
      done: 0,
      todo: ONBOARDING_STEPS.length,
      next_step: ONBOARDING_STEPS[0],
      mirror_refreshed_at: null,
      card_sent_at: null,
    });
  });

  it("is idempotent — repeated reads return the same payload", async () => {
    db.rows = {
      users: [{ id: "u1", username: "amy", created_at: "2026-01-01" }],
    };
    const first = await (await GET(authed())).json();
    const second = await (await GET(authed())).json();
    expect(second).toEqual(first);
  });
});
