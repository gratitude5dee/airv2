/**
 * MA2.3 acceptance: the Stripe webhook verifies the signature on the raw
 * body before any DB write, records events idempotently by event.id, and a
 * redelivered event acknowledges without a second row.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

const WEBHOOK_SECRET = "whsec_test_secret";

interface StripeDb {
  events: { event_id: string; event_type: string }[];
}

const db: StripeDb = { events: [] };

function fakeSupabase() {
  return {
    from(table: string) {
      if (table !== "stripe_events") throw new Error(`unexpected table ${table}`);
      return {
        async insert(row: { event_id: string; event_type: string }) {
          if (db.events.some((e) => e.event_id === row.event_id)) {
            return { error: { code: "23505", message: "duplicate" } };
          }
          db.events.push(row);
          return { error: null };
        },
      };
    },
  };
}

vi.mock("@/lib/supabase", () => ({ serviceClient: () => fakeSupabase() }));

import { POST } from "../../app/api/inbound/stripe/route";

const EVENT_BODY = JSON.stringify({
  id: "evt_test_1",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_1" } },
});

function signedHeader(body: string, secret: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
}

function post(body: string, signature?: string): Promise<Response> {
  return POST(
    new NextRequest("https://airv2.vercel.app/api/inbound/stripe", {
      method: "POST",
      body,
      headers: signature ? { "stripe-signature": signature } : {},
    })
  );
}

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

beforeEach(() => {
  db.events = [];
});

describe("stripe webhook", () => {
  it("accepts a correctly signed event and records it", async () => {
    const res = await post(EVENT_BODY, signedHeader(EVENT_BODY, WEBHOOK_SECRET));
    expect(res.status).toBe(200);
    expect(db.events).toHaveLength(1);
    expect(db.events[0]).toEqual({
      event_id: "evt_test_1",
      event_type: "checkout.session.completed",
    });
  });

  it("acknowledges a redelivered event without a second row", async () => {
    const sig = signedHeader(EVENT_BODY, WEBHOOK_SECRET);
    await post(EVENT_BODY, sig);
    const res = await post(EVENT_BODY, sig);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { duplicate?: boolean };
    expect(body.duplicate).toBe(true);
    expect(db.events).toHaveLength(1);
  });

  it("rejects a bad signature before any write", async () => {
    const res = await post(EVENT_BODY, signedHeader(EVENT_BODY, "whsec_wrong"));
    expect(res.status).toBe(400);
    expect(db.events).toHaveLength(0);
  });

  it("rejects a tampered body", async () => {
    const sig = signedHeader(EVENT_BODY, WEBHOOK_SECRET);
    const res = await post(EVENT_BODY.replace("evt_test_1", "evt_evil_9"), sig);
    expect(res.status).toBe(400);
    expect(db.events).toHaveLength(0);
  });

  it("rejects a missing signature", async () => {
    const res = await post(EVENT_BODY);
    expect(res.status).toBe(400);
    expect(db.events).toHaveLength(0);
  });
});
