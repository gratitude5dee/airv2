/**
 * V12 §8.4 — `air.json.tests[]`, the small declarative acceptance DSL the
 * Box's QA runner (`air-create test`) executes after the Preview QA matrix,
 * and the control-plane half of CR22: the runner posts only
 * `{ total, passed, failed_ids }` (ids, never page text), the version row
 * stores the two counts (CR21 — ids are not stored), locked tests (the
 * Planner's) may not disappear from a Builder's `air.json`, and a dev
 * release needs zero hard findings, `qa_score ≥ 70` and every test passing.
 *
 * Pure: no I/O. The Build Service (lib/create/build.ts) validates `tests[]`
 * through `TestsSchema` and calls `lockedTestsRemoved`; the release path
 * (lane B) calls `scoreGate`.
 */
import { z } from "zod";
import { createConfig } from "./config";

export const TEST_ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
export const MAX_TESTS = 40;
export const MAX_WAIT_MS = 10_000;

/** A CSS selector as the DSL accepts it: short, single-line, no quotes wars. */
const selector = z.string().trim().min(1).max(200).regex(/^[^\n\r]+$/);
/** Visible text to look for; short, single-line. */
const visibleText = z.string().trim().min(1).max(200).regex(/^[^\n\r]+$/);

export const TestSchema = z
  .object({
    id: z.string().regex(TEST_ID_RE, "test id must be 1–48 lowercase letters, digits or hyphens"),
    /** The Planner's tests; a Builder turn may not remove them (CR22). */
    locked: z.boolean().optional(),
    /** `"390x760"` — the runner's default; any WxH within the Messages sheet. */
    viewport: z
      .string()
      .regex(/^[1-9][0-9]{2,3}x[1-9][0-9]{2,3}$/, "viewport must be WxH, e.g. 390x760")
      .optional(),
    // V13 §6.2: `role` is gone — checks run on Browser Run against the
    // candidate URL, with no owner/guest preview-token distinction.
    // ---- actions (run in this order: type → tap → wait) ----
    /** `[selector, text]`. */
    type: z.tuple([selector, z.string().max(200)]).optional(),
    tap: selector.optional(),
    wait: z.number().int().min(0).max(MAX_WAIT_MS).optional(),
    // ---- assertions ----
    /** The selector's text differs from before the wait. */
    changed: selector.optional(),
    /** Visible text. */
    see: visibleText.optional(),
    /** Selector absent or hidden. */
    missing: selector.optional(),
    /** The tapped link's href starts with this value (the link is not followed). */
    expectHref: z.string().url().max(400).optional(),
  })
  .strict()
  .refine(
    (test) =>
      test.type !== undefined ||
      test.tap !== undefined ||
      test.wait !== undefined ||
      test.changed !== undefined ||
      test.see !== undefined ||
      test.missing !== undefined ||
      test.expectHref !== undefined,
    { message: "a test needs at least one action or assertion" }
  )
  .refine((test) => test.changed === undefined || test.wait !== undefined, {
    message: "changed needs a wait to compare against",
    path: ["changed"],
  })
  .refine((test) => test.expectHref === undefined || test.tap !== undefined, {
    message: "expectHref needs a tap",
    path: ["expectHref"],
  });

export type Test = z.infer<typeof TestSchema>;

export const TestsSchema = z
  .array(TestSchema)
  .max(MAX_TESTS)
  .superRefine((tests, ctx) => {
    const seen = new Set<string>();
    tests.forEach((test, index) => {
      if (seen.has(test.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate test id ${test.id}`,
          path: [index, "id"],
        });
      }
      seen.add(test.id);
    });
  });

/** Ids of the locked tests only. */
export function lockedIds(tests: readonly Test[]): string[] {
  return tests.filter((test) => test.locked === true).map((test) => test.id);
}

/**
 * CR22 — locked ids present in the previous `tests[]` but missing from the
 * next one. A test that is still there with `locked` dropped counts as
 * removed too: unlocking is a Planner act, not a Builder's. No previous
 * snapshot means nothing to enforce.
 */
export function lockedTestsRemoved(previous: readonly Test[] | null, next: readonly Test[]): string[] {
  if (!previous) return [];
  const kept = new Set(lockedIds(next));
  return lockedIds(previous).filter((id) => !kept.has(id));
}

/**
 * What `air-create test` posts to `POST /api/create/qa` (§8.4, §14.1). Ids
 * only; `failed_ids` must account for exactly the failures.
 */
export const TestResultsSchema = z
  .object({
    total: z.number().int().min(0).max(MAX_TESTS),
    passed: z.number().int().min(0).max(MAX_TESTS),
    failed_ids: z.array(z.string().regex(TEST_ID_RE)).max(MAX_TESTS),
  })
  .strict()
  .refine((results) => results.passed <= results.total, {
    message: "passed cannot exceed total",
    path: ["passed"],
  })
  .refine((results) => results.failed_ids.length === results.total - results.passed, {
    message: "failed_ids must list exactly total - passed ids",
    path: ["failed_ids"],
  })
  .refine((results) => new Set(results.failed_ids).size === results.failed_ids.length, {
    message: "failed_ids must be unique",
    path: ["failed_ids"],
  });

export type TestResults = z.infer<typeof TestResultsSchema>;

export interface ScoreGateInput {
  /** Hard findings on the candidate version (rule ids or finding objects). */
  hardFindings: readonly { rule: string }[] | number;
  /** `qa_score` on the version row; null = QA has not run. */
  qaScore: number | null;
  /** The last test run's counts; null = tests have not run. */
  tests: { total: number; passed: number } | null;
  /** Override of CREATE_DEV_MIN_QA, for callers that already read config. */
  minQaScore?: number;
}

export interface ScoreGate {
  ok: boolean;
  /** Content-free reasons, stable strings for cards and the admin view. */
  reasons: string[];
}

/**
 * CR22 — may this version go to dev? Zero hard findings, `qa_score ≥ 70`
 * (CREATE_DEV_MIN_QA) and every declared test passing. A version with no
 * declared tests passes the tests clause only once a run reported
 * `total = 0`; "tests never ran" is a refusal, not a pass. Production adds
 * the owner's tap on top, elsewhere.
 */
export function scoreGate(input: ScoreGateInput): ScoreGate {
  const reasons: string[] = [];
  const hardCount = typeof input.hardFindings === "number" ? input.hardFindings : input.hardFindings.length;
  if (hardCount > 0) reasons.push(`hard findings: ${hardCount}`);
  const minQa = input.minQaScore ?? createConfig.devMinQaScore();
  if (input.qaScore === null) reasons.push("qa not run");
  else if (input.qaScore < minQa) reasons.push(`qa_score ${input.qaScore} < ${minQa}`);
  if (input.tests === null) reasons.push("tests not run");
  else if (input.tests.passed !== input.tests.total) {
    reasons.push(`tests ${input.tests.passed}/${input.tests.total}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Parse a previous `tests[]` snapshot (the Box's `.build/last-tests.json`,
 * or an earlier `air.json`'s array). Anything unreadable is treated as no
 * snapshot: the build must not fail on a stale or hand-edited file, and a
 * missing snapshot only means the locked check has nothing to compare.
 */
export function parseTestsSnapshot(text: string | null | undefined): Test[] | null {
  if (!text || !text.trim()) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const array = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { tests?: unknown }).tests)
      ? (raw as { tests: unknown[] }).tests
      : null;
  if (!array) return null;
  const parsed = TestsSchema.safeParse(array);
  return parsed.success ? parsed.data : null;
}
