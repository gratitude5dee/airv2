/**
 * Normalises the two inbound-webhook envelopes onto one shape:
 *   AgentMail: { event_type, event_id, message: {...} }
 *   wzrdmail:  { type, event_id, inbox_id, data: { message: {...} } }
 * Both providers sign with the Standard Webhooks (Svix) scheme, so only the
 * body differs.
 */
export interface InboundMessageEvent {
  eventType: string | undefined;
  eventId: string | undefined;
  message:
    | {
        message_id?: string;
        to?: string[] | string;
        inbox_id?: string;
      }
    | undefined;
}

interface RawEnvelope {
  event_type?: string;
  type?: string;
  event_id?: string;
  inbox_id?: string;
  message?: InboundMessageEvent["message"];
  data?: { message?: InboundMessageEvent["message"] };
}

export function parseInboundEvent(raw: unknown): InboundMessageEvent {
  const body = (raw ?? {}) as RawEnvelope;
  const message = body.message ?? body.data?.message;
  return {
    eventType: body.event_type ?? body.type,
    eventId: body.event_id,
    message:
      message && !message.inbox_id && body.inbox_id
        ? { ...message, inbox_id: body.inbox_id }
        : message,
  };
}
