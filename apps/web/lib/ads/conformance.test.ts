import { describe, expect, it } from "vitest";
import {
  groupConformance,
  type AdGroupAsset,
  type AdGroupText,
} from "./conformance";
import {
  GOOGLE_PMAX_ASSET_GROUP,
  staleSpecs,
  AD_SPECS,
} from "../publish/specs/ads";
import type { BrandSource } from "../brand/types";

const brand: BrandSource = {
  name: "acme",
  label: "Acme",
  palette: { background: "#fff", midground: "#eee", foreground: "#000" },
  voice: { banned: ["revolutionize"] },
  claims: { forbidden: ["cures"] },
};

const text: AdGroupText = {
  headlines: ["Fresh coffee, fast"],
  longHeadlines: ["The neighborhood roaster that delivers same day"],
  descriptions: ["Order by noon, sip by three."],
  finalUrl: "https://acme.example",
};

function image(id: string, w: number, h: number): AdGroupAsset {
  return { id, kind: "png", w, h, duration: null, role: "image" };
}

const fullAssets: AdGroupAsset[] = [
  image("hero", 1910, 1000),
  image("square", 1200, 1200),
  image("portrait", 960, 1200),
  { id: "logo1", kind: "png", w: 512, h: 512, duration: null, role: "logo" },
  { id: "logo4", kind: "png", w: 1200, h: 300, duration: null, role: "logo" },
  { id: "v169", kind: "mp4", w: 1920, h: 1080, duration: 15, role: "video" },
  { id: "v916", kind: "mp4", w: 1080, h: 1920, duration: 15, role: "video" },
  { id: "v11", kind: "mp4", w: 1080, h: 1080, duration: 15, role: "video" },
];

describe("groupConformance", () => {
  it("reports a complete group as complete with an empty gap list", () => {
    const report = groupConformance(
      GOOGLE_PMAX_ASSET_GROUP,
      text,
      fullAssets,
      brand
    );
    expect(report.gaps).toEqual([]);
    expect(report.complete).toBe(true);
    expect(report.assets["hero"]).toContain("images/1.91:1");
    expect(report.assets["logo4"]).toContain("logos/4:1");
  });

  it("names every gap between the group and the spec", () => {
    const report = groupConformance(
      GOOGLE_PMAX_ASSET_GROUP,
      text,
      [image("hero", 1910, 1000)],
      brand
    );
    expect(report.complete).toBe(false);
    expect(report.gaps).toContain("images/1:1");
    expect(report.gaps).toContain("logos/1:1");
    expect(report.gaps).toContain("videos/9:16");
  });

  it("fails a 31-character headline against the 30-char limit", () => {
    const report = groupConformance(
      GOOGLE_PMAX_ASSET_GROUP,
      { ...text, headlines: ["a".repeat(31)] },
      fullAssets,
      brand
    );
    expect(report.complete).toBe(false);
    expect(report.textProblems).toContainEqual(
      expect.objectContaining({ field: "headlines", index: 0 })
    );
  });

  it("rejects headline counts above the spec maximum", () => {
    const report = groupConformance(
      GOOGLE_PMAX_ASSET_GROUP,
      { ...text, headlines: Array(16).fill("ok") },
      fullAssets,
      brand
    );
    expect(report.textProblems).toContainEqual(
      expect.objectContaining({ field: "headlines", index: -1 })
    );
  });

  it("a headline making a forbidden claim never passes", () => {
    const report = groupConformance(
      GOOGLE_PMAX_ASSET_GROUP,
      { ...text, headlines: ["Cures Monday mornings"] },
      fullAssets,
      brand
    );
    expect(report.complete).toBe(false);
    expect(report.copyProblems).toContainEqual(
      expect.objectContaining({
        field: "headlines",
        violation: expect.objectContaining({ kind: "claims.forbidden" }),
      })
    );
  });

  it("flags banned voice terms in descriptions", () => {
    const report = groupConformance(
      GOOGLE_PMAX_ASSET_GROUP,
      { ...text, descriptions: ["We revolutionize coffee."] },
      fullAssets,
      brand
    );
    expect(report.copyProblems).toContainEqual(
      expect.objectContaining({
        field: "descriptions",
        violation: expect.objectContaining({ kind: "voice.banned" }),
      })
    );
  });

  it("excludes too-short videos from video slots", () => {
    const report = groupConformance(
      GOOGLE_PMAX_ASSET_GROUP,
      text,
      [{ id: "v", kind: "mp4", w: 1920, h: 1080, duration: 5, role: "video" }],
      brand
    );
    expect(report.assets["v"]).toEqual([]);
  });
});

describe("spec registry", () => {
  it("every spec carries a citation and verified_on date", () => {
    for (const spec of Object.values(AD_SPECS)) {
      expect(spec.citation).toMatch(/^https:\/\//);
      expect(spec.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("stale-spec check flags anything older than 90 days", () => {
    const wayLater = new Date("2027-06-01T00:00:00Z");
    expect(staleSpecs(wayLater).length).toBe(Object.keys(AD_SPECS).length);
    const fresh = new Date("2026-08-11T00:00:00Z");
    expect(staleSpecs(fresh)).toEqual([]);
  });
});
