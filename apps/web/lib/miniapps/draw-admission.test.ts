/**
 * Focused coverage for the draw state machine: CAS slot admission for
 * generation AND animation, the foreign-asset guard, prompt sanitization,
 * PNG structural validation, and the animation status projection.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import {
  admitDrawGeneration,
  animateDrawJob,
  drawStatus,
  runDrawJob,
  sanitizeDrawPrompt,
  storeDrawUpload,
  type DrawSession,
} from "./draw";
import {
  createCreativeJob,
  getCreativeJob,
  updateCreativeJob,
} from "../creative/jobs";
import { executeCreativeJob } from "../creative/run";

vi.mock("../creative/jobs", () => ({
  createCreativeJob: vi.fn(),
  getCreativeJob: vi.fn(),
  updateCreativeJob: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../creative/run", () => ({ executeCreativeJob: vi.fn() }));

/** Seed the tables draw.ts touches; the session fixture is cloned so the
 * fake's in-place updates never corrupt the caller's snapshot. */
function makeDb(options?: {
  session?: DrawSession;
  assets?: Record<string, unknown>[];
  jobs?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
}) {
  const db = new FakeSupabase();
  db.tables["draw_sessions"] = options?.session
    ? [{ ...options.session }]
    : [];
  db.tables["creative_assets"] = (options?.assets ?? []).map((a) => ({
    ...a,
  }));
  db.tables["draw_events"] = (options?.events ?? []).map((e) => ({ ...e }));
  db.tables["creative_jobs"] = (options?.jobs ?? []).map((j) => ({ ...j }));
  return db;
}

function drawSession(over: Partial<DrawSession> = {}): DrawSession {
  return {
    id: "sess-1",
    user_id: "u1",
    space_id: "iMessage;+;+15551234567",
    phone: "+15551234567",
    status: "active",
    active_job_id: null,
    latest_job_id: null,
    event_sequence: -1,
    initial_asset_id: null,
    initial_prompt_sent: false,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    created_at: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createCreativeJob).mockResolvedValue({
    id: "job-new",
    draw_mode: "fast",
    revision: 1,
    root_job_id: "job-new",
    status: "queued",
  } as never);
  vi.mocked(updateCreativeJob).mockResolvedValue(undefined as never);
});

describe("admitDrawGeneration", () => {
  it("rejects a caller-supplied asset owned by another user", async () => {
    const db = makeDb({
      session: drawSession(),
      assets: [{ id: "asset-not-mine", user_id: "someone-else" }],
    });
    await expect(
      admitDrawGeneration(db.client(), drawSession(), {
        prompt: "a fox",
        mode: "fast",
        inputAssetId: "asset-not-mine",
        channel: "web",
      })
    ).rejects.toMatchObject({ code: "PARENT_UNAVAILABLE" });
    expect(vi.mocked(createCreativeJob)).not.toHaveBeenCalled();
  });

  it("fails the created job and refuses admission while the slot is busy", async () => {
    vi.mocked(getCreativeJob).mockResolvedValue({
      id: "job-busy",
      status: "polling",
    } as never);
    const session = drawSession({ active_job_id: "job-busy" });
    const db = makeDb({ session });
    const supabase = db.client();
    await expect(
      admitDrawGeneration(supabase, session, {
        prompt: "a fox",
        mode: "fast",
        channel: "web",
      })
    ).rejects.toMatchObject({ code: "JOB_ALREADY_ACTIVE" });
    expect(vi.mocked(updateCreativeJob)).toHaveBeenCalledWith(
      supabase,
      "job-new",
      { status: "failed", error: "superseded before admission" }
    );
  });

  it("releases a stale slot by identity, then claims", async () => {
    vi.mocked(getCreativeJob).mockResolvedValue({
      id: "job-dead",
      status: "failed",
    } as never);
    const session = drawSession({ active_job_id: "job-dead" });
    const db = makeDb({ session });
    const job = await admitDrawGeneration(db.client(), session, {
      prompt: "a fox",
      mode: "fast",
      channel: "web",
    });
    expect(job.id).toBe("job-new");
    const claimPayloads = db.updates
      .filter((u) => u.table === "draw_sessions")
      .map((u) => u.patch)
      .filter((p) => p["active_job_id"] === "job-new");
    expect(claimPayloads.length).toBeGreaterThan(0);
    expect(claimPayloads[0]).toMatchObject({ latest_job_id: "job-new" });
    // The stale pointer was cleared by its own id before the retry landed.
    const release = db.filters.find(
      (f) =>
        f.table === "draw_sessions" &&
        f.op === "eq" &&
        f.column === "active_job_id" &&
        f.value === "job-dead"
    );
    expect(release).toBeDefined();
    expect(db.rows("draw_sessions")[0]?.["active_job_id"]).toBe("job-new");
  });
});

