import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import {
  gradeCase,
  hardFindings,
  loadCreateCases,
  matchesInOrder,
  type CreateCase,
  type CreateCaseResult,
  type CreateStatus,
} from "../../../../evals/agent-suite/create/run";

const CASES = fileURLToPath(
  new URL("../../../../evals/agent-suite/create/cases.jsonl", import.meta.url),
);

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
    ...over,
  };
}

describe("create eval cases", () => {
  const cases = loadCreateCases(CASES);

  it("parse, share one workspace, and cover golden path + two iterations + budget", () => {
    expect(cases.map((c) => c.id)).toEqual(["C01", "C02", "C03", "C04"]);
    expect(new Set(cases.map((c) => c.appname))).toEqual(
      new Set(["countdown"]),
    );
    expect(cases.map((c) => c.step)).toEqual([
      "golden",
      "iteration",
      "iteration",
      "budget",
    ]);
    const budget = cases.find((c) => c.step === "budget");
    expect(budget?.budget_usd).toBe(0.01);
    expect(budget?.budget_reason).toBe("create_budget");
  });

  it("forbid package installs and any publish claim on every case", () => {
    for (const c of cases) {
      expect(
        c.must_not_do.some((p) =>
          new RegExp(p, "i").test("air-create publish countdown"),
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
