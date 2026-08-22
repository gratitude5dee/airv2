import { describe, expect, it } from "vitest";
import { canonicalApiUrl } from "./handoffUrl";

const ORIGIN = "https://mini.wzrd.tech";

describe("canonicalApiUrl", () => {
  it("maps relay-relative apiUrls back to the Onairos host", () => {
    expect(canonicalApiUrl("/api/mini/onairos/inferenceTest", ORIGIN)).toBe(
      "https://api2.onairos.uk/inferenceTest"
    );
  });

  it("maps absolute relay apiUrls on our origin, keeping the query", () => {
    expect(
      canonicalApiUrl(`${ORIGIN}/api/mini/onairos/persona?full=1`, ORIGIN)
    ).toBe("https://api2.onairos.uk/persona?full=1");
  });

  it("passes absolute Onairos apiUrls through untouched", () => {
    expect(canonicalApiUrl("https://api2.onairos.uk/persona", ORIGIN)).toBe(
      "https://api2.onairos.uk/persona"
    );
  });

  it("leaves other origins and lookalike paths alone for server validation", () => {
    expect(canonicalApiUrl("https://evil.example/persona", ORIGIN)).toBe(
      "https://evil.example/persona"
    );
    expect(canonicalApiUrl("/api/mini/onairosish/x", ORIGIN)).toBe(
      "/api/mini/onairosish/x"
    );
    expect(canonicalApiUrl("not a url", ORIGIN)).toBe("not a url");
  });
});
