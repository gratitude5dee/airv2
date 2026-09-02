import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routing, inbound, nextAfter } = vi.hoisted(() => ({
  routing: {
    resolveAgentAddress: vi.fn(async () => ({ userId: "user-1" })),
    dedupeInboundEvent: vi.fn(async () => ({ alreadySeen: false })),
  },
  inbound: { processInboundEmail: vi.fn(async () => undefined) },
  nextAfter: vi.fn((fn: () => Promise<void>) => void fn()),
}));

vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/routing/inbound", () => routing);
vi.mock("@/lib/email/inbound", () => inbound);
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: nextAfter };
});

import { POST } from "./route";

const WZRD_KEY = Buffer.from("wzrdmail-webhook-key");
const AGENTMAIL_KEY = Buffer.from("agentmail-webhook-key");
const ORIGINAL = { ...process.env };

function signed(body: object, key: Buffer): NextRequest {
  const raw = Buffer.from(JSON.stringify(body));
  const id = "msg_1";
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", key)
    .update(Buffer.concat([Buffer.from(`${id}.${timestamp}.`), raw]))
    .digest("base64");
  return new NextRequest("https://air.test/api/inbound/email", {
    method: "POST",
    body: raw,
    headers: {
      "svix-id": id,
      "svix-timestamp": String(timestamp),
      "svix-signature": `v1,${digest}`,
    },
  });
}

const wzrdmailEvent = {
  event_id: "evt_1",
  type: "message.received",
  created_at: "2026-01-01T00:00:00Z",
  organization_id: "org_1",
  pod_id: "pod_1",
  inbox_id: "sam@wzrd.tech",
  data: {
    message: {
      message_id: "m1",
      inbox_id: "sam@wzrd.tech",
      thread_id: "t1",
      from: "x@example.com",
      to: ["sam@wzrd.tech"],
      subject: "hi",
      text: "hi",
      extracted_text: "hi",
    },
  },
};

beforeEach(() => {
  process.env["WZRDMAIL_WEBHOOK_SECRET"] = `whsec_${WZRD_KEY.toString("base64")}`;
  process.env["AGENTMAIL_WEBHOOK_SECRET"] = `whsec_${AGENTMAIL_KEY.toString("base64")}`;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.clearAllMocks();
});

describe("POST /api/inbound/email with MAIL_PROVIDER=wzrdmail", () => {
  beforeEach(() => {
    process.env["MAIL_PROVIDER"] = "wzrdmail";
  });

  it("verifies with WZRDMAIL_WEBHOOK_SECRET and processes the wzrdmail envelope", async () => {
    const response = await POST(signed(wzrdmailEvent, WZRD_KEY));
    expect(response.status).toBe(200);
    expect(routing.resolveAgentAddress).toHaveBeenCalledWith({}, "sam@wzrd.tech");
    expect(routing.dedupeInboundEvent).toHaveBeenCalledWith(
      {},
      { webhookId: "msg_1", messageId: "m1" },
      "user-1"
    );
    expect(inbound.processInboundEmail).toHaveBeenCalledWith({}, "user-1", "sam@wzrd.tech", "m1");
  });

  it("rejects a body signed with the AgentMail secret", async () => {
    const response = await POST(signed(wzrdmailEvent, AGENTMAIL_KEY));
    expect(response.status).toBe(401);
    expect(inbound.processInboundEmail).not.toHaveBeenCalled();
  });

  it("acks other event types without work", async () => {
    const response = await POST(signed({ ...wzrdmailEvent, type: "message.sent" }, WZRD_KEY));
    expect(response.status).toBe(200);
    expect(inbound.processInboundEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/inbound/email with the default provider", () => {
  it("still verifies with AGENTMAIL_WEBHOOK_SECRET and reads the AgentMail envelope", async () => {
    delete process.env["MAIL_PROVIDER"];
    const response = await POST(
      signed(
        {
          event_type: "message.received",
          event_id: "evt_2",
          message: { message_id: "m2", inbox_id: "sam@agentmail.to", to: ["sam@agentmail.to"] },
        },
        AGENTMAIL_KEY
      )
    );
    expect(response.status).toBe(200);
    expect(inbound.processInboundEmail).toHaveBeenCalledWith({}, "user-1", "sam@agentmail.to", "m2");
  });
});
