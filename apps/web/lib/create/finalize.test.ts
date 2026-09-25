import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";
import type { IntakeRow } from "./intake";
import type { VersionRow } from "./versions";

import { expectLog } from "../testing/expectLog";
/* ------------------------------------------------------------ fake db */

interface Call {
  table: string;
  op: "select" | "insert" | "update";
  values: Record<string, unknown> | null;
  filters: Record<string, unknown>;
  mode: "many" | "maybe" | "single";
}

const db = vi.hoisted(() => ({
  calls: [] as Call[],
  /** table → handler returning `{ data, error }` for a call. */
  handlers: new Map<string, (call: Call) => { data: unknown; error: { message: string } | null }>(),
}));

function fakeSupabase(): SupabaseClient {
  const from = (table: string) => {
    const call: Call = { table, op: "select", values: null, filters: {}, mode: "many" };
    const exec = (mode: Call["mode"]) => {
      call.mode = mode;
      db.calls.push(call);
      const handler = db.handlers.get(table);
      return Promise.resolve(handler ? handler(call) : { data: mode === "many" ? [] : null, error: null });
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      insert: (values: Record<string, unknown>) => ((call.op = "insert"), (call.values = values), builder),
      update: (values: Record<string, unknown>) => ((call.op = "update"), (call.values = values), builder),
      eq: (column: string, value: unknown) => ((call.filters[column] = value), builder),
      is: (column: string, value: unknown) => ((call.filters[column] = value), builder),
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => exec("maybe"),
      single: () => exec("single"),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        exec("many").then(resolve, reject),
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

/* --------------------------------------------------------------- mocks */

const intake = vi.hoisted(() => ({
  getIntake: vi.fn(),
  advanceIntake: vi.fn(),
}));
vi.mock("./intake", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./intake")>()),
  getIntake: intake.getIntake,
  advanceIntake: intake.advanceIntake,
}));

const publish = vi.hoisted(() => ({
  ownedApp: vi.fn(),
  createDraft: vi.fn(),
  resolveOwnedAppRef: vi.fn(),
}));
vi.mock("../miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../miniapps/publish")>()),
  ownedApp: publish.ownedApp,
  createDraft: publish.createDraft,
  publisherUsername: async () => "alice",
  // resolveOwnedSlug's appname-wins path — defer to the mocked ownedApp.
  resolveOwnedAppRef: publish.resolveOwnedAppRef,
}));

const versions = vi.hoisted(() => ({ getVersion: vi.fn() }));
vi.mock("./versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./versions")>()),
  getVersion: versions.getVersion,
}));

const mirror = vi.hoisted(() => ({ mirrorVersion: vi.fn() }));
vi.mock("./mirror", () => ({ mirrorVersion: mirror.mirrorVersion }));

const limits = vi.hoisted(() => ({ recordOpsEvent: vi.fn(async () => undefined) }));
vi.mock("../security/limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../security/limits")>()),
  recordOpsEvent: limits.recordOpsEvent,
}));

import {
  applyFinalize,
  buildPublishPayload,
  FinalizeError,
  FinalizeInputSchema,
  filePublishDecision,
  mirrorConsentLine,
  NO_MIRROR_LINE,
  onPublishApproved,
  onPublishDeclined,
  onPublishDecision,
  parseFinalizeAnswers,
  parsePublishPayload,
  productionUrl,
} from "./finalize";

/* ------------------------------------------------------------ fixtures */

const app = makeApp({
  slug: "alice-promo",
  appname: "promo",
  owner_user_id: "user-alice",
  name: "Promo",
  description: "A tour page",
  status: "draft",
  visibility: "unlisted",
  bundle_version: null,
  draft_version: "v1700000000001",
  dev_version: "v1700000000001",
  dev_expires_at: "2099-01-01T00:00:00.000Z",
});

const version: VersionRow = {
  id: "row-1",
  app_id: app.id,
  user_id: "user-alice",
  version: "v1700000000001",
  lane: "vibe",
  bundle_sha256: "ab".repeat(32),
  bundle_bytes: 2048,
  file_count: 4,
  worker_sha256: null,
  kit_version: "1.4.0",
  functions: null,
  findings: [],
  qa_score: 88,
  tests_total: 3,
  tests_passed: 3,
  created_at: "2026-01-01T00:00:00.000Z",
  published_at: null,
  retired_at: null,
  purged_at: null,
};

