import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  coverFor,
  staggerFor,
  stickersFor,
  stripRowFor,
  subCopy,
  tiltFor,
  type MosaicEvent,
} from "./calendar-mosaic";

const event = (id: string, starts_at: string, title = id): MosaicEvent => ({
  id,
  title,
  starts_at,
  all_day: false,
});

describe("calendar mosaic helpers", () => {
  it("has no imports so it stays bundle-safe", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./calendar-mosaic.ts", import.meta.url)),
      "utf8"
    );
    expect(source).not.toMatch(/^import\s/m);
  });

  it("selects and deduplicates up to four attendee photos", () => {
    const avatars = new Map(
      ["a@x.test", "b@x.test", "c@x.test", "d@x.test", "e@x.test"].map((email) => [
        email,
        { photoKey: `photos/${email}` },
      ])
    );
    const result = coverFor(
      [
        { ...event("late", "2026-01-01T11:00:00Z"), attendees: ["b@x.test", "a@x.test", "c@x.test"] },
        { ...event("early", "2026-01-01T09:00:00Z"), attendees: ["a@x.test", "d@x.test", "e@x.test"] },
      ],
      avatars,
      (key) => `https://media.test/${key}`,
      "#2b7fff"
    );
    expect(result).toEqual({
      kind: "photos",
      urls: [
        "https://media.test/photos/a@x.test",
        "https://media.test/photos/d@x.test",
        "https://media.test/photos/e@x.test",
        "https://media.test/photos/b@x.test",
      ],
    });
  });

  it("uses an initial for one event and a count for many without photos", () => {
    expect(coverFor([{ ...event("1", "2026-01-01", "  Lunch") }], new Map(), String, "#x")).toEqual({
      kind: "plate",
      color: "#x",
      count: 1,
      initial: "L",
    });
    expect(coverFor([event("1", "2026-01-01"), event("2", "2026-01-02")], new Map(), String, "#x")).toEqual({
      kind: "plate",
      color: "#x",
      count: 2,
      initial: "",
    });
  });

  it("keeps tilt deterministic and within the nine-step range", () => {
    const value = tiltFor("2026-09-01");
    expect(value).toBe(tiltFor("2026-09-01"));
    expect(value).toBeGreaterThanOrEqual(-2.4);
    expect(value).toBeLessThanOrEqual(2.4);
    expect((value / 0.6) % 1).toBe(0);
  });

  it("formats summary counts and omits zero segments", () => {
    expect(subCopy({ events: 14, people: 6, pending: 3 })).toBe("14 events · 6 people · 3 pending");
    expect(subCopy({ events: 1, people: 1, pending: 1 })).toBe("1 event · 1 person · 1 pending");
    expect(subCopy({ events: 0, people: 0, pending: 0 })).toBe("No events");
  });

  it("applies sticker priority, truncation, and the two-sticker cap", () => {
    expect(
      stickersFor([
        { ...event("1", "2026-01-01"), status: "pending", location: "12345678901234567890", all_day: true },
      ])
    ).toEqual([
      { kind: "pending" },
      { kind: "loc", text: "1234567890123…", full: "12345678901234567890" },
    ]);
    expect(stickersFor([{ ...event("1", "2026-01-01"), all_day: true }])).toEqual([{ kind: "allday" }]);
  });

  it("places strips below the first row and above later rows", () => {
    expect(stripRowFor(0, 5)).toBe(1);
    expect(stripRowFor(0, 1)).toBe(1);
    expect(stripRowFor(2, 5)).toBe(2);
    expect(staggerFor(9, 0)).toBe(108);
    expect(staggerFor(100, 0)).toBe(108);
  });
});
