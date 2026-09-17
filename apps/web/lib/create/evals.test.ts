import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import {
  countNumberedQuestions,
  CREATE_INTAKE_STAGES,
  CREATE_STEPS,
  CREATE_TIERS,
  gradeCase,
  hardFindings,
  loadCreateCases,
  lockedTests,
  matchesInOrder,
  skippedResult,
  stageReached,
  type CreateCase,
  type CreateCaseResult,
  type CreateStatus,
} from "../../../../evals/agent-suite/create/run";
import { INTAKE_STAGES } from "./intake";

const CASES = fileURLToPath(
  new URL("../../../../evals/agent-suite/create/cases.jsonl", import.meta.url),
);

const V12_IDS = [
  "C20",
  "C21",
  "C22",
  "C23",
  "C24",
  "C25",
  "C26",
  "C27",
  "C28",
  "C29",
  "C30",
];

function status(over: Partial<CreateStatus> = {}): CreateStatus {
  return {
    slug: "owner-countdown",
    appname: "countdown",
    status: "draft",
    draft_version: "v3",
    qa_score: 92,
    build: {
      id: "b1",
      status: "succeeded",
      version: "v3",
      error: null,
      findings: [],
      log: [],
    },
    budget: { budget_usd: 5, spent_usd: 0.4, remaining_usd: 4.6 },
    versions: [{ version: "v3", findings: 0, qa_score: 92 }],
    ...over,
  };
}

function result(
  over: Partial<Omit<CreateCaseResult, "checks">> = {},
): Omit<CreateCaseResult, "checks"> {
  return {
    id: "C01",
    appname: "countdown",
    step: "golden",
    tier: "balanced",
    message: "",
    run_id: "r1",
    session: "air-create-countdown",
    status: "completed",
    error: null,
    tools: ["terminal"],
    tool_events: [
      { tool: "terminal", preview: "air-create new countdown --lane vibe" },
      { tool: "terminal", preview: "air-create build countdown" },
    ],
    output:
      "Countdown is built — ready for your approval. [card: app countdown]",
    elapsed_ms: 1000,
    status_after: status(),
    intake_after: null,
    ...over,
  };
}

/** A V12 case with only the axes under test set; everything else n/a. */
function v12Case(over: Partial<CreateCase> = {}): CreateCase {
  return {
    id: "CX",
    appname: "tour26",
    step: "confirm",
    tier: "deep",
    message: "yes",
    expect_draft: false,
    expect_hard_findings: 0,
    must_do: [],
    must_not_do: [],
    must_say: [],
    budget_usd: null,
    budget_reason: null,
    expect_stage: null,
    expect_questions_max: null,
    expect_locked_tests_min: null,
    expect_dev_url: null,
    skip_reason: null,
    ...over,
  };
}

