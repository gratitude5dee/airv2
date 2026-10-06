/**
 * `GET /api/admin/logs` (R-LOGS-01): one merged, newest-first event stream
 * over ops_events + miniapp_gate_events. Bearer auth, `source`, `kind`,
 * `app` (gate rows via the mini_apps join, ops rows via `ref`), `before`
 * cursor and `limit` cap — every row reduced to metadata (C4/L4).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const db = vi.hoisted(() => ({
  fake: null as unknown as { client(): unknown },
}));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => db.fake.client() }));

import { GET } from "./route";

const base = "https://air.test/api/admin/logs";
const authed = (qs = "") =>
  new NextRequest(`${base}${qs}`, {
    headers: {
      authorization: "Bearer admin-key",
      "x-admin-operator": "carol",
    },
  });
const USER = "6f27a9f0-1234-4000-8000-0000000000aa";

let fake: FakeSupabase;

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  fake = new FakeSupabase();
  fake.embeds["miniapp_gate_events"] = {
    mini_apps: (row) => ({ slug: `slug-${String(row["app_id"])}` }),
  };
  db.fake = fake;
});

describe("GET /api/admin/logs", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("400s on a bad source, user_id, or cursor", async () => {
    expect((await GET(authed("?source=nope"))).status).toBe(400);
    expect((await GET(authed("?user_id=not-a-uuid"))).status).toBe(400);
    expect((await GET(authed("?before=whenever"))).status).toBe(400);
  });

  it("merges both sources newest-first and maps each row to metadata", async () => {
    fake.tables["ops_events"] = [
      { id: "o1", created_at: "2026-10-05T10:00:00Z", kind: "app_opened", user_id: USER, ref: "alice-notes", bytes: 12 },
      { id: "o2", created_at: "2026-10-05T12:00:00Z", kind: "dev_release", user_id: USER, ref: "alice-notes", bytes: null },
    ];
    fake.tables["miniapp_gate_events"] = [
      { id: "g1", created_at: "2026-10-05T11:00:00Z", kind: "app_opened", user_id: USER, ref: "owner", app_id: "a1" },
    ];
    const response = await GET(authed());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.events.map((e: { ts: string }) => e.ts)).toEqual([
      "2026-10-05T12:00:00Z",
      "2026-10-05T11:00:00Z",
      "2026-10-05T10:00:00Z",
    ]);
    expect(body.events[1]).toEqual({
      ts: "2026-10-05T11:00:00Z",
      source: "gate",
      kind: "app_opened",
      app_slug: "slug-a1",
      user_id: USER,
      ref: "owner",
      bytes: null,
    });
  });

  it("filters by source, kind and user", async () => {
    fake.tables["ops_events"] = [
      { id: "o1", created_at: "2026-10-05T10:00:00Z", kind: "app_opened", user_id: USER, ref: "a", bytes: 1 },
    ];
    fake.tables["miniapp_gate_events"] = [
      { id: "g1", created_at: "2026-10-05T11:00:00Z", kind: "gate_challenged", user_id: USER, ref: "token", app_id: "a1" },
    ];
    const response = await GET(authed(`?source=gate&kind=gate_challenged&user_id=${USER}`));
    const body = await response.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].source).toBe("gate");
    expect(
      fake.filters.filter(
        (f) => f.table === "miniapp_gate_events" && f.op === "eq",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: "kind", value: "gate_challenged" }),
        expect.objectContaining({ column: "user_id", value: USER }),
      ]),
    );
    // source=gate never touches ops_events.
    expect(
      fake.queries.filter((q) => q.table === "ops_events"),
    ).toHaveLength(0);
  });

  it("narrows the app filter onto the mini_apps join for gate rows", async () => {
    fake.tables["miniapp_gate_events"] = [
      { id: "g1", created_at: "2026-10-05T11:00:00Z", kind: "app_opened", user_id: USER, ref: "owner", app_id: "a1" },
    ];
    await GET(authed("?app=alice-notes"));
    expect(
      fake.filters.find(
        (f) =>
          f.table === "miniapp_gate_events" && f.column === "mini_apps.slug",
      ),
    ).toEqual(
      expect.objectContaining({ op: "eq", value: "alice-notes" }),
    );
    // The ops side uses ref for the same slug.
    expect(
      fake.filters.find(
        (f) => f.table === "ops_events" && f.column === "ref",
      ),
    ).toEqual(expect.objectContaining({ op: "eq", value: "alice-notes" }));
  });

  it("caps the page and emits a before cursor", async () => {
    fake.tables["ops_events"] = Array.from({ length: 5 }, (_, i) => ({
      id: `o${i}`,
      created_at: `2026-10-05T0${i}:00:00Z`,
      kind: "app_opened",
      user_id: USER,
      ref: "a",
      bytes: 1,
    }));
    const response = await GET(authed("?limit=2"));
    const body = await response.json();
    expect(body.events).toHaveLength(2);
    expect(body.next_before).toBe("2026-10-05T03:00:00Z");
    // The cursor page resumes strictly before the last ts.
    const page2 = await GET(authed(`?limit=2&before=${body.next_before}`));
    const rows = (await page2.json()).events;
    expect(rows.map((e: { ts: string }) => e.ts)).toEqual([
      "2026-10-05T02:00:00Z",
      "2026-10-05T01:00:00Z",
    ]);
  });
});
