import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
const box = vi.hoisted(() => ({
  boxUserId: vi.fn(async (): Promise<string | undefined> => undefined),
}));
vi.mock("@/lib/auth/box", () => box);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
const limits = vi.hoisted(() => ({
  overLimit: vi.fn(async () => false),
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/security/limits", () => limits);

// The intake module is unit-tested against an in-memory ledger in
// lib/create/intake.test.ts; here it is a boundary, and the route's job is
// auth, shape, and the error contract.
const intake = vi.hoisted(() => ({
  openIntake: vi.fn(),
  advanceIntake: vi.fn(),
  getIntake: vi.fn(),
}));
vi.mock("@/lib/create/intake", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/intake")>()),
  ...intake,
}));

import { NextRequest } from "next/server";
import { IllegalTransitionError, IntakeError, type IntakeRow } from "@/lib/create/intake";
import { GET, POST } from "./route";

const app = makeApp({ slug: "alice-promo", appname: "promo", owner_user_id: "user-alice" });

const row = (over: Partial<IntakeRow> = {}): IntakeRow => ({
  id: "intake-1",
  user_id: "user-alice",
  app_id: app.id,
  appname: "promo",
  template: null,
  stage: "asking",
  source: "imessage",
  questions_asked: 0,
  revisions: 0,
  plan_sha256: null,
  goal_sha256: null,
  builds: 0,
  failed_builds: 0,
  mirror_error: null,
  opened_at: "2026-01-01T00:00:00.000Z",
  confirmed_at: null,
  dev_ready_at: null,
  production_at: null,
  last_owner_message_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

function get(query: string, token?: string): NextRequest {
  return new NextRequest(`https://air.test/api/create/intake?${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}
function post(body: unknown, token?: string): NextRequest {
  return new NextRequest("https://air.test/api/create/intake", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue(null);
  box.boxUserId.mockResolvedValue(undefined);
  limits.overLimit.mockResolvedValue(false);
  intake.getIntake.mockResolvedValue(row());
  intake.openIntake.mockResolvedValue(row());
  intake.advanceIntake.mockResolvedValue(row({ stage: "planning" }));
});

describe("GET /api/create/intake", () => {
  it("401 without a session or gateway token", async () => {
    expect((await GET(get("app=promo"))).status).toBe(401);
    expect(intake.getIntake).not.toHaveBeenCalled();
  });

  it("returns the owner's stage view, scoped to the owner, for the Box token", async () => {
    box.boxUserId.mockResolvedValue("user-alice");
    intake.getIntake.mockResolvedValue(
      row({ stage: "plan_sent", revisions: 2, questions_asked: 3, template: "landing" })
    );
    const response = await GET(get("app=promo", "gw-1"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      stage: "plan_sent",
      template: "landing",
      questions_asked: 3,
      revisions: 2,
      plan_version: 3,
      builds: 0,
      failed_builds: 0,
      timestamps: { opened_at: "2026-01-01T00:00:00.000Z", confirmed_at: null },
    });
    expect(body).not.toHaveProperty("prompt");
    expect(intake.getIntake).toHaveBeenCalledWith(expect.anything(), "user-alice", "promo");
  });

  it("plan_version is null before a plan exists", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    const body = await (await GET(get("app=promo"))).json();
    expect(body.plan_version).toBeNull();
  });

  it("another owner's app (or none) is a 404; a bad name is a 400", async () => {
    session.storeSessionUserId.mockReturnValue("user-bob");
    intake.getIntake.mockResolvedValue(null);
    const response = await GET(get("app=promo"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "intake not found" });
    intake.getIntake.mockRejectedValue(new IntakeError("app name must be 1–32 lowercase letters, digits, or hyphens"));
    expect((await GET(get("app=Bad%20Name"))).status).toBe(400);
  });
});

describe("POST /api/create/intake", () => {
  it("401 for anyone else", async () => {
    expect((await POST(post({ source: "web", prompt: "x" }))).status).toBe(401);
  });

  it("opens an intake (provisional name when none is given) and stores no content", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    const response = await POST(post({ source: "web", prompt: "a countdown for my tour" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ stage: "asking", appname: "promo" });
    expect(intake.openIntake).toHaveBeenCalledWith(expect.anything(), "user-alice", {
      source: "web",
      appname: null,
      prompt: "a countdown for my tour",
      url: null,
      template: null,
    });
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "intake", "user-alice", "open");
    expect(JSON.stringify(limits.recordOpsEvent.mock.calls)).not.toContain("countdown");
  });

  it("requires a valid source and template on open", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    expect((await POST(post({ prompt: "x" }))).status).toBe(400);
    expect((await POST(post({ prompt: "x", source: "carrier-pigeon" }))).status).toBe(400);
    expect((await POST(post({ prompt: "x", source: "web", template: "blog" }))).status).toBe(400);
    expect(intake.openIntake).not.toHaveBeenCalled();
  });

  it("advances with an event and passes the metadata patch through", async () => {
    box.boxUserId.mockResolvedValue("user-alice");
    const response = await POST(
      post(
        {
          appname: "promo",
          event: "owner_reply",
          template: "landing",
          questions_asked: 2,
          plan_sha256: null,
          rename: "tour26",
          prompt: "should never be forwarded",
        },
        "gw-1"
      )
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ stage: "planning" });
    expect(intake.advanceIntake).toHaveBeenCalledWith(
      expect.anything(),
      "user-alice",
      "promo",
      "owner_reply",
      { template: "landing", questions_asked: 2, plan_sha256: null, appname: "tour26" }
    );
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "intake",
      "user-alice",
      "owner_reply"
    );
  });

  it("400 on an unknown event or a missing appname", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    expect((await POST(post({ appname: "promo", event: "teleport" }))).status).toBe(400);
    expect((await POST(post({ event: "confirm" }))).status).toBe(400);
    expect(intake.advanceIntake).not.toHaveBeenCalled();
  });

  it("409 illegal_transition carries from and event", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    intake.advanceIntake.mockRejectedValue(new IllegalTransitionError("asking", "confirm"));
    const response = await POST(post({ appname: "promo", event: "confirm" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "illegal_transition",
      from: "asking",
      event: "confirm",
    });
  });

  it("404 when the app is not the caller's; intake errors keep their status", async () => {
    session.storeSessionUserId.mockReturnValue("user-bob");
    intake.advanceIntake.mockRejectedValue(new IntakeError("intake not found", 404));
    const response = await POST(post({ appname: "promo", event: "stop" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "intake not found" });
    intake.advanceIntake.mockRejectedValue(new IntakeError("revision_limit", 409));
    expect((await POST(post({ appname: "promo", event: "revise" }))).status).toBe(409);
  });

  it("429 when over the intake limit, recorded under rate_limited", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    limits.overLimit.mockResolvedValue(true);
    const response = await POST(post({ source: "web", prompt: "x" }));
    expect(response.status).toBe(429);
    expect(limits.overLimit).toHaveBeenCalledWith(expect.anything(), "intake", "user-alice", 120, 3_600_000);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "rate_limited", "user-alice", "intake");
    expect(intake.openIntake).not.toHaveBeenCalled();
  });
});
