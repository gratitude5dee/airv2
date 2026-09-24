import { afterEach, describe, expect, it } from "vitest";
import {
  lockedIds,
  lockedTestsRemoved,
  MAX_TESTS,
  parseTestsSnapshot,
  scoreGate,
  TestResultsSchema,
  TestSchema,
  TestsSchema,
  type Test,
} from "./tests";

/** The §8.4 examples, `role` dropped per V13 §6.2. */
const SPEC_TESTS: Test[] = [
  { id: "hero-visible", see: "October tour", locked: true },
  { id: "tickets-link", tap: "[data-test=tickets]", expectHref: "https://dice.fm/", locked: true },
  { id: "countdown-ticks", wait: 1100, changed: "[data-test=countdown]" },
  { id: "rsvp-saves", type: ["[data-test=name]", "Ana"], tap: "[data-test=rsvp]", see: "Ana" },
  { id: "guest-readonly", missing: "[data-test=rsvp]" },
];

describe("air.json.tests[] schema (§8.4)", () => {
  it("accepts every spec example", () => {
    const parsed = TestsSchema.safeParse(SPEC_TESTS);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.length).toBe(5);
  });

  it("accepts viewport WxH; V13 dropped `role` (§6.2)", () => {
    expect(TestSchema.safeParse({ id: "a", viewport: "390x760", see: "x" }).success).toBe(true);
    expect(TestSchema.safeParse({ id: "a", viewport: "wide", see: "x" }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a", role: "owner", see: "x" }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a", role: "guest", see: "x" }).success).toBe(false);
  });

  it("requires a well-formed, unique id", () => {
    for (const id of ["Hero", "-lead", "a".repeat(49), "", "with space"]) {
      expect(TestSchema.safeParse({ id, see: "x" }).success).toBe(false);
    }
    expect(TestSchema.safeParse({ id: "a".repeat(48), see: "x" }).success).toBe(true);
    const duplicate = TestsSchema.safeParse([
      { id: "hero", see: "a" },
      { id: "hero", see: "b" },
    ]);
    expect(duplicate.success).toBe(false);
    expect(!duplicate.success && duplicate.error.issues[0]?.message).toMatch(/duplicate test id hero/);
  });

  it("refuses unknown verbs and a test with nothing to do", () => {
    expect(TestSchema.safeParse({ id: "a", click: "[x]" }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a" }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a", locked: true }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a", wait: 100 }).success).toBe(true);
  });

  it("bounds wait, needs a wait for changed and a tap for expectHref", () => {
    expect(TestSchema.safeParse({ id: "a", wait: 10_001 }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a", wait: -1 }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a", changed: "[x]" }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a", expectHref: "https://dice.fm/" }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a", tap: "[x]", expectHref: "not a url" }).success).toBe(false);
  });

  it("type takes exactly [selector, text]", () => {
    expect(TestSchema.safeParse({ id: "a", type: ["[x]", "Ana"] }).success).toBe(true);
    expect(TestSchema.safeParse({ id: "a", type: "[x]" }).success).toBe(false);
    expect(TestSchema.safeParse({ id: "a", type: ["[x]"] }).success).toBe(false);
  });

  it("caps the array at 40 tests", () => {
    const many = Array.from({ length: MAX_TESTS + 1 }, (_, i) => ({ id: `t-${i}`, see: "x" }));
    expect(TestsSchema.safeParse(many).success).toBe(false);
    expect(TestsSchema.safeParse(many.slice(0, MAX_TESTS)).success).toBe(true);
  });
});

describe("lockedTestsRemoved (CR22)", () => {
  it("names the locked ids a Builder dropped, and nothing else", () => {
    expect(lockedIds(SPEC_TESTS)).toEqual(["hero-visible", "tickets-link"]);
    const next = SPEC_TESTS.filter(
      (test) => test.id !== "tickets-link" && test.id !== "guest-readonly"
    );
    expect(lockedTestsRemoved(SPEC_TESTS, next)).toEqual(["tickets-link"]);
  });

  it("treats unlocking a Planner test as removing it", () => {
    const next = SPEC_TESTS.map((test) =>
      test.id === "hero-visible" ? { ...test, locked: false } : test
    );
    expect(lockedTestsRemoved(SPEC_TESTS, next)).toEqual(["hero-visible"]);
  });

  it("lets the Builder add tests and remove its own", () => {
    const next = [...SPEC_TESTS.filter((t) => t.id !== "countdown-ticks"), { id: "footer", see: "©" }];
    expect(lockedTestsRemoved(SPEC_TESTS, next)).toEqual([]);
  });

  it("has nothing to enforce without a previous snapshot", () => {
    expect(lockedTestsRemoved(null, [])).toEqual([]);
    expect(lockedTestsRemoved([], [])).toEqual([]);
  });
});

