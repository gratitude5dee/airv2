import { describe, expect, it } from "vitest";
import { mergeHomeOrder } from "./account";

describe("mergeHomeOrder", () => {
  it("reorders submitted slugs within their saved slots", () => {
    expect(mergeHomeOrder(["a", "b", "c", "d"], ["d", "b"])).toEqual([
      "a",
      "d",
      "c",
      "b",
    ]);
  });

  it("keeps unsubmitted slugs in place", () => {
    expect(mergeHomeOrder(["x", "a", "y", "b"], ["b", "a"])).toEqual([
      "x",
      "b",
      "y",
      "a",
    ]);
  });

  it("appends submitted slugs unknown to the saved order", () => {
    expect(mergeHomeOrder(["a", "b"], ["b", "new", "a"])).toEqual([
      "b",
      "a",
      "new",
    ]);
  });

  it("returns the submission when nothing was saved", () => {
    expect(mergeHomeOrder([], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("leaves the saved order untouched by an empty submission", () => {
    expect(mergeHomeOrder(["a", "b"], [])).toEqual(["a", "b"]);
  });
});
