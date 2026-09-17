import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  QA_PASS_MATRIX,
  QA_THRESHOLDS,
  QA_VIEWPORTS,
  QaError,
  QaReportSchema,
  recordQaScore,
  scoreReport,
  type QaPass,
  type QaReport,
} from "./qa";

const versions = vi.hoisted(() => ({ getVersion: vi.fn(async (): Promise<unknown> => null) }));
vi.mock("./versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./versions")>()),
  getVersion: versions.getVersion,
}));

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

  it("six passes on the wrong viewports do not count as the matrix", () => {
    const wrong = [500, 600, 700].flatMap((height) =>
      [false, true].map((reduced_motion) => pass({ viewport: { width: 390, height }, reduced_motion }))
    );
    expect(scoreReport(report(wrong)).failed).toEqual(["incomplete-matrix"]);
    // Five required cells plus a stray one is still short by a cell.
    const nearly = [...fullMatrix().slice(0, 5), pass({ viewport: { width: 390, height: 500 } })];
    expect(scoreReport(report(nearly)).failed).toEqual(["incomplete-matrix"]);
    // Duplicates of one required cell never fill in for another.
    const repeated = [...fullMatrix().slice(0, 5), pass()];
    expect(scoreReport(report(repeated)).failed).toEqual(["incomplete-matrix"]);
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

describe("recordQaScore (V12 §8.4 test counts)", () => {
  function fakeSupabase(): { client: SupabaseClient; updates: Record<string, unknown>[] } {
    const updates: Record<string, unknown>[] = [];
    const client = {
      from: (table: string) => {
        expect(table).toBe("miniapp_versions");
        return {
          update: (patch: Record<string, unknown>) => {
            updates.push(patch);
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    } as unknown as SupabaseClient;
    return { client, updates };
  }
  const row = { id: "ver-1", version: "v1700000000001", qa_score: null };

  it("stamps qa_score and the two counts, never the failed ids (CR21)", async () => {
    versions.getVersion.mockResolvedValueOnce(row);
    const { client, updates } = fakeSupabase();
    const result = await recordQaScore(client, "app-1", report(fullMatrix()), {
      total: 4,
      passed: 3,
      failed_ids: ["rsvp-saves"],
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ qa_score: 100, tests_total: 4, tests_passed: 3 });
    expect(JSON.stringify(updates[0])).not.toContain("rsvp-saves");
    expect(result.row).toMatchObject({ qa_score: 100, tests_total: 4, tests_passed: 3 });
  });

  it("leaves the counts alone when no test run came with the report", async () => {
    versions.getVersion.mockResolvedValueOnce(row);
    const { client, updates } = fakeSupabase();
    await recordQaScore(client, "app-1", report(fullMatrix()));
    expect(updates[0]).not.toHaveProperty("tests_total");
    expect(updates[0]).not.toHaveProperty("tests_passed");
  });

  it("404s an unknown version before writing anything", async () => {
    versions.getVersion.mockResolvedValueOnce(null);
    const { client, updates } = fakeSupabase();
    await expect(recordQaScore(client, "app-1", report(fullMatrix()))).rejects.toBeInstanceOf(QaError);
    expect(updates).toEqual([]);
  });
});