function intakeRow(stage: IntakeRow["stage"]): IntakeRow {
  return {
    id: "intake-1",
    user_id: "user-alice",
    app_id: app.id,
    appname: "promo",
    template: "landing",
    stage,
    source: "imessage",
    questions_asked: 1,
    revisions: 0,
    plan_sha256: null,
    goal_sha256: null,
    builds: 1,
    failed_builds: 0,
    mirror_error: null,
    opened_at: "2026-01-01T00:00:00.000Z",
    confirmed_at: null,
    dev_ready_at: "2026-01-02T00:00:00.000Z",
    production_at: null,
    last_owner_message_at: null,
    updated_at: "2026-01-02T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.calls = [];
  db.handlers.clear();
  publish.ownedApp.mockResolvedValue(app);
  publish.resolveOwnedAppRef.mockImplementation(
    async (_supabase: unknown, _userId: string, ref: string) =>
      ref === "promo" || ref === "alice-promo" ? { slug: "alice-promo" } : null,
  );
  publish.createDraft.mockResolvedValue({ id: app.id, slug: app.slug, name: "Promo", created: false });
  versions.getVersion.mockResolvedValue(version);
  intake.getIntake.mockResolvedValue(intakeRow("dev_ready"));
  intake.advanceIntake.mockImplementation(async (_s, _u, _a, event: string) =>
    intakeRow(event === "ship" ? "finalizing" : event === "approved" ? "production" : event === "declined" ? "dev_ready" : "decision_sent")
  );
  mirror.mirrorVersion.mockResolvedValue({ commit: "c".repeat(40) });
  delete process.env["CREATE_MIRROR_ENABLED"];
  delete process.env["WZRD_CREATE_INSTALLATION_ID"];
});

/* --------------------------------------------------------------- pure */

describe("FinalizeInputSchema", () => {
  it("defaults mirror to true and store to listed, caps name and description", () => {
    const parsed = FinalizeInputSchema.parse({ app: "promo", name: " Promo ", description: "A tour page" });
    expect(parsed).toEqual({ app: "promo", name: "Promo", description: "A tour page", mirror: true, store: "listed" });
    expect(FinalizeInputSchema.safeParse({ app: "promo", name: "x".repeat(61), description: "" }).success).toBe(false);
    expect(FinalizeInputSchema.safeParse({ app: "promo", name: "ok", description: "y".repeat(161) }).success).toBe(false);
    expect(FinalizeInputSchema.safeParse({ app: "promo", name: "ok", description: "", extra: 1 }).success).toBe(false);
  });
});

describe("parseFinalizeAnswers", () => {
  it("keep it → keep the plan's values", () => {
    expect(parseFinalizeAnswers("keep it")).toEqual({ keep: true });
    expect(parseFinalizeAnswers("Keep it!")).toEqual({ keep: true });
    expect(parseFinalizeAnswers("looks good")).toEqual({ keep: true });
  });

  it("no mirror / keep the code private → mirror false", () => {
    expect(parseFinalizeAnswers("no mirror")).toEqual({ mirror: false });
    expect(parseFinalizeAnswers("keep the code private please")).toEqual({ mirror: false });
    expect(parseFinalizeAnswers("keep my source private")).toEqual({ mirror: false });
    expect(parseFinalizeAnswers("mirror it")).toEqual({ mirror: true });
  });

  it("unlisted → store unlisted; listed phrases → listed", () => {
    expect(parseFinalizeAnswers("unlisted")).toEqual({ store: "unlisted" });
    expect(parseFinalizeAnswers("don't list it, no mirror")).toEqual({ store: "unlisted", mirror: false });
    expect(parseFinalizeAnswers("list it")).toEqual({ store: "listed" });
  });

  it("reads a name and a description and says nothing about what it did not see", () => {
    expect(parseFinalizeAnswers("call it Tour 26, description: dates and tickets")).toEqual({
      name: "Tour 26",
      description: "dates and tickets",
    });
    expect(parseFinalizeAnswers("")).toEqual({});
    expect(parseFinalizeAnswers("sounds fun")).toEqual({});
  });
});

