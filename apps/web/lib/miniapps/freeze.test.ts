/**
 * freezeRecipe + resolveFreezeRender: the trajectory contract the fal
 * multi-angle endpoint enforces (2–12 keyframes, time 0→1, azimuth ±360,
 * elevation ±90, distance > 0), the preset catalog integrity, and the
 * caller-built plan the fal lane reads off `plan.freeze`.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  directFreezePlan,
  FROZEN_SCENE_PROMPT,
  PRESETS,
  getPreset,
  validateTrajectory,
} from "./freezeRecipe";
import {
  admitFreezeSketch,
  resolveFreezeRender,
  FreezeError,
  type FreezeSession,
} from "./freeze";

const okTrajectory = [
  { time: 0, azimuth: 0, elevation: 0, distance: 1 },
  { time: 1, azimuth: 65, elevation: 8, distance: 1 },
];

describe("validateTrajectory", () => {
  it("accepts a two-keyframe path", () => {
    expect(validateTrajectory(okTrajectory)).toHaveLength(2);
  });

  it("rejects non-arrays and wrong lengths", () => {
    expect(validateTrajectory("orbit")).toBeUndefined();
    expect(validateTrajectory([okTrajectory[0]])).toBeUndefined();
    expect(
      validateTrajectory(
        Array.from({ length: 13 }, (_, i) => ({
          time: i / 12,
          azimuth: i * 10,
          elevation: 0,
          distance: 1,
        }))
      )
    ).toBeUndefined();
  });

  it("rejects out-of-range and non-increasing values", () => {
    const base = { time: 0.5, azimuth: 0, elevation: 0, distance: 1 };
    const cases = [
      [{ ...base, azimuth: 361 }, { ...okTrajectory[0] }, { ...okTrajectory[1] }],
      [{ ...base, elevation: 91 }, ...okTrajectory],
      [{ ...base, distance: 0 }, ...okTrajectory],
      [{ ...base, time: 1.2 }, ...okTrajectory],
      [
        { ...okTrajectory[0] },
        { time: 0.5, azimuth: 40, elevation: 0, distance: 1 },
        { time: 0.5, azimuth: 60, elevation: 0, distance: 1 },
        { ...okTrajectory[1] },
      ],
      // no t=0 head / no t=1 tail
      [{ ...okTrajectory[0], time: 0.1 }, { ...okTrajectory[1] }],
      [{ ...okTrajectory[0] }, { ...okTrajectory[1], time: 0.9 }],
    ];
    for (const c of cases) expect(validateTrajectory(c)).toBeUndefined();
  });
});

describe("PRESETS", () => {
  it("has 16 presets whose trajectories all satisfy the contract", () => {
    expect(PRESETS).toHaveLength(16);
    for (const preset of PRESETS) {
      expect(validateTrajectory(preset.trajectory)).toBeTruthy();
      expect([5, 6]).toContain(preset.duration);
    }
  });

  it("keeps full orbits signed to ±360 (a 0 endpoint would reverse the orbit)", () => {
    const orbit = getPreset("orbit")!;
    const halo = getPreset("halo")!;
    expect(orbit.trajectory[orbit.trajectory.length - 1]!.azimuth).toBe(360);
    expect(halo.trajectory[halo.trajectory.length - 1]!.azimuth).toBe(360);
    expect(getPreset("orbit-left")!.trajectory.at(-1)!.azimuth).toBe(-360);
  });
});

describe("directFreezePlan", () => {
  it("builds a zap-mode plan carrying the freeze block the router can't emit", () => {
    const plan = directFreezePlan({
      trajectory: okTrajectory,
      duration: 5,
      resolution: "768P",
      returnsToStart: false,
      seed: 42,
    });
    expect(plan.mode).toBe("zap");
    expect(plan.needs_input).toBe(false);
    expect(plan.expanded_prompt).toContain("stopped time");
    expect(plan.freeze).toEqual({
      camera_trajectory: okTrajectory,
      resolution: "768P",
      seed: 42,
    });
    // The params stay schema-clean — nothing the router schema rejects.
    expect(plan.params).toEqual({
      aspect_ratio: "auto",
      duration: 5,
      generate_audio: false,
      quality: "auto",
      use_input_image_as: "first_frame",
    });
  });

  it("appends the return clause only for looping presets", () => {
    const loop = directFreezePlan({
      trajectory: okTrajectory,
      duration: 5,
      resolution: "768P",
      returnsToStart: true,
    });
    const once = directFreezePlan({
      trajectory: okTrajectory,
      duration: 5,
      resolution: "768P",
      returnsToStart: false,
    });
    expect(loop.expanded_prompt).toContain(
      "Return to the exact opening camera position"
    );
    expect(once.expanded_prompt).not.toContain(
      "Return to the exact opening camera position"
    );
    expect(loop.expanded_prompt.startsWith(FROZEN_SCENE_PROMPT)).toBe(true);
  });
});

describe("resolveFreezeRender", () => {
  it("resolves a preset id to its trajectory and duration", () => {
    const resolved = resolveFreezeRender({ presetId: "swing" });
    expect(resolved.trajectory).toEqual(getPreset("swing")!.trajectory);
    expect(resolved.duration).toBe(5);
    expect(resolved.returnsToStart).toBe(false);
    expect(resolved.resolution).toBe("768P");
  });

  it("throws BAD_PATH on an unknown preset or missing path", () => {
    expect(() => resolveFreezeRender({ presetId: "nope" })).toThrow(FreezeError);
    expect(() => resolveFreezeRender({})).toThrow(FreezeError);
  });

  it("detects a custom loop so the return clause applies", () => {
    const loop = resolveFreezeRender({
      trajectory: [
        { time: 0, azimuth: 0, elevation: 0, distance: 1 },
        { time: 0.5, azimuth: 90, elevation: 20, distance: 1 },
        { time: 1, azimuth: 0.2, elevation: 0.1, distance: 1 },
      ],
    });
    expect(loop.returnsToStart).toBe(true);
    const open = resolveFreezeRender({ trajectory: okTrajectory });
    expect(open.returnsToStart).toBe(false);
  });

  it("rejects defined-but-invalid settings instead of defaulting", () => {
    // A malformed request must not start a paid render on defaults the
    // caller never picked — only omitted fields fall back.
    expect(() =>
      resolveFreezeRender({ presetId: "swing", resolution: "4K" })
    ).toThrow(FreezeError);
    expect(() =>
      resolveFreezeRender({ presetId: "swing", duration: 7 })
    ).toThrow(FreezeError);
    expect(() =>
      resolveFreezeRender({ trajectory: okTrajectory, duration: 3 })
    ).toThrow(FreezeError);
    expect(() =>
      resolveFreezeRender({ presetId: "swing", seed: -1 })
    ).toThrow(FreezeError);
    expect(
      resolveFreezeRender({ presetId: "swing", duration: 6, seed: 42 }).seed
    ).toBe(42);
  });

  it("treats a ±360 endpoint as the opening bearing", () => {
    const loop = resolveFreezeRender({
      trajectory: [
        { time: 0, azimuth: 0, elevation: 0, distance: 1 },
        { time: 0.5, azimuth: 180, elevation: 10, distance: 1 },
        { time: 1, azimuth: 360, elevation: 0, distance: 1 },
      ],
    });
    expect(loop.returnsToStart).toBe(true);
  });
});

/**
 * admission classification: a failed slot claim must distinguish a session
 * that crossed its TTL mid-admission (or died, or the read itself failed)
 * from one whose in-flight slot is genuinely held.
 */
