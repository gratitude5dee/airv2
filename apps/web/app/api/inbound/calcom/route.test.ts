/**
 * cal.com inbound webhook (R-TQ-03): account gate, per-account sealed-secret
 * signature verification before any write, stale replay ack, and idempotent
 * dedupe on inbound_events — a replay produces no second nudge. The secretbox
 * roundtrip is real crypto (sealSecret/openSecret with BOX_DASHBOARD_AUTH_KEY);
 * dedupeInboundEvent is mocked but backed by the fake inbound_events table.
 */
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminFakeDb } from "@/lib/admin/testing/fakeDb";
import type { DedupeKey } from "@/lib/routing/inbound";

const db = vi.hoisted(() => ({
  fake: null as unknown as AdminFakeDb,
  afterCbs: [] as (() => Promise<unknown>)[],
}));

vi.mock("@/lib/supabase", () => ({ serviceClient: () => db.fake.client() }));

vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (fn: () => Promise<unknown>) => {
      db.afterCbs.push(fn);
    },
  };
});

vi.mock("@/lib/routing/inbound", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/routing/inbound")>();
  return {
    ...mod,
    dedupeInboundEvent: vi.fn(
      async (_supabase: unknown, key: DedupeKey, userId: string | null) => {
        const rows = db.fake.rows("inbound_events");
        if (
          rows.some(
            (row) =>
              row["webhook_id"] === key.webhookId &&
              row["message_id"] === key.messageId
          )
        ) {
          return { alreadySeen: true };
        }
        rows.push({
          webhook_id: key.webhookId,
          message_id: key.messageId,
          user_id: userId,
        });
        return { alreadySeen: false };
      }
    ),
  };
});

const mocks = vi.hoisted(() => ({
  ensureBoxAwake: vi.fn(async () => ({
    target: "https://box.test",
    boxId: "box-1",
  })),
  armStopAfter: vi.fn(async () => undefined),
  nudgeSync: vi.fn(async () => undefined),
}));

vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: mocks.ensureBoxAwake,
  armStopAfter: mocks.armStopAfter,
}));
vi.mock("@/lib/calendar/store", () => ({ nudgeSync: mocks.nudgeSync }));

import { sealSecret } from "@/lib/crypto/secretbox";
import { POST } from "./route";

const SEAL_KEY = "a".repeat(64);
const SECRET = "calcom-webhook-secret";
const ACCOUNT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const NOW = new Date("2026-09-25T12:00:00Z");

function deliver(
  raw: string,
  options: {
    account?: string;
    secret?: string;
    signature?: string | null;
  } = {}
): NextRequest {
  const account = options.account ?? ACCOUNT;
  const headers = new Headers({ "content-type": "application/json" });
  const signature =
    options.signature === undefined
      ? createHmac("sha256", options.secret ?? SECRET)
          .update(raw)
          .digest("hex")
      : options.signature;
  if (signature !== null) headers.set("x-cal-signature-256", signature);
  return new NextRequest(
    `https://air.test/api/inbound/calcom?account=${account}`,
    { method: "POST", headers, body: raw }
  );
}

function envelope(over: { uid?: string; createdAt?: string } = {}): string {
  return JSON.stringify({
    triggerEvent: "BOOKING_CREATED",
    createdAt: over.createdAt ?? NOW.toISOString(),
    payload: { uid: over.uid ?? "booking-1", bookingId: 1 },
  });
}

const runAfter = async () => {
  for (const cb of db.afterCbs.splice(0)) await cb();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db.fake = new AdminFakeDb();
  db.afterCbs.length = 0;
  process.env["BOX_DASHBOARD_AUTH_KEY"] = SEAL_KEY;
  db.fake.rows("calendar_accounts").push({
    id: ACCOUNT,
    user_id: "user-1",
    provider: "calcom",
    status: "active",
    webhook_secret_sealed: sealSecret(SECRET, SEAL_KEY),
  });
});

afterEach(() => {
  delete process.env["BOX_DASHBOARD_AUTH_KEY"];
  vi.useRealTimers();
});

describe("POST /api/inbound/calcom", () => {
  it.each([
    ["missing", { account: "" }],
    ["malformed", { account: "not-a-uuid" }],
  ])("404 with a %s account", async (_label, options) => {
    const response = await POST(deliver(envelope(), options));
    expect(response.status).toBe(404);
  });

  it("404 for a revoked account", async () => {
    db.fake.rows("calendar_accounts")[0]!["status"] = "revoked";
    const response = await POST(deliver(envelope()));
    expect(response.status).toBe(404);
    expect(mocks.nudgeSync).not.toHaveBeenCalled();
  });

  it("401 on an invalid signature before any write", async () => {
    const response = await POST(
      deliver(envelope(), { secret: "wrong-secret" })
    );
    expect(response.status).toBe(401);
    expect(db.fake.inserts).toHaveLength(0);
    expect(db.fake.rows("inbound_events")).toHaveLength(0);
  });

  it("acks a stale replay without deduping or nudging", async () => {
    const stale = new Date(Date.now() - 20 * 60_000).toISOString();
    const response = await POST(deliver(envelope({ createdAt: stale })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, stale: true });
    expect(db.fake.rows("inbound_events")).toHaveLength(0);
    await runAfter();
    expect(mocks.nudgeSync).not.toHaveBeenCalled();
  });

  it("nudges the box sync after acking a fresh delivery", async () => {
    const response = await POST(deliver(envelope()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    await runAfter();
    expect(mocks.ensureBoxAwake).toHaveBeenCalledWith(
      expect.anything(),
      "user-1"
    );
    expect(mocks.nudgeSync).toHaveBeenCalledWith("https://box.test", "box-1");
    expect(
      db.fake.updates.some(
        ({ table, patch }) =>
          table === "calendar_accounts" &&
          typeof patch["last_synced_at"] === "string"
      )
    ).toBe(true);
    expect(mocks.armStopAfter).toHaveBeenCalled();
  });

  it("dedupes a replayed delivery: no second nudge", async () => {
    const raw = envelope();
    const first = await POST(deliver(raw));
    expect(first.status).toBe(200);
    await runAfter();
    expect(mocks.nudgeSync).toHaveBeenCalledTimes(1);

    const second = await POST(deliver(raw));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    expect(db.afterCbs).toHaveLength(0);
    expect(mocks.nudgeSync).toHaveBeenCalledTimes(1);
    expect(db.fake.rows("inbound_events")).toHaveLength(1);
  });
});
