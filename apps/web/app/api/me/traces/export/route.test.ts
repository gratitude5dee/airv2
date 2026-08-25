/**
 * MA9.3 — export route contract: owner session required, deleted users 404,
 * format validation, stable-keyed JSONL / escaped CSV output, transcripts
 * only behind an explicit include on jsonl, and zero W&B egress by default.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ userId: undefined as string | undefined }));
vi.mock("@/lib/auth/user", () => ({
  sessionUserId: () => auth.userId,
}));

const db = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  rows: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "eq", "gte", "lt", "order", "range"]) {
      chain[method] = vi.fn(self);
    }
    chain["maybeSingle"] = async () => ({
      data: table === "users" ? db.user : null,
    });
    chain["then"] = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: db.rows[table] ?? [], error: null }).then(
        resolve
      );
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

const hermes = vi.hoisted(() => ({
  listSessions: vi.fn(async () => [
    { id: "s1", title: "Chat", started_at: 1754006400, last_active: 1754006400 },
  ]),
  sessionMessages: vi.fn(async () => [
    { role: "user", content: "hello agent", created_at: 1754006400 },
  ]),
}));
vi.mock("@/lib/hermes/client", () => hermes);

vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({
    boxId: "box-1",
    target: { baseUrl: "http://box", apiKey: "k" },
  })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));

const fetchSpy = vi.fn(async () => new Response("{}"));
vi.stubGlobal("fetch", fetchSpy);

import { GET } from "./route";
import { RECEIPT_COLUMNS } from "@/lib/traces/receipts";

const base = "https://air.test/api/me/traces/export";

beforeEach(() => {
  auth.userId = "user-1";
  db.user = { id: "user-1" };
  db.rows = {};
  fetchSpy.mockClear();
  delete process.env["WANDB_API_KEY"];
});

describe("GET /api/me/traces/export", () => {
  it("401s without a session", async () => {
    auth.userId = undefined;
    const response = await GET(new NextRequest(base));
    expect(response.status).toBe(401);
  });

  it("404s for a deleted user", async () => {
    db.user = null;
    const response = await GET(new NextRequest(base));
    expect(response.status).toBe(404);
  });

  it("rejects unknown formats and bad dates", async () => {
    expect((await GET(new NextRequest(`${base}?format=xml`))).status).toBe(400);
    expect(
      (await GET(new NextRequest(`${base}?from=not-a-date`))).status
    ).toBe(400);
  });

  it("rejects include=transcripts on csv", async () => {
    const response = await GET(
      new NextRequest(`${base}?format=csv&include=transcripts`)
    );
    expect(response.status).toBe(400);
  });

  it("streams CSV with the stable header", async () => {
    db.rows = {
      agent_runs: [
        {
          id: "r1",
          trigger: "web",
          started_at: "2026-08-01T00:00:00Z",
          outcome: "ok",
        },
      ],
    };
    const response = await GET(new NextRequest(`${base}?format=csv`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const text = await response.text();
    const [header, first] = text.trim().split("\n");
    expect(header).toBe(RECEIPT_COLUMNS.join(","));
    expect(first).toContain("agent_run");
    expect(first).toContain("r1");
  });

  it("streams JSONL with stable keys and no transcripts by default", async () => {
    db.rows = {
      decisions: [
        { id: "d1", kind: "social_post", status: "pending", created_at: "2026-08-02T00:00:00Z" },
      ],
    };
    const response = await GET(new NextRequest(`${base}?format=jsonl`));
    const text = await response.text();
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(Object.keys(JSON.parse(lines[0] ?? "{}"))).toEqual([
      ...RECEIPT_COLUMNS,
    ]);
    expect(text).not.toContain("hello agent");
    expect(hermes.listSessions).not.toHaveBeenCalled();
  });

  it("appends owner transcripts only with include=transcripts", async () => {
    const response = await GET(
      new NextRequest(`${base}?format=jsonl&include=transcripts`)
    );
    const text = await response.text();
    expect(text).toContain('"kind":"transcript_message"');
    expect(text).toContain("hello agent");
  });

  it("makes zero W&B egress without WANDB_API_KEY", async () => {
    db.rows = {
      agent_runs: [{ id: "r1", started_at: "2026-08-01T00:00:00Z" }],
    };
    await (await GET(new NextRequest(`${base}?format=jsonl`))).text();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
