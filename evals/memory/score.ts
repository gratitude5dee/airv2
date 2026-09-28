/**
 * Memory recall scorer (R-EV-11). Reads queries.jsonl, the archive manifest,
 * and a results file of ranked retrieval URIs, then scores recall@1 and
 * recall@3 per query and in aggregate. Prior-review target: recall@1 ≥ 80%.
 *
 *   npx tsx evals/memory/score.ts [results.jsonl]
 *
 * Results file: one JSONL row per query —
 *   {"id": "M01", "retrieved": ["viking://resources/...", ...]}
 * Exit code is 1 when recall@1 falls below the 80% target, so the scorer can
 * gate a CI step on fixtures as well as grade a live run.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Manifest } from "./generate";

const HERE = new URL(".", import.meta.url).pathname;

/** recall@1 target from the prior review (MEM-11). */
export const RECALL_AT_1_TARGET = 0.8;

export interface RecallQuery {
  id: string;
  query: string;
  expected: string[];
}

export interface RecallResult {
  id: string;
  retrieved: string[];
}

export interface QueryScore {
  id: string;
  hitAt1: boolean;
  hitAt3: boolean;
  /** The expected artefact URIs this query needed. */
  expectedUris: string[];
}

export interface ScoreReport {
  queries: number;
  scored: number;
  recallAt1: number;
  recallAt3: number;
  target: number;
  pass: boolean;
  perQuery: QueryScore[];
}

export function loadQueries(path = join(HERE, "archive", "queries.jsonl")): RecallQuery[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RecallQuery);
}

export function loadResults(path: string): RecallResult[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const raw = JSON.parse(line) as { id?: string; retrieved?: unknown };
      if (!raw.id || !Array.isArray(raw.retrieved)) {
        throw new Error(`${path}: each row needs {id, retrieved[]}`);
      }
      return { id: raw.id, retrieved: raw.retrieved.map(String) };
    });
}

export function loadManifest(
  path = join(HERE, "archive", "manifest.json")
): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

/** Invert the manifest: partition URI → the message ids it contains. */
export function partitionContents(manifest: Manifest): Map<string, Set<string>> {
  const contents = new Map<string, Set<string>>();
  for (const [messageId, uri] of Object.entries(manifest.artefacts)) {
    contents.set(uri, new Set([...(contents.get(uri) ?? []), messageId]));
  }
  return contents;
}

/**
 * A retrieved URI hits when it names a partition containing any expected
 * message. URIs are matched by partition prefix so deeper pointers
 * (…/<month>.md, …/<month>/sections/…) still resolve to their partition.
 */
function uriHitsPartition(
  retrievedUri: string,
  expectedPartitionUris: Set<string>
): boolean {
  for (const partitionUri of expectedPartitionUris) {
    if (retrievedUri === partitionUri || retrievedUri.startsWith(`${partitionUri}/`) || retrievedUri.startsWith(`${partitionUri}.`)) {
      return true;
    }
  }
  return false;
}

export function scoreResults(
  queries: RecallQuery[],
  results: RecallResult[],
  manifest: Manifest
): ScoreReport {
  const byId = new Map(results.map((result) => [result.id, result.retrieved]));
  const perQuery: QueryScore[] = queries.map((query) => {
    const expectedUris = query.expected.map(
      (id) => manifest.artefacts[id] ?? `missing:${id}`
    );
    const expectedSet = new Set(expectedUris);
    const retrieved = byId.get(query.id) ?? [];
    const hitAt = (k: number) =>
      retrieved.slice(0, k).some((uri) => uriHitsPartition(uri, expectedSet));
    return { id: query.id, hitAt1: hitAt(1), hitAt3: hitAt(3), expectedUris };
  });
  const scored = perQuery.filter((q) => byId.has(q.id)).length;
  const hits1 = perQuery.filter((q) => q.hitAt1).length;
  const hits3 = perQuery.filter((q) => q.hitAt3).length;
  const recallAt1 = perQuery.length ? hits1 / perQuery.length : 0;
  return {
    queries: perQuery.length,
    scored,
    recallAt1,
    recallAt3: perQuery.length ? hits3 / perQuery.length : 0,
    target: RECALL_AT_1_TARGET,
    pass: recallAt1 >= RECALL_AT_1_TARGET,
    perQuery,
  };
}

export function renderReport(report: ScoreReport): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const misses = report.perQuery.filter((q) => !q.hitAt3);
  return [
    "# Memory recall eval — report",
    "",
    `Queries: ${report.queries} (${report.scored} with results)`,
    `recall@1: **${pct(report.recallAt1)}** — target ≥${pct(report.target)} — ${report.pass ? "PASS" : "FAIL"}`,
    `recall@3: **${pct(report.recallAt3)}**`,
    "",
    "| query | @1 | @3 | expected artefacts |",
    "| --- | --- | --- | --- |",
    ...report.perQuery.map(
      (q) =>
        `| ${q.id} | ${q.hitAt1 ? "hit" : "miss"} | ${q.hitAt3 ? "hit" : "miss"} | ${q.expectedUris
          .map((uri) => uri.split("/").slice(-1)[0])
          .join(", ")} |`
    ),
    "",
    misses.length
      ? `Misses at @3: ${misses.map((q) => q.id).join(", ")}`
      : "No misses at @3.",
    "",
  ].join("\n");
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const resultsPath =
    process.argv[2] ?? join(HERE, "archive", "results.jsonl");
  const report = scoreResults(
    loadQueries(),
    loadResults(resultsPath),
    loadManifest()
  );
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(HERE, "results", `memory-${stamp}`, "report.md");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, renderReport(report));
  console.log(renderReport(report));
  console.log(`report: ${reportPath}`);
  if (!report.pass) process.exitCode = 1;
}
