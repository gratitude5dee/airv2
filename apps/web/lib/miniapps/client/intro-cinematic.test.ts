// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allowsWordmarkBlast } from "./intro-cinematic";

describe("cinematic wordmark blast", () => {
  it("keeps the film available while rejecting the GPU effect on the mini-app", () => {
    expect(allowsWordmarkBlast(false, false)).toBe(false);
    expect(allowsWordmarkBlast(true, true)).toBe(false);
    expect(allowsWordmarkBlast(true, false)).toBe(true);
  });
});