describe("create eval cases", () => {
  const cases = loadCreateCases(CASES);

  it("parse, share one workspace, and cover golden path + two iterations + budget", () => {
    expect(cases.slice(0, 4).map((c) => c.id)).toEqual([
      "C01",
      "C02",
      "C03",
      "C04",
    ]);
    expect(
      new Set(cases.slice(0, 4).map((c) => c.appname)),
    ).toEqual(new Set(["countdown"]));
    expect(cases.slice(0, 4).map((c) => c.step)).toEqual([
      "golden",
      "iteration",
      "iteration",
      "budget",
    ]);
    const budget = cases.find((c) => c.id === "C04");
    expect(budget?.budget_usd).toBe(0.01);
    expect(budget?.budget_reason).toBe("create_budget");
  });

  it("forbid package installs and any publish claim on every case", () => {
    for (const c of cases) {
      if (c.skip_reason) continue;
      expect(
        c.must_not_do.some((p) =>
          new RegExp(p, "i").test(`air-create publish ${c.appname} `),
        ),
      ).toBe(true);
      expect(
        c.must_not_do.some((p) => new RegExp(p, "i").test("I published it")),
      ).toBe(true);
    }
    const golden = cases[0] as CreateCase;
    expect(
      golden.must_not_do.some((p) =>
        new RegExp(p, "i").test("npm install react"),
      ),
    ).toBe(true);
    expect(
      golden.must_say.some((p) =>
        new RegExp(p, "i").test("[card: app countdown]"),
      ),
    ).toBe(true);
  });

  it("appends the V12 §19 cases C20–C30 with unique ids and legal steps/tiers", () => {
    expect(cases.map((c) => c.id)).toEqual([
      "C01",
      "C02",
      "C03",
      "C04",
      ...V12_IDS,
    ]);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) {
      expect(CREATE_STEPS).toContain(c.step);
      expect(CREATE_TIERS).toContain(c.tier);
      if (c.expect_stage !== null)
        expect(CREATE_INTAKE_STAGES).toContain(c.expect_stage);
    }
    const byId = new Map(cases.map((c) => [c.id, c]));
    const step = (id: string) => byId.get(id)?.step;
    expect(step("C20")).toBe("intake");
    expect(step("C21")).toBe("intake");
    expect(step("C22")).toBe("plan");
    expect(step("C23")).toBe("confirm");
    expect(step("C24")).toBe("dev");
    expect(step("C25")).toBe("dev");
    expect(step("C26")).toBe("finalize");
    expect(step("C27")).toBe("import");
    expect(step("C28")).toBe("import");
    expect(step("C29")).toBe("budget");
    expect(step("C30")).toBe("intake");
    // §19 tiers: intake/plan/confirm/finalize/import are Planner (deep) turns,
    // the build turns are balanced.
    for (const id of ["C20", "C21", "C22", "C23", "C26", "C27", "C28"]) {
      expect(byId.get(id)?.tier).toBe("deep");
    }
    for (const id of ["C24", "C25", "C29"]) {
      expect(byId.get(id)?.tier).toBe("balanced");
    }
  });

  it("keeps the eval stage vocabulary in step with lib/create/intake.ts", () => {
    expect([...CREATE_INTAKE_STAGES]).toEqual([...INTAKE_STAGES]);
  });

  it("encodes the §19 expectations on the new fields", () => {
    const byId = new Map(cases.map((c) => [c.id, c]));
    const c20 = byId.get("C20") as CreateCase;
    expect(c20.expect_stage).toBe("asking");
    expect(c20.expect_questions_max).toBe(3);
    expect(c20.expect_draft).toBe(false);
    expect(
      c20.must_say.some((p) =>
        new RegExp(p, "i").test("1. landing page, or a product page with a store?"),
      ),
    ).toBe(true);
    expect(
      c20.must_not_do.some((p) =>
        new RegExp(p, "i").test("reply **yes** to build"),
      ),
    ).toBe(true);

    const c21 = byId.get("C21") as CreateCase;
    expect(c21.expect_stage).toBe("plan_sent");
    expect(c21.expect_questions_max).toBe(0);
    expect(
      c21.must_say.some((p) =>
        new RegExp(p, "i").test("reply **yes** to build, or tell me what to change"),
      ),
    ).toBe(true);

    const c22 = byId.get("C22") as CreateCase;
    expect(c22.expect_stage).toBe("plan_sent");
    expect(c22.expect_dev_url).toBe(false);
    expect(
      c22.must_do.some((p) =>
        new RegExp(p, "i").test("write ~/.hermes/create/tour26/plan.v2.md"),
      ),
    ).toBe(true);
    expect(
      c22.must_not_do.some((p) =>
        new RegExp(p, "i").test("air-create build tour26"),
      ),
    ).toBe(true);

    const c23 = byId.get("C23") as CreateCase;
    expect(c23.expect_stage).toBe("confirmed");
    expect(c23.expect_locked_tests_min).toBe(2);
    expect(
      c23.must_do.some((p) =>
        new RegExp(p, "i").test("air-create confirm tour26"),
      ),
    ).toBe(true);

    const c24 = byId.get("C24") as CreateCase;
    expect(c24.expect_stage).toBe("dev_ready");
    expect(c24.expect_dev_url).toBe(true);
    expect(c24.expect_hard_findings).toBe(0);
    expect(
      matchesInOrder(c24.must_do, [
        "terminal air-create build tour26",
        "terminal air-create test tour26",
        "terminal air-create release tour26 dev",
      ]),
    ).toBe(true);
    expect(
      c24.must_say.some((p) =>
        new RegExp(p, "i").test("dev build is live: link.wzrd.tech/a/tour26"),
      ),
    ).toBe(true);
    expect(
      c24.must_not_do.some((p) => new RegExp(p, "i").test("published")),
    ).toBe(true);

    const c25 = byId.get("C25") as CreateCase;
    expect(c25.expect_locked_tests_min).toBe(2);
    expect(
      c25.must_say.some((p) =>
        new RegExp(p, "i").test("build refused: tests.locked-removed"),
      ),
    ).toBe(true);

    const c26 = byId.get("C26") as CreateCase;
    expect(c26.expect_stage).toBe("decision_sent");
    expect(
      c26.must_do.some((p) =>
        new RegExp(p, "i").test(
          'air-create finalize tour26 --name "tour26" --description "Every date" --generate-icon',
        ),
      ),
    ).toBe(true);
    // Generated once: a second `--generate-icon` anywhere in the evidence fails.
    expect(
      c26.must_not_do.some((p) =>
        new RegExp(p, "i").test(
          "air-create finalize tour26 --generate-icon\nair-create finalize tour26 --generate-icon",
        ),
      ),
    ).toBe(true);
    expect(
      c26.must_say.some((p) =>
        new RegExp(p, "i").test("ready for your approval"),
      ),
    ).toBe(true);

    const c27 = byId.get("C27") as CreateCase;
    expect(c27.expect_dev_url).toBe(true);
    expect(c27.message).toMatch(/^https:\/\/github\.com\//);
    expect(
      c27.must_not_do.some((p) =>
        new RegExp(p, "i").test("npm install"),
      ),
    ).toBe(true);

    const c28 = byId.get("C28") as CreateCase;
    expect(c28.expect_draft).toBe(false);
    expect(c28.expect_dev_url).toBe(false);
    expect(
      c28.must_say.every((p) =>
        new RegExp(p, "i").test(
          "This repository needs a build and a server (Next.js API routes). Install the WZRD GitHub App to link it.",
        ),
      ),
    ).toBe(true);
    expect(
      c28.must_not_do.some((p) =>
        new RegExp(p, "i").test("air-create new next-dashboard "),
      ),
    ).toBe(true);

    const c29 = byId.get("C29") as CreateCase;
    expect(c29.step).toBe("budget");
    expect(c29.budget_usd).toBe(0.02);
    expect(new RegExp(c29.budget_reason ?? "", "i").test("insufficient_quota")).toBe(true);
    expect(c29.expect_stage).toBe("failed");

    const c30 = byId.get("C30") as CreateCase;
    expect(c30.skip_reason).toMatch(/non-owner sender/);
    expect(
      c30.must_say.some((p) =>
        new RegExp(p, "i").test("only the owner can open mini-apps."),
      ),
    ).toBe(true);
    // Every other case is driven.
    expect(cases.filter((c) => c.skip_reason).map((c) => c.id)).toEqual(["C30"]);
  });

  it("defaults the V12 fields to null on the MC4 cases", () => {
    for (const c of cases.slice(0, 4)) {
      expect(c.expect_stage).toBeNull();
      expect(c.expect_questions_max).toBeNull();
      expect(c.expect_locked_tests_min).toBeNull();
      expect(c.expect_dev_url).toBeNull();
      expect(c.skip_reason).toBeNull();
    }
  });
});

