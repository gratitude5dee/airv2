/**
 * The action log is a Box file appended to by two routes; the Box files API
 * has no compare-and-swap. These tests interleave two appenders against a
 * simulated Box and the 0099 lease RPCs to show the lease is what keeps
 * both entries, and that a lease never outlives its writer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const files = new Map<string, string>();
let readGate: Promise<void> | null = null;
let failWrites = false;
const boxCalls: string[] = [];

vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
}));
vi.mock("../box/client", () => ({
  readFile: vi.fn(async (_box: string, path: string) => {
    boxCalls.push(`read ${path}`);
    if (readGate) await readGate;
    const raw = files.get(path);
    if (raw === undefined) throw new Error("readFile: not found");
    return raw;
  }),
  writeFile: vi.fn(async (_box: string, path: string, content: string) => {
    boxCalls.push(`write ${path}`);
    if (failWrites) throw new Error("box PUT failed");
    files.set(path, content);
  }),
}));

// In-memory twin of miniapp_state_lease / miniapp_state_release (0099):
// one row per (user, app, resource); take when absent or expired.
interface LeaseRow {
  holder: string;
  expiresAt: number;
}
const leases = new Map<string, LeaseRow>();
const rpcCalls: string[] = [];
let leaseError: string | null = null;

const supabase = {
  rpc: async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push(fn);
    const key = `${args["p_user_id"]}/${args["p_app"]}/${args["p_resource"]}`;
    if (fn === "miniapp_state_lease") {
      if (leaseError) return { data: null, error: { message: leaseError } };
      const row = leases.get(key);
      if (row && row.expiresAt > Date.now()) return { data: false, error: null };
      leases.set(key, {
        holder: String(args["p_holder"]),
        expiresAt: Date.now() + Number(args["p_ttl_ms"]),
      });
      return { data: true, error: null };
    }
    if (fn === "miniapp_state_release") {
      const freed = leases.get(key)?.holder === args["p_holder"];
      if (freed) leases.delete(key);
      return { data: freed, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  },
} as unknown as SupabaseClient;

const LOG_PATH = ".hermes/miniapps/party/actions.json";
const entry = (action: string, source?: "functions") => ({
  action,
  payload: null,
  role: "owner",
  at: "2026-09-04T00:00:00.000Z",
  ...(source ? { source } : {}),
});
const log = (): { action: string }[] =>
  JSON.parse(files.get(LOG_PATH) ?? "[]") as { action: string }[];

beforeEach(() => {
  files.clear();
  leases.clear();
  boxCalls.length = 0;
  rpcCalls.length = 0;
  readGate = null;
  failWrites = false;
  leaseError = null;
});
afterEach(() => vi.restoreAllMocks());

describe("appendActionLogEntry", () => {
  it("the unleased read-modify-write drops a concurrent append (the race)", async () => {
    const { readAppState, writeAppState } = await import("./store");
    const append = async (action: string) => {
      const existing = (await readAppState(supabase, "u1", "party", "actions")) as unknown;
      const entries = Array.isArray(existing) ? (existing as unknown[]) : [];
      entries.push(entry(action));
      await writeAppState(supabase, "u1", "party", "actions", entries);
    };
    files.set(LOG_PATH, "[]");
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    const a = append("rsvp");
    const b = append("apps-api");
    open();
    await Promise.all([a, b]);
    expect(log()).toHaveLength(1);
  });

  it("leases the append so two interleaved writers both survive, in order", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    files.set(LOG_PATH, "[]");
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    // A takes the lease and blocks inside its read; B must not read yet.
    const a = appendActionLogEntry(supabase, "u1", "party", entry("rsvp", "functions"), {
      backoffMs: 5,
    });
    await vi.waitFor(() => expect(boxCalls).toContain(`read ${LOG_PATH}`));
    const b = appendActionLogEntry(supabase, "u1", "party", entry("apps-api"), {
      backoffMs: 5,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(boxCalls.filter((c) => c.startsWith("read"))).toHaveLength(1);
    expect(rpcCalls.filter((c) => c === "miniapp_state_lease").length).toBeGreaterThan(1);
    open();
    await Promise.all([a, b]);
    expect(log().map((e) => e.action)).toEqual(["rsvp", "apps-api"]);
    expect(leases.size).toBe(0);
  });

  it("many concurrent appenders all land", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        appendActionLogEntry(supabase, "u1", "party", entry(`a${i}`), {
          backoffMs: 2,
          attempts: 50,
        })
      )
    );
    expect(log()).toHaveLength(8);
    expect(new Set(log().map((e) => e.action)).size).toBe(8);
    expect(leases.size).toBe(0);
  });

  it("keeps only the newest 200 entries", async () => {
    const { appendActionLogEntry, ACTION_LOG_MAX_ENTRIES } = await import("./actionLog");
    files.set(
      LOG_PATH,
      JSON.stringify(Array.from({ length: 200 }, (_, i) => entry(`old${i}`)))
    );
    await appendActionLogEntry(supabase, "u1", "party", entry("new"));
    const entries = log();
    expect(entries).toHaveLength(ACTION_LOG_MAX_ENTRIES);
    expect(entries[0]?.action).toBe("old1");
    expect(entries.at(-1)?.action).toBe("new");
  });

  it("starts a fresh log when the file is missing or malformed", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    await appendActionLogEntry(supabase, "u1", "party", entry("first"));
    expect(log().map((e) => e.action)).toEqual(["first"]);
    files.set(LOG_PATH, '{"not":"an array"}');
    await appendActionLogEntry(supabase, "u1", "party", entry("second"));
    expect(log().map((e) => e.action)).toEqual(["second"]);
  });

  it("gives up with ActionLogBusyError when the lease stays held, writing nothing", async () => {
    const { appendActionLogEntry, ActionLogBusyError } = await import("./actionLog");
    leases.set("u1/party/actions", { holder: "someone-else", expiresAt: Date.now() + 60_000 });
    await expect(
      appendActionLogEntry(supabase, "u1", "party", entry("rsvp"), {
        attempts: 3,
        backoffMs: 1,
      })
    ).rejects.toBeInstanceOf(ActionLogBusyError);
    expect(rpcCalls.filter((c) => c === "miniapp_state_lease")).toHaveLength(3);
    expect(boxCalls).toHaveLength(0);
    expect(files.has(LOG_PATH)).toBe(false);
  });

  it("reclaims an expired lease left by a crashed writer", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    leases.set("u1/party/actions", { holder: "crashed", expiresAt: Date.now() - 1 });
    await appendActionLogEntry(supabase, "u1", "party", entry("rsvp"), { attempts: 1 });
    expect(log().map((e) => e.action)).toEqual(["rsvp"]);
    expect(leases.size).toBe(0);
  });

  it("releases the lease when the Box write fails, so the next writer proceeds", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    failWrites = true;
    await expect(
      appendActionLogEntry(supabase, "u1", "party", entry("rsvp"))
    ).rejects.toThrow("box PUT failed");
    expect(leases.size).toBe(0);
    failWrites = false;
    await appendActionLogEntry(supabase, "u1", "party", entry("next"), { attempts: 1 });
    expect(log().map((e) => e.action)).toEqual(["next"]);
  });

  it("a lease RPC failure is an error, not a silent unleased write", async () => {
    const { appendActionLogEntry, ActionLogBusyError } = await import("./actionLog");
    leaseError = "connection refused";
    const failure = appendActionLogEntry(supabase, "u1", "party", entry("rsvp"));
    await expect(failure).rejects.toThrow("state lease failed");
    await expect(failure).rejects.not.toBeInstanceOf(ActionLogBusyError);
    expect(boxCalls).toHaveLength(0);
  });

  it("scopes leases per (user, app): another app's writer is never blocked", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    leases.set("u1/party/actions", { holder: "busy", expiresAt: Date.now() + 60_000 });
    await appendActionLogEntry(supabase, "u1", "other", entry("rsvp"), { attempts: 1 });
    await appendActionLogEntry(supabase, "u2", "party", entry("rsvp"), { attempts: 1 });
    expect(files.get(".hermes/miniapps/other/actions.json")).toBeDefined();
    expect(rpcCalls.filter((c) => c === "miniapp_state_lease")).toHaveLength(2);
    expect(leases.get("u1/party/actions")?.holder).toBe("busy");
  });
});