describe("animateDrawJob", () => {
  const source = {
    id: "job-src",
    draw_session_id: "sess-1",
    status: "delivered",
    output_asset_id: "a-src",
  };
  const sourceAsset = { id: "a-src", user_id: "u1", storage_key: "k" };

  it("runs under the in-flight lease and releases it by identity", async () => {
    vi.mocked(getCreativeJob).mockResolvedValue(source as never);
    vi.mocked(executeCreativeJob).mockResolvedValue({
      status: "delivered",
      line: "ok",
      asset: { id: "a-out" },
    } as never);
    const db = makeDb({ session: drawSession(), assets: [sourceAsset] });
    const { job } = await animateDrawJob(
      db.client(),
      drawSession(),
      "job-src"
    );
    expect(job.id).toBe("job-new");
    // The zap job holds the slot while executing…
    const claim = db.updates
      .filter((u) => u.table === "draw_sessions")
      .map((u) => u.patch)
      .find((p) => p["active_job_id"] === "job-new");
    // …but an animation never anchors the revision strip.
    expect(claim).toMatchObject({ active_job_id: "job-new" });
    expect(claim).not.toHaveProperty("latest_job_id");
    expect(vi.mocked(executeCreativeJob)).toHaveBeenCalledOnce();
    // …and the finally-path clears only its own claim.
    const releaseEq = db.filters.find(
      (f) =>
        f.table === "draw_sessions" &&
        f.op === "eq" &&
        f.column === "active_job_id" &&
        f.value === "job-new"
    );
    expect(releaseEq).toBeDefined();
    expect(db.rows("draw_sessions")[0]?.["active_job_id"]).toBeNull();
  });

  it("refuses when the slot is held — no paid render runs", async () => {
    vi.mocked(getCreativeJob).mockImplementation(async (_c, _u, id) => {
      if (id === "job-src") return source as never;
      return { id, status: "submitted" } as never;
    });
    const session = drawSession({ active_job_id: "job-busy" });
    const db = makeDb({ session, assets: [sourceAsset] });
    const supabase = db.client();
    await expect(
      animateDrawJob(supabase, session, "job-src")
    ).rejects.toMatchObject({ code: "JOB_ALREADY_ACTIVE" });
    expect(vi.mocked(executeCreativeJob)).not.toHaveBeenCalled();
    expect(vi.mocked(updateCreativeJob)).toHaveBeenCalledWith(
      supabase,
      "job-new",
      { status: "failed", error: "superseded before admission" }
    );
  });
});

