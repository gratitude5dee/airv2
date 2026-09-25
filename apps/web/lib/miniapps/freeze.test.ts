/**
 * freezeRecipe + resolveFreezeRender: the trajectory contract the fal
 * multi-angle endpoint enforces (2–12 keyframes, time 0→1, azimuth ±360,
 * elevation ±90, distance > 0), the preset catalog integrity, and the
 * caller-built plan the fal lane reads off `plan.freeze`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import {
  directFreezePlan,
  FROZEN_SCENE_PROMPT,
  PRESETS,
  getPreset,
  validateTrajectory,
} from "./freezeRecipe";
import {
  admitFreezeSketch,
  buildFreezeEditGraph,
  mintFreezeClipUpload,
  registerFreezeClip,
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
    clip_asset_id: null,
    clip_in: null,
    clip_out: null,
    freeze_at: null,
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
   * Seed the session row the CAS predicates see: `null` leaves the table
   * empty (session deleted mid-flight); `sessionRow` overrides model a row
   * that drifted since the caller's snapshot — a crossed deadline, a flipped
   * status, or a held slot. `sessionErr` fails the fallback re-read.
   */
  function admitDb(db: {
    sessionRow?: Partial<FreezeSession> | null;
    sessionErr?: { message: string } | null;
  }): { supabase: SupabaseClient; db: FakeSupabase } {
    const fake = new FakeSupabase();
    fake.tables["freeze_sessions"] =
      db.sessionRow === null
        ? []
        : [{ ...session(), ...(db.sessionRow ?? {}) }];
    fake.tables["freeze_events"] = [];
    fake.tables["creative_jobs"] = [];
    if (db.sessionErr) {
      fake.opErrors["freeze_sessions:select"] = db.sessionErr;
    }
    return { supabase: fake.client(), db: fake };
  }

  it("reports SESSION_EXPIRED when the deadline passed mid-admission", async () => {
    await expect(
      admitFreezeSketch(
        admitDb({
          sessionRow: { status: "active", expires_at: pastIso() },
        }).supabase,
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("reports SESSION_EXPIRED when the row flipped inactive", async () => {
    await expect(
      admitFreezeSketch(
        admitDb({
          sessionRow: { status: "expired", expires_at: futureIso() },
        }).supabase,
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("reports SESSION_EXPIRED when the session row is gone", async () => {
    await expect(
      admitFreezeSketch(
        admitDb({ sessionRow: null }).supabase,
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("reports STORE_FAILED when the fallback read itself fails", async () => {
    await expect(
      admitFreezeSketch(
        admitDb({
          // The slot is held so the claim fails; the re-read is what errors.
          sessionRow: { active_job_id: "job-held" },
          sessionErr: { message: "postgrest unreachable" },
        }).supabase,
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "STORE_FAILED" });
  });

  it("reports JOB_ALREADY_ACTIVE on a live session whose slot is held", async () => {
    await expect(
      admitFreezeSketch(
        admitDb({
          sessionRow: {
            status: "active",
            expires_at: futureIso(),
            active_job_id: "job-held",
          },
        }).supabase,
        session(),
        sketchInput
      )
    ).rejects.toMatchObject({ code: "JOB_ALREADY_ACTIVE" });
  });

  it("admits when the claim lands", async () => {
    const { supabase, db } = admitDb({ sessionRow: {} });
    const job = await admitFreezeSketch(supabase, session(), sketchInput);
    const jobRow = db.rows("creative_jobs")[0];
    expect(job.id).toBe(jobRow?.["id"]);
    expect(db.rows("freeze_sessions")[0]?.["active_job_id"]).toBe(job.id);
    expect(db.rows("freeze_sessions")[0]?.["latest_job_id"]).toBe(job.id);
    expect(
      db.inserts.find((i) => i.table === "freeze_events")?.row
    ).toMatchObject({ kind: "state", state: "admitted" });
  });
});

/**
 * The stitched edit graph — the port of the reference editor's filter
 * plan. Segments: source[clipIn→freezeAt] + camera + source[freezeAt→
 * clipOut]; edges under one frame are dropped; audio legs mirror the
 * video and pad silent where a side has no track.
 */
describe("buildFreezeEditGraph", () => {
  const win = { clipIn: 4, clipOut: 20, freezeAt: 12 };

  it("splices the camera move between two source legs", () => {
    const { graph, hasAudio } = buildFreezeEditGraph(
      1920,
      1080,
      win,
      5,
      true,
      false
    );
    expect(hasAudio).toBe(true);
    expect(graph).toContain("trim=start=4:end=12");
    expect(graph).toContain("trim=start=12:end=20");
    expect(graph).toContain(
      "scale=1920:1080,setsar=1,fps=30,format=yuv420p"
    );
    expect(graph).toContain("[before][camera][after]concat=n=3:v=1:a=0[v]");
    // Source audio around the freeze, silence under the camera move.
    expect(graph).toContain("atrim=start=4:end=12");
    expect(graph).toContain("atrim=start=12:end=20");
    expect(graph).toContain("anullsrc=r=48000:cl=stereo,atrim=duration=5");
    expect(graph).toContain("concat=n=3:v=0:a=1[a]");
  });

  it("drops a sub-frame front edge instead of emitting an empty leg", () => {
    const { graph } = buildFreezeEditGraph(
      1280,
      720,
      { clipIn: 10, clipOut: 20, freezeAt: 10.01 },
      5,
      false,
      false
    );
    expect(graph).not.toContain("[before]");
    expect(graph).toContain("[camera][after]concat=n=2:v=1:a=0[v]");
  });

  it("freeze-at-start yields camera + tail only", () => {
    const { graph, hasAudio } = buildFreezeEditGraph(
      1280,
      720,
      { clipIn: 0, clipOut: 8, freezeAt: 0 },
      6,
      true,
      true
    );
    expect(graph).not.toContain("[before]");
    expect(graph).toContain("[camera][after]concat=n=2:v=1:a=0[v]");
    // camera audio + source tail, no silent pad for a dropped leg
    expect(graph).toContain("[1:a]asetpts");
    expect(graph).toContain("[acamera][aafter]concat=n=2:v=0:a=1[a]");
    expect(hasAudio).toBe(true);
  });

  it("emits no audio branch when neither side has a track", () => {
    const { graph, hasAudio } = buildFreezeEditGraph(
      1280,
      720,
      win,
      5,
      false,
      false
    );
    expect(hasAudio).toBe(false);
    expect(graph).not.toContain("[a]");
    expect(graph).not.toContain("anullsrc");
  });
});

/** Clip lane guards — the mint rejects non-video mimes and the commit
 * validates the window before touching storage (a fake without .storage
 * suffices: the BAD_CLIP checks all throw first). */
describe("freeze clip lane", () => {
  const futureIso = () => new Date(Date.now() + 60_000).toISOString();
  const session = (): FreezeSession => ({
    id: "sess-1",
    user_id: "user-1",
    space_id: "space-1",
    phone: "+15550001",
    status: "active",
    source_asset_id: null,
    clip_asset_id: null,
    clip_in: null,
    clip_out: null,
    freeze_at: null,
    active_job_id: null,
    latest_job_id: null,
    event_sequence: 0,
    expires_at: futureIso(),
    created_at: "",
  });
  const none = {} as unknown as SupabaseClient;

  it("rejects a non-video mime on the mint", async () => {
    await expect(
      mintFreezeClipUpload(none, session(), "image/png")
    ).rejects.toMatchObject({ code: "BAD_CLIP" });
    await expect(
      mintFreezeClipUpload(none, { ...session(), status: "expired" }, "video/mp4")
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  const uuid = "11111111-2222-4333-8444-555555555555";
  const clipDir = "user-1/freeze-clips/sess-1";
  const clipPath = `${clipDir}/${uuid}.mp4`;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects out-of-window and malformed commits before storage", async () => {
    const base = {
      path: clipPath,
      sha: "a".repeat(64),
      bytes: 1024,
    };
    await expect(
      registerFreezeClip(none, session(), {
        ...base,
        window: { clipIn: 0, clipOut: 31, freezeAt: 5 },
      })
    ).rejects.toMatchObject({ code: "BAD_CLIP" });
    await expect(
      registerFreezeClip(none, session(), {
        ...base,
        window: { clipIn: 0, clipOut: 20, freezeAt: 25 },
      })
    ).rejects.toMatchObject({ code: "BAD_CLIP" });
    await expect(
      registerFreezeClip(none, session(), {
        ...base,
        sha: "not-hex",
        window: { clipIn: 0, clipOut: 20, freezeAt: 5 },
      })
    ).rejects.toMatchObject({ code: "BAD_CLIP" });
    // Off-session keys, nested paths, and non-uuid names are all refused —
    // only the flat minted basename shape is admissible.
    await expect(
      registerFreezeClip(none, session(), {
        ...base,
        path: `user-1/freeze-clips/other/${uuid}.mp4`,
        window: { clipIn: 0, clipOut: 20, freezeAt: 5 },
      })
    ).rejects.toMatchObject({ code: "BAD_CLIP" });
    await expect(
      registerFreezeClip(none, session(), {
        ...base,
        path: `${clipDir}/sub/${uuid}.mp4`,
        window: { clipIn: 0, clipOut: 20, freezeAt: 5 },
      })
    ).rejects.toMatchObject({ code: "BAD_CLIP" });
    await expect(
      registerFreezeClip(none, session(), {
        ...base,
        path: `${clipDir}/clip.mp4`,
        window: { clipIn: 0, clipOut: 20, freezeAt: 5 },
      })
    ).rejects.toMatchObject({ code: "BAD_CLIP" });
  });

  /** Seed the stored clip object and creative_assets rows the commit reads:
   * the fake's storage.list enumerates storageObjects (metadata.size is the
   * stored body's real size) and remove() deletes them, so a dedupe drop or
   * a failed insert is asserted on real object state. The signed fetch is
   * stubbed to a one-chunk stream — the fingerprint hashes those bytes. */
  function clipDb(db: {
    storedSize?: number;
    missingObject?: boolean;
    dedupe?: { id: string; storage_key: string } | null;
    insertErr?: { message: string } | null;
  }): { supabase: SupabaseClient; db: FakeSupabase } {
    const fake = new FakeSupabase();
    fake.tables["creative_assets"] = [];
    if (!db.missingObject) {
      fake.storageObjects[`creative-assets/${clipPath}`] = new Uint8Array(
        db.storedSize ?? 1024
      );
    }
    if (db.dedupe) {
      fake.tables["creative_assets"] = [
        {
          id: db.dedupe.id,
          user_id: "user-1",
          sha256: clipSha(db.storedSize ?? 1024),
          storage_key: db.dedupe.storage_key,
        },
      ];
    }
    if (db.insertErr) {
      fake.opErrors["creative_assets:insert"] = db.insertErr;
    }
    vi.stubGlobal("fetch", vi.fn(async () => clipFetch()));
    return { supabase: fake.client(), db: fake };
  }

  /** The fingerprint the commit recomputes over the stubbed head bytes. */
  function clipSha(bytes: number): string {
    return createHash("sha256")
      .update(new Uint8Array([1, 2, 3]))
      .update(`:${bytes}`)
      .digest("hex");
  }

  function clipFetch() {
    return {
      ok: true,
      body: {
        getReader: () => {
          let sent = false;
          return {
            read: () =>
              Promise.resolve(
                sent
                  ? { done: true, value: undefined }
                  : ((sent = true),
                    { done: false, value: new Uint8Array([1, 2, 3]) })
              ),
            cancel: () => Promise.resolve(),
          };
        },
      },
    };
  }

  /** remove() calls recorded against the fake: each entry is one path list. */
  function removedPaths(db: FakeSupabase): string[][] {
    return db.storageCalls
      .filter((c) => c.method === "remove")
      .map((c) => c.args[0] as string[]);
  }

  const clipArgs = {
    path: clipPath,
    sha: "b".repeat(64),
    bytes: 1024,
    window: { clipIn: 0, clipOut: 20, freezeAt: 5 },
  };

  it("rejects when the object never landed or its size was forged", async () => {
    await expect(
      registerFreezeClip(
        clipDb({ missingObject: true }).supabase,
        session(),
        clipArgs
      )
    ).rejects.toMatchObject({ code: "CLIP_MISSING" });
    await expect(
      registerFreezeClip(
        clipDb({ storedSize: 4096 }).supabase,
        session(),
        clipArgs
      )
    ).rejects.toMatchObject({ code: "BAD_CLIP" });
  });

  it("registers a verified object and ignores the claimed sha", async () => {
    const { supabase, db } = clipDb({});
    const id = await registerFreezeClip(supabase, session(), clipArgs);
    const row = db.rows("creative_assets")[0];
    expect(id).toBe(row?.["id"]);
    // The commit recomputes the fingerprint — the claimed "b…" sha never
    // reaches the row, and the stored object stays put.
    expect(row?.["sha256"]).toBe(clipSha(1024));
    expect(removedPaths(db)).toEqual([]);
    expect(db.storageObjects[`creative-assets/${clipPath}`]).toBeDefined();
  });

  it("drops the duplicate object on a dedupe hit", async () => {
    const { supabase, db } = clipDb({
      dedupe: { id: "asset-9", storage_key: `${clipDir}/older.mp4` },
    });
    const id = await registerFreezeClip(supabase, session(), clipArgs);
    expect(id).toBe("asset-9");
    expect(removedPaths(db)).toEqual([[clipPath]]);
    expect(db.storageObjects[`creative-assets/${clipPath}`]).toBeUndefined();
  });

  it("removes the object when the asset insert fails", async () => {
    const { supabase, db } = clipDb({ insertErr: { message: "rls denied" } });
    await expect(
      registerFreezeClip(supabase, session(), clipArgs)
    ).rejects.toMatchObject({ code: "STORE_FAILED" });
    expect(removedPaths(db)).toEqual([[clipPath]]);
    expect(db.storageObjects[`creative-assets/${clipPath}`]).toBeUndefined();
  });
});
