/**
 * Spectrum inbound webhook (R-TQ-03): signature verification first, dedupe on
 * (webhook_id, message_id), the dedupe release a failed signup performs so a
 * redelivery retries it, tier-2 "Needs you" for unknown senders, and the
 * tier-0 enqueue path. The signature is real HMAC over v0:{ts}:{rawBody};
 * Postgres is AdminFakeDb; dedupeInboundEvent is mocked but backed by the
 * fake inbound_events table so the route's own release delete is observable.
 */
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminFakeDb } from "@/lib/admin/testing/fakeDb";
import type { DedupeKey } from "@/lib/routing/inbound";
import type { InboundMessage } from "@/lib/orchestrator/flush";

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
  const mod =
    await importOriginal<typeof import("@/lib/routing/inbound")>();
  return {
    ...mod,
    dedupeInboundEvent: vi.fn(
      async (
        _supabase: unknown,
        key: DedupeKey,
        userId: string | null
      ) => {
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
  signupSender: vi.fn(async () => "user-new"),
  handleOnboarding: vi.fn(async () => ({ kind: "continue" })),
  ensureComputeProvisioned: vi.fn(async () => undefined),
  enqueueInbound: vi.fn(async (_client: unknown, message: InboundMessage) => ({
    runAt: new Date(Date.now() + 2500).toISOString(),
    message,
  })),
  flushAfterDebounce: vi.fn(async () => undefined),
  isBurstStart: vi.fn(async () => false),
  carryQuickAckMarker: vi.fn(async () => undefined as string | undefined),
  dropQuickAckMarker: vi.fn(async () => undefined),
  updateQuickAckMarker: vi.fn(async () => undefined),
  initialResponse: vi.fn(async () => ({
    body: "ack",
    disposition: "final" as const,
    source: "fallback" as const,
  })),
  prewarmBox: vi.fn(async () => undefined),
  createSpectrumSender: vi.fn(async () => undefined),
  createFastReactionSender: vi.fn(async () => undefined),
  isMuseInstruction: vi.fn(() => false),
  maybeHandleMuseInbound: vi.fn(async () => ({ handled: false })),
  museModeIsActive: vi.fn(async () => false),
  isOnairosTrigger: vi.fn(() => false),
  relayToOnairos: vi.fn(async () => ({
    reply: null,
    grants: [],
    shouldRouteNextMessage: false,
  })),
  setSpectrumFlow: vi.fn(async () => undefined),
  spectrumFlowActive: vi.fn(async () => false),
  storeSpectrumGrants: vi.fn(async () => undefined),
}));

vi.mock("@/lib/provisioning/onboarding", () => ({
  signupSender: mocks.signupSender,
  handleOnboarding: mocks.handleOnboarding,
}));
vi.mock("@/lib/provisioning/provision", () => ({
  ensureComputeProvisioned: mocks.ensureComputeProvisioned,
}));
vi.mock("@/lib/orchestrator/flush", () => ({
  enqueueInbound: mocks.enqueueInbound,
  flushAfterDebounce: mocks.flushAfterDebounce,
  isBurstStart: mocks.isBurstStart,
  carryQuickAckMarker: mocks.carryQuickAckMarker,
  dropQuickAckMarker: mocks.dropQuickAckMarker,
  updateQuickAckMarker: mocks.updateQuickAckMarker,
}));
vi.mock("@/lib/orchestrator/sharedBridge", () => ({
  initialResponse: mocks.initialResponse,
}));
vi.mock("@/lib/orchestrator/boxes", () => ({ prewarmBox: mocks.prewarmBox }));
vi.mock("@/lib/spectrum/sender", () => ({
  createSpectrumSender: mocks.createSpectrumSender,
}));
vi.mock("@/lib/spectrum/fast-reaction", () => ({
  createFastReactionSender: mocks.createFastReactionSender,
}));
vi.mock("@/lib/muse/commands", () => ({
  isMuseInstruction: mocks.isMuseInstruction,
  maybeHandleMuseInbound: mocks.maybeHandleMuseInbound,
  museModeIsActive: mocks.museModeIsActive,
}));
vi.mock("@/lib/onairos/spectrum", () => ({
  isOnairosTrigger: mocks.isOnairosTrigger,
  relayToOnairos: mocks.relayToOnairos,
  setSpectrumFlow: mocks.setSpectrumFlow,
  spectrumFlowActive: mocks.spectrumFlowActive,
  storeSpectrumGrants: mocks.storeSpectrumGrants,
}));

import { dedupeInboundEvent } from "@/lib/routing/inbound";
import { POST } from "./route";

// The route logs its gate decisions; keep the suite output clean.
vi.spyOn(console, "warn").mockImplementation(() => undefined);
vi.spyOn(console, "error").mockImplementation(() => undefined);
vi.spyOn(console, "info").mockImplementation(() => undefined);

const SECRET = "spectrum-test-secret";
const LINE = "+15550001111";
const SENDER = "+14155550123";
const URL_ = "https://air.test/api/inbound/imessage";
const NOW = new Date("2026-09-25T12:00:00Z");

let messageCounter = 0;

function envelope(
  over: {
    messageId?: string;
    sender?: string;
    text?: string;
    phone?: string;
    spaceId?: string;
    direction?: string;
  } = {}
): string {
  return JSON.stringify({
    event: "messages",
    message: {
      id: over.messageId ?? `m-${++messageCounter}`,
      direction: over.direction ?? "inbound",
      platform: "imessage",
      sender: { id: over.sender ?? SENDER },
      content: { type: "text", text: over.text ?? "hi" },
    },
    space: {
      id: over.spaceId ?? "space-1",
      phone: over.phone ?? LINE,
      platform: "imessage",
    },
  });
}

