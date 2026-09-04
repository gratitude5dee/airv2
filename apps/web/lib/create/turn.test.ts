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
vi.mock("./drop", () => ({
  resolveOrCreateDropApp: async () => ({
    app: {
      id: "app-1",
      slug: "alice-countdown",
      name: "countdown",
      lane: "vibe",
      status: "draft",
      draft_version: null,
      bundle_version: null,
    },
  }),
}));

import { PublishError } from "../miniapps/publish";
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
  /** Ordered log of the calls that matter for attribution ordering. */
  log: [] as string[],
}));

/** In-memory agent_runs: the only table the turn touches after the app resolves. */
function agentRuns(): Record<string, unknown> {
  const filters: ((row: Row) => boolean)[] = [];
  let pending: { insert?: Partial<Row>; update?: Partial<Row> } = {};
  const matching = (): Row[] => state.rows.filter((row) => filters.every((f) => f(row)));
  const builder: Record<string, unknown> = {
    insert(values: Partial<Row>) {
      pending = { insert: values };
      return builder;
    },
    update(values: Partial<Row>) {
      pending = { update: values };
      return builder;
    },
    select() {
      return builder;
    },
    eq(column: keyof Row, value: unknown) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    like(column: keyof Row, pattern: string) {
      const prefix = pattern.replace(/%$/, "");
      filters.push((row) => typeof row[column] === "string" && (row[column] as string).startsWith(prefix));
      return builder;
    },
    not(column: keyof Row, _op: string, value: unknown) {
      filters.push((row) => row[column] !== value);
      return builder;
    },
    is(column: keyof Row, value: unknown) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    gte(column: keyof Row, value: string) {
      filters.push((row) => String(row[column]) >= value);
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    async maybeSingle() {
      return { data: matching()[0] ?? null, error: null };
    },
    single() {
      return builder;
    },
    then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
      if (pending.insert) {
        state.log.push("agent_runs.insert");
        if (state.insertError) return Promise.resolve({ data: null, error: state.insertError }).then(resolve);
        const row: Row = {
          id: `row-${state.rows.length + 1}`,
          user_id: "",
          trigger: null,
          label: null,
          hermes_run_id: null,
          started_at: new Date().toISOString(),
          ended_at: null,
          outcome: null,
          ...pending.insert,
        };
        state.rows.push(row);
        return Promise.resolve({ data: { id: row.id }, error: null }).then(resolve);
      }
      if (pending.update) {
        state.log.push(`agent_runs.update:${Object.keys(pending.update).join(",")}`);
        if (state.linkError && "hermes_run_id" in pending.update) {
          return Promise.resolve({ data: null, error: state.linkError }).then(resolve);
        }
        for (const row of matching()) Object.assign(row, pending.update);
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      return Promise.resolve({ data: matching(), error: null }).then(resolve);
    },
  };
  return builder;
}

const supabase = {
  from: (name: string) => {
    if (name !== "agent_runs") throw new Error(`unexpected table ${name}`);
    return agentRuns();
  },
} as unknown as SupabaseClient;

const input = { appname: "countdown", input: "Make a countdown", trigger: "web" as const };
const context = { budget: { budget_usd: 5, spent_usd: 0, remaining_usd: 5 } };

beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [];
  state.insertError = null;
  state.linkError = null;
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
    state.rows.push({
      id: "row-0",
      user_id: "user-alice",
      trigger: "web",
      label: "create:alice-other",
      hermes_run_id: null,
      started_at: new Date().toISOString(),
      ended_at: null,
      outcome: null,
    });
    const error = await startCreateTurn(supabase, "user-alice", input, context).catch((e: unknown) => e);
    expect((error as PublishError).status).toBe(409);
    expect(hermes.createRun).not.toHaveBeenCalled();
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
