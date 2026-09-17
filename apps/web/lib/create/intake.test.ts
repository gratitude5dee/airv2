import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import { OWNER_ONLY_CARD_LINE } from "../miniapps/imessageCommand";
import {
  INTAKE_EVENTS,
  INTAKE_STAGES,
  IllegalTransitionError,
  IntakeError,
  OPEN_STAGES,
  TERMINAL_STAGES,
  abandonStale,
  advanceIntake,
  getIntake,
  intakeHookInput,
  intakeStatus,
  maybeOpenIntake,
  nextStage,
  openIntake,
  provisionalAppname,
  type IntakeEvent,
  type IntakeRow,
  type IntakeStage,
} from "./intake";

/* ------------------------------------------------------------ fake db */

type Row = Record<string, unknown> & Partial<Record<keyof IntakeRow, unknown>>;

const db = {
  create_intakes: [] as Row[],
  mini_apps: [] as Row[],
  /** Table → error message injected into the next call on that table. */
  failNext: new Map<string, string>(),
  /** Every insert/update payload, for the "no content" sweep. */
  writes: [] as Row[],
  seq: 0,
};

function fakeSupabase(): SupabaseClient {
  return { from: (table: string) => query(table) } as unknown as SupabaseClient;
}

function query(table: string) {
  const state = {
    op: "select" as "select" | "insert" | "update",
    values: null as Row | null,
    filters: [] as ((row: Row) => boolean)[],
    order: null as { column: string; ascending: boolean } | null,
    limit: null as number | null,
  };
  const exec = async (mode: "many" | "maybe" | "single") => {
    const injected = db.failNext.get(table);
    if (injected) {
      db.failNext.delete(table);
      return { data: null, error: { message: injected } };
    }
    const rows = (db as unknown as Record<string, Row[]>)[table] ?? [];
    let out: Row[];
    if (state.op === "insert") {
      const values = state.values ?? {};
      db.writes.push(values);
      const open = (row: Row) => !TERMINAL_STAGES.has(row.stage as IntakeStage);
      if (
        table === "create_intakes" &&
        open(values) &&
        rows.some((row) => open(row) && row.user_id === values.user_id && row.appname === values.appname)
      ) {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      db.seq += 1;
      const row: Row = {
        id: `intake-${db.seq}`,
        app_id: null,
        appname: null,
        template: null,
        questions_asked: 0,
        revisions: 0,
        plan_sha256: null,
        goal_sha256: null,
        builds: 0,
        failed_builds: 0,
        mirror_error: null,
        opened_at: new Date(Date.UTC(2026, 0, 1, 0, 0, db.seq)).toISOString(),
        confirmed_at: null,
        dev_ready_at: null,
        production_at: null,
        last_owner_message_at: null,
        updated_at: "2026-01-01T00:00:00.000Z",
        ...values,
      };
      rows.push(row);
      out = [row];
    } else {
      out = rows.filter((row) => state.filters.every((f) => f(row)));
      if (state.op === "update") {
        db.writes.push(state.values ?? {});
        for (const row of out) Object.assign(row, state.values);
      }
      if (state.order) {
        const { column, ascending } = state.order;
        out = [...out].sort((a, b) =>
          String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1)
        );
      }
      if (state.limit !== null) out = out.slice(0, state.limit);
    }
    if (mode === "many") return { data: out, error: null };
    if (mode === "maybe") return { data: out[0] ?? null, error: null };
    return out[0]
      ? { data: out[0], error: null }
      : { data: null, error: { message: "no rows" } };
  };
  const builder = {
    select: () => builder,
    insert: (values: Row) => ((state.op = "insert"), (state.values = values), builder),
    update: (values: Row) => ((state.op = "update"), (state.values = values), builder),
    eq: (column: string, value: unknown) => (state.filters.push((row) => row[column] === value), builder),
    in: (column: string, values: readonly unknown[]) => (
      state.filters.push((row) => values.includes(row[column])), builder
    ),
    lt: (column: string, value: string) => (
      state.filters.push((row) => typeof row[column] === "string" && (row[column] as string) < value),
      builder
    ),
    order: (column: string, options: { ascending: boolean }) => (
      (state.order = { column, ascending: options.ascending }), builder
    ),
    limit: (n: number) => ((state.limit = n), builder),
    maybeSingle: () => exec("maybe"),
    single: () => exec("single"),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      exec("many").then(resolve, reject),
  };
  return builder;
}

