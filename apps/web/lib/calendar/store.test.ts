import { describe, expect, it } from "vitest";
import { parseBoxSource, parseCalendarEvent } from "./store";

describe("parseCalendarEvent", () => {
  it("accepts the normalized event shape", () => {
    expect(
      parseCalendarEvent({
        id: "event-1",
        source: "google",
        source_ref: "google-1",
        title: "Standup",
        starts_at: "2026-08-01T09:00:00Z",
        ends_at: "2026-08-01T09:30:00Z",
        all_day: false,
        attendees: ["alice@example.com"],
        status: "confirmed",
      })
    ).toMatchObject({
      id: "event-1",
      source: "google",
      attendees: ["alice@example.com"],
    });
  });

  it("treats explicit JSON null optionals as absent", () => {
    expect(
      parseCalendarEvent({
        id: "event-1",
        source: "google",
        source_ref: "google-1",
        title: "Standup",
        starts_at: "2026-08-01T09:00:00Z",
        ends_at: "2026-08-01T09:30:00Z",
        all_day: false,
        location: null,
        attendees_count: null,
        attendees: null,
        url: null,
        notes_ref: null,
        status: null,
      })
    ).toEqual({
      id: "event-1",
      source: "google",
      source_ref: "google-1",
      title: "Standup",
      starts_at: "2026-08-01T09:00:00Z",
      ends_at: "2026-08-01T09:30:00Z",
      all_day: false,
    });
  });

  it("rejects missing required fields and invalid optional fields", () => {
    expect(parseCalendarEvent({ id: "event-1", title: "Missing source" })).toBeUndefined();
    expect(
      parseCalendarEvent({
        id: "event-1",
        source: "google",
        source_ref: "google-1",
        title: "Standup",
        starts_at: "2026-08-01T09:00:00Z",
        ends_at: "2026-08-01T09:30:00Z",
        all_day: false,
        attendees: [42],
      })
    ).toBeUndefined();
  });
});

describe("parseBoxSource", () => {
  it("accepts supported providers and rejects malformed credentials", () => {
    expect(
      parseBoxSource({ id: "source-1", provider: "calcom", secret: "secret" })
    ).toEqual({ id: "source-1", provider: "calcom", secret: "secret" });
    expect(parseBoxSource({ id: "source-1", provider: "google" })).toBeUndefined();
  });
});
