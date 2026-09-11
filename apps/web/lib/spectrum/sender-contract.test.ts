/**
 * Contract test for `advancedClientForLine`: every location request depends
 * on the undocumented `Spectrum.__internal.platforms` shape. If spectrum-ts
 * renames or reshapes it, these tests fail loudly instead of every Find My
 * request silently returning "unavailable".
 */
import { describe, expect, it } from "vitest";
import { advancedClientForLine } from "./sender";

const locations = { get: () => undefined, request: () => undefined };

function appWithRuntime(runtime: unknown): unknown {
  return {
    __internal: { platforms: new Map([["iMessage", { client: runtime }]]) },
  };
}

describe("advancedClientForLine", () => {
  it("picks the RemoteClient whose entry phone matches the line", () => {
    const wanted = { locations, tag: "wanted" };
    const app = appWithRuntime([
      { client: { locations, tag: "other" }, phone: "+15550001111" },
      { client: wanted, phone: "+15551234567" },
    ]);
    expect(advancedClientForLine(app, "+15551234567")).toBe(wanted);
  });

  it("falls back to the sole entry on a single-line app", () => {
    const only = { locations };
    const app = appWithRuntime([{ client: only, phone: "+15550001111" }]);
    expect(advancedClientForLine(app, "+15559998888")).toBe(only);
  });

  it("returns undefined when the internals are absent or reshaped", () => {
    expect(advancedClientForLine({}, "+15551234567")).toBeUndefined();
    expect(
      advancedClientForLine({ __internal: {} }, "+15551234567")
    ).toBeUndefined();
    expect(
      advancedClientForLine({ __internal: { platforms: {} } }, "+15551234567")
    ).toBeUndefined();
    // platforms exists but holds no iMessage runtime.
    expect(
      advancedClientForLine(
        { __internal: { platforms: new Map() } },
        "+15551234567"
      )
    ).toBeUndefined();
    // runtime.client is not an entry array (e.g. a bare client object).
    expect(
      advancedClientForLine(appWithRuntime({ locations }), "+15551234567")
    ).toBeUndefined();
    expect(
      advancedClientForLine(appWithRuntime([]), "+15551234567")
    ).toBeUndefined();
  });
});
