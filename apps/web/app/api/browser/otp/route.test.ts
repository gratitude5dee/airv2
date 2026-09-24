import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const responses: Record<string, { data: unknown; error: unknown }[]> = {};
  function chain(table: string): Record<string, (...args: unknown[]) => unknown> {
    const ops: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "is",
      "gt",
      "order",
      "limit",
    ]) {
      ops[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return ops;
      };
    }
    for (const terminal of ["single", "maybeSingle"]) {
      ops[terminal] = async () =>
        responses[`${table}:${terminal}`]?.shift() ??
        responses[`${table}:always`]?.[0] ?? {
          data: null,
          error: null,
        };
    }
    return ops;
  }
  return {
    calls,
    responses,
    client: { from: (table: string) => chain(table) },
  };
});

const registerVaultValue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({ serviceClient: () => state.client }));
vi.mock("@/lib/vault/scrub", () => ({ registerVaultValue }));
vi.mock("@/lib/miniapps/cardSends", () => ({
  claimCardSend: vi.fn(async () => null),
}));
vi.mock("@/lib/miniapps/cards", () => ({
  sendMiniAppCard: vi.fn(async () => undefined),
}));

import { GET, POST } from "./route";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const DECISION_ID = "22222222-2222-4222-8222-222222222222";

function authed(
  url: string,
  init?: { method?: string; body?: unknown }
): NextRequest {
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers: {
      authorization: "Bearer gw-token",
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.calls.length = 0;
  for (const key of Object.keys(state.responses)) {
    delete state.responses[key];
  }
  state.responses["boxes:always"] = [
    { data: { user_id: "user-1" }, error: null },
  ];
});

describe("browser OTP lane", () => {
  it("rejects callers without a box token", async () => {
    const response = await POST(
      new NextRequest("https://app.example/api/browser/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "request", host: "x.com" }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("files the request, decision, and expiry on request", async () => {
    state.responses["otp_requests:single"] = [
      { data: { id: REQUEST_ID }, error: null },
    ];
    state.responses["decisions:single"] = [
      { data: { id: DECISION_ID }, error: null },
    ];
    const response = await POST(
      authed("https://app.example/api/browser/otp", {
        method: "POST",
        body: { action: "request", host: "App.Example.com", run_id: "run.1" },
      })
    );
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      request_id: REQUEST_ID,
      decision_id: DECISION_ID,
    });
    const insert = state.calls.find(
      (c) => c.table === "otp_requests" && c.method === "insert"
    );
    expect(insert?.args[0]).toMatchObject({
      user_id: "user-1",
      host: "app.example.com",
      run_id: "run.1",
    });
    const decision = state.calls.find(
      (c) => c.table === "decisions" && c.method === "insert"
    );
    expect(decision?.args[0]).toMatchObject({
      kind: "otp_request",
      ref: REQUEST_ID,
    });
    expect(decision?.args[0]).not.toHaveProperty("payload.code");
  });

  it("returns a resolved code exactly once, then popped", async () => {
    state.responses["otp_requests:maybeSingle"] = [
      {
        data: {
          id: REQUEST_ID,
          status: "resolved",
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
        error: null,
      },
      { data: { code: "654321" }, error: null },
      // second poll: row already flipped
      {
        data: {
          id: REQUEST_ID,
          status: "popped",
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
        error: null,
      },
    ];
    const first = await GET(
      authed(`https://app.example/api/browser/otp?request_id=${REQUEST_ID}`)
    );
    expect(await first.json()).toMatchObject({
      status: "resolved",
      code: "654321",
    });
    expect(registerVaultValue).toHaveBeenCalledWith("654321");
    const pop = state.calls.find(
      (c) => c.table === "otp_requests" && c.method === "update"
    );
    expect(pop?.args[0]).toMatchObject({ status: "popped", code: null });
    const second = await GET(
      authed(`https://app.example/api/browser/otp?request_id=${REQUEST_ID}`)
    );
    expect(await second.json()).toMatchObject({ status: "popped" });
  });

  it("flips a stale pending request to expired", async () => {
    state.responses["otp_requests:maybeSingle"] = [
      {
        data: {
          id: REQUEST_ID,
          status: "pending",
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
        error: null,
      },
    ];
    const response = await POST(
      authed("https://app.example/api/browser/otp", {
        method: "POST",
        body: { action: "poll", request_id: REQUEST_ID },
      })
    );
    expect(await response.json()).toMatchObject({ status: "expired" });
    expect(
      state.calls.some(
        (c) =>
          c.table === "otp_requests" &&
          c.method === "update" &&
          (c.args[0] as { status?: string }).status === "expired"
      )
    ).toBe(true);
  });

  it("cancel denies the request and dismisses its decision", async () => {
    state.responses["otp_requests:maybeSingle"] = [
      { data: { decision_id: DECISION_ID }, error: null },
    ];
    const response = await POST(
      authed("https://app.example/api/browser/otp", {
        method: "POST",
        body: { action: "cancel", request_id: REQUEST_ID },
      })
    );
    expect(await response.json()).toMatchObject({ status: "denied" });
    expect(
      state.calls.some(
        (c) =>
          c.table === "decisions" &&
          c.method === "update" &&
          (c.args[0] as { status?: string }).status === "dismissed"
      )
    ).toBe(true);
  });

  it("rejects malformed hosts and ids", async () => {
    const badHost = await POST(
      authed("https://app.example/api/browser/otp", {
        method: "POST",
        body: { action: "request", host: "https://evil.example/path" },
      })
    );
    expect(badHost.status).toBe(400);
    const badId = await GET(
      authed("https://app.example/api/browser/otp?request_id=not-a-uuid")
    );
    expect(badId.status).toBe(400);
  });
});
