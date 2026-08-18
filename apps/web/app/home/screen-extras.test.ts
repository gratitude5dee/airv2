import { describe, expect, it } from "vitest";
import { awakeIntervals } from "./screen-extras";

const NOW = Date.parse("2026-08-18T12:00:00Z");
const HOUR = 3600_000;

describe("awakeIntervals", () => {
  it("pairs ready→stopped edges into awake spans", () => {
    const spans = awakeIntervals(
      [
        { state: "ready", created_at: new Date(NOW - 5 * HOUR).toISOString() },
        { state: "stopped", created_at: new Date(NOW - 3 * HOUR).toISOString() },
      ],
      false,
      NOW
    );
    expect(spans).toEqual([{ from: NOW - 5 * HOUR, to: NOW - 3 * HOUR }]);
  });

  it("extends an unclosed ready edge to now", () => {
    const spans = awakeIntervals(
      [{ state: "ready", created_at: new Date(NOW - 2 * HOUR).toISOString() }],
      true,
      NOW
    );
    expect(spans).toEqual([{ from: NOW - 2 * HOUR, to: NOW }]);
  });

  it("treats a leading stopped edge as on-since-window-start", () => {
    const spans = awakeIntervals(
      [
        { state: "stopped", created_at: new Date(NOW - 10 * HOUR).toISOString() },
      ],
      false,
      NOW
    );
    expect(spans).toEqual([{ from: NOW - 48 * HOUR, to: NOW - 10 * HOUR }]);
  });

  it("ignores malformed timestamps", () => {
    expect(
      awakeIntervals([{ state: "ready", created_at: "not-a-date" }], false, NOW)
    ).toEqual([]);
  });

  it("shows only the current stretch when on with no history", () => {
    const spans = awakeIntervals([], true, NOW);
    expect(spans).toHaveLength(1);
    expect(spans[0]?.to).toBe(NOW);
  });
});
