import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
  env: {
    agentmailApiKey: () => "agentmail-test-key",
  },
}));

import {
  createBookingLink,
  createCalendarEvent,
  getCalendarFreeBusy,
  rsvpCalendarEvent,
} from "./calendar";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createCalendarEvent", () => {
  it("posts the event to the v1 calendar surface with X-API-Key auth", async () => {
    const fetchMock = vi.fn(async () => ok({ event_uid: "ev-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createCalendarEvent("inbox/one", {
        summary: "Dinner",
        start: "2026-08-20T19:00:00",
        end: "2026-08-20T20:00:00",
        attendees: [{ email: "sam@example.com", name: "Sam" }],
      })
    ).resolves.toEqual({ event_uid: "ev-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.agentmail.to/v1/inboxes/inbox%2Fone/calendar/events",
      expect.objectContaining({
        method: "POST",
        headers: {
          "X-API-Key": "agentmail-test-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: "Dinner",
          start: "2026-08-20T19:00:00",
          end: "2026-08-20T20:00:00",
          attendees: [{ email: "sam@example.com", name: "Sam" }],
        }),
      })
    );
  });
});

describe("rsvpCalendarEvent", () => {
  it("posts the status to the event's rsvp endpoint", async () => {
    const fetchMock = vi.fn(async () => ok({}));
    vi.stubGlobal("fetch", fetchMock);

    await rsvpCalendarEvent("inbox-1", "uid/2", "accepted");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.agentmail.to/v1/inboxes/inbox-1/calendar/events/uid%2F2/rsvp",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ status: "accepted" }),
      })
    );
  });
});

describe("getCalendarFreeBusy", () => {
  it("reads busy slots from a {busy: [...]} envelope", async () => {
    const fetchMock = vi.fn(async () =>
      ok({ busy: [{ start: "a", end: "b" }, { start: 1 }] })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getCalendarFreeBusy("inbox-1", "2026-01-01", "2026-01-08")
    ).resolves.toEqual([{ start: "a", end: "b" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.agentmail.to/v1/inboxes/inbox-1/calendar/free-busy?start=2026-01-01&end=2026-01-08",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("accepts a bare array and drops malformed slots", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok([{ start: "a", end: "b" }, "junk"]))
    );
    await expect(getCalendarFreeBusy("i", "s", "e")).resolves.toEqual([
      { start: "a", end: "b" },
    ]);
  });
});

describe("createBookingLink", () => {
  it("returns the https booking url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok({ url: "https://agentmail.to/book/agent" }))
    );
    await expect(createBookingLink("inbox-1")).resolves.toBe(
      "https://agentmail.to/book/agent"
    );
  });

  it("rejects a response without an https url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok({ url: "javascript:alert(1)" }))
    );
    await expect(createBookingLink("inbox-1")).rejects.toThrow(
      "booking response had no url"
    );
  });
});
