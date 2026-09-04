// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  next,
  shouldIntercept,
  type State,
} from "./calendar-month";

describe("calendar month interception", () => {
  it("intercepts a plain tile click", () => {
    expect(
      shouldIntercept({
        tag: "A",
        classList: ["mo-cell", "mo-tile"],
        button: 0,
        modifiers: false,
        closestClasses: ["mo-cell", "mo-tile"],
      })
    ).toBe(true);
  });

  it.each([
    "mo-add",
    "mo-dot",
    "mo-chip",
    "mo-nav",
    "mo-persona",
    "mo-close-link",
    "more",
  ])("does not intercept %s links", (className) => {
    expect(
      shouldIntercept({
        tag: "A",
        classList: ["mo-tile", className],
        button: 0,
        modifiers: false,
        closestClasses: ["mo-tile", className],
      })
    ).toBe(false);
  });

  it("does not intercept modified or non-primary clicks", () => {
    const input = {
      tag: "A",
      classList: ["mo-tile"],
      button: 0,
      modifiers: false,
      closestClasses: ["mo-tile"],
    };
    expect(shouldIntercept({ ...input, button: 1 })).toBe(false);
    expect(shouldIntercept({ ...input, button: 2 })).toBe(false);
    expect(shouldIntercept({ ...input, modifiers: true })).toBe(false);
  });
});

describe("calendar month reducer", () => {
  it("opens, ends animation, and closes", () => {
    const initial: State = { open: null, animating: false };
    const opened = next(initial, { type: "open", day: "2026-03-08" });
    expect(opened).toEqual({
      state: { open: "2026-03-08", animating: true },
      effects: [
        { kind: "openStrip", day: "2026-03-08" },
        { kind: "replaceUrl", day: "2026-03-08" },
      ],
    });
    const ended = next(opened.state, { type: "animEnd" });
    expect(ended.state).toEqual({ open: "2026-03-08", animating: false });
    expect(next(ended.state, { type: "close" })).toEqual({
      state: { open: null, animating: true },
      effects: [
        { kind: "closeStrip", day: "2026-03-08" },
        { kind: "replaceUrl", day: null },
        { kind: "focusTile", day: "2026-03-08" },
      ],
    });
  });

  it("switches from one open day to another", () => {
    expect(
      next(
        { open: "2026-03-08", animating: false },
        { type: "open", day: "2026-03-09" }
      )
    ).toEqual({
      state: { open: "2026-03-09", animating: true },
      effects: [
        { kind: "closeStrip", day: "2026-03-08" },
        { kind: "openStrip", day: "2026-03-09" },
        { kind: "replaceUrl", day: "2026-03-09" },
      ],
    });
  });

  it("ignores open and close while animating", () => {
    const state: State = { open: "2026-03-08", animating: true };
    expect(next(state, { type: "open", day: "2026-03-09" })).toEqual({
      state,
      effects: [],
    });
    expect(next(state, { type: "close" })).toEqual({ state, effects: [] });
  });

  it("applies popstate without replacing the URL", () => {
    expect(
      next({ open: null, animating: false }, {
        type: "popstate",
        day: "2026-03-09",
      })
    ).toEqual({
      state: { open: "2026-03-09", animating: true },
      effects: [{ kind: "openStrip", day: "2026-03-09" }],
    });
    expect(
      next({ open: "2026-03-08", animating: false }, {
        type: "popstate",
        day: null,
      })
    ).toEqual({
      state: { open: null, animating: true },
      effects: [
        { kind: "closeStrip", day: "2026-03-08" },
        { kind: "focusTile", day: "2026-03-08" },
      ],
    });
  });
});

describe("calendar month module safety", () => {
  it("imports in Node and contains no forbidden browser side effects", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./calendar-month.ts", import.meta.url)),
      "utf8"
    );
    for (const token of [
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "document.cookie",
      "eval(",
    ]) {
      expect(source).not.toContain(token);
    }
  });
});
