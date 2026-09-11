import { describe, expect, it } from "vitest";
import { FIRST_PARTY_ART, firstPartyAppArt, resolveAppArt } from "./app-art";

describe("first party app artwork", () => {
  it("covers every bundled Wabi icon with a local public URL", () => {
    expect(Object.keys(FIRST_PARTY_ART)).toHaveLength(23);
    for (const path of Object.values(FIRST_PARTY_ART)) {
      expect(path).toMatch(/^\/app-icons\/wabi-v1\/[a-z0-9-]+\.png$/);
    }
  });

  it("keeps publisher artwork ahead of the bundled fallback", () => {
    expect(resolveAppArt("calendar", "https://cdn.example/icon.png")).toBe(
      "https://cdn.example/icon.png"
    );
    expect(resolveAppArt("calendar")).toBe("/app-icons/wabi-v1/calendar.png");
    expect(firstPartyAppArt("community-app")).toBeNull();
  });
});