describe("create eval grader", () => {
  const cases = loadCreateCases(CASES);
  const golden = cases[0] as CreateCase;
  const budget = cases[3] as CreateCase;

  it("passes the golden path when the build fired, a draft exists, and the report follows the skill", () => {
    const checks = gradeCase(golden, result());
    expect(checks).toMatchObject({
      terminal: "pass",
      must_do: "pass",
      must_not_do: "pass",
      must_say: "pass",
      draft: "pass",
      hard_findings: "pass",
      budget: "n/a",
      stage: "n/a",
      questions: "n/a",
      locked_tests: "n/a",
      dev_url: "n/a",
    });
  });

  it("fails must_not_do when the agent installs packages or claims publication", () => {
    const installed = gradeCase(
      golden,
      result({
        tool_events: [
          {
            tool: "terminal",
            preview: "npm install confetti && air-create build countdown",
          },
        ],
      }),
    );
    expect(installed.must_not_do).toBe("fail");
    const claimed = gradeCase(
      golden,
      result({
        output: "Done — published to the store. [card: app countdown]",
      }),
    );
    expect(claimed.must_not_do).toBe("fail");
    expect(claimed.must_say).toBe("fail");
  });

  it("fails draft/hard_findings when the build left no version or hard findings", () => {
    const none = gradeCase(
      golden,
      result({ status_after: status({ draft_version: null }) }),
    );
    expect(none.draft).toBe("fail");
    const hard = gradeCase(
      golden,
      result({
        status_after: status({
          build: {
            id: "b2",
            status: "failed",
            version: null,
            error: "hard findings",
            findings: [{ severity: "hard", code: "external-script" }],
            log: [],
          },
        }),
      }),
    );
    expect(hard.hard_findings).toBe("fail");
    expect(hardFindings(status({ build: null }))).toBe(0);
    expect(hardFindings(null)).toBe(0);
  });

  it("passes the budget case on a 429 refusal or a transcript that reports create_budget", () => {
    const refused = gradeCase(
      budget,
      result({
        status: "budget_refused",
        error: "create_budget",
        run_id: null,
      }),
    );
    expect(refused).toMatchObject({
      terminal: "pass",
      budget: "pass",
      draft: "n/a",
      hard_findings: "n/a",
    });
    const reported = gradeCase(
      budget,
      result({
        output:
          "The gateway refused this turn: insufficient_quota (create_budget). Raise the project budget to continue.",
        status_after: status({
          budget: { budget_usd: 0.01, spent_usd: 0.01, remaining_usd: 0 },
        }),
      }),
    );
    expect(reported.budget).toBe("pass");
    const spent = gradeCase(
      budget,
      result({ output: "Added confetti — ready for your approval." }),
    );
    expect(spent.budget).toBe("fail");
  });

  it("matches must_do in order", () => {
    expect(
      matchesInOrder(
        ["new", "build"],
        ["air-create new x", "air-create build x"],
      ),
    ).toBe(true);
    expect(
      matchesInOrder(
        ["build", "new"],
        ["air-create new x", "air-create build x"],
      ),
    ).toBe(false);
  });
});

