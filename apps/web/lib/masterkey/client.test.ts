import { describe, expect, it } from "vitest";
import { parseMcpBody, resultText, runCostUsd } from "./client";

describe("parseMcpBody", () => {
  it("reads a plain JSON reply", () => {
    const out = parseMcpBody("application/json", '{"jsonrpc":"2.0","id":1,"result":{"ok":true}}');
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe(1);
  });

  it("reads SSE frames and skips non-JSON data", () => {
    const body =
      'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"content":[]}}\n\n' +
      "data: not-json\n\n" +
      'data: {"jsonrpc":"2.0","id":8,"error":{"code":-1,"message":"x"}}\n\n';
    const out = parseMcpBody("text/event-stream; charset=utf-8", body);
    expect(out.map((m) => m.id)).toEqual([7, 8]);
  });
});

describe("run_service result helpers", () => {
  it("extracts the provider cost and text", () => {
    const result = {
      content: [{ type: "text", text: "done" }, { type: "image" }],
      structuredContent: { providerCostUsd: 0.04 },
    };
    expect(runCostUsd(result)).toBe(0.04);
    expect(resultText(result)).toBe("done");
  });

  it("reports no cost for error envelopes", () => {
    expect(runCostUsd({ content: [], structuredContent: { error: true, providerCostUsd: 1 } })).toBeNull();
    expect(runCostUsd({ content: [] })).toBeNull();
  });
});
