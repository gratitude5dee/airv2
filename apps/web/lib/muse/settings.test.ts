import { describe, expect, it } from "vitest";
import { normalizeMuseScopes } from "./contracts";
import { normalizeMuseSettings } from "./settings";

describe("Muse contract normalization", () => {
  it("keeps only declared scopes in the consent/key order", () => {
    expect(normalizeMuseScopes(["wallet:request", "unknown", "profile", "profile"]))
      .toEqual(["profile", "wallet:request"]);
  });

  it("fails closed to bounded update settings", () => {
    expect(normalizeMuseSettings({
      updates_enabled: "yes",
      daily_cap: 900,
      quiet_hours: { start: "25:00", end: "08:15" },
      mode_default: "always",
    })).toEqual({
      updates_enabled: true,
      daily_cap: 30,
      quiet_hours: { start: "22:00", end: "08:15" },
      mode_default: "off",
      wake_email: false,
    });
  });
});
