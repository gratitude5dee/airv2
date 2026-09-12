/**
 * Focused coverage for the draw state machine: CAS slot admission for
 * generation AND animation, the foreign-asset guard, prompt sanitization,
 * PNG structural validation, and the animation status projection.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
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

type Call = { table: string; method: string; args: unknown[] };
type Result = { data?: unknown; error?: { message: string } | null };
interface Query {
  table: string;
  op: string | null;
  args: unknown[];
  returning: boolean;
  calls: Call[];
}

/** Same chain-mock contract as the location tests — see
 * location-store.test.ts for the mechanics. */
function fakeDb(resolve: (q: Query) => Result) {
  const calls: Call[] = [];
  const OPS = new Set(["select", "insert", "update", "delete", "upsert"]);
  const chain = (
    table: string,
    op: string | null,
    args: unknown[],
    returning: boolean
  ): unknown => {
    const self = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          const p = Promise.resolve().then(() =>
            resolve({ table, op, args, returning, calls })
          );
          if (prop === "then") return p.then.bind(p);
          if (prop === "catch") return p.catch.bind(p);
          return p.finally.bind(p);
        }
        const method = String(prop);
        return (...a: unknown[]) => {
          calls.push({ table, method, args: a });
          if (OPS.has(method) && !op) return chain(table, method, a, returning);
          if (method === "select" && op && op !== "select") {
            return chain(table, op, args, true);
          }
          return chain(table, op, args, returning);
        };
      },
      apply() {
        return chain(table, op, args, returning);
      },
    });
    return self;
  };
  const supabase = {
    from: (table: string) => chain(table, null, [], false),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async () => ({
          data: { signedUrl: "https://signed/asset.mp4" },
        }),
        download: async () => ({ data: new Blob([Buffer.alloc(4)]) }),
      }),
    },
  } as unknown as SupabaseClient;
  return { supabase, calls };
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
    const { supabase } = fakeDb((q) => {
      if (q.table === "creative_assets" && q.op === "select") {
        return { data: null }; // not found under this owner
      }
      return { data: null, error: null };
    });
    await expect(
      admitDrawGeneration(supabase, drawSession(), {
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
    const { supabase } = fakeDb((q) => {
      // Claim attempts always lose — slot never empties.
      if (q.op === "update" && q.returning) return { data: [] };
      return { data: null, error: null };
    });
    await expect(
      admitDrawGeneration(
        supabase,
        drawSession({ active_job_id: "job-busy" }),
        { prompt: "a fox", mode: "fast", channel: "web" }
      )
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
    const { supabase, calls } = fakeDb((q) => {
      if (q.op === "update" && q.returning) {
        // First claim loses (stale pointer), second wins after release.
        const releases = q.calls.filter(
          (c) =>
            c.method === "update" &&
            (c.args[0] as { active_job_id?: string | null }).active_job_id ===
              null
        ).length;
        return { data: releases ? [{ id: "sess-1" }] : [] };
      }
      if (q.op === "select" && q.args[0] === "sequence") {
        return { data: null }; // event feed empty → sequence 0
      }
      return { data: null, error: null };
    });
    const job = await admitDrawGeneration(
      supabase,
      drawSession({ active_job_id: "job-dead" }),
      { prompt: "a fox", mode: "fast", channel: "web" }
    );
    expect(job.id).toBe("job-new");
    const claimPayloads = calls
      .filter((c) => c.method === "update")
      .map((c) => c.args[0] as Record<string, unknown>)
      .filter((p) => p["active_job_id"] === "job-new");
    expect(claimPayloads.length).toBeGreaterThan(0);
    expect(claimPayloads[0]).toMatchObject({ latest_job_id: "job-new" });
  });
});

