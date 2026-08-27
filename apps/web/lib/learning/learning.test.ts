import { describe, expect, it } from "vitest";
import {
  FEEDBACK_REASONS,
  LEARNING_MODES,
  isFeedbackReason,
  isLearningMode,
} from "./learning";
import { HARD_GATES, LEARNING_PLAN, SOFT_SCORE_DIMENSIONS } from "./plan";

describe("learning modes", () => {
  it("accepts the four V10 modes", () => {
    for (const mode of LEARNING_MODES) expect(isLearningMode(mode)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLearningMode("training")).toBe(false);
    expect(isLearningMode("")).toBe(false);
  });
});

describe("feedback reasons", () => {
  it("matches the V10 enum exactly", () => {
    expect(FEEDBACK_REASONS).toEqual([
      "worked",
      "wrong_result",
      "did_not_finish",
      "missed_context",
      "unnecessary_question",
      "unsafe_or_unapproved",
      "too_slow",
      "too_expensive",
      "style_or_preference",
      "other",
    ]);
    for (const reason of FEEDBACK_REASONS) {
      expect(isFeedbackReason(reason)).toBe(true);
    }
    expect(isFeedbackReason("free_text")).toBe(false);
  });
});

describe("learning plan (admin surface)", () => {
  it("carries the eight hard gates and eleven score dimensions", () => {
    expect(HARD_GATES).toHaveLength(8);
    expect(SOFT_SCORE_DIMENSIONS).toHaveLength(11);
  });

  it("stays content-free: no keys that could carry owner content", () => {
    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
      } else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          keys.add(key);
          walk(child);
        }
      }
    };
    walk(LEARNING_PLAN);
    for (const banned of ["prompt", "correction", "fixture", "memory", "body"]) {
      expect(keys.has(banned)).toBe(false);
    }
  });

  it("describes every plan mode from the mode enum", () => {
    expect(LEARNING_PLAN.modes.map((m) => m.mode)).toEqual([...LEARNING_MODES]);
  });
});
