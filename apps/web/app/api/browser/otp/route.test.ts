import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const state = vi.hoisted(() => ({
  fake: null as unknown as FakeSupabase,
}));

const registerVaultValue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({ serviceClient: () => state.fake.client() }));
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
  state.fake = new FakeSupabase();
  state.fake.tables["boxes"] = [
    { user_id: "user-1", gateway_token: "gw-token" },
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
    const response = await POST(
      authed("https://app.example/api/browser/otp", {
        method: "POST",
        body: { action: "request", host: "App.Example.com", run_id: "run.1" },
      })
    );
    const body = await response.json();
    expect(body).toMatchObject({ ok: true });
    const requestId = body.request_id as string;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.decision_id).toMatch(/^[0-9a-f-]{36}$/);
    const insert = state.fake.inserts.find((c) => c.table === "otp_requests");
    expect(insert?.row).toMatchObject({
      user_id: "user-1",
      host: "app.example.com",
      run_id: "run.1",
    });
    const decision = state.fake.inserts.find((c) => c.table === "decisions");
    expect(decision?.row).toMatchObject({
      kind: "otp_request",
      ref: requestId,
    });
    expect(decision?.row).not.toHaveProperty("payload.code");
  });

  it("returns a resolved code exactly once, then popped", async () => {
    state.fake.tables["otp_requests"] = [
      {
        id: REQUEST_ID,
        user_id: "user-1",
        status: "resolved",
        code: "654321",
        expires_at: new Date(Date.now() + 60000).toISOString(),
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
    const pop = state.fake.updates.find(
      (c) => c.table === "otp_requests" && c.patch["status"] === "popped"
    );
    expect(pop).toBeDefined();
    expect(state.fake.rows("otp_requests")[0]).toMatchObject({
      status: "popped",
      code: null,
    });
    const second = await GET(
      authed(`https://app.example/api/browser/otp?request_id=${REQUEST_ID}`)
    );
    expect(await second.json()).toMatchObject({ status: "popped" });
  });

  it("flips a stale pending request to expired", async () => {
    state.fake.tables["otp_requests"] = [
      {
        id: REQUEST_ID,
        user_id: "user-1",
        status: "pending",
        expires_at: new Date(Date.now() - 1000).toISOString(),
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
      state.fake.updates.some(
        (c) => c.table === "otp_requests" && c.patch["status"] === "expired"
      )
    ).toBe(true);
  });

  it("cancel denies the request and dismisses its decision", async () => {
    state.fake.tables["otp_requests"] = [
      {
        id: REQUEST_ID,
        user_id: "user-1",
        status: "pending",
        expires_at: new Date(Date.now() + 60000).toISOString(),
        decision_id: DECISION_ID,
      },
    ];
    state.fake.tables["decisions"] = [{ id: DECISION_ID, status: "pending" }];
    const response = await POST(
      authed("https://app.example/api/browser/otp", {
        method: "POST",
        body: { action: "cancel", request_id: REQUEST_ID },
      })
    );
    expect(await response.json()).toMatchObject({ status: "denied" });
    expect(
      state.fake.updates.some(
        (c) => c.table === "decisions" && c.patch["status"] === "dismissed"
      )
    ).toBe(true);
    expect(
      state.fake.rows("otp_requests")[0],
    ).toMatchObject({ status: "denied" });
  });

  it("cancel on a non-pending request reports not_pending and dismisses nothing", async () => {
    state.fake.tables["otp_requests"] = [
      {
        id: REQUEST_ID,
        user_id: "user-1",
        status: "resolved",
        expires_at: new Date(Date.now() + 60000).toISOString(),
        decision_id: DECISION_ID,
      },
    ];
    const response = await POST(
      authed("https://app.example/api/browser/otp", {
        method: "POST",
        body: { action: "cancel", request_id: REQUEST_ID },
      })
    );
    expect(await response.json()).toMatchObject({ status: "not_pending" });
    expect(
      state.fake.updates.some((c) => c.table === "decisions")
    ).toBe(false);
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
