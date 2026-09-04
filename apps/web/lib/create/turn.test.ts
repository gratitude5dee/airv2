import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const hermes = vi.hoisted(() => ({
  ensureSession: vi.fn(async () => ({ created: true })),
  createRun: vi.fn(async () => ({ run_id: "run-1" })),
  stopRun: vi.fn(async () => undefined),
}));
vi.mock("../hermes/client", () => hermes);
const boxes = vi.hoisted(() => ({
  ensureBoxAwake: vi.fn(async () => ({ target: { baseUrl: "http://box", token: "t" } })),
  armStopAfter: vi.fn(async () => undefined),
}));
vi.mock("../orchestrator/boxes", () => boxes);
vi.mock("../miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../miniapps/publish")>()),
  publisherUsername: async () => "alice",
}));
const drop = vi.hoisted(() => ({
  resolveOrCreateDropApp: vi.fn(async (_s: unknown, _u: string, input: { appname: string }) => ({
    app: {
      id: `app-${input.appname}`,
      slug: `alice-${input.appname}`,
      name: input.appname,
      lane: "vibe",
      status: "draft",
      draft_version: null,
      bundle_version: null,
    },
    created: false,
  })),
  discardEmptyDraft: vi.fn(async () => true),
}));
vi.mock("./drop", () => drop);

import { PublishError } from "../miniapps/publish";
import { CREATE_RUN_LINK_GRACE_MINUTES, CREATE_RUN_MAX_MINUTES } from "./budget";
import { startCreateTurn } from "./turn";

interface Row {
  id: string;
  user_id: string;
  trigger: string | null;
  label: string | null;
  hermes_run_id: string | null;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
}

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  insertError: null as { message: string } | null,
  /** Fails only the `hermes_run_id` link update. */
  linkError: null as { message: string } | null,
  /** Fails the close (`ended_at`) update this many more times. */
  closeFailures: 0,
  /** Ordered log of the calls that matter for attribution ordering. */
  log: [] as string[],
}));

/** In-memory agent_runs: rows are opened through the rpc; the turn only updates them here. */
function agentRuns(): Record<string, unknown> {
  const filters: ((row: Row) => boolean)[] = [];
  let pending: { update?: Partial<Row> } = {};
  const matching = (): Row[] => state.rows.filter((row) => filters.every((f) => f(row)));
  const builder: Record<string, unknown> = {
    update(values: Partial<Row>) {
      pending = { update: values };
      return builder;
    },
    eq(column: keyof Row, value: unknown) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    is(column: keyof Row, value: unknown) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
      if (pending.update) {
        state.log.push(`agent_runs.update:${Object.keys(pending.update).join(",")}`);
        if (state.linkError && "hermes_run_id" in pending.update) {
          return Promise.resolve({ data: null, error: state.linkError }).then(resolve);
        }
        if (state.closeFailures > 0 && "ended_at" in pending.update) {
          state.closeFailures -= 1;
          return Promise.resolve({ data: null, error: { message: "write failed" } }).then(resolve);
        }
        for (const row of matching()) Object.assign(row, pending.update);
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      return Promise.resolve({ data: matching(), error: null }).then(resolve);
    },
  };
  return builder;
}

/** What `create_run_open` (0095) does under the per-user lock. */
async function createRunOpen(args: {
  p_user_id: string;
  p_trigger: string;
  p_label: string;
  p_max_minutes: number;
  p_link_grace_minutes: number;
}): Promise<{ data: unknown; error: { message: string } | null }> {
  state.log.push("agent_runs.insert");
  if (state.insertError) return { data: null, error: state.insertError };
  const now = Date.now();
  const open = state.rows.filter(
    (row) =>
      row.user_id === args.p_user_id &&
      row.label?.startsWith("create:") &&
      row.trigger !== null &&
      row.ended_at === null
  );
  for (const row of open) {
    const age = now - Date.parse(row.started_at);
    if (
      age > args.p_max_minutes * 60_000 ||
      (row.hermes_run_id === null && age > args.p_link_grace_minutes * 60_000)
    ) {
      row.ended_at = new Date(now).toISOString();
      row.outcome = "failed";
    }
  }
  const blocking = open.find((row) => row.ended_at === null && row.label !== args.p_label);
  if (blocking) return { data: [{ id: null, blocked_by: blocking.label }], error: null };
  const row: Row = {
    id: `row-${state.rows.length + 1}`,
    user_id: args.p_user_id,
    trigger: args.p_trigger,
    label: args.p_label,
    hermes_run_id: null,
    started_at: new Date(now).toISOString(),
    ended_at: null,
    outcome: null,
  };
  state.rows.push(row);
  return { data: [{ id: row.id, blocked_by: null }], error: null };
}

