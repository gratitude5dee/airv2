import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuildRecord } from "./build";
import type { VersionRow } from "./versions";

const ledger = vi.hoisted(() => ({
  latestBuild: vi.fn(async (): Promise<BuildRecord | null> => null),
}));
vi.mock("./build", () => ledger);
const versions = vi.hoisted(() => ({
  getVersion: vi.fn(async (): Promise<VersionRow | null> => null),
}));
vi.mock("./versions", () => versions);

import { makeApp } from "@/app/mini/loader-test-utils";
import {
  P50_BUILD_DEFAULT_MS,
  P50_BUILD_FLOOR_MS,
  p50BuildMs,
  percentFor,
  readProgress,
  type ProgressInput,
} from "./progress";

const T0 = Date.parse("2026-09-17T12:00:00.000Z");
const P50 = 60_000;

function build(over: Partial<BuildRecord> = {}): BuildRecord {
  return {
    id: "build-1",
    status: "running",
    log: [],
    findings: [],
    sizes: null,
    version: null,
    error: null,
    started_at: new Date(T0).toISOString(),
    finished_at: null,
    ...over,
  };
}

function version(over: Partial<VersionRow> = {}): VersionRow {
  return {
    id: "ver-1",
    app_id: "app-1",
    user_id: "user-1",
    version: "v1700000000001",
    lane: "vibe",
    bundle_sha256: "a".repeat(64),
    bundle_bytes: 10,
    file_count: 1,
    worker_sha256: null,
    kit_version: null,
    functions: null,
    findings: [],
    qa_score: null,
    created_at: new Date(T0).toISOString(),
    published_at: null,
    retired_at: null,
    purged_at: null,
    ...over,
  };
}

function at(over: Partial<ProgressInput>): ProgressInput {
  return { stage: "building", build: null, version: null, now: T0, p50BuildMs: P50, ...over };
}