describe("runDrawJob", () => {
  it("fails the job instead of submitting when the edit source can't be signed", async () => {
    const session = drawSession({ active_job_id: "job-1" });
    const db = makeDb({ session, assets: [] });
    const supabase = db.client();
    const job = {
      id: "job-1",
      draw_mode: "fast",
      input_asset_id: "asset-gone",
    } as never;
    const result = await runDrawJob(supabase, session, job, "make it pop");
    expect(result.status).toBe("failed");
    // A paid submit without the edit source would render an unrelated
    // text-to-image — it must never reach executeCreativeJob.
    expect(vi.mocked(executeCreativeJob)).not.toHaveBeenCalled();
    expect(vi.mocked(updateCreativeJob)).toHaveBeenCalledWith(
      supabase,
      "job-1",
      expect.objectContaining({ status: "failed" })
    );
    const event = db.inserts.find((i) => i.table === "draw_events");
    expect(event?.row).toMatchObject({
      kind: "state",
      state: "failed",
      error_code: "PARENT_EXPIRED",
    });
    const release = db.updates.find(
      (u) => u.table === "draw_sessions" && "active_job_id" in u.patch
    );
    expect(release?.patch).toMatchObject({
      active_job_id: null,
      latest_job_id: "job-1",
    });
  });
});

describe("sanitizeDrawPrompt", () => {
  it("strips control/format characters and collapses whitespace", () => {
    expect(
      sanitizeDrawPrompt("\u001b hello\n\nworld\u0000 \u2028\t!")
    ).toBe("hello world !");
  });

  it("caps at 2000 characters", () => {
    expect(sanitizeDrawPrompt("x".repeat(3000))).toHaveLength(2000);
  });
});

describe("storeDrawUpload", () => {
  // A real 1x1 transparent PNG: full signature, IHDR, IDAT, IEND trailer.
  const PNG_1PX =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  it("accepts a structurally valid PNG", async () => {
    const db = makeDb();
    const asset = await storeDrawUpload(
      db.client(),
      "u1",
      `data:image/png;base64,${PNG_1PX}`
    );
    expect(asset?.id).toBeTruthy();
    expect(asset).toMatchObject({
      user_id: "u1",
      ext: "png",
      kind: "png",
      bytes: Buffer.from(PNG_1PX, "base64").byteLength,
    });
    const upload = db.storageCalls.find((c) => c.method === "upload");
    expect(upload?.bucket).toBe("creative-assets");
  });

  it("rejects magic-byte-only junk, truncation, and non-PNG types", async () => {
    const db = makeDb();
    const supabase = db.client();
    // 4-byte PNG magic followed by junk — the old check accepted this.
    const junk = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.from("not-a-real-png-payload-that-is-long-enough-for-the-floor"),
    ]);
    await expect(
      storeDrawUpload(
        supabase,
        "u1",
        `data:image/png;base64,${junk.toString("base64")}`
      )
    ).resolves.toBeNull();
    // Truncated real PNG — signature + IHDR but no IEND.
    const truncated = Buffer.from(PNG_1PX, "base64").subarray(0, 40);
    await expect(
      storeDrawUpload(
        supabase,
        "u1",
        `data:image/png;base64,${truncated.toString("base64")}`
      )
    ).resolves.toBeNull();
    await expect(
      storeDrawUpload(supabase, "u1", "data:image/jpeg;base64,/9j/4AAQ")
    ).resolves.toBeNull();
  });
});

describe("drawStatus", () => {
  const zapJob = {
    id: "zap-9",
    user_id: "u1",
    draw_session_id: "sess-1",
    mode: "zap",
    status: "delivered",
    output_asset_id: "a-9",
    created_at: "2026-09-11T00:00:00.000Z",
  };

  it("projects the latest delivered zap job as latestAnimation", async () => {
    const db = makeDb({
      session: drawSession(),
      jobs: [zapJob],
      assets: [{ id: "a-9", user_id: "u1", storage_key: "k" }],
    });
    const status = await drawStatus(db.client(), drawSession(), -1);
    expect(status.latestAnimation).toEqual({
      jobId: "zap-9",
      url: "https://storage.test/creative-assets/k",
      createdAt: "2026-09-11T00:00:00.000Z",
    });
  });

  it("returns null when the delivered zap's asset can't be signed", async () => {
    const db = makeDb({
      session: drawSession(),
      jobs: [zapJob],
      assets: [],
    });
    const status = await drawStatus(db.client(), drawSession(), -1);
    expect(status.latestAnimation).toBeNull();
  });
});
