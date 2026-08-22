/**
 * Admin trace receipts contract: bearer auth against ADMIN_API_KEY, param
 * validation, user_id-stamped rows across every user, CSV/JSONL export with
 * the user_id-prefixed stable header, and zero W&B egress without a key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "gte", "lt", "order", "range", "limit"]) {
      chain[method] = vi.fn(self);
    }
    chain.eq = vi.fn((column: string, value: unknown) => {
      db.filters.push([column, value]);
      return chain;
    });
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: db.rows[table] ?? [], error: null }).then(resolve);
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

const fetchSpy = vi.fn(async () => new Response("{}"));
vi.stubGlobal("fetch", fetchSpy);

import { GET } from "./route";
import { RECEIPT_COLUMNS } from "@/lib/traces/receipts";

const base = "https://air.test/api/admin/traces";
const authed = (url = base) =>
  new NextRequest(url, { headers: { authorization: "Bearer admin-key" } });

beforeEach(() => {
  process.env.ADMIN_API_KEY = "admin-key";
  db.rows = {};
  db.filters = [];
  fetchSpy.mockClear();
  delete process.env.WANDB_API_KEY;
});

describe("GET /api/admin/traces", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("rejects unknown formats, bad dates, bad user_id, and bad limits", async () => {
    expect((await GET(authed(`${base}?format=xml`))).status).toBe(400);
    expect((await GET(authed(`${base}?from=nope`))).status).toBe(400);
    expect((await GET(authed(`${base}?user_id=abc`))).status).toBe(400);
    expect((await GET(authed(`${base}?limit=0`))).status).toBe(400);
  });

  it("spans every user by default and stamps each row with its owner", async () => {
    db.rows = {
      agent_runs: [
        {
          user_id: "11111111-1111-4111-8111-111111111111",
          id: "r1",
          started_at: "2026-08-01T00:00:00Z",
          outcome: "ok",
        },
      ],
    };
    const body = (await (await GET(authed())).json()) as {
      user_id: string | null;
      count: number;
      receipts: Array<Record<string, unknown>>;
    };
    expect(body.user_id).toBeNull();
    expect(body.count).toBe(1);
    expect(body.receipts[0]).toMatchObject({
      kind: "agent_run",
      id: "r1",
      user_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(db.filters).toEqual([]);
  });

  it("filters by user_id when given", async () => {
    const userId = "22222222-2222-4222-8222-222222222222";
    await GET(authed(`${base}?user_id=${userId}`));
    expect(db.filters.every(([column]) => column === "user_id")).toBe(true);
    expect(db.filters.map(([, value]) => value)).toContain(userId);
  });

  it("exports CSV with the user_id-prefixed stable header", async () => {
    db.rows = {
      agent_runs: [
        {
          user_id: "33333333-3333-4333-8333-333333333333",
          id: "r1",
          started_at: "2026-08-01T00:00:00Z",
        },
      ],
    };
    const response = await GET(authed(`${base}?format=csv`));
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const [header, first] = (await response.text()).trim().split("\n");
    expect(header).toBe(`user_id,${RECEIPT_COLUMNS.join(",")}`);
    expect(first).toContain("33333333-3333-4333-8333-333333333333");
    expect(first).toContain("agent_run");
  });

  it("exports JSONL with user_id first and stable keys", async () => {
    db.rows = {
      decisions: [
        {
          user_id: "44444444-4444-4444-8444-444444444444",
          id: "d1",
          status: "pending",
          created_at: "2026-08-02T00:00:00Z",
        },
      ],
    };
    const response = await GET(authed(`${base}?format=jsonl`));
    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
    const lines = (await response.text()).trim().split("\n");
    expect(Object.keys(JSON.parse(lines[0] ?? "{}"))).toEqual([
      "user_id",
      ...RECEIPT_COLUMNS,
    ]);
  });

  it("makes zero W&B egress without WANDB_API_KEY", async () => {
    db.rows = {
      agent_runs: [{ user_id: "u", id: "r1", started_at: "2026-08-01T00:00:00Z" }],
    };
    await (await GET(authed(`${base}?format=jsonl`))).text();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
