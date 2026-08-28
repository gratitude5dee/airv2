/**
 * Agent-calendar surface of the calendar mini-app (MyAgentMail): one-tap
 * Accept/Decline RSVPs, the free/busy strip, attendee invites on event
 * creation, and the public booking link — all owner-only, all through the
 * control-plane AgentMail key.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";

const approveInboxEvent = vi.fn(async () => undefined);
const dismissInboxEvent = vi.fn(async () => undefined);
const upsertLocalEvent = vi.fn(async () => "local:0123456789abcdef");
vi.mock("@/lib/calendar/store", () => ({
  approveInboxEvent: (...args: unknown[]) => approveInboxEvent(...(args as [])),
  dismissInboxEvent: (...args: unknown[]) => dismissInboxEvent(...(args as [])),
  upsertLocalEvent: (...args: unknown[]) => upsertLocalEvent(...(args as [])),
  removeLocalEvent: vi.fn(async () => undefined),
  readEventsStore: vi.fn(async () => []),
}));
vi.mock("@/lib/crm/store", () => ({
  avatarIndex: () => new Map(),
  readPeople: vi.fn(async () => []),
  ditherColor: () => "#2b7fff",
  initialsFor: () => "X",
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: "t" })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));
vi.mock("@/lib/miniapps/promptBar", () => ({
  promptBar: () => "",
  runPrompt: vi.fn(),
}));

const createCalendarEvent = vi.fn(async () => ({ event_uid: "ev-1" }));
const rsvpCalendarEvent = vi.fn(async () => undefined);
const getCalendarFreeBusy = vi.fn(async () => [
  { start: "2026-01-01T09:00:00Z", end: "2026-01-01T10:00:00Z" },
]);
const createBookingLink = vi.fn(
  async () => "https://agentmail.to/book/agent"
);
vi.mock("@/lib/agentmail/calendar", () => ({
  createCalendarEvent: (...args: unknown[]) =>
    createCalendarEvent(...(args as [])),
  rsvpCalendarEvent: (...args: unknown[]) => rsvpCalendarEvent(...(args as [])),
  getCalendarFreeBusy: (...args: unknown[]) =>
    getCalendarFreeBusy(...(args as [])),
  createBookingLink: (...args: unknown[]) =>
    createBookingLink(...(args as [])),
}));

import { calendar } from "@/lib/miniapps/apps/calendar";

interface TableFixture {
  rows?: unknown;
  single?: unknown;
}

/** Chainable supabase double: every filter returns the builder; awaiting it
 * (or maybeSingle) resolves the fixture for the table. */