function deliver(
  raw: string,
  options: {
    secret?: string;
    timestamp?: number;
    signature?: string | null;
    webhookId?: string | null;
  } = {}
): NextRequest {
  const timestamp = options.timestamp ?? Math.floor(NOW.getTime() / 1000);
  const signature =
    options.signature === undefined
      ? `v0=${createHmac("sha256", options.secret ?? SECRET)
          .update(`v0:${timestamp}:${raw}`)
          .digest("hex")}`
      : options.signature;
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== null) headers.set("x-spectrum-signature", signature);
  headers.set("x-spectrum-timestamp", String(timestamp));
  const webhookId = options.webhookId === undefined ? "wh-1" : options.webhookId;
  if (webhookId !== null) headers.set("x-spectrum-webhook-id", webhookId);
  headers.set("x-spectrum-event", "messages");
  return new NextRequest(URL_, { method: "POST", headers, body: raw });
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
  process.env["SPECTRUM_WEBHOOK_SECRET"] = SECRET;
  delete process.env["ONAIROS_API_KEY"];
});

afterEach(() => {
  delete process.env["SPECTRUM_WEBHOOK_SECRET"];
  vi.useRealTimers();
});

describe("POST /api/inbound/imessage — signature", () => {
  it.each([
    [400, "missing", { signature: null }],
    [401, "wrong secret", { secret: "not-the-secret" }],
    [401, "malformed", { signature: "v0=nope" }],
  ])("%i on a %s signature", async (status, _label, options) => {
    const response = await POST(deliver(envelope(), options));
    expect(response.status).toBe(status);
    expect(mocks.enqueueInbound).not.toHaveBeenCalled();
  });

  it("400 on a stale timestamp", async () => {
    const stale = Math.floor(NOW.getTime() / 1000) - 6 * 60;
    const response = await POST(deliver(envelope(), { timestamp: stale }));
    expect(response.status).toBe(400);
  });

  it("401 when the body was altered after signing", async () => {
    const signed = envelope({ messageId: "m-tampered" });
    const tampered = envelope({ messageId: "m-tampered", text: "changed" });
    const timestamp = Math.floor(NOW.getTime() / 1000);
    const response = await POST(
      deliver(tampered, {
        signature: `v0=${createHmac("sha256", SECRET)
          .update(`v0:${timestamp}:${signed}`)
          .digest("hex")}`,
      })
    );
    expect(response.status).toBe(401);
  });
});

describe("POST /api/inbound/imessage — routing", () => {
  beforeEach(() => {
    db.fake
      .rows("lines")
      .push({ phone: LINE, assigned_user_id: "user-1" });
  });

  it("acks a signed non-conversational delivery without work", async () => {
    const response = await POST(deliver(envelope({ direction: "outbound" })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.enqueueInbound).not.toHaveBeenCalled();
  });

  it("dedupes a redelivered message id", async () => {
    db.fake.rows("handles").push({
      user_id: "user-1",
      platform: "imessage",
      address: SENDER,
    });
    const raw = envelope({ messageId: "m-dup" });
    const first = await POST(deliver(raw));
    expect(first.status).toBe(200);
    const second = await POST(deliver(raw));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, deduped: true });
    expect(mocks.enqueueInbound).toHaveBeenCalledTimes(1);
    expect(db.fake.rows("inbound_events")).toHaveLength(1);
  });

  it("queues tier-2 senders to Needs you and never enqueues work", async () => {
    const response = await POST(
      deliver(envelope({ sender: "+14159998888", messageId: "m-tier2" }))
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.enqueueInbound).not.toHaveBeenCalled();
    const decision = db.fake.inserts.find(
      ({ table, row }) => table === "decisions" && row["kind"] === "tier2_contact"
    );
    expect(decision?.row["user_id"]).toBe("user-1");
    expect(decision?.row["sender"]).toBe("+14159998888");
    expect(decision?.row["ref"]).toBe("m-tier2");
    // First contact also records the sender at tier 2.
    expect(db.fake.rows("senders")).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        platform: "imessage",
        address: "+14159998888",
        trust_tier: 2,
      }),
    ]);
  });

  it("enqueues a tier-0 sender and drains the debounced flush", async () => {
    db.fake.rows("handles").push({
      user_id: "user-1",
      platform: "imessage",
      address: SENDER,
    });
    const response = await POST(deliver(envelope({ messageId: "m-owner" })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.enqueueInbound).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-1",
        senderId: SENDER,
        senderTier: 0,
        messageId: "m-owner",
      })
    );
    await runAfter();
    expect(mocks.flushAfterDebounce).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ messageId: "m-owner" }),
      expect.any(String)
    );
  });
});

describe("POST /api/inbound/imessage — dedupe release on failed signup", () => {
  beforeEach(() => {
    db.fake
      .rows("lines")
      .push({ phone: LINE, role: "onboarding", assigned_user_id: null });
  });

  it("releases the event when signup throws so redelivery retries", async () => {
    mocks.signupSender.mockRejectedValueOnce(new Error("users insert failed"));
    const raw = envelope({ messageId: "m-signup" });
    await expect(POST(deliver(raw))).rejects.toThrow("users insert failed");
    expect(
      db.fake.deletes.some(({ table }) => table === "inbound_events")
    ).toBe(true);
    expect(db.fake.rows("inbound_events")).toHaveLength(0);

    // The redelivery is not seen as a duplicate: signup runs again and this
    // attempt leaves its own inbound_events row behind.
    const retry = await POST(deliver(raw));
    expect(retry.status).toBe(200);
    expect(mocks.signupSender).toHaveBeenCalledTimes(2);
    expect(vi.mocked(dedupeInboundEvent)).toHaveBeenCalledTimes(2);
    expect(db.fake.rows("inbound_events")).toHaveLength(1);
  });
});