const supabase = {
  from: (name: string) => {
    if (name !== "agent_runs") throw new Error(`unexpected table ${name}`);
    return agentRuns();
  },
  rpc: (name: string, args: Parameters<typeof createRunOpen>[0]) => {
    if (name !== "create_run_open") throw new Error(`unexpected rpc ${name}`);
    return createRunOpen(args);
  },
} as unknown as SupabaseClient;

function openRow(label: string, ageMinutes: number, hermesRunId: string | null = null): Row {
  return {
    id: `row-${label}`,
    user_id: "user-alice",
    trigger: "web",
    label,
    hermes_run_id: hermesRunId,
    started_at: new Date(Date.now() - ageMinutes * 60_000).toISOString(),
    ended_at: null,
    outcome: null,
  };
}

const input = { appname: "countdown", input: "Make a countdown", trigger: "web" as const };
const context = { budget: { budget_usd: 5, spent_usd: 0, remaining_usd: 5 } };

beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [];
  state.insertError = null;
  state.linkError = null;
  state.closeFailures = 0;
  state.log = [];
  hermes.createRun.mockImplementation(async () => {
    state.log.push("hermes.createRun");
    return { run_id: "run-1" };
  });
});

describe("startCreateTurn attribution", () => {
  it("opens the labelled agent_runs row before Hermes starts, then links the run id", async () => {
    const result = await startCreateTurn(supabase, "user-alice", input, context);
    expect(result).toMatchObject({ run_id: "run-1", slug: "alice-countdown", session: "air-create-countdown" });
    expect(state.log).toEqual([
      "agent_runs.insert",
      "hermes.createRun",
      "agent_runs.update:hermes_run_id",
    ]);
    expect(state.rows).toEqual([
      expect.objectContaining({
        user_id: "user-alice",
        trigger: "web",
        label: "create:alice-countdown",
        hermes_run_id: "run-1",
        ended_at: null,
      }),
    ]);
    expect(boxes.armStopAfter).toHaveBeenCalledTimes(1);
  });

  it("refuses to start the run when the attribution row cannot be written", async () => {
    state.insertError = { message: "connection refused" };
    const error = await startCreateTurn(supabase, "user-alice", input, context).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PublishError);
    expect((error as PublishError).status).toBe(503);
    expect(hermes.createRun).not.toHaveBeenCalled();
    expect(boxes.ensureBoxAwake).not.toHaveBeenCalled();
  });

  it("closes the row again when Hermes fails to start, so the next turn is not blocked", async () => {
    hermes.createRun.mockRejectedValueOnce(new Error("box unreachable"));
    await expect(startCreateTurn(supabase, "user-alice", input, context)).rejects.toThrow("box unreachable");
    expect(state.rows).toEqual([
      expect.objectContaining({ hermes_run_id: null, outcome: "failed" }),
    ]);
    expect(state.rows[0]!.ended_at).not.toBeNull();
    expect(boxes.armStopAfter).toHaveBeenCalledTimes(1);

    const again = await startCreateTurn(supabase, "user-alice", input, context);
    expect(again.run_id).toBe("run-1");
  });

  it("closes the row when the Box cannot be woken", async () => {
    boxes.ensureBoxAwake.mockRejectedValueOnce(new Error("no box"));
    await expect(startCreateTurn(supabase, "user-alice", input, context)).rejects.toThrow("no box");
    expect(state.rows[0]).toMatchObject({ outcome: "failed" });
    expect(hermes.createRun).not.toHaveBeenCalled();
  });

  it("a row that is open but not yet linked still counts as the running project", async () => {
    state.rows.push(openRow("create:alice-other", 0));
    const error = await startCreateTurn(supabase, "user-alice", input, context).catch((e: unknown) => e);
    expect((error as PublishError).status).toBe(409);
    expect(hermes.createRun).not.toHaveBeenCalled();
  });

  it("a blocked turn on a brand-new name leaves no empty draft behind", async () => {
    state.rows.push(openRow("create:alice-other", 0, "run-0"));
    drop.resolveOrCreateDropApp.mockImplementationOnce(async () => ({
      app: { id: "app-new", slug: "alice-new", name: "new", lane: "vibe", status: "draft", draft_version: null, bundle_version: null },
      created: true,
    }));
    const error = await startCreateTurn(supabase, "user-alice", { ...input, appname: "new" }, context).catch((e: unknown) => e);
    expect((error as PublishError).status).toBe(409);
    expect(drop.discardEmptyDraft).toHaveBeenCalledWith(supabase, "user-alice", "app-new");
  });

  it("a second turn on the same project while its run is open is admitted", async () => {
    state.rows.push(openRow("create:alice-countdown", 1, "run-0"));
    const result = await startCreateTurn(supabase, "user-alice", input, context);
    expect(result.run_id).toBe("run-1");
    expect(state.rows).toHaveLength(2);
  });

  it("opens rows one at a time: concurrent turns for two projects admit exactly one", async () => {
    const results = await Promise.all([
      startCreateTurn(supabase, "user-alice", input, context).catch((e: unknown) => e),
      startCreateTurn(supabase, "user-alice", { ...input, appname: "other" }, context).catch((e: unknown) => e),
    ]);
    const statuses = results.map((r) => (r instanceof PublishError ? r.status : "ok"));
    expect(statuses.sort()).toEqual([409, "ok"]);
    expect(state.rows.filter((row) => row.ended_at === null)).toHaveLength(1);
    expect(hermes.createRun).toHaveBeenCalledTimes(1);
  });

  it("retires an open row that aged out, and one never linked past the grace period", async () => {
    state.rows.push(openRow("create:alice-stale", CREATE_RUN_MAX_MINUTES + 1, "run-stale"));
    state.rows.push(openRow("create:alice-orphan", CREATE_RUN_LINK_GRACE_MINUTES + 1));
    const result = await startCreateTurn(supabase, "user-alice", input, context);
    expect(result.run_id).toBe("run-1");
    expect(state.rows.filter((row) => row.ended_at === null).map((row) => row.label)).toEqual([
      "create:alice-countdown",
    ]);
    expect(state.rows.slice(0, 2).every((row) => row.outcome === "failed")).toBe(true);
  });

  it("a linked open row younger than the max is not retired", async () => {
    state.rows.push(openRow("create:alice-other", CREATE_RUN_LINK_GRACE_MINUTES + 5, "run-0"));
    const error = await startCreateTurn(supabase, "user-alice", input, context).catch((e: unknown) => e);
    expect((error as PublishError).status).toBe(409);
  });

  it("retries a failed close and closes the row once the database answers again", async () => {
    hermes.createRun.mockRejectedValueOnce(new Error("box unreachable"));
    state.closeFailures = 2;
    await expect(startCreateTurn(supabase, "user-alice", input, context)).rejects.toThrow("box unreachable");
    expect(state.closeFailures).toBe(0);
    expect(state.rows[0]).toMatchObject({ outcome: "failed" });
    expect(state.rows[0]!.ended_at).not.toBeNull();
  });

  it("when both the link and every close attempt fail, the row stops blocking after the grace period", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.linkError = { message: "write failed" };
    state.closeFailures = 3;
    const error = await startCreateTurn(supabase, "user-alice", input, context).catch((e: unknown) => e);
    expect((error as PublishError).status).toBe(503);
    expect(hermes.stopRun).toHaveBeenCalledWith(expect.anything(), "run-1");
    expect(state.closeFailures).toBe(0);
    expect(spy.mock.calls.map((call) => JSON.parse(call[0] as string).msg)).toEqual([
      "create run link failed",
      "create run close failed",
    ]);
    expect(state.rows[0]).toMatchObject({ hermes_run_id: null, ended_at: null });
    spy.mockRestore();

    state.linkError = null;
    const blocked = await startCreateTurn(supabase, "user-alice", { ...input, appname: "other" }, context).catch(
      (e: unknown) => e
    );
    expect((blocked as PublishError).status).toBe(409);

    state.rows[0]!.started_at = new Date(Date.now() - (CREATE_RUN_LINK_GRACE_MINUTES + 1) * 60_000).toISOString();
    const again = await startCreateTurn(supabase, "user-alice", { ...input, appname: "other" }, context);
    expect(again.run_id).toBe("run-1");
    expect(state.rows[0]).toMatchObject({ outcome: "failed" });
    expect(state.rows[0]!.ended_at).not.toBeNull();
  });

  it("stops the run and closes the row when the run id cannot be linked", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.linkError = { message: "write failed" };
    const error = await startCreateTurn(supabase, "user-alice", input, context).catch((e: unknown) => e);
    expect((error as PublishError).status).toBe(503);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(hermes.stopRun).toHaveBeenCalledWith(expect.anything(), "run-1");
    expect(state.rows[0]).toMatchObject({ hermes_run_id: null, outcome: "failed" });
    expect(state.rows[0]!.ended_at).not.toBeNull();
    spy.mockRestore();

    state.linkError = null;
    const again = await startCreateTurn(supabase, "user-alice", { ...input, appname: "other" }, context);
    expect(again.run_id).toBe("run-1");
  });
});