describe("parseTestsSnapshot", () => {
  it("reads a bare array or an air.json-shaped object; anything else is no snapshot", () => {
    expect(parseTestsSnapshot(JSON.stringify(SPEC_TESTS))).toHaveLength(5);
    expect(parseTestsSnapshot(JSON.stringify({ tests: SPEC_TESTS }))).toHaveLength(5);
    expect(parseTestsSnapshot(JSON.stringify({ tests: [{ id: "BAD" }] }))).toBeNull();
    expect(parseTestsSnapshot("not json")).toBeNull();
    expect(parseTestsSnapshot("")).toBeNull();
    expect(parseTestsSnapshot(null)).toBeNull();
    expect(parseTestsSnapshot("42")).toBeNull();
  });
});

describe("TestResultsSchema", () => {
  it("accepts consistent counts and ids", () => {
    expect(TestResultsSchema.safeParse({ total: 5, passed: 5, failed_ids: [] }).success).toBe(true);
    expect(
      TestResultsSchema.safeParse({ total: 5, passed: 3, failed_ids: ["a", "b-2"] }).success
    ).toBe(true);
    expect(TestResultsSchema.safeParse({ total: 0, passed: 0, failed_ids: [] }).success).toBe(true);
  });

  it("refuses passed > total, a failed_ids count that disagrees, duplicates, bad ids and extra keys", () => {
    expect(TestResultsSchema.safeParse({ total: 2, passed: 3, failed_ids: [] }).success).toBe(false);
    expect(TestResultsSchema.safeParse({ total: 5, passed: 3, failed_ids: ["a"] }).success).toBe(false);
    expect(TestResultsSchema.safeParse({ total: 5, passed: 3, failed_ids: ["a", "a"] }).success).toBe(false);
    expect(TestResultsSchema.safeParse({ total: 1, passed: 0, failed_ids: ["Hero!"] }).success).toBe(false);
    expect(
      TestResultsSchema.safeParse({ total: 1, passed: 1, failed_ids: [], transcript: "x" }).success
    ).toBe(false);
    expect(TestResultsSchema.safeParse({ total: 41, passed: 41, failed_ids: [] }).success).toBe(false);
  });
});

describe("scoreGate (CR22)", () => {
  afterEach(() => {
    delete process.env["CREATE_DEV_MIN_QA"];
  });

  it("passes only with zero hard findings, qa_score ≥ 70 and every test passing", () => {
    expect(scoreGate({ hardFindings: [], qaScore: 70, tests: { total: 3, passed: 3 } })).toEqual({
      ok: true,
      reasons: [],
    });
    expect(scoreGate({ hardFindings: 0, qaScore: 100, tests: { total: 0, passed: 0 } }).ok).toBe(true);
  });

  it("names every failing clause, content-free", () => {
    const gate = scoreGate({
      hardFindings: [{ rule: "foreign-import" }],
      qaScore: 42,
      tests: { total: 4, passed: 2 },
    });
    expect(gate.ok).toBe(false);
    expect(gate.reasons).toEqual(["hard findings: 1", "qa_score 42 < 70", "tests 2/4"]);
  });

  it("treats QA or tests that never ran as a refusal, not a pass", () => {
    expect(scoreGate({ hardFindings: [], qaScore: null, tests: null }).reasons).toEqual([
      "qa not run",
      "tests not run",
    ]);
  });

  it("reads CREATE_DEV_MIN_QA and accepts an explicit override", () => {
    process.env["CREATE_DEV_MIN_QA"] = "90";
    expect(scoreGate({ hardFindings: [], qaScore: 80, tests: { total: 1, passed: 1 } }).ok).toBe(false);
    expect(
      scoreGate({ hardFindings: [], qaScore: 80, tests: { total: 1, passed: 1 }, minQaScore: 50 }).ok
    ).toBe(true);
  });
});
