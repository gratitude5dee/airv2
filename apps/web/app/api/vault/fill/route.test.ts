import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  fake: null as unknown as { client: () => unknown },
}));

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.fake.client(),
}));

import { POST } from "./route";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const URL = "https://air.test/api/vault/fill";
const USER = "user-1";
const BOX_ID = "box-1";

const post = (body: unknown, bearer?: string) =>
  POST(
    new NextRequest(URL, {
      method: "POST",
      body: JSON.stringify(body),
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    })
  );

const VALID = {
  name: "neko house wifi",
  kind: "login",
  staging_ref: ".hermes/vault/.inbox/agent-8f8f8f8f-9a9a-4b4b-8c8c-1d1d1d1d1d1d.json",
};

const decisionInserts = (fake: FakeSupabase) =>
  fake.inserts.filter((entry) => entry.table === "decisions");

beforeEach(() => {
  vi.clearAllMocks();
  const fake = new FakeSupabase();
  fake.rows("boxes").push({
    gateway_token: "box-token",
    user_id: USER,
    provider_box_id: BOX_ID,
  });
  db.fake = fake;
});

describe("POST /api/vault/fill (K196)", () => {
  it("401s without a box gateway token", async () => {
    expect((await post(VALID)).status).toBe(401);
    expect((await post(VALID, "not-the-token")).status).toBe(401);
  });

  it("files a pending vault_fill decision for the box's owner", async () => {
    const res = await post(VALID, "box-token");
    expect(res.status).toBe(202);
    const fake = db.fake as FakeSupabase;
    const row = decisionInserts(fake)[0]?.row as
      | { kind: string; user_id: string; ref: string; payload: Record<string, unknown> }
      | undefined;
    expect(row?.kind).toBe("vault_fill");
    expect(row?.user_id).toBe(USER);
    expect(row?.ref).toBe(VALID.staging_ref);
    expect(row?.payload).toMatchObject({
      name: "neko house wifi",
      kind: "login",
      box_id: BOX_ID,
    });
  });

  it("400s on a bad kind", async () => {
    const res = await post({ ...VALID, kind: "crypto_wallet" }, "box-token");
    expect(res.status).toBe(400);
    expect(decisionInserts(db.fake as FakeSupabase)).toHaveLength(0);
  });

  it.each([
    ".hermes/vault/.inbox/../.env",
    ".hermes/.env",
    "vault/.inbox/agent-x.json",
    ".hermes/vault/.inbox/apply-<nonce>.json",
    ".hermes/vault/.inbox/agent-x.exe",
  ])("400s on staging_ref %s", async (staging_ref) => {
    const res = await post({ ...VALID, staging_ref }, "box-token");
    expect(res.status).toBe(400);
    expect(decisionInserts(db.fake as FakeSupabase)).toHaveLength(0);
  });

  it("400s when name is missing", async () => {
    const res = await post({ kind: VALID.kind, staging_ref: VALID.staging_ref }, "box-token");
    expect(res.status).toBe(400);
  });
});
