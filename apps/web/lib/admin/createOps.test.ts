/**
 * V12 §12 — the Create funnel math: every stage present in the funnel,
 * interpolated percentiles, stage-to-stage medians from the intake
 * timestamps, builds by status and first hard rule, QA distribution, tests
 * ratio, mirror tally and template breakdown.
 */
import { describe, expect, it } from "vitest";
import {
  asBuildMeta,
  asIntakeMeta,
  asVersionMeta,
  buildsFrom,
  byTemplateFrom,
  firstHardRule,
  funnelFrom,
  median,
  mediansFrom,
  mirrorFrom,
  percentile,
  qaFrom,
  testsFrom,
  type IntakeMeta,
} from "./createOps";
import { INTAKE_STAGES } from "../create/intake";

const intake = (overrides: Partial<IntakeMeta>): IntakeMeta => ({
  stage: "asking",
  template: null,
  opened_at: "2026-09-01T00:00:00.000Z",
  confirmed_at: null,
  dev_ready_at: null,
  production_at: null,
  mirror_error: null,
  ...overrides,
});

describe("percentile / median", () => {
  it("is null on an empty sample and interpolates otherwise", () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(median([3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([10, 20, 30, 40, 50], 0.9)).toBe(46);
    expect(percentile([5, Number.NaN, 1], 0)).toBe(1);
  });
});

describe("funnelFrom", () => {
  it("counts every §5.1 stage, zero-filled, ignoring unknown stages", () => {
    const funnel = funnelFrom([
      intake({ stage: "asking" }),
      intake({ stage: "asking" }),
      intake({ stage: "production" }),
      intake({ stage: "mystery" }),
    ]);
    expect(Object.keys(funnel)).toEqual([...INTAKE_STAGES]);
    expect(funnel.asking).toBe(2);
    expect(funnel.production).toBe(1);
    expect(funnel.failed).toBe(0);
  });
});

describe("mediansFrom", () => {
  it("derives whole-second medians from the timestamp columns", () => {
    const medians = mediansFrom([
      intake({
        confirmed_at: "2026-09-01T00:10:00.000Z",
        dev_ready_at: "2026-09-01T00:20:00.000Z",
        production_at: "2026-09-01T01:20:00.000Z",
      }),
      intake({
        confirmed_at: "2026-09-01T00:30:00.000Z",
        dev_ready_at: "2026-09-01T00:31:00.000Z",
      }),
      intake({ confirmed_at: "2026-08-31T00:00:00.000Z" }), // clock skew: ignored
    ]);
    expect(medians).toEqual({
      first_question: null,
      plan: 1200,
      confirm_to_dev: 330,
      dev_to_prod: 3600,
    });
  });

  it("is all-null without any completed leg", () => {
    expect(mediansFrom([intake({})])).toEqual({
      first_question: null,
      plan: null,
      confirm_to_dev: null,
      dev_to_prod: null,
    });
  });
});

describe("buildsFrom / firstHardRule", () => {
  it("counts failed builds by their first hard rule", () => {
    const result = buildsFrom([
      { status: "succeeded", findings: [] },
      {
        status: "failed",
        findings: [
          { file: "a", rule: "size.soft", hint: "", severity: "soft" },
          { file: "b", rule: "csp.host-reference", hint: "", severity: "hard" },
        ],
      },
      { status: "failed", findings: [{ file: "c", rule: "tests.locked-removed", hint: "" }] },
      { status: "failed", findings: null },
      { status: "running", findings: [] },
    ]);
    expect(result).toEqual({
      total: 5,
      failed: 3,
      by_rule: { "csp.host-reference": 1, "tests.locked-removed": 1 },
    });
    expect(firstHardRule("nope")).toBeNull();
    expect(firstHardRule([{ rule: 1 }])).toBeNull();
  });
});

describe("qaFrom / testsFrom / mirrorFrom / byTemplateFrom", () => {
  const versions = [
    { qa_score: 90, tests_total: 4, tests_passed: 4, mirrored_at: "2026-09-02T00:00:00.000Z" },
    { qa_score: 60, tests_total: 2, tests_passed: 1, mirrored_at: null },
    { qa_score: null, tests_total: null, tests_passed: null, mirrored_at: null },
    { qa_score: 75, tests_total: 0, tests_passed: 0, mirrored_at: null },
  ];

  it("summarises QA scores", () => {
    expect(qaFrom(versions)).toEqual({ p50: 75, p90: 87, below_70: 1 });
    expect(qaFrom([])).toEqual({ p50: null, p90: null, below_70: 0 });
  });

  it("reports declared tests and the pass ratio", () => {
    expect(testsFrom(versions)).toEqual({ declared: 3, passed_ratio: 0.833 });
    expect(testsFrom([versions[2]!])).toEqual({ declared: 0, passed_ratio: null });
  });

  it("tallies mirror successes and failures", () => {
    expect(
      mirrorFrom(versions, [intake({ mirror_error: "push failed" }), intake({})])
    ).toEqual({ ok: 1, failed: 1 });
  });

  it("breaks intakes down by template", () => {
    expect(
      byTemplateFrom([
        intake({ template: "landing" }),
        intake({ template: "landing" }),
        intake({ template: "tool" }),
        intake({}),
      ])
    ).toEqual({ landing: 2, tool: 1 });
  });
});

describe("row adapters", () => {
  it("normalise raw rows to metadata", () => {
    expect(
      asIntakeMeta({ stage: "qa", template: "", opened_at: "x", mirror_error: null })
    ).toEqual({
      stage: "qa",
      template: null,
      opened_at: "x",
      confirmed_at: null,
      dev_ready_at: null,
      production_at: null,
      mirror_error: null,
    });
    expect(asBuildMeta({ status: "failed", findings: [] })).toEqual({
      status: "failed",
      findings: [],
    });
    expect(
      asVersionMeta({ qa_score: "80", tests_total: 3, tests_passed: null, mirrored_at: null })
    ).toEqual({ qa_score: 80, tests_total: 3, tests_passed: null, mirrored_at: null });
  });
});
