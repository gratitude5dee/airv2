import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  publisherUsername: async () => "alice",
}));
const turn = vi.hoisted(() => ({
  startCreateTurn: vi.fn(async () => ({
    run_id: "run-1",
    session: "air-create-countdown",
    slug: "alice-countdown",
    appname: "countdown",
    tier: "balanced" as const,
  })),
}));
vi.mock("@/lib/create/turn", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/turn")>()),
  startCreateTurn: turn.startCreateTurn,
}));
const budget = vi.hoisted(() => ({ spent: 0, limited: false }));
vi.mock("@/lib/create/budget", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/budget")>()),
  projectBudget: async () => ({ budget_usd: 5, spent_usd: budget.spent, remaining_usd: 5 - budget.spent }),
}));
const limits = vi.hoisted(() => ({
  createTurnRateLimited: vi.fn(async () => budget.limited),
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/security/limits", () => limits);

import { NextRequest } from "next/server";
import { CREATE_SESSION_RE } from "@/lib/create/turn";
import { POST } from "./route";

function post(body: unknown): NextRequest {
  return new NextRequest("https://air.test/api/create/turn", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  budget.spent = 0;
  budget.limited = false;
  session.storeSessionUserId.mockReturnValue("user-alice");
});

describe("CREATE_SESSION_RE", () => {
  it("accepts air-create-<appname> up to 48 chars and nothing else", () => {
    expect(CREATE_SESSION_RE.test("air-create-countdown")).toBe(true);
    expect(CREATE_SESSION_RE.test(`air-create-${"a".repeat(48)}`)).toBe(true);
    expect(CREATE_SESSION_RE.test(`air-create-${"a".repeat(49)}`)).toBe(false);
    expect(CREATE_SESSION_RE.test("air-create-")).toBe(false);
    expect(CREATE_SESSION_RE.test("air-create-Countdown")).toBe(false);
    expect(CREATE_SESSION_RE.test("air-main")).toBe(false);
    expect(CREATE_SESSION_RE.test("air-chat-abc")).toBe(false);
    expect(CREATE_SESSION_RE.test("air-create-../x")).toBe(false);
  });
});

describe("POST /api/create/turn", () => {
  it("401 without the store session (the Box never starts web turns)", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    const response = await post({ appname: "countdown", input: "hi" });
    expect((await POST(response)).status).toBe(401);
  });

  it("starts a run for the owner and records create.turn", async () => {
    const response = await POST(post({ appname: "countdown", input: "Make a countdown", tier: "deep" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      run_id: "run-1",
      session: "air-create-countdown",
      slug: "alice-countdown",
    });
    expect(turn.startCreateTurn).toHaveBeenCalledWith(
      expect.anything(),
      "user-alice",
      { appname: "countdown", input: "Make a countdown", tier: "deep", trigger: "web" },
      { budget: { budget_usd: 5, spent_usd: 0, remaining_usd: 5 } }
    );
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "create.turn",
      "user-alice",
      "alice-countdown:balanced"
    );
  });

  it("validates the session id and that it belongs to the named app", async () => {
    expect((await POST(post({ appname: "countdown", input: "x", session: "air-main" }))).status).toBe(400);
    expect(
      (await POST(post({ appname: "countdown", input: "x", session: "air-create-other" }))).status
    ).toBe(400);
    expect(
      (await POST(post({ appname: "countdown", input: "x", session: "air-create-countdown" }))).status
    ).toBe(200);
    expect(turn.startCreateTurn).toHaveBeenCalledTimes(1);
  });

  it("rejects a bad app name and an empty prompt through the shared validators", async () => {
    expect((await POST(post({ appname: "Bad Name", input: "x" }))).status).toBe(400);
    turn.startCreateTurn.mockRejectedValueOnce(
      new (await import("@/lib/miniapps/publish")).PublishError("prompt required")
    );
    expect((await POST(post({ appname: "countdown", input: "" }))).status).toBe(400);
  });

  it("refuses a spent project with create_budget before any run is created", async () => {
    budget.spent = 5;
    const response = await POST(post({ appname: "countdown", input: "more" }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: "insufficient_quota", reason: "create_budget" });
    expect(turn.startCreateTurn).not.toHaveBeenCalled();
  });

  it("rate limits turns", async () => {
    budget.limited = true;
    expect((await POST(post({ appname: "countdown", input: "more" }))).status).toBe(429);
    expect(turn.startCreateTurn).not.toHaveBeenCalled();
  });
});