describe("admitFreezeSketch claim-failure classification", () => {
  const futureIso = () => new Date(Date.now() + 60_000).toISOString();
  const pastIso = () => new Date(Date.now() - 1_000).toISOString();

  const session = (over: Partial<FreezeSession> = {}): FreezeSession => ({
    id: "sess-1",
    user_id: "user-1",
    space_id: "space-1",
    phone: "+15550001",
    status: "active",
    source_asset_id: null,
    active_job_id: null,
    latest_job_id: null,
    event_sequence: 0,
    expires_at: futureIso(),
    created_at: "",
    ...over,
  });

  const sketchInput = {
    prompt: "a diner scene",
    mode: "fast" as const,
    channel: "web" as const,
  };

  /**
   * Fluent-builder stub: `insert().select("*").single()` mints the job row,
   * the slot claim (`update().eq().gt().is().select("id")`) resolves
   * `claimRows`, and the fallback `select("status, expires_at").maybeSingle()`
   * resolves `sessionRow`/`sessionErr`. Every other await resolves empty.
   */
  function fakeSupabase(db: {
    claimRows?: { id: string }[];
    sessionRow?: { status: string; expires_at: string } | null;
    sessionErr?: { message: string } | null;
  }): SupabaseClient {
    function builder(table: string) {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      for (const m of [
        "eq", "is", "in", "order", "limit", "gt", "gte", "lt", "lte", "neq",
      ]) {
        chain[m] = self;
      }
      chain["insert"] = self;
      chain["update"] = self;
      chain["select"] = (cols?: string) => {
        chain["__cols"] = cols;
        return chain;
      };
      chain["single"] = () =>
        Promise.resolve({
          data: { id: "job-1", status: "routing" },
          error: null,
        });
      chain["maybeSingle"] = () => {
        if (table === "freeze_sessions") {
          return Promise.resolve({
            data: db.sessionRow ?? null,
            error: db.sessionErr ?? null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      };
      chain["then"] = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown
      ) => {
        const isClaim =
          table === "freeze_sessions" && chain["__cols"] === "id";
        return Promise.resolve(
          isClaim
            ? { data: db.claimRows ?? [], error: null }
            : { data: null, error: null }
        ).then(resolve, reject);
      };
      return chain;
    }
    return { from: builder } as unknown as SupabaseClient;
  }

  it("reports SESSION_EXPIRED when the deadline passed mid-admission", async () => {
    await expect(
      admitFreezeSketch(
        fakeSupabase({
          claimRows: [],
          sessionRow: { status: "active", expires_at: pastIso() },
        }),
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("reports SESSION_EXPIRED when the row flipped inactive", async () => {
    await expect(
      admitFreezeSketch(
        fakeSupabase({
          claimRows: [],
          sessionRow: { status: "expired", expires_at: futureIso() },
        }),
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("reports SESSION_EXPIRED when the session row is gone", async () => {
    await expect(
      admitFreezeSketch(
        fakeSupabase({ claimRows: [], sessionRow: null }),
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("reports STORE_FAILED when the fallback read itself fails", async () => {
    await expect(
      admitFreezeSketch(
        fakeSupabase({
          claimRows: [],
          sessionRow: null,
          sessionErr: { message: "postgrest unreachable" },
        }),
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "STORE_FAILED" });
  });

  it("reports JOB_ALREADY_ACTIVE on a live session whose slot is held", async () => {
    await expect(
      admitFreezeSketch(
        fakeSupabase({
          claimRows: [],
          sessionRow: { status: "active", expires_at: futureIso() },
        }),
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "JOB_ALREADY_ACTIVE" });
  });

  it("admits when the claim lands", async () => {
    const job = await admitFreezeSketch(
      fakeSupabase({
        claimRows: [{ id: "sess-1" }],
        sessionRow: { status: "active", expires_at: futureIso() },
      }),
      session(),
      sketchInput
    );
    expect(job.id).toBe("job-1");
  });
});
