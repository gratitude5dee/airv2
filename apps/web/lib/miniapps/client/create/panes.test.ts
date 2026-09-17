// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  INTAKE_STAGES,
  canConfirm,
  canFinalize,
  clampPercent,
  expiryCopy,
  finalizeProblem,
  iconProblem,
  isIntakeStage,
  isProgressStage,
  logTail,
  percentLabel,
  planVersionLabel,
  progressCaption,
  revisionsLabel,
  stageLabel,
} from "./panes";

describe("stage labels (§5.1, §8.5)", () => {
  it("spells underscored stages as words", () => {
    expect(stageLabel("plan_sent")).toBe("plan sent");
    expect(stageLabel("dev_ready")).toBe("dev ready");
    expect(stageLabel("decision_sent")).toBe("decision sent");
    expect(stageLabel("building")).toBe("building");
  });

  it("calls a failed intake 'needs you' and a missing one 'no plan yet'", () => {
    expect(stageLabel("failed")).toBe("needs you");
    expect(stageLabel(null)).toBe("no plan yet");
    expect(stageLabel(undefined)).toBe("no plan yet");
  });

  it("never emits an exclamation mark or an underscore", () => {
    for (const stage of INTAKE_STAGES) {
      expect(stageLabel(stage)).not.toMatch(/[!_]/);
    }
  });

  it("recognises the stage union", () => {
    expect(isIntakeStage("qa")).toBe(true);
    expect(isIntakeStage("shipped")).toBe(false);
    expect(isIntakeStage(3)).toBe(false);
  });

  it("polls through confirmed, building, qa and testing only", () => {
    expect(isProgressStage("confirmed")).toBe(true);
    expect(isProgressStage("building")).toBe(true);
    expect(isProgressStage("qa")).toBe(true);
    expect(isProgressStage("testing")).toBe(true);
    expect(isProgressStage("dev_ready")).toBe(false);
    expect(isProgressStage("plan_sent")).toBe(false);
    expect(isProgressStage(null)).toBe(false);
  });

  it("gates Build this and the finalize form on their stages", () => {
    expect(canConfirm("plan_sent")).toBe(true);
    expect(canConfirm("revising")).toBe(true);
    expect(canConfirm("confirmed")).toBe(false);
    expect(canFinalize("dev_ready")).toBe(true);
    expect(canFinalize("finalizing")).toBe(true);
    expect(canFinalize("building")).toBe(false);
  });
});

describe("percent formatting (§8.2)", () => {
  it("clamps into 0–100 and rounds to a whole number", () => {
    expect(clampPercent(45)).toBe(45);
    expect(clampPercent(45.6)).toBe(46);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(140)).toBe(100);
  });

  it("treats unreadable input as zero", () => {
    expect(clampPercent(undefined)).toBe(0);
    expect(clampPercent("45")).toBe(0);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(percentLabel(null)).toBe("0%");
  });

  it("renders the card caption without the app name", () => {
    expect(progressCaption("building", 45)).toBe("building · 45%");
    expect(progressCaption("dev_ready", 100)).toBe("dev ready · 100%");
    expect(progressCaption("failed", 65)).toBe("needs you · 65%");
  });
});

describe("plan copy", () => {
  it("names the plan version and counts revisions", () => {
    expect(planVersionLabel(null)).toBe("no plan yet");
    expect(planVersionLabel(1)).toBe("plan v1");
    expect(planVersionLabel(3)).toBe("plan v3");
    expect(revisionsLabel(0)).toBe("0 revisions");
    expect(revisionsLabel(1)).toBe("1 revision");
    expect(revisionsLabel(2)).toBe("2 revisions");
    expect(revisionsLabel(undefined)).toBe("0 revisions");
  });

  it("keeps the last lines of the build log, oldest first", () => {
    const log = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`);
    expect(logTail(log)).toEqual(log.slice(4));
    expect(logTail(log, 2)).toEqual(["line 11", "line 12"]);
    expect(logTail([])).toEqual([]);
    expect(logTail(null)).toEqual([]);
  });
});

describe("expiry copy (§6, CR17)", () => {
  const now = new Date("2026-09-17T12:00:00Z");

  it("counts whole days left", () => {
    expect(expiryCopy("2026-10-01T12:00:00Z", now)).toBe("expires in 14 days");
    expect(expiryCopy("2026-09-18T13:00:00Z", now)).toBe("expires in 1 day");
    expect(expiryCopy("2026-09-19T11:59:00Z", now)).toBe("expires in 1 day");
  });

  it("says today inside the last day and expired after", () => {
    expect(expiryCopy("2026-09-17T18:00:00Z", now)).toBe("expires today");
    expect(expiryCopy("2026-09-17T12:00:00Z", now)).toBe("expired");
    expect(expiryCopy("2026-09-01T00:00:00Z", now)).toBe("expired");
  });

  it("treats a missing or unreadable expiry as no dev build", () => {
    expect(expiryCopy(null, now)).toBe("no dev build");
    expect(expiryCopy(undefined, now)).toBe("no dev build");
    expect(expiryCopy("soon", now)).toBe("no dev build");
  });
});

describe("finalize checks (§9.1, §9.2)", () => {
  it("accepts a PNG, JPEG or WebP under 2 MB", () => {
    expect(iconProblem(null)).toBeNull();
    expect(iconProblem({ type: "image/png", size: 1024 })).toBeNull();
    expect(iconProblem({ type: "image/webp", size: 2 * 1024 * 1024 })).toBeNull();
  });

  it("refuses other types and oversized files", () => {
    expect(iconProblem({ type: "image/gif", size: 10 })).toBe(
      "icon must be a PNG, JPEG or WebP",
    );
    expect(iconProblem({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toBe(
      "icon must be under 2 MB",
    );
  });

  it("requires the dev build, a name of 60 or fewer and a description of 160 or fewer", () => {
    expect(
      finalizeProblem({ stage: "building", name: "Tour", description: "" }),
    ).toBe("finalize opens once the dev build is live");
    expect(
      finalizeProblem({ stage: "dev_ready", name: "  ", description: "" }),
    ).toBe("name is required");
    expect(
      finalizeProblem({
        stage: "dev_ready",
        name: "x".repeat(61),
        description: "",
      }),
    ).toBe("name must be 60 characters or fewer");
    expect(
      finalizeProblem({
        stage: "finalizing",
        name: "Tour",
        description: "y".repeat(161),
      }),
    ).toBe("description must be 160 characters or fewer");
    expect(
      finalizeProblem({ stage: "finalizing", name: "Tour", description: "one line" }),
    ).toBeNull();
  });
});