describe("create eval grader — V12 axes", () => {
  const intake = (over: Partial<CreateCaseResult["intake_after"]> = {}) => ({
    appname: "tour26",
    stage: "confirmed",
    template: "landing",
    questions_asked: 0,
    revisions: 0,
    plan_version: 1,
    builds: 0,
    failed_builds: 0,
    ...over,
  });

  it("grades expect_stage from the status route's intake_stage, else the intake route", () => {
    const c = v12Case({ expect_stage: "confirmed" });
    expect(
      gradeCase(c, result({ status_after: status({ intake_stage: "confirmed" }) })).stage,
    ).toBe("pass");
    expect(
      gradeCase(
        c,
        result({ status_after: status({ intake_stage: "plan_sent" }) }),
      ).stage,
    ).toBe("fail");
    // No project yet (status 404) — the intake route carries the stage.
    expect(
      gradeCase(
        c,
        result({ status_after: null, intake_after: intake({ stage: "confirmed" }) }),
      ).stage,
    ).toBe("pass");
    expect(
      gradeCase(
        c,
        result({ status_after: null, intake_after: intake({ stage: "asking" }) }),
      ).stage,
    ).toBe("fail");
    // Neither reported one: fail, never a silent pass.
    expect(gradeCase(c, result({ status_after: status(), intake_after: null })).stage).toBe(
      "fail",
    );
    // The status route wins when both answer.
    expect(
      gradeCase(
        c,
        result({
          status_after: status({ intake_stage: "confirmed" }),
          intake_after: intake({ stage: "asking" }),
        }),
      ).stage,
    ).toBe("pass");
  });

  it("treats expect_stage as reached: a later golden-path stage passes, the terminal ones match exactly", () => {
    expect(stageReached("dev_ready", "confirmed")).toBe(true);
    expect(stageReached("confirmed", "confirmed")).toBe(true);
    expect(stageReached("plan_sent", "confirmed")).toBe(false);
    expect(stageReached(null, "confirmed")).toBe(false);
    expect(stageReached("failed", "confirmed")).toBe(false);
    expect(stageReached("abandoned", "asking")).toBe(false);
    expect(stageReached("failed", "failed")).toBe(true);
    expect(stageReached("production", "failed")).toBe(false);
    expect(stageReached("bogus", "asking")).toBe(false);
    const c23 = v12Case({ expect_stage: "confirmed" });
    expect(
      gradeCase(c23, result({ status_after: status({ intake_stage: "dev_ready" }) })).stage,
    ).toBe("pass");
    const c29 = v12Case({
      step: "budget",
      budget_reason: "insufficient_quota|create_budget",
      expect_stage: "failed",
    });
    const stuck = gradeCase(
      c29,
      result({
        status: "budget_refused",
        error: "insufficient_quota",
        status_after: status({ intake_stage: "failed" }),
      }),
    );
    expect(stuck).toMatchObject({ terminal: "pass", budget: "pass", stage: "pass" });
    const notStuck = gradeCase(
      c29,
      result({
        status: "budget_refused",
        error: "insufficient_quota",
        status_after: status({ intake_stage: "building" }),
      }),
    );
    expect(notStuck.stage).toBe("fail");
  });

  it("grades expect_questions_max from the intake counter, falling back to numbered questions in the transcript", () => {
    const c = v12Case({ step: "intake", expect_questions_max: 3 });
    expect(
      gradeCase(c, result({ status_after: null, intake_after: intake({ questions_asked: 3 }) }))
        .questions,
    ).toBe("pass");
    expect(
      gradeCase(c, result({ status_after: null, intake_after: intake({ questions_asked: 4 }) }))
        .questions,
    ).toBe("fail");
    const zero = v12Case({ step: "intake", expect_questions_max: 0 });
    expect(
      gradeCase(zero, result({ status_after: null, intake_after: intake({ questions_asked: 1 }) }))
        .questions,
    ).toBe("fail");
    // Intake route unreachable: count `1. …?` lines in the transcript.
    const asked = [
      "Two quick ones before I plan:",
      "1. Landing page, or a product page with a store?",
      "2. What are the dates and the ticket link?",
      "reply in one message; say **you pick** for any.",
    ].join("\n");
    expect(countNumberedQuestions(asked)).toBe(2);
    expect(
      countNumberedQuestions(
        "tour26 → link.wzrd.tech/a/tour26\n1. landing · atmosphere\n2. three dates\nreply **yes** to build",
      ),
    ).toBe(0);
    expect(gradeCase(c, result({ status_after: null, output: asked })).questions).toBe("pass");
    expect(gradeCase(zero, result({ status_after: null, output: asked })).questions).toBe("fail");
  });

  it("grades expect_locked_tests_min from status tests.locked, else the locked entries in the evidence", () => {
    const c = v12Case({ expect_locked_tests_min: 2 });
    expect(
      gradeCase(
        c,
        result({
          status_after: status({ tests: { total: 4, passed: 4, failed_ids: [], locked: 2 } }),
        }),
      ).locked_tests,
    ).toBe("pass");
    expect(
      gradeCase(
        c,
        result({
          status_after: status({ tests: { total: 4, passed: 4, failed_ids: [], locked: 1 } }),
        }),
      ).locked_tests,
    ).toBe("fail");
    const goal = [
      '{ "id": "hero-visible", "see": "October", "locked": true },',
      '{ "id": "tickets-link", "tap": "[data-test=tickets]", "expectHref": "https://dice.fm/", "locked": true },',
      '{ "id": "countdown-ticks", "wait": 1100, "changed": "[data-test=countdown]" }',
    ].join("\n");
    expect(lockedTests(null, [goal])).toBe(2);
    expect(lockedTests(status({ tests: { total: 3, passed: 3, locked: 5 } }), [goal])).toBe(5);
    expect(
      gradeCase(
        c,
        result({
          status_after: null,
          tool_events: [
            { tool: "write_file", preview: `~/.hermes/create/tour26/goal.md\n${goal}` },
            { tool: "terminal", preview: "air-create confirm tour26" },
          ],
        }),
      ).locked_tests,
    ).toBe("pass");
    expect(
      gradeCase(
        c,
        result({
          status_after: null,
          tool_events: [{ tool: "terminal", preview: "air-create confirm tour26" }],
          output: "Confirmed.",
        }),
      ).locked_tests,
    ).toBe("fail");
  });

  it("grades expect_dev_url both ways from status dev.url", () => {
    const live = status({
      intake_stage: "dev_ready",
      dev: { version: "v3", url: "https://link.wzrd.tech/a/tour26", expires_at: "2026-10-01T00:00:00Z" },
    });
    const none = status({ intake_stage: "plan_sent", dev: { version: null, url: null, expires_at: null } });
    const wants = v12Case({ step: "dev", expect_dev_url: true });
    expect(gradeCase(wants, result({ status_after: live })).dev_url).toBe("pass");
    expect(gradeCase(wants, result({ status_after: none })).dev_url).toBe("fail");
    expect(gradeCase(wants, result({ status_after: status() })).dev_url).toBe("fail");
    expect(gradeCase(wants, result({ status_after: null })).dev_url).toBe("fail");
    const forbids = v12Case({ step: "plan", expect_dev_url: false });
    expect(gradeCase(forbids, result({ status_after: live })).dev_url).toBe("fail");
    expect(gradeCase(forbids, result({ status_after: none })).dev_url).toBe("pass");
    expect(gradeCase(forbids, result({ status_after: null })).dev_url).toBe("pass");
  });

  it("grades the real C24 as a pass on a synthetic dev_ready status and fails it on a publish claim", () => {
    const c24 = loadCreateCases(CASES).find((c) => c.id === "C24") as CreateCase;
    const dev = result({
      tool_events: [
        { tool: "terminal", preview: "air-create build tour26" },
        { tool: "terminal", preview: "air-create qa tour26" },
        { tool: "terminal", preview: "air-create test tour26" },
        { tool: "terminal", preview: "air-create release tour26 dev" },
      ],
      output:
        "dev build is live: link.wzrd.tech/a/tour26 — share it with anyone. say **ship it** when you want it in production.",
      status_after: status({
        appname: "tour26",
        intake_stage: "dev_ready",
        dev: { version: "v3", url: "https://link.wzrd.tech/a/tour26", expires_at: "2026-10-01T00:00:00Z" },
        tests: { total: 4, passed: 4, failed_ids: [] },
      }),
    });
    expect(gradeCase(c24, dev)).toEqual({
      terminal: "pass",
      must_do: "pass",
      must_not_do: "pass",
      must_say: "pass",
      budget: "n/a",
      draft: "pass",
      hard_findings: "pass",
      stage: "pass",
      questions: "n/a",
      locked_tests: "n/a",
      dev_url: "pass",
    });
    const claimed = gradeCase(
      c24,
      result({ ...dev, output: "dev build is live and published on mini.wzrd.tech/a/tour26" }),
    );
    expect(claimed.must_not_do).toBe("fail");
  });

  it("records a skipped case with every check n/a and never as a pass", () => {
    const c30 = loadCreateCases(CASES).find((c) => c.id === "C30") as CreateCase;
    const skipped = skippedResult(c30);
    expect(skipped.status).toBe("skipped");
    expect(skipped.error).toBe(c30.skip_reason);
    expect(Object.values(skipped.checks).every((v) => v === "n/a")).toBe(true);
    expect(Object.values(gradeCase(c30, skipped)).every((v) => v === "n/a")).toBe(true);
  });
});