describe("percentFor — the §8.2 table", () => {
  it("is 0 before the plan is confirmed and 5 once it is", () => {
    for (const stage of ["asking", "planning", "plan_sent", "revising"] as const) {
      expect(percentFor(at({ stage }))).toEqual({ percent: 0, stage, detail: null });
    }
    expect(percentFor(at({ stage: "confirmed" }))).toEqual({ percent: 5, stage: "confirmed", detail: null });
    expect(percentFor(at({ stage: "confirmed", scaffold: true }))).toMatchObject({ percent: 10 });
  });

  it("build queued 15, running 15 → 40 along the p50 curve, capped", () => {
    expect(percentFor(at({ build: build({ status: "queued" }) }))).toEqual({
      percent: 15,
      stage: "building",
      detail: "build queued",
    });
    const running = build();
    expect(percentFor(at({ build: running, now: T0 })).percent).toBe(15);
    expect(percentFor(at({ build: running, now: T0 + P50 / 2 })).percent).toBe(28);
    expect(percentFor(at({ build: running, now: T0 + P50 })).percent).toBe(40);
    expect(percentFor(at({ build: running, now: T0 + 10 * P50 })).percent).toBe(40);
  });

  it("floors the p50 at 20 s so a fast history never makes the bar sprint", () => {
    const running = build();
    expect(percentFor(at({ build: running, p50BuildMs: 5_000, now: T0 + 10_000 })).percent).toBe(28);
    expect(percentFor(at({ build: running, p50BuildMs: 5_000, now: T0 + P50_BUILD_FLOOR_MS })).percent).toBe(40);
  });

  it("hard findings hold at 45 with the first rule as detail", () => {
    const failed = build({
      status: "failed",
      error: "hard findings",
      findings: [
        { file: "src/main.tsx", rule: "inline-handler", hint: "soft", severity: "soft" },
        { file: "air.json", rule: "tests.locked-removed", hint: "locked tests…", severity: "hard" },
        { file: "src/a.ts", rule: "foreign-import", hint: "x", severity: "hard" },
      ],
    });
    expect(percentFor(at({ build: failed }))).toEqual({
      percent: 45,
      stage: "building",
      detail: "tests.locked-removed",
    });
  });

  it("a retry resets to 15 with detail retry n/3", () => {
    const crashed = build({ status: "failed", error: "build crashed" });
    expect(percentFor(at({ build: crashed }))).toEqual({ percent: 15, stage: "building", detail: "build failed" });
    expect(percentFor(at({ build: build({ status: "queued" }), failedBuilds: 1 })).detail).toBe("retry 2/3");
    expect(percentFor(at({ build: build(), failedBuilds: 2, now: T0 })).detail).toBe("retry 3/3");
    expect(percentFor(at({ build: build(), failedBuilds: 2, now: T0 })).percent).toBe(15);
    expect(percentFor(at({ build: crashed, failedBuilds: 5 })).detail).toBe("retry 3/3");
  });

  it("build succeeded: qa runs 45 → 65 from the stage start, qa done holds 65", () => {
    const done = build({ status: "succeeded", version: "v1700000000001", finished_at: new Date(T0).toISOString() });
    const noQa = version();
    expect(percentFor(at({ stage: "qa", build: done, version: noQa, now: T0 }))).toEqual({
      percent: 45,
      stage: "qa",
      detail: "qa running",
    });
    expect(percentFor(at({ stage: "qa", build: done, version: noQa, now: T0 + P50 / 2 })).percent).toBe(55);
    expect(percentFor(at({ stage: "qa", build: done, version: noQa, now: T0 + 2 * P50 })).percent).toBe(65);
    // No version row yet (upload in flight) still reads as QA pending.
    expect(percentFor(at({ stage: "qa", build: done, version: null, now: T0 })).percent).toBe(45);
    expect(percentFor(at({ stage: "qa", build: done, version: version({ qa_score: 91 }) }))).toEqual({
      percent: 65,
      stage: "qa",
      detail: "qa 91",
    });
  });

  it("tests run 65 → 85 while the intake is testing, then 85 when all pass, 65 while some fail", () => {
    const done = build({ status: "succeeded", version: "v1700000000001", finished_at: new Date(T0).toISOString() });
    const scored = version({ qa_score: 88 });
    const since = T0 + 5_000;
    expect(
      percentFor(at({ stage: "testing", build: done, version: scored, stageSince: since, now: since }))
    ).toEqual({ percent: 65, stage: "testing", detail: "tests running" });
    expect(
      percentFor(at({ stage: "testing", build: done, version: scored, stageSince: since, now: since + P50 / 2 }))
        .percent
    ).toBe(75);
    expect(
      percentFor(at({ stage: "testing", build: done, version: scored, stageSince: since, now: since + P50 })).percent
    ).toBe(85);
    expect(
      percentFor(at({ stage: "testing", build: done, version: version({ qa_score: 88, tests_total: 4, tests_passed: 2 }) }))
    ).toEqual({ percent: 65, stage: "testing", detail: "tests 2/4" });
    expect(
      percentFor(at({ stage: "testing", build: done, version: version({ qa_score: 88, tests_total: 4, tests_passed: 4 }) }))
    ).toEqual({ percent: 85, stage: "testing", detail: "tests 4/4" });
  });

  it("dev deploy 90 → 99, dev live 100", () => {
    const done = build({ status: "succeeded", version: "v1700000000001", finished_at: new Date(T0).toISOString() });
    const green = version({ qa_score: 88, tests_total: 2, tests_passed: 2 });
    const deploying = (now: number) =>
      percentFor(at({ stage: "testing", build: done, version: green, dev: "deploying", stageSince: T0, now }));
    expect(deploying(T0)).toEqual({ percent: 90, stage: "testing", detail: "dev deploy" });
    expect(deploying(T0 + P50).percent).toBe(99);
    expect(deploying(T0 + 5 * P50).percent).toBe(99);
    expect(percentFor(at({ stage: "testing", build: done, version: green, dev: "live" }))).toEqual({
      percent: 100,
      stage: "dev_ready",
      detail: "dev live",
    });
    for (const stage of ["dev_ready", "finalizing", "decision_sent", "production"] as const) {
      expect(percentFor(at({ stage }))).toEqual({ percent: 100, stage, detail: "dev live" });
    }
  });

  it("a failed intake keeps its percent and says what it is stuck on (§8.5)", () => {
    const failed = build({
      status: "failed",
      findings: [{ file: "src/a.ts", rule: "foreign-import", hint: "x", severity: "hard" }],
    });
    expect(percentFor(at({ stage: "failed", build: failed }))).toEqual({
      percent: 45,
      stage: "failed",
      detail: "foreign-import",
    });
    expect(percentFor(at({ stage: "failed", build: null }))).toEqual({
      percent: 5,
      stage: "failed",
      detail: "needs you",
    });
  });

  it("is monotonic in time for a fixed state", () => {
    const running = build();
    let last = 0;
    for (let ms = 0; ms <= 2 * P50; ms += 2_500) {
      const { percent } = percentFor(at({ build: running, now: T0 + ms }));
      expect(percent).toBeGreaterThanOrEqual(last);
      last = percent;
    }
  });
});

