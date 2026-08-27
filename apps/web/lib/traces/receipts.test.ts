/**
 * MA9.3 — receipt row invariants: every row carries the full stable column
 * set (dataframe round-trip), mappers only surface metadata columns, and the
 * CSV/JSONL serializers escape correctly.
 */
import { describe, expect, it } from "vitest";
import {
  csvHeader,
  mapAgentRun,
  mapCreativeJob,
  mapDecision,
  mapGateEvent,
  mapVaultEvent,
  RECEIPT_COLUMNS,
  toCsvRow,
  toJsonlLine,
} from "./receipts";

describe("receipt mappers", () => {
  it("every mapper emits every stable column", () => {
    const rows = [
      mapAgentRun({ id: "r1", started_at: "2026-08-01T00:00:00Z" }),
      mapDecision({ id: "d1", created_at: "2026-08-01T00:00:00Z" }),
      mapVaultEvent({ id: "v1", created_at: "2026-08-01T00:00:00Z" }),
      mapGateEvent({ id: "g1", created_at: "2026-08-01T00:00:00Z" }),
      mapCreativeJob({ id: "c1", created_at: "2026-08-01T00:00:00Z" }),
    ];
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...RECEIPT_COLUMNS].sort());
    }
  });

  it("maps metadata fields and nothing else", () => {
    const run = mapAgentRun({
      id: "r1",
      hermes_run_id: "h1",
      trigger: "imessage",
      started_at: "2026-08-01T00:00:00Z",
      ended_at: "2026-08-01T00:01:00Z",
      outcome: "ok",
      box_seconds: 60,
      cost_usd: 0.01,
      speed_tier: "fast",
      model: "gpt-5.6-luna",
      requested_model: "fast",
      reasoning_effort: "low",
      latency_ms: 812,
      prompt_tokens: 100,
      completion_tokens: 20,
      sneaky_content: "should never appear",
    });
    expect(run.kind).toBe("agent_run");
    expect(run.ref).toBe("h1");
    expect(run.box_seconds).toBe(60);
    expect(run.tier).toBe("fast");
    expect(run.model).toBe("gpt-5.6-luna");
    expect(run.requested_model).toBe("fast");
    expect(run.reasoning_effort).toBe("low");
    expect(run.latency_ms).toBe(812);
    expect(run.prompt_tokens).toBe(100);
    expect(run.completion_tokens).toBe(20);
    expect(JSON.stringify(run)).not.toContain("should never appear");
  });

  it("labels creative jobs channel/mode", () => {
    expect(
      mapCreativeJob({ channel: "image", mode: "generate" }).label
    ).toBe("image/generate");
    expect(mapCreativeJob({ channel: "image" }).label).toBe("image");
  });
});

describe("serializers", () => {
  it("JSONL lines keep stable key order", () => {
    const line = toJsonlLine(
      mapVaultEvent({ id: "v1", item_id: "i1", action: "reveal", created_at: "2026-08-01T00:00:00Z" })
    );
    expect(Object.keys(JSON.parse(line))).toEqual([...RECEIPT_COLUMNS]);
  });

  it("CSV escapes quotes, commas, and newlines", () => {
    const row = mapDecision({
      id: 'd"1',
      kind: "a,b",
      ref: "line1\nline2",
      created_at: "2026-08-01T00:00:00Z",
    });
    const csv = toCsvRow(row);
    expect(csvHeader()).toBe(RECEIPT_COLUMNS.join(","));
    expect(csv).toContain('"d""1"');
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"line1\nline2"');
    expect(csv.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)).toHaveLength(
      RECEIPT_COLUMNS.length
    );
  });

  it("nulls serialize as empty CSV cells", () => {
    const row = mapVaultEvent({ id: "v1" });
    expect(toCsvRow(row)).toBe(`,vault_event,v1,,,,,,,,,,,,,,,`);
  });
});
