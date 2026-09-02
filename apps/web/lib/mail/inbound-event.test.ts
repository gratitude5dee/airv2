import { describe, expect, it } from "vitest";
import { parseInboundEvent } from "./inbound-event";

describe("parseInboundEvent", () => {
  it("reads the AgentMail envelope unchanged", () => {
    const event = parseInboundEvent({
      event_type: "message.received",
      event_id: "evt_1",
      message: { message_id: "m1", inbox_id: "a@agentmail.to", to: ["a@agentmail.to"] },
    });
    expect(event).toEqual({
      eventType: "message.received",
      eventId: "evt_1",
      message: { message_id: "m1", inbox_id: "a@agentmail.to", to: ["a@agentmail.to"] },
    });
  });

  it("reads the wzrdmail envelope ({ type, data: { message } })", () => {
    const event = parseInboundEvent({
      event_id: "evt_2",
      type: "message.received",
      created_at: "2026-01-01T00:00:00Z",
      organization_id: "org_1",
      pod_id: "pod_1",
      inbox_id: "a@wzrd.tech",
      data: {
        message: {
          message_id: "m2",
          inbox_id: "a@wzrd.tech",
          thread_id: "t1",
          from: "x@example.com",
          to: ["a@wzrd.tech"],
          subject: "hi",
          extracted_text: "hi",
        },
      },
    });
    expect(event.eventType).toBe("message.received");
    expect(event.eventId).toBe("evt_2");
    expect(event.message).toMatchObject({ message_id: "m2", inbox_id: "a@wzrd.tech" });
  });

  it("fills inbox_id from the envelope when the message omits it", () => {
    const event = parseInboundEvent({
      type: "message.received",
      inbox_id: "a@wzrd.tech",
      data: { message: { message_id: "m3" } },
    });
    expect(event.message).toEqual({ message_id: "m3", inbox_id: "a@wzrd.tech" });
  });

  it("tolerates junk", () => {
    expect(parseInboundEvent(null).message).toBeUndefined();
    expect(parseInboundEvent({ type: "message.sent" }).eventType).toBe("message.sent");
  });
});
