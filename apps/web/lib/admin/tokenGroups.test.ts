/**
 * V12 §12 — the Tokens page grouping: keys per group, the Create lane /
 * project / stage splits, the list-estimated flag for GMI Astra/Luna, and
 * the aggregation totals.
 */
import { describe, expect, it } from "vitest";
import {
  aggregateGroups,
  asTokensRun,
  groupKeyFor,
  isTokensGroup,
  runCostEstimated,
  TOKENS_GROUPS,
  type TokensRun,
} from "./tokenGroups";

const base: TokensRun = {
  user_id: "user-1",
  prompt_tokens: 100,
  completion_tokens: 20,
  cost_usd: 0.001,
  model: "zai-org/GLM-5.3-Flash",
  model_family: "gmi",
  speed_tier: "balanced",
  label: "create:alice-promo",
  create_stage: "build",
};

describe("isTokensGroup", () => {
  it("accepts every §12 group and nothing else", () => {
    for (const group of TOKENS_GROUPS) expect(isTokensGroup(group)).toBe(true);
    expect(isTokensGroup("owner")).toBe(false);
    expect(isTokensGroup(undefined)).toBe(false);
  });
});

describe("groupKeyFor", () => {
  it("keys each group off receipt metadata", () => {
    expect(groupKeyFor(base, "user")).toBe("user-1");
    expect(groupKeyFor(base, "model")).toBe("zai-org/GLM-5.3-Flash");
    expect(groupKeyFor(base, "family")).toBe("gmi");
    expect(groupKeyFor(base, "provider")).toBe("gmi");
    expect(groupKeyFor(base, "tier")).toBe("balanced");
    expect(groupKeyFor(base, "lane")).toBe("create");
    expect(groupKeyFor(base, "stage")).toBe("build");
    expect(groupKeyFor(base, "project")).toBe("create:alice-promo");
  });

  it("splits chat from create by label and falls back for missing metadata", () => {
    const chat: TokensRun = {
      ...base,
      label: null,
      create_stage: null,
      model: null,
      model_family: "openai",
      speed_tier: null,
    };
    expect(groupKeyFor(chat, "lane")).toBe("chat");
    expect(groupKeyFor(chat, "project")).toBe("chat");
    expect(groupKeyFor(chat, "stage")).toBe("none");
    expect(groupKeyFor(chat, "model")).toBe("unknown");
    expect(groupKeyFor(chat, "tier")).toBe("unknown");
    expect(groupKeyFor(chat, "provider")).toBe("openai");
    expect(groupKeyFor({ ...chat, model_family: "anthropic" }, "provider")).toBe(
      "openrouter"
    );
    expect(groupKeyFor({ ...chat, model_family: "made-up" }, "provider")).toBe(
      "unknown"
    );
  });
});

describe("runCostEstimated", () => {
  it("flags Astra and Luna served on GMI only", () => {
    expect(runCostEstimated({ ...base, model: "openai/gpt-6-astra" })).toBe(true);
    expect(runCostEstimated({ ...base, model: "openai/gpt-5.6-luna" })).toBe(true);
    expect(runCostEstimated(base)).toBe(false);
    expect(
      runCostEstimated({ ...base, model: "openai/gpt-6-astra", model_family: "openai" })
    ).toBe(false);
  });
});

describe("aggregateGroups", () => {
  it("sums tokens and cost per key, largest first, and carries the estimate flag", () => {
    const rows = aggregateGroups(
      [
        base,
        { ...base, create_stage: "plan", model: "openai/gpt-6-astra", prompt_tokens: 500, completion_tokens: 50, cost_usd: 0.0075 },
        { ...base, create_stage: "plan", model: "openai/gpt-6-astra", prompt_tokens: 100, completion_tokens: null, cost_usd: null },
      ],
      "stage"
    );
    expect(rows).toEqual([
      {
        key: "plan",
        runs: 2,
        prompt_tokens: 600,
        completion_tokens: 50,
        total_tokens: 650,
        cost_usd: 0.0075,
        cost_estimated: true,
      },
      {
        key: "build",
        runs: 1,
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        cost_usd: 0.001,
        cost_estimated: false,
      },
    ]);
  });

  it("orders equal totals by key for a stable table", () => {
    const rows = aggregateGroups(
      [
        { ...base, label: "create:b" },
        { ...base, label: "create:a" },
      ],
      "project"
    );
    expect(rows.map((row) => row.key)).toEqual(["create:a", "create:b"]);
  });
});

describe("asTokensRun", () => {
  it("normalises a raw receipt row", () => {
    expect(
      asTokensRun({
        user_id: "u",
        prompt_tokens: "10",
        completion_tokens: null,
        cost_usd: "0.5",
        model: "",
        model_family: "gmi",
        speed_tier: undefined,
        label: "create:x",
        create_stage: null,
      })
    ).toEqual({
      user_id: "u",
      prompt_tokens: 10,
      completion_tokens: null,
      cost_usd: 0.5,
      model: null,
      model_family: "gmi",
      speed_tier: null,
      label: "create:x",
      create_stage: null,
    });
  });
});
