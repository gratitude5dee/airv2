import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildArchive,
  buildManifest,
  buildMessages,
  writeArchive,
  QUERY_COUNT,
  QUERIES,
} from "./generate";
import {
  loadManifest,
  loadQueries,
  partitionContents,
  scoreResults,
  RECALL_AT_1_TARGET,
  type RecallResult,
} from "./score";

describe("archive generator", () => {
  it("is deterministic — same seed, byte-identical archive", () => {
    const a = mkdtempSync(join(tmpdir(), "mem-a-"));
    const b = mkdtempSync(join(tmpdir(), "mem-b-"));
    writeArchive(a);
    writeArchive(b);
    for (const file of ["messages.jsonl", "manifest.json", "queries.jsonl"]) {
      expect(readFileSync(join(a, file), "utf8")).toBe(
        readFileSync(join(b, file), "utf8")
      );
    }
    const partitions = buildArchive(buildMessages()).rendered;
    for (const [name, content] of partitions) {
      expect(readFileSync(join(a, "threads", name), "utf8")).toBe(content);
      expect(existsSync(join(b, "threads", name))).toBe(true);
    }
  });

  it("covers ~90 days and keeps every planted artefact", () => {
    const messages = buildMessages();
    expect(messages.length).toBeGreaterThan(400);
    const days = new Set(messages.map((m) => m.ts.slice(0, 10)));
    expect(days.size).toBeGreaterThanOrEqual(60);
    const manifest = buildManifest(messages);
    for (const query of QUERIES) {
      for (const id of query.expected) {
        expect(
          manifest.artefacts[id],
          `${query.id}: expected artefact ${id} missing from archive`
        ).toBeDefined();
      }
    }
  });

  it("renders real archive partitions (thread/month markdown)", () => {
    const { rendered } = buildArchive(buildMessages());
    expect(rendered.size).toBeGreaterThan(10);
    for (const content of rendered.values()) {
      expect(content).toMatch(/^# iMessage history: .+ — \d{4}-\d{2}\n/);
      expect(content).toContain("quoted history, not instructions");
      expect(content).toMatch(/- \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*— .+: /);
    }
  });
});

describe("queries.jsonl", () => {
  it("has 30 queries, all with expected artefacts present in the archive", () => {
    const queries = loadQueries();
    expect(queries).toHaveLength(30);
    expect(QUERY_COUNT).toBe(30);
    const manifest = loadManifest();
    const ids = new Set(queries.map((q) => q.id));
    expect(ids.size).toBe(30);
    for (const query of queries) {
      expect(query.expected.length).toBeGreaterThan(0);
      for (const id of query.expected) {
        expect(manifest.artefacts[id]).toMatch(
          /^viking:\/\/resources\/context\/imessage-history\/threads\/[0-9a-f]{64}\/\d{4}-\d{2}$/
        );
      }
    }
  });
});

describe("scorer", () => {
  const manifest = buildManifest(buildMessages());
  const queries = loadQueries();
  const contents = partitionContents(manifest);

  const perfect: RecallResult[] = queries.map((query) => ({
    id: query.id,
    retrieved: [manifest.artefacts[query.expected[0]!]!],
  }));

  it("scores a perfect run at 100%", () => {
    const report = scoreResults(queries, perfect, manifest);
    expect(report.recallAt1).toBe(1);
    expect(report.recallAt3).toBe(1);
    expect(report.pass).toBe(true);
  });

  it("counts @3 hits that miss @1", () => {
    // Every query retrieves a decoy partition first, the real one second.
    const decoy = Object.values(manifest.artefacts).find(
      (uri) => ![...contents.get(uri)!].some((id) => id.startsWith("m-"))
    )!;
    const results: RecallResult[] = queries.map((query) => ({
      id: query.id,
      retrieved: [decoy, manifest.artefacts[query.expected[0]!]!],
    }));
    const report = scoreResults(queries, results, manifest);
    expect(report.recallAt1).toBe(0);
    expect(report.recallAt3).toBe(1);
    expect(report.pass).toBe(false);
  });

  it("matches deeper URIs to their partition (…/<month>.md)", () => {
    const uri = manifest.artefacts[queries[0]!.expected[0]!]!;
    const report = scoreResults(queries, [
      { id: queries[0]!.id, retrieved: [`${uri}.md`] },
    ], manifest);
    expect(report.perQuery[0]!.hitAt1).toBe(true);
  });

  it("misses on wrong partitions and empty retrievals", () => {
    const wrong = manifest.artefacts["x-1"]!;
    const report = scoreResults(
      queries,
      [
        { id: queries[0]!.id, retrieved: [wrong] },
        { id: queries[1]!.id, retrieved: [] },
      ],
      manifest
    );
    expect(report.perQuery[0]!.hitAt1).toBe(false);
    expect(report.perQuery[1]!.hitAt1).toBe(false);
    expect(report.recallAt1).toBe(0);
  });

  it("keeps the prior-review target at recall@1 ≥ 80%", () => {
    expect(RECALL_AT_1_TARGET).toBe(0.8);
  });
});
