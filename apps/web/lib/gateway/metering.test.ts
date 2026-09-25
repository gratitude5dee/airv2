import { describe, expect, it, vi } from "vitest";

const insertCalls: Record<string, unknown>[] = [];
const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
const settleAppSpend = vi.fn(async () => undefined);

vi.mock("../supabase", () => ({
  serviceClient: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        insertCalls.push({ table, ...row });
        return { error: null };
      },
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return { error: null };
    },
  }),
}));
vi.mock("../functions/runtime", () => ({
  settleAppSpend: (...args: unknown[]) => settleAppSpend(...(args as [])),
}));

import { carriesAssistantWork, meter, meteringTee, type Usage } from "./metering";

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

describe("meteringTee", () => {
  it("passes the stream through unmodified and reports the usage chunk", async () => {
    const payload =
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n' +
      'data: {"usage":{"prompt_tokens":3,"completion_tokens":5}}\n\n' +
      "data: [DONE]\n\n";
    const ended = new Promise<{ usage: Usage | null; errored: boolean }>(
      (resolve) => {
        const client = meteringTee(sseStream([payload]), (usage, errored) =>
          resolve({ usage, errored }),
        );
        void drain(client);
      },
    );
    await expect(ended).resolves.toEqual({
      usage: { prompt_tokens: 3, completion_tokens: 5 },
      errored: false,
    });
  });

  it("reports null usage and errored=true when the upstream drops mid-stream", async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"choices":[]}\n\n'),
        );
        controller.error(new Error("upstream dropped"));
      },
    });
    const ended = new Promise<{ usage: Usage | null; errored: boolean }>(
      (resolve) => {
        const client = meteringTee(broken, (usage, errored) =>
          resolve({ usage, errored }),
        );
        void drain(client).catch(() => undefined);
      },
    );
    await expect(ended).resolves.toEqual({ usage: null, errored: true });
  });

  it("reports null usage on a clean close with no usage chunk", async () => {
    const ended = new Promise<{ usage: Usage | null; errored: boolean }>(
      (resolve) => {
        const client = meteringTee(sseStream(["data: [DONE]\n\n"]), (u, e) =>
          resolve({ usage: u, errored: e }),
        );
        void drain(client);
      },
    );
    await expect(ended).resolves.toEqual({ usage: null, errored: false });
  });
});

describe("carriesAssistantWork", () => {
  const sseResponse = (body: string) =>
    new Response(body, { headers: { "content-type": "text/event-stream" } });

  it("is true when a delta carries content", async () => {
    await expect(
      carriesAssistantWork(
        sseResponse('data: {"choices":[{"delta":{"content":"answer"}}]}\n\ndata: [DONE]\n\n'),
      ),
    ).resolves.toBe(true);
  });

  it("is true when a delta carries tool calls", async () => {
    await expect(
      carriesAssistantWork(
        sseResponse(
          'data: {"choices":[{"delta":{"tool_calls":[{"id":"c1"}]}}]}\n\n',
        ),
      ),
    ).resolves.toBe(true);
  });

  it("is false for reasoning-only or content-less streams", async () => {
    await expect(
      carriesAssistantWork(
        sseResponse(
          'data: {"choices":[{"delta":{"reasoning":"thinking"}}]}\n\ndata: [DONE]\n\n',
        ),
      ),
    ).resolves.toBe(false);
    await expect(carriesAssistantWork(sseResponse("data: [DONE]\n\n"))).resolves.toBe(false);
  });
});

describe("meter", () => {
  it("inserts the agent_runs row and settles spend", async () => {
    insertCalls.length = 0;
    rpcCalls.length = 0;
    settleAppSpend.mockClear();
    await meter(
      "user-1",
      "fast",
      "gmi",
      { prompt_tokens: 10, completion_tokens: 4 },
      "zai-org/GLM-5.3-Flash",
      false,
      {
        requestedModel: "fast",
        reasoningEffort: "low",
        startedAtMs: Date.now() - 100,
        requestedFamily: "openai",
        label: "app-slug",
        app: {
          id: "app-1",
          hold: { id: "h1", reservedUsd: 0.01 } as never,
        },
      },
    );
    const run = insertCalls.find((row) => row["table"] === "agent_runs");
    expect(run).toBeDefined();
    expect(run).toMatchObject({
      user_id: "user-1",
      trigger: "app",
      outcome: "gateway_completion",
      model_family: "gmi",
      model: "zai-org/GLM-5.3-Flash",
      fallback_from: "openai",
      speed_tier: "fast",
      requested_model: "fast",
      reasoning_effort: "low",
    });
    expect(rpcCalls).toEqual([
      { name: "add_spend", args: { p_user_id: "user-1", p_cost_usd: expect.any(Number) } },
    ]);
    expect(settleAppSpend).toHaveBeenCalledOnce();
  });

  it("records zero cost on a personal key and does not fall back", async () => {
    insertCalls.length = 0;
    rpcCalls.length = 0;
    await meter("user-2", "deep", "openai", { prompt_tokens: 1 }, "gpt-x", true);
    const run = insertCalls.find((row) => row["table"] === "agent_runs");
    expect(run).toMatchObject({ cost_usd: 0, fallback_from: null });
    expect(rpcCalls[0]?.args["p_cost_usd"]).toBe(0);
  });
});
