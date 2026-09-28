import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  fake: null as unknown as { client: () => unknown },
}));

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.fake.client(),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  armStopAfter: vi.fn(async () => undefined),
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
}));
vi.mock("@/lib/box/client", () => ({
  command: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" })),
  writeFile: vi.fn(async () => undefined),
}));

import { POST } from "./route";
import { command, writeFile } from "@/lib/box/client";
import { ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const URL = "https://air.test/api/calendar/remind";
const USER = "user-1";

const BODY = {
  title: "vet appointment",
  starts_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  minutes_before: 30,
  timezone: "UTC",
  deliver: "imessage",
};

const post = (body: unknown, bearer?: string, cookie?: string) =>
  POST(
    new NextRequest(URL, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        ...(cookie ? { cookie: `air_session=${cookie}` } : {}),
      },
    })
  );

const scheduleInserts = (fake: FakeSupabase) =>
  fake.inserts.filter((entry) => entry.table === "agent_schedules");

beforeEach(() => {
  vi.clearAllMocks();
  const fake = new FakeSupabase();
  fake.rows("boxes").push({
    gateway_token: "box-token",
    user_id: USER,
    provider_box_id: "box-1",
  });
  db.fake = fake;
});

describe("POST /api/calendar/remind (A106)", () => {
  it("401s with no credentials", async () => {
    expect((await post(BODY)).status).toBe(401);
  });

  it("accepts the box bearer token (A106 — the agent schedules reminders)", async () => {
    const res = await post(BODY, "box-token");
    expect(res.status).toBe(200);
    const fake = db.fake as FakeSupabase;
    const row = scheduleInserts(fake)[0]?.row as
      | { user_id: string; source: string; one_shot: boolean; deliver: string }
      | undefined;
    expect(row).toMatchObject({
      user_id: USER,
      source: "calendar",
      one_shot: true,
      deliver: "imessage",
    });
    expect(vi.mocked(writeFile)).toHaveBeenCalledOnce();
    expect(vi.mocked(command)).toHaveBeenCalled();
  });

  it("rejects a bearer token that maps to no box", async () => {
    expect((await post(BODY, "not-the-token")).status).toBe(401);
    expect(scheduleInserts(db.fake as FakeSupabase)).toHaveLength(0);
  });

  it("wakes the owner's box even when the caller authenticates as the box", async () => {
    await post(BODY, "box-token");
    expect(vi.mocked(ensureBoxAwake)).toHaveBeenCalledWith(
      expect.anything(),
      USER
    );
  });

  it("400s on invalid deliver values", async () => {
    const res = await post({ ...BODY, deliver: "pigeon" }, "box-token");
    expect(res.status).toBe(400);
    expect(scheduleInserts(db.fake as FakeSupabase)).toHaveLength(0);
  });
});
