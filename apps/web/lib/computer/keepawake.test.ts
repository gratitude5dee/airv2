import { describe, expect, it } from "vitest";
import {
  clampKeepAwakeMinutes,
  keepAwakeMinutes,
  keepAwakePromptRef,
} from "./keepawake";

const ID = "123e4567-e89b-42d3-a456-426614174000";

describe("clampKeepAwakeMinutes", () => {
  it("clamps into the 15–240 window", () => {
    expect(clampKeepAwakeMinutes(1)).toBe(15);
    expect(clampKeepAwakeMinutes(60)).toBe(60);
    expect(clampKeepAwakeMinutes(10_000)).toBe(240);
    expect(clampKeepAwakeMinutes(Number.NaN)).toBe(15);
  });
});

describe("keepAwakeMinutes", () => {
  it("round-trips the ref minted by keepAwakePromptRef", () => {
    const ref = keepAwakePromptRef(ID, 90);
    expect(ref).toBe(`.hermes/schedules/keepawake-90m-${ID}.md`);
    expect(keepAwakeMinutes({ source: "computer", prompt_ref: ref })).toBe(90);
  });

  it("requires BOTH the computer source and the keepawake ref shape", () => {
    const ref = keepAwakePromptRef(ID, 30);
    // An ordinary calendar schedule can never short-circuit into a silent
    // wake, even if its ref looked right.
    expect(keepAwakeMinutes({ source: "calendar", prompt_ref: ref })).toBe(
      null
    );
    expect(
      keepAwakeMinutes({
        source: "computer",
        prompt_ref: `.hermes/schedules/${ID}.md`,
      })
    ).toBe(null);
    expect(
      keepAwakeMinutes({ source: "computer", prompt_ref: "evil/path.md" })
    ).toBe(null);
  });

  it("clamps out-of-range encoded minutes", () => {
    expect(
      keepAwakeMinutes({
        source: "computer",
        prompt_ref: `.hermes/schedules/keepawake-999m-${ID}.md`,
      })
    ).toBe(240);
  });
});
