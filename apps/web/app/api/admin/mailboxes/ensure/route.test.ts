/**
 * Mailbox backfill contract: bearer auth; sweeps every kind=box row through
 * ensureMailboxOnBox, resuming stopped boxes so the writes land; skips users
 * who already have a primary address; reports username-less users unless
 * generate_handles is set, in which case a synthetic `u<id8>` address is
 * provisioned; per-box errors are collected, never fatal; `dry` plans only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type BoxRow = {
  user_id: string;
  provider_box_id: string;
  environment: string | null;
  state: string;
};

const db = vi.hoisted(() => ({
  boxes: [] as BoxRow[],
  users: new Map<string, string | null>(),
  addressed: new Set<string>(),
  error: null as { message: string } | null,
}));

const ensureMailboxOnBox = vi.hoisted(() => vi.fn(async () => true));
const provisionEmail = vi.hoisted(() =>
  vi.fn(async () => ({
    address: "u123@wzrd.tech",
    installedBoxId: null as string | null,
  })),
);
const resume = vi.hoisted(() => vi.fn(async () => ({ id: "x", state: "ready" })));

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      let userFilter: string | null = null;
      for (const method of [
        "select",
        "gt",
        "in",
        "is",
        "not",
        "order",
        "limit",
      ]) {
        chain[method] = vi.fn(() => chain);
      }
      chain["eq"] = vi.fn((field: string, value: string) => {
        if (field === "user_id") userFilter = value;
        return chain;
      });
      const dataFor = () => {
        if (db.error) return { data: null, error: db.error };
        if (table === "boxes") {
          return {
            data: userFilter
              ? db.boxes.filter((b) => b.user_id === userFilter)
              : db.boxes,
            error: null,
          };
        }
        if (table === "users") {
          return {
            data: [...db.users.entries()].map(([id, username]) => ({
              id,
              username,
            })),
            error: null,
          };
        }
        if (table === "agent_addresses") {
          return {
            data: [...db.addressed].map((user_id) => ({ user_id })),
            error: null,
          };
        }
        return { data: [], error: null };
      };
      chain["then"] = (resolve: (v: unknown) => void) => resolve(dataFor());
      return chain;
    },
  }),
}));

vi.mock("@/lib/provisioning/email", () => ({
  ensureMailboxOnBox,
  provisionEmail,
}));

vi.mock("@/lib/box/client", () => ({ resume }));

import { POST } from "./route";

const base = "https://air.test/api/admin/mailboxes/ensure";
const post = (body: unknown, auth = "Bearer admin-key") =>
  new NextRequest(base, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const box = (overrides: Partial<BoxRow> = {}): BoxRow => ({
  user_id: "u1",
  provider_box_id: "bx_1",
  environment: "ubuntu",
  state: "stopped",
  ...overrides,
});

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.boxes = [];
  db.users = new Map();
  db.addressed = new Set();
  db.error = null;
  ensureMailboxOnBox.mockReset().mockResolvedValue(true);
  provisionEmail.mockReset().mockResolvedValue({
    address: "u123@wzrd.tech",
    installedBoxId: null,
  });
  resume.mockReset().mockResolvedValue({ id: "x", state: "ready" });
});

describe("POST /api/admin/mailboxes/ensure", () => {
  it("401s without the admin key", async () => {
    expect((await POST(post({}, "Bearer nope"))).status).toBe(401);
    expect(ensureMailboxOnBox).not.toHaveBeenCalled();
  });

  it("ensures mailboxes on every missing-address box, resuming stopped ones", async () => {
    db.boxes = [
      box({ user_id: "u1", provider_box_id: "bx_1", state: "stopped" }),
      box({ user_id: "u2", provider_box_id: "bx_2", state: "ready" }),
      box({ user_id: "u3", provider_box_id: "bx_3" }),
    ];
    db.users = new Map([
      ["u1", "sam"],
      ["u2", "kim"],
      ["u3", "jo"],
    ]);
    db.addressed = new Set(["u3"]);

    const response = await POST(post({}));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.processed).toBe(3);
    expect(json.counts).toMatchObject({ ensured: 2, already: 1 });
    expect(ensureMailboxOnBox).toHaveBeenCalledTimes(2);
    expect(ensureMailboxOnBox).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "bx_1",
    );
    // stopped box resumed; ready box not
    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledWith("bx_1");
    expect(provisionEmail).not.toHaveBeenCalled();
  });

  it("reports username-less users and skips them without generate_handles", async () => {
    db.boxes = [box({ user_id: "u1", provider_box_id: "bx_1" })];
    db.users = new Map([["u1", null]]);
    const json = await (await POST(post({}))).json();
    expect(json.counts).toMatchObject({ no_username: 1, ensured: 0 });
    expect(ensureMailboxOnBox).not.toHaveBeenCalled();
    expect(provisionEmail).not.toHaveBeenCalled();
  });

  it("synthesizes a u<id8> address for username-less users with generate_handles", async () => {
    const uid = "a2f6246c-4e20-4b90-b1d0-23cb573e0c09";
    db.boxes = [box({ user_id: uid, provider_box_id: "bx_1" })];
    db.users = new Map([[uid, null]]);
    provisionEmail.mockResolvedValueOnce({
      address: "ua2f6246c@wzrd.tech",
      installedBoxId: "bx_1",
    });
    const json = await (
      await POST(post({ generate_handles: true }))
    ).json();
    expect(json.counts).toMatchObject({ ensured: 1, no_username: 0 });
    expect(provisionEmail).toHaveBeenCalledWith(
      expect.anything(),
      uid,
      "ua2f6246c",
    );
    // provisionEmail already installed on this box — no second key mint
    expect(ensureMailboxOnBox).not.toHaveBeenCalled();
  });

  it("falls through to ensure when the synth install landed on another box", async () => {
    const uid = "a2f6246c-4e20-4b90-b1d0-23cb573e0c09";
    db.boxes = [box({ user_id: uid, provider_box_id: "bx_1" })];
    db.users = new Map([[uid, null]]);
    provisionEmail.mockResolvedValueOnce({
      address: "ua2f6246c@wzrd.tech",
      installedBoxId: "bx_other",
    });
    await POST(post({ generate_handles: true }));
    expect(ensureMailboxOnBox).toHaveBeenCalledWith(
      expect.anything(),
      uid,
      "bx_1",
    );
  });

  it("dry mode reports the plan without resuming or mutating", async () => {
    db.boxes = [
      box({ user_id: "u1", provider_box_id: "bx_1" }),
      box({ user_id: "u2", provider_box_id: "bx_2" }),
      box({ user_id: "u3", provider_box_id: "bx_3" }),
    ];
    db.users = new Map([
      ["u1", "sam"],
      ["u2", null],
      ["u3", "jo"],
    ]);
    db.addressed = new Set(["u3"]);
    const json = await (await POST(post({ dry: true }))).json();
    expect(json.dry).toBe(true);
    expect(json.counts).toMatchObject({
      would_ensure: 1,
      no_username: 1,
      already: 1,
    });
    expect(resume).not.toHaveBeenCalled();
    expect(ensureMailboxOnBox).not.toHaveBeenCalled();
    expect(provisionEmail).not.toHaveBeenCalled();
  });

  it("collects a per-box error without failing the sweep", async () => {
    db.boxes = [
      box({ user_id: "u1", provider_box_id: "bx_1" }),
      box({ user_id: "u2", provider_box_id: "bx_2" }),
    ];
    db.users = new Map([
      ["u1", "sam"],
      ["u2", "kim"],
    ]);
    ensureMailboxOnBox
      .mockRejectedValueOnce(new Error("box api down"))
      .mockResolvedValueOnce(true);
    const json = await (await POST(post({}))).json();
    expect(json.counts).toMatchObject({ ensured: 1, error: 1 });
    expect(json.errors).toEqual([
      { user_id: "u1", box_id: "bx_1", outcome: "error", error: "box api down" },
    ]);
  });

  it("user_id targets a single box", async () => {
    db.boxes = [
      box({ user_id: "u1", provider_box_id: "bx_1" }),
      box({ user_id: "u2", provider_box_id: "bx_2" }),
    ];
    db.users = new Map([
      ["u1", "sam"],
      ["u2", "kim"],
    ]);
    const json = await (await POST(post({ user_id: "u1" }))).json();
    expect(json.targeted).toBe(1);
    expect(ensureMailboxOnBox).toHaveBeenCalledTimes(1);
    expect(ensureMailboxOnBox).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "bx_1",
    );
  });

  it("500s when the boxes lookup fails", async () => {
    db.error = { message: "db down" };
    const response = await POST(post({}));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "boxes page failed: db down" });
  });
});
