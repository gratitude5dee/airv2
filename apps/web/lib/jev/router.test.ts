import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseRoute,
  routeTurn,
  routingInstructions,
  type SystemOneResponse,
} from "./router";

function response(overrides: Partial<SystemOneResponse["answers"]> = {}) {
  return {
    answers: {
      capability: { choice: "kernel-browser", confidence: 0.9, probabilities: { "kernel-browser": 0.8 } },
      approval_gate: { choice: "none", confidence: 0.9, probabilities: { none: 0.9 } },
      needs_owner_context: { noul: 0.1 },
      compound_request: { noul: 0.1 },
      ...overrides,
    },
  } satisfies SystemOneResponse;
}

describe("parseRoute", () => {
  it("returns null for a missing answers block", () => {
    expect(parseRoute({})).toBeNull();
  });

  it("picks the capability when its probability clears the route bar", () => {
    const route = parseRoute(response())!;
    expect(route.skill).toBe("kernel-browser");
    expect(route.gate).toBeNull();
  });

  it("drops a capability under the route threshold", () => {
    const route = parseRoute(
      response({
        capability: {
          choice: "kernel-browser",
          confidence: 0.4,
          probabilities: { "kernel-browser": 0.4, comms: 0.35, email: 0.25 },
        },
      })
    )!;
    expect(route.skill).toBeNull();
  });

  it("drops a gate under the higher gate threshold", () => {
    const route = parseRoute(
      response({
        approval_gate: {
          choice: "purchase_review",
          confidence: 0.5,
          probabilities: { purchase_review: 0.55, none: 0.45 },
        },
      })
    )!;
    expect(route.gate).toBeNull();
  });

  it("keeps a gate above the gate threshold", () => {
    const route = parseRoute(
      response({
        approval_gate: {
          choice: "purchase_review",
          confidence: 0.9,
          probabilities: { purchase_review: 0.8, none: 0.2 },
        },
      })
    )!;
    expect(route.gate).toBe("purchase_review");
  });

  it("never emits none as a skill or gate hint", () => {
    const route = parseRoute(
      response({
        capability: { choice: "none", confidence: 0.95, probabilities: { none: 0.95 } },
        approval_gate: { choice: "none", confidence: 0.95, probabilities: { none: 0.95 } },
      })
    )!;
    expect(route.skill).toBeNull();
    expect(route.gate).toBeNull();
  });

  it("ignores capability choices outside the closed menu", () => {
    const route = parseRoute(
      response({
        capability: {
          choice: "invented-skill",
          confidence: 0.99,
          probabilities: { "invented-skill": 0.99 },
        },
      })
    )!;
    expect(route.skill).toBeNull();
  });

  it("flags context and compound only above their nouls", () => {
    const route = parseRoute(
      response({
        needs_owner_context: { noul: 0.8 },
        compound_request: { noul: 0.7 },
      })
    )!;
    expect(route.needsContext).toBe(true);
    expect(route.compound).toBe(true);
  });

  it("reads gateway-shaped boolean answers and metadata confidence", () => {
    const route = parseRoute({
      answers: {
        capability: {
          type: "choice",
          choice: "watch_for",
          probabilities: { watch_for: 0.9 },
        },
        needs_owner_context: { type: "boolean", probability: 0.8 },
        compound_request: { type: "boolean", probability: 0.1 },
      },
      providerMetadata: { typesafe: { confidence: { capability: 0.97 } } },
    })!;
    expect(route.skill).toBe("watch_for");
    expect(route.needsContext).toBe(true);
    expect(route.compound).toBe(false);
    expect(route.confidence).toBe(0.97);
  });
});

describe("routingInstructions", () => {
  it("returns undefined when nothing cleared its threshold", () => {
    expect(routingInstructions(null)).toBeUndefined();
    expect(
      routingInstructions({
        skill: null,
        gate: null,
        needsContext: false,
        compound: false,
        confidence: 0,
      })
    ).toBeUndefined();
  });

  it("names the capability and gate so the agent opens and stages them", () => {
    const text = routingInstructions({
      skill: "kernel-payments",
      gate: "purchase_review",
      needsContext: false,
      compound: false,
      confidence: 0.9,
    })!;
    expect(text).toContain("kernel-payments");
    expect(text).toContain("purchase_review");
    expect(text).toContain("skill_view");
  });

  it("mentions context stores when the turn needs owner context", () => {
    const text = routingInstructions({
      skill: null,
      gate: null,
      needsContext: true,
      compound: false,
      confidence: 0.5,
    })!;
    expect(text).toContain("openviking-memory");
  });
});

describe("routeTurn", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null without an API key", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await routeTurn("buy me the shoes")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("posts one batched system_one call and parses the answers", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "ts_test_key");
    const spy = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(response()), { status: 200 })
    );
    vi.stubGlobal("fetch", spy);
    const route = await routeTurn("buy me the shoes I looked at");
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toContain("/v1/systemone");
    expect((init?.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer ts_test_key"
    );
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("jev-latest");
    expect(Object.keys(body.questions)).toEqual([
      "capability",
      "approval_gate",
      "needs_owner_context",
      "compound_request",
    ]);
    expect(route?.skill).toBe("kernel-browser");
  });

  it("uses the AI Gateway evaluation-model endpoint without a typesafe key", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "gw_test_key");
    const spy = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            answers: {
              capability: {
                type: "choice",
                choice: "watch_for",
                probabilities: { watch_for: 0.9 },
              },
              needs_owner_context: { type: "boolean", probability: 0.1 },
              compound_request: { type: "boolean", probability: 0.2 },
            },
            providerMetadata: {
              typesafe: { confidence: { capability: 0.97 } },
            },
          }),
          { status: 200 }
        )
    );
    vi.stubGlobal("fetch", spy);
    const route = await routeTurn("watch that fare for me");
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toContain("/v4/ai/evaluation-model");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer gw_test_key");
    expect(headers["ai-model-id"]).toBe("typesafe-ai/jev");
    expect(headers["ai-gateway-protocol-version"]).toBe("0.0.1");
    expect(headers["ai-evaluation-model-specification-version"]).toBe("4");
    const body = JSON.parse(String(init?.body));
    expect(body.questions.capability.type).toBe("choice");
    expect(body.questions.needs_owner_context.type).toBe("boolean");
    expect(body.model).toBeUndefined();
    expect(route?.skill).toBe("watch_for");
    expect(route?.confidence).toBe(0.97);
  });

  it("falls back to the injected Vercel OIDC token for the gateway", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "oidc_test_token");
    const spy = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(response()), { status: 200 })
    );
    vi.stubGlobal("fetch", spy);
    expect(await routeTurn("hi there")).not.toBeNull();
    const [, init] = spy.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer oidc_test_token"
    );
  });

  it("prefers the typesafe key when both backends are configured", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "ts_test_key");
    vi.stubEnv("AI_GATEWAY_API_KEY", "gw_test_key");
    const spy = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(response()), { status: 200 })
    );
    vi.stubGlobal("fetch", spy);
    await routeTurn("hi");
    expect(String(spy.mock.calls[0]![0])).toContain("/v1/systemone");
  });

  it("fails open on a non-200 and on a fetch throw", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "ts_test_key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 500 })));
    expect(await routeTurn("hi")).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      })
    );
    expect(await routeTurn("hi")).toBeNull();
  });
});