describe("buildPublishPayload", () => {
  it("carries the V12 fields, the consent line and platform-derived URLs only", () => {
    const payload = buildPublishPayload({ app, version, store: "listed", mirror: true });
    expect(payload).toMatchObject({
      channel: "production",
      slug: "alice-promo",
      name: "Promo",
      description: "A tour page",
      version: "v1700000000001",
      bundle_sha256: version.bundle_sha256,
      store: "listed",
      mirror: true,
      tests: { passed: 3, total: 3 },
      qa_score: 88,
      production_url: productionUrl(app),
      mirror_line: mirrorConsentLine(app),
    });
    expect(payload.dev_url).toMatch(/\/alice\/promo$/);
    expect(payload.mirror_line).toContain("github.com/gratitude5dee/wzrd-create/apps/alice/promo");
    expect(payload.mirror_line).toContain("**no mirror**");
    expect(JSON.stringify(payload)).not.toContain("plan");
  });

  it("no mirror → the private line; explicit tests/qa/dev_url win over the version row", () => {
    const payload = buildPublishPayload({
      app,
      version,
      store: "unlisted",
      mirror: false,
      tests: { passed: 1, total: 2 },
      qaScore: 71,
      devUrl: "https://link.wzrd.tech/alice/promo",
    });
    expect(payload.mirror_line).toBe(NO_MIRROR_LINE);
    expect(payload.tests).toEqual({ passed: 1, total: 2 });
    expect(payload.qa_score).toBe(71);
    expect(payload.store_line).toContain("unlisted");
    expect(parsePublishPayload(payload)).toEqual({ store: "unlisted", mirror: false, version: "v1700000000001" });
    expect(parsePublishPayload({ visibility: "public" })).toBeNull();
    expect(parsePublishPayload(null)).toBeNull();
  });
});

/* ------------------------------------------------------- filePublishDecision */

describe("filePublishDecision", () => {
  it("inserts one decision with the payload, then refreshes the pending one", async () => {
    const supabase = fakeSupabase();
    db.handlers.set("decisions", (call) =>
      call.op === "insert" ? { data: { id: "dec-1" }, error: null } : { data: null, error: null }
    );
    const payload = buildPublishPayload({ app, version, store: "listed", mirror: true });
    expect(await filePublishDecision(supabase, "user-alice", app, payload)).toBe("dec-1");
    const insert = db.calls.find((call) => call.op === "insert");
    expect(insert?.values).toMatchObject({ kind: "miniapp_publish", ref: "alice-promo", payload });

    db.calls = [];
    db.handlers.set("decisions", (call) =>
      call.op === "select" ? { data: { id: "dec-1" }, error: null } : { data: null, error: null }
    );
    expect(await filePublishDecision(supabase, "user-alice", app, payload)).toBe("dec-1");
    expect(db.calls.map((call) => call.op)).toEqual(["select", "update"]);
    expect(db.calls[1]?.values).toMatchObject({ payload });
  });
});

/* ----------------------------------------------------------- applyFinalize */