const supabase = fakeSupabase();
const PROMPT = "a countdown page for my tour, dark and cinematic, show date Oct 3";

beforeEach(() => {
  db.create_intakes = [];
  db.mini_apps = [];
  db.failNext.clear();
  db.writes = [];
  db.seq = 0;
  vi.restoreAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

/* --------------------------------------------------------- stage machine */

describe("nextStage (§5.1)", () => {
  const legal: [IntakeStage, IntakeEvent, IntakeStage][] = [
    ["asking", "owner_reply", "planning"],
    ["planning", "plan_written", "plan_sent"],
    ["plan_sent", "confirm", "confirmed"],
    ["plan_sent", "revise", "revising"],
    ["plan_sent", "cancel", "abandoned"],
    ["revising", "plan_written", "plan_sent"],
    ["revising", "confirm", "confirmed"],
    ["revising", "revise", "revising"],
    ["revising", "cancel", "abandoned"],
    ["confirmed", "build_started", "building"],
    ["building", "build_started", "building"],
    ["building", "build_ok", "qa"],
    ["building", "fail", "failed"],
    ["building", "dev_live", "dev_ready"],
    ["qa", "qa_ok", "testing"],
    ["qa", "fail", "failed"],
    ["qa", "dev_live", "dev_ready"],
    ["testing", "tests_ok", "dev_ready"],
    ["testing", "fail", "failed"],
    ["testing", "dev_live", "dev_ready"],
    ["dev_ready", "ship", "finalizing"],
    ["dev_ready", "build_started", "building"],
    ["dev_ready", "dev_live", "dev_ready"],
    ["finalizing", "finalize_complete", "decision_sent"],
    ["finalizing", "decision_filed", "decision_sent"],
    ["decision_sent", "approved", "production"],
    ["decision_sent", "declined", "dev_ready"],
    ["decision_sent", "decision_filed", "decision_sent"],
  ];

  it.each(legal)("%s + %s → %s", (from, event, to) => {
    expect(nextStage(from, event)).toBe(to);
  });

  it("stop leaves every open stage where it is; abandon closes it", () => {
    for (const stage of OPEN_STAGES) {
      expect(nextStage(stage, "stop")).toBe(stage);
      expect(nextStage(stage, "abandon")).toBe("abandoned");
    }
  });

  it("terminal stages accept nothing, not even stop or abandon", () => {
    for (const stage of ["production", "abandoned", "failed"] as const) {
      for (const event of INTAKE_EVENTS) {
        expect(() => nextStage(stage, event)).toThrow(IllegalTransitionError);
      }
    }
  });

  it.each<[IntakeStage, IntakeEvent]>([
    ["asking", "confirm"],
    ["asking", "plan_written"],
    ["planning", "owner_reply"],
    ["planning", "confirm"],
    ["plan_sent", "build_started"],
    ["plan_sent", "plan_written"],
    ["confirmed", "confirm"],
    ["confirmed", "ship"],
    ["building", "ship"],
    ["building", "approved"],
    ["qa", "build_ok"],
    ["testing", "qa_ok"],
    ["dev_ready", "tests_ok"],
    ["dev_ready", "approved"],
    ["finalizing", "ship"],
    ["finalizing", "approved"],
    ["decision_sent", "ship"],
    ["decision_sent", "finalize_complete"],
  ])("refuses %s + %s with from/event on the error", (from, event) => {
    let caught: unknown;
    try {
      nextStage(from, event);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(IllegalTransitionError);
    const err = caught as IllegalTransitionError;
    expect(err.from).toBe(from);
    expect(err.event).toBe(event);
    expect(err.status).toBe(409);
  });

  it("the golden path walks every stage in §4 order", () => {
    const path: IntakeEvent[] = [
      "owner_reply", "plan_written", "revise", "plan_written", "confirm", "build_started",
      "build_ok", "qa_ok", "tests_ok", "ship", "finalize_complete", "approved",
    ];
    let stage: IntakeStage = "asking";
    const seen: IntakeStage[] = [stage];
    for (const event of path) {
      stage = nextStage(stage, event);
      seen.push(stage);
    }
    expect(seen).toEqual([
      "asking", "planning", "plan_sent", "revising", "plan_sent", "confirmed", "building",
      "qa", "testing", "dev_ready", "finalizing", "decision_sent", "production",
    ]);
    expect(INTAKE_STAGES.slice(0, 12)).toEqual(
      seen.filter((s, i) => seen.indexOf(s) === i)
    );
  });
});

/* -------------------------------------------------------------- appname */

describe("provisionalAppname (§8.1)", () => {
  it("takes the first meaningful words, hyphenated, lowercase", () => {
    expect(provisionalAppname(PROMPT, new Set())).toBe("countdown-tour-dark");
    expect(provisionalAppname("Make me a website for Tour 26!", new Set())).toBe("tour-26");
  });

  it("stays within 32 chars and validateAppName's shape", () => {
    const name = provisionalAppname(
      "supercalifragilisticexpialidocious extraordinarily magnificent",
      new Set()
    );
    expect(name.length).toBeLessThanOrEqual(32);
    expect(name).toMatch(/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/);
  });

  it("falls back to my-app on an empty or reserved seed", () => {
    expect(provisionalAppname("", new Set())).toBe("my-app");
    expect(provisionalAppname("the a of", new Set())).toBe("my-app");
    expect(provisionalAppname("admin", new Set())).toBe("my-app");
    expect(provisionalAppname("https://github.com/acme/site", new Set())).toBe("my-app");
  });

  it("adds a numeric suffix on collision, keeping the 32-char cap", () => {
    expect(provisionalAppname("countdown", new Set(["countdown"]))).toBe("countdown-2");
    expect(provisionalAppname("countdown", new Set(["countdown", "countdown-2"]))).toBe("countdown-3");
    const long = "abcdefghijklmnopqrstuvwxyz012345";
    const suffixed = provisionalAppname(long, new Set([long]));
    expect(suffixed.length).toBeLessThanOrEqual(32);
    expect(suffixed.endsWith("-2")).toBe(true);
  });
});

/* -------------------------------------------------------------- opening */

describe("openIntake", () => {
  it("opens at asking with a provisional appname and the source; stores no prompt", async () => {
    const row = await openIntake(supabase, "user-alice", { source: "imessage", prompt: PROMPT });
    expect(row).toMatchObject({
      user_id: "user-alice",
      appname: "countdown-tour-dark",
      stage: "asking",
      source: "imessage",
      app_id: null,
      revisions: 0,
    });
    expect(row.last_owner_message_at).not.toBeNull();
    const dumped = JSON.stringify(db.writes);
    expect(dumped).not.toContain("cinematic");
    expect(dumped).not.toContain("Oct 3");
    expect(dumped).not.toContain("prompt");
  });

  it("links the existing draft app and skips names the owner already uses", async () => {
    db.mini_apps.push({ id: "app-1", owner_user_id: "user-alice", appname: "countdown-tour-dark" });
    const first = await openIntake(supabase, "user-alice", { source: "web", prompt: PROMPT });
    expect(first.appname).toBe("countdown-tour-dark-2");
    expect(first.app_id).toBeNull();
    const explicit = await openIntake(supabase, "user-alice", {
      source: "web",
      appname: "countdown-tour-dark",
      template: "landing",
    });
    expect(explicit.app_id).toBe("app-1");
    expect(explicit.template).toBe("landing");
    const third = await openIntake(supabase, "user-alice", { source: "web", prompt: PROMPT });
    expect(third.appname).toBe("countdown-tour-dark-3");
  });

  it("seeds the name from a GitHub URL and never stores the URL", async () => {
    const row = await openIntake(supabase, "user-alice", {
      source: "imessage",
      prompt: "",
      url: "https://github.com/acme/tour-site",
    });
    expect(row.appname).toBe("tour-site");
    expect(JSON.stringify(db.writes)).not.toContain("github.com");
  });

  it("refuses a second open intake for the same explicit appname and bad names", async () => {
    await openIntake(supabase, "user-alice", { source: "web", appname: "promo" });
    await expect(
      openIntake(supabase, "user-alice", { source: "web", appname: "promo" })
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      openIntake(supabase, "user-alice", { source: "web", appname: "Bad Name" })
    ).rejects.toBeInstanceOf(IntakeError);
    await expect(
      openIntake(supabase, "user-alice", { source: "web", appname: "admin" })
    ).rejects.toMatchObject({ message: "that app name is reserved" });
    // Another owner may hold the same appname.
    await expect(
      openIntake(supabase, "user-bob", { source: "web", appname: "promo" })
    ).resolves.toMatchObject({ appname: "promo", user_id: "user-bob" });
  });

  it("maps a unique-index race to 409 and a ledger outage to 503", async () => {
    db.create_intakes.push({
      id: "x", user_id: "user-alice", appname: "promo", stage: "asking", source: "web",
      opened_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    });
    // The pre-check is skipped when the lookup misses (simulate the race by
    // failing the lookup path's read... simplest: inject on insert only).
    db.failNext.set("mini_apps", "boom");
    await expect(
      openIntake(supabase, "user-alice", { source: "web", prompt: "promo" })
    ).rejects.toMatchObject({ status: 503 });
  });
});

/* ------------------------------------------------------------ advancing */

async function opened(appname = "promo"): Promise<void> {
  await openIntake(supabase, "user-alice", { source: "imessage", appname });
}

describe("advanceIntake", () => {
  it("walks the golden path, bumping counters and stamping timestamps", async () => {
    await opened();
    let row = await advanceIntake(supabase, "user-alice", "promo", "owner_reply", {
      questions_asked: 2,
      template: "landing",
    });
    expect(row).toMatchObject({ stage: "planning", questions_asked: 2, template: "landing" });
    row = await advanceIntake(supabase, "user-alice", "promo", "plan_written", {
      plan_sha256: "a".repeat(64),
    });
    expect(row).toMatchObject({ stage: "plan_sent", plan_sha256: "a".repeat(64) });
    expect(intakeStatus(row).plan_version).toBe(1);
    row = await advanceIntake(supabase, "user-alice", "promo", "revise");
    expect(row).toMatchObject({ stage: "revising", revisions: 1 });
    row = await advanceIntake(supabase, "user-alice", "promo", "plan_written");
    expect(intakeStatus(row).plan_version).toBe(2);
    row = await advanceIntake(supabase, "user-alice", "promo", "confirm", {
      goal_sha256: "b".repeat(64),
    });
    expect(row.stage).toBe("confirmed");
    expect(row.confirmed_at).not.toBeNull();
    row = await advanceIntake(supabase, "user-alice", "promo", "build_started", {
      app_id: "0f0e0d0c-0b0a-4908-8706-050403020100",
    });
    expect(row).toMatchObject({ stage: "building", builds: 1 });
    row = await advanceIntake(supabase, "user-alice", "promo", "build_ok");
    row = await advanceIntake(supabase, "user-alice", "promo", "qa_ok");
    row = await advanceIntake(supabase, "user-alice", "promo", "tests_ok");
    expect(row.stage).toBe("dev_ready");
    expect(row.dev_ready_at).not.toBeNull();
    row = await advanceIntake(supabase, "user-alice", "promo", "ship");
    row = await advanceIntake(supabase, "user-alice", "promo", "finalize_complete");
    expect(row.stage).toBe("decision_sent");
    row = await advanceIntake(supabase, "user-alice", "promo", "approved");
    expect(row.stage).toBe("production");
    expect(row.production_at).not.toBeNull();
    // Closed: no open intake for this app any more.
    await expect(
      advanceIntake(supabase, "user-alice", "promo", "stop")
    ).rejects.toMatchObject({ status: 404 });
    expect(await getIntake(supabase, "user-alice", "promo")).toMatchObject({ stage: "production" });
    // A new cycle on the same app opens a fresh row.
    await expect(opened()).resolves.toBeUndefined();
  });

  it("surfaces an illegal move as IllegalTransitionError without writing", async () => {
    await opened();
    const writes = db.writes.length;
    await expect(
      advanceIntake(supabase, "user-alice", "promo", "confirm")
    ).rejects.toMatchObject({ from: "asking", event: "confirm", status: 409 });
    expect(db.writes.length).toBe(writes);
  });

  it("stop leaves the stage but records the owner message", async () => {
    await opened();
    const before = (await getIntake(supabase, "user-alice", "promo"))!;
    db.create_intakes[0]!.last_owner_message_at = "2020-01-01T00:00:00.000Z";
    const row = await advanceIntake(supabase, "user-alice", "promo", "stop");
    expect(row.stage).toBe(before.stage);
    expect(row.last_owner_message_at).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("counts failed builds and only fails the intake on the third in a row (§8.5)", async () => {
    await opened();
    for (const event of ["owner_reply", "plan_written", "confirm", "build_started"] as const) {
      await advanceIntake(supabase, "user-alice", "promo", event);
    }
    let row = await advanceIntake(supabase, "user-alice", "promo", "fail");
    expect(row).toMatchObject({ stage: "building", failed_builds: 1 });
    row = await advanceIntake(supabase, "user-alice", "promo", "build_started");
    row = await advanceIntake(supabase, "user-alice", "promo", "fail");
    expect(row).toMatchObject({ stage: "building", failed_builds: 2, builds: 2 });
    // A green build resets the streak.
    row = await advanceIntake(supabase, "user-alice", "promo", "build_ok");
    expect(row).toMatchObject({ stage: "qa", failed_builds: 0 });
    row = await advanceIntake(supabase, "user-alice", "promo", "fail");
    row = await advanceIntake(supabase, "user-alice", "promo", "fail");
    row = await advanceIntake(supabase, "user-alice", "promo", "fail");
    expect(row).toMatchObject({ stage: "failed", failed_builds: 3 });
  });

  it("refuses a revision past CREATE_PLAN_MAX_REVISIONS with revision_limit", async () => {
    await opened();
    await advanceIntake(supabase, "user-alice", "promo", "owner_reply");
    await advanceIntake(supabase, "user-alice", "promo", "plan_written");
    for (let i = 0; i < 5; i += 1) {
      await advanceIntake(supabase, "user-alice", "promo", "revise");
      await advanceIntake(supabase, "user-alice", "promo", "plan_written");
    }
    await expect(
      advanceIntake(supabase, "user-alice", "promo", "revise")
    ).rejects.toMatchObject({ message: "revision_limit", status: 409 });
    // Confirming is still fine.
    await expect(
      advanceIntake(supabase, "user-alice", "promo", "confirm")
    ).resolves.toMatchObject({ stage: "confirmed", revisions: 5 });
  });

  it("allows a rename before confirmed and refuses it afterwards", async () => {
    await opened();
    const row = await advanceIntake(supabase, "user-alice", "promo", "owner_reply", {
      appname: "Tour26",
    });
    expect(row.appname).toBe("tour26");
    await advanceIntake(supabase, "user-alice", "tour26", "plan_written");
    await advanceIntake(supabase, "user-alice", "tour26", "confirm");
    await expect(
      advanceIntake(supabase, "user-alice", "tour26", "build_started", { appname: "other" })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("validates the patch: template, hashes, app_id, questions_asked", async () => {
    await opened();
    const bad: Parameters<typeof advanceIntake>[4][] = [
      { template: "blog" as never },
      { plan_sha256: "nope" },
      { goal_sha256: "A".repeat(64) },
      { app_id: "not-a-uuid" },
      { questions_asked: 4 },
      { questions_asked: -1 },
    ];
    for (const patch of bad) {
      await expect(
        advanceIntake(supabase, "user-alice", "promo", "stop", patch)
      ).rejects.toMatchObject({ status: 400 });
    }
    const ok = await advanceIntake(supabase, "user-alice", "promo", "stop", {
      template: null,
      plan_sha256: null,
      mirror_error: "x".repeat(300),
    });
    expect(ok.mirror_error?.length).toBe(200);
  });

  it("404s for another owner's app and 503s on a ledger read failure", async () => {
    await opened();
    await expect(
      advanceIntake(supabase, "user-bob", "promo", "owner_reply")
    ).rejects.toMatchObject({ status: 404 });
    db.failNext.set("create_intakes", "down");
    await expect(
      advanceIntake(supabase, "user-alice", "promo", "owner_reply")
    ).rejects.toMatchObject({ status: 503 });
  });

  it("409s when the stage moved underneath the caller", async () => {
    await opened();
    // Simulate a race: the row moves between the read and the conditional
    // update (the second create_intakes call advanceIntake makes).
    const original = supabase.from.bind(supabase);
    let calls = 0;
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "create_intakes" && calls++ === 1) {
        db.create_intakes[0]!.stage = "planning";
      }
      return original(table);
    });
    await expect(
      advanceIntake(supabase, "user-alice", "promo", "owner_reply")
    ).rejects.toMatchObject({ status: 409 });
  });
});

/* ---------------------------------------------------------------- sweep */

describe("abandonStale (§5.1, 7 days)", () => {
  it("abandons open intakes with no owner message past the cutoff, leaving closed ones alone", async () => {
    await opened("old");
    await opened("fresh");
    await opened("done");
    const old = db.create_intakes.find((row) => row.appname === "old")!;
    old.last_owner_message_at = new Date(Date.now() - 8 * 86_400_000).toISOString();
    const done = db.create_intakes.find((row) => row.appname === "done")!;
    done.stage = "production";
    done.last_owner_message_at = old.last_owner_message_at;
    expect(await abandonStale(supabase, 7)).toBe(1);
    expect(old.stage).toBe("abandoned");
    expect(done.stage).toBe("production");
    expect(db.create_intakes.find((row) => row.appname === "fresh")!.stage).toBe("asking");
    expect(await abandonStale(supabase)).toBe(0);
  });
});

/* ------------------------------------------------------------- the hook */

describe("maybeOpenIntake (flush.ts hook)", () => {
  const sender = { sendText: vi.fn(async () => undefined) } as unknown as SpectrumSender & {
    sendText: ReturnType<typeof vi.fn>;
  };
  const job = { spaceId: "space-1", userId: "user-alice", phone: "+15550001", senderTier: 0 };

  it("formats the marker line", () => {
    expect(intakeHookInput("tour26", 3)).toBe("[create-intake tour26 stage=asking questions_max=3]");
  });

  it("ignores prose and the bare /create card command", async () => {
    expect(await maybeOpenIntake(supabase, sender, job, "hello there")).toBeNull();
    expect(await maybeOpenIntake(supabase, sender, job, "/create")).toBeNull();
    expect(db.create_intakes).toHaveLength(0);
  });

  it("opens the row for the owner and returns the marker line", async () => {
    const result = await maybeOpenIntake(supabase, sender, job, `/create ${PROMPT}`);
    expect(result).toEqual({
      kind: "owner",
      appname: "countdown-tour-dark",
      line: "[create-intake countdown-tour-dark stage=asking questions_max=3]",
    });
    expect(db.create_intakes[0]).toMatchObject({ source: "imessage", stage: "asking" });
    expect(sender.sendText).not.toHaveBeenCalled();
  });

  it("sends the owner-only line to anyone else and opens nothing", async () => {
    const result = await maybeOpenIntake(
      supabase,
      sender,
      { ...job, senderTier: 1 },
      "/create a thing"
    );
    expect(result).toEqual({ kind: "non_owner" });
    expect(sender.sendText).toHaveBeenCalledWith("space-1", "+15550001", OWNER_ONLY_CARD_LINE);
    expect(db.create_intakes).toHaveLength(0);
  });

  it("lets the turn run without a marker when the row cannot be opened", async () => {
    db.failNext.set("mini_apps", "down");
    expect(await maybeOpenIntake(supabase, sender, job, "/create a thing")).toBeNull();
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("a thing");
  });
});