describe("create eval case loader", () => {
  it("rejects a bad step, tier, stage or skip_reason", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "create-evals-"));
    const write = (line: Record<string, unknown>) => {
      const file = join(dir, `${Math.random().toString(36).slice(2)}.jsonl`);
      writeFileSync(file, `${JSON.stringify(line)}\n`);
      return file;
    };
    const base = {
      id: "CX",
      appname: "tour26",
      step: "intake",
      tier: "deep",
      message: "hi",
    };
    expect(() => loadCreateCases(write({ ...base, step: "ship" }))).toThrow(/bad step/);
    expect(() => loadCreateCases(write({ ...base, tier: "turbo" }))).toThrow(/bad tier/);
    expect(() => loadCreateCases(write({ ...base, expect_stage: "shipped" }))).toThrow(
      /bad expect_stage/,
    );
    expect(() => loadCreateCases(write({ ...base, expect_questions_max: -1 }))).toThrow(
      /bad expect_questions_max/,
    );
    expect(() => loadCreateCases(write({ ...base, expect_locked_tests_min: 1.5 }))).toThrow(
      /bad expect_locked_tests_min/,
    );
    expect(() => loadCreateCases(write({ ...base, expect_dev_url: "yes" }))).toThrow(
      /bad expect_dev_url/,
    );
    expect(() => loadCreateCases(write({ ...base, skip_reason: "  " }))).toThrow(
      /bad skip_reason/,
    );
    const ok = loadCreateCases(
      write({
        ...base,
        expect_stage: "asking",
        expect_questions_max: 3,
        expect_locked_tests_min: 2,
        expect_dev_url: false,
        skip_reason: " reason ",
      }),
    );
    expect(ok[0]).toMatchObject({
      expect_stage: "asking",
      expect_questions_max: 3,
      expect_locked_tests_min: 2,
      expect_dev_url: false,
      skip_reason: "reason",
    });
  });
});
