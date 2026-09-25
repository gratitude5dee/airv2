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
}));
vi.mock("@/lib/crm/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/crm/store")>();
  return { ...real, applyPatchOnBox: vi.fn(async () => ({ id: "person-1" })) };
});
vi.mock("@/lib/box/client", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  command: vi.fn(),
}));

import { POST } from "./route";
import { applyPatchOnBox } from "@/lib/crm/store";
import { AdminFakeDb } from "@/lib/admin/testing/fakeDb";

const URL = "https://air.test/api/crm/update";
const USER = "user-1";

const post = (body: unknown, bearer?: string) =>
  POST(
    new NextRequest(URL, {
      method: "POST",
      body: JSON.stringify(body),
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    })
  );

const PATCH = {
  name: "Jane Doe",
  notes: "met at the launch",
  summary: "CRM from conversation",
};

const openRun = (senderTier: number | null) => ({
  user_id: USER,
  hermes_run_id: "run-9",
  started_at: "2026-09-25T08:05:00Z",
  ended_at: null,
  sender_tier: senderTier,
});

const decisionInserts = (fake: AdminFakeDb) =>
  fake.inserts.filter((entry) => entry.table === "decisions");

beforeEach(() => {
  vi.clearAllMocks();
  const fake = new AdminFakeDb();
  fake.rows("boxes").push({ gateway_token: "box-token", user_id: USER });
  db.fake = fake;
});

describe("POST /api/crm/update", () => {
  it("401s without a box gateway token", async () => {
    expect((await post(PATCH)).status).toBe(401);
    expect((await post(PATCH, "not-the-token")).status).toBe(401);
  });

  it("files a crm_update decision for a tier-1 open run (R-P0-2)", async () => {
    const fake = db.fake as AdminFakeDb;
    // An open run is not the owner's composer just because it is the newest
    // row: the burst's agent_runs row carries sender_tier = 1, and this one
    // started after the flush job's chain.
    fake.rows("agent_runs").push(openRun(1));
    fake.rows("flush_jobs").push({
      user_id: USER,
      hermes_run_id: "run-1",
      sender_tier: 0,
      chain_started_at: "2026-09-25T08:00:00Z",
    });
    const response = await post(PATCH, "box-token");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body["status"]).toBe("pending_approval");
    const decisions = decisionInserts(fake);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.row["kind"]).toBe("crm_update");
    expect(applyPatchOnBox).not.toHaveBeenCalled();
  });

  it("applies immediately for a tier-0 composer run", async () => {
    const fake = db.fake as AdminFakeDb;
    fake.rows("agent_runs").push(openRun(0));
    const response = await post(PATCH, "box-token");
    expect(response.status).toBe(200);
    expect((await response.json())["status"]).toBe("applied");
    expect(applyPatchOnBox).toHaveBeenCalledOnce();
    expect(decisionInserts(fake)).toHaveLength(0);
  });

  it("fails closed on an open run with unknown tier", async () => {
    const fake = db.fake as AdminFakeDb;
    fake.rows("agent_runs").push(openRun(null));
    const response = await post(PATCH, "box-token");
    expect((await response.json())["status"]).toBe("pending_approval");
    expect(decisionInserts(fake)).toHaveLength(1);
    expect(applyPatchOnBox).not.toHaveBeenCalled();
  });

  it("fails closed with no resolvable turn at all", async () => {
    const fake = db.fake as AdminFakeDb;
    const response = await post(PATCH, "box-token");
    expect((await response.json())["status"]).toBe("pending_approval");
    expect(decisionInserts(fake)).toHaveLength(1);
    expect(applyPatchOnBox).not.toHaveBeenCalled();
  });

  it("still resolves the tier from an open flush chain", async () => {
    const fake = db.fake as AdminFakeDb;
    fake.rows("flush_jobs").push({
      user_id: USER,
      hermes_run_id: "run-1",
      sender_tier: 1,
      chain_started_at: "2026-09-25T08:00:00Z",
    });
    const response = await post(PATCH, "box-token");
    expect((await response.json())["status"]).toBe("pending_approval");
    expect(applyPatchOnBox).not.toHaveBeenCalled();
  });
});
