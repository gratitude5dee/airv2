/**
 * R-TQ-06: per-field vault reveal. Origin check → session → item ownership
 * against the metadata mirror — only then the box is woken and the secret
 * is read. A 404 must never wake the box.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase, type FakeResult } from "@/lib/testing/fakeSupabase";
import { NextRequest } from "next/server";

const db = new FakeSupabase();
const responses: Record<string, Partial<FakeResult>[]> = {};
// Harness terminal keys: "t:maybeSingle"/"t:single" answer the matching
// single-row terminal (consumed once), "t:rows" an awaited select, and
// "t:always" is the stable fallback. Writes fall through to FakeSupabase.
db.resolve = (q) => {
  if (q.single) {
    return (
      responses[`${q.table}:maybeSingle`]?.shift() ??
      responses[`${q.table}:single`]?.shift() ??
      responses[`${q.table}:always`]?.[0] ??
      { data: null, error: null }
    );
  }
  if (q.mode === "select") {
    return (
      responses[`${q.table}:rows`]?.shift() ??
      responses[`${q.table}:always`]?.[0] ??
      { data: null, error: null }
    );
  }
  return undefined;
};

const isSameOriginRequest = vi.hoisted(() => vi.fn(() => true));
const requestSession = vi.hoisted(() =>
  vi.fn(async () => ({ userId: "user-1" }) as { userId: string } | null)
);
const ensureBoxAwake = vi.hoisted(() => vi.fn(async () => ({ boxId: "box-1" })));
const armStopAfter = vi.hoisted(() => vi.fn(async () => undefined));
const reveal = vi.hoisted(() => vi.fn(async () => "s3cret"));
const totp = vi.hoisted(() => vi.fn(async () => "654321"));

vi.mock("@/lib/supabase", () => ({ serviceClient: () => db.client() }));
vi.mock("@/lib/http/origin", () => ({ isSameOriginRequest }));
vi.mock("@/lib/auth/surface", () => ({ requestSession }));
vi.mock("@/lib/orchestrator/boxes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orchestrator/boxes")>();
  return { ...actual, ensureBoxAwake, armStopAfter };
});
vi.mock("@/lib/vault/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault/client")>();
  return { ...actual, reveal, totp };
});

import { POST } from "./route";

const ITEM_ID = "item.abc123";
const params = Promise.resolve({ id: ITEM_ID });

function post(body: unknown): Promise<Response> {
  return POST(
    new NextRequest(`https://app.example/api/vault/${ITEM_ID}/reveal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.resolve = (q) => {
    if (!q.single) return undefined;
    return (
      responses[`${q.table}:maybeSingle`]?.shift() ??
      responses[`${q.table}:single`]?.shift() ??
      responses[`${q.table}:always`]?.[0] ??
      { data: null, error: null }
    );
  };
  for (const key of Object.keys(responses)) delete responses[key];
  isSameOriginRequest.mockReturnValue(true);
  requestSession.mockResolvedValue({ userId: "user-1" });
  responses["vault_items:always"] = [
    { data: { id: ITEM_ID, kind: "password" }, error: null },
  ];
});

describe("POST /api/vault/[id]/reveal", () => {
  it("rejects cross-origin callers with 403", async () => {
    isSameOriginRequest.mockReturnValue(false);
    const response = await post({ field: "password" });
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(reveal).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers with 401", async () => {
    requestSession.mockResolvedValue(null);
    const response = await post({ field: "password" });
    expect(response.status).toBe(401);
    expect(reveal).not.toHaveBeenCalled();
  });

  it("404s when the item belongs to another user — without waking a box", async () => {
    // The ownership query scopes on user_id; the fake returns no row for
    // this user (wrong owner) → 404 before ensureBoxAwake is touched.
    responses["vault_items:maybeSingle"] = [{ data: null, error: null }];
    const response = await post({ field: "password" });
    expect(response.status).toBe(404);
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(
      db.filters.some(
        (f) => f.table === "vault_items" && f.op === "eq" && f.column === "user_id" && f.value === "user-1"
      )
    ).toBe(true);
  });

  it("rejects a bad item id and an unknown field with 400", async () => {
    const badId = await POST(
      new NextRequest("https://app.example/api/vault/bad%20id/reveal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field: "password" }),
      }),
      { params: Promise.resolve({ id: "bad id" }) }
    );
    expect(badId.status).toBe(400);
    const badField = await post({ field: "card.number;drop" });
    expect(badField.status).toBe(400);
    expect(reveal).not.toHaveBeenCalled();
  });

  it("reveals one field on the happy path and re-arms the box idle stop", async () => {
    const response = await post({ field: "password" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ field: "password", value: "s3cret" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(ensureBoxAwake).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledWith("box-1", "user-1", ITEM_ID, "password", "web");
    expect(armStopAfter).toHaveBeenCalledTimes(1);
  });

  it("returns the ephemeral code for field=totp", async () => {
    const response = await post({ field: "totp" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ field: "totp", value: "654321" });
    expect(totp).toHaveBeenCalledTimes(1);
    expect(reveal).not.toHaveBeenCalled();
  });
});