describe("animateDrawJob", () => {
  const source = {
    id: "job-src",
    draw_session_id: "sess-1",
    status: "delivered",
    output_asset_id: "a-src",
  };

  it("runs under the in-flight lease and releases it by identity", async () => {
    vi.mocked(getCreativeJob).mockResolvedValue(source as never);
    vi.mocked(executeCreativeJob).mockResolvedValue({
      status: "delivered",
      line: "ok",
      asset: { id: "a-out" },
    } as never);
    const { supabase, calls } = fakeDb((q) => {
      if (q.op === "update" && q.returning) {
        return { data: [{ id: "sess-1" }] };
      }
      if (q.table === "creative_assets") return { data: { storage_key: "k" } };
      if (q.op === "select" && q.args[0] === "sequence") return { data: null };
      return { data: null, error: null };
    });
    const { job } = await animateDrawJob(supabase, drawSession(), "job-src");
    expect(job.id).toBe("job-new");
    // The zap job holds the slot while executing…
    const claim = calls
      .filter((c) => c.method === "update")
      .map((c) => c.args[0] as Record<string, unknown>)
      .find((p) => p["active_job_id"] === "job-new");
    // …but an animation never anchors the revision strip.
    expect(claim).toMatchObject({ active_job_id: "job-new" });
    expect(claim).not.toHaveProperty("latest_job_id");
    expect(vi.mocked(executeCreativeJob)).toHaveBeenCalledOnce();
    // …and the finally-path clears only its own claim.
    const releaseEq = calls.find(
      (c) =>
        c.method === "eq" &&
        c.args[0] === "active_job_id" &&
        c.args[1] === "job-new"
    );
    expect(releaseEq).toBeDefined();
  });

  it("refuses when the slot is held — no paid render runs", async () => {
    vi.mocked(getCreativeJob).mockImplementation(async (_c, _u, id) => {
      if (id === "job-src") return source as never;
      return { id, status: "submitted" } as never;
    });
    const { supabase } = fakeDb((q) => {
      if (q.op === "update" && q.returning) return { data: [] };
      if (q.table === "creative_assets") return { data: { storage_key: "k" } };
      return { data: null, error: null };
    });
    await expect(
      animateDrawJob(
        supabase,
        drawSession({ active_job_id: "job-busy" }),
        "job-src"
      )
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
    const { supabase, calls } = fakeDb((q) => {
      if (q.table === "creative_assets" && q.op === "select") {
        return { data: null }; // the referenced asset row is gone
      }
      return { data: null, error: null };
    });
    const job = {
      id: "job-1",
      draw_mode: "fast",
      input_asset_id: "asset-gone",
    } as never;
    const result = await runDrawJob(
      supabase,
      drawSession(),
      job,
      "make it pop"
    );
    expect(result.status).toBe("failed");
    // A paid submit without the edit source would render an unrelated
    // text-to-image — it must never reach executeCreativeJob.
    expect(vi.mocked(executeCreativeJob)).not.toHaveBeenCalled();
    expect(vi.mocked(updateCreativeJob)).toHaveBeenCalledWith(
      supabase,
      "job-1",
      expect.objectContaining({ status: "failed" })
    );
    const event = calls.find(
      (c) => c.table === "draw_events" && c.method === "insert"
    );
    expect(event?.args[0]).toMatchObject({
      kind: "state",
      state: "failed",
      error_code: "PARENT_EXPIRED",
    });
    const release = calls.find(
      (c) =>
        c.table === "draw_sessions" &&
        c.method === "update" &&
        "active_job_id" in (c.args[0] as object)
    );
    expect(release?.args[0]).toMatchObject({
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

  function uploadDb() {
    return fakeDb((q) => {
      if (q.table === "creative_assets" && q.op === "select") {
        return { data: null };
      }
      if (q.table === "creative_assets" && q.op === "insert") {
        return {
          data: {
            id: "a1",
            user_id: "u1",
            box_asset_id: "draw:x",
            sha256: "s",
            ext: "png",
            kind: "png",
            bytes: 68,
            storage_key: "k",
          },
        };
      }
      return { data: null, error: null };
    });
  }

  it("accepts a structurally valid PNG", async () => {
    const { supabase } = uploadDb();
    const asset = await storeDrawUpload(
      supabase,
      "u1",
      `data:image/png;base64,${PNG_1PX}`
    );
    expect(asset?.id).toBe("a1");
  });

  it("rejects magic-byte-only junk, truncation, and non-PNG types", async () => {
    const { supabase } = uploadDb();
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
  it("projects the latest delivered zap job as latestAnimation", async () => {
    const { supabase } = fakeDb((q) => {
      if (q.table === "draw_events") return { data: [] };
      if (
        q.table === "creative_jobs" &&
        q.op === "select" &&
        q.args[0] === "id, output_asset_id, created_at"
      ) {
        return {
          data: {
            id: "zap-9",
            output_asset_id: "a-9",
            created_at: "2026-09-11T00:00:00.000Z",
          },
        };
      }
      if (q.table === "creative_jobs" && q.op === "select") {
        return { data: [] };
      }
      if (q.table === "creative_assets") return { data: { storage_key: "k" } };
      return { data: null, error: null };
    });
    const status = await drawStatus(supabase, drawSession(), -1);
    expect(status.latestAnimation).toEqual({
      jobId: "zap-9",
      url: "https://signed/asset.mp4",
      createdAt: "2026-09-11T00:00:00.000Z",
    });
  });

  it("returns null when the delivered zap's asset can't be signed", async () => {
    const { supabase } = fakeDb((q) => {
      if (q.table === "draw_events") return { data: [] };
      if (
        q.table === "creative_jobs" &&
        q.op === "select" &&
        q.args[0] === "id, output_asset_id, created_at"
      ) {
        return { data: { id: "zap-9", output_asset_id: "a-9" } };
      }
      if (q.table === "creative_jobs") return { data: [] };
      if (q.table === "creative_assets") return { data: null };
      return { data: null, error: null };
    });
    const status = await drawStatus(supabase, drawSession(), -1);
    expect(status.latestAnimation).toBeNull();
  });
});
