import { describe, expect, it } from "vitest";
import {
  QA_PASS_MATRIX,
  QA_THRESHOLDS,
  QA_VIEWPORTS,
  QaReportSchema,
  scoreReport,
  type QaPass,
  type QaReport,
} from "./qa";

function pass(over: Partial<QaPass> = {}): QaPass {
  return {
    viewport: { width: 390, height: 844 },
    reduced_motion: false,
    console_errors: 0,
    page_errors: 0,
    csp_reports: 0,
    off_origin_requests: 0,
    min_contrast: 7.2,
    contrast_violations: 0,
    small_targets: 0,
    horizontal_overflow: false,
    lcp_ms: 900,
    screenshot: "390x844-motion.png",
    ...over,
  };
}

/** The full §9.6 matrix: three Messages viewports × reduced motion on/off. */
function fullMatrix(over: Partial<QaPass> = {}): QaPass[] {
  return QA_VIEWPORTS.flatMap((viewport) =>
    [false, true].map((reduced_motion) => pass({ viewport: { ...viewport }, reduced_motion, ...over }))
  );
}

function report(passes: QaPass[]): QaReport {
  return { version: "v1700000000001", passes };
}

describe("Preview QA matrix", () => {
  it("covers 390×360, 390×760 and 390×844 with reduced motion on and off", () => {
    expect(QA_VIEWPORTS.map((v) => `${v.width}x${v.height}`)).toEqual(["390x360", "390x760", "390x844"]);
    expect(QA_PASS_MATRIX).toBe(6);
    expect(QA_THRESHOLDS).toMatchObject({ minContrast: 4.5, minTouchTargetPx: 44, maxLcpMs: 2500 });
  });
});

describe("scoreReport", () => {
  it("a clean full matrix scores 100 with nothing failed", () => {
    const summary = scoreReport(report(fullMatrix()));
    expect(summary).toMatchObject({ score: 100, passes: 6, failed: [], off_origin_requests: 0 });
    expect(summary.min_contrast).toBe(7.2);
    expect(summary.max_lcp_ms).toBe(900);
  });

  it("any off-origin request floors the score at 0 (CR6)", () => {
    const passes = fullMatrix();
    passes[2] = pass({ ...passes[2], off_origin_requests: 1 });
    const summary = scoreReport(report(passes));
    expect(summary.score).toBe(0);
    expect(summary.failed).toContain("off-origin-requests");
    expect(summary.off_origin_requests).toBe(1);
  });

  it("penalizes each failing dimension once across passes and names the rule", () => {
    const summary = scoreReport(
      report(
        fullMatrix({
          min_contrast: 3.1,
          small_targets: 2,
          horizontal_overflow: true,
          lcp_ms: 3200,
          console_errors: 1,
        })
      )
    );
    expect(summary.failed).toEqual(
      expect.arrayContaining(["console-errors", "contrast", "touch-targets", "horizontal-overflow", "lcp"])
    );
    // 100 - 10 (console) - 15 (contrast) - 10 (targets) - 15 (overflow) - 10 (lcp), counted once, not ×6.
    expect(summary.score).toBe(40);
    expect(summary.min_contrast).toBe(3.1);
    expect(summary.max_lcp_ms).toBe(3200);
  });

  it("an incomplete matrix caps the score at 60", () => {
    const summary = scoreReport(report([pass(), pass({ reduced_motion: true })]));
    expect(summary.score).toBe(60);
    expect(summary.failed).toEqual(["incomplete-matrix"]);
  });

  it("page errors and CSP reports are the heaviest single penalties", () => {
    expect(scoreReport(report(fullMatrix({ page_errors: 1 }))).score).toBe(70);
    expect(scoreReport(report(fullMatrix({ csp_reports: 2 }))).score).toBe(75);
  });
});

describe("QaReportSchema", () => {
  it("accepts a content-free report and rejects page text, paths or extra keys", () => {
    expect(QaReportSchema.safeParse(report(fullMatrix())).success).toBe(true);
    expect(QaReportSchema.safeParse({ ...report(fullMatrix()), transcript: "Hello" }).success).toBe(false);
    expect(
      QaReportSchema.safeParse(report([pass({ screenshot: "../../etc/passwd" })])).success
    ).toBe(false);
    expect(QaReportSchema.safeParse(report([{ ...pass(), title: "Countdown" } as QaPass])).success).toBe(
      false
    );
  });

  it("requires a version id, at least one pass and at most the doubled matrix", () => {
    expect(QaReportSchema.safeParse({ version: "latest", passes: fullMatrix() }).success).toBe(false);
    expect(QaReportSchema.safeParse(report([])).success).toBe(false);
    expect(QaReportSchema.safeParse(report([...fullMatrix(), ...fullMatrix(), pass()])).success).toBe(false);
  });
});