describe("applyFinalize", () => {
  const input = FinalizeInputSchema.parse({ app: "promo", name: "Promo", description: "A tour page" });

  function decisionsInsert() {
    db.handlers.set("decisions", (call) =>
      call.op === "insert" ? { data: { id: "dec-9" }, error: null } : { data: null, error: null }
    );
  }

  it("ships, writes metadata through createDraft, files the decision and moves to decision_sent", async () => {
    decisionsInsert();
    const result = await applyFinalize(fakeSupabase(), "user-alice", input);
    expect(result).toEqual({ decision_id: "dec-9", stage: "decision_sent", store: "listed", mirror: true });
    expect(publish.ownedApp).toHaveBeenCalledWith(expect.anything(), "user-alice", "alice-promo");
    expect(intake.advanceIntake.mock.calls.map((call) => call[3])).toEqual(["ship", "finalize_complete"]);
    expect(publish.createDraft).toHaveBeenCalledWith(expect.anything(), "user-alice", {
      appname: "promo",
      name: "Promo",
      description: "A tour page",
    });
    const insert = db.calls.find((call) => call.table === "decisions" && call.op === "insert");
    expect(insert?.values?.["payload"]).toMatchObject({ channel: "production", store: "listed", mirror: true });
    // No content beyond name/description ever reaches the row writes.
    expect(db.calls.some((call) => call.table === "create_intakes")).toBe(false);
  });

  it("an intake already in finalizing skips the ship event; icon_key is written when it is this lane's key", async () => {
    intake.getIntake.mockResolvedValue(intakeRow("finalizing"));
    decisionsInsert();
    const key = `apps/alice-promo/icon/${"f".repeat(64)}.png`;
    await applyFinalize(fakeSupabase(), "user-alice", { ...input, icon_key: key, store: "unlisted", mirror: false });
    expect(intake.advanceIntake.mock.calls.map((call) => call[3])).toEqual(["finalize_complete"]);
    const iconWrite = db.calls.find((call) => call.table === "mini_apps" && call.op === "update");
    expect(iconWrite?.values).toMatchObject({ icon_key: key });
    const insert = db.calls.find((call) => call.table === "decisions" && call.op === "insert");
    expect(insert?.values?.["payload"]).toMatchObject({ store: "unlisted", mirror: false, mirror_line: NO_MIRROR_LINE });
  });

  it("409 not_ready when there is no dev release or the stage is wrong", async () => {
    publish.ownedApp.mockResolvedValueOnce({ ...app, dev_version: null });
    await expect(applyFinalize(fakeSupabase(), "user-alice", input)).rejects.toMatchObject({
      status: 409,
      message: "not_ready",
      reasons: ["no_dev_release"],
    });
    intake.getIntake.mockResolvedValueOnce(intakeRow("building"));
    await expect(applyFinalize(fakeSupabase(), "user-alice", input)).rejects.toMatchObject({
      status: 409,
      reasons: ["stage:building"],
    });
    intake.getIntake.mockResolvedValueOnce(null);
    await expect(applyFinalize(fakeSupabase(), "user-alice", input)).rejects.toMatchObject({
      reasons: ["no_intake"],
    });
    expect(intake.advanceIntake).not.toHaveBeenCalled();
    expect(publish.createDraft).not.toHaveBeenCalled();
  });

  it("refuses an icon_key that is not this app's icon", async () => {
    await expect(
      applyFinalize(fakeSupabase(), "user-alice", { ...input, icon_key: "u/alice/icons/party.png" })
    ).rejects.toBeInstanceOf(FinalizeError);
    await expect(
      applyFinalize(fakeSupabase(), "user-alice", { ...input, icon_key: `apps/bob-x/icon/${"a".repeat(64)}.png` })
    ).rejects.toMatchObject({ status: 400 });
  });
});

/* -------------------------------------------------------- approval hooks */