function makeSupabase(fixtures: Record<string, TableFixture>): SupabaseClient {
  const from = (tableName: string) => {
    const fixture = fixtures[tableName] ?? {};
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of [
      "select",
      "eq",
      "neq",
      "is",
      "not",
      "order",
      "limit",
      "update",
    ]) {
      builder[method] = chain;
    }
    builder["maybeSingle"] = async () => ({
      data: fixture.single ?? null,
      error: null,
    });
    builder["then"] = (
      resolve: (value: { data: unknown; error: null }) => unknown
    ) => Promise.resolve({ data: fixture.rows ?? null, error: null }).then(resolve);
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

const INBOX_ROW = { single: { agentmail_inbox_id: "inbox-1" } };

function makeCtx(
  fixtures: Record<string, TableFixture>,
  url = "https://app.wzrd.tech/mini/calendar"
): MiniAppContext {
  return {
    request: new NextRequest(url),
    supabase: makeSupabase(fixtures),
    app: makeApp({ slug: "calendar", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/calendar",
  } as MiniAppContext;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("calendar agenda render (agent calendar)", () => {
  it("shows one-tap Accept/Decline invites, free/busy, and the booking CTA", async () => {
    const response = await calendar.render(
      makeCtx({
        decisions: {
          rows: [{ id: "d-1", label: 'Add "Dinner"?', sender: "sam@x.com" }],
        },
        calendar_accounts: { rows: [] },
        agent_addresses: INBOX_ROW,
      })
    );
    const html = await response.text();
    expect(html).toContain("Accept");
    expect(html).toContain("Decline");
    expect(html).toContain("Free / busy");
    expect(html).toContain("Get shareable booking link");
    expect(html).toContain("data-swipe-next");
    expect(getCalendarFreeBusy).toHaveBeenCalledWith(
      "inbox-1",
      expect.any(String),
      expect.any(String)
    );
  });

  it("renders a copyable booking link from a valid ?booking= url", async () => {
    const response = await calendar.render(
      makeCtx(
        {
          decisions: { rows: [] },
          calendar_accounts: { rows: [] },
          agent_addresses: INBOX_ROW,
        },
        "https://app.wzrd.tech/mini/calendar?booking=https%3A%2F%2Fagentmail.to%2Fbook%2Fagent"
      )
    );
    const html = await response.text();
    expect(html).toContain('data-prompt="https://agentmail.to/book/agent"');
    expect(html).toContain("/creator-os/prompt-copy.js");
  });

  it("never reflects a non-https ?booking= value", async () => {
    const response = await calendar.render(
      makeCtx(
        {
          decisions: { rows: [] },
          calendar_accounts: { rows: [] },
          agent_addresses: INBOX_ROW,
        },
        "https://app.wzrd.tech/mini/calendar?booking=javascript%3Aalert(1)"
      )
    );
    const html = await response.text();
    expect(html).not.toContain("javascript:alert");
    expect(html).toContain("Get shareable booking link");
  });
});

describe("calendar actions (agent calendar)", () => {
  it("booking action 303s back with the minted url in the query", async () => {
    const form = new FormData();
    form.set("action", "booking");
    const response = await calendar.action!(
      makeCtx({ agent_addresses: INBOX_ROW }),
      form
    );
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("booking")).toBe(
      "https://agentmail.to/book/agent"
    );
    expect(createBookingLink).toHaveBeenCalledWith("inbox-1");
  });

  it("approve RSVPs the hosted event when the invite carried a UID", async () => {
    const form = new FormData();
    form.set("action", "approve");
    form.set("decision", "d-1");
    await calendar.action!(
      makeCtx({
        decisions: {
          single: {
            id: "d-1",
            kind: "calendar_add",
            ref: "/home/user/.hermes/calendar/inbox/invite.ics",
            status: "pending",
            payload: { event_uid: "uid-1" },
          },
        },
        agent_addresses: INBOX_ROW,
      }),
      form
    );
    expect(approveInboxEvent).toHaveBeenCalled();
    expect(rsvpCalendarEvent).toHaveBeenCalledWith(
      "inbox-1",
      "uid-1",
      "accepted"
    );
  });

  it("dismiss RSVPs declined", async () => {
    const form = new FormData();
    form.set("action", "dismiss");
    form.set("decision", "d-1");
    await calendar.action!(
      makeCtx({
        decisions: {
          single: {
            id: "d-1",
            kind: "calendar_add",
            ref: "/x.ics",
            status: "pending",
            payload: { event_uid: "uid-1" },
          },
        },
        agent_addresses: INBOX_ROW,
      }),
      form
    );
    expect(dismissInboxEvent).toHaveBeenCalled();
    expect(rsvpCalendarEvent).toHaveBeenCalledWith(
      "inbox-1",
      "uid-1",
      "declined"
    );
  });

  it("save_event with attendees creates the hosted event that mails invites", async () => {
    const form = new FormData();
    form.set("action", "save_event");
    form.set("title", "Sync");
    form.set("starts_at", "2026-08-20T19:00");
    form.set("ends_at", "2026-08-20T20:00");
    form.set("attendees", "Sam@x.com, not-an-email, kai@y.org");
    await calendar.action!(makeCtx({ agent_addresses: INBOX_ROW }), form);
    expect(upsertLocalEvent).toHaveBeenCalled();
    expect(createCalendarEvent).toHaveBeenCalledWith("inbox-1", {
      summary: "Sync",
      start: "2026-08-20T19:00:00",
      end: "2026-08-20T20:00:00",
      attendees: [{ email: "sam@x.com" }, { email: "kai@y.org" }],
    });
  });

  it("save_event without attendees never touches the hosted calendar", async () => {
    const form = new FormData();
    form.set("action", "save_event");
    form.set("title", "Solo");
    form.set("starts_at", "2026-08-20T19:00");
    await calendar.action!(makeCtx({ agent_addresses: INBOX_ROW }), form);
    expect(upsertLocalEvent).toHaveBeenCalled();
    expect(createCalendarEvent).not.toHaveBeenCalled();
  });
});