function fakeSupabase(builds: { started_at: string; finished_at: string | null }[], intake?: unknown) {
  const chain = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const f of ["select", "eq", "order", "limit"]) builder[f] = () => builder;
    builder["maybeSingle"] = async () =>
      table === "create_intakes" ? { data: intake ?? null, error: null } : { data: null, error: null };
    builder["then"] = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(table === "create_builds" ? { data: builds, error: null } : { data: [], error: null }).then(
        resolve
      );
    return builder;
  };
  return { from: (table: string) => chain(table) } as unknown as SupabaseClient;
}

describe("p50BuildMs", () => {
  const iso = (ms: number) => new Date(T0 + ms).toISOString();

  it("takes the median of succeeded builds, floored at 20 s", async () => {
    const rows = [
      { started_at: iso(0), finished_at: iso(30_000) },
      { started_at: iso(0), finished_at: iso(90_000) },
      { started_at: iso(0), finished_at: iso(50_000) },
    ];
    expect(await p50BuildMs(fakeSupabase(rows), "user-1")).toBe(50_000);
    expect(
      await p50BuildMs(fakeSupabase([{ started_at: iso(0), finished_at: iso(3_000) }]), "user-1")
    ).toBe(P50_BUILD_FLOOR_MS);
    expect(await p50BuildMs(fakeSupabase(rows.slice(0, 2)), "user-1")).toBe(60_000);
  });

  it("falls back to a typical build with no history or unusable rows", async () => {
    expect(await p50BuildMs(fakeSupabase([]), "user-1")).toBe(P50_BUILD_DEFAULT_MS);
    expect(await p50BuildMs(fakeSupabase([{ started_at: iso(0), finished_at: null }]), "user-1")).toBe(
      P50_BUILD_DEFAULT_MS
    );
  });
});

describe("readProgress", () => {
  const app = makeApp({ slug: "alice-promo", appname: "promo", owner_user_id: "user-1", draft_version: "v1700000000001" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats a missing intake as confirmed and derives from the build alone", async () => {
    ledger.latestBuild.mockResolvedValueOnce(build({ status: "running" }));
    const snapshot = await readProgress(fakeSupabase([]), "user-1", app, { now: T0 + 30_000, p50BuildMs: P50 });
    expect(snapshot.progress).toEqual({ percent: 28, stage: "building", detail: "build running" });
    expect(snapshot.intakeStage).toBe("confirmed");
    expect(snapshot.attemptKey).toBe("build-1");
    expect(snapshot.updated_at).toBe(new Date(T0).toISOString());
  });

  it("reads the intake's stage column and the draft's version row", async () => {
    const done = build({ status: "succeeded", version: "v1700000000001", finished_at: new Date(T0).toISOString() });
    ledger.latestBuild.mockResolvedValueOnce(done);
    versions.getVersion.mockResolvedValueOnce(version({ qa_score: 90, tests_total: 3, tests_passed: 3 }));
    const intake = { stage: "testing", failed_builds: 0, updated_at: new Date(T0 + 1_000).toISOString() };
    const snapshot = await readProgress(fakeSupabase([], intake), "user-1", app, { now: T0 + 2_000, p50BuildMs: P50 });
    expect(snapshot.progress).toEqual({ percent: 85, stage: "testing", detail: "tests 3/3" });
    expect(snapshot.intakeStage).toBe("testing");
    expect(versions.getVersion).toHaveBeenCalledWith(expect.anything(), app.id, "v1700000000001");
    expect(snapshot.updated_at).toBe(new Date(T0 + 1_000).toISOString());
  });

  it("reports dev live when the dev pointer serves the draft", async () => {
    ledger.latestBuild.mockResolvedValueOnce(
      build({ status: "succeeded", version: "v1700000000001", finished_at: new Date(T0).toISOString() })
    );
    const snapshot = await readProgress(
      fakeSupabase([]),
      "user-1",
      makeApp({ ...app, dev_version: "v1700000000001" }),
      { now: T0, p50BuildMs: P50 }
    );
    expect(snapshot.progress).toEqual({ percent: 100, stage: "dev_ready", detail: "dev live" });
  });
});