describe("onPublishApproved", () => {
  const decision = {
    id: "dec-1",
    payload: buildPublishPayload({ app, version, store: "listed", mirror: true }),
  };
  const live = { ...app, status: "published" as const, bundle_version: "v1700000000001" };

  beforeEach(() => {
    publish.ownedApp.mockResolvedValue(live);
    intake.getIntake.mockResolvedValue(intakeRow("decision_sent"));
  });

  it("listed → visibility public + listed_at, intake → production; mirror skipped while the lane is off", async () => {
    const outcome = await onPublishApproved(fakeSupabase(), "user-alice", "alice-promo", decision);
    expect(outcome).toEqual({ listed: true, mirrored: false, mirror_error: null });
    const list = db.calls.find((call) => call.table === "mini_apps" && call.op === "update");
    expect(list?.values).toMatchObject({ visibility: "public" });
    expect(list?.values?.["listed_at"]).toEqual(expect.any(String));
    expect(intake.advanceIntake).toHaveBeenCalledWith(expect.anything(), "user-alice", "promo", "approved");
    expect(mirror.mirrorVersion).not.toHaveBeenCalled();
  });

  it("unlisted keeps the app off the store", async () => {
    const unlisted = { ...decision, payload: { ...decision.payload, store: "unlisted" } };
    const outcome = await onPublishApproved(fakeSupabase(), "user-alice", "alice-promo", unlisted);
    expect(outcome.listed).toBe(false);
    const list = db.calls.find((call) => call.table === "mini_apps" && call.op === "update");
    expect(list?.values).toEqual({ visibility: "unlisted", updated_at: expect.any(String) });
  });

  it("mirrors when the payload, the flag and the installation all say yes", async () => {
    process.env["CREATE_MIRROR_ENABLED"] = "true";
    process.env["WZRD_CREATE_INSTALLATION_ID"] = "4242";
    const outcome = await onPublishApproved(fakeSupabase(), "user-alice", "alice-promo", decision);
    expect(outcome.mirrored).toBe(true);
    expect(mirror.mirrorVersion).toHaveBeenCalledWith(expect.anything(), live, version);
    expect(versions.getVersion).toHaveBeenCalledWith(expect.anything(), app.id, "v1700000000001");
  });

  it("no mirror in the payload → no mirror call even with the lane on", async () => {
    process.env["CREATE_MIRROR_ENABLED"] = "true";
    process.env["WZRD_CREATE_INSTALLATION_ID"] = "4242";
    await onPublishApproved(fakeSupabase(), "user-alice", "alice-promo", {
      ...decision,
      payload: { ...decision.payload, mirror: false },
    });
    expect(mirror.mirrorVersion).not.toHaveBeenCalled();
  });

  it("a mirror failure lands on create_intakes.mirror_error and an ops event, never throws", async () => {
    process.env["CREATE_MIRROR_ENABLED"] = "true";
    process.env["WZRD_CREATE_INSTALLATION_ID"] = "4242";
    const boom = Object.assign(new Error("github 502: bad gateway https://api.github.com/x"), {
      name: "MirrorError",
      status: 502,
    });
    mirror.mirrorVersion.mockRejectedValueOnce(boom);
    const outcome = await onPublishApproved(fakeSupabase(), "user-alice", "alice-promo", decision);
    expect(outcome).toEqual({ listed: true, mirrored: false, mirror_error: "MirrorError:502" });
    const write = db.calls.find((call) => call.table === "create_intakes" && call.op === "update");
    expect(write?.values).toMatchObject({ mirror_error: "MirrorError:502" });
    expect(write?.filters).toEqual({ id: "intake-1" });
    expect(JSON.stringify(write?.values)).not.toContain("https://");
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "mirror", "user-alice", "alice-promo:failed");
    expectLog(/mirror\ failed\ after\ publish\ approval/, { level: "error" });
  });

  it("a V11 decision (no production payload) is left alone", async () => {
    const outcome = await onPublishApproved(fakeSupabase(), "user-alice", "alice-promo", { id: "old", payload: null });
    expect(outcome).toEqual({ listed: false, mirrored: false, mirror_error: null });
    expect(db.calls).toEqual([]);
    expect(intake.advanceIntake).not.toHaveBeenCalled();
  });
});

describe("onPublishDeclined / onPublishDecision", () => {
  it("decline → dev_ready; the hook swallows every error", async () => {
    intake.getIntake.mockResolvedValue(intakeRow("decision_sent"));
    await onPublishDeclined(fakeSupabase(), "user-alice", "alice-promo");
    expect(intake.advanceIntake).toHaveBeenCalledWith(expect.anything(), "user-alice", "promo", "declined");

    intake.getIntake.mockResolvedValue(intakeRow("dev_ready"));
    intake.advanceIntake.mockClear();
    await onPublishDeclined(fakeSupabase(), "user-alice", "alice-promo");
    expect(intake.advanceIntake).not.toHaveBeenCalled();

    publish.ownedApp.mockRejectedValue(new Error("db down"));
    await expect(
      onPublishDecision(fakeSupabase(), "user-alice", "alice-promo", "approved", [{ id: "d", payload: { channel: "production" } }])
    ).resolves.toBeUndefined();
    await expect(onPublishDecision(fakeSupabase(), "user-alice", "alice-promo", "declined", [])).resolves.toBeUndefined();
  });
});
